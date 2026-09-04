-- Execute after the migration in the SAME transaction, always followed by ROLLBACK.
DO $$
DECLARE v_admin uuid; v_instructor uuid; v_bookings uuid[]; v_case uuid; v_first uuid;
 v_until timestamptz; v_result jsonb; v_denied boolean; i integer;
BEGIN
 SELECT id INTO v_admin FROM public.users WHERE role::text='PLATFORM_ADMIN' AND status::text='ACTIVE' LIMIT 1;
 SELECT u.id INTO v_instructor FROM public.users u WHERE u.role::text='INSTRUCTOR' AND u.status::text='ACTIVE'
 AND EXISTS(SELECT 1 FROM public.instant_lesson_offers o WHERE o.instructor_id=u.id)
 AND EXISTS(SELECT 1 FROM public.service_offerings o JOIN public.provider_instant_settings s ON s.offering_id=o.id WHERE o.instructor_id=u.id) LIMIT 1;
 SELECT array_agg(id) INTO v_bookings FROM (SELECT id FROM public.bookings LIMIT 5) b;
 IF v_admin IS NULL OR v_instructor IS NULL OR array_length(v_bookings,1)<5 THEN RAISE EXCEPTION 'Test fixtures unavailable'; END IF;
 PERFORM set_config('request.jwt.claim.sub',v_admin::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_admin,'role','authenticated')::text,true);
 FOR i IN 1..3 LOOP
   INSERT INTO public.instant_conduct_cases(booking_id,instructor_id,kind) VALUES(v_bookings[i],v_instructor,'CANCELLATION') RETURNING id INTO v_case;
   IF i=1 THEN v_first:=v_case; END IF;
   PERFORM public.review_instant_conduct(v_case,'UNJUSTIFIED','Teste de ocorrência injustificada');
   IF mazzi_internal.instant_suspended(v_instructor) IS DISTINCT FROM (i=3) THEN RAISE EXCEPTION 'Threshold failed at %',i; END IF;
 END LOOP;
 SELECT suspension_until INTO v_until FROM public.instant_conduct_cases WHERE id=v_case;
 IF abs(extract(epoch FROM (v_until-now()))-86400)>1 THEN RAISE EXCEPTION 'Duration must be 24h'; END IF;
 v_denied:=false;
 BEGIN
   UPDATE public.instant_lesson_offers SET status='ACCEPTED' WHERE id=(SELECT id FROM public.instant_lesson_offers WHERE instructor_id=v_instructor LIMIT 1);
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=position('INSTANT_PROVIDER_SUSPENDED' IN SQLERRM)>0; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Suspended instructor accepted an offer'; END IF;
 v_denied:=false;
 BEGIN
   UPDATE public.provider_instant_settings SET instant_online=true WHERE offering_id=(SELECT o.id FROM public.service_offerings o JOIN public.provider_instant_settings s ON s.offering_id=o.id WHERE o.instructor_id=v_instructor LIMIT 1);
 EXCEPTION WHEN insufficient_privilege THEN v_denied:=position('INSTANT_PROVIDER_SUSPENDED' IN SQLERRM)>0; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Suspended instructor enabled availability'; END IF;
 PERFORM public.review_instant_conduct(v_case,'UNJUSTIFIED','Teste de repetição idempotente');
 IF (SELECT suspension_until FROM public.instant_conduct_cases WHERE id=v_case) IS DISTINCT FROM v_until THEN RAISE EXCEPTION 'Retry extended suspension'; END IF;
 PERFORM public.review_instant_conduct(v_first,'EXEMPT','Emergência comprovada na revisão');
 IF mazzi_internal.instant_suspended(v_instructor) THEN RAISE EXCEPTION 'Exemption did not lift threshold suspension'; END IF;
 INSERT INTO public.instant_conduct_cases(booking_id,instructor_id,kind,occurred_at) VALUES(v_bookings[4],v_instructor,'CANCELLATION',now()-interval '31 days') RETURNING id INTO v_case;
 PERFORM public.review_instant_conduct(v_case,'UNJUSTIFIED','Ocorrência fora da janela móvel');
 IF mazzi_internal.instant_suspended(v_instructor) THEN RAISE EXCEPTION 'Old cancellation counted'; END IF;
 INSERT INTO public.instant_conduct_cases(booking_id,instructor_id,kind) VALUES(v_bookings[5],v_instructor,'NO_SHOW') RETURNING id INTO v_case;
 IF NOT mazzi_internal.instant_suspended(v_instructor) THEN RAISE EXCEPTION 'No-show prevention failed'; END IF;
 PERFORM public.review_instant_conduct(v_case,'EXEMPT','Falha da plataforma comprovada');
 IF mazzi_internal.instant_suspended(v_instructor) THEN RAISE EXCEPTION 'No-show exemption failed'; END IF;
 UPDATE public.instant_conduct_cases SET suspension_until=now()-interval '1 second' WHERE id=v_first;
 IF mazzi_internal.instant_suspended(v_instructor) THEN RAISE EXCEPTION 'Expired suspension still active'; END IF;
 PERFORM set_config('request.jwt.claim.sub',v_instructor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',v_instructor,'role','authenticated')::text,true);
 PERFORM public.appeal_instant_conduct(v_first,'Solicito revisão desta ocorrência');
 IF (SELECT appeal FROM public.instant_conduct_cases WHERE id=v_first) IS NULL THEN RAISE EXCEPTION 'Appeal missing'; END IF;
 v_denied:=false;
 BEGIN PERFORM public.review_instant_conduct(v_first,'EXEMPT','Tentativa de autoisenção'); EXCEPTION WHEN insufficient_privilege THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Instructor can review own penalty'; END IF;
 v_result:=public.get_instant_conduct_cases();
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_result) c WHERE c->>'instructor_id'<>v_instructor::text) THEN RAISE EXCEPTION 'Cross-user data leak'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 PERFORM set_config('request.jwt.claims','{}',true);
 v_denied:=false;
 BEGIN PERFORM public.get_instant_conduct_cases(); EXCEPTION WHEN invalid_authorization_specification THEN v_denied:=true; END;
 IF NOT v_denied THEN RAISE EXCEPTION 'Anonymous access allowed'; END IF;
END $$;
SELECT 'PASS: threshold, duration, offer and availability guards, idempotency, exemptions, 30-day window, no-show, expiry, appeal, RBAC' AS test_result;
