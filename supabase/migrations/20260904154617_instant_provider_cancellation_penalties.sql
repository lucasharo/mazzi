-- Aula Agora only. No retrospective penalties and no financial mutations.
CREATE SCHEMA IF NOT EXISTS mazzi_internal;
REVOKE ALL ON SCHEMA mazzi_internal FROM PUBLIC, anon, authenticated;

CREATE TABLE public.instant_conduct_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES public.bookings(id),
  instructor_id uuid NOT NULL REFERENCES public.users(id),
  kind text NOT NULL CHECK (kind IN ('CANCELLATION','NO_SHOW')),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  decision text NOT NULL DEFAULT 'PENDING' CHECK (decision IN ('PENDING','UNJUSTIFIED','EXEMPT')),
  review_note text,
  reviewed_by uuid REFERENCES public.users(id),
  reviewed_at timestamptz,
  suspension_until timestamptz,
  appeal text,
  appealed_at timestamptz
);
CREATE INDEX instant_conduct_instructor_time ON public.instant_conduct_cases(instructor_id, occurred_at DESC);
ALTER TABLE public.instant_conduct_cases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.instant_conduct_cases FROM PUBLIC, anon, authenticated;

CREATE FUNCTION mazzi_internal.instant_suspended(p_instructor uuid) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.instant_conduct_cases c WHERE c.instructor_id=p_instructor
   AND ((c.kind='NO_SHOW' AND c.decision='PENDING')
     OR (c.decision='UNJUSTIFIED' AND c.suspension_until>now())));
$$;
REVOKE ALL ON FUNCTION mazzi_internal.instant_suspended(uuid) FROM PUBLIC;

CREATE FUNCTION mazzi_internal.capture_instant_conduct() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_id uuid;
BEGIN
 IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.instant_lesson_requests WHERE booking_id=NEW.id) THEN RETURN NEW; END IF;
 -- Never charge an instructor with a cancellation performed by the student or an administrator.
 IF NEW.status::text='CANCELLED_BY_PROVIDER' AND auth.uid()=NEW.instructor_id THEN
   INSERT INTO public.instant_conduct_cases(booking_id,instructor_id,kind,reason)
   VALUES(NEW.id,NEW.instructor_id,'CANCELLATION',NEW.cancellation_reason)
   ON CONFLICT(booking_id) DO NOTHING RETURNING id INTO v_id;
 ELSIF NEW.status::text='NO_SHOW_PROVIDER' THEN
   INSERT INTO public.instant_conduct_cases(booking_id,instructor_id,kind,reason)
   VALUES(NEW.id,NEW.instructor_id,'NO_SHOW',NEW.cancellation_reason)
   ON CONFLICT(booking_id) DO NOTHING RETURNING id INTO v_id;
 END IF;
 IF v_id IS NOT NULL THEN
   INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,new_value)
   VALUES(auth.uid(),'INSTANT_CONDUCT_RECORDED','InstantConduct',v_id,jsonb_build_object('booking_id',NEW.id,'status',NEW.status));
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION mazzi_internal.capture_instant_conduct() FROM PUBLIC;
CREATE TRIGGER capture_instant_conduct AFTER UPDATE OF status ON public.bookings
FOR EACH ROW EXECUTE FUNCTION mazzi_internal.capture_instant_conduct();

CREATE FUNCTION public.get_instant_conduct_cases() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_admin boolean;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
 SELECT EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role::text='PLATFORM_ADMIN' AND status::text='ACTIVE') INTO v_admin;
 RETURN COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY c.occurred_at DESC) FROM (
   SELECT c.*,u.name AS instructor_name FROM public.instant_conduct_cases c
   JOIN public.users u ON u.id=c.instructor_id
   WHERE v_admin OR c.instructor_id=auth.uid()
   ORDER BY c.occurred_at DESC LIMIT 100
 ) c),'[]'::jsonb);
END; $$;

CREATE FUNCTION public.review_instant_conduct(p_case_id uuid,p_decision text,p_note text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_case public.instant_conduct_cases%ROWTYPE; v_count integer; v_until timestamptz; v_old jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.users WHERE id=auth.uid() AND role::text='PLATFORM_ADMIN' AND status::text='ACTIVE') THEN
   RAISE EXCEPTION 'ADMIN_REQUIRED' USING ERRCODE='42501';
 END IF;
 IF p_decision NOT IN ('UNJUSTIFIED','EXEMPT') OR p_decision IS NULL OR length(trim(coalesce(p_note,'')))<5 THEN
   RAISE EXCEPTION 'DECISION_AND_JUSTIFICATION_REQUIRED' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_case FROM public.instant_conduct_cases WHERE id=p_case_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'CASE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('instant-conduct:'||v_case.instructor_id,0));
 SELECT * INTO v_case FROM public.instant_conduct_cases WHERE id=p_case_id FOR UPDATE;
 -- Repeated requests never extend the suspension or duplicate warnings.
 IF v_case.decision=p_decision THEN RETURN to_jsonb(v_case); END IF;
 v_old:=to_jsonb(v_case);
 UPDATE public.instant_conduct_cases SET decision=p_decision,review_note=trim(p_note),reviewed_by=auth.uid(),reviewed_at=now(),suspension_until=NULL WHERE id=p_case_id;
 SELECT count(*) INTO v_count FROM public.instant_conduct_cases
 WHERE instructor_id=v_case.instructor_id AND kind='CANCELLATION' AND decision='UNJUSTIFIED' AND occurred_at>=now()-interval '30 days';
 IF p_decision='UNJUSTIFIED' AND v_case.kind='CANCELLATION' AND v_count>=3 AND v_case.occurred_at>=now()-interval '30 days' THEN
   v_until:=now()+interval '24 hours';
   UPDATE public.instant_conduct_cases SET suspension_until=v_until WHERE id=p_case_id;
 END IF;
 -- A successful appeal that removes the threshold also removes its current automatic suspension.
 IF p_decision='EXEMPT' AND v_count<3 THEN
   UPDATE public.instant_conduct_cases SET suspension_until=NULL
   WHERE instructor_id=v_case.instructor_id AND kind='CANCELLATION' AND suspension_until>now();
 END IF;
 INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,previous_value,new_value)
 VALUES(auth.uid(),CASE WHEN p_decision='EXEMPT' THEN 'INSTANT_CONDUCT_EXEMPT' WHEN v_until IS NOT NULL THEN 'INSTANT_CONDUCT_SUSPENDED' ELSE 'INSTANT_CONDUCT_WARNING' END,
 'InstantConduct',p_case_id,v_old,jsonb_build_object('decision',p_decision,'note',trim(p_note),'count_30_days',v_count,'suspension_until',v_until));
 SELECT * INTO v_case FROM public.instant_conduct_cases WHERE id=p_case_id;
 RETURN to_jsonb(v_case);
END; $$;

CREATE FUNCTION public.appeal_instant_conduct(p_case_id uuid,p_message text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
 IF length(trim(coalesce(p_message,'')))<5 OR length(p_message)>2000 THEN RAISE EXCEPTION 'APPEAL_MESSAGE_REQUIRED' USING ERRCODE='22023'; END IF;
 UPDATE public.instant_conduct_cases SET appeal=trim(p_message),appealed_at=now()
 WHERE id=p_case_id AND instructor_id=auth.uid();
 IF NOT FOUND THEN RAISE EXCEPTION 'CASE_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
 INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,new_value)
 VALUES(auth.uid(),'INSTANT_CONDUCT_APPEALED','InstantConduct',p_case_id,jsonb_build_object('message',trim(p_message)));
END; $$;

REVOKE ALL ON FUNCTION public.get_instant_conduct_cases() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.review_instant_conduct(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.appeal_instant_conduct(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_instant_conduct_cases(),public.review_instant_conduct(uuid,text,text),public.appeal_instant_conduct(uuid,text) TO authenticated;

CREATE FUNCTION mazzi_internal.guard_instant_conduct() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_instructor uuid;
BEGIN
 IF TG_TABLE_NAME='instant_lesson_offers' THEN
   IF NEW.status NOT IN ('PENDING','ACCEPTED') THEN RETURN NEW; END IF;
   v_instructor:=NEW.instructor_id;
 ELSE
   IF NOT NEW.instant_online THEN RETURN NEW; END IF;
   SELECT instructor_id INTO v_instructor FROM public.service_offerings WHERE id=NEW.offering_id;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('instant-conduct:'||v_instructor,0));
 IF mazzi_internal.instant_suspended(v_instructor) THEN
   RAISE EXCEPTION 'INSTANT_PROVIDER_SUSPENDED: Aula Agora temporariamente suspensa. Consulte as ocorrências em Gestão.' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION mazzi_internal.guard_instant_conduct() FROM PUBLIC;
CREATE TRIGGER guard_instant_conduct BEFORE INSERT OR UPDATE ON public.instant_lesson_offers
FOR EACH ROW EXECUTE FUNCTION mazzi_internal.guard_instant_conduct();
CREATE TRIGGER guard_instant_conduct BEFORE INSERT OR UPDATE ON public.provider_instant_settings
FOR EACH ROW EXECUTE FUNCTION mazzi_internal.guard_instant_conduct();

-- Preserve the installed matching algorithms, adding only the disciplinary eligibility predicate.
DO $$
DECLARE v_sig text; v_def text; v_match text:='AND public.is_provider_instructor_eligible(o.provider_id, o.instructor_id, o.category)';
BEGIN
 FOREACH v_sig IN ARRAY ARRAY['public.get_instant_price_options(double precision,double precision,text,text)','public.dispatch_instant_lesson_request(uuid)'] LOOP
   v_def:=pg_get_functiondef(v_sig::regprocedure);
   IF position(v_match IN v_def)=0 THEN RAISE EXCEPTION 'Unexpected matching definition: %',v_sig; END IF;
   EXECUTE replace(v_def,v_match,v_match||' AND NOT mazzi_internal.instant_suspended(o.instructor_id)');
 END LOOP;
END $$;
