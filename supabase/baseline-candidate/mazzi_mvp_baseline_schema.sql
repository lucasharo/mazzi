


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "btree_gist" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."app_permission" AS ENUM (
    'student.profile.read',
    'student.profile.update',
    'student.booking.create',
    'student.booking.read_own',
    'student.booking.cancel_own',
    'student.review.create',
    'provider.profile.read_own',
    'provider.profile.update_own',
    'provider.schedule.manage_own',
    'provider.vehicle.manage_own',
    'provider.lesson.start_finish',
    'provider.finance.read_own',
    'provider.payout.request',
    'school.profile.read',
    'school.profile.update',
    'school.member.read',
    'school.member.manage',
    'school.vehicle.manage',
    'school.schedule.manage',
    'school.finance.read',
    'school.payout.request',
    'admin.provider.review',
    'admin.provider.suspend',
    'admin.compliance.review',
    'admin.platform.manage_settings',
    'admin.audit.read',
    'admin.finance.read_all',
    'admin.user.manage',
    'support.user.read_limited',
    'support.booking.read_limited',
    'support.ticket.manage'
);


ALTER TYPE "public"."app_permission" OWNER TO "postgres";


CREATE TYPE "public"."booking_selection_mode" AS ENUM (
    'SPECIFIC_INSTRUCTOR',
    'ANY_AVAILABLE_INSTRUCTOR'
);


ALTER TYPE "public"."booking_selection_mode" OWNER TO "postgres";


CREATE TYPE "public"."booking_status" AS ENUM (
    'DRAFT',
    'PENDING_PAYMENT',
    'PAYMENT_FAILED',
    'CONFIRMED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED_BY_STUDENT',
    'CANCELLED_BY_PROVIDER',
    'NO_SHOW_STUDENT',
    'NO_SHOW_PROVIDER',
    'DISPUTED',
    'REFUNDED',
    'PARTIALLY_REFUNDED',
    'EXPIRED'
);


ALTER TYPE "public"."booking_status" OWNER TO "postgres";


CREATE TYPE "public"."compliance_doc_type" AS ENUM (
    'CNH',
    'CREDENTIAL_DETRAN',
    'CRLV',
    'DUAL_PEDAL_INSPECTION',
    'CRIMINAL_BACKGROUND',
    'CONTRACT_SOCIAL',
    'CFC_ALVARA',
    'CNH_EAR',
    'CREDENTIAL_DETRAN_SP',
    'CREDENTIAL_HISTORICAL',
    'MAZZI_TERMS_ACCEPTANCE',
    'COMPANY_REGISTRATION',
    'CFC_AUTHORIZATION',
    'CFC_AUTHORIZATION_STATE'
);


ALTER TYPE "public"."compliance_doc_type" OWNER TO "postgres";


CREATE TYPE "public"."compliance_document_scope" AS ENUM (
    'USER_GLOBAL',
    'PROVIDER',
    'MEMBERSHIP',
    'VEHICLE'
);


ALTER TYPE "public"."compliance_document_scope" OWNER TO "postgres";


CREATE TYPE "public"."compliance_status" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'EXPIRED',
    'IN_REVIEW'
);


ALTER TYPE "public"."compliance_status" OWNER TO "postgres";


CREATE TYPE "public"."payment_method" AS ENUM (
    'PIX',
    'CREDIT_CARD'
);


ALTER TYPE "public"."payment_method" OWNER TO "postgres";


CREATE TYPE "public"."payment_status" AS ENUM (
    'PENDING',
    'AUTHORIZED',
    'PAID',
    'FAILED',
    'REFUNDED',
    'CHARGEBACK',
    'PARTIALLY_REFUNDED',
    'CANCELLED'
);


ALTER TYPE "public"."payment_status" OWNER TO "postgres";


CREATE TYPE "public"."payout_status" AS ENUM (
    'PENDING',
    'AVAILABLE',
    'PROCESSING',
    'PAID',
    'FAILED',
    'BLOCKED'
);


ALTER TYPE "public"."payout_status" OWNER TO "postgres";


CREATE TYPE "public"."provider_status" AS ENUM (
    'DRAFT',
    'PENDING_REVIEW',
    'ACTIVE',
    'SUSPENDED',
    'BLOCKED',
    'REJECTED'
);


ALTER TYPE "public"."provider_status" OWNER TO "postgres";


CREATE TYPE "public"."provider_type" AS ENUM (
    'INSTRUCTOR',
    'DRIVING_SCHOOL'
);


ALTER TYPE "public"."provider_type" OWNER TO "postgres";


CREATE TYPE "public"."quote_status" AS ENUM (
    'ACTIVE',
    'EXPIRED',
    'CONSUMED',
    'CANCELLED'
);


ALTER TYPE "public"."quote_status" OWNER TO "postgres";


CREATE TYPE "public"."school_invitation_status" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'CANCELLED',
    'EXPIRED'
);


ALTER TYPE "public"."school_invitation_status" OWNER TO "postgres";


CREATE TYPE "public"."school_membership_event_type" AS ENUM (
    'INVITED',
    'ACCEPTED',
    'COMPLIANCE_PENDING',
    'ACTIVATED',
    'SUSPENDED',
    'ENDED',
    'REHIRE_INVITED',
    'REHIRE_ACCEPTED'
);


ALTER TYPE "public"."school_membership_event_type" OWNER TO "postgres";


CREATE TYPE "public"."school_membership_status" AS ENUM (
    'PENDING_COMPLIANCE',
    'ACTIVE',
    'SUSPENDED',
    'ENDED'
);


ALTER TYPE "public"."school_membership_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'STUDENT',
    'INSTRUCTOR',
    'DRIVING_SCHOOL',
    'SCHOOL_ADMIN',
    'SCHOOL_STAFF',
    'PLATFORM_ADMIN',
    'SUPPORT'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE TYPE "public"."user_status" AS ENUM (
    'ACTIVE',
    'BLOCKED',
    'SUSPENDED',
    'PENDING_VERIFICATION'
);


ALTER TYPE "public"."user_status" OWNER TO "postgres";


CREATE TYPE "public"."vehicle_category" AS ENUM (
    'A',
    'B'
);


ALTER TYPE "public"."vehicle_category" OWNER TO "postgres";


CREATE TYPE "public"."vehicle_status" AS ENUM (
    'DRAFT',
    'PENDING',
    'IN_REVIEW',
    'ACTIVE',
    'INACTIVE',
    'EXPIRED',
    'BLOCKED'
);


ALTER TYPE "public"."vehicle_status" OWNER TO "postgres";


CREATE TYPE "public"."vehicle_transmission" AS ENUM (
    'MANUAL',
    'AUTOMATIC'
);


ALTER TYPE "public"."vehicle_transmission" OWNER TO "postgres";


CREATE TYPE "public"."vehicle_type" AS ENUM (
    'MOTORCYCLE',
    'CAR'
);


ALTER TYPE "public"."vehicle_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_school_instructor_invitation"("p_invitation_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID := auth.uid(); v_user public.users%ROWTYPE;
  v_inv public.driving_school_invitations%ROWTYPE; v_membership public.driving_school_staff%ROWTYPE;
  v_rehire BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_user FROM public.users WHERE id = v_uid AND status = 'ACTIVE';
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_ACTIVE'; END IF;
  SELECT * INTO v_inv FROM public.driving_school_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_NOT_FOUND'; END IF;
  IF v_inv.status <> 'PENDING' THEN RAISE EXCEPTION 'INVITATION_ALREADY_PROCESSED'; END IF;
  IF v_inv.expires_at <= NOW() THEN
    UPDATE public.driving_school_invitations SET status='EXPIRED',updated_at=NOW() WHERE id=v_inv.id;
    RAISE EXCEPTION 'INVITATION_EXPIRED';
  END IF;
  IF (v_inv.target_user_id IS NOT NULL AND v_inv.target_user_id <> v_uid)
     OR (v_inv.target_user_id IS NULL AND LOWER(BTRIM(v_user.email)) <> LOWER(BTRIM(v_inv.invited_email))) THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;
  SELECT * INTO v_membership FROM public.driving_school_staff
  WHERE school_id=v_inv.school_id AND user_id=v_uid FOR UPDATE;
  IF FOUND THEN
    IF v_membership.membership_status <> 'ENDED' THEN RAISE EXCEPTION 'MEMBERSHIP_ALREADY_EXISTS'; END IF;
    v_rehire := TRUE;
    UPDATE public.driving_school_staff SET membership_status='PENDING_COMPLIANCE',is_active=FALSE,
      source_invitation_id=v_inv.id,accepted_at=NOW(),suspended_at=NULL,suspended_by=NULL,
      ended_at=NULL,ended_by=NULL,end_reason=NULL,updated_at=NOW()
    WHERE id=v_membership.id;
    INSERT INTO public.driving_school_membership_events
      (membership_id,school_id,user_id,event_type,previous_status,new_status,invitation_id,actor_id)
    VALUES (v_membership.id,v_membership.school_id,v_membership.user_id,'REHIRE_ACCEPTED',
      'ENDED','PENDING_COMPLIANCE',v_inv.id,v_uid);
  ELSE
    INSERT INTO public.user_roles(user_id,role,granted_by) VALUES(v_uid,'INSTRUCTOR',v_uid)
      ON CONFLICT(user_id,role) DO NOTHING;
    INSERT INTO public.driving_school_staff(school_id,user_id,role,membership_status,is_active,source_invitation_id,accepted_at)
    VALUES(v_inv.school_id,v_uid,'INSTRUCTOR','PENDING_COMPLIANCE',FALSE,v_inv.id,NOW())
    RETURNING * INTO v_membership;
  END IF;
  UPDATE public.driving_school_invitations SET status='ACCEPTED',accepted_at=NOW(),target_user_id=v_uid,updated_at=NOW()
  WHERE id=v_inv.id;
  RETURN jsonb_build_object('success',TRUE,'invitation_id',v_inv.id,'school_id',v_inv.school_id,
    'membership_id',v_membership.id,'membership_status','PENDING_COMPLIANCE','rehire',v_rehire);
END;
$$;


ALTER FUNCTION "public"."accept_school_instructor_invitation"("p_invitation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_refund_mock_booking"("p_booking_id" "uuid", "p_reason" "text" DEFAULT 'ADMIN_MOCK_REFUND'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_payment RECORD;
  v_refunded BIGINT;
  v_key TEXT := 'admin_mock_refund:' || p_booking_id::TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  SELECT p.* INTO v_payment FROM public.payments p WHERE p.booking_id = p_booking_id ORDER BY p.created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF UPPER(COALESCE(v_payment.gateway_provider, '')) NOT IN ('MOCK_VALIDATION', 'SUPABASE_GATEWAY', 'FAKE') THEN
    RAISE EXCEPTION 'REAL_GATEWAY_REFUND_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(SUM(r.amount_in_cents), 0) INTO v_refunded
  FROM public.refunds r WHERE r.payment_id = v_payment.id AND r.status = 'PROCESSED';
  IF v_refunded >= v_payment.amount_in_cents THEN
    RETURN jsonb_build_object('success', TRUE, 'is_existing', TRUE, 'amount_in_cents', v_refunded);
  END IF;
  RETURN public.process_booking_refund(
    v_payment.id,
    (v_payment.amount_in_cents - v_refunded)::INT,
    COALESCE(NULLIF(BTRIM(p_reason), ''), 'ADMIN_MOCK_REFUND'),
    v_key,
    NULL
  );
END;
$$;


ALTER FUNCTION "public"."admin_refund_mock_booking"("p_booking_id" "uuid", "p_reason" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "type" "public"."provider_type" NOT NULL,
    "legal_name" character varying(255) NOT NULL,
    "trade_name" character varying(255) NOT NULL,
    "document_number" character varying(30) NOT NULL,
    "status" "public"."provider_status" DEFAULT 'DRAFT'::"public"."provider_status" NOT NULL,
    "bio" "text",
    "rating_average" numeric(3,2) DEFAULT 0.00 NOT NULL,
    "rating_count" integer DEFAULT 0 NOT NULL,
    "service_radius_km" integer DEFAULT 5 NOT NULL,
    "location" "public"."geography"(Point,4326),
    "neighborhood" character varying(100),
    "city" character varying(100) DEFAULT 'São Paulo'::character varying NOT NULL,
    "state" character varying(2) DEFAULT 'SP'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "submitted_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "rejected_at" timestamp with time zone,
    "rejected_by" "uuid",
    "rejection_reason" "text",
    "suspended_at" timestamp with time zone,
    "phone" character varying(50),
    "public_contact" character varying(100),
    "avatar_url" "text",
    "latitude" double precision,
    "longitude" double precision,
    "public_latitude" double precision,
    "public_longitude" double precision,
    "public_map_location_type" "text" DEFAULT 'NEIGHBORHOOD_CENTROID'::"text",
    "location_geography" "public"."geography"(Point,4326) GENERATED ALWAYS AS (("public"."st_setsrid"("public"."st_makepoint"(COALESCE("longitude", ('-46.6872'::numeric)::double precision), COALESCE("latitude", ('-23.5658'::numeric)::double precision)), 4326))::"public"."geography") STORED
);


ALTER TABLE "public"."providers" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_review_provider"("p_provider_id" "uuid", "p_status" "public"."provider_status", "p_reason" "text" DEFAULT NULL::"text") RETURNS "public"."providers"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_previous public.providers;
  v_updated public.providers;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF p_status NOT IN ('ACTIVE', 'REJECTED', 'SUSPENDED', 'BLOCKED') THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_STATUS' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_previous FROM public.providers WHERE id = p_provider_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PROVIDER_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF p_status = 'ACTIVE' AND v_previous.type = 'INSTRUCTOR'::public.provider_type
     AND (v_previous.user_id IS NULL OR NOT public.is_instructor_global_compliance_valid(v_previous.user_id, NULL)) THEN
    RAISE EXCEPTION 'PROVIDER_COMPLIANCE_REQUIRED' USING ERRCODE = '42501';
  END IF;

  UPDATE public.providers
  SET status = p_status,
      submitted_at = CASE WHEN p_status = 'PENDING_REVIEW' THEN COALESCE(submitted_at, now()) ELSE submitted_at END,
      approved_at = CASE WHEN p_status = 'ACTIVE' THEN now() ELSE approved_at END,
      approved_by = CASE WHEN p_status = 'ACTIVE' THEN v_uid ELSE approved_by END,
      rejected_at = CASE WHEN p_status = 'REJECTED' THEN now() ELSE rejected_at END,
      rejected_by = CASE WHEN p_status = 'REJECTED' THEN v_uid ELSE rejected_by END,
      rejection_reason = CASE WHEN p_status = 'REJECTED' THEN NULLIF(BTRIM(p_reason), '') ELSE rejection_reason END,
      suspended_at = CASE WHEN p_status = 'SUSPENDED' THEN now() ELSE suspended_at END,
      updated_at = now()
  WHERE id = p_provider_id
  RETURNING * INTO v_updated;

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, previous_value, new_value)
  VALUES (v_uid, 'ADMIN_PROVIDER_REVIEW', 'Provider', p_provider_id::TEXT,
    jsonb_build_object('status', v_previous.status),
    jsonb_build_object('status', p_status, 'reason', NULLIF(BTRIM(p_reason), '')));
  RETURN v_updated;
END;
$$;


ALTER FUNCTION "public"."admin_review_provider"("p_provider_id" "uuid", "p_status" "public"."provider_status", "p_reason" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" character varying(255) NOT NULL,
    "name" character varying(255) NOT NULL,
    "phone" character varying(50) NOT NULL,
    "role" "public"."user_role" DEFAULT 'STUDENT'::"public"."user_role" NOT NULL,
    "status" "public"."user_status" DEFAULT 'ACTIVE'::"public"."user_status" NOT NULL,
    "avatar_url" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "cpf" character varying(11),
    "birth_date" "date"
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."admin_update_user_role"("p_user_id" "uuid", "p_role" "public"."user_role") RETURNS "public"."users"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_previous public.users;
  v_updated public.users;
  v_before_roles JSONB;
  v_after_roles JSONB;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF NOT public.is_platform_admin() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  IF p_user_id = v_uid THEN RAISE EXCEPTION 'SELF_ROLE_CHANGE_FORBIDDEN' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_previous FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  SELECT COALESCE(jsonb_agg(role ORDER BY role), '[]'::jsonb) INTO v_before_roles
  FROM (
    SELECT v_previous.role AS role
    UNION
    SELECT ur.role FROM public.user_roles AS ur WHERE ur.user_id = p_user_id
  ) AS before_roles;

  UPDATE public.users
  SET role = p_role, updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_updated;

  IF v_previous.role IS DISTINCT FROM p_role THEN
    DELETE FROM public.user_roles
    WHERE user_id = p_user_id AND role = v_previous.role;
  END IF;

  INSERT INTO public.user_roles(user_id, role, granted_by)
  VALUES (p_user_id, p_role, v_uid)
  ON CONFLICT (user_id, role) DO NOTHING;

  SELECT COALESCE(jsonb_agg(role ORDER BY role), '[]'::jsonb) INTO v_after_roles
  FROM (
    SELECT v_updated.role AS role
    UNION
    SELECT ur.role FROM public.user_roles AS ur WHERE ur.user_id = p_user_id
  ) AS after_roles;

  INSERT INTO public.audit_logs(actor_id, action, entity_type, entity_id, previous_value, new_value)
  VALUES (
    v_uid, 'ADMIN_USER_ROLE_CHANGED', 'User', p_user_id::TEXT,
    jsonb_build_object('primary_role', v_previous.role, 'roles', v_before_roles),
    jsonb_build_object('primary_role', p_role, 'roles', v_after_roles)
  );
  RETURN v_updated;
END;
$$;


ALTER FUNCTION "public"."admin_update_user_role"("p_user_id" "uuid", "p_role" "public"."user_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_access_provider_reviews"("p_provider_id" "uuid", "p_student_id" "uuid", "p_instructor_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.is_current_user_active()
    AND (
      p_student_id = auth.uid()
      OR p_instructor_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.providers p
        WHERE p.id = p_provider_id
          AND p.user_id = auth.uid()
      )
      OR public.is_school_member(p_provider_id)
      OR public.is_platform_admin()
    );
$$;


ALTER FUNCTION "public"."can_access_provider_reviews"("p_provider_id" "uuid", "p_student_id" "uuid", "p_instructor_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_provider_schedule"("target_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    public.is_current_user_active()
    AND (
      public.is_platform_admin()
      OR (
        EXISTS (
          SELECT 1
          FROM public.providers p
          WHERE p.id = target_provider_id
            AND p.user_id = auth.uid()
        )
        AND public.current_user_has_permission('provider.schedule.manage_own'::public.app_permission)
      )
      OR (
        EXISTS (
          SELECT 1
          FROM public.driving_school_staff dss
          JOIN public.providers p ON p.id = dss.school_id
          WHERE dss.school_id = target_provider_id
            AND dss.user_id = auth.uid()
            AND dss.is_active = TRUE
            AND p.type = 'DRIVING_SCHOOL'
        )
        AND public.current_user_has_permission('school.schedule.manage'::public.app_permission)
      )
    );
$$;


ALTER FUNCTION "public"."can_manage_provider_schedule"("target_provider_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_service_offering"("p_provider_id" "uuid", "p_instructor_id" "uuid", "p_vehicle_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    public.is_current_user_active()
    AND EXISTS (
      SELECT 1
      FROM public.providers p
      WHERE p.id = p_provider_id
        AND (
          p.user_id = auth.uid()
          OR public.is_school_admin(p.id)
          OR public.is_platform_admin()
        )
        AND EXISTS (
          SELECT 1
          FROM public.vehicles v
          WHERE v.id = p_vehicle_id
            AND v.provider_id = p.id
            AND v.deleted_at IS NULL
        )
        AND (
          (
            p.type = 'DRIVING_SCHOOL'::public.provider_type
            AND p_instructor_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM public.driving_school_staff dss
              WHERE dss.school_id = p.id
                AND dss.user_id = p_instructor_id
                AND dss.role = 'INSTRUCTOR'::public.user_role
                AND dss.membership_status = 'ACTIVE'::public.school_membership_status
                AND dss.is_active IS TRUE
            )
          )
          OR (
            p.type = 'INSTRUCTOR'::public.provider_type
            AND p_instructor_id = p.user_id
          )
        )
    );
$$;


ALTER FUNCTION "public"."can_manage_service_offering"("p_provider_id" "uuid", "p_instructor_id" "uuid", "p_vehicle_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_booking_v2"("p_booking_id" "uuid", "p_reason" "text" DEFAULT NULL::"text", "p_reason_code" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_actor_id UUID;
  v_user_role TEXT;
  v_booking RECORD;
  v_provider_user_id UUID;
  v_provider_type TEXT;
  v_is_authorized_school_admin BOOLEAN := FALSE;
  v_hours_until NUMERIC;
  v_refund_pct INT := 0;
  v_refund_cents BIGINT := 0;
  v_new_status TEXT;
  v_reason_final TEXT;
  v_policy_desc TEXT;
BEGIN
  -- 1. Authenticate caller
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Usuário não autenticado.' USING ERRCODE = '40100';
  END IF;

  -- 2. Fetch user role
  SELECT role::TEXT INTO v_user_role FROM public.users WHERE id = v_actor_id;
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: Perfil de usuário não encontrado.' USING ERRCODE = '40400';
  END IF;

  -- 3. Lock booking row for update
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF v_booking IS NULL THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = '40401';
  END IF;

  -- 4. CRITICAL SECURITY GUARD: VALIDATE AUTHORIZATION / OWNERSHIP FIRST BEFORE ANY IDEMPOTENCY OR STATUS CHECK!
  IF v_user_role = 'STUDENT' THEN
    IF v_booking.student_id != v_actor_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED_STUDENT: Este agendamento pertence a outro aluno.' USING ERRCODE = '40301';
    END IF;

  ELSIF v_user_role = 'INSTRUCTOR' THEN
    -- Operational instructors assigned to a driving school booking CANNOT perform commercial cancellation!
    -- An INSTRUCTOR can ONLY cancel as provider if the booking belongs to their OWN autonomous provider account (provider.user_id = v_actor_id AND provider.type = 'INSTRUCTOR').
    SELECT user_id, type::TEXT INTO v_provider_user_id, v_provider_type
    FROM public.providers WHERE id = v_booking.provider_id;

    IF v_provider_user_id IS DISTINCT FROM v_actor_id OR v_provider_type IS DISTINCT FROM 'INSTRUCTOR' THEN
      RAISE EXCEPTION 'UNAUTHORIZED_PROVIDER: Instrutores operacionais não possuem autorização para cancelar comercialmente agendamentos de autoescolas.' USING ERRCODE = '40302';
    END IF;

  ELSIF v_user_role IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL') THEN
    -- Check if direct provider user OR active school admin via driving_school_staff / helper
    SELECT user_id INTO v_provider_user_id FROM public.providers WHERE id = v_booking.provider_id;
    IF v_provider_user_id = v_actor_id THEN
      v_is_authorized_school_admin := TRUE;
    ELSE
      -- Check driving_school_staff relation
      SELECT EXISTS (
        SELECT 1 FROM public.driving_school_staff
        WHERE school_id = v_booking.provider_id
          AND user_id = v_actor_id
          AND role::TEXT IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL')
          AND is_active = TRUE
      ) INTO v_is_authorized_school_admin;

      -- Check canonical helper if not matched above
      IF NOT v_is_authorized_school_admin THEN
        IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_school_admin') THEN
          EXECUTE 'SELECT public.is_school_admin($1)' INTO v_is_authorized_school_admin USING v_booking.provider_id;
        END IF;
      END IF;
    END IF;

    IF NOT v_is_authorized_school_admin THEN
      RAISE EXCEPTION 'UNAUTHORIZED_SCHOOL_ADMIN: Acesso negado. Você não é administrador da escola responsável por este agendamento.' USING ERRCODE = '40303';
    END IF;

  ELSIF v_user_role = 'SCHOOL_STAFF' THEN
    RAISE EXCEPTION 'UNAUTHORIZED_SCHOOL_STAFF: Membros da equipe (STAFF) não possuem permissão para realizar cancelamentos de aulas.' USING ERRCODE = '40304';

  ELSIF v_user_role != 'PLATFORM_ADMIN' THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ROLE: Papel de usuário não autorizado a cancelar.' USING ERRCODE = '40300';
  END IF;

  -- 5. IDEMPOTENCY CHECK (ONLY PERMITTED AFTER AUTHORIZATION IS VALIDATED!)
  IF v_booking.status::TEXT IN ('CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER') THEN
    RETURN jsonb_build_object(
      'success', true,
      'is_idempotent', true,
      'booking_id', v_booking.id,
      'status', v_booking.status::TEXT,
      'refund_amount_in_cents', COALESCE(v_booking.refund_amount_in_cents, 0),
      'message', 'Agendamento já se encontrava cancelado.'
    );
  END IF;

  -- 6. Strict Status Whitelist (ONLY CONFIRMED is cancelable via commercial RPC)
  IF v_booking.status::TEXT = 'PENDING_PAYMENT' THEN
    RAISE EXCEPTION 'INVALID_STATUS: O status PENDING_PAYMENT pertence ao ciclo de retenção/checkout e não ao cancelamento comercial.' USING ERRCODE = '42200';
  ELSIF v_booking.status::TEXT != 'CONFIRMED' THEN
    RAISE EXCEPTION 'INVALID_STATUS: O status atual (%) não permite cancelamento comercial.', v_booking.status USING ERRCODE = '42200';
  END IF;

  -- 7. Past Lesson / Time Window Guard (scheduled_start_at > NOW() mandatory)
  IF v_booking.scheduled_start_at <= NOW() THEN
    RAISE EXCEPTION 'CANCELLATION_WINDOW_CLOSED: O horário de início da aula já passou ou a aula está em andamento.' USING ERRCODE = '42204';
  END IF;

  -- 8. Validate Provider Reason Code for Provider roles
  IF v_user_role IN ('INSTRUCTOR', 'SCHOOL_ADMIN', 'DRIVING_SCHOOL', 'PLATFORM_ADMIN') THEN
    IF p_reason_code IS NULL OR trim(p_reason_code) = '' THEN
      RAISE EXCEPTION 'REASON_REQUIRED: O motivo do cancelamento é obrigatório para prestadores.' USING ERRCODE = '42201';
    END IF;

    IF p_reason_code NOT IN ('VEHICLE_ISSUE', 'PERSONAL_EMERGENCY', 'SCHEDULE_CONFLICT', 'WEATHER_OR_SAFETY', 'OPERATIONAL_ISSUE', 'OTHER') THEN
      RAISE EXCEPTION 'REASON_CODE_INVALID: Código de motivo de cancelamento inválido.' USING ERRCODE = '42202';
    END IF;

    IF p_reason_code = 'OTHER' AND (p_reason IS NULL OR trim(p_reason) = '') THEN
      RAISE EXCEPTION 'REASON_DESCRIPTION_REQUIRED: A descrição textual é obrigatória para a opção "Outro motivo".' USING ERRCODE = '42203';
    END IF;
  END IF;

  -- 9. Compute antecedence & DEC-013 Refund Percentage
  v_hours_until := EXTRACT(EPOCH FROM (v_booking.scheduled_start_at - NOW())) / 3600.0;
  v_new_status := CASE WHEN v_user_role = 'STUDENT' THEN 'CANCELLED_BY_STUDENT' ELSE 'CANCELLED_BY_PROVIDER' END;

  IF v_user_role = 'STUDENT' THEN
    IF v_hours_until >= 24.0 THEN
      v_refund_pct := 100;
      v_policy_desc := 'Cancelamento com 24h ou mais de antecedência: Reembolso integral (100%).';
    ELSIF v_hours_until >= 6.0 THEN
      v_refund_pct := 50;
      v_policy_desc := 'Cancelamento entre 6h e 24h de antecedência: Reembolso parcial (50%).';
    ELSE
      v_refund_pct := 0;
      v_policy_desc := 'Cancelamento com menos de 6h de antecedência: Sem reembolso (0%).';
    END IF;
  ELSE
    v_refund_pct := 100;
    v_policy_desc := 'Cancelamento realizado pelo prestador: Reembolso integral (100%) ao aluno.';
  END IF;

  v_refund_cents := ROUND((v_booking.total_in_cents * v_refund_pct) / 100.0);
  v_reason_final := COALESCE(
    CASE WHEN p_reason_code IS NOT NULL AND p_reason IS NOT NULL AND trim(p_reason) != '' THEN p_reason_code || ': ' || trim(p_reason)
         WHEN p_reason_code IS NOT NULL THEN p_reason_code
         ELSE trim(p_reason) END,
    'Cancelamento realizado'
  );

  -- 10. Apply atomic state update
  UPDATE public.bookings
  SET status = v_new_status::public.booking_status,
      cancelled_at = NOW(),
      cancelled_by = CASE WHEN v_user_role = 'STUDENT' THEN 'STUDENT' ELSE 'PROVIDER' END,
      cancellation_reason = v_reason_final,
      refund_amount_in_cents = v_refund_cents,
      updated_at = NOW()
  WHERE id = p_booking_id;

  -- 11. Insert Audit Log
  INSERT INTO public.audit_logs (
    id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at, ip_address
  ) VALUES (
    gen_random_uuid(),
    v_actor_id,
    'BOOKING_CANCELLED_' || v_new_status,
    'Booking',
    p_booking_id,
    jsonb_build_object('status', v_booking.status::TEXT),
    jsonb_build_object('status', v_new_status, 'refund_amount_in_cents', v_refund_cents),
    NOW(),
    NULL
  );

  -- 12. Return JSON Result
  RETURN jsonb_build_object(
    'success', true,
    'is_idempotent', false,
    'booking_id', p_booking_id,
    'status', v_new_status,
    'refund_percentage', v_refund_pct,
    'refund_amount_in_cents', v_refund_cents,
    'policy_description', v_policy_desc,
    'cancellation_reason', v_reason_final,
    'cancelled_at', NOW()
  );
END;
$_$;


ALTER FUNCTION "public"."cancel_booking_v2"("p_booking_id" "uuid", "p_reason" "text", "p_reason_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_school_instructor_invitation"("p_invitation_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_invitation public.driving_school_invitations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'USER_NOT_ACTIVE'; END IF;
  SELECT * INTO v_invitation FROM public.driving_school_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_NOT_FOUND'; END IF;
  IF NOT public.is_school_admin(v_invitation.school_id) THEN RAISE EXCEPTION 'SCHOOL_ADMIN_REQUIRED'; END IF;
  IF v_invitation.status <> 'PENDING'::public.school_invitation_status THEN
    RAISE EXCEPTION 'INVITATION_ALREADY_PROCESSED';
  END IF;

  UPDATE public.driving_school_invitations
  SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
  WHERE id = v_invitation.id;
  RETURN jsonb_build_object('success', TRUE, 'invitation_id', v_invitation.id, 'status', 'CANCELLED');
END;
$$;


ALTER FUNCTION "public"."cancel_school_instructor_invitation"("p_invitation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION public.confirm_booking_payment(p_payment_id uuid, p_external_payment_id character varying, p_paid_at timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_payment public.payments%rowtype;
  v_booking public.bookings%rowtype;
  v_now timestamptz := now();
  v_paid_at timestamptz := coalesce(p_paid_at, now());
begin
  if v_uid is null then
    raise exception 'AUTHENTICATION_REQUIRED' using errcode = '42501';
  end if;

  if p_external_payment_id is null or btrim(p_external_payment_id) = '' then
    raise exception 'EXTERNAL_PAYMENT_ID_REQUIRED' using errcode = '22023';
  end if;

  select * into v_payment
  from public.payments
  where id = p_payment_id
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_booking
  from public.bookings
  where id = v_payment.booking_id
  for update;

  if not found then
    raise exception 'BOOKING_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_booking.student_id <> v_uid then
    raise exception 'CROSS_STUDENT_PAYMENT_ACCESS_DENIED' using errcode = '42501';
  end if;

  if v_payment.gateway_provider <> 'fake_payment_gateway' then
    raise exception 'REAL_PAYMENT_GATEWAY_CONFIRMATION_REQUIRES_TRUSTED_BACKEND' using errcode = '42501';
  end if;

  if v_payment.amount_in_cents <> v_booking.total_in_cents then
    raise exception 'PAYMENT_AMOUNT_MISMATCH' using errcode = '22000';
  end if;

  if v_payment.status = 'PAID'::public.payment_status then
    if v_payment.external_transaction_id = p_external_payment_id then
      return jsonb_build_object(
        'success', true,
        'is_idempotent', true,
        'payment_id', v_payment.id,
        'booking_id', v_booking.id,
        'payment_status', v_payment.status,
        'booking_status', v_booking.status,
        'paid_at', v_payment.paid_at,
        'confirmed_at', v_booking.confirmed_at
      );
    end if;
    raise exception 'PAYMENT_ALREADY_CONFIRMED_WITH_DIFFERENT_EXTERNAL_ID' using errcode = '23505';
  end if;

  if v_payment.status not in ('PENDING'::public.payment_status, 'AUTHORIZED'::public.payment_status) then
    raise exception 'PAYMENT_NOT_CONFIRMABLE' using errcode = '22000';
  end if;

  if v_booking.status <> 'PENDING_PAYMENT'::public.booking_status then
    raise exception 'BOOKING_NOT_PENDING_PAYMENT' using errcode = '22000';
  end if;

  if v_booking.hold_expires_at is not null and v_booking.hold_expires_at <= v_now then
    update public.bookings
      set status = 'EXPIRED'::public.booking_status,
          expired_at = coalesce(expired_at, v_now),
          updated_at = v_now
    where id = v_booking.id;
    raise exception 'BOOKING_HOLD_EXPIRED' using errcode = '22000';
  end if;

  update public.payments
  set status = 'PAID'::public.payment_status,
      external_transaction_id = p_external_payment_id,
      paid_at = v_paid_at,
      updated_at = v_now
  where id = v_payment.id;

  update public.bookings
  set status = 'CONFIRMED'::public.booking_status,
      confirmed_at = coalesce(confirmed_at, v_paid_at),
      updated_at = v_now
  where id = v_booking.id;

  return jsonb_build_object(
    'success', true,
    'is_idempotent', false,
    'payment_id', v_payment.id,
    'booking_id', v_booking.id,
    'payment_status', 'PAID',
    'booking_status', 'CONFIRMED',
    'paid_at', v_paid_at,
    'confirmed_at', v_paid_at
  );
end;
$function$


ALTER FUNCTION "public"."confirm_booking_payment"("p_payment_id" "uuid", "p_external_payment_id" character varying, "p_paid_at" timestamp with time zone) OWNER TO "postgres";

CREATE OR REPLACE FUNCTION "public"."create_booking_completion_notifications"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.status::TEXT = 'CONFIRMED'
    AND (OLD.status IS NULL OR OLD.status::TEXT IS DISTINCT FROM NEW.status::TEXT) THEN
    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
    SELECT DISTINCT recipient_id,
      'BOOKING_CONFIRMED',
      'Aula confirmada',
      'Uma aula foi confirmada na MAZZI.',
      'booking',
      NEW.id
    FROM (
      SELECT NEW.student_id AS recipient_id
      UNION ALL
      SELECT NEW.instructor_id
      UNION ALL
      SELECT p.user_id
      FROM public.providers p
      WHERE p.id = NEW.provider_id
    ) recipients
    WHERE recipient_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;

  IF NEW.status::TEXT IN ('CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER')
    AND (OLD.status IS NULL OR OLD.status::TEXT IS DISTINCT FROM NEW.status::TEXT) THEN
    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
    SELECT DISTINCT recipient_id,
      'BOOKING_CANCELLED',
      'Aula cancelada',
      'Uma aula agendada foi cancelada na MAZZI.',
      'booking',
      NEW.id
    FROM (
      SELECT NEW.student_id AS recipient_id
      UNION ALL
      SELECT NEW.instructor_id
      UNION ALL
      SELECT p.user_id
      FROM public.providers p
      WHERE p.id = NEW.provider_id
    ) recipients
    WHERE recipient_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;

  IF NEW.status::TEXT = 'COMPLETED'
    AND (OLD.status IS NULL OR OLD.status::TEXT IS DISTINCT FROM NEW.status::TEXT) THEN
    INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
    VALUES
      (
        NEW.student_id,
        'LESSON_COMPLETED',
        'Aula concluída',
        'Sua aula foi marcada como concluída.',
        'booking',
        NEW.id
      ),
      (
        NEW.student_id,
        'REVIEW_AVAILABLE',
        'Avaliação disponível',
        'Avalie sua aula para ajudar outros alunos da MAZZI.',
        'booking',
        NEW.id
      )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_booking_completion_notifications"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_hold"("p_quote_id" "uuid", "p_student_id" "uuid", "p_idempotency_key" character varying DEFAULT NULL::character varying, "p_hold_duration_minutes" integer DEFAULT 10) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_student_id UUID := auth.uid(); v_quote RECORD; v_provider RECORD; v_vehicle RECORD; v_offering RECORD;
  v_existing_booking RECORD; v_booking_id UUID; v_payment_id UUID; v_now TIMESTAMPTZ := NOW();
  v_hold_expires_at TIMESTAMPTZ; v_snapshot JSONB;
BEGIN
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_student_id IS DISTINCT FROM v_student_id THEN RAISE EXCEPTION 'STUDENT_ID_MISMATCH' USING ERRCODE='42501'; END IF;
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existing_booking FROM public.bookings WHERE idempotency_key=p_idempotency_key AND student_id=v_student_id;
    IF FOUND THEN
      IF v_existing_booking.quote_id=p_quote_id THEN
        SELECT id INTO v_payment_id FROM public.payments WHERE booking_id=v_existing_booking.id LIMIT 1;
        RETURN jsonb_build_object('success',true,'is_idempotent',true,'booking_id',v_existing_booking.id,'payment_id',v_payment_id,'status',v_existing_booking.status,'hold_expires_at',v_existing_booking.hold_expires_at);
      END IF;
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' USING ERRCODE='23505';
    END IF;
  END IF;
  UPDATE public.bookings SET status='EXPIRED', expired_at=v_now, updated_at=v_now WHERE status='PENDING_PAYMENT' AND hold_expires_at <= v_now;
  SELECT * INTO v_quote FROM public.quotes WHERE id=p_quote_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'QUOTE_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF v_quote.student_id IS DISTINCT FROM v_student_id THEN RAISE EXCEPTION 'CROSS_STUDENT_QUOTE_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
  IF v_quote.status <> 'ACTIVE' THEN RAISE EXCEPTION 'QUOTE_NOT_ACTIVE' USING ERRCODE='22000'; END IF;
  IF v_quote.expires_at <= v_now THEN UPDATE public.quotes SET status='EXPIRED' WHERE id=p_quote_id; RAISE EXCEPTION 'QUOTE_EXPIRED' USING ERRCODE='22000'; END IF;
  IF EXISTS (SELECT 1 FROM public.bookings WHERE student_id=v_student_id AND status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS') AND slot_range && tstzrange(v_quote.scheduled_start_at,v_quote.scheduled_end_at,'[)')) THEN RAISE EXCEPTION 'STUDENT_ALREADY_BOOKED_FOR_SLOT' USING ERRCODE='P0001'; END IF;
  SELECT * INTO v_provider FROM public.providers WHERE id=v_quote.provider_id;
  IF NOT FOUND OR v_provider.status <> 'ACTIVE' THEN RAISE EXCEPTION 'PROVIDER_NOT_ACTIVE' USING ERRCODE='22000'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('provider-schedule:' || v_quote.provider_id::TEXT, 0));
  SELECT * INTO v_vehicle FROM public.vehicles WHERE id=v_quote.vehicle_id;
  IF NOT FOUND OR v_vehicle.status <> 'ACTIVE' THEN RAISE EXCEPTION 'VEHICLE_NOT_ACTIVE' USING ERRCODE='22000'; END IF;
  SELECT * INTO v_offering FROM public.service_offerings WHERE id=v_quote.offering_id;
  IF NOT FOUND OR v_offering.is_active IS NOT TRUE THEN RAISE EXCEPTION 'OFFERING_NOT_ACTIVE' USING ERRCODE='22000'; END IF;
  IF v_offering.category::TEXT <> 'B' THEN RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for booking holds' USING ERRCODE='22023'; END IF;
  IF NOT public.is_offering_slot_available(v_quote.offering_id,v_quote.scheduled_start_at) THEN RAISE EXCEPTION 'SLOT_NO_LONGER_AVAILABLE' USING ERRCODE='23P01'; END IF;
  v_hold_expires_at := v_now + (p_hold_duration_minutes || ' minutes')::INTERVAL;
  v_snapshot := jsonb_build_object('providerId',v_provider.id,'providerName',v_provider.trade_name,'providerType',v_provider.type,'instructorId',v_quote.instructor_id,'instructorName','Instrutor ' || v_quote.instructor_id,'vehicleId',v_vehicle.id,'vehicleName',v_vehicle.brand || ' ' || v_vehicle.model,'vehicleBrand',v_vehicle.brand,'vehicleModel',v_vehicle.model,'category',v_offering.category,'transmission',v_vehicle.transmission,'durationMinutes',v_offering.duration_minutes,'priceInCents',v_quote.price_in_cents,'platformFeeInCents',v_quote.platform_fee_in_cents,'totalInCents',v_quote.total_in_cents,'meetingPoint',COALESCE(v_provider.neighborhood,v_provider.city));
  v_booking_id := gen_random_uuid();
  INSERT INTO public.bookings (id,student_id,provider_id,instructor_id,vehicle_id,offering_id,quote_id,status,scheduled_start_at,scheduled_end_at,hold_expires_at,idempotency_key,price_in_cents,platform_fee_in_cents,total_in_cents,snapshot_data,created_at,updated_at)
  VALUES (v_booking_id,v_student_id,v_quote.provider_id,v_quote.instructor_id,v_quote.vehicle_id,v_quote.offering_id,p_quote_id,'PENDING_PAYMENT',v_quote.scheduled_start_at,v_quote.scheduled_end_at,v_hold_expires_at,p_idempotency_key,v_quote.price_in_cents,v_quote.platform_fee_in_cents,v_quote.total_in_cents,v_snapshot,v_now,v_now);
  UPDATE public.quotes SET status='CONSUMED', consumed_at=v_now WHERE id=p_quote_id;
  v_payment_id := gen_random_uuid();
  INSERT INTO public.payments (id,booking_id,method,status,amount_in_cents,idempotency_key,gateway_provider,created_at,updated_at) VALUES (v_payment_id,v_booking_id,'PIX','PENDING',v_quote.total_in_cents,'idem_pay_' || v_booking_id,'fake_payment_gateway',v_now,v_now);
  INSERT INTO public.audit_logs (actor_id,action,entity_type,entity_id,new_value,ip_address,user_agent,severity,created_at) VALUES (v_student_id,'BOOKING_CREATE_HOLD','BOOKINGS',v_booking_id,jsonb_build_object('booking_id',v_booking_id,'payment_id',v_payment_id,'quote_id',p_quote_id),'127.0.0.1','PostgreSQL Trigger (SECURITY DEFINER)','INFO',v_now);
  RETURN jsonb_build_object('success',true,'booking_id',v_booking_id,'payment_id',v_payment_id,'status','PENDING_PAYMENT','hold_expires_at',v_hold_expires_at);
END;
$$;


ALTER FUNCTION "public"."create_booking_hold"("p_quote_id" "uuid", "p_student_id" "uuid", "p_idempotency_key" character varying, "p_hold_duration_minutes" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_hold_at_meeting_point"("p_quote_id" "uuid", "p_student_id" "uuid", "p_idempotency_key" character varying DEFAULT NULL::character varying, "p_meeting_point" "jsonb" DEFAULT NULL::"jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare v_result jsonb; v_booking_id uuid; v_point jsonb; v_quote record;
begin
  if auth.uid() is null or auth.uid() <> p_student_id then raise exception 'STUDENT_ACCESS_DENIED' using errcode = '42501'; end if;
  if coalesce(p_meeting_point->>'type','') = 'STUDENT_ADDRESS' then
    if nullif(btrim(p_meeting_point->>'address'),'') is null or p_meeting_point->>'latitude' is null or p_meeting_point->>'longitude' is null or (p_meeting_point->>'latitude')::double precision not between -90 and 90 or (p_meeting_point->>'longitude')::double precision not between -180 and 180 then raise exception 'STUDENT_ADDRESS_COORDINATES_REQUIRED' using errcode = '22023'; end if;
    if not exists (select 1 from public.quotes q join public.providers p on p.id=q.provider_id where q.id=p_quote_id and q.student_id=auth.uid() and p.location_geography is not null and st_dwithin(p.location_geography, st_setsrid(st_makepoint((p_meeting_point->>'longitude')::double precision,(p_meeting_point->>'latitude')::double precision),4326)::geography,p.service_radius_km*1000)) then raise exception 'STUDENT_ADDRESS_OUTSIDE_PROVIDER_RADIUS' using errcode = '22023'; end if;
    v_point := jsonb_build_object('type','STUDENT_ADDRESS','label',btrim(p_meeting_point->>'address'));
  elsif coalesce(p_meeting_point->>'type','') = 'PROVIDER_ADDRESS' then
    select q.provider_id,p.neighborhood,p.city into v_quote from public.quotes q join public.providers p on p.id=q.provider_id where q.id=p_quote_id and q.student_id=auth.uid(); if not found then raise exception 'QUOTE_NOT_FOUND' using errcode='P0002'; end if;
    v_point := jsonb_build_object('type','PROVIDER_ADDRESS','label',concat_ws(', ',v_quote.neighborhood,v_quote.city));
  else raise exception 'MEETING_POINT_TYPE_INVALID' using errcode='22023'; end if;
  v_result := public.create_booking_hold(p_quote_id,p_student_id,p_idempotency_key,10); v_booking_id := (v_result->>'booking_id')::uuid;
  update public.bookings set meeting_point=v_point where id=v_booking_id and student_id=auth.uid(); return v_result;
end; $$;


ALTER FUNCTION "public"."create_booking_hold_at_meeting_point"("p_quote_id" "uuid", "p_student_id" "uuid", "p_idempotency_key" character varying, "p_meeting_point" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_booking_payment"("p_booking_id" "uuid", "p_method" "public"."payment_method", "p_idempotency_key" character varying DEFAULT NULL::character varying, "p_gateway_provider" character varying DEFAULT 'fake_payment_gateway'::character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID;
  v_booking RECORD;
  v_payment RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_payment_id UUID;
  v_effective_idem_key VARCHAR;
BEGIN
  -- 1. Authentication Check
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '28000';
  END IF;

  -- 2. Lock & Load Booking
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Ownership
  IF v_booking.student_id <> v_uid THEN
    RAISE EXCEPTION 'CROSS_STUDENT_BOOKING_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  -- 4. Status
  IF v_booking.status <> 'PENDING_PAYMENT' THEN
    IF v_booking.status = 'CONFIRMED' THEN
      RAISE EXCEPTION 'BOOKING_ALREADY_PAID' USING ERRCODE = '22000';
    ELSE
      RAISE EXCEPTION 'BOOKING_NOT_PENDING_PAYMENT' USING ERRCODE = '22000';
    END IF;
  END IF;

  -- 5. Hold expiration — UPDATE first, then return (no RAISE to avoid rollback)
  IF v_booking.hold_expires_at IS NOT NULL AND v_booking.hold_expires_at <= v_now THEN
    UPDATE public.bookings SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now WHERE id = p_booking_id;
    RETURN jsonb_build_object('success', false, 'error', 'BOOKING_HOLD_EXPIRED', 'message', 'The booking hold has expired');
  END IF;

  -- 6. Gateway whitelist
  IF p_gateway_provider <> 'fake_payment_gateway' THEN
    RAISE EXCEPTION 'REAL_PAYMENT_GATEWAY_NOT_ENABLED' USING ERRCODE = '22000';
  END IF;

  -- 7. Cross-booking idempotency key check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_payment FROM public.payments WHERE idempotency_key = p_idempotency_key;
    IF FOUND AND v_payment.booking_id <> p_booking_id THEN
      RAISE EXCEPTION 'PAYMENT_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BOOKING' USING ERRCODE = '22000';
    END IF;
  END IF;

  -- 8. Existing payment lookup
  SELECT * INTO v_payment FROM public.payments WHERE booking_id = p_booking_id ORDER BY created_at DESC LIMIT 1;

  IF FOUND THEN
    IF v_payment.status = 'PAID' THEN
      RAISE EXCEPTION 'BOOKING_ALREADY_PAID' USING ERRCODE = '22000';
    END IF;

    IF v_payment.status IN ('REFUNDED', 'CHARGEBACK') THEN
      RAISE EXCEPTION 'PAYMENT_IN_TERMINAL_STATE_NO_RETRY' USING ERRCODE = '22000';
    END IF;

    IF v_payment.status IN ('PENDING', 'AUTHORIZED') THEN
      -- Migrate legacy supabase_gateway payments
      IF v_payment.gateway_provider = 'supabase_gateway' THEN
        UPDATE public.payments
        SET gateway_provider = 'fake_payment_gateway',
            idempotency_key = 'idem_pay_' || p_booking_id,
            method = p_method,
            updated_at = v_now
        WHERE id = v_payment.id;
      ELSIF v_payment.method <> p_method AND v_payment.status = 'PENDING' THEN
        UPDATE public.payments SET method = p_method, updated_at = v_now WHERE id = v_payment.id;
      END IF;

      RETURN jsonb_build_object(
        'success', true, 'is_idempotent', true,
        'payment_id', v_payment.id, 'booking_id', v_payment.booking_id,
        'status', v_payment.status, 'amount_in_cents', v_payment.amount_in_cents
      );
    END IF;
    -- FAILED → fall through to create new attempt
  END IF;

  -- 9. Create new payment attempt (FAILED retry OR no existing payment)
  -- FOR FAILED RETRIES: Ignore the incoming p_idempotency_key entirely to prevent UNIQUE violations
  -- from legacy/fixed frontend keys. Generate a purely unique one.
  v_payment_id := gen_random_uuid();
  v_effective_idem_key := 'idem_pay_' || p_booking_id || '_' || v_payment_id;

  -- INSERT with ONLY existing columns in public.payments
  INSERT INTO public.payments (
    id, booking_id, method, status, amount_in_cents,
    idempotency_key, gateway_provider, created_at, updated_at
  ) VALUES (
    v_payment_id, p_booking_id, p_method, 'PENDING', v_booking.total_in_cents,
    v_effective_idem_key, p_gateway_provider, v_now, v_now
  );

  RETURN jsonb_build_object(
    'success', true, 'is_idempotent', false,
    'payment_id', v_payment_id, 'booking_id', p_booking_id,
    'status', 'PENDING', 'amount_in_cents', v_booking.total_in_cents
  );
END;
$$;


ALTER FUNCTION "public"."create_booking_payment"("p_booking_id" "uuid", "p_method" "public"."payment_method", "p_idempotency_key" character varying, "p_gateway_provider" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_instructor_emergency_block_if_free"("p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_now timestamptz := now();
  v_block_id uuid;
  v_reason text := COALESCE(NULLIF(trim(p_reason), ''), 'Bloqueio rápido de emergência');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = v_uid AND u.status = 'ACTIVE'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid AND ur.role = 'INSTRUCTOR'
  ) THEN
    RAISE EXCEPTION 'EMERGENCY_BLOCK_FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF p_start_at IS NULL OR p_end_at IS NULL OR p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'EMERGENCY_BLOCK_INVALID_RANGE' USING ERRCODE = '22023';
  END IF;
  IF p_end_at <= v_now THEN
    RAISE EXCEPTION 'EMERGENCY_BLOCK_IN_PAST' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('instructor-schedule:' || v_uid::text, 0)
  );

  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.instructor_id = v_uid
      AND b.scheduled_start_at < p_end_at
      AND p_start_at < b.scheduled_end_at
      AND (
        b.status IN ('CONFIRMED', 'IN_PROGRESS')
        OR (b.status = 'PENDING_PAYMENT' AND (b.hold_expires_at IS NULL OR b.hold_expires_at > v_now))
      )
  ) THEN
    RAISE EXCEPTION 'EMERGENCY_BLOCK_BOOKING_CONFLICT' USING ERRCODE = '23P01';
  END IF;

  SELECT b.id INTO v_block_id
  FROM public.instructor_global_blocks b
  WHERE b.instructor_id = v_uid
    AND b.start_at <= p_start_at
    AND b.end_at >= p_end_at
  ORDER BY b.created_at
  LIMIT 1;

  IF v_block_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true, 'already_blocked', true, 'id', v_block_id,
      'instructor_id', v_uid, 'start_at', p_start_at, 'end_at', p_end_at,
      'reason', v_reason
    );
  END IF;

  v_block_id := gen_random_uuid();
  INSERT INTO public.instructor_global_blocks
    (id, instructor_id, start_at, end_at, reason, created_at, updated_at)
  VALUES
    (v_block_id, v_uid, p_start_at, p_end_at, v_reason, v_now, v_now);

  RETURN jsonb_build_object(
    'success', true, 'already_blocked', false, 'id', v_block_id,
    'instructor_id', v_uid, 'start_at', p_start_at, 'end_at', p_end_at,
    'reason', v_reason
  );
END;
$$;


ALTER FUNCTION "public"."create_instructor_emergency_block_if_free"("p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_quote_from_offering"("p_offering_id" "uuid", "p_scheduled_start_at" timestamp with time zone, "p_idempotency_key" character varying DEFAULT NULL::character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_offering public.service_offerings%ROWTYPE;
  v_provider public.providers%ROWTYPE;
  v_existing_quote public.quotes%ROWTYPE;
  v_scheduled_end_at TIMESTAMPTZ;
  v_now TIMESTAMPTZ := NOW();
  v_expires_at TIMESTAMPTZ;
  v_ttl_minutes INT := 10;
  v_platform_fee_percentage NUMERIC := 10;
  v_platform_fee_cents INT;
  v_total_in_cents INT;
  v_new_quote_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE((value->>'default_percentage')::NUMERIC, 10)
    INTO v_platform_fee_percentage
    FROM public.platform_configurations
   WHERE key = 'platform_fees';
  v_platform_fee_percentage := GREATEST(0, LEAST(100, COALESCE(v_platform_fee_percentage, 10)));

  UPDATE public.bookings
     SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now
   WHERE status = 'PENDING_PAYMENT' AND hold_expires_at <= v_now;

  IF p_idempotency_key IS NOT NULL AND TRIM(p_idempotency_key) <> '' THEN
    SELECT * INTO v_existing_quote FROM public.quotes
     WHERE idempotency_key = TRIM(p_idempotency_key) AND student_id = v_uid LIMIT 1;
    IF FOUND THEN
      SELECT * INTO v_offering FROM public.service_offerings WHERE id = v_existing_quote.offering_id;
      IF v_offering.category::TEXT <> 'B' THEN
        RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for quotes' USING ERRCODE = '22023';
      END IF;
      IF v_existing_quote.offering_id <> p_offering_id OR v_existing_quote.scheduled_start_at <> p_scheduled_start_at THEN
        RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' USING ERRCODE = '23505';
      END IF;
      IF v_existing_quote.status = 'ACTIVE' AND v_existing_quote.expires_at > v_now THEN
        RETURN jsonb_build_object('success', true, 'is_idempotent', true, 'quote_id', v_existing_quote.id,
          'student_id', v_existing_quote.student_id, 'provider_id', v_existing_quote.provider_id,
          'instructor_id', v_existing_quote.instructor_id, 'vehicle_id', v_existing_quote.vehicle_id,
          'offering_id', v_existing_quote.offering_id, 'scheduled_start_at', v_existing_quote.scheduled_start_at,
          'scheduled_end_at', v_existing_quote.scheduled_end_at, 'price_in_cents', v_existing_quote.price_in_cents,
          'platform_fee_in_cents', v_existing_quote.platform_fee_in_cents, 'total_in_cents', v_existing_quote.total_in_cents,
          'status', v_existing_quote.status, 'expires_at', v_existing_quote.expires_at);
      END IF;
      RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_STALE' USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT * INTO v_offering FROM public.service_offerings WHERE id = p_offering_id;
  IF NOT FOUND OR v_offering.status <> 'ACTIVE' OR v_offering.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'OFFERING_NOT_FOUND_OR_INACTIVE' USING ERRCODE = '22023';
  END IF;
  IF v_offering.category::TEXT <> 'B' THEN
    RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for quotes' USING ERRCODE = '22023';
  END IF;
  IF v_offering.instructor_id IS NULL THEN RAISE EXCEPTION 'OFFERING_INSTRUCTOR_NOT_ASSIGNED' USING ERRCODE = '22023'; END IF;
  IF v_offering.vehicle_id IS NULL THEN RAISE EXCEPTION 'OFFERING_VEHICLE_NOT_ASSIGNED' USING ERRCODE = '22023'; END IF;

  SELECT * INTO v_provider FROM public.providers WHERE id = v_offering.provider_id;
  IF NOT FOUND OR v_provider.status <> 'ACTIVE' THEN RAISE EXCEPTION 'PROVIDER_INACTIVE' USING ERRCODE = '22023'; END IF;
  IF p_scheduled_start_at IS NULL OR p_scheduled_start_at <= v_now THEN RAISE EXCEPTION 'SLOT_MUST_BE_IN_FUTURE' USING ERRCODE = '22023'; END IF;
  IF NOT public.is_offering_slot_available(p_offering_id, p_scheduled_start_at) THEN RAISE EXCEPTION 'SELECTED_SLOT_NOT_AVAILABLE' USING ERRCODE = '22023'; END IF;

  v_scheduled_end_at := p_scheduled_start_at + MAKE_INTERVAL(mins => v_offering.duration_minutes);
  v_expires_at := v_now + MAKE_INTERVAL(mins => v_ttl_minutes);
  v_platform_fee_cents := ROUND((v_offering.price_in_cents * v_platform_fee_percentage) / 100.0)::INT;
  v_total_in_cents := v_offering.price_in_cents;
  v_new_quote_id := gen_random_uuid();

  INSERT INTO public.quotes (id, student_id, provider_id, instructor_id, vehicle_id, offering_id,
    scheduled_start_at, scheduled_end_at, price_in_cents, platform_fee_in_cents, total_in_cents,
    status, expires_at, created_at, idempotency_key)
  VALUES (v_new_quote_id, v_uid, v_offering.provider_id, v_offering.instructor_id, v_offering.vehicle_id,
    v_offering.id, p_scheduled_start_at, v_scheduled_end_at, v_offering.price_in_cents,
    v_platform_fee_cents, v_total_in_cents, 'ACTIVE', v_expires_at, v_now, NULLIF(TRIM(p_idempotency_key), ''))
  ON CONFLICT (student_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
  RETURNING * INTO v_existing_quote;

  IF v_existing_quote.id IS NULL THEN
    SELECT * INTO v_existing_quote FROM public.quotes
     WHERE student_id = v_uid AND idempotency_key = NULLIF(TRIM(p_idempotency_key), '');
    IF NOT FOUND THEN RAISE EXCEPTION 'QUOTE_CONCURRENT_CONFLICT_UNRESOLVABLE' USING ERRCODE = '40001'; END IF;
    IF v_existing_quote.offering_id <> p_offering_id OR v_existing_quote.scheduled_start_at <> p_scheduled_start_at THEN
      RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST' USING ERRCODE = '23505';
    END IF;
    IF v_existing_quote.status = 'ACTIVE' AND v_existing_quote.expires_at > v_now THEN
      RETURN jsonb_build_object('success', true, 'is_idempotent', true, 'quote_id', v_existing_quote.id,
        'student_id', v_existing_quote.student_id, 'provider_id', v_existing_quote.provider_id,
        'instructor_id', v_existing_quote.instructor_id, 'vehicle_id', v_existing_quote.vehicle_id,
        'offering_id', v_existing_quote.offering_id, 'scheduled_start_at', v_existing_quote.scheduled_start_at,
        'scheduled_end_at', v_existing_quote.scheduled_end_at, 'price_in_cents', v_existing_quote.price_in_cents,
        'platform_fee_in_cents', v_existing_quote.platform_fee_in_cents, 'total_in_cents', v_existing_quote.total_in_cents,
        'status', v_existing_quote.status, 'expires_at', v_existing_quote.expires_at);
    END IF;
    RAISE EXCEPTION 'QUOTE_IDEMPOTENCY_KEY_STALE' USING ERRCODE = '22023';
  END IF;

  RETURN jsonb_build_object('success', true, 'is_idempotent', false, 'quote_id', v_existing_quote.id,
    'student_id', v_existing_quote.student_id, 'provider_id', v_existing_quote.provider_id,
    'instructor_id', v_existing_quote.instructor_id, 'vehicle_id', v_existing_quote.vehicle_id,
    'offering_id', v_existing_quote.offering_id, 'scheduled_start_at', v_existing_quote.scheduled_start_at,
    'scheduled_end_at', v_existing_quote.scheduled_end_at, 'price_in_cents', v_existing_quote.price_in_cents,
    'platform_fee_in_cents', v_existing_quote.platform_fee_in_cents, 'total_in_cents', v_existing_quote.total_in_cents,
    'status', v_existing_quote.status, 'expires_at', v_existing_quote.expires_at);
END;
$$;


ALTER FUNCTION "public"."create_quote_from_offering"("p_offering_id" "uuid", "p_scheduled_start_at" timestamp with time zone, "p_idempotency_key" character varying) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "instructor_id" "uuid" NOT NULL,
    "rating_overall" integer NOT NULL,
    "rating_didactics" integer,
    "rating_punctuality" integer,
    "rating_safety" integer,
    "rating_vehicle" integer,
    "rating_cordiality" integer,
    "comment" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reviews_rating_cordiality_check" CHECK ((("rating_cordiality" >= 1) AND ("rating_cordiality" <= 5))),
    CONSTRAINT "reviews_rating_didactics_check" CHECK ((("rating_didactics" >= 1) AND ("rating_didactics" <= 5))),
    CONSTRAINT "reviews_rating_overall_check" CHECK ((("rating_overall" >= 1) AND ("rating_overall" <= 5))),
    CONSTRAINT "reviews_rating_punctuality_check" CHECK ((("rating_punctuality" >= 1) AND ("rating_punctuality" <= 5))),
    CONSTRAINT "reviews_rating_safety_check" CHECK ((("rating_safety" >= 1) AND ("rating_safety" <= 5))),
    CONSTRAINT "reviews_rating_vehicle_check" CHECK ((("rating_vehicle" >= 1) AND ("rating_vehicle" <= 5)))
);


ALTER TABLE "public"."reviews" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_review_for_booking"("p_booking_id" "uuid", "p_rating" integer, "p_comment" "text" DEFAULT NULL::"text") RETURNS "public"."reviews"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_student UUID := auth.uid();
  v_booking public.bookings%ROWTYPE;
  v_review public.reviews%ROWTYPE;
  v_rating_average NUMERIC;
  v_rating_count INTEGER;
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'REVIEW_RATING_OUT_OF_RANGE' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_booking.student_id <> v_student THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF v_booking.instructor_id = v_student THEN
    RAISE EXCEPTION 'PROVIDER_CANNOT_REVIEW_SELF' USING ERRCODE = '42501';
  END IF;

  IF v_booking.status::TEXT <> 'COMPLETED' THEN
    RAISE EXCEPTION 'REVIEW_REQUIRES_COMPLETED_BOOKING' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.reviews (
    booking_id,
    student_id,
    provider_id,
    instructor_id,
    rating_overall,
    comment,
    updated_at
  )
  VALUES (
    v_booking.id,
    v_booking.student_id,
    v_booking.provider_id,
    v_booking.instructor_id,
    p_rating,
    NULLIF(BTRIM(COALESCE(p_comment, '')), ''),
    NOW()
  )
  RETURNING * INTO v_review;

  SELECT COALESCE(ROUND(AVG(rating_overall)::NUMERIC, 2), 0.00), COUNT(*)::INTEGER
  INTO v_rating_average, v_rating_count
  FROM public.reviews
  WHERE provider_id = v_booking.provider_id;

  UPDATE public.providers
  SET rating_average = v_rating_average,
      rating_count = v_rating_count,
      updated_at = NOW()
  WHERE id = v_booking.provider_id;

  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
  SELECT DISTINCT recipient_id,
    'REVIEW_RECEIVED',
    'Nova avaliação recebida',
    'Um aluno avaliou uma aula concluída.',
    'review',
    v_review.id
  FROM (
    SELECT v_booking.instructor_id AS recipient_id
    UNION ALL
    SELECT p.user_id
    FROM public.providers p
    WHERE p.id = v_booking.provider_id
  ) recipients
  WHERE recipient_id IS NOT NULL
    AND recipient_id <> v_student;

  RETURN v_review;
END;
$$;


ALTER FUNCTION "public"."create_review_for_booking"("p_booking_id" "uuid", "p_rating" integer, "p_comment" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_school_instructor_invitation"("p_school_id" "uuid", "p_invited_email" "text", "p_invited_name" "text" DEFAULT NULL::"text", "p_invited_phone" "text" DEFAULT NULL::"text", "p_expires_in_days" integer DEFAULT 7) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID := auth.uid(); v_email TEXT := LOWER(BTRIM(p_invited_email));
  v_target_user_id UUID; v_school public.providers%ROWTYPE;
  v_existing public.driving_school_staff%ROWTYPE; v_invitation public.driving_school_invitations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'USER_NOT_ACTIVE'; END IF;
  IF NOT public.is_school_admin(p_school_id) THEN RAISE EXCEPTION 'SCHOOL_ADMIN_REQUIRED'; END IF;
  IF v_email IS NULL OR v_email = '' THEN RAISE EXCEPTION 'INVITED_EMAIL_REQUIRED'; END IF;
  IF p_expires_in_days IS NULL OR p_expires_in_days NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'INVALID_EXPIRATION_DAYS'; END IF;
  SELECT * INTO v_school FROM public.providers WHERE id = p_school_id;
  IF NOT FOUND OR v_school.type <> 'DRIVING_SCHOOL' THEN RAISE EXCEPTION 'PROVIDER_NOT_DRIVING_SCHOOL'; END IF;
  SELECT id INTO v_target_user_id FROM public.users WHERE LOWER(BTRIM(email)) = v_email LIMIT 1;
  IF v_target_user_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.driving_school_staff
    WHERE school_id = p_school_id AND user_id = v_target_user_id FOR UPDATE;
    IF FOUND AND v_existing.membership_status <> 'ENDED' THEN RAISE EXCEPTION 'MEMBERSHIP_ALREADY_EXISTS'; END IF;
  END IF;
  INSERT INTO public.driving_school_invitations
    (school_id, target_user_id, invited_name, invited_email, invited_phone, role, status, invited_by, expires_at)
  VALUES
    (p_school_id, v_target_user_id, NULLIF(BTRIM(p_invited_name), ''), v_email,
     NULLIF(BTRIM(p_invited_phone), ''), 'INSTRUCTOR', 'PENDING', v_uid,
     NOW() + make_interval(days => p_expires_in_days))
  RETURNING * INTO v_invitation;
  RETURN jsonb_build_object('success', TRUE, 'invitation_id', v_invitation.id,
    'status', v_invitation.status, 'existing_mazzi_user', v_target_user_id IS NOT NULL,
    'expires_at', v_invitation.expires_at);
END;
$$;


ALTER FUNCTION "public"."create_school_instructor_invitation"("p_school_id" "uuid", "p_invited_email" "text", "p_invited_name" "text", "p_invited_phone" "text", "p_expires_in_days" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_has_permission"("p_permission" "public"."app_permission") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID;
  v_custom_granted BOOLEAN;
  v_base_has_permission BOOLEAN;
BEGIN
  -- 2.1 Must be authenticated and active
  v_uid := auth.uid();
  IF v_uid IS NULL OR NOT public.is_current_user_active() THEN
    RETURN FALSE;
  END IF;

  -- 2.2 Check custom permission override in user_custom_permissions
  SELECT is_granted INTO v_custom_granted
  FROM public.user_custom_permissions
  WHERE user_id = v_uid AND permission = p_permission;

  IF v_custom_granted IS NOT NULL THEN
    RETURN v_custom_granted;
  END IF;

  -- 2.3 Check base permissions across primary role (users.role) and additional roles (user_roles)
  SELECT EXISTS (
    SELECT 1
    FROM public.role_permissions rp
    WHERE rp.permission = p_permission
      AND rp.role IN (
        SELECT u.role FROM public.users u WHERE u.id = v_uid
        UNION
        SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = v_uid
      )
  ) INTO v_base_has_permission;

  RETURN COALESCE(v_base_has_permission, FALSE);
END;
$$;


ALTER FUNCTION "public"."current_user_has_permission"("p_permission" "public"."app_permission") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."decline_school_instructor_invitation"("p_invitation_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user public.users%ROWTYPE;
  v_invitation public.driving_school_invitations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT * INTO v_user FROM public.users WHERE id = v_uid AND status = 'ACTIVE'::public.user_status;
  IF NOT FOUND THEN RAISE EXCEPTION 'USER_NOT_ACTIVE'; END IF;
  SELECT * INTO v_invitation FROM public.driving_school_invitations WHERE id = p_invitation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'INVITATION_NOT_FOUND'; END IF;
  IF v_invitation.status <> 'PENDING'::public.school_invitation_status THEN
    RAISE EXCEPTION 'INVITATION_ALREADY_PROCESSED';
  END IF;
  IF v_invitation.expires_at <= NOW() THEN
    UPDATE public.driving_school_invitations SET status = 'EXPIRED', updated_at = NOW() WHERE id = v_invitation.id;
    RAISE EXCEPTION 'INVITATION_EXPIRED';
  END IF;
  IF (v_invitation.target_user_id IS NOT NULL AND v_invitation.target_user_id <> v_uid)
     OR (v_invitation.target_user_id IS NULL AND LOWER(BTRIM(v_user.email)) <> LOWER(BTRIM(v_invitation.invited_email))) THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  UPDATE public.driving_school_invitations
  SET status = 'DECLINED', declined_at = NOW(), updated_at = NOW()
  WHERE id = v_invitation.id;
  RETURN jsonb_build_object('success', TRUE, 'invitation_id', v_invitation.id, 'status', 'DECLINED');
END;
$$;


ALTER FUNCTION "public"."decline_school_instructor_invitation"("p_invitation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_instructor_global_block"("p_block_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_active BOOLEAN := FALSE;
  v_has_role BOOLEAN := FALSE;
  v_block public.instructor_global_blocks%ROWTYPE;
  v_deleted_count INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED: Usuário não autenticado.' USING ERRCODE = '40100';
  END IF;

  SELECT (status = 'ACTIVE') INTO v_is_active
  FROM public.users
  WHERE id = v_uid;
  IF v_is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'USER_INACTIVE: Usuário não está ativo no sistema.' USING ERRCODE = '40300';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid AND role = 'INSTRUCTOR'
  ) INTO v_has_role;
  IF NOT v_has_role THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ROLE: Apenas instrutores credenciados podem gerenciar bloqueios pessoais globais.' USING ERRCODE = '40300';
  END IF;

  SELECT * INTO v_block
  FROM public.instructor_global_blocks
  WHERE id = p_block_id
    AND instructor_id = v_uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'GLOBAL_BLOCK_NOT_FOUND_OR_UNAUTHORIZED: Bloqueio pessoal não encontrado ou você não tem permissão.' USING ERRCODE = '40300';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('instructor-schedule:' || v_uid::text, 0)
  );

  IF v_block.start_at <= NOW() THEN
    RAISE EXCEPTION 'GLOBAL_BLOCK_ALREADY_STARTED: Bloqueios que já começaram fazem parte do histórico e não podem ser alterados.' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.instructor_global_blocks
  WHERE id = p_block_id
    AND instructor_id = v_uid;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  IF v_deleted_count = 0 THEN
    RAISE EXCEPTION 'GLOBAL_BLOCK_NOT_FOUND_OR_UNAUTHORIZED: Bloqueio pessoal não encontrado ou você não tem permissão.' USING ERRCODE = '40300';
  END IF;

  RETURN jsonb_build_object('success', true, 'id', p_block_id);
END;
$$;


ALTER FUNCTION "public"."delete_instructor_global_block"("p_block_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."end_school_instructor_membership"("p_membership_id" "uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_membership public.driving_school_staff%ROWTYPE;
  v_reason TEXT := NULLIF(BTRIM(p_reason), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_membership
  FROM public.driving_school_staff
  WHERE id = p_membership_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_school_admin(v_membership.school_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF v_membership.membership_status = 'ENDED'::public.school_membership_status THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'membership_id', v_membership.id,
      'status', 'ENDED',
      'already_ended', TRUE
    );
  END IF;

  UPDATE public.driving_school_staff
  SET membership_status = 'ENDED'::public.school_membership_status,
      is_active = FALSE,
      ended_at = NOW(),
      ended_by = v_uid,
      end_reason = v_reason,
      updated_at = NOW()
  WHERE id = v_membership.id;

  -- The existing status-event trigger records the transition and actor.
  -- Keep the human-readable reason on that same historical event.
  UPDATE public.driving_school_membership_events
  SET reason = v_reason
  WHERE id = (
    SELECT e.id
    FROM public.driving_school_membership_events e
    WHERE e.membership_id = v_membership.id
      AND e.event_type = 'ENDED'::public.school_membership_event_type
      AND e.actor_id = v_uid
    ORDER BY e.created_at DESC
    LIMIT 1
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'membership_id', v_membership.id,
    'status', 'ENDED',
    'already_ended', FALSE
  );
END;
$$;


ALTER FUNCTION "public"."end_school_instructor_membership"("p_membership_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_booking_instructor_eligibility"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP = 'INSERT'
     AND NEW.scheduled_end_at > NOW()
     AND COALESCE(NEW.status::TEXT, '') NOT IN ('CANCELLED_BY_STUDENT','CANCELLED_BY_PROVIDER','REFUNDED','NO_SHOW_STUDENT','NO_SHOW_PROVIDER')
     AND NOT public.is_provider_instructor_eligible(NEW.provider_id, NEW.instructor_id, NULL) THEN
    RAISE EXCEPTION 'INSTRUCTOR_NOT_ELIGIBLE' USING ERRCODE = '42501';
  END IF;
  IF NEW.selection_mode IS NULL THEN NEW.selection_mode := 'SPECIFIC_INSTRUCTOR'; END IF;
  IF TG_OP='UPDATE' AND ((NEW.checkin_instructor_at IS DISTINCT FROM OLD.checkin_instructor_at AND NEW.checkin_instructor_at IS NOT NULL) OR (NEW.lesson_started_at IS DISTINCT FROM OLD.lesson_started_at AND NEW.lesson_started_at IS NOT NULL)) AND NOT public.is_provider_instructor_eligible(NEW.provider_id,NEW.instructor_id,NULL) THEN
    RAISE EXCEPTION 'INSTRUCTOR_COMPLIANCE_INVALID_AT_LESSON_START' USING ERRCODE='42501';
  END IF;
  IF NEW.snapshot_data IS NULL THEN NEW.snapshot_data:=jsonb_build_object('selectionMode',NEW.selection_mode::TEXT); ELSIF NOT (NEW.snapshot_data ? 'selectionMode') THEN NEW.snapshot_data:=jsonb_set(NEW.snapshot_data,'{selectionMode}',to_jsonb(NEW.selection_mode::TEXT),true); END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_booking_instructor_eligibility"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_booking_schedule_exceptions"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('provider-schedule:' || NEW.provider_id::TEXT,0));
  IF NEW.instructor_id IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtextextended('instructor-schedule:' || NEW.instructor_id::TEXT,0)); END IF;
  IF NEW.status IN ('PENDING_PAYMENT','CONFIRMED','IN_PROGRESS') AND EXISTS (
    SELECT 1 FROM public.availability_exceptions e WHERE e.provider_id=NEW.provider_id AND e.type='BLOCK' AND e.is_active IS TRUE
      AND (e.instructor_id IS NULL OR e.instructor_id=NEW.instructor_id) AND (e.vehicle_id IS NULL OR e.vehicle_id=NEW.vehicle_id)
      AND NEW.scheduled_start_at < e.end_at AND e.start_at < NEW.scheduled_end_at
  ) THEN RAISE EXCEPTION 'SLOT_NO_LONGER_AVAILABLE' USING ERRCODE='23P01'; END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_booking_schedule_exceptions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_quote_instructor_eligibility"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NOT public.is_provider_instructor_eligible(NEW.provider_id,NEW.instructor_id,NULL) THEN
    RAISE EXCEPTION 'INSTRUCTOR_NOT_ELIGIBLE' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enforce_quote_instructor_eligibility"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_schedule_lock_on_availability"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF TG_OP='UPDATE' AND OLD.provider_id IS DISTINCT FROM NEW.provider_id THEN RAISE EXCEPTION 'PROVIDER_SCOPE_IMMUTABLE' USING ERRCODE='22000'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('provider-schedule:' || COALESCE(NEW.provider_id,OLD.provider_id)::TEXT,0));
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;


ALTER FUNCTION "public"."enforce_schedule_lock_on_availability"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_analytics_summary"("p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if not public.is_current_user_active() or not public.is_platform_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if p_date_from is null or p_date_to is null or p_date_to <= p_date_from then
    raise exception 'INVALID_ANALYTICS_PERIOD' using errcode = '22023';
  end if;

  with
  users_metrics as (
    select
      count(*) filter (where role::text = 'STUDENT' and status::text = 'ACTIVE') as active_students,
      count(*) filter (where role::text = 'INSTRUCTOR' and status::text = 'ACTIVE') as active_instructor_users,
      count(*) filter (where role::text = 'SCHOOL_ADMIN' and status::text = 'ACTIVE') as active_school_admin_users,
      count(*) filter (where status::text = 'ACTIVE') as active_users_total
    from public.users
  ),
  supply_metrics as (
    select
      count(*) filter (where status::text = 'ACTIVE') as active_providers,
      count(*) filter (where type::text = 'INSTRUCTOR' and status::text = 'ACTIVE') as active_individual_providers,
      count(*) filter (where type::text = 'DRIVING_SCHOOL' and status::text = 'ACTIVE') as active_driving_schools
    from public.providers
  ),
  vehicle_metrics as (
    select count(*) filter (where status::text = 'ACTIVE' and deleted_at is null) as active_vehicles
    from public.vehicles
  ),
  offering_metrics as (
    select count(*) filter (where status::text = 'ACTIVE' and is_active is true) as active_offerings
    from public.service_offerings
  ),
  booking_metrics as (
    select
      count(*) as bookings_created,
      count(*) filter (where status::text = 'CONFIRMED') as bookings_confirmed,
      count(*) filter (where status::text = 'COMPLETED') as bookings_completed,
      count(*) filter (where status::text in ('CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER')) as bookings_cancelled,
      count(*) filter (where status::text in ('NO_SHOW_STUDENT', 'NO_SHOW_PROVIDER')) as bookings_no_show,
      count(*) filter (where status::text = 'EXPIRED') as bookings_expired
    from public.bookings
    where created_at >= p_date_from and created_at < p_date_to
  ),
  quote_metrics as (
    select count(*) as quotes_created
    from public.quotes
    where created_at >= p_date_from and created_at < p_date_to
  ),
  payment_metrics as (
    select
      count(*) as payments_created,
      count(*) filter (where p.status::text = 'PAID') as payments_paid,
      coalesce(sum(p.amount_in_cents) filter (where p.status::text = 'PAID'), 0)::bigint as paid_volume_cents,
      coalesce(sum(b.platform_fee_in_cents) filter (where p.status::text = 'PAID'), 0)::bigint as platform_fee_volume_cents
    from public.payments p
    left join public.bookings b on b.id = p.booking_id
    where p.created_at >= p_date_from and p.created_at < p_date_to
  ),
  refund_metrics as (
    select coalesce(sum(amount_in_cents), 0)::bigint as refund_volume_cents
    from public.refunds
    where created_at >= p_date_from and created_at < p_date_to
  ),
  payout_metrics as (
    select
      coalesce(sum(amount_in_cents) filter (where status::text in ('PENDING', 'SCHEDULED')), 0)::bigint as payout_pending_cents,
      coalesce(sum(amount_in_cents) filter (where status::text in ('PAID', 'RELEASED')), 0)::bigint as payout_paid_cents
    from public.payouts
    where created_at >= p_date_from and created_at < p_date_to
  ),
  review_metrics as (
    select
      count(*) as reviews_created,
      round(avg(rating_overall)::numeric, 2) as rating_average
    from public.reviews
    where created_at >= p_date_from and created_at < p_date_to
  ),
  engagement_metrics as (
    select
      count(*) filter (where event_name = 'PROVIDER_SEARCH') as provider_searches,
      count(*) filter (where event_name = 'PROVIDER_PROFILE_VIEW') as provider_profile_views,
      count(*) filter (where event_name = 'AVAILABLE_SLOTS_VIEW') as available_slots_views,
      count(*) filter (where event_name = 'CHECKOUT_STARTED') as checkout_started
    from public.analytics_events
    where created_at >= p_date_from and created_at < p_date_to
  )
  select jsonb_build_object(
    'period', jsonb_build_object(
      'from', p_date_from,
      'to', p_date_to,
      'timezone', 'America/Sao_Paulo'
    ),
    'users', jsonb_build_object(
      'active_students', u.active_students,
      'active_instructor_users', u.active_instructor_users,
      'active_school_admin_users', u.active_school_admin_users,
      'active_users_total', u.active_users_total
    ),
    'supply', jsonb_build_object(
      'active_providers', s.active_providers,
      'active_individual_providers', s.active_individual_providers,
      'active_driving_schools', s.active_driving_schools,
      'active_vehicles', v.active_vehicles,
      'active_offerings', o.active_offerings
    ),
    'bookings', jsonb_build_object(
      'created', b.bookings_created,
      'confirmed', b.bookings_confirmed,
      'completed', b.bookings_completed,
      'cancelled', b.bookings_cancelled,
      'no_show', b.bookings_no_show,
      'expired', b.bookings_expired
    ),
    'funnel', jsonb_build_object(
      'quotes_created', q.quotes_created,
      'bookings_created', b.bookings_created,
      'payments_created', pm.payments_created,
      'payments_paid', pm.payments_paid,
      'quote_to_booking_rate', case when q.quotes_created > 0 then round((b.bookings_created::numeric / q.quotes_created::numeric), 4) else null end,
      'booking_to_paid_rate', case when b.bookings_created > 0 then round((pm.payments_paid::numeric / b.bookings_created::numeric), 4) else null end
    ),
    'financial_dev', jsonb_build_object(
      'paid_volume_cents', pm.paid_volume_cents,
      'platform_fee_volume_cents', pm.platform_fee_volume_cents,
      'refund_volume_cents', rf.refund_volume_cents,
      'payout_pending_cents', po.payout_pending_cents,
      'payout_paid_cents', po.payout_paid_cents,
      'label', 'Ambiente DEV — pagamentos simulados'
    ),
    'quality', jsonb_build_object(
      'reviews_created', r.reviews_created,
      'rating_average', r.rating_average
    ),
    'engagement', jsonb_build_object(
      'provider_searches', e.provider_searches,
      'provider_profile_views', e.provider_profile_views,
      'available_slots_views', e.available_slots_views,
      'checkout_started', e.checkout_started
    )
  )
  into v_result
  from users_metrics u, supply_metrics s, vehicle_metrics v, offering_metrics o,
       booking_metrics b, quote_metrics q, payment_metrics pm, refund_metrics rf,
       payout_metrics po, review_metrics r, engagement_metrics e;

  return v_result;
end;
$$;


ALTER FUNCTION "public"."get_admin_analytics_summary"("p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_audit_logs"() RETURNS TABLE("id" "uuid", "actor_id" "uuid", "action" character varying, "entity_type" character varying, "entity_id" character varying, "previous_value" "jsonb", "new_value" "jsonb", "ip_address" character varying, "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED'
      USING ERRCODE = '28000';
  END IF;

  IF NOT public.current_user_has_permission(
    'admin.audit.read'::public.app_permission
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.actor_id,
    al.action,
    al.entity_type,
    al.entity_id,
    al.previous_value,
    al.new_value,
    al.ip_address,
    al.created_at
  FROM public.audit_logs AS al
  ORDER BY al.created_at DESC
  LIMIT 500;
END;
$$;


ALTER FUNCTION "public"."get_admin_audit_logs"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_platform_configurations"() RETURNS TABLE("key" character varying, "value" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED'
      USING ERRCODE = '28000';
  END IF;

  IF NOT public.current_user_has_permission(
    'admin.platform.manage_settings'::public.app_permission
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT pc.key, pc.value
  FROM public.platform_configurations AS pc;
END;
$$;


ALTER FUNCTION "public"."get_admin_platform_configurations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_available_slots_public"("p_offering_id" "uuid", "p_date_from" "date", "p_date_to" "date") RETURNS TABLE("offering_id" "uuid", "provider_id" "uuid", "instructor_id" "uuid", "vehicle_id" "uuid", "slot_start_at" timestamp with time zone, "slot_end_at" timestamp with time zone, "local_date" "date", "local_start_time" time without time zone, "local_end_time" time without time zone, "timezone" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_offering public.service_offerings%ROWTYPE;
  v_max_horizon INT := 30;
BEGIN
  IF p_date_from IS NULL OR p_date_to IS NULL OR p_date_to < p_date_from THEN RAISE EXCEPTION 'INVALID_SLOT_DATE_RANGE' USING ERRCODE = '22023'; END IF;
  SELECT COALESCE((value->>'max_booking_horizon_days')::INT, 30) INTO v_max_horizon FROM public.platform_configurations WHERE key = 'scheduling_settings' LIMIT 1;
  IF p_date_to - p_date_from > 31 THEN RAISE EXCEPTION 'SLOT_DATE_RANGE_TOO_LARGE' USING ERRCODE = '22023'; END IF;
  IF p_date_to > CURRENT_DATE + GREATEST(COALESCE(v_max_horizon, 30), 1) THEN RAISE EXCEPTION 'SLOT_DATE_BEYOND_BOOKING_HORIZON' USING ERRCODE = '22023'; END IF;
  SELECT * INTO v_offering FROM public.service_offerings WHERE id = p_offering_id;
  IF NOT FOUND OR v_offering.status <> 'ACTIVE' OR v_offering.is_active IS NOT TRUE OR v_offering.instructor_id IS NULL OR v_offering.vehicle_id IS NULL THEN RETURN; END IF;
  IF v_offering.category::TEXT <> 'B' THEN RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for public search' USING ERRCODE = '22023'; END IF;
  RETURN QUERY
  WITH days AS (
    SELECT d::DATE AS day_date FROM generate_series(GREATEST(p_date_from, CURRENT_DATE), p_date_to, INTERVAL '1 day') d
  ),
  recurring_candidates AS (
    SELECT DISTINCT a.timezone::TEXT AS tz, gs AS start_at
    FROM public.availabilities a CROSS JOIN days
    CROSS JOIN LATERAL generate_series(
      date_trunc('hour', ((days.day_date + a.start_time) AT TIME ZONE a.timezone))
        + CASE WHEN EXTRACT(MINUTE FROM a.start_time) > 0 OR EXTRACT(SECOND FROM a.start_time) > 0 THEN INTERVAL '1 hour' ELSE INTERVAL '0' END,
      ((days.day_date + a.end_time) AT TIME ZONE a.timezone) - make_interval(mins => v_offering.duration_minutes), INTERVAL '1 hour') gs
    WHERE a.provider_id = v_offering.provider_id AND a.is_active IS TRUE
      AND (a.instructor_id IS NULL OR a.instructor_id = v_offering.instructor_id) AND (a.vehicle_id IS NULL OR a.vehicle_id = v_offering.vehicle_id)
      AND a.day_of_week = EXTRACT(ISODOW FROM days.day_date)::INT
      AND (a.effective_from IS NULL OR days.day_date >= a.effective_from) AND (a.effective_to IS NULL OR days.day_date <= a.effective_to)
  ),
  override_candidates AS (
    SELECT DISTINCT 'America/Sao_Paulo'::TEXT AS tz, gs AS start_at
    FROM public.availability_exceptions e
    CROSS JOIN LATERAL generate_series(
      date_trunc('hour', e.start_at) + CASE WHEN EXTRACT(MINUTE FROM e.start_at AT TIME ZONE 'America/Sao_Paulo') > 0 OR EXTRACT(SECOND FROM e.start_at AT TIME ZONE 'America/Sao_Paulo') > 0 THEN INTERVAL '1 hour' ELSE INTERVAL '0' END,
      e.end_at - make_interval(mins => v_offering.duration_minutes), INTERVAL '1 hour') gs
    WHERE e.provider_id = v_offering.provider_id AND e.type = 'AVAILABLE_OVERRIDE' AND e.is_active IS TRUE
      AND (e.instructor_id IS NULL OR e.instructor_id = v_offering.instructor_id) AND (e.vehicle_id IS NULL OR e.vehicle_id = v_offering.vehicle_id)
      AND (e.start_at AT TIME ZONE 'America/Sao_Paulo')::DATE <= p_date_to AND (e.end_at AT TIME ZONE 'America/Sao_Paulo')::DATE >= p_date_from
  ),
  candidates AS (SELECT DISTINCT tz, start_at FROM recurring_candidates UNION SELECT DISTINCT tz, start_at FROM override_candidates)
  SELECT v_offering.id, v_offering.provider_id, v_offering.instructor_id, v_offering.vehicle_id, c.start_at, c.start_at + make_interval(mins => v_offering.duration_minutes), (c.start_at AT TIME ZONE c.tz)::DATE, (c.start_at AT TIME ZONE c.tz)::TIME, ((c.start_at + make_interval(mins => v_offering.duration_minutes)) AT TIME ZONE c.tz)::TIME, c.tz
  FROM candidates c
  WHERE c.start_at > NOW() AND public.is_offering_slot_available(v_offering.id, c.start_at)
  ORDER BY c.start_at;
END;
$$;


ALTER FUNCTION "public"."get_available_slots_public"("p_offering_id" "uuid", "p_date_from" "date", "p_date_to" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_booking_categories"("p_booking_ids" "uuid"[]) RETURNS TABLE("booking_id" "uuid", "offering_id" "uuid", "category" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT
    b.id AS booking_id,
    b.offering_id,
    so.category::TEXT
  FROM public.bookings b
  JOIN public.service_offerings so ON so.id = b.offering_id
  WHERE p_booking_ids IS NOT NULL
    AND cardinality(p_booking_ids) > 0
    AND b.id = ANY(p_booking_ids)
    AND auth.uid() IS NOT NULL
    AND public.is_booking_participant(b.id);
$$;


ALTER FUNCTION "public"."get_my_booking_categories"("p_booking_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_booking_names"("p_booking_ids" "uuid"[]) RETURNS TABLE("booking_id" "uuid", "instructor_name" "text", "provider_name" "text", "vehicle_name" "text", "meeting_point" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT b.id, iu.name::TEXT, p.trade_name::TEXT,
    CONCAT(v.brand, ' ', v.model)::TEXT, b.meeting_point
  FROM public.bookings b
  JOIN public.users iu ON iu.id = b.instructor_id
  JOIN public.providers p ON p.id = b.provider_id
  JOIN public.vehicles v ON v.id = b.vehicle_id
  WHERE b.student_id = auth.uid() AND b.id = ANY(p_booking_ids);
$$;


ALTER FUNCTION "public"."get_my_booking_names"("p_booking_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_instructor_global_blocks"() RETURNS TABLE("id" "uuid", "instructor_id" "uuid", "start_at" timestamp with time zone, "end_at" timestamp with time zone, "reason" "text", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_active BOOLEAN := FALSE;
  v_has_role BOOLEAN := FALSE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED: Usuário não autenticado.' USING ERRCODE = '40100';
  END IF;

  SELECT (u.status = 'ACTIVE')
  INTO v_is_active
  FROM public.users AS u
  WHERE u.id = v_uid;

  IF v_is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'USER_INACTIVE: Usuário não está ativo no sistema.' USING ERRCODE = '40300';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles AS ur
    WHERE ur.user_id = v_uid
      AND ur.role = 'INSTRUCTOR'
  ) INTO v_has_role;

  IF NOT v_has_role THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ROLE: Apenas instrutores credenciados podem gerenciar bloqueios pessoais globais.' USING ERRCODE = '40300';
  END IF;

  RETURN QUERY
  SELECT
    igb.id,
    igb.instructor_id,
    igb.start_at,
    igb.end_at,
    igb.reason,
    igb.created_at,
    igb.updated_at
  FROM public.instructor_global_blocks AS igb
  WHERE igb.instructor_id = v_uid
  ORDER BY igb.start_at ASC;
END;
$$;


ALTER FUNCTION "public"."get_my_instructor_global_blocks"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_roles"() RETURNS TABLE("role" "public"."user_role")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF (select auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  RETURN QUERY
  SELECT DISTINCT r.role
  FROM (
    SELECT u.role
    FROM public.users AS u
    WHERE u.id = (select auth.uid())
      AND u.status = 'ACTIVE'::public.user_status
    UNION ALL
    SELECT ur.role
    FROM public.user_roles AS ur
    JOIN public.users AS u ON u.id = ur.user_id
    WHERE ur.user_id = (select auth.uid())
      AND u.status = 'ACTIVE'::public.user_status
  ) AS r
  ORDER BY r.role;
END;
$$;


ALTER FUNCTION "public"."get_my_roles"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_unified_instructor_bookings"() RETURNS TABLE("id" "uuid", "student_id" "uuid", "student_name" "text", "provider_id" "uuid", "provider_name" "text", "instructor_id" "uuid", "instructor_name" "text", "vehicle_id" "uuid", "vehicle_name" "text", "offering_id" "uuid", "quote_id" "uuid", "status" "public"."booking_status", "scheduled_start_at" timestamp with time zone, "scheduled_end_at" timestamp with time zone, "checkin_student_at" timestamp with time zone, "checkin_instructor_at" timestamp with time zone, "lesson_started_at" timestamp with time zone, "lesson_finished_at" timestamp with time zone, "completed_at" timestamp with time zone, "confirmed_at" timestamp with time zone, "updated_at" timestamp with time zone, "hold_expires_at" timestamp with time zone, "idempotency_key" character varying, "cancelled_at" timestamp with time zone, "cancelled_by" "text", "cancellation_reason" "text", "refund_amount_in_cents" bigint, "expired_at" timestamp with time zone, "price_in_cents" integer, "platform_fee_in_cents" integer, "total_in_cents" integer, "snapshot_data" "jsonb", "meeting_point" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.student_id,
    COALESCE(b.snapshot_data->>'studentName', b.snapshot_data->>'student_name', su.name, '')::text,
    b.provider_id,
    COALESCE(b.snapshot_data->>'providerName', p.trade_name, p.legal_name, '')::text,
    b.instructor_id,
    COALESCE(b.snapshot_data->>'instructorName', iu.name, '')::text,
    b.vehicle_id,
    COALESCE(b.snapshot_data->>'vehicleName', v.brand || ' ' || v.model, '')::text,
    b.offering_id,
    b.quote_id,
    b.status,
    b.scheduled_start_at,
    b.scheduled_end_at,
    b.checkin_student_at,
    b.checkin_instructor_at,
    b.lesson_started_at,
    b.lesson_finished_at,
    b.completed_at,
    b.confirmed_at,
    b.updated_at,
    b.hold_expires_at,
    b.idempotency_key,
    b.cancelled_at,
    b.cancelled_by,
    b.cancellation_reason,
    b.refund_amount_in_cents,
    b.expired_at,
    b.price_in_cents,
    b.platform_fee_in_cents,
    b.total_in_cents,
    b.snapshot_data,
    b.meeting_point,
    b.created_at
  FROM public.bookings b
  LEFT JOIN public.providers p ON p.id = b.provider_id
  LEFT JOIN public.users su ON su.id = b.student_id
  LEFT JOIN public.users iu ON iu.id = b.instructor_id
  LEFT JOIN public.vehicles v ON v.id = b.vehicle_id
  WHERE b.instructor_id = v_uid
  ORDER BY b.scheduled_start_at ASC;
END;
$$;


ALTER FUNCTION "public"."get_my_unified_instructor_bookings"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "student_id" "uuid" NOT NULL,
    "instructor_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_or_create_conversation_for_booking"("p_booking_id" "uuid") RETURNS "public"."conversations"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_conversation public.conversations%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_booking_participant(p_booking_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.conversations (
    booking_id,
    student_id,
    provider_id,
    instructor_id,
    updated_at
  )
  VALUES (
    v_booking.id,
    v_booking.student_id,
    v_booking.provider_id,
    v_booking.instructor_id,
    NOW()
  )
  ON CONFLICT (booking_id) DO UPDATE
  SET provider_id = EXCLUDED.provider_id,
      student_id = EXCLUDED.student_id,
      instructor_id = EXCLUDED.instructor_id,
      updated_at = public.conversations.updated_at
  RETURNING * INTO v_conversation;

  RETURN v_conversation;
END;
$$;


ALTER FUNCTION "public"."get_or_create_conversation_for_booking"("p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_provider_analytics_summary"("p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID;
  v_result JSONB;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED: Usuário não autenticado.' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_current_user_active() THEN
    RAISE EXCEPTION 'USER_NOT_ACTIVE: Usuário não está ativo no sistema.' USING ERRCODE = '42501';
  END IF;

  IF p_date_from IS NULL OR p_date_to IS NULL OR p_date_to <= p_date_from THEN
    RAISE EXCEPTION 'INVALID_ANALYTICS_PERIOD: Período de consulta inválido.' USING ERRCODE = '22023';
  END IF;

  WITH
  authorized_providers AS (
    SELECT DISTINCT p.id
    FROM public.providers p
    WHERE
      -- Private autonomous provider: owner user_id AND provider.finance.read_own permission
      (
        p.user_id = v_uid
        AND p.type::TEXT = 'INSTRUCTOR'
        AND public.current_user_has_permission('provider.finance.read_own'::public.app_permission)
      )
      OR
      -- Driving school provider: active member/owner AND school.finance.read permission
      (
        p.type::TEXT = 'DRIVING_SCHOOL'
        AND public.current_user_has_permission('school.finance.read'::public.app_permission)
        AND (
          p.user_id = v_uid
          OR EXISTS (
            SELECT 1
            FROM public.driving_school_staff dss
            WHERE dss.school_id = p.id
              AND dss.user_id = v_uid
              AND dss.is_active IS TRUE
          )
        )
      )
  ),
  booking_metrics AS (
    SELECT
      COUNT(*) AS bookings_created,
      COUNT(*) FILTER (WHERE status::TEXT = 'CONFIRMED') AS bookings_confirmed,
      COUNT(*) FILTER (WHERE status::TEXT = 'COMPLETED') AS bookings_completed,
      COUNT(*) FILTER (WHERE status::TEXT IN ('CANCELLED_BY_STUDENT', 'CANCELLED_BY_PROVIDER')) AS bookings_cancelled,
      COUNT(*) FILTER (WHERE status::TEXT IN ('NO_SHOW_STUDENT', 'NO_SHOW_PROVIDER')) AS bookings_no_show,
      COUNT(*) FILTER (WHERE status::TEXT = 'CONFIRMED' AND scheduled_start_at >= NOW()) AS upcoming_bookings
    FROM public.bookings
    WHERE provider_id IN (SELECT id FROM authorized_providers)
      AND created_at >= p_date_from
      AND created_at < p_date_to
  ),
  payment_metrics AS (
    SELECT
      COUNT(*) FILTER (WHERE p.status::TEXT = 'PAID') AS payments_paid,
      COALESCE(SUM(p.amount_in_cents) FILTER (WHERE p.status::TEXT = 'PAID'), 0)::BIGINT AS paid_volume_cents,
      COALESCE(SUM(b.platform_fee_in_cents) FILTER (WHERE p.status::TEXT = 'PAID'), 0)::BIGINT AS platform_fee_volume_cents
    FROM public.payments p
    JOIN public.bookings b ON b.id = p.booking_id
    WHERE b.provider_id IN (SELECT id FROM authorized_providers)
      AND p.created_at >= p_date_from
      AND p.created_at < p_date_to
  ),
  review_metrics AS (
    SELECT
      COUNT(*) AS reviews_count,
      ROUND(AVG(rating_overall)::NUMERIC, 2) AS rating_average
    FROM public.reviews
    WHERE provider_id IN (SELECT id FROM authorized_providers)
  ),
  supply_metrics AS (
    SELECT
      (SELECT COUNT(*) FROM authorized_providers) AS provider_contexts,
      COUNT(DISTINCT v.id) FILTER (WHERE v.status::TEXT = 'ACTIVE' AND v.deleted_at IS NULL) AS active_vehicles,
      COUNT(DISTINCT so.id) FILTER (WHERE so.status::TEXT = 'ACTIVE' AND so.is_active IS TRUE) AS active_offerings
    FROM authorized_providers ap
    LEFT JOIN public.vehicles v ON v.provider_id = ap.id
    LEFT JOIN public.service_offerings so ON so.provider_id = ap.id
  )
  SELECT JSONB_BUILD_OBJECT(
    'period', JSONB_BUILD_OBJECT(
      'from', p_date_from,
      'to', p_date_to,
      'timezone', 'America/Sao_Paulo'
    ),
    'provider_contexts', COALESCE(s.provider_contexts, 0),
    'bookings', JSONB_BUILD_OBJECT(
      'created', COALESCE(b.bookings_created, 0),
      'confirmed', COALESCE(b.bookings_confirmed, 0),
      'completed', COALESCE(b.bookings_completed, 0),
      'cancelled', COALESCE(b.bookings_cancelled, 0),
      'no_show', COALESCE(b.bookings_no_show, 0),
      'upcoming', COALESCE(b.upcoming_bookings, 0)
    ),
    'financial_dev', JSONB_BUILD_OBJECT(
      'payments_paid', COALESCE(pm.payments_paid, 0),
      'paid_volume_cents', COALESCE(pm.paid_volume_cents, 0),
      'platform_fee_volume_cents', COALESCE(pm.platform_fee_volume_cents, 0),
      'label', 'Ambiente de validação — pagamentos simulados'
    ),
    'quality', JSONB_BUILD_OBJECT(
      'reviews_count', COALESCE(r.reviews_count, 0),
      'rating_average', r.rating_average
    ),
    'supply', JSONB_BUILD_OBJECT(
      'active_vehicles', COALESCE(s.active_vehicles, 0),
      'active_offerings', COALESCE(s.active_offerings, 0)
    )
  ) INTO v_result
  FROM booking_metrics b, payment_metrics pm, review_metrics r, supply_metrics s;

  RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."get_provider_analytics_summary"("p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_provider_booking_context_public"("p_provider_id" "uuid") RETURNS TABLE("provider_id" "uuid", "provider_name" "text", "offering_id" "uuid", "instructor_id" "uuid", "instructor_name" "text", "vehicle_id" "uuid", "category" "text", "transmission" "text", "duration_minutes" integer, "price_in_cents" integer, "vehicle_brand" "text", "vehicle_model" "text", "vehicle_year" integer, "vehicle_category" "text", "vehicle_transmission" "text", "vehicle_color" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT p.id,p.trade_name::TEXT,o.id,o.instructor_id,u.name::TEXT,v.id,o.category::TEXT,o.transmission::TEXT,
    o.duration_minutes,o.price_in_cents,v.brand::TEXT,v.model::TEXT,v.year,v.category::TEXT,v.transmission::TEXT,v.color::TEXT
  FROM public.providers p
  JOIN public.service_offerings o ON o.provider_id=p.id
  JOIN public.users u ON u.id=o.instructor_id
  JOIN public.vehicles v ON v.id=o.vehicle_id AND v.provider_id=p.id
  WHERE p.id=p_provider_id AND p.status='ACTIVE' AND o.status='ACTIVE' AND o.is_active
    AND o.category::TEXT='B' AND v.status='ACTIVE' AND v.deleted_at IS NULL
    AND public.is_provider_instructor_eligible(p.id,o.instructor_id,o.category)
  ORDER BY o.price_in_cents,o.id;
$$;


ALTER FUNCTION "public"."get_provider_booking_context_public"("p_provider_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_public_vehicle_catalog"() RETURNS TABLE("id" "uuid", "provider_id" "uuid", "brand" character varying, "model" character varying, "year" integer, "license_plate" character varying, "license_plate_masked" character varying, "category" "public"."vehicle_category", "vehicle_type" "public"."vehicle_type", "transmission" "public"."vehicle_transmission", "status" "public"."vehicle_status", "color" character varying, "photos" "text"[], "created_at" timestamp with time zone, "updated_at" timestamp with time zone, "deleted_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  select
    v.id,
    v.provider_id,
    v.brand,
    v.model,
    v.year,
    case
      when public.is_platform_admin()
        or public.is_school_admin(v.provider_id)
        or exists (
          select 1
          from public.providers p
          where p.id = v.provider_id
            and p.user_id = auth.uid()
        )
      then v.license_plate
      else coalesce(v.license_plate_masked, '***-****')
    end as license_plate,
    coalesce(v.license_plate_masked, '***-****') as license_plate_masked,
    v.category,
    v.vehicle_type,
    v.transmission,
    v.status,
    v.color,
    v.photos,
    v.created_at,
    v.updated_at,
    v.deleted_at
  from public.vehicles v
  where
    (
      v.status = 'ACTIVE'::public.vehicle_status
      and v.deleted_at is null
    )
    or public.is_platform_admin()
    or public.is_school_admin(v.provider_id)
    or exists (
      select 1
      from public.providers p
      where p.id = v.provider_id
        and p.user_id = auth.uid()
    );
$$;


ALTER FUNCTION "public"."get_public_vehicle_catalog"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_school_instructor_compliance_summary"("p_school_id" "uuid") RETURNS TABLE("instructor_id" "uuid", "instructor_name" "text", "membership_id" "uuid", "membership_status" "public"."school_membership_status", "global_compliance_valid" boolean, "membership_compliance_valid" boolean, "overall_eligible" boolean, "valid_until" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_school_admin(p_school_id) AND NOT public.is_compliance_reviewer() THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;
  RETURN QUERY
  SELECT dss.user_id, u.name::TEXT, dss.id, dss.membership_status,
    public.is_instructor_global_compliance_valid(dss.user_id, NULL),
    public.is_membership_compliance_valid(dss.id, NULL),
    (dss.membership_status = 'ACTIVE' AND dss.is_active AND public.is_instructor_global_compliance_valid(dss.user_id, NULL)
      AND public.is_membership_compliance_valid(dss.id, NULL)),
    (SELECT MIN(d.expires_at) FROM public.compliance_documents d
     WHERE d.user_id = dss.user_id AND d.status = 'APPROVED' AND d.expires_at IS NOT NULL)
  FROM public.driving_school_staff dss JOIN public.users u ON u.id = dss.user_id
  WHERE dss.school_id = p_school_id;
END;
$$;


ALTER FUNCTION "public"."get_school_instructor_compliance_summary"("p_school_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- 1. Create public.users record
  INSERT INTO public.users (
    id,
    email,
    name,
    phone,
    role,
    status
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Novo Usuário'),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'STUDENT', -- ALWAYS strictly STUDENT for public self-service signup
    'ACTIVE'
  )
  ON CONFLICT (id) DO NOTHING;

  -- 2. Create user_roles record
  INSERT INTO public.user_roles (
    user_id,
    role
  ) VALUES (
    NEW.id,
    'STUDENT'
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_booking_participant"("p_booking_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    LEFT JOIN public.providers p ON p.id = b.provider_id
    WHERE b.id = p_booking_id
      AND auth.uid() IS NOT NULL
      AND public.is_current_user_active()
      AND (
        b.student_id = auth.uid()
        OR b.instructor_id = auth.uid()
        OR p.user_id = auth.uid()
        OR public.is_school_member(b.provider_id)
        OR public.is_platform_admin()
      )
  );
$$;


ALTER FUNCTION "public"."is_booking_participant"("p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_compliance_reviewer"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.current_user_has_permission(
      'admin.compliance.review'::public.app_permission
    );
$$;


ALTER FUNCTION "public"."is_compliance_reviewer"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_conversation_participant"("p_conversation_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = p_conversation_id
      AND public.is_booking_participant(c.booking_id)
  );
$$;


ALTER FUNCTION "public"."is_conversation_participant"("p_conversation_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_current_user_active"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND status = 'ACTIVE'
  );
$$;


ALTER FUNCTION "public"."is_current_user_active"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_instructor_global_compliance_valid"("p_user_id" "uuid", "p_category" "public"."vehicle_category" DEFAULT NULL::"public"."vehicle_category") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.providers legacy
    WHERE legacy.type='INSTRUCTOR' AND legacy.user_id=p_user_id AND legacy.status='ACTIVE'
      AND legacy.created_at < TIMESTAMPTZ '2026-08-21 21:30:00+00'
      AND NOT EXISTS (SELECT 1 FROM public.compliance_documents d WHERE d.provider_id=legacy.id)
  ) OR (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id=p_user_id AND u.status='ACTIVE' AND (u.role='INSTRUCTOR' OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=u.id AND ur.role='INSTRUCTOR')))
    AND NOT EXISTS (
      SELECT 1 FROM public.compliance_requirements r
      WHERE r.scope='USER_GLOBAL'::public.compliance_document_scope AND r.is_mandatory IS TRUE
        AND (p_category IS NULL OR r.category IS NULL OR r.category=p_category)
        AND (r.effective_from IS NULL OR r.effective_from<=NOW()) AND (r.effective_to IS NULL OR r.effective_to>=NOW())
        AND r.regulatory_status NOT IN ('SUPERSEDED','INACTIVE')
        AND NOT EXISTS (
          SELECT 1 FROM public.compliance_documents d
          WHERE d.scope='USER_GLOBAL'::public.compliance_document_scope AND d.user_id=p_user_id
            AND d.provider_id IS NULL AND d.membership_id IS NULL AND d.vehicle_id IS NULL
            AND d.document_type::TEXT IN ('CNH_EAR','CREDENTIAL_DETRAN','CREDENTIAL_DETRAN_SP','CRIMINAL_BACKGROUND')
            AND d.status='APPROVED' AND (d.expires_at IS NULL OR d.expires_at>NOW())
            AND (d.document_type::TEXT=r.document_type::TEXT OR (r.document_type::TEXT='CNH_EAR' AND d.document_type::TEXT='CNH') OR (r.document_type::TEXT='CREDENTIAL_DETRAN_SP' AND d.document_type::TEXT='CREDENTIAL_DETRAN'))
        )
    )
  );
$$;


ALTER FUNCTION "public"."is_instructor_global_compliance_valid"("p_user_id" "uuid", "p_category" "public"."vehicle_category") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_membership_compliance_valid"("p_membership_id" "uuid", "p_category" "public"."vehicle_category" DEFAULT NULL::"public"."vehicle_category") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.driving_school_staff dss
    WHERE dss.id = p_membership_id
      AND NOT EXISTS (
        SELECT 1 FROM public.compliance_requirements r
        WHERE r.scope = 'MEMBERSHIP'::public.compliance_document_scope
          AND r.is_mandatory IS TRUE
          AND (p_category IS NULL OR r.category IS NULL OR r.category = p_category)
          AND (r.effective_from IS NULL OR r.effective_from <= NOW())
          AND (r.effective_to IS NULL OR r.effective_to >= NOW())
          AND r.regulatory_status NOT IN ('SUPERSEDED', 'INACTIVE')
          AND NOT EXISTS (
            SELECT 1 FROM public.compliance_documents d
            WHERE d.membership_id = p_membership_id
              AND d.scope = 'MEMBERSHIP'::public.compliance_document_scope
              AND d.document_type::TEXT = r.document_type
              AND d.status = 'APPROVED'
              AND (d.expires_at IS NULL OR d.expires_at > NOW())
          )
      )
  );
$$;


ALTER FUNCTION "public"."is_membership_compliance_valid"("p_membership_id" "uuid", "p_category" "public"."vehicle_category") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_offering_slot_available"("p_offering_id" "uuid", "p_scheduled_start_at" timestamp with time zone) RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  o public.service_offerings%ROWTYPE;
  p public.providers%ROWTYPE;
  v public.vehicles%ROWTYPE;
  e TIMESTAMPTZ;
  local_start TIMESTAMP;
  local_end TIMESTAMP;
  dow INTEGER;
BEGIN
  SELECT * INTO o FROM public.service_offerings WHERE id = p_offering_id;
  IF NOT FOUND OR o.status <> 'ACTIVE' OR o.is_active IS NOT TRUE OR o.instructor_id IS NULL THEN RETURN FALSE; END IF;
  SELECT * INTO p FROM public.providers WHERE id = o.provider_id;
  IF NOT FOUND OR p.status <> 'ACTIVE' OR NOT public.is_provider_instructor_eligible(o.provider_id, o.instructor_id, o.category) THEN RETURN FALSE; END IF;
  SELECT * INTO v FROM public.vehicles WHERE id = o.vehicle_id;
  IF NOT FOUND OR v.status <> 'ACTIVE' OR v.deleted_at IS NOT NULL OR v.provider_id <> o.provider_id THEN RETURN FALSE; END IF;
  IF p_scheduled_start_at IS NULL OR p_scheduled_start_at <= NOW() THEN RETURN FALSE; END IF;
  local_start := p_scheduled_start_at AT TIME ZONE 'America/Sao_Paulo';
  IF EXTRACT(MINUTE FROM local_start) <> 0 OR EXTRACT(SECOND FROM local_start) <> 0 THEN RETURN FALSE; END IF;
  e := p_scheduled_start_at + make_interval(mins => o.duration_minutes);

  IF EXISTS (SELECT 1 FROM public.instructor_global_blocks b WHERE b.instructor_id = o.instructor_id AND b.start_at < e AND b.end_at > p_scheduled_start_at) THEN RETURN FALSE; END IF;
  IF EXISTS (SELECT 1 FROM public.availability_exceptions x WHERE x.provider_id = o.provider_id AND x.type = 'BLOCK' AND x.is_active IS TRUE AND (x.instructor_id IS NULL OR x.instructor_id = o.instructor_id) AND (x.vehicle_id IS NULL OR x.vehicle_id = o.vehicle_id) AND x.start_at < e AND x.end_at > p_scheduled_start_at) THEN RETURN FALSE; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.availability_exceptions x WHERE x.provider_id = o.provider_id AND x.type = 'AVAILABLE_OVERRIDE' AND x.is_active IS TRUE AND (x.instructor_id IS NULL OR x.instructor_id = o.instructor_id) AND (x.vehicle_id IS NULL OR x.vehicle_id = o.vehicle_id) AND x.start_at <= p_scheduled_start_at AND x.end_at >= e) THEN
    local_end := e AT TIME ZONE 'America/Sao_Paulo';
    dow := EXTRACT(ISODOW FROM local_start)::INTEGER;
    IF NOT EXISTS (SELECT 1 FROM public.availabilities a WHERE a.provider_id = o.provider_id AND a.is_active IS TRUE AND (a.instructor_id IS NULL OR a.instructor_id = o.instructor_id) AND (a.vehicle_id IS NULL OR a.vehicle_id = o.vehicle_id) AND a.day_of_week IN (dow, dow % 7) AND a.start_time <= local_start::TIME AND a.end_time >= local_end::TIME) THEN RETURN FALSE; END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.bookings b WHERE b.instructor_id = o.instructor_id AND b.status IN ('CONFIRMED','IN_PROGRESS') AND b.slot_range && tstzrange(p_scheduled_start_at, e, '[)')) THEN RETURN FALSE; END IF;
  IF EXISTS (SELECT 1 FROM public.bookings b WHERE b.instructor_id = o.instructor_id AND b.status = 'PENDING_PAYMENT' AND (b.hold_expires_at IS NULL OR b.hold_expires_at > NOW()) AND b.slot_range && tstzrange(p_scheduled_start_at, e, '[)')) THEN RETURN FALSE; END IF;
  IF EXISTS (SELECT 1 FROM public.bookings b WHERE b.vehicle_id = o.vehicle_id AND b.status IN ('CONFIRMED','IN_PROGRESS') AND b.slot_range && tstzrange(p_scheduled_start_at, e, '[)')) THEN RETURN FALSE; END IF;
  IF EXISTS (SELECT 1 FROM public.bookings b WHERE b.vehicle_id = o.vehicle_id AND b.status = 'PENDING_PAYMENT' AND (b.hold_expires_at IS NULL OR b.hold_expires_at > NOW()) AND b.slot_range && tstzrange(p_scheduled_start_at, e, '[)')) THEN RETURN FALSE; END IF;
  RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."is_offering_slot_available"("p_offering_id" "uuid", "p_scheduled_start_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_platform_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.users u ON u.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND ur.role = 'PLATFORM_ADMIN'
      AND u.status = 'ACTIVE'
  );
$$;


ALTER FUNCTION "public"."is_platform_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_provider_instructor_eligible"("p_provider_id" "uuid", "p_instructor_id" "uuid", "p_category" "public"."vehicle_category" DEFAULT NULL::"public"."vehicle_category") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.providers p
    JOIN public.users u ON u.id = p_instructor_id AND u.status = 'ACTIVE'
    WHERE p.id = p_provider_id
      AND p.status = 'ACTIVE'
      AND (u.role = 'INSTRUCTOR' OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = u.id AND ur.role = 'INSTRUCTOR'
      ))
      AND public.is_instructor_global_compliance_valid(p_instructor_id, p_category)
      AND (
        (p.type = 'INSTRUCTOR' AND p.user_id = p_instructor_id)
        OR
        (p.type = 'DRIVING_SCHOOL' AND EXISTS (
          SELECT 1 FROM public.driving_school_staff dss
          WHERE dss.school_id = p.id
            AND dss.user_id = p_instructor_id
            AND dss.role = 'INSTRUCTOR'
            AND dss.membership_status = 'ACTIVE'
            AND dss.is_active IS TRUE
            AND public.is_membership_compliance_valid(dss.id, p_category)
        ))
      )
  );
$$;


ALTER FUNCTION "public"."is_provider_instructor_eligible"("p_provider_id" "uuid", "p_instructor_id" "uuid", "p_category" "public"."vehicle_category") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_provider_owner"("target_provider_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.id = target_provider_id
      AND p.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.driving_school_staff dss
    WHERE dss.school_id = target_provider_id
      AND dss.user_id = auth.uid()
      AND dss.role = 'SCHOOL_ADMIN'
      AND dss.is_active = TRUE
  );
$$;


ALTER FUNCTION "public"."is_provider_owner"("target_provider_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_school_admin"("target_school_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.driving_school_staff
    WHERE school_id = target_school_id
      AND user_id = auth.uid()
      AND role = 'SCHOOL_ADMIN'
      AND is_active = TRUE
  );
$$;


ALTER FUNCTION "public"."is_school_admin"("target_school_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_school_member"("target_school_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.driving_school_staff
    WHERE school_id = target_school_id
      AND user_id = auth.uid()
      AND is_active = TRUE
  );
$$;


ALTER FUNCTION "public"."is_school_member"("target_school_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compliance_documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid",
    "user_id" "uuid",
    "vehicle_id" "uuid",
    "document_type" "public"."compliance_doc_type" NOT NULL,
    "storage_path" character varying(500) NOT NULL,
    "status" "public"."compliance_status" DEFAULT 'PENDING'::"public"."compliance_status" NOT NULL,
    "rejection_reason" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scope" "public"."compliance_document_scope" NOT NULL,
    "membership_id" "uuid",
    CONSTRAINT "compliance_documents_membership_user_fk_check" CHECK ((("membership_id" IS NULL) OR ("user_id" IS NOT NULL))),
    CONSTRAINT "compliance_documents_scope_shape_check" CHECK (((("scope" = 'USER_GLOBAL'::"public"."compliance_document_scope") AND ("user_id" IS NOT NULL) AND ("provider_id" IS NULL) AND ("membership_id" IS NULL) AND ("vehicle_id" IS NULL)) OR (("scope" = 'PROVIDER'::"public"."compliance_document_scope") AND ("provider_id" IS NOT NULL) AND ("membership_id" IS NULL) AND ("vehicle_id" IS NULL)) OR (("scope" = 'MEMBERSHIP'::"public"."compliance_document_scope") AND ("membership_id" IS NOT NULL) AND ("user_id" IS NOT NULL) AND ("provider_id" IS NULL) AND ("vehicle_id" IS NULL)) OR (("scope" = 'VEHICLE'::"public"."compliance_document_scope") AND ("provider_id" IS NOT NULL) AND ("vehicle_id" IS NOT NULL) AND ("membership_id" IS NULL))))
);


ALTER TABLE "public"."compliance_documents" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_my_global_compliance"() RETURNS SETOF "public"."compliance_documents"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  RETURN QUERY SELECT d.* FROM public.compliance_documents d
  WHERE d.scope = 'USER_GLOBAL'::public.compliance_document_scope
    AND d.user_id = auth.uid()
  ORDER BY d.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."list_my_global_compliance"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driving_school_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "target_user_id" "uuid",
    "invited_name" character varying(255),
    "invited_email" character varying(255),
    "invited_phone" character varying(50),
    "role" "public"."user_role" DEFAULT 'INSTRUCTOR'::"public"."user_role" NOT NULL,
    "status" "public"."school_invitation_status" DEFAULT 'PENDING'::"public"."school_invitation_status" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "accepted_at" timestamp with time zone,
    "declined_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "driving_school_invitations_role_check" CHECK (("role" = 'INSTRUCTOR'::"public"."user_role")),
    CONSTRAINT "driving_school_invitations_target_check" CHECK ((("target_user_id" IS NOT NULL) OR (NULLIF("btrim"(("invited_email")::"text"), ''::"text") IS NOT NULL)))
);


ALTER TABLE "public"."driving_school_invitations" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_my_school_invitations"() RETURNS SETOF "public"."driving_school_invitations"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT i.* FROM public.driving_school_invitations i
  JOIN public.users u ON u.id = auth.uid()
  WHERE auth.uid() IS NOT NULL
    AND i.status = 'PENDING'
    AND (i.target_user_id = auth.uid() OR (i.target_user_id IS NULL AND LOWER(BTRIM(i.invited_email)) = LOWER(BTRIM(u.email))))
  ORDER BY i.created_at DESC;
$$;


ALTER FUNCTION "public"."list_my_school_invitations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_school_instructor_invitations"("p_school_id" "uuid") RETURNS SETOF "public"."driving_school_invitations"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_school_admin(p_school_id) AND NOT public.is_compliance_reviewer() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN QUERY SELECT i.* FROM public.driving_school_invitations i
  WHERE i.school_id=p_school_id ORDER BY i.created_at DESC;
END;
$$;


ALTER FUNCTION "public"."list_school_instructor_invitations"("p_school_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_school_memberships"("p_school_id" "uuid") RETURNS TABLE("membership_id" "uuid", "user_id" "uuid", "instructor_name" "text", "instructor_email" "text", "membership_status" "public"."school_membership_status", "is_active" boolean, "accepted_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_school_admin(p_school_id) AND NOT public.is_compliance_reviewer() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  RETURN QUERY SELECT d.id,d.user_id,u.name::TEXT,u.email::TEXT,d.membership_status,d.is_active,d.accepted_at
  FROM public.driving_school_staff d JOIN public.users u ON u.id=d.user_id WHERE d.school_id=p_school_id ORDER BY u.name;
END;
$$;


ALTER FUNCTION "public"."list_school_memberships"("p_school_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."mark_booking_payment_failed"("p_payment_id" "uuid", "p_reason" character varying DEFAULT NULL::character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID;
  v_payment RECORD;
  v_booking RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. Auth
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED' USING ERRCODE = '28000';
  END IF;

  -- 2. Lock payment
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Booking ownership (via booking.student_id)
  SELECT * INTO v_booking FROM public.bookings WHERE id = v_payment.booking_id;
  IF NOT FOUND OR v_booking.student_id <> v_uid THEN
    RAISE EXCEPTION 'CROSS_STUDENT_PAYMENT_ACCESS_DENIED' USING ERRCODE = '42501';
  END IF;

  -- 4. Gateway whitelist
  IF v_payment.gateway_provider <> 'fake_payment_gateway' THEN
    RAISE EXCEPTION 'REAL_PAYMENT_GATEWAY_CONFIRMATION_REQUIRES_TRUSTED_BACKEND' USING ERRCODE = '42501';
  END IF;

  -- 5. Only PENDING/AUTHORIZED can be failed
  IF v_payment.status NOT IN ('PENDING', 'AUTHORIZED') THEN
    RAISE EXCEPTION 'PAYMENT_NOT_IN_FAILURABLE_STATE' USING ERRCODE = '22000';
  END IF;

  -- 6. Mark as FAILED
  UPDATE public.payments
  SET status = 'FAILED',
      metadata = COALESCE(metadata, '{}') || jsonb_build_object('failureReason', p_reason),
      updated_at = v_now
  WHERE id = p_payment_id;

  -- 7. Keep booking as PENDING_PAYMENT (allow retry while hold is valid)
  -- Note: booking stays PENDING_PAYMENT, not terminal

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'status', 'FAILED',
    'booking_id', v_payment.booking_id,
    'booking_status', v_booking.status
  );
END;
$$;


ALTER FUNCTION "public"."mark_booking_payment_failed"("p_payment_id" "uuid", "p_reason" character varying) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_booking_snapshot_names"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_instructor_name TEXT;
  v_provider_name TEXT;
  v_vehicle_name TEXT;
  v_meeting_point TEXT;
BEGIN
  SELECT u.name INTO v_instructor_name FROM public.users u WHERE u.id = NEW.instructor_id;
  SELECT p.trade_name, COALESCE(p.neighborhood, p.city) INTO v_provider_name, v_meeting_point
    FROM public.providers p WHERE p.id = NEW.provider_id;
  SELECT CONCAT(v.brand, ' ', v.model) INTO v_vehicle_name FROM public.vehicles v WHERE v.id = NEW.vehicle_id;
  NEW.snapshot_data := jsonb_set(COALESCE(NEW.snapshot_data, '{}'::JSONB), '{instructorName}', TO_JSONB(COALESCE(v_instructor_name, '')) , TRUE);
  NEW.snapshot_data := jsonb_set(NEW.snapshot_data, '{providerName}', TO_JSONB(COALESCE(v_provider_name, '')), TRUE);
  NEW.snapshot_data := jsonb_set(NEW.snapshot_data, '{vehicleName}', TO_JSONB(COALESCE(v_vehicle_name, '')), TRUE);
  NEW.snapshot_data := jsonb_set(NEW.snapshot_data, '{meetingPoint}', TO_JSONB(COALESCE(v_meeting_point, '')), TRUE);
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."normalize_booking_snapshot_names"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."onboard_my_instructor"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_user public.users%ROWTYPE;
  v_provider public.providers%ROWTYPE;
  v_role_added BOOLEAN := FALSE;
  v_role_inserted_count INTEGER := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_user
  FROM public.users
  WHERE id = v_uid
  FOR UPDATE;

  IF NOT FOUND OR v_user.status <> 'ACTIVE'::public.user_status THEN
    RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE = '42501';
  END IF;
  IF v_user.cpf IS NULL OR NOT public.validate_cpf(v_user.cpf) THEN
    RAISE EXCEPTION 'CPF_REQUIRED_OR_INVALID' USING ERRCODE = '22023';
  END IF;
  IF v_user.birth_date IS NULL OR v_user.birth_date > (CURRENT_DATE - INTERVAL '18 years') THEN
    RAISE EXCEPTION 'MINIMUM_AGE_VIOLATION' USING ERRCODE = '22023';
  END IF;
  IF NULLIF(BTRIM(v_user.phone), '') IS NULL THEN
    RAISE EXCEPTION 'PHONE_REQUIRED' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_roles(user_id, role, granted_by)
  VALUES (v_uid, 'INSTRUCTOR'::public.user_role, v_uid)
  ON CONFLICT (user_id, role) DO NOTHING;
  GET DIAGNOSTICS v_role_inserted_count = ROW_COUNT;
  v_role_added := v_role_inserted_count > 0;

  SELECT * INTO v_provider
  FROM public.providers
  WHERE user_id = v_uid AND type = 'INSTRUCTOR'::public.provider_type
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.providers (
      user_id, type, legal_name, trade_name, document_number, status,
      phone, city, state
    ) VALUES (
      v_uid, 'INSTRUCTOR'::public.provider_type, v_user.name, v_user.name,
      v_user.cpf, 'DRAFT'::public.provider_status, v_user.phone, 'São Paulo', 'SP'
    )
    RETURNING * INTO v_provider;
  END IF;

  INSERT INTO public.audit_logs (
    actor_id, action, entity_type, entity_id, previous_value, new_value
  ) VALUES (
    v_uid, 'INSTRUCTOR_ONBOARDING_COMPLETED', 'USER', v_uid::TEXT,
    jsonb_build_object('instructor_role', FALSE),
    jsonb_build_object('instructor_role', TRUE, 'provider_id', v_provider.id, 'provider_status', v_provider.status)
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'role', 'INSTRUCTOR',
    'role_added', v_role_added,
    'provider_id', v_provider.id,
    'provider_status', v_provider.status
  );
END;
$$;


ALTER FUNCTION "public"."onboard_my_instructor"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_booking_during_instructor_global_block"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS') THEN
    PERFORM pg_advisory_xact_lock(
      hashtextextended('instructor-schedule:' || NEW.instructor_id::text, 0)
    );

    IF EXISTS (
      SELECT 1
      FROM public.instructor_global_blocks b
      WHERE b.instructor_id = NEW.instructor_id
        AND b.start_at < NEW.scheduled_end_at
        AND NEW.scheduled_start_at < b.end_at
    ) THEN
      RAISE EXCEPTION 'SLOT_NO_LONGER_AVAILABLE' USING ERRCODE = '23P01';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_booking_during_instructor_global_block"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."provider_accept_mazzi_terms"("p_provider_id" "uuid", "p_terms_version" "text") RETURNS "public"."compliance_documents"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE v_doc public.compliance_documents; v_path TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='42501'; END IF;
  IF NOT public.is_provider_owner(p_provider_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_terms_version IS NULL OR p_terms_version !~ '^[A-Za-z0-9._-]+$' THEN RAISE EXCEPTION 'INVALID_TERMS_VERSION' USING ERRCODE='22023'; END IF;
  v_path := 'acceptance://mazzi-ethics/' || p_terms_version;
  SELECT * INTO v_doc FROM public.compliance_documents
  WHERE provider_id=p_provider_id AND user_id=auth.uid() AND scope='PROVIDER'
    AND document_type='MAZZI_TERMS_ACCEPTANCE' AND storage_path=v_path
  ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN v_doc; END IF;
  INSERT INTO public.compliance_documents (provider_id,user_id,vehicle_id,membership_id,scope,document_type,storage_path,status)
  VALUES (p_provider_id,auth.uid(),NULL,NULL,'PROVIDER','MAZZI_TERMS_ACCEPTANCE',v_path,'APPROVED')
  RETURNING * INTO v_doc;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,new_value,severity,created_at)
  VALUES (auth.uid(),'MAZZI_TERMS_ACCEPTED','COMPLIANCE_DOCUMENTS',v_doc.id,
    jsonb_build_object('provider_id',p_provider_id,'document_type','MAZZI_TERMS_ACCEPTANCE','terms_version',p_terms_version,'scope','PROVIDER'),'INFO',NOW());
  RETURN v_doc;
END;
$_$;


ALTER FUNCTION "public"."provider_accept_mazzi_terms"("p_provider_id" "uuid", "p_terms_version" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."provider_check_in_booking"("p_booking_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking RECORD;
  v_provider_user_id UUID;
  v_is_authorized BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED: Usuário não autenticado.' USING ERRCODE = '40100'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = '40401'; END IF;
  IF v_booking.instructor_id = v_uid THEN v_is_authorized := TRUE;
  ELSE
    SELECT user_id INTO v_provider_user_id FROM public.providers WHERE id = v_booking.provider_id;
    IF v_provider_user_id = v_uid THEN v_is_authorized := TRUE;
    ELSE
      SELECT EXISTS (SELECT 1 FROM public.driving_school_staff WHERE school_id = v_booking.provider_id AND user_id = v_uid AND role::TEXT IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL') AND is_active = TRUE) INTO v_is_authorized;
    END IF;
  END IF;
  IF NOT v_is_authorized THEN RAISE EXCEPTION 'UNAUTHORIZED_PROVIDER: Acesso negado.' USING ERRCODE = '40302'; END IF;
  IF v_booking.checkin_instructor_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'is_idempotent', true, 'booking_id', p_booking_id, 'status', v_booking.status::TEXT, 'checkin_instructor_at', v_booking.checkin_instructor_at, 'message', 'Check-in já realizado anteriormente.');
  END IF;
  IF v_booking.status::TEXT NOT IN ('CONFIRMED', 'IN_PROGRESS') THEN RAISE EXCEPTION 'INVALID_STATUS: Novo check-in só é permitido para aulas operacionais.' USING ERRCODE = '42200'; END IF;
  IF v_now < v_booking.scheduled_start_at - INTERVAL '30 minutes' THEN RAISE EXCEPTION 'CHECKIN_WINDOW_NOT_OPEN: O check-in só pode ser feito a partir de 30 minutos antes do início da aula.' USING ERRCODE = '42204'; END IF;
  UPDATE public.bookings SET checkin_instructor_at = v_now, updated_at = v_now WHERE id = p_booking_id;
  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at, ip_address)
  VALUES (gen_random_uuid(), v_uid, 'PROVIDER_CHECKIN_BOOKING', 'Booking', p_booking_id, jsonb_build_object('checkin_instructor_at', NULL), jsonb_build_object('checkin_instructor_at', v_now), v_now, NULL);
  RETURN jsonb_build_object('success', true, 'is_idempotent', false, 'booking_id', p_booking_id, 'status', v_booking.status::TEXT, 'checkin_instructor_at', v_now);
END;
$$;


ALTER FUNCTION "public"."provider_check_in_booking"("p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."provider_complete_lesson"("p_booking_id" "uuid", "p_idempotency_key" character varying DEFAULT NULL::character varying) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking RECORD;
  v_provider_user_id UUID;
  v_is_authorized BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
  v_effective_key VARCHAR;
BEGIN
  -- 1. Authenticate caller
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHENTICATED: Usuário não autenticado.' USING ERRCODE = '40100';
  END IF;

  v_effective_key := NULLIF(TRIM(p_idempotency_key), '');

  -- 2. Lock booking for update
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = '40401';
  END IF;

  -- 3. Authorization check
  IF v_booking.instructor_id = v_uid THEN
    v_is_authorized := TRUE;
  ELSE
    SELECT user_id INTO v_provider_user_id FROM public.providers WHERE id = v_booking.provider_id;
    IF v_provider_user_id = v_uid THEN
      v_is_authorized := TRUE;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.driving_school_staff
        WHERE school_id = v_booking.provider_id
          AND user_id = v_uid
          AND role::TEXT IN ('SCHOOL_ADMIN', 'DRIVING_SCHOOL')
          AND is_active = TRUE
      ) INTO v_is_authorized;
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'UNAUTHORIZED_PROVIDER: Acesso negado. Você não é o instrutor nem o responsável por este agendamento.' USING ERRCODE = '40302';
  END IF;

  -- 4. Idempotency check for already COMPLETED booking
  IF v_booking.status::TEXT = 'COMPLETED' THEN
    -- Check if effective key is distinct from persisted key
    IF v_booking.completion_idempotency_key IS DISTINCT FROM v_effective_key THEN
      RAISE EXCEPTION 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST: A chave de idempotência informada diverge da utilizada na conclusão deste agendamento.' USING ERRCODE = '23505';
    END IF;

    RETURN jsonb_build_object(
      'success', true,
      'is_idempotent', true,
      'booking_id', p_booking_id,
      'status', 'COMPLETED',
      'completed_at', v_booking.completed_at,
      'lesson_finished_at', v_booking.lesson_finished_at,
      'message', 'Aula já concluída.'
    );
  END IF;

  -- 5. Status whitelist check: MUST BE IN_PROGRESS
  IF v_booking.status::TEXT <> 'IN_PROGRESS' THEN
    RAISE EXCEPTION 'INVALID_STATUS: Somente aulas em andamento (IN_PROGRESS) podem ser concluídas.' USING ERRCODE = '42200';
  END IF;

  -- 6. Mandatory Idempotency Key check for new completion
  IF v_effective_key IS NULL THEN
    RAISE EXCEPTION 'COMPLETION_IDEMPOTENCY_KEY_REQUIRED: A chave de idempotência é obrigatória para concluir a aula.' USING ERRCODE = '42200';
  END IF;

  -- 7. Execute completion transition and persist completion idempotency key
  UPDATE public.bookings
  SET status = 'COMPLETED',
      completed_at = COALESCE(completed_at, v_now),
      lesson_finished_at = COALESCE(lesson_finished_at, v_now),
      completion_idempotency_key = v_effective_key,
      updated_at = v_now
  WHERE id = p_booking_id;

  -- 8. Audit Log
  INSERT INTO public.audit_logs (
    id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at, ip_address
  ) VALUES (
    gen_random_uuid(), v_uid, 'PROVIDER_COMPLETE_LESSON', 'Booking', p_booking_id,
    jsonb_build_object('status', 'IN_PROGRESS'),
    jsonb_build_object('status', 'COMPLETED', 'completed_at', v_now, 'lesson_finished_at', v_now, 'completion_idempotency_key', v_effective_key),
    v_now, NULL
  );

  RETURN jsonb_build_object(
    'success', true,
    'is_idempotent', false,
    'booking_id', p_booking_id,
    'status', 'COMPLETED',
    'completed_at', v_now,
    'lesson_finished_at', v_now
  );
END;
$$;


ALTER FUNCTION "public"."provider_complete_lesson"("p_booking_id" "uuid", "p_idempotency_key" character varying) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vehicles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "brand" character varying(100) NOT NULL,
    "model" character varying(100) NOT NULL,
    "year" integer NOT NULL,
    "license_plate" character varying(20) NOT NULL,
    "license_plate_masked" character varying(20) NOT NULL,
    "renavam" character varying(30),
    "category" "public"."vehicle_category" NOT NULL,
    "transmission" "public"."vehicle_transmission" NOT NULL,
    "has_dual_pedal" boolean DEFAULT true NOT NULL,
    "has_dashcam" boolean DEFAULT false NOT NULL,
    "status" "public"."vehicle_status" DEFAULT 'PENDING'::"public"."vehicle_status" NOT NULL,
    "photos" "text"[] DEFAULT ARRAY[]::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "vehicle_type" "public"."vehicle_type" DEFAULT 'CAR'::"public"."vehicle_type" NOT NULL,
    "color" character varying(50),
    "description" "text",
    CONSTRAINT "chk_car_transmission_required" CHECK (((("vehicle_type" = 'CAR'::"public"."vehicle_type") AND ("transmission" = ANY (ARRAY['MANUAL'::"public"."vehicle_transmission", 'AUTOMATIC'::"public"."vehicle_transmission"]))) OR ("vehicle_type" = 'MOTORCYCLE'::"public"."vehicle_type"))),
    CONSTRAINT "chk_vehicle_category_type_consistency" CHECK (((("category" = 'A'::"public"."vehicle_category") AND ("vehicle_type" = 'MOTORCYCLE'::"public"."vehicle_type")) OR (("category" = 'B'::"public"."vehicle_category") AND ("vehicle_type" = 'CAR'::"public"."vehicle_type")) OR ("category" <> ALL (ARRAY['A'::"public"."vehicle_category", 'B'::"public"."vehicle_category"]))))
);


ALTER TABLE "public"."vehicles" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."provider_deactivate_vehicle"("p_vehicle_id" "uuid") RETURNS "public"."vehicles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v public.vehicles;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_user_active() THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  SELECT * INTO v FROM public.vehicles WHERE id=p_vehicle_id FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.providers p WHERE p.id=v.provider_id AND p.user_id=auth.uid()) THEN
    RAISE EXCEPTION 'VEHICLE_ACCESS_DENIED' USING ERRCODE='42501';
  END IF;
  IF v.status <> 'ACTIVE' THEN RAISE EXCEPTION 'VEHICLE_DEACTIVATION_INVALID' USING ERRCODE='22023'; END IF;
  UPDATE public.vehicles SET status='INACTIVE', updated_at=now() WHERE id=p_vehicle_id RETURNING * INTO v;
  RETURN v;
END;
$$;


ALTER FUNCTION "public"."provider_deactivate_vehicle"("p_vehicle_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."provider_delete_availability_exception"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_exception public.availability_exceptions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_exception FROM public.availability_exceptions WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AVAILABILITY_EXCEPTION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.can_manage_provider_schedule(v_exception.provider_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('provider-schedule:' || v_exception.provider_id::TEXT, 0));
  IF v_exception.end_at <= NOW() THEN RAISE EXCEPTION 'AVAILABILITY_EXCEPTION_HISTORY_PROTECTED' USING ERRCODE = 'P0001'; END IF;
  DELETE FROM public.availability_exceptions WHERE id=p_id;
END;
$$;


ALTER FUNCTION "public"."provider_delete_availability_exception"("p_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."provider_delete_availability_rule"("p_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_provider_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'INACTIVE_USER' USING ERRCODE='42501'; END IF;
  SELECT provider_id INTO v_provider_id FROM public.availabilities WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'AVAILABILITY_NOT_FOUND' USING ERRCODE='P0002'; END IF;
  IF NOT public.can_manage_provider_schedule(v_provider_id) THEN
    RAISE EXCEPTION 'AVAILABILITY_PROVIDER_ACCESS_DENIED' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('provider-schedule:' || v_provider_id::text, 0));
  DELETE FROM public.availabilities WHERE id=p_id AND provider_id=v_provider_id;
END;
$$;


ALTER FUNCTION "public"."provider_delete_availability_rule"("p_id" "uuid") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."availability_exceptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "instructor_id" "uuid",
    "vehicle_id" "uuid",
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone NOT NULL,
    "reason" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" character varying(30) DEFAULT 'BLOCK'::character varying NOT NULL,
    "reason_category" character varying(50) DEFAULT 'OTHER'::character varying NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "availability_exceptions_check" CHECK (("start_at" < "end_at")),
    CONSTRAINT "availability_exceptions_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['BLOCK'::character varying, 'AVAILABLE_OVERRIDE'::character varying])::"text"[])))
);


ALTER TABLE "public"."availability_exceptions" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."provider_save_availability_exception"("p_id" "uuid", "p_provider_id" "uuid", "p_instructor_id" "uuid", "p_vehicle_id" "uuid", "p_type" character varying, "p_reason_category" character varying, "p_reason" character varying, "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_is_active" boolean DEFAULT true) RETURNS SETOF "public"."availability_exceptions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_existing public.availability_exceptions%ROWTYPE;
  v_saved public.availability_exceptions%ROWTYPE;
  v_provider_id UUID := p_provider_id;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  IF p_start_at IS NULL OR p_end_at IS NULL OR p_end_at <= p_start_at THEN RAISE EXCEPTION 'INVALID_AVAILABILITY_EXCEPTION_RANGE' USING ERRCODE = '22023'; END IF;
  IF p_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.availability_exceptions WHERE id = p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'AVAILABILITY_EXCEPTION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
    IF v_existing.provider_id IS DISTINCT FROM p_provider_id THEN RAISE EXCEPTION 'PROVIDER_SCOPE_MISMATCH' USING ERRCODE = '42501'; END IF;
    v_provider_id := v_existing.provider_id;
  END IF;
  IF NOT public.can_manage_provider_schedule(v_provider_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('provider-schedule:' || v_provider_id::TEXT, 0));
  IF p_type = 'BLOCK' AND COALESCE(p_is_active, TRUE) THEN
    IF EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.provider_id = v_provider_id
        AND b.status IN ('CONFIRMED','IN_PROGRESS')
        AND b.scheduled_start_at < p_end_at AND p_start_at < b.scheduled_end_at
        AND (p_instructor_id IS NULL OR b.instructor_id = p_instructor_id)
        AND (p_vehicle_id IS NULL OR b.vehicle_id = p_vehicle_id)
    ) OR EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.provider_id = v_provider_id AND b.status = 'PENDING_PAYMENT'
        AND (b.hold_expires_at IS NULL OR b.hold_expires_at > NOW())
        AND b.scheduled_start_at < p_end_at AND p_start_at < b.scheduled_end_at
        AND (p_instructor_id IS NULL OR b.instructor_id = p_instructor_id)
        AND (p_vehicle_id IS NULL OR b.vehicle_id = p_vehicle_id)
    ) THEN
      RAISE EXCEPTION 'AVAILABILITY_BLOCK_BOOKING_CONFLICT' USING ERRCODE = '23P01';
    END IF;
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.availability_exceptions (provider_id,instructor_id,vehicle_id,type,reason_category,reason,start_at,end_at,is_active)
    VALUES (p_provider_id,p_instructor_id,p_vehicle_id,p_type,p_reason_category,p_reason,p_start_at,p_end_at,COALESCE(p_is_active,TRUE))
    RETURNING * INTO v_saved;
  ELSE
    UPDATE public.availability_exceptions SET instructor_id=p_instructor_id, vehicle_id=p_vehicle_id,
      type=p_type, reason_category=p_reason_category, reason=p_reason, start_at=p_start_at, end_at=p_end_at,
      is_active=COALESCE(p_is_active,TRUE), updated_at=NOW()
    WHERE id=p_id RETURNING * INTO v_saved;
  END IF;
  RETURN NEXT v_saved;
END;
$$;


ALTER FUNCTION "public"."provider_save_availability_exception"("p_id" "uuid", "p_provider_id" "uuid", "p_instructor_id" "uuid", "p_vehicle_id" "uuid", "p_type" character varying, "p_reason_category" character varying, "p_reason" character varying, "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_is_active" boolean) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."availabilities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "instructor_id" "uuid",
    "vehicle_id" "uuid",
    "day_of_week" integer NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "timezone" character varying(50) DEFAULT 'America/Sao_Paulo'::character varying NOT NULL,
    "effective_from" "date",
    "effective_to" "date",
    CONSTRAINT "availabilities_check" CHECK (("start_time" < "end_time")),
    CONSTRAINT "availabilities_day_of_week_check" CHECK ((("day_of_week" >= 0) AND ("day_of_week" <= 6))),
    CONSTRAINT "availabilities_full_hour_times_ck" CHECK (((EXTRACT(minute FROM "start_time") = (0)::numeric) AND (EXTRACT(second FROM "start_time") = (0)::numeric) AND (EXTRACT(minute FROM "end_time") = (0)::numeric) AND (EXTRACT(second FROM "end_time") = (0)::numeric)))
);


ALTER TABLE "public"."availabilities" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."provider_save_availability_rule"("p_id" "uuid" DEFAULT NULL::"uuid", "p_provider_id" "uuid" DEFAULT NULL::"uuid", "p_instructor_id" "uuid" DEFAULT NULL::"uuid", "p_vehicle_id" "uuid" DEFAULT NULL::"uuid", "p_day_of_week" integer DEFAULT NULL::integer, "p_start_time" time without time zone DEFAULT NULL::time without time zone, "p_end_time" time without time zone DEFAULT NULL::time without time zone, "p_timezone" "text" DEFAULT 'America/Sao_Paulo'::"text", "p_is_active" boolean DEFAULT true) RETURNS "public"."availabilities"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v public.availabilities;
  v_provider_id uuid := p_provider_id;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='28000'; END IF;
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'INACTIVE_USER' USING ERRCODE='42501'; END IF;
  IF v_provider_id IS NULL OR NOT public.can_manage_provider_schedule(v_provider_id) THEN
    RAISE EXCEPTION 'AVAILABILITY_PROVIDER_ACCESS_DENIED' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('provider-schedule:' || v_provider_id::text, 0));
  IF p_id IS NOT NULL THEN
    SELECT * INTO v FROM public.availabilities WHERE id=p_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'AVAILABILITY_NOT_FOUND' USING ERRCODE='P0002'; END IF;
    IF v.provider_id IS DISTINCT FROM v_provider_id THEN
      RAISE EXCEPTION 'AVAILABILITY_PROVIDER_IMMUTABLE' USING ERRCODE='42501';
    END IF;
  END IF;
  IF p_day_of_week IS NULL OR p_day_of_week < 0 OR p_day_of_week > 6 THEN
    RAISE EXCEPTION 'AVAILABILITY_DAY_INVALID' USING ERRCODE='22023';
  END IF;
  IF p_start_time IS NULL OR p_end_time IS NULL
     OR extract(minute from p_start_time) <> 0 OR extract(second from p_start_time) <> 0
     OR extract(minute from p_end_time) <> 0 OR extract(second from p_end_time) <> 0 THEN
    RAISE EXCEPTION 'AVAILABILITY_FULL_HOUR_REQUIRED' USING ERRCODE='22023';
  END IF;
  IF p_start_time >= p_end_time THEN
    RAISE EXCEPTION 'AVAILABILITY_TIME_RANGE_INVALID' USING ERRCODE='22023';
  END IF;
  IF p_timezone IS NULL OR NOT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name=p_timezone) THEN
    RAISE EXCEPTION 'AVAILABILITY_TIMEZONE_INVALID' USING ERRCODE='22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.availabilities a
    WHERE a.provider_id=v_provider_id
      AND a.id IS DISTINCT FROM p_id
      AND a.instructor_id IS NOT DISTINCT FROM p_instructor_id
      AND a.vehicle_id IS NOT DISTINCT FROM p_vehicle_id
      AND a.day_of_week=p_day_of_week
      AND a.start_time=p_start_time AND a.end_time=p_end_time
      AND a.timezone=p_timezone AND a.is_active=coalesce(p_is_active,true)
  ) THEN
    RAISE EXCEPTION 'AVAILABILITY_RULE_DUPLICATE' USING ERRCODE='23505';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.availabilities(provider_id,instructor_id,vehicle_id,day_of_week,start_time,end_time,timezone,is_active)
    VALUES(v_provider_id,p_instructor_id,p_vehicle_id,p_day_of_week,p_start_time,p_end_time,p_timezone,coalesce(p_is_active,true))
    RETURNING * INTO v;
  ELSE
    UPDATE public.availabilities SET
      instructor_id=p_instructor_id, vehicle_id=p_vehicle_id, day_of_week=p_day_of_week,
      start_time=p_start_time, end_time=p_end_time, timezone=p_timezone,
      is_active=coalesce(p_is_active,true)
    WHERE id=p_id RETURNING * INTO v;
  END IF;
  RETURN v;
END;
$$;


ALTER FUNCTION "public"."provider_save_availability_rule"("p_id" "uuid", "p_provider_id" "uuid", "p_instructor_id" "uuid", "p_vehicle_id" "uuid", "p_day_of_week" integer, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_timezone" "text", "p_is_active" boolean) OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."service_offerings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "instructor_id" "uuid",
    "vehicle_id" "uuid" NOT NULL,
    "category" "public"."vehicle_category" NOT NULL,
    "transmission" "public"."vehicle_transmission" NOT NULL,
    "duration_minutes" integer DEFAULT 50 NOT NULL,
    "price_in_cents" integer NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    CONSTRAINT "service_offerings_duration_mvp_check" CHECK (("duration_minutes" = 50)),
    CONSTRAINT "service_offerings_lifecycle_consistency_check" CHECK ((((("status")::"text" = 'ACTIVE'::"text") AND ("is_active" = true)) OR ((("status")::"text" <> 'ACTIVE'::"text") AND ("is_active" = false)))),
    CONSTRAINT "service_offerings_price_in_cents_check" CHECK (("price_in_cents" > 0)),
    CONSTRAINT "service_offerings_status_check" CHECK ((("status")::"text" = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::"text"[])))
);


ALTER TABLE "public"."service_offerings" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."provider_save_service_offering"("p_offering_id" "uuid" DEFAULT NULL::"uuid", "p_provider_id" "uuid" DEFAULT NULL::"uuid", "p_instructor_id" "uuid" DEFAULT NULL::"uuid", "p_vehicle_id" "uuid" DEFAULT NULL::"uuid", "p_category" "public"."vehicle_category" DEFAULT NULL::"public"."vehicle_category", "p_transmission" "public"."vehicle_transmission" DEFAULT NULL::"public"."vehicle_transmission", "p_duration_minutes" integer DEFAULT 50, "p_price_in_cents" integer DEFAULT NULL::integer, "p_active" boolean DEFAULT false) RETURNS "public"."service_offerings"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v public.service_offerings;
  v_vehicle public.vehicles;
  v_provider public.providers;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_current_user_active() THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF p_provider_id IS NULL OR p_vehicle_id IS NULL OR p_instructor_id IS NULL THEN RAISE EXCEPTION 'OFFERING_REQUIRED_FIELDS' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_provider FROM public.providers WHERE id=p_provider_id;
  IF NOT FOUND OR NOT (v_provider.user_id=auth.uid() OR public.is_school_admin(p_provider_id) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'OFFERING_PROVIDER_ACCESS_DENIED' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_vehicle FROM public.vehicles WHERE id=p_vehicle_id AND deleted_at IS NULL;
  IF NOT FOUND OR v_vehicle.provider_id<>p_provider_id THEN RAISE EXCEPTION 'OFFERING_VEHICLE_PROVIDER_MISMATCH' USING ERRCODE='23514'; END IF;
  IF p_category IS NULL OR p_transmission IS NULL OR p_category<>v_vehicle.category OR p_transmission<>v_vehicle.transmission THEN
    RAISE EXCEPTION 'OFFERING_VEHICLE_ATTRIBUTES_MISMATCH' USING ERRCODE='23514';
  END IF;
  IF p_duration_minutes <> 50 THEN RAISE EXCEPTION 'OFFERING_DURATION_MUST_BE_50' USING ERRCODE='22023'; END IF;
  IF p_price_in_cents IS NULL OR p_price_in_cents <= 0 OR p_price_in_cents <> trunc(p_price_in_cents) THEN RAISE EXCEPTION 'OFFERING_PRICE_INVALID' USING ERRCODE='22023'; END IF;
  IF NOT public.can_manage_service_offering(p_provider_id,p_instructor_id,p_vehicle_id) THEN RAISE EXCEPTION 'OFFERING_INSTRUCTOR_SCOPE_DENIED' USING ERRCODE='42501'; END IF;
  IF p_active THEN
    IF v_provider.status <> 'ACTIVE' THEN RAISE EXCEPTION 'OFFERING_PROVIDER_NOT_ACTIVE' USING ERRCODE='22023'; END IF;
    IF v_vehicle.status <> 'ACTIVE' THEN RAISE EXCEPTION 'OFFERING_VEHICLE_NOT_ACTIVE' USING ERRCODE='22023'; END IF;
    IF NOT public.is_provider_instructor_eligible(p_provider_id,p_instructor_id,p_category) THEN RAISE EXCEPTION 'OFFERING_INSTRUCTOR_NOT_ELIGIBLE' USING ERRCODE='22023'; END IF;
  END IF;
  IF p_offering_id IS NULL THEN
    IF p_active AND EXISTS (SELECT 1 FROM public.service_offerings WHERE provider_id=p_provider_id AND instructor_id=p_instructor_id AND vehicle_id=p_vehicle_id AND category=p_category AND transmission=p_transmission AND duration_minutes=50 AND status='ACTIVE') THEN
      RAISE EXCEPTION 'DUPLICATE_ACTIVE_OFFERING' USING ERRCODE='23505';
    END IF;
    INSERT INTO public.service_offerings(provider_id,instructor_id,vehicle_id,category,transmission,duration_minutes,price_in_cents,is_active,status)
    VALUES(p_provider_id,p_instructor_id,p_vehicle_id,p_category,p_transmission,50,p_price_in_cents,p_active,CASE WHEN p_active THEN 'ACTIVE' ELSE 'INACTIVE' END)
    RETURNING * INTO v;
  ELSE
    SELECT * INTO v FROM public.service_offerings WHERE id=p_offering_id FOR UPDATE;
    IF NOT FOUND OR v.provider_id<>p_provider_id THEN RAISE EXCEPTION 'OFFERING_ACCESS_DENIED' USING ERRCODE='42501'; END IF;
    IF p_active AND v.status<>'ACTIVE' AND EXISTS (SELECT 1 FROM public.service_offerings WHERE id<>p_offering_id AND provider_id=p_provider_id AND instructor_id=p_instructor_id AND vehicle_id=p_vehicle_id AND category=p_category AND transmission=p_transmission AND duration_minutes=50 AND status='ACTIVE') THEN
      RAISE EXCEPTION 'DUPLICATE_ACTIVE_OFFERING' USING ERRCODE='23505';
    END IF;
    UPDATE public.service_offerings SET instructor_id=p_instructor_id,vehicle_id=p_vehicle_id,category=p_category,transmission=p_transmission,duration_minutes=50,price_in_cents=p_price_in_cents,is_active=p_active,status=CASE WHEN p_active THEN 'ACTIVE' ELSE 'INACTIVE' END,updated_at=now()
    WHERE id=p_offering_id RETURNING * INTO v;
  END IF;
  RETURN v;
END;
$$;


ALTER FUNCTION "public"."provider_save_service_offering"("p_offering_id" "uuid", "p_provider_id" "uuid", "p_instructor_id" "uuid", "p_vehicle_id" "uuid", "p_category" "public"."vehicle_category", "p_transmission" "public"."vehicle_transmission", "p_duration_minutes" integer, "p_price_in_cents" integer, "p_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."provider_save_vehicle"("p_vehicle_id" "uuid" DEFAULT NULL::"uuid", "p_provider_id" "uuid" DEFAULT NULL::"uuid", "p_brand" "text" DEFAULT NULL::"text", "p_model" "text" DEFAULT NULL::"text", "p_year" integer DEFAULT NULL::integer, "p_license_plate" "text" DEFAULT NULL::"text", "p_renavam" "text" DEFAULT NULL::"text", "p_category" "public"."vehicle_category" DEFAULT NULL::"public"."vehicle_category", "p_vehicle_type" "public"."vehicle_type" DEFAULT NULL::"public"."vehicle_type", "p_transmission" "public"."vehicle_transmission" DEFAULT NULL::"public"."vehicle_transmission", "p_has_dual_pedal" boolean DEFAULT false, "p_has_dashcam" boolean DEFAULT false, "p_color" "text" DEFAULT NULL::"text", "p_photos" "text"[] DEFAULT NULL::"text"[]) RETURNS "public"."vehicles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_vehicle public.vehicles;
  v_material_changed boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'INACTIVE_USER' USING ERRCODE = '42501'; END IF;
  IF p_provider_id IS NULL THEN RAISE EXCEPTION 'PROVIDER_REQUIRED' USING ERRCODE = '22023'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.id = p_provider_id
      AND (p.user_id = auth.uid() OR public.is_school_admin(p.id) OR public.is_platform_admin())
  ) THEN RAISE EXCEPTION 'VEHICLE_PROVIDER_ACCESS_DENIED' USING ERRCODE = '42501'; END IF;

  IF p_vehicle_id IS NULL THEN
    IF p_brand IS NULL OR p_model IS NULL OR p_year IS NULL OR p_license_plate IS NULL
       OR p_category IS NULL OR p_vehicle_type IS NULL OR p_transmission IS NULL
    THEN RAISE EXCEPTION 'VEHICLE_REQUIRED_FIELDS' USING ERRCODE = '22023'; END IF;
    INSERT INTO public.vehicles (
      provider_id, brand, model, year, license_plate, license_plate_masked, renavam,
      category, vehicle_type, transmission, has_dual_pedal, has_dashcam, color, photos, status
    ) VALUES (
      p_provider_id, p_brand, p_model, p_year, p_license_plate,
      CASE WHEN length(p_license_plate) >= 4 THEN '***' || right(p_license_plate, 4) ELSE '***' END,
      p_renavam, p_category, p_vehicle_type, p_transmission, coalesce(p_has_dual_pedal, false),
      coalesce(p_has_dashcam, false), p_color, p_photos, 'PENDING'
    ) RETURNING * INTO v_vehicle;
  ELSE
    SELECT * INTO v_vehicle FROM public.vehicles WHERE id = p_vehicle_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'VEHICLE_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
    IF v_vehicle.provider_id <> p_provider_id THEN RAISE EXCEPTION 'VEHICLE_PROVIDER_IMMUTABLE' USING ERRCODE = '42501'; END IF;
    IF v_vehicle.status = 'BLOCKED' THEN RAISE EXCEPTION 'BLOCKED_VEHICLE_MUTATION_DENIED' USING ERRCODE = '42501'; END IF;
    v_material_changed :=
      v_vehicle.brand IS DISTINCT FROM coalesce(p_brand, v_vehicle.brand)
      OR v_vehicle.model IS DISTINCT FROM coalesce(p_model, v_vehicle.model)
      OR v_vehicle.year IS DISTINCT FROM coalesce(p_year, v_vehicle.year)
      OR v_vehicle.license_plate IS DISTINCT FROM coalesce(p_license_plate, v_vehicle.license_plate)
      OR v_vehicle.renavam IS DISTINCT FROM coalesce(p_renavam, v_vehicle.renavam)
      OR v_vehicle.category IS DISTINCT FROM coalesce(p_category, v_vehicle.category)
      OR v_vehicle.vehicle_type IS DISTINCT FROM coalesce(p_vehicle_type, v_vehicle.vehicle_type)
      OR v_vehicle.transmission IS DISTINCT FROM coalesce(p_transmission, v_vehicle.transmission)
      OR v_vehicle.has_dual_pedal IS DISTINCT FROM coalesce(p_has_dual_pedal, v_vehicle.has_dual_pedal);
    UPDATE public.vehicles SET
      brand=coalesce(p_brand, brand), model=coalesce(p_model, model), year=coalesce(p_year, year),
      license_plate=coalesce(p_license_plate, license_plate),
      license_plate_masked=CASE WHEN p_license_plate IS NULL THEN license_plate_masked ELSE '***' || right(p_license_plate, 4) END,
      renavam=coalesce(p_renavam, renavam), category=coalesce(p_category, category), vehicle_type=coalesce(p_vehicle_type, vehicle_type),
      transmission=coalesce(p_transmission, transmission), has_dual_pedal=coalesce(p_has_dual_pedal, has_dual_pedal),
      has_dashcam=coalesce(p_has_dashcam, has_dashcam), color=coalesce(p_color, color), photos=coalesce(p_photos, photos),
      status=CASE WHEN v_material_changed AND status IN ('ACTIVE','INACTIVE') THEN 'IN_REVIEW' ELSE status END,
      updated_at=now()
    WHERE id=p_vehicle_id RETURNING * INTO v_vehicle;
  END IF;
  RETURN v_vehicle;
END;
$$;


ALTER FUNCTION "public"."provider_save_vehicle"("p_vehicle_id" "uuid", "p_provider_id" "uuid", "p_brand" "text", "p_model" "text", "p_year" integer, "p_license_plate" "text", "p_renavam" "text", "p_category" "public"."vehicle_category", "p_vehicle_type" "public"."vehicle_type", "p_transmission" "public"."vehicle_transmission", "p_has_dual_pedal" boolean, "p_has_dashcam" boolean, "p_color" "text", "p_photos" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."provider_set_availability_exception_active"("p_id" "uuid", "p_is_active" boolean) RETURNS SETOF "public"."availability_exceptions"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_exception public.availability_exceptions%ROWTYPE; v_saved public.availability_exceptions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_exception FROM public.availability_exceptions WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AVAILABILITY_EXCEPTION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF NOT public.can_manage_provider_schedule(v_exception.provider_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('provider-schedule:' || v_exception.provider_id::TEXT, 0));
  IF p_is_active AND v_exception.type='BLOCK' AND EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.provider_id=v_exception.provider_id AND b.status IN ('CONFIRMED','IN_PROGRESS','PENDING_PAYMENT')
      AND (b.status <> 'PENDING_PAYMENT' OR b.hold_expires_at IS NULL OR b.hold_expires_at > NOW())
      AND b.scheduled_start_at < v_exception.end_at AND v_exception.start_at < b.scheduled_end_at
      AND (v_exception.instructor_id IS NULL OR b.instructor_id=v_exception.instructor_id)
      AND (v_exception.vehicle_id IS NULL OR b.vehicle_id=v_exception.vehicle_id)
  ) THEN RAISE EXCEPTION 'AVAILABILITY_BLOCK_BOOKING_CONFLICT' USING ERRCODE = '23P01'; END IF;
  UPDATE public.availability_exceptions SET is_active=p_is_active, updated_at=NOW() WHERE id=p_id RETURNING * INTO v_saved;
  RETURN NEXT v_saved;
END;
$$;


ALTER FUNCTION "public"."provider_set_availability_exception_active"("p_id" "uuid", "p_is_active" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."provider_start_lesson"("p_booking_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking RECORD;
  v_provider_user_id UUID;
  v_is_authorized BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED: Usuário não autenticado.' USING ERRCODE = '40100'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = '40401'; END IF;
  IF v_booking.instructor_id = v_uid THEN v_is_authorized := TRUE;
  ELSE
    SELECT user_id INTO v_provider_user_id FROM public.providers WHERE id = v_booking.provider_id;
    IF v_provider_user_id = v_uid THEN v_is_authorized := TRUE;
    ELSE SELECT EXISTS (SELECT 1 FROM public.driving_school_staff WHERE school_id = v_booking.provider_id AND user_id = v_uid AND role::TEXT IN ('SCHOOL_ADMIN','DRIVING_SCHOOL') AND is_active = TRUE) INTO v_is_authorized; END IF;
  END IF;
  IF NOT v_is_authorized THEN RAISE EXCEPTION 'UNAUTHORIZED_PROVIDER: Acesso negado.' USING ERRCODE = '40302'; END IF;
  IF v_booking.status::TEXT = 'IN_PROGRESS' THEN RETURN jsonb_build_object('success', true, 'is_idempotent', true, 'booking_id', p_booking_id, 'status', 'IN_PROGRESS', 'lesson_started_at', v_booking.lesson_started_at, 'message', 'Aula já iniciada.'); END IF;
  IF v_booking.status::TEXT <> 'CONFIRMED' THEN RAISE EXCEPTION 'INVALID_STATUS: A aula precisa estar confirmada.' USING ERRCODE = '42200'; END IF;
  IF v_booking.checkin_instructor_at IS NULL THEN RAISE EXCEPTION 'INSTRUCTOR_CHECKIN_REQUIRED: Faça seu check-in antes de iniciar a aula.' USING ERRCODE = '42205'; END IF;
  IF v_booking.checkin_student_at IS NULL THEN RAISE EXCEPTION 'STUDENT_CHECKIN_REQUIRED: O aluno precisa realizar o check-in antes do início da aula.' USING ERRCODE = '42206'; END IF;
  UPDATE public.bookings SET status = 'IN_PROGRESS', lesson_started_at = COALESCE(lesson_started_at, v_now), updated_at = v_now WHERE id = p_booking_id;
  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at, ip_address)
  VALUES (gen_random_uuid(), v_uid, 'PROVIDER_START_LESSON', 'Booking', p_booking_id, jsonb_build_object('status', 'CONFIRMED'), jsonb_build_object('status', 'IN_PROGRESS', 'lesson_started_at', v_now), v_now, NULL);
  RETURN jsonb_build_object('success', true, 'is_idempotent', false, 'booking_id', p_booking_id, 'status', 'IN_PROGRESS', 'lesson_started_at', v_now);
END;
$$;


ALTER FUNCTION "public"."provider_start_lesson"("p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."provider_submit_compliance_document"("p_provider_id" "uuid", "p_document_type" "public"."compliance_doc_type", "p_storage_path" "text", "p_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "public"."compliance_documents"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_doc public.compliance_documents;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='42501'; END IF;
  IF NOT public.is_provider_owner(p_provider_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_document_type = 'MAZZI_TERMS_ACCEPTANCE' THEN RAISE EXCEPTION 'USE_TERMS_ACCEPTANCE_RPC' USING ERRCODE='22023'; END IF;
  IF p_storage_path IS NULL OR btrim(p_storage_path) = '' THEN RAISE EXCEPTION 'STORAGE_PATH_REQUIRED' USING ERRCODE='22023'; END IF;
  INSERT INTO public.compliance_documents (provider_id,user_id,vehicle_id,membership_id,scope,document_type,storage_path,status,expires_at)
  VALUES (p_provider_id,auth.uid(),NULL,NULL,'PROVIDER',p_document_type,p_storage_path,'PENDING',p_expires_at)
  RETURNING * INTO v_doc;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,new_value,severity,created_at)
  VALUES (auth.uid(),'COMPLIANCE_DOCUMENT_SUBMITTED','COMPLIANCE_DOCUMENTS',v_doc.id,
    jsonb_build_object('provider_id',p_provider_id,'document_type',p_document_type::TEXT,'scope','PROVIDER'),'INFO',NOW());
  RETURN v_doc;
END;
$$;


ALTER FUNCTION "public"."provider_submit_compliance_document"("p_provider_id" "uuid", "p_document_type" "public"."compliance_doc_type", "p_storage_path" "text", "p_expires_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_school_invitation_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_membership public.driving_school_staff%ROWTYPE;
  v_event public.school_membership_event_type;
BEGIN
  SELECT * INTO v_membership FROM public.driving_school_staff
  WHERE school_id = NEW.school_id AND user_id = NEW.target_user_id;
  v_event := CASE WHEN FOUND AND v_membership.membership_status = 'ENDED'
    THEN 'REHIRE_INVITED'::public.school_membership_event_type
    ELSE 'INVITED'::public.school_membership_event_type END;
  INSERT INTO public.driving_school_membership_events
    (membership_id, school_id, user_id, event_type, invitation_id, actor_id, metadata)
  VALUES
    (CASE WHEN FOUND THEN v_membership.id ELSE NULL END, NEW.school_id,
     NEW.target_user_id,
     v_event, NEW.id, NEW.invited_by, jsonb_build_object('invited_email', NEW.invited_email));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."record_school_invitation_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_school_membership_status_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_event public.school_membership_event_type;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event := 'COMPLIANCE_PENDING';
  ELSIF NEW.membership_status IS DISTINCT FROM OLD.membership_status THEN
    v_event := CASE NEW.membership_status
      WHEN 'ACTIVE' THEN 'ACTIVATED'::public.school_membership_event_type
      WHEN 'SUSPENDED' THEN 'SUSPENDED'::public.school_membership_event_type
      WHEN 'ENDED' THEN 'ENDED'::public.school_membership_event_type
      ELSE 'COMPLIANCE_PENDING'::public.school_membership_event_type
    END;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.driving_school_membership_events (
    membership_id, school_id, user_id, event_type, previous_status, new_status, actor_id
  ) VALUES (
    NEW.id, NEW.school_id, NEW.user_id, v_event,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.membership_status END,
    NEW.membership_status, auth.uid()
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."record_school_membership_status_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_compliance_document"("p_document_id" "uuid", "p_status" "public"."compliance_status", "p_rejection_reason" "text" DEFAULT NULL::"text") RETURNS "public"."compliance_documents"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_doc public.compliance_documents;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_compliance_reviewer() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF p_status NOT IN ('APPROVED', 'REJECTED') THEN RAISE EXCEPTION 'INVALID_REVIEW_STATUS'; END IF;
  UPDATE public.compliance_documents
  SET status = p_status, rejection_reason = CASE WHEN p_status = 'REJECTED' THEN p_rejection_reason ELSE NULL END,
      reviewed_by = auth.uid(), reviewed_at = NOW(), updated_at = NOW()
  WHERE id = p_document_id
  RETURNING * INTO v_doc;
  IF NOT FOUND THEN RAISE EXCEPTION 'DOCUMENT_NOT_FOUND'; END IF;
  RETURN v_doc;
END;
$$;


ALTER FUNCTION "public"."review_compliance_document"("p_document_id" "uuid", "p_status" "public"."compliance_status", "p_rejection_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."review_vehicle"("p_vehicle_id" "uuid", "p_status" "public"."vehicle_status", "p_reason" "text" DEFAULT NULL::"text") RETURNS "public"."vehicles"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_previous public.vehicles;
  v_updated public.vehicles;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('ACTIVE', 'INACTIVE', 'BLOCKED') THEN
    RAISE EXCEPTION 'INVALID_VEHICLE_REVIEW_STATUS' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_previous
  FROM public.vehicles
  WHERE id = p_vehicle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'VEHICLE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.vehicles
  SET status = p_status,
      updated_at = now()
  WHERE id = p_vehicle_id
  RETURNING * INTO v_updated;

  INSERT INTO public.audit_logs (
    id, actor_id, action, entity_type, entity_id,
    previous_value, new_value, created_at
  ) VALUES (
    gen_random_uuid(), v_uid, 'REVIEW_VEHICLE', 'Vehicle', p_vehicle_id::text,
    jsonb_build_object('status', v_previous.status, 'reason', NULL),
    jsonb_build_object('status', p_status, 'reason', NULLIF(btrim(p_reason), '')),
    now()
  );

  RETURN v_updated;
END;
$$;


ALTER FUNCTION "public"."review_vehicle"("p_vehicle_id" "uuid", "p_status" "public"."vehicle_status", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_instructor_global_block"("p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_reason" "text" DEFAULT NULL::"text", "p_block_id" "uuid" DEFAULT NULL::"uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
  v_id UUID;
  v_existing public.instructor_global_blocks%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTHENTICATION_REQUIRED: Usuário não autenticado.' USING ERRCODE = '40100';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = v_uid AND u.status = 'ACTIVE'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid AND ur.role = 'INSTRUCTOR'
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED_ROLE: Apenas instrutores credenciados podem gerenciar bloqueios pessoais globais.' USING ERRCODE = '40300';
  END IF;

  IF p_start_at IS NULL OR p_end_at IS NULL OR p_end_at <= p_start_at THEN
    RAISE EXCEPTION 'INVALID_TIME_RANGE: A data e hora final devem ser posteriores à data e hora inicial.' USING ERRCODE = '22023';
  END IF;

  IF p_end_at <= v_now THEN
    RAISE EXCEPTION 'EMERGENCY_BLOCK_IN_PAST' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended('instructor-schedule:' || v_uid::text, 0)
  );

  IF p_block_id IS NOT NULL THEN
    SELECT * INTO v_existing
    FROM public.instructor_global_blocks b
    WHERE b.id = p_block_id
      AND b.instructor_id = v_uid
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'GLOBAL_BLOCK_NOT_FOUND_OR_UNAUTHORIZED: Bloqueio pessoal não encontrado ou você não tem permissão.' USING ERRCODE = '40300';
    END IF;

    IF v_existing.start_at <= v_now THEN
      RAISE EXCEPTION 'GLOBAL_BLOCK_ALREADY_STARTED: Bloqueios que já começaram fazem parte do histórico e não podem ser alterados.' USING ERRCODE = '22023';
    END IF;
    v_id := v_existing.id;
  ELSE
    v_id := gen_random_uuid();
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.instructor_id = v_uid
      AND b.scheduled_start_at < p_end_at
      AND p_start_at < b.scheduled_end_at
      AND (
        b.status IN ('CONFIRMED', 'IN_PROGRESS')
        OR (b.status = 'PENDING_PAYMENT' AND (b.hold_expires_at IS NULL OR b.hold_expires_at > v_now))
      )
  ) THEN
    RAISE EXCEPTION 'EMERGENCY_BLOCK_BOOKING_CONFLICT' USING ERRCODE = '23P01';
  END IF;

  IF p_block_id IS NULL THEN
    INSERT INTO public.instructor_global_blocks (
      id, instructor_id, start_at, end_at, reason, created_at, updated_at
    ) VALUES (
      v_id, v_uid, p_start_at, p_end_at, p_reason, v_now, v_now
    );
  ELSE
    UPDATE public.instructor_global_blocks
    SET start_at = p_start_at,
        end_at = p_end_at,
        reason = p_reason,
        updated_at = v_now
    WHERE id = v_id
      AND instructor_id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id,
    'instructor_id', v_uid,
    'start_at', p_start_at,
    'end_at', p_end_at,
    'reason', p_reason
  );
END;
$$;


ALTER FUNCTION "public"."save_instructor_global_block"("p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_reason" "text", "p_block_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_providers_public"("p_user_lat" double precision, "p_user_lng" double precision, "p_radius_meters" double precision DEFAULT 5000, "p_category" "text" DEFAULT NULL::"text", "p_provider_type" "text" DEFAULT 'ALL'::"text", "p_transmission" "text" DEFAULT 'ALL'::"text", "p_min_rating" double precision DEFAULT 0.0, "p_max_price_cents" integer DEFAULT NULL::integer, "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0, "p_date" "date" DEFAULT NULL::"date") RETURNS TABLE("provider_id" "uuid", "display_name" "text", "provider_type" "text", "avatar_url" "text", "is_verified" boolean, "rating_average" numeric, "rating_count" integer, "rating_source" "text", "neighborhood" "text", "city" "text", "public_latitude" double precision, "public_longitude" double precision, "public_map_location_type" "text", "rounded_distance_meters" integer, "distance_display" "text", "starting_price_in_cents" integer, "normalized_price_cents" integer, "categories" "text"[], "transmissions" "text"[], "public_offerings" "jsonb")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_search_point GEOGRAPHY(Point, 4326);
  v_radius DOUBLE PRECISION;
  v_limit INT;
  v_offset INT;
BEGIN
  IF p_user_lat IS NULL OR p_user_lat NOT BETWEEN -90 AND 90 OR p_user_lng IS NULL OR p_user_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'INVALID_SEARCH_COORDINATES' USING ERRCODE = '22023';
  END IF;
  IF p_provider_type IS NULL OR p_provider_type NOT IN ('ALL', 'INSTRUCTOR', 'DRIVING_SCHOOL') THEN
    RAISE EXCEPTION 'INVALID_PROVIDER_TYPE' USING ERRCODE = '22023';
  END IF;
  IF p_transmission IS NOT NULL AND p_transmission NOT IN ('ALL', 'MANUAL', 'AUTOMATIC', 'NOT_APPLICABLE') THEN
    RAISE EXCEPTION 'INVALID_TRANSMISSION' USING ERRCODE = '22023';
  END IF;
  IF p_category IS NOT NULL AND p_category <> 'B' THEN
    RAISE EXCEPTION 'INVALID_PUBLIC_CATEGORY: Only category B is supported for public search' USING ERRCODE = '22023';
  END IF;
  v_search_point := ST_SetSRID(ST_MakePoint(p_user_lng, p_user_lat), 4326)::geography;
  v_radius := LEAST(GREATEST(COALESCE(p_radius_meters, 5000), 0), 50000);
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  RETURN QUERY
  WITH eligible_offerings AS (
    SELECT o.provider_id, MIN(o.price_in_cents)::INT AS starting_price_in_cents,
      ARRAY_AGG(DISTINCT o.category::TEXT ORDER BY o.category::TEXT) AS categories,
      ARRAY_AGG(DISTINCT o.transmission::TEXT ORDER BY o.transmission::TEXT) AS transmissions,
      JSONB_AGG(JSONB_BUILD_OBJECT('id',o.id,'providerId',o.provider_id,'instructorId',o.instructor_id,'instructorName',u.name,
        'vehicleId',o.vehicle_id,'vehicleTitle',CONCAT(v.brand,' ',v.model,' (',v.year,')'),'vehicleType',v.vehicle_type,
        'category',o.category,'transmission',o.transmission,'photos',COALESCE(v.photos,ARRAY[]::TEXT[]),
        'durationMinutes',o.duration_minutes,'priceInCents',o.price_in_cents) ORDER BY o.price_in_cents,o.id) AS public_offerings
    FROM public.service_offerings o
    JOIN public.vehicles v ON v.id=o.vehicle_id AND v.provider_id=o.provider_id AND v.status='ACTIVE' AND v.deleted_at IS NULL
      AND v.category=o.category AND v.transmission=o.transmission
    JOIN public.users u ON u.id=o.instructor_id AND u.status='ACTIVE'
    WHERE o.is_active=TRUE AND o.status='ACTIVE' AND o.instructor_id IS NOT NULL AND o.category::TEXT='B'
      AND (p_transmission='ALL' OR o.transmission::TEXT=p_transmission)
      AND public.is_provider_instructor_eligible(o.provider_id,o.instructor_id,o.category)
    GROUP BY o.provider_id
  )
  SELECT p.id,p.trade_name::TEXT,p.type::TEXT,p.avatar_url,(p.status='ACTIVE'),p.rating_average,p.rating_count,'REAL'::TEXT,
    p.neighborhood::TEXT,p.city::TEXT,p.public_latitude,p.public_longitude,p.public_map_location_type,
    (ROUND(ST_Distance(p.location_geography,v_search_point)/100.0)::INT*100),
    CONCAT(REPLACE(ROUND((ST_Distance(p.location_geography,v_search_point)/1000.0)::NUMERIC,1)::TEXT,'.',','),' km'),
    eo.starting_price_in_cents,eo.starting_price_in_cents,eo.categories,eo.transmissions,eo.public_offerings
  FROM public.providers p JOIN eligible_offerings eo ON eo.provider_id=p.id
  WHERE p.status='ACTIVE' AND ST_DWithin(p.location_geography,v_search_point,v_radius)
    AND (p_provider_type='ALL' OR p.type::TEXT=p_provider_type) AND p.rating_average>=COALESCE(p_min_rating,0)
    AND (p_max_price_cents IS NULL OR eo.starting_price_in_cents<=p_max_price_cents)
    AND (p_date IS NULL OR EXISTS (SELECT 1 FROM public.service_offerings so_avail
      WHERE so_avail.provider_id=p.id AND so_avail.is_active=TRUE AND so_avail.status='ACTIVE' AND so_avail.category::TEXT='B'
        AND (p_transmission='ALL' OR so_avail.transmission::TEXT=p_transmission)
        AND EXISTS (SELECT 1 FROM public.get_available_slots_public(so_avail.id,p_date,p_date))))
  ORDER BY ST_Distance(p.location_geography,v_search_point) ASC,p.id ASC LIMIT v_limit OFFSET v_offset;
END;
$$;


ALTER FUNCTION "public"."search_providers_public"("p_user_lat" double precision, "p_user_lng" double precision, "p_radius_meters" double precision, "p_category" "text", "p_provider_type" "text", "p_transmission" "text", "p_min_rating" double precision, "p_max_price_cents" integer, "p_limit" integer, "p_offset" integer, "p_date" "date") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read_at" timestamp with time zone
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_message"("p_conversation_id" "uuid", "p_body" "text") RETURNS "public"."messages"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_sender UUID := auth.uid();
  v_body TEXT := BTRIM(COALESCE(p_body, ''));
  v_conversation public.conversations%ROWTYPE;
  v_message public.messages%ROWTYPE;
BEGIN
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '42501';
  END IF;

  IF LENGTH(v_body) = 0 THEN
    RAISE EXCEPTION 'MESSAGE_EMPTY' USING ERRCODE = '22023';
  END IF;

  IF LENGTH(v_body) > 2000 THEN
    RAISE EXCEPTION 'MESSAGE_TOO_LONG' USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_conversation
  FROM public.conversations
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CONVERSATION_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_conversation_participant(p_conversation_id) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, content)
  VALUES (p_conversation_id, v_sender, v_body)
  RETURNING * INTO v_message;

  UPDATE public.conversations
  SET updated_at = NOW()
  WHERE id = p_conversation_id;

  INSERT INTO public.notifications (user_id, type, title, body, entity_type, entity_id)
  SELECT DISTINCT recipient_id,
    'NEW_MESSAGE',
    'Nova mensagem',
    'Você recebeu uma nova mensagem sobre uma aula agendada.',
    'conversation',
    p_conversation_id
  FROM (
    SELECT v_conversation.student_id AS recipient_id
    UNION ALL
    SELECT v_conversation.instructor_id
    UNION ALL
    SELECT p.user_id
    FROM public.providers p
    WHERE p.id = v_conversation.provider_id
  ) recipients
  WHERE recipient_id IS NOT NULL
    AND recipient_id <> v_sender;

  RETURN v_message;
END;
$$;


ALTER FUNCTION "public"."send_message"("p_conversation_id" "uuid", "p_body" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_provider_service_radius"("p_provider_id" "uuid", "p_radius_km" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
begin
  if auth.uid() is null or p_radius_km is null or p_radius_km < 1 or p_radius_km > 100 then
    raise exception 'SERVICE_RADIUS_INVALID' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.providers p
    where p.id = p_provider_id
      and (p.user_id = auth.uid() or exists (
        select 1 from public.driving_school_staff s
        where s.school_id = p.id and s.user_id = auth.uid()
          and s.is_active = true and s.role in ('OWNER', 'SCHOOL_ADMIN')
      ))
  ) then
    raise exception 'PROVIDER_PROFILE_ACCESS_DENIED' using errcode = '42501';
  end if;
  update public.providers set service_radius_km = p_radius_km, updated_at = now()
  where id = p_provider_id;
end;
$$;


ALTER FUNCTION "public"."set_provider_service_radius"("p_provider_id" "uuid", "p_radius_km" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."student_check_in_booking"("p_booking_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_booking RECORD;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTHENTICATION_REQUIRED: Usuário não autenticado.' USING ERRCODE = '28000'; END IF;
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'USER_NOT_ACTIVE: Usuário não está ativo no sistema.' USING ERRCODE = '42501'; END IF;
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BOOKING_NOT_FOUND: Agendamento não encontrado.' USING ERRCODE = 'P0002'; END IF;
  IF v_booking.student_id <> v_uid THEN RAISE EXCEPTION 'UNAUTHORIZED_STUDENT: Acesso negado.' USING ERRCODE = '42501'; END IF;
  IF v_booking.checkin_student_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'is_idempotent', true, 'booking_id', p_booking_id, 'checkin_student_at', v_booking.checkin_student_at, 'message', 'Check-in do aluno já realizado anteriormente.');
  END IF;
  IF v_booking.status::TEXT NOT IN ('CONFIRMED', 'IN_PROGRESS') THEN
    RAISE EXCEPTION 'INVALID_STATUS: Novo check-in só é permitido para aulas operacionais.' USING ERRCODE = '42200';
  END IF;
  IF v_now < v_booking.scheduled_start_at - INTERVAL '30 minutes' THEN
    RAISE EXCEPTION 'CHECKIN_WINDOW_NOT_OPEN: O check-in só fica disponível 30 minutos antes do início da aula.' USING ERRCODE = '42204';
  END IF;
  UPDATE public.bookings SET checkin_student_at = v_now, updated_at = v_now WHERE id = p_booking_id;
  INSERT INTO public.audit_logs (id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at)
  VALUES (gen_random_uuid(), v_uid, 'STUDENT_CHECKIN_BOOKING', 'Booking', p_booking_id, jsonb_build_object('checkin_student_at', NULL), jsonb_build_object('checkin_student_at', v_now), v_now);
  RETURN jsonb_build_object('success', true, 'is_idempotent', false, 'booking_id', p_booking_id, 'checkin_student_at', v_now, 'message', 'Check-in do aluno realizado com sucesso.');
END;
$$;


ALTER FUNCTION "public"."student_check_in_booking"("p_booking_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_my_global_compliance_document"("p_document_type" "public"."compliance_doc_type", "p_storage_path" "text", "p_expires_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "public"."compliance_documents"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE v_doc public.compliance_documents;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'USER_NOT_ACTIVE'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'INSTRUCTOR')
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'INSTRUCTOR') THEN
    RAISE EXCEPTION 'INSTRUCTOR_ROLE_REQUIRED';
  END IF;
  INSERT INTO public.compliance_documents (
    provider_id, user_id, vehicle_id, membership_id, scope, document_type,
    storage_path, status, expires_at
  ) VALUES (
    NULL, auth.uid(), NULL, NULL, 'USER_GLOBAL', p_document_type,
    p_storage_path, 'PENDING', p_expires_at
  ) RETURNING * INTO v_doc;
  RETURN v_doc;
END;
$$;


ALTER FUNCTION "public"."submit_my_global_compliance_document"("p_document_type" "public"."compliance_doc_type", "p_storage_path" "text", "p_expires_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_primary_user_role"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role, granted_by)
    VALUES (NEW.id, NEW.role, NULL)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_primary_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_school_staff_membership_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  -- membership_status is canonical for inserts and explicit status changes.
  IF TG_OP = 'INSERT' THEN
    NEW.is_active := (NEW.membership_status = 'ACTIVE'::public.school_membership_status);
    RETURN NEW;
  END IF;

  -- A legacy write changing only is_active may transition ACTIVE/SUSPENDED,
  -- but must never revive or rewrite PENDING_COMPLIANCE/ENDED.
  IF NEW.membership_status IS DISTINCT FROM OLD.membership_status THEN
    NEW.is_active := (NEW.membership_status = 'ACTIVE'::public.school_membership_status);
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    CASE OLD.membership_status
      WHEN 'ACTIVE'::public.school_membership_status THEN
        NEW.membership_status := CASE
          WHEN NEW.is_active IS TRUE THEN 'ACTIVE'::public.school_membership_status
          ELSE 'SUSPENDED'::public.school_membership_status
        END;
      WHEN 'SUSPENDED'::public.school_membership_status THEN
        NEW.membership_status := CASE
          WHEN NEW.is_active IS TRUE THEN 'ACTIVE'::public.school_membership_status
          ELSE 'SUSPENDED'::public.school_membership_status
        END;
      WHEN 'PENDING_COMPLIANCE'::public.school_membership_status,
           'ENDED'::public.school_membership_status THEN
        NEW.membership_status := OLD.membership_status;
    END CASE;
    NEW.is_active := (NEW.membership_status = 'ACTIVE'::public.school_membership_status);
  ELSE
    -- Unrelated updates retain the canonical status/boolean relationship.
    NEW.is_active := (NEW.membership_status = 'ACTIVE'::public.school_membership_status);
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_school_staff_membership_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."track_analytics_event"("p_event_name" "text", "p_properties" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  v_event_name text := upper(trim(coalesce(p_event_name, '')));
  v_properties jsonb := coalesce(p_properties, '{}'::jsonb);
  v_event_id uuid;
  v_forbidden_keys text[] := array[
    'email',
    'phone',
    'cpf',
    'cnpj',
    'document',
    'document_number',
    'renavam',
    'license_plate',
    'plate',
    'chat',
    'message',
    'review_comment',
    'comment',
    'jwt',
    'token',
    'payment_token',
    'card',
    'cvv',
    'latitude',
    'longitude',
    'lat',
    'lng',
    'ip',
    'fingerprint',
    'device_id',
    'student_name',
    'provider_phone'
  ];
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  if not public.is_current_user_active() then
    raise exception 'USER_NOT_ACTIVE' using errcode = '42501';
  end if;

  if v_event_name not in (
    'PROVIDER_SEARCH',
    'PROVIDER_PROFILE_VIEW',
    'AVAILABLE_SLOTS_VIEW',
    'CHECKOUT_STARTED'
  ) then
    raise exception 'ANALYTICS_EVENT_NOT_ALLOWED' using errcode = '22023';
  end if;

  if jsonb_typeof(v_properties) <> 'object' then
    raise exception 'ANALYTICS_PROPERTIES_MUST_BE_OBJECT' using errcode = '22023';
  end if;

  if octet_length(v_properties::text) > 4096 then
    raise exception 'ANALYTICS_PROPERTIES_TOO_LARGE' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_object_keys(v_properties) as keys(key)
    where lower(keys.key) = any(v_forbidden_keys)
  ) then
    raise exception 'ANALYTICS_PROPERTIES_CONTAIN_SENSITIVE_KEY' using errcode = '22023';
  end if;

  if v_properties::text ~* '"(email|phone|cpf|cnpj|document|document_number|renavam|license_plate|plate|chat|message|review_comment|comment|jwt|token|payment_token|card|cvv|latitude|longitude|lat|lng|ip|fingerprint|device_id|student_name|provider_phone)"[[:space:]]*:' then
    raise exception 'ANALYTICS_PROPERTIES_CONTAIN_SENSITIVE_KEY' using errcode = '22023';
  end if;

  insert into public.analytics_events (event_name, actor_id, properties)
  values (v_event_name, auth.uid(), v_properties)
  returning id into v_event_id;

  return v_event_id;
end;
$$;


ALTER FUNCTION "public"."track_analytics_event"("p_event_name" "text", "p_properties" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_validate_user_student_identity"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
BEGIN
  IF NEW.role = 'STUDENT' THEN
    -- Enforce mandatory CPF for STUDENT
    IF NEW.cpf IS NULL OR trim(NEW.cpf) = '' THEN
      RAISE EXCEPTION 'CPF_REQUIRED: O CPF é obrigatório para cadastrar um Aluno.';
    END IF;

    -- Enforce CPF mathematical validity
    IF NOT public.validate_cpf(NEW.cpf) THEN
      RAISE EXCEPTION 'CPF_INVALID: O CPF fornecido é matematicamente inválido.';
    END IF;

    -- Enforce mandatory Birth Date for STUDENT
    IF NEW.birth_date IS NULL THEN
      RAISE EXCEPTION 'BIRTH_DATE_REQUIRED: A data de nascimento é obrigatória para cadastrar um Aluno.';
    END IF;

    -- Enforce Birth Date non-future and minimum age of 18 years
    IF NEW.birth_date > CURRENT_DATE THEN
      RAISE EXCEPTION 'BIRTH_DATE_FUTURE: A data de nascimento não pode ser no futuro.';
    END IF;

    IF NEW.birth_date > (CURRENT_DATE - INTERVAL '18 years') THEN
      RAISE EXCEPTION 'MINIMUM_AGE_VIOLATION: Para utilizar o MAZZI, você precisa ter pelo menos 18 anos.';
    END IF;

    -- Prevent direct mutation of CPF on UPDATE (IMMUTABLE)
    IF TG_OP = 'UPDATE' THEN
      IF OLD.cpf IS NOT NULL AND NEW.cpf IS DISTINCT FROM OLD.cpf THEN
        IF NOT public.is_platform_admin() THEN
          RAISE EXCEPTION 'CPF_IMMUTABLE: O CPF não pode ser alterado pelo usuário.';
        END IF;
      END IF;
      -- Birth date IS EDITABLE by student as long as it satisfies the 18+ and non-future validation above!
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trigger_validate_user_student_identity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."try_activate_school_instructor_membership"("p_membership_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_membership public.driving_school_staff%ROWTYPE;
  v_school public.providers%ROWTYPE;
  v_user public.users%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT * INTO v_membership
  FROM public.driving_school_staff
  WHERE id = p_membership_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MEMBERSHIP_NOT_FOUND';
  END IF;

  -- Preserve the existing authorization boundary for reviewer, school admin,
  -- and the linked instructor acting on their own membership.
  IF NOT (
    public.is_compliance_reviewer()
    OR public.is_school_admin(v_membership.school_id)
    OR v_membership.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'ACCESS_DENIED';
  END IF;

  IF v_membership.membership_status <> 'PENDING_COMPLIANCE'::public.school_membership_status THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'membership_id', v_membership.id,
      'status', v_membership.membership_status
    );
  END IF;

  SELECT * INTO v_school
  FROM public.providers
  WHERE id = v_membership.school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SCHOOL_NOT_FOUND';
  END IF;
  IF v_school.status <> 'ACTIVE'::public.provider_status THEN
    RAISE EXCEPTION 'PROVIDER_NOT_ACTIVE';
  END IF;
  IF v_school.type <> 'DRIVING_SCHOOL'::public.provider_type THEN
    RAISE EXCEPTION 'PROVIDER_NOT_DRIVING_SCHOOL';
  END IF;

  SELECT * INTO v_user
  FROM public.users
  WHERE id = v_membership.user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;
  IF v_user.status <> 'ACTIVE'::public.user_status THEN
    RAISE EXCEPTION 'USER_NOT_ACTIVE';
  END IF;
  IF NOT (
    v_user.role = 'INSTRUCTOR'::public.user_role
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = v_user.id
        AND ur.role = 'INSTRUCTOR'::public.user_role
    )
  ) THEN
    RAISE EXCEPTION 'INSTRUCTOR_ROLE_REQUIRED';
  END IF;

  -- Activation readiness intentionally uses dedicated pre-activation checks:
  -- the runtime gate requires ACTIVE membership and would create a circular gate.
  IF NOT public.is_instructor_global_compliance_valid(v_membership.user_id, NULL)
     OR NOT public.is_membership_compliance_valid(v_membership.id, NULL) THEN
    RAISE EXCEPTION 'COMPLIANCE_NOT_SATISFIED';
  END IF;

  UPDATE public.driving_school_staff
  SET membership_status = 'ACTIVE',
      is_active = TRUE,
      suspended_at = NULL,
      suspended_by = NULL,
      ended_at = NULL,
      ended_by = NULL,
      end_reason = NULL,
      updated_at = NOW()
  WHERE id = v_membership.id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'membership_id', v_membership.id,
    'status', 'ACTIVE'
  );
END;
$$;


ALTER FUNCTION "public"."try_activate_school_instructor_membership"("p_membership_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_admin_platform_configurations"("p_updates" "jsonb") RETURNS TABLE("key" character varying, "value" "jsonb")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_uid UUID;
  v_before JSONB;
  v_after JSONB;
  v_item RECORD;
  v_allowed_keys CONSTANT TEXT[] := ARRAY[
    'platformFeeDefaultPercentage',
    'availabilityHorizonDays',
    'quoteExpirationMinutes',
    'minimumBookingNoticeHours',
    'payoutSafetyPeriodHours',
    'searchRadiusDefaultsKm'
  ];
BEGIN
  v_uid := auth.uid();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  IF NOT public.current_user_has_permission(
    'admin.platform.manage_settings'::public.app_permission
  ) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;

  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'object' OR p_updates = '{}'::jsonb THEN
    RAISE EXCEPTION 'INVALID_PLATFORM_CONFIG_UPDATES' USING ERRCODE = '22023';
  END IF;

  FOR v_item IN SELECT key FROM jsonb_object_keys(p_updates) AS item(key)
  LOOP
    IF NOT (v_item.key = ANY(v_allowed_keys)) THEN
      RAISE EXCEPTION 'UNSUPPORTED_PLATFORM_CONFIG_KEY: %', v_item.key USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(p_updates -> v_item.key) <> 'number' THEN
      RAISE EXCEPTION 'PLATFORM_CONFIG_VALUE_MUST_BE_NUMBER: %', v_item.key USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF p_updates ? 'platformFeeDefaultPercentage'
     AND ((p_updates ->> 'platformFeeDefaultPercentage')::NUMERIC < 0
       OR (p_updates ->> 'platformFeeDefaultPercentage')::NUMERIC > 100) THEN
    RAISE EXCEPTION 'INVALID_FEE_PERCENTAGE' USING ERRCODE = '22023';
  END IF;
  IF p_updates ? 'availabilityHorizonDays'
     AND ((p_updates ->> 'availabilityHorizonDays')::NUMERIC < 1
       OR (p_updates ->> 'availabilityHorizonDays')::NUMERIC > 365) THEN
    RAISE EXCEPTION 'INVALID_AVAILABILITY_HORIZON' USING ERRCODE = '22023';
  END IF;
  IF p_updates ? 'quoteExpirationMinutes'
     AND (p_updates ->> 'quoteExpirationMinutes')::NUMERIC <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUOTE_EXPIRATION' USING ERRCODE = '22023';
  END IF;
  IF p_updates ? 'minimumBookingNoticeHours'
     AND (p_updates ->> 'minimumBookingNoticeHours')::NUMERIC < 0 THEN
    RAISE EXCEPTION 'INVALID_MINIMUM_BOOKING_NOTICE' USING ERRCODE = '22023';
  END IF;
  IF p_updates ? 'payoutSafetyPeriodHours'
     AND (p_updates ->> 'payoutSafetyPeriodHours')::NUMERIC < 0 THEN
    RAISE EXCEPTION 'INVALID_PAYOUT_SAFETY_PERIOD' USING ERRCODE = '22023';
  END IF;
  IF p_updates ? 'searchRadiusDefaultsKm'
     AND (p_updates ->> 'searchRadiusDefaultsKm')::NUMERIC <= 0 THEN
    RAISE EXCEPTION 'INVALID_SEARCH_RADIUS' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(jsonb_object_agg(pc.key, pc.value), '{}'::JSONB)
    INTO v_before
    FROM public.platform_configurations AS pc
   WHERE pc.key IN ('platform_fees', 'quote_settings', 'scheduling_settings', 'platform_operations');

  IF p_updates ? 'platformFeeDefaultPercentage' THEN
    INSERT INTO public.platform_configurations (key, value, updated_by, updated_at)
    VALUES ('platform_fees', jsonb_build_object(
      'default_percentage', (p_updates -> 'platformFeeDefaultPercentage')
    ), v_uid, now())
    ON CONFLICT (key) DO UPDATE
      SET value = jsonb_set(public.platform_configurations.value, '{default_percentage}', EXCLUDED.value -> 'default_percentage', true),
          updated_by = v_uid,
          updated_at = now();
  END IF;

  IF p_updates ? 'quoteExpirationMinutes' THEN
    INSERT INTO public.platform_configurations (key, value, updated_by, updated_at)
    VALUES ('quote_settings', jsonb_build_object(
      'expiration_minutes', (p_updates -> 'quoteExpirationMinutes')
    ), v_uid, now())
    ON CONFLICT (key) DO UPDATE
      SET value = jsonb_set(public.platform_configurations.value, '{expiration_minutes}', EXCLUDED.value -> 'expiration_minutes', true),
          updated_by = v_uid,
          updated_at = now();
  END IF;

  IF p_updates ? 'availabilityHorizonDays' THEN
    INSERT INTO public.platform_configurations (key, value, updated_by, updated_at)
    VALUES ('scheduling_settings', jsonb_build_object(
      'max_booking_horizon_days', (p_updates -> 'availabilityHorizonDays')
    ), v_uid, now())
    ON CONFLICT (key) DO UPDATE
      SET value = jsonb_set(public.platform_configurations.value, '{max_booking_horizon_days}', EXCLUDED.value -> 'max_booking_horizon_days', true),
          updated_by = v_uid,
          updated_at = now();
  END IF;

  IF p_updates ? 'minimumBookingNoticeHours'
     OR p_updates ? 'payoutSafetyPeriodHours'
     OR p_updates ? 'searchRadiusDefaultsKm' THEN
    INSERT INTO public.platform_configurations (key, value, updated_by, updated_at)
    VALUES ('platform_operations', jsonb_build_object(
      'minimum_notice_hours', p_updates -> 'minimumBookingNoticeHours',
      'payout_safety_period_hours', p_updates -> 'payoutSafetyPeriodHours',
      'search_radius_km', p_updates -> 'searchRadiusDefaultsKm'
    ), v_uid, now())
    ON CONFLICT (key) DO UPDATE
      SET value = public.platform_configurations.value || EXCLUDED.value,
          updated_by = v_uid,
          updated_at = now();
  END IF;

  SELECT COALESCE(jsonb_object_agg(pc.key, pc.value), '{}'::JSONB)
    INTO v_after
    FROM public.platform_configurations AS pc
   WHERE pc.key IN ('platform_fees', 'quote_settings', 'scheduling_settings', 'platform_operations');

  INSERT INTO public.audit_logs (
    id, actor_id, action, entity_type, entity_id, previous_value, new_value, created_at
  ) VALUES (
    gen_random_uuid(), v_uid, 'PLATFORM_CONFIG_UPDATED', 'PlatformConfiguration',
    'platform_configurations', v_before, v_after, now()
  );

  RETURN QUERY
  SELECT pc.key, pc.value
    FROM public.platform_configurations AS pc
   WHERE pc.key IN ('platform_fees', 'quote_settings', 'scheduling_settings', 'platform_operations')
   ORDER BY pc.key;
END;
$$;


ALTER FUNCTION "public"."update_admin_platform_configurations"("p_updates" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_my_profile"("p_name" "text" DEFAULT NULL::"text", "p_phone" "text" DEFAULT NULL::"text", "p_avatar_url" "text" DEFAULT NULL::"text", "p_birth_date" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_user_id UUID;
  v_user_role user_role;
  v_parsed_birth_date DATE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Usuário não autenticado.';
  END IF;

  SELECT role INTO v_user_role FROM public.users WHERE id = v_user_id AND deleted_at IS NULL;
  IF v_user_role IS NULL THEN
    RAISE EXCEPTION 'USER_NOT_FOUND: Perfil de usuário não encontrado.';
  END IF;

  -- Parse birth_date if provided
  IF p_birth_date IS NOT NULL AND trim(p_birth_date) != '' THEN
    BEGIN
      v_parsed_birth_date := p_birth_date::DATE;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'INVALID_BIRTH_DATE_FORMAT: Data de nascimento em formato inválido.';
    END;
  END IF;

  -- Update fields for authenticated user
  UPDATE public.users
  SET
    name = COALESCE(NULLIF(trim(p_name), ''), name),
    phone = COALESCE(NULLIF(trim(p_phone), ''), phone),
    avatar_url = CASE WHEN p_avatar_url IS NOT NULL THEN p_avatar_url ELSE avatar_url END,
    birth_date = CASE WHEN v_parsed_birth_date IS NOT NULL THEN v_parsed_birth_date ELSE birth_date END,
    updated_at = NOW()
  WHERE id = v_user_id;
END;
$$;


ALTER FUNCTION "public"."update_my_profile"("p_name" "text", "p_phone" "text", "p_avatar_url" "text", "p_birth_date" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_provider_profile"("p_provider_id" "uuid", "p_name" "text" DEFAULT NULL::"text", "p_public_contact" "text" DEFAULT NULL::"text", "p_neighborhood" "text" DEFAULT NULL::"text", "p_city" "text" DEFAULT NULL::"text", "p_state" "text" DEFAULT NULL::"text", "p_service_radius_km" integer DEFAULT NULL::integer, "p_bio" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_uid UUID;
  v_clean_name TEXT;
  v_clean_contact TEXT;
  v_clean_neighborhood TEXT;
  v_clean_city TEXT;
  v_clean_state TEXT;
  v_clean_bio TEXT;
BEGIN
  -- 1. Authentication Check
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Usuário não autenticado.' USING ERRCODE = '28000';
  END IF;

  -- 2. Authorization Check (Provider Owner OR Driving School Admin)
  IF NOT (
    public.is_provider_owner(p_provider_id)
    OR public.is_school_admin(p_provider_id)
  ) THEN
    RAISE EXCEPTION 'PROVIDER_PROFILE_ACCESS_DENIED: Você não tem permissão para atualizar este perfil de prestador.' USING ERRCODE = '42501';
  END IF;

  -- 3. Input Validation & Normalization
  -- trade_name (p_name): NOT NULL in schema
  IF p_name IS NOT NULL THEN
    v_clean_name := trim(p_name);
    IF v_clean_name = '' THEN
      RAISE EXCEPTION 'PROVIDER_NAME_INVALID: O nome do prestador não pode ser vazio.' USING ERRCODE = '22000';
    END IF;
  END IF;

  -- public_contact: Optional/Nullable
  IF p_public_contact IS NOT NULL THEN
    v_clean_contact := trim(p_public_contact);
    IF v_clean_contact <> '' THEN
      IF NOT (v_clean_contact ~ '^\d{10,11}$') THEN
        RAISE EXCEPTION 'PROVIDER_CONTACT_INVALID: O contato público deve conter 10 ou 11 dígitos numéricos.' USING ERRCODE = '22000';
      END IF;
    ELSE
      v_clean_contact := NULL;
    END IF;
  END IF;

  -- neighborhood: Optional/Nullable
  IF p_neighborhood IS NOT NULL THEN
    v_clean_neighborhood := trim(p_neighborhood);
    IF v_clean_neighborhood = '' THEN
      v_clean_neighborhood := NULL;
    END IF;
  END IF;

  -- city: NOT NULL in schema
  IF p_city IS NOT NULL THEN
    v_clean_city := trim(p_city);
    IF v_clean_city = '' THEN
      RAISE EXCEPTION 'PROVIDER_CITY_INVALID: A cidade do prestador não pode ser vazia.' USING ERRCODE = '22000';
    END IF;
  END IF;

  -- state: NOT NULL in schema (must be 2 uppercase letters)
  IF p_state IS NOT NULL THEN
    v_clean_state := upper(trim(p_state));
    IF v_clean_state = '' OR NOT (v_clean_state ~ '^[A-Z]{2}$') THEN
      RAISE EXCEPTION 'PROVIDER_STATE_INVALID: O estado (UF) deve ter exatamente 2 letras.' USING ERRCODE = '22000';
    END IF;
  END IF;

  -- service_radius_km: 1 to 100
  IF p_service_radius_km IS NOT NULL THEN
    IF p_service_radius_km < 1 OR p_service_radius_km > 100 THEN
      RAISE EXCEPTION 'SERVICE_RADIUS_INVALID: O raio de atendimento deve estar entre 1 e 100 km.' USING ERRCODE = '22000';
    END IF;
  END IF;

  -- bio: Optional/Nullable
  IF p_bio IS NOT NULL THEN
    v_clean_bio := trim(p_bio);
    IF v_clean_bio = '' THEN
      v_clean_bio := NULL;
    END IF;
  END IF;

  -- 4. Execute Update (Modifying ONLY allowed columns, trade_name instead of name)
  UPDATE public.providers
  SET
    trade_name = COALESCE(v_clean_name, trade_name),
    public_contact = CASE WHEN p_public_contact IS NOT NULL THEN v_clean_contact ELSE public_contact END,
    neighborhood = CASE WHEN p_neighborhood IS NOT NULL THEN v_clean_neighborhood ELSE neighborhood END,
    city = COALESCE(v_clean_city, city),
    state = COALESCE(v_clean_state, state),
    service_radius_km = COALESCE(p_service_radius_km, service_radius_km),
    bio = CASE WHEN p_bio IS NOT NULL THEN v_clean_bio ELSE bio END,
    updated_at = NOW()
  WHERE id = p_provider_id;
END;
$_$;


ALTER FUNCTION "public"."update_provider_profile"("p_provider_id" "uuid", "p_name" "text", "p_public_contact" "text", "p_neighborhood" "text", "p_city" "text", "p_state" "text", "p_service_radius_km" integer, "p_bio" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_availability_resource_scope"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_provider public.providers;
BEGIN
  SELECT * INTO v_provider FROM public.providers WHERE id = NEW.provider_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'AVAILABILITY_PROVIDER_NOT_FOUND' USING ERRCODE='23503'; END IF;

  IF NEW.vehicle_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id=NEW.vehicle_id AND v.provider_id=NEW.provider_id AND v.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'AVAILABILITY_VEHICLE_SCOPE_INVALID' USING ERRCODE='23514';
  END IF;

  IF NEW.instructor_id IS NOT NULL AND (
    (v_provider.type='INSTRUCTOR'::public.provider_type AND NEW.instructor_id<>v_provider.user_id)
    OR
    (v_provider.type='DRIVING_SCHOOL'::public.provider_type AND NOT EXISTS (
      SELECT 1 FROM public.driving_school_staff dss
      WHERE dss.school_id=NEW.provider_id AND dss.user_id=NEW.instructor_id
        AND dss.role='INSTRUCTOR'::public.user_role
        AND dss.membership_status='ACTIVE'::public.school_membership_status
        AND dss.is_active IS TRUE
    ))
  ) THEN
    RAISE EXCEPTION 'AVAILABILITY_INSTRUCTOR_SCOPE_INVALID' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_availability_resource_scope"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_compliance_document_membership_user"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_membership_user_id UUID;
BEGIN
  IF NEW.scope = 'MEMBERSHIP'::public.compliance_document_scope THEN
    SELECT dss.user_id
      INTO v_membership_user_id
      FROM public.driving_school_staff AS dss
     WHERE dss.id = NEW.membership_id;

    IF NOT FOUND OR v_membership_user_id IS DISTINCT FROM NEW.user_id THEN
      RAISE EXCEPTION 'MEMBERSHIP_DOCUMENT_USER_MISMATCH';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."validate_compliance_document_membership_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."validate_cpf"("cpf_str" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_cpf TEXT;
  v_sum INTEGER;
  v_remainder INTEGER;
  v_digit1 INTEGER;
  v_digit2 INTEGER;
  i INTEGER;
BEGIN
  IF cpf_str IS NULL THEN
    RETURN FALSE;
  END IF;

  v_cpf := regexp_replace(cpf_str, '\D', '', 'g');

  IF length(v_cpf) != 11 THEN
    RETURN FALSE;
  END IF;

  -- Reject repeating sequences: 00000000000, 11111111111, ..., 99999999999
  IF v_cpf ~ '^(\d)\1{10}$' THEN
    RETURN FALSE;
  END IF;

  -- Calculate 1st check digit
  v_sum := 0;
  FOR i IN 1..9 LOOP
    v_sum := v_sum + substring(v_cpf, i, 1)::INTEGER * (11 - i);
  END LOOP;
  v_remainder := (v_sum * 10) % 11;
  IF v_remainder = 10 OR v_remainder = 11 THEN
    v_remainder := 0;
  END IF;
  v_digit1 := v_remainder;
  IF v_digit1 != substring(v_cpf, 10, 1)::INTEGER THEN
    RETURN FALSE;
  END IF;

  -- Calculate 2nd check digit
  v_sum := 0;
  FOR i IN 1..10 LOOP
    v_sum := v_sum + substring(v_cpf, i, 1)::INTEGER * (12 - i);
  END LOOP;
  v_remainder := (v_sum * 10) % 11;
  IF v_remainder = 10 OR v_remainder = 11 THEN
    v_remainder := 0;
  END IF;
  v_digit2 := v_remainder;
  IF v_digit2 != substring(v_cpf, 11, 1)::INTEGER THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$_$;


ALTER FUNCTION "public"."validate_cpf"("cpf_str" "text") OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_name" character varying(100) NOT NULL,
    "actor_id" "uuid",
    "properties" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."analytics_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_id" "uuid",
    "action" character varying(100) NOT NULL,
    "entity_type" character varying(100) NOT NULL,
    "entity_id" character varying(100) NOT NULL,
    "previous_value" "jsonb",
    "new_value" "jsonb",
    "ip_address" character varying(45),
    "user_agent" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "severity" character varying(20) DEFAULT 'INFO'::character varying
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "instructor_id" "uuid" NOT NULL,
    "vehicle_id" "uuid" NOT NULL,
    "offering_id" "uuid" NOT NULL,
    "quote_id" "uuid",
    "status" "public"."booking_status" DEFAULT 'PENDING_PAYMENT'::"public"."booking_status" NOT NULL,
    "scheduled_start_at" timestamp with time zone NOT NULL,
    "scheduled_end_at" timestamp with time zone NOT NULL,
    "slot_range" "tstzrange" GENERATED ALWAYS AS ("tstzrange"("scheduled_start_at", "scheduled_end_at", '[)'::"text")) STORED,
    "meeting_point" "jsonb" DEFAULT '{"name": "Ponto de Encontro Padrão"}'::"jsonb" NOT NULL,
    "price_in_cents" integer NOT NULL,
    "platform_fee_in_cents" integer NOT NULL,
    "total_in_cents" integer NOT NULL,
    "snapshot_data" "jsonb" NOT NULL,
    "cancellation_data" "jsonb",
    "checkin_student_at" timestamp with time zone,
    "checkin_instructor_at" timestamp with time zone,
    "lesson_started_at" timestamp with time zone,
    "lesson_finished_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "hold_expires_at" timestamp with time zone,
    "idempotency_key" character varying(255),
    "confirmed_at" timestamp with time zone,
    "completed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "expired_at" timestamp with time zone,
    "cancellation_reason" "text",
    "cancelled_by" "text",
    "refund_amount_in_cents" bigint DEFAULT 0,
    "completion_idempotency_key" character varying,
    "selection_mode" "public"."booking_selection_mode" DEFAULT 'SPECIFIC_INSTRUCTOR'::"public"."booking_selection_mode" NOT NULL,
    CONSTRAINT "bookings_check" CHECK (("scheduled_start_at" < "scheduled_end_at")),
    CONSTRAINT "bookings_platform_fee_in_cents_check" CHECK (("platform_fee_in_cents" >= 0)),
    CONSTRAINT "bookings_price_in_cents_check" CHECK (("price_in_cents" > 0)),
    CONSTRAINT "bookings_total_in_cents_check" CHECK (("total_in_cents" > 0))
);


ALTER TABLE "public"."bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cancellation_policies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(100) NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "provider_initiated_refund_percentage" integer DEFAULT 100 NOT NULL,
    "no_show_student_refund_percentage" integer DEFAULT 0 NOT NULL,
    "no_show_provider_refund_percentage" integer DEFAULT 100 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cancellation_policies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cancellation_policy_rules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "policy_id" "uuid" NOT NULL,
    "min_hours_before_lesson" integer NOT NULL,
    "student_refund_percentage" integer NOT NULL,
    "provider_compensation_percentage" integer NOT NULL,
    "platform_fee_retained_percentage" integer NOT NULL,
    "description" "text" NOT NULL
);


ALTER TABLE "public"."cancellation_policy_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."compliance_requirements" (
    "id" character varying(100) NOT NULL,
    "provider_type" "public"."provider_type" NOT NULL,
    "category" "public"."vehicle_category",
    "state" character varying(2) DEFAULT 'SP'::character varying,
    "jurisdiction" character varying(100) DEFAULT 'STATE'::character varying NOT NULL,
    "document_type" character varying(50) NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text" NOT NULL,
    "is_mandatory" boolean DEFAULT true NOT NULL,
    "regulatory_status" character varying(50) DEFAULT 'REQUIRES_REGULATORY_VALIDATION'::character varying NOT NULL,
    "validity_period_days" integer,
    "effective_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "effective_to" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "country" character varying(2) DEFAULT 'BR'::character varying NOT NULL,
    "source_type" character varying(50) DEFAULT 'INTERNAL_MAZZI_RULE'::character varying NOT NULL,
    "source_reference" "text" DEFAULT 'Regra Interna MAZZI'::"text" NOT NULL,
    "source_url" "text",
    "source_identifier" character varying(100),
    "last_validated_at" timestamp with time zone,
    "scope" "public"."compliance_document_scope"
);


ALTER TABLE "public"."compliance_requirements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driving_school_membership_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "membership_id" "uuid",
    "school_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "event_type" "public"."school_membership_event_type" NOT NULL,
    "previous_status" "public"."school_membership_status",
    "new_status" "public"."school_membership_status",
    "invitation_id" "uuid",
    "actor_id" "uuid",
    "reason" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."driving_school_membership_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."driving_school_staff" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."user_role" DEFAULT 'SCHOOL_STAFF'::"public"."user_role" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "membership_status" "public"."school_membership_status" DEFAULT 'SUSPENDED'::"public"."school_membership_status" NOT NULL,
    "source_invitation_id" "uuid",
    "accepted_at" timestamp with time zone,
    "suspended_at" timestamp with time zone,
    "suspended_by" "uuid",
    "ended_at" timestamp with time zone,
    "ended_by" "uuid",
    "end_reason" "text",
    CONSTRAINT "driving_school_staff_membership_consistency_check" CHECK (((("membership_status" = 'ACTIVE'::"public"."school_membership_status") AND ("is_active" IS TRUE)) OR (("membership_status" = ANY (ARRAY['PENDING_COMPLIANCE'::"public"."school_membership_status", 'SUSPENDED'::"public"."school_membership_status", 'ENDED'::"public"."school_membership_status"])) AND ("is_active" IS FALSE))))
);


ALTER TABLE "public"."driving_school_staff" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."instructor_global_blocks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "instructor_id" "uuid" NOT NULL,
    "start_at" timestamp with time zone NOT NULL,
    "end_at" timestamp with time zone NOT NULL,
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_instructor_global_blocks_dates" CHECK (("end_at" > "start_at"))
);


ALTER TABLE "public"."instructor_global_blocks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "entity_type" "text",
    "entity_id" "uuid",
    "is_read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "read_at" timestamp with time zone,
    CONSTRAINT "notifications_type_check" CHECK (("type" = ANY (ARRAY['BOOKING_CONFIRMED'::"text", 'BOOKING_CANCELLED'::"text", 'NEW_MESSAGE'::"text", 'LESSON_COMPLETED'::"text", 'REVIEW_AVAILABLE'::"text", 'REVIEW_RECEIVED'::"text"])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "method" "public"."payment_method" NOT NULL,
    "status" "public"."payment_status" DEFAULT 'PENDING'::"public"."payment_status" NOT NULL,
    "amount_in_cents" integer NOT NULL,
    "external_transaction_id" character varying(255),
    "idempotency_key" character varying(255) NOT NULL,
    "gateway_provider" character varying(50) DEFAULT 'supabase_gateway'::character varying NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "paid_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "student_id" "uuid",
    "provider_id" "uuid",
    "platform_fee_in_cents" integer DEFAULT 0 NOT NULL,
    "provider_amount_in_cents" integer DEFAULT 0 NOT NULL,
    "gateway_fee_in_cents" integer DEFAULT 0,
    "pix_qr_code" "text",
    "pix_qr_code_base64" "text",
    "pix_expires_at" timestamp with time zone,
    "card_last4" character varying(4),
    "card_brand" character varying(50),
    "failed_at" timestamp with time zone,
    "cancelled_at" timestamp with time zone,
    "refunded_at" timestamp with time zone,
    CONSTRAINT "payments_amount_check" CHECK (("amount_in_cents" > 0)),
    CONSTRAINT "payments_amount_in_cents_check" CHECK (("amount_in_cents" > 0))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payouts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "amount_in_cents" integer NOT NULL,
    "status" "public"."payout_status" DEFAULT 'PENDING'::"public"."payout_status" NOT NULL,
    "scheduled_release_at" timestamp with time zone NOT NULL,
    "released_at" timestamp with time zone,
    "external_payout_id" character varying(255),
    "idempotency_key" character varying(255) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payouts_amount_in_cents_check" CHECK (("amount_in_cents" >= 0))
);


ALTER TABLE "public"."payouts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_configurations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "key" character varying(100) NOT NULL,
    "value" "jsonb" NOT NULL,
    "description" "text",
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."platform_configurations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quotes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "provider_id" "uuid" NOT NULL,
    "instructor_id" "uuid" NOT NULL,
    "vehicle_id" "uuid" NOT NULL,
    "offering_id" "uuid" NOT NULL,
    "scheduled_start_at" timestamp with time zone NOT NULL,
    "scheduled_end_at" timestamp with time zone NOT NULL,
    "price_in_cents" integer NOT NULL,
    "platform_fee_in_cents" integer NOT NULL,
    "total_in_cents" integer NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "public"."quote_status" DEFAULT 'ACTIVE'::"public"."quote_status" NOT NULL,
    "consumed_at" timestamp with time zone,
    "idempotency_key" character varying(255),
    "selection_mode" "public"."booking_selection_mode" DEFAULT 'SPECIFIC_INSTRUCTOR'::"public"."booking_selection_mode" NOT NULL,
    CONSTRAINT "quotes_check" CHECK (("scheduled_start_at" < "scheduled_end_at")),
    CONSTRAINT "quotes_platform_fee_in_cents_check" CHECK (("platform_fee_in_cents" >= 0)),
    CONSTRAINT "quotes_price_in_cents_check" CHECK (("price_in_cents" > 0)),
    CONSTRAINT "quotes_total_in_cents_check" CHECK (("total_in_cents" > 0))
);


ALTER TABLE "public"."quotes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."refunds" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payment_id" "uuid" NOT NULL,
    "booking_id" "uuid" NOT NULL,
    "amount_in_cents" integer NOT NULL,
    "reason" character varying(255) NOT NULL,
    "external_refund_id" character varying(255),
    "idempotency_key" character varying(255) NOT NULL,
    "status" character varying(50) DEFAULT 'PROCESSED'::character varying NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "refunds_amount_in_cents_check" CHECK (("amount_in_cents" > 0))
);


ALTER TABLE "public"."refunds" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."role_permissions" (
    "role" "public"."user_role" NOT NULL,
    "permission" "public"."app_permission" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."role_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_custom_permissions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "permission" "public"."app_permission" NOT NULL,
    "is_granted" boolean DEFAULT true NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "granted_by" "uuid"
);


ALTER TABLE "public"."user_custom_permissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."user_role" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "granted_by" "uuid"
);


ALTER TABLE "public"."user_roles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."availabilities"
    ADD CONSTRAINT "availabilities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."availability_exceptions"
    ADD CONSTRAINT "availability_exceptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cancellation_policies"
    ADD CONSTRAINT "cancellation_policies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cancellation_policy_rules"
    ADD CONSTRAINT "cancellation_policy_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_documents"
    ADD CONSTRAINT "compliance_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."compliance_requirements"
    ADD CONSTRAINT "compliance_requirements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_booking_id_key" UNIQUE ("booking_id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driving_school_invitations"
    ADD CONSTRAINT "driving_school_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driving_school_membership_events"
    ADD CONSTRAINT "driving_school_membership_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driving_school_staff"
    ADD CONSTRAINT "driving_school_staff_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."driving_school_staff"
    ADD CONSTRAINT "driving_school_staff_school_id_user_id_key" UNIQUE ("school_id", "user_id");



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "exclude_instructor_overlapping_bookings" EXCLUDE USING "gist" ("instructor_id" WITH =, "slot_range" WITH &&) WHERE (("status" = ANY (ARRAY['PENDING_PAYMENT'::"public"."booking_status", 'CONFIRMED'::"public"."booking_status", 'IN_PROGRESS'::"public"."booking_status"])));



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "exclude_student_overlapping_bookings" EXCLUDE USING "gist" ("student_id" WITH =, "slot_range" WITH &&) WHERE (("status" = ANY (ARRAY['PENDING_PAYMENT'::"public"."booking_status", 'CONFIRMED'::"public"."booking_status", 'IN_PROGRESS'::"public"."booking_status"])));



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "exclude_vehicle_overlapping_bookings" EXCLUDE USING "gist" ("vehicle_id" WITH =, "slot_range" WITH &&) WHERE (("status" = ANY (ARRAY['PENDING_PAYMENT'::"public"."booking_status", 'CONFIRMED'::"public"."booking_status", 'IN_PROGRESS'::"public"."booking_status"])));






ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");






ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_configurations"
    ADD CONSTRAINT "platform_configurations_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."platform_configurations"
    ADD CONSTRAINT "platform_configurations_pkey" PRIMARY KEY ("id");






ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."quotes"
    ADD CONSTRAINT "quotes_total_equals_price_check" CHECK (("total_in_cents" = "price_in_cents")) NOT VALID;



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_idempotency_key_key" UNIQUE ("idempotency_key");



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_booking_id_key" UNIQUE ("booking_id");



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."role_permissions"
    ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role", "permission");



ALTER TABLE ONLY "public"."service_offerings"
    ADD CONSTRAINT "service_offerings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_custom_permissions"
    ADD CONSTRAINT "user_custom_permissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_custom_permissions"
    ADD CONSTRAINT "user_custom_permissions_user_id_permission_key" UNIQUE ("user_id", "permission");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_role_key" UNIQUE ("user_id", "role");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "driving_school_invitations_pending_email_uidx" ON "public"."driving_school_invitations" USING "btree" ("school_id", "lower"("btrim"(("invited_email")::"text"))) WHERE (("status" = 'PENDING'::"public"."school_invitation_status") AND ("invited_email" IS NOT NULL));



CREATE UNIQUE INDEX "driving_school_invitations_pending_user_uidx" ON "public"."driving_school_invitations" USING "btree" ("school_id", "target_user_id") WHERE (("status" = 'PENDING'::"public"."school_invitation_status") AND ("target_user_id" IS NOT NULL));



CREATE INDEX "driving_school_membership_events_membership_idx" ON "public"."driving_school_membership_events" USING "btree" ("membership_id", "created_at" DESC);



CREATE INDEX "driving_school_membership_events_school_user_idx" ON "public"."driving_school_membership_events" USING "btree" ("school_id", "user_id", "created_at" DESC);



CREATE INDEX "idx_analytics_events_actor_created_at" ON "public"."analytics_events" USING "btree" ("actor_id", "created_at" DESC) WHERE ("actor_id" IS NOT NULL);



CREATE INDEX "idx_analytics_events_event_created_at" ON "public"."analytics_events" USING "btree" ("event_name", "created_at" DESC);



CREATE INDEX "idx_audit_logs_actor" ON "public"."audit_logs" USING "btree" ("actor_id", "created_at");



CREATE INDEX "idx_audit_logs_entity" ON "public"."audit_logs" USING "btree" ("entity_type", "entity_id");



CREATE INDEX "idx_availabilities_instructor" ON "public"."availabilities" USING "btree" ("instructor_id");



CREATE INDEX "idx_availabilities_provider_dow" ON "public"."availabilities" USING "btree" ("provider_id", "day_of_week", "is_active");



CREATE INDEX "idx_availabilities_vehicle" ON "public"."availabilities" USING "btree" ("vehicle_id");



CREATE INDEX "idx_availability_exceptions_active_range" ON "public"."availability_exceptions" USING "btree" ("provider_id", "is_active", "start_at", "end_at");



CREATE INDEX "idx_bookings_created_status_provider" ON "public"."bookings" USING "btree" ("created_at", "status", "provider_id");



CREATE INDEX "idx_bookings_hold_expiration" ON "public"."bookings" USING "btree" ("status", "hold_expires_at") WHERE ("status" = 'PENDING_PAYMENT'::"public"."booking_status");



CREATE INDEX "idx_bookings_idempotency" ON "public"."bookings" USING "btree" ("idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "idx_bookings_instructor_dates" ON "public"."bookings" USING "btree" ("instructor_id", "scheduled_start_at");



CREATE INDEX "idx_bookings_offering_id" ON "public"."bookings" USING "btree" ("offering_id");



CREATE INDEX "idx_bookings_provider" ON "public"."bookings" USING "btree" ("provider_id", "status");



CREATE INDEX "idx_bookings_provider_schedule" ON "public"."bookings" USING "btree" ("provider_id", "scheduled_start_at");



CREATE INDEX "idx_bookings_quote_id" ON "public"."bookings" USING "btree" ("quote_id");



CREATE INDEX "idx_bookings_status_dates" ON "public"."bookings" USING "btree" ("status", "scheduled_start_at");



CREATE INDEX "idx_bookings_student" ON "public"."bookings" USING "btree" ("student_id", "status");



CREATE INDEX "idx_bookings_student_active_slots" ON "public"."bookings" USING "btree" ("student_id", "scheduled_start_at", "scheduled_end_at") WHERE ("status" = ANY (ARRAY['PENDING_PAYMENT'::"public"."booking_status", 'CONFIRMED'::"public"."booking_status", 'IN_PROGRESS'::"public"."booking_status"]));



CREATE INDEX "idx_bookings_student_history" ON "public"."bookings" USING "btree" ("student_id", "scheduled_start_at" DESC);



CREATE INDEX "idx_bookings_vehicle_dates" ON "public"."bookings" USING "btree" ("vehicle_id", "scheduled_start_at");



CREATE INDEX "idx_compliance_documents_membership_id" ON "public"."compliance_documents" USING "btree" ("membership_id");



CREATE INDEX "idx_compliance_documents_provider_id" ON "public"."compliance_documents" USING "btree" ("provider_id");



CREATE INDEX "idx_compliance_documents_reviewed_by" ON "public"."compliance_documents" USING "btree" ("reviewed_by");



CREATE INDEX "idx_compliance_documents_scope_user_type" ON "public"."compliance_documents" USING "btree" ("scope", "user_id", "document_type");



CREATE INDEX "idx_compliance_documents_user_id" ON "public"."compliance_documents" USING "btree" ("user_id");



CREATE INDEX "idx_compliance_documents_vehicle_id" ON "public"."compliance_documents" USING "btree" ("vehicle_id");



CREATE INDEX "idx_conversations_booking_id" ON "public"."conversations" USING "btree" ("booking_id");



CREATE INDEX "idx_conversations_instructor_id" ON "public"."conversations" USING "btree" ("instructor_id");



CREATE INDEX "idx_conversations_provider_id" ON "public"."conversations" USING "btree" ("provider_id");



CREATE INDEX "idx_conversations_student_id" ON "public"."conversations" USING "btree" ("student_id");



CREATE INDEX "idx_conversations_updated_at" ON "public"."conversations" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_driving_school_staff_user_id" ON "public"."driving_school_staff" USING "btree" ("user_id");



CREATE INDEX "idx_exceptions_instructor_dates" ON "public"."availability_exceptions" USING "btree" ("instructor_id");



CREATE INDEX "idx_exceptions_provider_dates" ON "public"."availability_exceptions" USING "btree" ("provider_id", "start_at", "end_at");



CREATE INDEX "idx_exceptions_vehicle_dates" ON "public"."availability_exceptions" USING "btree" ("vehicle_id");



CREATE INDEX "idx_instructor_global_blocks_search" ON "public"."instructor_global_blocks" USING "btree" ("instructor_id", "start_at", "end_at");



CREATE INDEX "idx_membership_events_actor_id" ON "public"."driving_school_membership_events" USING "btree" ("actor_id");



CREATE INDEX "idx_membership_events_invitation_id" ON "public"."driving_school_membership_events" USING "btree" ("invitation_id");



CREATE INDEX "idx_membership_events_user_id" ON "public"."driving_school_membership_events" USING "btree" ("user_id");



CREATE INDEX "idx_messages_conversation_created_at" ON "public"."messages" USING "btree" ("conversation_id", "created_at");



CREATE INDEX "idx_messages_sender_id" ON "public"."messages" USING "btree" ("sender_id");



CREATE INDEX "idx_notifications_entity" ON "public"."notifications" USING "btree" ("entity_type", "entity_id");



CREATE UNIQUE INDEX "idx_notifications_unique_lesson_events" ON "public"."notifications" USING "btree" ("user_id", "type", "entity_type", "entity_id") WHERE ("type" = ANY (ARRAY['BOOKING_CONFIRMED'::"text", 'BOOKING_CANCELLED'::"text", 'LESSON_COMPLETED'::"text", 'REVIEW_AVAILABLE'::"text"]));



CREATE INDEX "idx_notifications_user_unread_created_at" ON "public"."notifications" USING "btree" ("user_id", "is_read", "created_at" DESC);



CREATE INDEX "idx_offerings_provider_active" ON "public"."service_offerings" USING "btree" ("provider_id", "is_active");



CREATE INDEX "idx_payments_booking" ON "public"."payments" USING "btree" ("booking_id");



CREATE INDEX "idx_payments_created_status_booking" ON "public"."payments" USING "btree" ("created_at", "status", "booking_id");



CREATE INDEX "idx_payments_status" ON "public"."payments" USING "btree" ("status");



CREATE INDEX "idx_payouts_booking_id" ON "public"."payouts" USING "btree" ("booking_id");



CREATE INDEX "idx_payouts_provider_status" ON "public"."payouts" USING "btree" ("provider_id", "status");



CREATE INDEX "idx_payouts_release_dates" ON "public"."payouts" USING "btree" ("scheduled_release_at") WHERE ("status" = 'PENDING'::"public"."payout_status");



CREATE INDEX "idx_providers_location_geog_gist" ON "public"."providers" USING "gist" ("location_geography");



CREATE INDEX "idx_providers_location_gist" ON "public"."providers" USING "gist" ("location");



CREATE INDEX "idx_providers_public_location_gist" ON "public"."providers" USING "gist" ((("public"."st_setsrid"("public"."st_makepoint"("public_longitude", "public_latitude"), 4326))::"public"."geography"));



CREATE INDEX "idx_providers_status" ON "public"."providers" USING "btree" ("status");



CREATE INDEX "idx_providers_user_id" ON "public"."providers" USING "btree" ("user_id");



CREATE INDEX "idx_quotes_created_provider" ON "public"."quotes" USING "btree" ("created_at", "provider_id");



CREATE INDEX "idx_quotes_instructor_id" ON "public"."quotes" USING "btree" ("instructor_id");



CREATE INDEX "idx_quotes_offering_id" ON "public"."quotes" USING "btree" ("offering_id");



CREATE INDEX "idx_quotes_provider_id" ON "public"."quotes" USING "btree" ("provider_id");



CREATE INDEX "idx_quotes_student_status_expires" ON "public"."quotes" USING "btree" ("student_id", "status", "expires_at");



CREATE INDEX "idx_quotes_vehicle_id" ON "public"."quotes" USING "btree" ("vehicle_id");



CREATE INDEX "idx_refunds_booking_id" ON "public"."refunds" USING "btree" ("booking_id");



CREATE INDEX "idx_refunds_payment_id" ON "public"."refunds" USING "btree" ("payment_id");



CREATE INDEX "idx_reviews_created_provider" ON "public"."reviews" USING "btree" ("created_at", "provider_id");



CREATE INDEX "idx_reviews_instructor_id" ON "public"."reviews" USING "btree" ("instructor_id");



CREATE INDEX "idx_reviews_provider_created_at" ON "public"."reviews" USING "btree" ("provider_id", "created_at" DESC);



CREATE INDEX "idx_reviews_student_id" ON "public"."reviews" USING "btree" ("student_id");



CREATE INDEX "idx_school_invitations_invited_by" ON "public"."driving_school_invitations" USING "btree" ("invited_by");



CREATE INDEX "idx_school_invitations_target_user_id" ON "public"."driving_school_invitations" USING "btree" ("target_user_id");



CREATE INDEX "idx_service_offerings_instructor_id" ON "public"."service_offerings" USING "btree" ("instructor_id");



CREATE INDEX "idx_service_offerings_provider_status" ON "public"."service_offerings" USING "btree" ("provider_id", "status");



CREATE INDEX "idx_service_offerings_search_price" ON "public"."service_offerings" USING "btree" ("provider_id", "category", "transmission", "price_in_cents") WHERE (("is_active" = true) AND (("status")::"text" = 'ACTIVE'::"text"));



CREATE INDEX "idx_service_offerings_vehicle" ON "public"."service_offerings" USING "btree" ("vehicle_id");



CREATE UNIQUE INDEX "idx_uniq_active_offering" ON "public"."service_offerings" USING "btree" ("provider_id", "instructor_id", "vehicle_id", "category", "duration_minutes") WHERE ((("status")::"text" = 'ACTIVE'::"text") AND ("is_active" IS TRUE));



CREATE INDEX "idx_user_roles_granted_by" ON "public"."user_roles" USING "btree" ("granted_by");



CREATE UNIQUE INDEX "idx_users_cpf_unique" ON "public"."users" USING "btree" ("cpf") WHERE (("cpf" IS NOT NULL) AND ("deleted_at" IS NULL));



CREATE INDEX "idx_vehicles_category" ON "public"."vehicles" USING "btree" ("category", "transmission");



CREATE INDEX "idx_vehicles_provider_status" ON "public"."vehicles" USING "btree" ("provider_id", "status");



CREATE UNIQUE INDEX "service_offerings_active_equivalence_idx" ON "public"."service_offerings" USING "btree" ("provider_id", "instructor_id", "vehicle_id", "category", "transmission", "duration_minutes") WHERE (("status")::"text" = 'ACTIVE'::"text");



CREATE OR REPLACE TRIGGER "enforce_booking_instructor_eligibility" BEFORE INSERT OR UPDATE ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_booking_instructor_eligibility"();



CREATE OR REPLACE TRIGGER "enforce_quote_instructor_eligibility" BEFORE INSERT ON "public"."quotes" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_quote_instructor_eligibility"();



CREATE OR REPLACE TRIGGER "prevent_booking_during_instructor_global_block_trigger" BEFORE INSERT OR UPDATE OF "instructor_id", "scheduled_start_at", "scheduled_end_at", "status" ON "public"."bookings" FOR EACH ROW WHEN (("new"."status" = ANY (ARRAY['PENDING_PAYMENT'::"public"."booking_status", 'CONFIRMED'::"public"."booking_status", 'IN_PROGRESS'::"public"."booking_status"]))) EXECUTE FUNCTION "public"."prevent_booking_during_instructor_global_block"();



CREATE OR REPLACE TRIGGER "record_school_invitation_event" AFTER INSERT ON "public"."driving_school_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."record_school_invitation_event"();



CREATE OR REPLACE TRIGGER "record_school_membership_status_event" AFTER INSERT OR UPDATE OF "membership_status" ON "public"."driving_school_staff" FOR EACH ROW EXECUTE FUNCTION "public"."record_school_membership_status_event"();



CREATE OR REPLACE TRIGGER "sync_school_staff_membership_status" BEFORE INSERT OR UPDATE ON "public"."driving_school_staff" FOR EACH ROW EXECUTE FUNCTION "public"."sync_school_staff_membership_status"();



CREATE OR REPLACE TRIGGER "trg_availabilities_resource_scope" BEFORE INSERT OR UPDATE ON "public"."availabilities" FOR EACH ROW EXECUTE FUNCTION "public"."validate_availability_resource_scope"();



CREATE OR REPLACE TRIGGER "trg_availabilities_schedule_lock" BEFORE INSERT OR DELETE OR UPDATE ON "public"."availabilities" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_schedule_lock_on_availability"();



CREATE OR REPLACE TRIGGER "trg_booking_completion_notifications" AFTER UPDATE OF "status" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."create_booking_completion_notifications"();



CREATE OR REPLACE TRIGGER "trg_booking_schedule_exceptions" BEFORE INSERT OR UPDATE OF "provider_id", "instructor_id", "vehicle_id", "scheduled_start_at", "scheduled_end_at", "status" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_booking_schedule_exceptions"();



CREATE OR REPLACE TRIGGER "trg_normalize_booking_snapshot_names" BEFORE INSERT OR UPDATE OF "instructor_id", "provider_id", "vehicle_id", "snapshot_data" ON "public"."bookings" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_booking_snapshot_names"();



CREATE OR REPLACE TRIGGER "trg_sync_primary_user_role" AFTER INSERT OR UPDATE OF "role" ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."sync_primary_user_role"();



CREATE OR REPLACE TRIGGER "trg_validate_user_student_identity" BEFORE INSERT OR UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_validate_user_student_identity"();



CREATE CONSTRAINT TRIGGER "validate_compliance_document_membership_user" AFTER INSERT OR UPDATE OF "scope", "membership_id", "user_id" ON "public"."compliance_documents" DEFERRABLE INITIALLY IMMEDIATE FOR EACH ROW EXECUTE FUNCTION "public"."validate_compliance_document_membership_user"();



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."availabilities"
    ADD CONSTRAINT "availabilities_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."availabilities"
    ADD CONSTRAINT "availabilities_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."availabilities"
    ADD CONSTRAINT "availabilities_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."availability_exceptions"
    ADD CONSTRAINT "availability_exceptions_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."availability_exceptions"
    ADD CONSTRAINT "availability_exceptions_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."availability_exceptions"
    ADD CONSTRAINT "availability_exceptions_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "public"."service_offerings"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."bookings"
    ADD CONSTRAINT "bookings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."cancellation_policy_rules"
    ADD CONSTRAINT "cancellation_policy_rules_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "public"."cancellation_policies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_documents"
    ADD CONSTRAINT "compliance_documents_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "public"."driving_school_staff"("id");



ALTER TABLE ONLY "public"."compliance_documents"
    ADD CONSTRAINT "compliance_documents_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_documents"
    ADD CONSTRAINT "compliance_documents_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."compliance_documents"
    ADD CONSTRAINT "compliance_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."compliance_documents"
    ADD CONSTRAINT "compliance_documents_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."driving_school_invitations"
    ADD CONSTRAINT "driving_school_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."driving_school_invitations"
    ADD CONSTRAINT "driving_school_invitations_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."providers"("id");



ALTER TABLE ONLY "public"."driving_school_invitations"
    ADD CONSTRAINT "driving_school_invitations_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."driving_school_membership_events"
    ADD CONSTRAINT "driving_school_membership_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."driving_school_membership_events"
    ADD CONSTRAINT "driving_school_membership_events_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "public"."driving_school_invitations"("id");



ALTER TABLE ONLY "public"."driving_school_membership_events"
    ADD CONSTRAINT "driving_school_membership_events_membership_id_fkey" FOREIGN KEY ("membership_id") REFERENCES "public"."driving_school_staff"("id");



ALTER TABLE ONLY "public"."driving_school_membership_events"
    ADD CONSTRAINT "driving_school_membership_events_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."providers"("id");



ALTER TABLE ONLY "public"."driving_school_membership_events"
    ADD CONSTRAINT "driving_school_membership_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."driving_school_staff"
    ADD CONSTRAINT "driving_school_staff_ended_by_fkey" FOREIGN KEY ("ended_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."driving_school_staff"
    ADD CONSTRAINT "driving_school_staff_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."driving_school_staff"
    ADD CONSTRAINT "driving_school_staff_source_invitation_id_fkey" FOREIGN KEY ("source_invitation_id") REFERENCES "public"."driving_school_invitations"("id");



ALTER TABLE ONLY "public"."driving_school_staff"
    ADD CONSTRAINT "driving_school_staff_suspended_by_fkey" FOREIGN KEY ("suspended_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."driving_school_staff"
    ADD CONSTRAINT "driving_school_staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;






ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payouts"
    ADD CONSTRAINT "payouts_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."platform_configurations"
    ADD CONSTRAINT "platform_configurations_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;






ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."providers"
    ADD CONSTRAINT "providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_offering_id_fkey" FOREIGN KEY ("offering_id") REFERENCES "public"."service_offerings"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."quotes"
    ADD CONSTRAINT "quotes_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."refunds"
    ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."reviews"
    ADD CONSTRAINT "reviews_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."service_offerings"
    ADD CONSTRAINT "service_offerings_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."service_offerings"
    ADD CONSTRAINT "service_offerings_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."service_offerings"
    ADD CONSTRAINT "service_offerings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."user_custom_permissions"
    ADD CONSTRAINT "user_custom_permissions_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_custom_permissions"
    ADD CONSTRAINT "user_custom_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_roles"
    ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vehicles"
    ADD CONSTRAINT "vehicles_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "public"."providers"("id") ON DELETE RESTRICT;



CREATE POLICY "Admins can manage all providers" ON "public"."providers" TO "authenticated" USING ("public"."is_platform_admin"()) WITH CHECK ("public"."is_platform_admin"());



CREATE POLICY "Admins can review compliance documents" ON "public"."compliance_documents" FOR UPDATE TO "authenticated" USING (("public"."is_current_user_active"() AND "public"."is_compliance_reviewer"())) WITH CHECK (("public"."is_current_user_active"() AND "public"."is_compliance_reviewer"()));



CREATE POLICY "Anyone can view active service offerings" ON "public"."service_offerings" FOR SELECT TO "authenticated", "anon" USING (("is_active" = true));



CREATE POLICY "Authenticated users can create own student profile" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK ((("id" = "auth"."uid"()) AND ("role" = 'STUDENT'::"public"."user_role") AND ("status" = 'ACTIVE'::"public"."user_status") AND ("lower"(("email")::"text") = "lower"(COALESCE(("auth"."jwt"() ->> 'email'::"text"), ''::"text"))) AND (("cpf" IS NOT NULL) AND ("length"(("cpf")::"text") = 11) AND "public"."validate_cpf"(("cpf")::"text")) AND (("birth_date" IS NOT NULL) AND ("birth_date" <= (CURRENT_DATE - '18 years'::interval)))));



CREATE POLICY "Authenticated users can read role permissions" ON "public"."role_permissions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Parties can read own payments" ON "public"."payments" FOR SELECT TO "authenticated" USING (("public"."is_current_user_active"() AND (("booking_id" IN ( SELECT "bookings"."id"
   FROM "public"."bookings"
  WHERE (("bookings"."student_id" = "auth"."uid"()) OR ("bookings"."instructor_id" = "auth"."uid"())))) OR "public"."is_platform_admin"())));



CREATE POLICY "Providers can create initial draft profile" ON "public"."providers" FOR INSERT TO "authenticated" WITH CHECK (("public"."is_current_user_active"() AND ("user_id" = "auth"."uid"()) AND ("status" = 'DRAFT'::"public"."provider_status")));



CREATE POLICY "Providers can read own compliance documents" ON "public"."compliance_documents" FOR SELECT TO "authenticated" USING (("public"."is_current_user_active"() AND ("public"."is_provider_owner"("provider_id") OR ("user_id" = "auth"."uid"()) OR "public"."is_compliance_reviewer"())));



CREATE POLICY "Providers can update own draft or pending profile" ON "public"."providers" FOR UPDATE TO "authenticated" USING (("public"."is_current_user_active"() AND "public"."is_provider_owner"("id") AND ("status" = ANY (ARRAY['DRAFT'::"public"."provider_status", 'PENDING_REVIEW'::"public"."provider_status", 'REJECTED'::"public"."provider_status"])))) WITH CHECK (("public"."is_current_user_active"() AND "public"."is_provider_owner"("id") AND ("status" = ANY (ARRAY['DRAFT'::"public"."provider_status", 'PENDING_REVIEW'::"public"."provider_status"]))));



CREATE POLICY "Providers can view own provider record" ON "public"."providers" FOR SELECT TO "authenticated" USING (("public"."is_current_user_active"() AND ("public"."is_provider_owner"("id") OR "public"."is_platform_admin"())));



CREATE POLICY "Public can view active approved providers" ON "public"."providers" FOR SELECT TO "authenticated", "anon" USING (("status" = 'ACTIVE'::"public"."provider_status"));



CREATE POLICY "Public can view active compliance requirements" ON "public"."compliance_requirements" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public can view active providers" ON "public"."providers" FOR SELECT USING (("status" = 'ACTIVE'::"public"."provider_status"));



CREATE POLICY "School staff and members can view their school team" ON "public"."driving_school_staff" FOR SELECT TO "authenticated" USING (("public"."is_current_user_active"() AND ("public"."is_school_member"("school_id") OR ("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_platform_admin"())));



CREATE POLICY "Users can read own profile" ON "public"."users" FOR SELECT TO "authenticated" USING ((((( SELECT "auth"."uid"() AS "uid") = "id") AND ("status" = 'ACTIVE'::"public"."user_status")) OR "public"."is_platform_admin"()));



CREATE POLICY "Users can update own profile" ON "public"."users" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "id") AND ("status" = 'ACTIVE'::"public"."user_status"))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "id") AND ("status" = 'ACTIVE'::"public"."user_status")));



CREATE POLICY "Users can view own custom permissions" ON "public"."user_custom_permissions" FOR SELECT TO "authenticated" USING ((("user_id" = "auth"."uid"()) OR "public"."is_platform_admin"()));



CREATE POLICY "Users can view own roles" ON "public"."user_roles" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR "public"."is_platform_admin"()));



ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "analytics_events_no_direct_client_delete" ON "public"."analytics_events" FOR DELETE USING (false);



CREATE POLICY "analytics_events_no_direct_client_insert" ON "public"."analytics_events" FOR INSERT WITH CHECK (false);



CREATE POLICY "analytics_events_no_direct_client_select" ON "public"."analytics_events" FOR SELECT USING (false);



CREATE POLICY "analytics_events_no_direct_client_update" ON "public"."analytics_events" FOR UPDATE USING (false) WITH CHECK (false);



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "audit_logs_no_direct_client_delete" ON "public"."audit_logs" FOR DELETE USING (false);



CREATE POLICY "audit_logs_no_direct_client_insert" ON "public"."audit_logs" FOR INSERT WITH CHECK (false);



CREATE POLICY "audit_logs_no_direct_client_select" ON "public"."audit_logs" FOR SELECT USING (false);



CREATE POLICY "audit_logs_no_direct_client_update" ON "public"."audit_logs" FOR UPDATE USING (false) WITH CHECK (false);



ALTER TABLE "public"."availabilities" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "availabilities_manager_select" ON "public"."availabilities" FOR SELECT TO "authenticated" USING ("public"."can_manage_provider_schedule"("provider_id"));



ALTER TABLE "public"."availability_exceptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bookings" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bookings_authenticated_select" ON "public"."bookings" FOR SELECT TO "authenticated" USING ((( SELECT "public"."is_current_user_active"() AS "is_current_user_active") AND (("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("instructor_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "bookings"."provider_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR ( SELECT "public"."is_platform_admin"() AS "is_platform_admin"))));



ALTER TABLE "public"."cancellation_policies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cancellation_policies_no_direct_client_delete" ON "public"."cancellation_policies" FOR DELETE USING (false);



CREATE POLICY "cancellation_policies_no_direct_client_insert" ON "public"."cancellation_policies" FOR INSERT WITH CHECK (false);



CREATE POLICY "cancellation_policies_no_direct_client_select" ON "public"."cancellation_policies" FOR SELECT USING (false);



CREATE POLICY "cancellation_policies_no_direct_client_update" ON "public"."cancellation_policies" FOR UPDATE USING (false) WITH CHECK (false);



ALTER TABLE "public"."cancellation_policy_rules" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cancellation_policy_rules_no_direct_client_delete" ON "public"."cancellation_policy_rules" FOR DELETE USING (false);



CREATE POLICY "cancellation_policy_rules_no_direct_client_insert" ON "public"."cancellation_policy_rules" FOR INSERT WITH CHECK (false);



CREATE POLICY "cancellation_policy_rules_no_direct_client_select" ON "public"."cancellation_policy_rules" FOR SELECT USING (false);



CREATE POLICY "cancellation_policy_rules_no_direct_client_update" ON "public"."cancellation_policy_rules" FOR UPDATE USING (false) WITH CHECK (false);



ALTER TABLE "public"."compliance_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."compliance_requirements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversations_select_participants" ON "public"."conversations" FOR SELECT TO "authenticated" USING ("public"."is_booking_participant"("booking_id"));



ALTER TABLE "public"."driving_school_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driving_school_membership_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."driving_school_staff" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "exceptions_owner_delete" ON "public"."availability_exceptions" FOR DELETE USING ("public"."can_manage_provider_schedule"("provider_id"));



CREATE POLICY "exceptions_owner_insert" ON "public"."availability_exceptions" FOR INSERT WITH CHECK ("public"."can_manage_provider_schedule"("provider_id"));



CREATE POLICY "exceptions_owner_select" ON "public"."availability_exceptions" FOR SELECT USING ("public"."can_manage_provider_schedule"("provider_id"));



CREATE POLICY "exceptions_owner_update" ON "public"."availability_exceptions" FOR UPDATE USING ("public"."can_manage_provider_schedule"("provider_id")) WITH CHECK ("public"."can_manage_provider_schedule"("provider_id"));







ALTER TABLE "public"."instructor_global_blocks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "instructor_global_blocks_owner_select" ON "public"."instructor_global_blocks" FOR SELECT TO "authenticated" USING ((("instructor_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."is_platform_admin"() AS "is_platform_admin")));



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages_select_participants" ON "public"."messages" FOR SELECT TO "authenticated" USING ("public"."is_conversation_participant"("conversation_id"));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notifications_select_own" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("public"."is_current_user_active"() AND ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "notifications_update_read_own" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("public"."is_current_user_active"() AND ("user_id" = ( SELECT "auth"."uid"() AS "uid")))) WITH CHECK (("public"."is_current_user_active"() AND ("user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "offerings_owner_select" ON "public"."service_offerings" FOR SELECT TO "authenticated" USING (("public"."is_current_user_active"() AND (("provider_id" IN ( SELECT "p"."id"
   FROM "public"."providers" "p"
  WHERE ("p"."user_id" = "auth"."uid"()))) OR "public"."is_school_admin"("provider_id") OR "public"."is_platform_admin"())));



CREATE POLICY "offerings_public_select" ON "public"."service_offerings" FOR SELECT USING (((("status")::"text" = 'ACTIVE'::"text") OR ("provider_id" IN ( SELECT "p"."id"
   FROM "public"."providers" "p"
  WHERE ("p"."user_id" = "auth"."uid"()))) OR (("auth"."jwt"() ->> 'role'::"text") = 'PLATFORM_ADMIN'::"text")));





ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."payouts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payouts_no_direct_client_delete" ON "public"."payouts" FOR DELETE USING (false);



CREATE POLICY "payouts_no_direct_client_insert" ON "public"."payouts" FOR INSERT WITH CHECK (false);



CREATE POLICY "payouts_no_direct_client_select" ON "public"."payouts" FOR SELECT USING (false);



CREATE POLICY "payouts_no_direct_client_update" ON "public"."payouts" FOR UPDATE USING (false) WITH CHECK (false);



ALTER TABLE "public"."platform_configurations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "platform_configurations_no_direct_client_delete" ON "public"."platform_configurations" FOR DELETE USING (false);



CREATE POLICY "platform_configurations_no_direct_client_insert" ON "public"."platform_configurations" FOR INSERT WITH CHECK (false);



CREATE POLICY "platform_configurations_no_direct_client_select" ON "public"."platform_configurations" FOR SELECT USING (false);



CREATE POLICY "platform_configurations_no_direct_client_update" ON "public"."platform_configurations" FOR UPDATE USING (false) WITH CHECK (false);







ALTER TABLE "public"."providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."quotes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quotes_authenticated_select" ON "public"."quotes" FOR SELECT TO "authenticated" USING ((( SELECT "public"."is_current_user_active"() AS "is_current_user_active") AND (("student_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("instructor_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."providers" "p"
  WHERE (("p"."id" = "quotes"."provider_id") AND ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))) OR ( SELECT "public"."is_platform_admin"() AS "is_platform_admin"))));



ALTER TABLE "public"."refunds" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "refunds_no_direct_client_delete" ON "public"."refunds" FOR DELETE USING (false);



CREATE POLICY "refunds_no_direct_client_insert" ON "public"."refunds" FOR INSERT WITH CHECK (false);



CREATE POLICY "refunds_no_direct_client_select" ON "public"."refunds" FOR SELECT USING (false);



CREATE POLICY "refunds_no_direct_client_update" ON "public"."refunds" FOR UPDATE USING (false) WITH CHECK (false);



ALTER TABLE "public"."reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "reviews_select_authorized" ON "public"."reviews" FOR SELECT TO "authenticated" USING ("public"."can_access_provider_reviews"("provider_id", "student_id", "instructor_id"));



ALTER TABLE "public"."role_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."service_offerings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_custom_permissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."vehicles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "vehicles_owner_select" ON "public"."vehicles" FOR SELECT TO "authenticated" USING ((( SELECT "public"."is_current_user_active"() AS "is_current_user_active") AND (("provider_id" IN ( SELECT "p"."id"
   FROM "public"."providers" "p"
  WHERE ("p"."user_id" = ( SELECT "auth"."uid"() AS "uid")))) OR ( SELECT "public"."is_school_admin"("vehicles"."provider_id") AS "is_school_admin") OR ( SELECT "public"."is_platform_admin"() AS "is_platform_admin"))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."messages";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d_out"("public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2df_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2df_out"("public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d_out"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey16_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey16_out"("public"."gbtreekey16") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey2_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey2_out"("public"."gbtreekey2") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey32_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey32_out"("public"."gbtreekey32") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey4_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey4_out"("public"."gbtreekey4") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey8_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey8_out"("public"."gbtreekey8") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "anon";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbtreekey_var_out"("public"."gbtreekey_var") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_analyze"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_out"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_send"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_typmod_out"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_analyze"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_out"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_recv"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_send"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_typmod_out"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gidx_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gidx_out"("public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."spheroid_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."spheroid_out"("public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d"("public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography"("public"."geography", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."bytea"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("public"."geometry", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."json"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."jsonb"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."path"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."point"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."polygon"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."text"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("path") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("path") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("path") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("path") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("point") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("point") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("point") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("point") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("polygon") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry"("text") TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_deprecate"("oldname" "text", "newname" "text", "version" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_index_extent"("tbl" "regclass", "col" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_join_selectivity"("regclass", "text", "regclass", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_pgsql_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_scripts_pgsql_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_selectivity"("tbl" "regclass", "att_name" "text", "geom" "public"."geometry", "mode" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_postgis_stats"("tbl" "regclass", "att_name" "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_asgml"(integer, "public"."geometry", integer, integer, "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_asx3d"(integer, "public"."geometry", integer, integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_bestsrid"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distancetree"("public"."geography", "public"."geography", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_distanceuncached"("public"."geography", "public"."geography", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_dwithinuncached"("public"."geography", "public"."geography", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_expand"("public"."geography", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_geomfromgml"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_pointoutside"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_sortablehash"("geom" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_voronoi"("g1" "public"."geometry", "clip" "public"."geometry", "tolerance" double precision, "return_polygons" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."_st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



REVOKE ALL ON FUNCTION "public"."accept_school_instructor_invitation"("p_invitation_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_school_instructor_invitation"("p_invitation_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."addauth"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."addauth"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."addauth"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."addauth"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."addgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer, "new_type" character varying, "new_dim" integer, "use_typmod" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_refund_mock_booking"("p_booking_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_refund_mock_booking"("p_booking_id" "uuid", "p_reason" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geom" "public"."geometry", "srid" integer) TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."providers" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."providers" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."providers" TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_review_provider"("p_provider_id" "uuid", "p_status" "public"."provider_status", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_review_provider"("p_provider_id" "uuid", "p_status" "public"."provider_status", "p_reason" "text") TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."users" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."users" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."users" TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_update_user_role"("p_user_id" "uuid", "p_role" "public"."user_role") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_update_user_role"("p_user_id" "uuid", "p_role" "public"."user_role") TO "authenticated";



GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."box3dtobox"("public"."box3d") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_access_provider_reviews"("p_provider_id" "uuid", "p_student_id" "uuid", "p_instructor_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_access_provider_reviews"("p_provider_id" "uuid", "p_student_id" "uuid", "p_instructor_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."can_manage_provider_schedule"("target_provider_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_provider_schedule"("target_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_manage_provider_schedule"("target_provider_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_manage_service_offering"("p_provider_id" "uuid", "p_instructor_id" "uuid", "p_vehicle_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_service_offering"("p_provider_id" "uuid", "p_instructor_id" "uuid", "p_vehicle_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."cancel_booking_v2"("p_booking_id" "uuid", "p_reason" "text", "p_reason_code" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_booking_v2"("p_booking_id" "uuid", "p_reason" "text", "p_reason_code" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."cancel_school_instructor_invitation"("p_invitation_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_school_instructor_invitation"("p_invitation_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "postgres";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "anon";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cash_dist"("money", "money") TO "service_role";



GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkauth"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "postgres";
GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "anon";
GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."checkauthtrigger"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."confirm_booking_payment"("p_payment_id" "uuid", "p_external_payment_id" character varying, "p_paid_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."confirm_booking_payment"("p_payment_id" "uuid", "p_external_payment_id" character varying, "p_paid_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_booking_payment"("p_payment_id" "uuid", "p_external_payment_id" character varying, "p_paid_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."box2df", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."contains_2d"("public"."geometry", "public"."box2df") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_booking_completion_notifications"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."create_booking_hold"("p_quote_id" "uuid", "p_student_id" "uuid", "p_idempotency_key" character varying, "p_hold_duration_minutes" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_booking_hold"("p_quote_id" "uuid", "p_student_id" "uuid", "p_idempotency_key" character varying, "p_hold_duration_minutes" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."create_booking_hold"("p_quote_id" "uuid", "p_student_id" "uuid", "p_idempotency_key" character varying, "p_hold_duration_minutes" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_booking_hold_at_meeting_point"("p_quote_id" "uuid", "p_student_id" "uuid", "p_idempotency_key" character varying, "p_meeting_point" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_booking_hold_at_meeting_point"("p_quote_id" "uuid", "p_student_id" "uuid", "p_idempotency_key" character varying, "p_meeting_point" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_booking_payment"("p_booking_id" "uuid", "p_method" "public"."payment_method", "p_idempotency_key" character varying, "p_gateway_provider" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_booking_payment"("p_booking_id" "uuid", "p_method" "public"."payment_method", "p_idempotency_key" character varying, "p_gateway_provider" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_booking_payment"("p_booking_id" "uuid", "p_method" "public"."payment_method", "p_idempotency_key" character varying, "p_gateway_provider" character varying) TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_instructor_emergency_block_if_free"("p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_instructor_emergency_block_if_free"("p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_quote_from_offering"("p_offering_id" "uuid", "p_scheduled_start_at" timestamp with time zone, "p_idempotency_key" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_quote_from_offering"("p_offering_id" "uuid", "p_scheduled_start_at" timestamp with time zone, "p_idempotency_key" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_quote_from_offering"("p_offering_id" "uuid", "p_scheduled_start_at" timestamp with time zone, "p_idempotency_key" character varying) TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reviews" TO "service_role";
GRANT SELECT ON TABLE "public"."reviews" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_review_for_booking"("p_booking_id" "uuid", "p_rating" integer, "p_comment" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_review_for_booking"("p_booking_id" "uuid", "p_rating" integer, "p_comment" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_school_instructor_invitation"("p_school_id" "uuid", "p_invited_email" "text", "p_invited_name" "text", "p_invited_phone" "text", "p_expires_in_days" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_school_instructor_invitation"("p_school_id" "uuid", "p_invited_email" "text", "p_invited_name" "text", "p_invited_phone" "text", "p_expires_in_days" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."current_user_has_permission"("p_permission" "public"."app_permission") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."current_user_has_permission"("p_permission" "public"."app_permission") TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_has_permission"("p_permission" "public"."app_permission") TO "service_role";



GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "postgres";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "anon";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."date_dist"("date", "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."decline_school_instructor_invitation"("p_invitation_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."decline_school_instructor_invitation"("p_invitation_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."delete_instructor_global_block"("p_block_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_instructor_global_block"("p_block_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_instructor_global_block"("p_block_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "postgres";
GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "anon";
GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."disablelongtransactions"() TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("table_name" character varying, "column_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrycolumn"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("table_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("schema_name" character varying, "table_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."dropgeometrytable"("catalog_name" character varying, "schema_name" character varying, "table_name" character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "postgres";
GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "anon";
GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enablelongtransactions"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."end_school_instructor_membership"("p_membership_id" "uuid", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."end_school_instructor_membership"("p_membership_id" "uuid", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."enforce_booking_instructor_eligibility"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."enforce_quote_instructor_eligibility"() FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "postgres";
GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "anon";
GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_srid"(character varying, character varying, character varying) TO "service_role";



GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "postgres";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "anon";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."float4_dist"(real, real) TO "service_role";



GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."float8_dist"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_consistent"("internal", bit, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bit_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_consistent"("internal", boolean, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_same"("public"."gbtreekey2", "public"."gbtreekey2", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bool_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bpchar_consistent"("internal", character, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_consistent"("internal", "bytea", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_bytea_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_consistent"("internal", "money", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_distance"("internal", "money", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_cash_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_consistent"("internal", "date", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_distance"("internal", "date", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_date_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_consistent"("internal", "anyenum", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_enum_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_consistent"("internal", real, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_distance"("internal", real, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float4_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_consistent"("internal", double precision, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_distance"("internal", double precision, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_float8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_consistent"("internal", "inet", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_inet_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_consistent"("internal", smallint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_distance"("internal", smallint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_same"("public"."gbtreekey4", "public"."gbtreekey4", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int2_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_consistent"("internal", integer, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_distance"("internal", integer, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int4_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_consistent"("internal", bigint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_distance"("internal", bigint, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_int8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_consistent"("internal", interval, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_distance"("internal", interval, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_intv_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_consistent"("internal", "macaddr8", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad8_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_consistent"("internal", "macaddr", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_macad_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_consistent"("internal", numeric, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_numeric_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_consistent"("internal", "oid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_distance"("internal", "oid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_same"("public"."gbtreekey8", "public"."gbtreekey8", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_oid_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_same"("public"."gbtreekey_var", "public"."gbtreekey_var", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_text_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_consistent"("internal", time without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_distance"("internal", time without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_time_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_timetz_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_timetz_consistent"("internal", time with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_consistent"("internal", timestamp without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_distance"("internal", timestamp without time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_same"("public"."gbtreekey16", "public"."gbtreekey16", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_ts_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_consistent"("internal", timestamp with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_tstz_distance"("internal", timestamp with time zone, smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_consistent"("internal", "uuid", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_same"("public"."gbtreekey32", "public"."gbtreekey32", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_uuid_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_var_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gbt_var_fetch"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geog_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_cmp"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_distance_knn"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_eq"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_ge"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_consistent"("internal", "public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_distance"("internal", "public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_same"("public"."box2d", "public"."box2d", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gist_union"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_gt"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_le"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_lt"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_overlaps"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_choose_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_compress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_config_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_inner_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_leaf_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geography_spgist_picksplit_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geom2d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geom3d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geom4d_brin_inclusion_add_value"("internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_above"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_below"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_cmp"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contained_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contains_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_contains_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_box"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_centroid_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_distance_cpa"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_eq"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_ge"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_compress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_2d"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_consistent_nd"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_decompress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_2d"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_distance_nd"("internal", "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_2d"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_penalty_nd"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_picksplit_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_2d"("geom1" "public"."geometry", "geom2" "public"."geometry", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_same_nd"("public"."geometry", "public"."geometry", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_sortsupport_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_2d"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gist_union_nd"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_gt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_hash"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_le"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_left"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_lt"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overabove"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overbelow"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overlaps_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overleft"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_overright"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_right"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_same"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_same_3d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_same_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_sortsupport"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_choose_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_2d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_3d"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_compress_nd"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_config_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_inner_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_leaf_consistent_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_2d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_3d"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_spgist_picksplit_nd"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometry_within_nd"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geometrytype"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geomfromewkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."geomfromewkt"("text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_admin_analytics_summary"("p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_admin_analytics_summary"("p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_admin_audit_logs"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_admin_audit_logs"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_admin_platform_configurations"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_admin_platform_configurations"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_available_slots_public"("p_offering_id" "uuid", "p_date_from" "date", "p_date_to" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_available_slots_public"("p_offering_id" "uuid", "p_date_from" "date", "p_date_to" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_available_slots_public"("p_offering_id" "uuid", "p_date_from" "date", "p_date_to" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_available_slots_public"("p_offering_id" "uuid", "p_date_from" "date", "p_date_to" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_booking_categories"("p_booking_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_booking_categories"("p_booking_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_booking_categories"("p_booking_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_booking_names"("p_booking_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_booking_names"("p_booking_ids" "uuid"[]) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_my_instructor_global_blocks"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_instructor_global_blocks"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_instructor_global_blocks"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_roles"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_roles"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_my_unified_instructor_bookings"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_unified_instructor_bookings"() TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."conversations" TO "service_role";
GRANT SELECT ON TABLE "public"."conversations" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_or_create_conversation_for_booking"("p_booking_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_or_create_conversation_for_booking"("p_booking_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_proj4_from_srid"(integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_provider_analytics_summary"("p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_provider_analytics_summary"("p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_provider_analytics_summary"("p_date_from" timestamp with time zone, "p_date_to" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_provider_booking_context_public"("p_provider_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_provider_booking_context_public"("p_provider_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_provider_booking_context_public"("p_provider_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_provider_booking_context_public"("p_provider_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_public_vehicle_catalog"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_public_vehicle_catalog"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."get_school_instructor_compliance_summary"("p_school_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_school_instructor_compliance_summary"("p_school_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "postgres";
GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "anon";
GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."gettransactionid"() TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_2d"("internal", "oid", "internal", smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_joinsel_nd"("internal", "oid", "internal", smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_2d"("internal", "oid", "internal", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."gserialized_gist_sel_nd"("internal", "oid", "internal", integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."handle_new_auth_user"() FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "postgres";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "anon";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int2_dist"(smallint, smallint) TO "service_role";



GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int4_dist"(integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "postgres";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "anon";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "authenticated";
GRANT ALL ON FUNCTION "public"."int8_dist"(bigint, bigint) TO "service_role";



GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "postgres";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "anon";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "authenticated";
GRANT ALL ON FUNCTION "public"."interval_dist"(interval, interval) TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_booking_participant"("p_booking_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_booking_participant"("p_booking_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_compliance_reviewer"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_compliance_reviewer"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."box2df", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_contained_2d"("public"."geometry", "public"."box2df") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_conversation_participant"("p_conversation_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_conversation_participant"("p_conversation_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_current_user_active"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_current_user_active"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_instructor_global_compliance_valid"("p_user_id" "uuid", "p_category" "public"."vehicle_category") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_instructor_global_compliance_valid"("p_user_id" "uuid", "p_category" "public"."vehicle_category") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_instructor_global_compliance_valid"("p_user_id" "uuid", "p_category" "public"."vehicle_category") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_membership_compliance_valid"("p_membership_id" "uuid", "p_category" "public"."vehicle_category") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_membership_compliance_valid"("p_membership_id" "uuid", "p_category" "public"."vehicle_category") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_membership_compliance_valid"("p_membership_id" "uuid", "p_category" "public"."vehicle_category") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_offering_slot_available"("p_offering_id" "uuid", "p_scheduled_start_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_offering_slot_available"("p_offering_id" "uuid", "p_scheduled_start_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_offering_slot_available"("p_offering_id" "uuid", "p_scheduled_start_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_platform_admin"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_platform_admin"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_provider_instructor_eligible"("p_provider_id" "uuid", "p_instructor_id" "uuid", "p_category" "public"."vehicle_category") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_provider_instructor_eligible"("p_provider_id" "uuid", "p_instructor_id" "uuid", "p_category" "public"."vehicle_category") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_provider_instructor_eligible"("p_provider_id" "uuid", "p_instructor_id" "uuid", "p_category" "public"."vehicle_category") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_provider_owner"("target_provider_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_provider_owner"("target_provider_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_school_admin"("target_school_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_school_admin"("target_school_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_school_member"("target_school_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_school_member"("target_school_id" "uuid") TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."compliance_documents" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."compliance_documents" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."compliance_documents" TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_my_global_compliance"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_my_global_compliance"() TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."driving_school_invitations" TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_my_school_invitations"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_my_school_invitations"() TO "authenticated";



REVOKE ALL ON FUNCTION "public"."list_school_instructor_invitations"("p_school_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_school_instructor_invitations"("p_school_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."list_school_memberships"("p_school_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_school_memberships"("p_school_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."lockrow"("text", "text", "text", "text", timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "postgres";
GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "anon";
GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."longtransactionsenabled"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."mark_booking_payment_failed"("p_payment_id" "uuid", "p_reason" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."mark_booking_payment_failed"("p_payment_id" "uuid", "p_reason" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_booking_payment_failed"("p_payment_id" "uuid", "p_reason" character varying) TO "service_role";



REVOKE ALL ON FUNCTION "public"."normalize_booking_snapshot_names"() FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "postgres";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "anon";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."oid_dist"("oid", "oid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."onboard_my_instructor"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."onboard_my_instructor"() TO "authenticated";



GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."box2df", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_2d"("public"."geometry", "public"."box2df") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."geography", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_geog"("public"."gidx", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."geometry", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "postgres";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "anon";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "authenticated";
GRANT ALL ON FUNCTION "public"."overlaps_nd"("public"."gidx", "public"."gidx") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asflatgeobuf_transfn"("internal", "anyelement", boolean, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asgeobuf_transfn"("internal", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_combinefn"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_deserialfn"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_serialfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_asmvt_transfn"("internal", "anyelement", "text", integer, "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_accum_transfn"("internal", "public"."geometry", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterintersecting_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_clusterwithin_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_collect_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_makeline_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_polygonize_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_combinefn"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_deserialfn"("bytea", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_finalfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_serialfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."pgis_geometry_union_parallel_transfn"("internal", "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."populate_geometry_columns"("tbl_oid" "oid", "use_typmod" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_addbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_cache_bbox"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_constraint_dims"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_constraint_srid"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_constraint_type"("geomschema" "text", "geomtable" "text", "geomcolumn" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_dropbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_extensions_upgrade"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_full_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_geos_noop"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_geos_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_getbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_hasbbox"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_index_supportfn"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_lib_build_date"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_lib_revision"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_lib_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_libjson_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_liblwgeom_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_libprotobuf_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_libxml_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_noop"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_proj_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_scripts_build_date"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_scripts_installed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_scripts_released"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_svn_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_transform_geometry"("geom" "public"."geometry", "text", "text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_type_name"("geomname" character varying, "coord_dimension" integer, "use_new_name" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_typmod_dims"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_typmod_srid"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_typmod_type"(integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_version"() TO "service_role";



GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "postgres";
GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "anon";
GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."postgis_wagyu_version"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."prevent_booking_during_instructor_global_block"() FROM PUBLIC;






REVOKE ALL ON FUNCTION "public"."provider_accept_mazzi_terms"("p_provider_id" "uuid", "p_terms_version" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."provider_accept_mazzi_terms"("p_provider_id" "uuid", "p_terms_version" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."provider_accept_mazzi_terms"("p_provider_id" "uuid", "p_terms_version" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."provider_check_in_booking"("p_booking_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."provider_check_in_booking"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."provider_check_in_booking"("p_booking_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."provider_complete_lesson"("p_booking_id" "uuid", "p_idempotency_key" character varying) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."provider_complete_lesson"("p_booking_id" "uuid", "p_idempotency_key" character varying) TO "authenticated";
GRANT ALL ON FUNCTION "public"."provider_complete_lesson"("p_booking_id" "uuid", "p_idempotency_key" character varying) TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."vehicles" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."vehicles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."vehicles" TO "service_role";



REVOKE ALL ON FUNCTION "public"."provider_deactivate_vehicle"("p_vehicle_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."provider_deactivate_vehicle"("p_vehicle_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."provider_deactivate_vehicle"("p_vehicle_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."provider_delete_availability_exception"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."provider_delete_availability_exception"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."provider_delete_availability_exception"("p_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."provider_delete_availability_rule"("p_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."provider_delete_availability_rule"("p_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."provider_delete_availability_rule"("p_id" "uuid") TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."availability_exceptions" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."availability_exceptions" TO "authenticated";
GRANT ALL ON TABLE "public"."availability_exceptions" TO "service_role";



REVOKE ALL ON FUNCTION "public"."provider_save_availability_exception"("p_id" "uuid", "p_provider_id" "uuid", "p_instructor_id" "uuid", "p_vehicle_id" "uuid", "p_type" character varying, "p_reason_category" character varying, "p_reason" character varying, "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_is_active" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."provider_save_availability_exception"("p_id" "uuid", "p_provider_id" "uuid", "p_instructor_id" "uuid", "p_vehicle_id" "uuid", "p_type" character varying, "p_reason_category" character varying, "p_reason" character varying, "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_is_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."provider_save_availability_exception"("p_id" "uuid", "p_provider_id" "uuid", "p_instructor_id" "uuid", "p_vehicle_id" "uuid", "p_type" character varying, "p_reason_category" character varying, "p_reason" character varying, "p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_is_active" boolean) TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."availabilities" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."availabilities" TO "authenticated";
GRANT ALL ON TABLE "public"."availabilities" TO "service_role";



REVOKE ALL ON FUNCTION "public"."provider_save_availability_rule"("p_id" "uuid", "p_provider_id" "uuid", "p_instructor_id" "uuid", "p_vehicle_id" "uuid", "p_day_of_week" integer, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_timezone" "text", "p_is_active" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."provider_save_availability_rule"("p_id" "uuid", "p_provider_id" "uuid", "p_instructor_id" "uuid", "p_vehicle_id" "uuid", "p_day_of_week" integer, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_timezone" "text", "p_is_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."provider_save_availability_rule"("p_id" "uuid", "p_provider_id" "uuid", "p_instructor_id" "uuid", "p_vehicle_id" "uuid", "p_day_of_week" integer, "p_start_time" time without time zone, "p_end_time" time without time zone, "p_timezone" "text", "p_is_active" boolean) TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."service_offerings" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."service_offerings" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."service_offerings" TO "service_role";



REVOKE ALL ON FUNCTION "public"."provider_save_service_offering"("p_offering_id" "uuid", "p_provider_id" "uuid", "p_instructor_id" "uuid", "p_vehicle_id" "uuid", "p_category" "public"."vehicle_category", "p_transmission" "public"."vehicle_transmission", "p_duration_minutes" integer, "p_price_in_cents" integer, "p_active" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."provider_save_service_offering"("p_offering_id" "uuid", "p_provider_id" "uuid", "p_instructor_id" "uuid", "p_vehicle_id" "uuid", "p_category" "public"."vehicle_category", "p_transmission" "public"."vehicle_transmission", "p_duration_minutes" integer, "p_price_in_cents" integer, "p_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."provider_save_service_offering"("p_offering_id" "uuid", "p_provider_id" "uuid", "p_instructor_id" "uuid", "p_vehicle_id" "uuid", "p_category" "public"."vehicle_category", "p_transmission" "public"."vehicle_transmission", "p_duration_minutes" integer, "p_price_in_cents" integer, "p_active" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."provider_save_vehicle"("p_vehicle_id" "uuid", "p_provider_id" "uuid", "p_brand" "text", "p_model" "text", "p_year" integer, "p_license_plate" "text", "p_renavam" "text", "p_category" "public"."vehicle_category", "p_vehicle_type" "public"."vehicle_type", "p_transmission" "public"."vehicle_transmission", "p_has_dual_pedal" boolean, "p_has_dashcam" boolean, "p_color" "text", "p_photos" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."provider_save_vehicle"("p_vehicle_id" "uuid", "p_provider_id" "uuid", "p_brand" "text", "p_model" "text", "p_year" integer, "p_license_plate" "text", "p_renavam" "text", "p_category" "public"."vehicle_category", "p_vehicle_type" "public"."vehicle_type", "p_transmission" "public"."vehicle_transmission", "p_has_dual_pedal" boolean, "p_has_dashcam" boolean, "p_color" "text", "p_photos" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."provider_save_vehicle"("p_vehicle_id" "uuid", "p_provider_id" "uuid", "p_brand" "text", "p_model" "text", "p_year" integer, "p_license_plate" "text", "p_renavam" "text", "p_category" "public"."vehicle_category", "p_vehicle_type" "public"."vehicle_type", "p_transmission" "public"."vehicle_transmission", "p_has_dual_pedal" boolean, "p_has_dashcam" boolean, "p_color" "text", "p_photos" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."provider_set_availability_exception_active"("p_id" "uuid", "p_is_active" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."provider_set_availability_exception_active"("p_id" "uuid", "p_is_active" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."provider_set_availability_exception_active"("p_id" "uuid", "p_is_active" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."provider_start_lesson"("p_booking_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."provider_start_lesson"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."provider_start_lesson"("p_booking_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."provider_submit_compliance_document"("p_provider_id" "uuid", "p_document_type" "public"."compliance_doc_type", "p_storage_path" "text", "p_expires_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."provider_submit_compliance_document"("p_provider_id" "uuid", "p_document_type" "public"."compliance_doc_type", "p_storage_path" "text", "p_expires_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."provider_submit_compliance_document"("p_provider_id" "uuid", "p_document_type" "public"."compliance_doc_type", "p_storage_path" "text", "p_expires_at" timestamp with time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_school_invitation_event"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."record_school_membership_status_event"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."review_compliance_document"("p_document_id" "uuid", "p_status" "public"."compliance_status", "p_rejection_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."review_compliance_document"("p_document_id" "uuid", "p_status" "public"."compliance_status", "p_rejection_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."review_vehicle"("p_vehicle_id" "uuid", "p_status" "public"."vehicle_status", "p_reason" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."review_vehicle"("p_vehicle_id" "uuid", "p_status" "public"."vehicle_status", "p_reason" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."save_instructor_global_block"("p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_reason" "text", "p_block_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_instructor_global_block"("p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_reason" "text", "p_block_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_instructor_global_block"("p_start_at" timestamp with time zone, "p_end_at" timestamp with time zone, "p_reason" "text", "p_block_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."search_providers_public"("p_user_lat" double precision, "p_user_lng" double precision, "p_radius_meters" double precision, "p_category" "text", "p_provider_type" "text", "p_transmission" "text", "p_min_rating" double precision, "p_max_price_cents" integer, "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_providers_public"("p_user_lat" double precision, "p_user_lng" double precision, "p_radius_meters" double precision, "p_category" "text", "p_provider_type" "text", "p_transmission" "text", "p_min_rating" double precision, "p_max_price_cents" integer, "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_providers_public"("p_user_lat" double precision, "p_user_lng" double precision, "p_radius_meters" double precision, "p_category" "text", "p_provider_type" "text", "p_transmission" "text", "p_min_rating" double precision, "p_max_price_cents" integer, "p_limit" integer, "p_offset" integer) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."search_providers_public"("p_user_lat" double precision, "p_user_lng" double precision, "p_radius_meters" double precision, "p_category" "text", "p_provider_type" "text", "p_transmission" "text", "p_min_rating" double precision, "p_max_price_cents" integer, "p_limit" integer, "p_offset" integer, "p_date" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."search_providers_public"("p_user_lat" double precision, "p_user_lng" double precision, "p_radius_meters" double precision, "p_category" "text", "p_provider_type" "text", "p_transmission" "text", "p_min_rating" double precision, "p_max_price_cents" integer, "p_limit" integer, "p_offset" integer, "p_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."search_providers_public"("p_user_lat" double precision, "p_user_lng" double precision, "p_radius_meters" double precision, "p_category" "text", "p_provider_type" "text", "p_transmission" "text", "p_min_rating" double precision, "p_max_price_cents" integer, "p_limit" integer, "p_offset" integer, "p_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_providers_public"("p_user_lat" double precision, "p_user_lng" double precision, "p_radius_meters" double precision, "p_category" "text", "p_provider_type" "text", "p_transmission" "text", "p_min_rating" double precision, "p_max_price_cents" integer, "p_limit" integer, "p_offset" integer, "p_date" "date") TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."messages" TO "service_role";
GRANT SELECT ON TABLE "public"."messages" TO "authenticated";



REVOKE ALL ON FUNCTION "public"."send_message"("p_conversation_id" "uuid", "p_body" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."send_message"("p_conversation_id" "uuid", "p_body" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."set_provider_service_radius"("p_provider_id" "uuid", "p_radius_km" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_provider_service_radius"("p_provider_id" "uuid", "p_radius_km" integer) TO "authenticated";



GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dclosestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3ddfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3ddistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3ddwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dintersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dlength"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dlineinterpolatepoint"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dlongestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dmakebox"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dmaxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dperimeter"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dshortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_addmeasure"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_addpoint"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_affine"("public"."geometry", double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_angle"("line1" "public"."geometry", "line2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_angle"("pt1" "public"."geometry", "pt2" "public"."geometry", "pt3" "public"."geometry", "pt4" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_area"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area"("geog" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_area2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geography", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asbinary"("public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asencodedpolyline"("geom" "public"."geometry", "nprecision" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkb"("public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asewkt"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeojson"("r" "record", "geom_column" "text", "maxdecimaldigits" integer, "pretty_bool" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geog" "public"."geography", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgml"("version" integer, "geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer, "nprefix" "text", "id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ashexewkb"("public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_askml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_askml"("geog" "public"."geography", "maxdecimaldigits" integer, "nprefix" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_askml"("geom" "public"."geometry", "maxdecimaldigits" integer, "nprefix" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_aslatlontext"("geom" "public"."geometry", "tmpl" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmarc21"("geom" "public"."geometry", "format" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvtgeom"("geom" "public"."geometry", "bounds" "public"."box2d", "extent" integer, "buffer" integer, "clip_geom" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_assvg"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_assvg"("geog" "public"."geography", "rel" integer, "maxdecimaldigits" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_assvg"("geom" "public"."geometry", "rel" integer, "maxdecimaldigits" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geography", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astext"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry", "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_astwkb"("geom" "public"."geometry"[], "ids" bigint[], "prec" integer, "prec_z" integer, "prec_m" integer, "with_sizes" boolean, "with_boxes" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asx3d"("geom" "public"."geometry", "maxdecimaldigits" integer, "options" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_azimuth"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_bdmpolyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_bdpolyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_boundary"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_boundingdiagonal"("geom" "public"."geometry", "fits" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_box2dfromgeohash"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("text", double precision, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("public"."geography", double precision, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "quadsegs" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buffer"("geom" "public"."geometry", "radius" double precision, "options" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_buildarea"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_centroid"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_centroid"("public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_chaikinsmoothing"("public"."geometry", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_cleangeometry"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clipbybox2d"("geom" "public"."geometry", "box" "public"."box2d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_closestpoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_closestpointofapproach"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterdbscan"("public"."geometry", "eps" double precision, "minpoints" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterkmeans"("geom" "public"."geometry", "k" integer, "max_radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry"[], double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collect"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collectionextract"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collectionhomogenize"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box2d", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_combinebbox"("public"."box3d", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_concavehull"("param_geom" "public"."geometry", "param_pctconvex" double precision, "param_allow_holes" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_contains"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_containsproperly"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_convexhull"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coorddim"("geometry" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coveredby"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_coveredby"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_covers"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_covers"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_covers"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_cpawithin"("public"."geometry", "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_crosses"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_curvetoline"("geom" "public"."geometry", "tol" double precision, "toltype" integer, "flags" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_delaunaytriangles"("g1" "public"."geometry", "tolerance" double precision, "flags" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dfullywithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_difference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dimension"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_disjoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distance"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distance"("geog1" "public"."geography", "geog2" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancecpa"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancesphere"("geom1" "public"."geometry", "geom2" "public"."geometry", "radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_distancespheroid"("geom1" "public"."geometry", "geom2" "public"."geometry", "public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dump"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dumppoints"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dumprings"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dumpsegments"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dwithin"("text", "text", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_dwithin"("geog1" "public"."geography", "geog2" "public"."geography", "tolerance" double precision, "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_endpoint"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_envelope"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_equals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_estimatedextent"("text", "text", "text", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box2d", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."box3d", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box2d", "dx" double precision, "dy" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("box" "public"."box3d", "dx" double precision, "dy" double precision, "dz" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_expand"("geom" "public"."geometry", "dx" double precision, "dy" double precision, "dz" double precision, "dm" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_exteriorring"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_filterbym"("public"."geometry", double precision, double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_findextent"("text", "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_flipcoordinates"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force3d"("geom" "public"."geometry", "zvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force3dm"("geom" "public"."geometry", "mvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force3dz"("geom" "public"."geometry", "zvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_force4d"("geom" "public"."geometry", "zvalue" double precision, "mvalue" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcecollection"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcecurve"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcepolygonccw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcepolygoncw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcerhr"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_forcesfs"("public"."geometry", "version" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_frechetdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuf"("anyelement", "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_fromflatgeobuftotable"("text", "text", "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_generatepoints"("area" "public"."geometry", "npoints" integer, "seed" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geogfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geogfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geographyfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geohash"("geog" "public"."geography", "maxchars" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geohash"("geom" "public"."geometry", "maxchars" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomcollfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometricmedian"("g" "public"."geometry", "tolerance" double precision, "max_iter" integer, "fail_if_not_converged" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometryfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometryn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geometrytype"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromewkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromewkt"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeohash"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"(json) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"(json) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"(json) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"(json) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgeojson"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromgml"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromkml"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfrommarc21"("marc21xml" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromtwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_geomfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_gmltosql"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hasarc"("geometry" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hausdorffdistance"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hexagon"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_hexagongrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_interiorringn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_interpolatepoint"("line" "public"."geometry", "point" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersection"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersection"("public"."geography", "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersection"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersects"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersects"("geog1" "public"."geography", "geog2" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_intersects"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isclosed"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_iscollection"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isempty"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ispolygonccw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ispolygoncw"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isring"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_issimple"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalid"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvaliddetail"("geom" "public"."geometry", "flags" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalidreason"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_isvalidtrajectory"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length"("geog" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_length2dspheroid"("public"."geometry", "public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "anon";
GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_lengthspheroid"("public"."geometry", "public"."spheroid") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" json) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" json) TO "anon";
GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" json) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_letters"("letters" "text", "font" json) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linecrossingdirection"("line1" "public"."geometry", "line2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromencodedpolyline"("txtin" "text", "nprecision" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefrommultipoint"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linefromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoint"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_lineinterpolatepoints"("public"."geometry", double precision, "repeat" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linelocatepoint"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linemerge"("public"."geometry", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linestringfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linesubstring"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_linetocurve"("geometry" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_locatealong"("geometry" "public"."geometry", "measure" double precision, "leftrightoffset" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_locatebetween"("geometry" "public"."geometry", "frommeasure" double precision, "tomeasure" double precision, "leftrightoffset" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_locatebetweenelevations"("geometry" "public"."geometry", "fromelevation" double precision, "toelevation" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_longestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_m"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makebox2d"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeenvelope"(double precision, double precision, double precision, double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepoint"(double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepointm"(double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makepolygon"("public"."geometry", "public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makevalid"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makevalid"("geom" "public"."geometry", "params" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_maxdistance"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_maximuminscribedcircle"("public"."geometry", OUT "center" "public"."geometry", OUT "nearest" "public"."geometry", OUT "radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_memsize"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumboundingcircle"("inputgeom" "public"."geometry", "segs_per_quarter" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumboundingradius"("public"."geometry", OUT "center" "public"."geometry", OUT "radius" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumclearance"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_minimumclearanceline"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mlinefromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpointfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_mpolyfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multi"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multilinefromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multilinestringfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipointfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipointfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolyfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_multipolygonfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ndims"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_node"("g" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_normalize"("geom" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_npoints"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_nrings"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numgeometries"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numinteriorring"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numinteriorrings"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numpatches"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_numpoints"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_offsetcurve"("line" "public"."geometry", "distance" double precision, "params" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_orderingequals"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_orientedenvelope"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_overlaps"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_patchn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_perimeter"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_perimeter"("geog" "public"."geography", "use_spheroid" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_perimeter2d"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_point"(double precision, double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromgeohash"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointinsidecircle"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointm"("xcoordinate" double precision, "ycoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointn"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointonsurface"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_points"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointz"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_pointzm"("xcoordinate" double precision, "ycoordinate" double precision, "zcoordinate" double precision, "mcoordinate" double precision, "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polyfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygon"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromtext"("text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonfromwkb"("bytea", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_project"("geog" "public"."geography", "distance" double precision, "azimuth" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_quantizecoordinates"("g" "public"."geometry", "prec_x" integer, "prec_y" integer, "prec_z" integer, "prec_m" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_reduceprecision"("geom" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relate"("geom1" "public"."geometry", "geom2" "public"."geometry", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_relatematch"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_removepoint"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_removerepeatedpoints"("geom" "public"."geometry", "tolerance" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_reverse"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotate"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotatex"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotatey"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_rotatez"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", "public"."geometry", "origin" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scale"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_scroll"("public"."geometry", "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_segmentize"("geog" "public"."geography", "max_segment_length" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_segmentize"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_seteffectivearea"("public"."geometry", double precision, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_setpoint"("public"."geometry", integer, "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_setsrid"("geog" "public"."geography", "srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_sharedpaths"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_shiftlongitude"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_shortestline"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplify"("public"."geometry", double precision, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplifypolygonhull"("geom" "public"."geometry", "vertex_fraction" double precision, "is_outer" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplifypreservetopology"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_simplifyvw"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snap"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("public"."geometry", double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_snaptogrid"("geom1" "public"."geometry", "geom2" "public"."geometry", double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_split"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_square"("size" double precision, "cell_i" integer, "cell_j" integer, "origin" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_squaregrid"("size" double precision, "bounds" "public"."geometry", OUT "geom" "public"."geometry", OUT "i" integer, OUT "j" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_srid"("geog" "public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_srid"("geom" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_startpoint"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_subdivide"("geom" "public"."geometry", "maxvertices" integer, "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "anon";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geography") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_summary"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_swapordinates"("geom" "public"."geometry", "ords" "cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_symdifference"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_symmetricdifference"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_tileenvelope"("zoom" integer, "x" integer, "y" integer, "bounds" "public"."geometry", "margin" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_touches"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("public"."geometry", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "to_proj" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_srid" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transform"("geom" "public"."geometry", "from_proj" "text", "to_proj" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_translate"("public"."geometry", double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_transscale"("public"."geometry", double precision, double precision, double precision, double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_triangulatepolygon"("g1" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_unaryunion"("public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("geom1" "public"."geometry", "geom2" "public"."geometry", "gridsize" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_voronoilines"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_voronoipolygons"("g1" "public"."geometry", "tolerance" double precision, "extend_to" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_within"("geom1" "public"."geometry", "geom2" "public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "anon";
GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_wkbtosql"("wkb" "bytea") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_wkttosql"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_wrapx"("geom" "public"."geometry", "wrap" double precision, "move" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_x"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_xmax"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_xmin"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_y"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ymax"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_ymin"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_z"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_zmax"("public"."box3d") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_zmflag"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "anon";
GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_zmin"("public"."box3d") TO "service_role";



REVOKE ALL ON FUNCTION "public"."student_check_in_booking"("p_booking_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."student_check_in_booking"("p_booking_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."student_check_in_booking"("p_booking_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_my_global_compliance_document"("p_document_type" "public"."compliance_doc_type", "p_storage_path" "text", "p_expires_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_my_global_compliance_document"("p_document_type" "public"."compliance_doc_type", "p_storage_path" "text", "p_expires_at" timestamp with time zone) TO "authenticated";



REVOKE ALL ON FUNCTION "public"."sync_primary_user_role"() FROM PUBLIC;



REVOKE ALL ON FUNCTION "public"."sync_school_staff_membership_status"() FROM PUBLIC;



GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."time_dist"(time without time zone, time without time zone) TO "service_role";



REVOKE ALL ON FUNCTION "public"."track_analytics_event"("p_event_name" "text", "p_properties" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."track_analytics_event"("p_event_name" "text", "p_properties" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."try_activate_school_instructor_membership"("p_membership_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."try_activate_school_instructor_membership"("p_membership_id" "uuid") TO "authenticated";



GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."ts_dist"(timestamp without time zone, timestamp without time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "postgres";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."tstz_dist"(timestamp with time zone, timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."unlockrows"("text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_admin_platform_configurations"("p_updates" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_admin_platform_configurations"("p_updates" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_my_profile"("p_name" "text", "p_phone" "text", "p_avatar_url" "text", "p_birth_date" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_my_profile"("p_name" "text", "p_phone" "text", "p_avatar_url" "text", "p_birth_date" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_my_profile"("p_name" "text", "p_phone" "text", "p_avatar_url" "text", "p_birth_date" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_provider_profile"("p_provider_id" "uuid", "p_name" "text", "p_public_contact" "text", "p_neighborhood" "text", "p_city" "text", "p_state" "text", "p_service_radius_km" integer, "p_bio" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_provider_profile"("p_provider_id" "uuid", "p_name" "text", "p_public_contact" "text", "p_neighborhood" "text", "p_city" "text", "p_state" "text", "p_service_radius_km" integer, "p_bio" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_provider_profile"("p_provider_id" "uuid", "p_name" "text", "p_public_contact" "text", "p_neighborhood" "text", "p_city" "text", "p_state" "text", "p_service_radius_km" integer, "p_bio" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"(character varying, character varying, character varying, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."updategeometrysrid"("catalogn_name" character varying, "schema_name" character varying, "table_name" character varying, "column_name" character varying, "new_srid_in" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."validate_compliance_document_membership_user"() FROM PUBLIC;












GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_3dextent"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asflatgeobuf"("anyelement", boolean, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asgeobuf"("anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_asmvt"("anyelement", "text", integer, "text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterintersecting"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_clusterwithin"("public"."geometry", double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_collect"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_extent"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_makeline"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_memcollect"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_memunion"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_polygonize"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry") TO "service_role";



GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "postgres";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."st_union"("public"."geometry", double precision) TO "service_role";









GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."analytics_events" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."audit_logs" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."bookings" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."bookings" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."bookings" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cancellation_policies" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."cancellation_policy_rules" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."compliance_requirements" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."compliance_requirements" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."compliance_requirements" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."driving_school_membership_events" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."driving_school_staff" TO "authenticated";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."driving_school_staff" TO "service_role";






GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."instructor_global_blocks" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notifications" TO "service_role";
GRANT SELECT ON TABLE "public"."notifications" TO "authenticated";



GRANT UPDATE("is_read") ON TABLE "public"."notifications" TO "authenticated";



GRANT UPDATE("read_at") ON TABLE "public"."notifications" TO "authenticated";






GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payments" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payments" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payments" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payouts" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."platform_configurations" TO "service_role";






GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."providers_public_view" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."public_vehicles" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."public_service_offerings" TO "service_role";


REVOKE ALL ON FUNCTION "public"."enforce_booking_schedule_exceptions"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."enforce_booking_schedule_exceptions"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."enforce_booking_schedule_exceptions"() FROM "authenticated";
REVOKE ALL ON FUNCTION "public"."enforce_schedule_lock_on_availability"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."enforce_schedule_lock_on_availability"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."enforce_schedule_lock_on_availability"() FROM "authenticated";
REVOKE ALL ON FUNCTION "public"."validate_availability_resource_scope"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."validate_availability_resource_scope"() FROM "anon";
REVOKE ALL ON FUNCTION "public"."validate_availability_resource_scope"() FROM "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."quotes" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."quotes" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."quotes" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."refunds" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."role_permissions" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."role_permissions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."role_permissions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_custom_permissions" TO "anon";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_custom_permissions" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_custom_permissions" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."user_roles" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT UPDATE ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";
































--
-- Dumped schema changes for auth and storage
--

CREATE POLICY "Admins can delete compliance documents from storage" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'provider-compliance-docs'::"text") AND "public"."is_platform_admin"()));



CREATE POLICY "Providers and reviewers can read compliance documents from stor" ON "storage"."objects" FOR SELECT TO "authenticated" USING ((("bucket_id" = 'provider-compliance-docs'::"text") AND "public"."is_current_user_active"() AND (((("storage"."foldername"("name"))[1] = 'providers'::"text") AND "public"."is_provider_owner"((("storage"."foldername"("name"))[2])::"uuid")) OR "public"."is_compliance_reviewer"())));



CREATE POLICY "Providers can upload own compliance documents to storage" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'provider-compliance-docs'::"text") AND "public"."is_current_user_active"() AND (("storage"."foldername"("name"))[1] = 'providers'::"text") AND (("storage"."foldername"("name"))[3] = 'compliance'::"text") AND "public"."is_provider_owner"((("storage"."foldername"("name"))[2])::"uuid")));



CREATE POLICY "Public can read avatars from storage" ON "storage"."objects" FOR SELECT USING (("bucket_id" = 'avatars'::"text"));



CREATE POLICY "Users can delete own avatar from storage" ON "storage"."objects" FOR DELETE TO "authenticated" USING ((("bucket_id" = 'avatars'::"text") AND ("auth"."uid"() IS NOT NULL) AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));



CREATE POLICY "Users can update own avatar in storage" ON "storage"."objects" FOR UPDATE TO "authenticated" USING ((("bucket_id" = 'avatars'::"text") AND ("auth"."uid"() IS NOT NULL) AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));



CREATE POLICY "Users can upload own avatar to storage" ON "storage"."objects" FOR INSERT TO "authenticated" WITH CHECK ((("bucket_id" = 'avatars'::"text") AND ("auth"."uid"() IS NOT NULL) AND (("storage"."foldername"("name"))[1] = ("auth"."uid"())::"text")));

-- R12A canonical DEV contract follows. Definitions below intentionally override
-- historical snapshot definitions without rebuilding the baseline indiscriminately.

CREATE OR REPLACE FUNCTION public.current_mazzi_terms_version()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$ SELECT 'v1'::text; $$;
REVOKE ALL ON FUNCTION public.current_mazzi_terms_version() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.provider_accept_mazzi_terms(p_provider_id uuid, p_terms_version text)
RETURNS public.compliance_documents LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_doc public.compliance_documents; v_current_version text := public.current_mazzi_terms_version(); v_path text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NOT public.is_current_user_active() THEN RAISE EXCEPTION 'USER_NOT_ACTIVE' USING ERRCODE='42501'; END IF;
  IF NOT public.is_provider_owner(p_provider_id) THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF p_terms_version IS DISTINCT FROM v_current_version THEN RAISE EXCEPTION 'TERMS_VERSION_NOT_CURRENT' USING ERRCODE='22023'; END IF;
  v_path := 'acceptance://mazzi-ethics/' || v_current_version;
  SELECT * INTO v_doc FROM public.compliance_documents
  WHERE provider_id=p_provider_id AND user_id=auth.uid()
    AND scope='PROVIDER'::public.compliance_document_scope
    AND document_type='MAZZI_TERMS_ACCEPTANCE'::public.compliance_doc_type
    AND status='APPROVED'::public.compliance_status AND storage_path=v_path
  ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN v_doc; END IF;
  INSERT INTO public.compliance_documents(provider_id,user_id,vehicle_id,membership_id,scope,document_type,storage_path,status)
  VALUES(p_provider_id,auth.uid(),NULL,NULL,'PROVIDER'::public.compliance_document_scope,
    'MAZZI_TERMS_ACCEPTANCE'::public.compliance_doc_type,v_path,'APPROVED'::public.compliance_status)
  RETURNING * INTO v_doc;
  INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,new_value,severity,created_at)
  VALUES(auth.uid(),'MAZZI_TERMS_ACCEPTED','COMPLIANCE_DOCUMENTS',v_doc.id,
    jsonb_build_object('provider_id',p_provider_id,'document_type','MAZZI_TERMS_ACCEPTANCE','terms_version',v_current_version,'scope','PROVIDER'),'INFO',NOW());
  RETURN v_doc;
END; $$;
REVOKE ALL ON FUNCTION public.provider_accept_mazzi_terms(uuid,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.provider_accept_mazzi_terms(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_provider_activation_eligible(p_provider_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
SELECT EXISTS (SELECT 1 FROM public.providers p JOIN public.users u ON u.id=p.user_id
WHERE p.id=p_provider_id AND p.type='INSTRUCTOR'::public.provider_type
  AND p.status IN ('DRAFT'::public.provider_status,'PENDING_REVIEW'::public.provider_status)
  AND u.status='ACTIVE' AND (u.role='INSTRUCTOR'::public.user_role OR EXISTS(SELECT 1 FROM public.user_roles ur WHERE ur.user_id=u.id AND ur.role='INSTRUCTOR'::public.user_role))
  AND NOT EXISTS (SELECT 1 FROM public.compliance_requirements r WHERE r.scope='USER_GLOBAL'::public.compliance_document_scope AND r.provider_type='INSTRUCTOR'::public.provider_type AND r.is_mandatory IS TRUE AND (r.effective_from IS NULL OR r.effective_from<=NOW()) AND (r.effective_to IS NULL OR r.effective_to>=NOW()) AND r.regulatory_status NOT IN ('SUPERSEDED','INACTIVE') AND NOT EXISTS (SELECT 1 FROM public.compliance_documents d WHERE d.status='APPROVED'::public.compliance_status AND (d.expires_at IS NULL OR d.expires_at>NOW()) AND ((d.scope='USER_GLOBAL'::public.compliance_document_scope AND d.user_id=p.user_id AND d.provider_id IS NULL) OR (d.scope='PROVIDER'::public.compliance_document_scope AND d.provider_id=p.id)) AND (d.document_type::text=r.document_type::text OR (r.document_type::text='CNH_EAR' AND d.document_type::text='CNH') OR (r.document_type::text='CREDENTIAL_DETRAN_SP' AND d.document_type::text='CREDENTIAL_DETRAN'))))
  AND EXISTS (SELECT 1 FROM public.compliance_documents terms WHERE terms.provider_id=p.id AND terms.user_id=p.user_id AND terms.scope='PROVIDER'::public.compliance_document_scope AND terms.document_type='MAZZI_TERMS_ACCEPTANCE'::public.compliance_doc_type AND terms.status='APPROVED'::public.compliance_status AND terms.storage_path='acceptance://mazzi-ethics/'||public.current_mazzi_terms_version()));
$$;
REVOKE ALL ON FUNCTION public.is_provider_activation_eligible(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.promote_eligible_instructor_provider()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE v_candidate public.providers;
BEGIN
  IF NEW.status <> 'APPROVED'::public.compliance_status THEN RETURN NEW; END IF;
  IF NEW.scope='PROVIDER'::public.compliance_document_scope AND NEW.provider_id IS NOT NULL THEN
    SELECT p.* INTO v_candidate FROM public.providers p WHERE p.id=NEW.provider_id AND p.type='INSTRUCTOR'::public.provider_type AND p.status IN ('DRAFT'::public.provider_status,'PENDING_REVIEW'::public.provider_status) FOR UPDATE;
    IF FOUND AND public.is_provider_activation_eligible(v_candidate.id) THEN
      UPDATE public.providers SET status='ACTIVE'::public.provider_status,approved_at=COALESCE(approved_at,NOW()),updated_at=NOW() WHERE id=v_candidate.id;
      INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,previous_value,new_value,created_at) VALUES(NEW.reviewed_by,'PROVIDER_AUTO_ACTIVATED','Provider',v_candidate.id::text,jsonb_build_object('status',v_candidate.status),jsonb_build_object('status','ACTIVE'),NOW());
    END IF;
  ELSIF NEW.scope='USER_GLOBAL'::public.compliance_document_scope AND NEW.user_id IS NOT NULL THEN
    FOR v_candidate IN SELECT p.* FROM public.providers p WHERE p.user_id=NEW.user_id AND p.type='INSTRUCTOR'::public.provider_type AND p.status IN ('DRAFT'::public.provider_status,'PENDING_REVIEW'::public.provider_status) FOR UPDATE LOOP
      IF public.is_provider_activation_eligible(v_candidate.id) THEN
        UPDATE public.providers SET status='ACTIVE'::public.provider_status,approved_at=COALESCE(approved_at,NOW()),updated_at=NOW() WHERE id=v_candidate.id;
        INSERT INTO public.audit_logs(actor_id,action,entity_type,entity_id,previous_value,new_value,created_at) VALUES(NEW.reviewed_by,'PROVIDER_AUTO_ACTIVATED','Provider',v_candidate.id::text,jsonb_build_object('status',v_candidate.status),jsonb_build_object('status','ACTIVE'),NOW());
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.promote_eligible_instructor_provider() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS promote_eligible_instructor_provider_after_compliance ON public.compliance_documents;
CREATE TRIGGER promote_eligible_instructor_provider_after_compliance AFTER INSERT OR UPDATE OF status,provider_id,scope,user_id ON public.compliance_documents FOR EACH ROW EXECUTE FUNCTION public.promote_eligible_instructor_provider();

CREATE OR REPLACE FUNCTION public.deactivate_provider_offerings_on_lifecycle_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$ BEGIN
  IF OLD.status='ACTIVE' AND NEW.status<>'ACTIVE' THEN
    UPDATE public.service_offerings SET status='INACTIVE',is_active=FALSE,updated_at=NOW() WHERE provider_id=NEW.id AND (status='ACTIVE' OR is_active IS TRUE);
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.deactivate_provider_offerings_on_lifecycle_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS deactivate_provider_offerings_on_provider_lifecycle ON public.providers;
CREATE TRIGGER deactivate_provider_offerings_on_provider_lifecycle AFTER UPDATE OF status ON public.providers FOR EACH ROW EXECUTE FUNCTION public.deactivate_provider_offerings_on_lifecycle_change();

-- Safe P1 performance hardening replayed after the canonical schema.
CREATE INDEX IF NOT EXISTS idx_cancellation_policy_rules_policy_id
  ON public.cancellation_policy_rules (policy_id);
CREATE INDEX IF NOT EXISTS idx_driving_school_staff_ended_by
  ON public.driving_school_staff (ended_by);
CREATE INDEX IF NOT EXISTS idx_driving_school_staff_source_invitation_id
  ON public.driving_school_staff (source_invitation_id);
CREATE INDEX IF NOT EXISTS idx_driving_school_staff_suspended_by
  ON public.driving_school_staff (suspended_by);
CREATE INDEX IF NOT EXISTS idx_platform_configurations_updated_by
  ON public.platform_configurations (updated_by);
CREATE INDEX IF NOT EXISTS idx_providers_approved_by
  ON public.providers (approved_by);
CREATE INDEX IF NOT EXISTS idx_providers_rejected_by
  ON public.providers (rejected_by);
CREATE INDEX IF NOT EXISTS idx_user_custom_permissions_granted_by
  ON public.user_custom_permissions (granted_by);

ALTER POLICY "Providers can insert own compliance documents"
  ON public.compliance_documents
  WITH CHECK (
    is_current_user_active()
    AND (is_provider_owner(provider_id) OR user_id = (select auth.uid()))
    AND (
      status = ANY (ARRAY['PENDING'::public.compliance_status, 'IN_REVIEW'::public.compliance_status])
      OR (document_type = 'MAZZI_TERMS_ACCEPTANCE'::public.compliance_doc_type
        AND status = 'APPROVED'::public.compliance_status
        AND storage_path::text LIKE 'acceptance://mazzi-ethics/%')
    )
  );
ALTER POLICY "Providers can read own compliance documents"
  ON public.compliance_documents
  USING (is_current_user_active() AND (is_provider_owner(provider_id) OR user_id = (select auth.uid()) OR is_compliance_reviewer()));
ALTER POLICY "Users can view own custom permissions"
  ON public.user_custom_permissions
  USING ((select auth.uid()) = user_id OR is_platform_admin());
ALTER POLICY "Parties can read own payments"
  ON public.payments
  USING (is_current_user_active() AND (booking_id IN (SELECT bookings.id FROM public.bookings WHERE bookings.student_id = (select auth.uid()) OR bookings.instructor_id = (select auth.uid())) OR is_platform_admin()));
ALTER POLICY "Providers can create initial draft profile"
  ON public.providers
  WITH CHECK (is_current_user_active() AND user_id = (select auth.uid()) AND status = 'DRAFT'::public.provider_status);
ALTER POLICY offerings_owner_select
  ON public.service_offerings
  USING (is_current_user_active() AND (provider_id IN (SELECT p.id FROM public.providers AS p WHERE p.user_id = (select auth.uid())) OR is_school_admin(provider_id) OR is_platform_admin()));
ALTER POLICY "Authenticated users can create own student profile"
  ON public.users
  WITH CHECK ((id = (select auth.uid())) AND role = 'STUDENT'::public.user_role AND status = 'ACTIVE'::public.user_status
    AND lower(email::text) = lower(COALESCE(((select auth.jwt()) ->> 'email'::text), ''::text))
    AND cpf IS NOT NULL AND length(cpf::text) = 11 AND validate_cpf(cpf::text)
    AND birth_date IS NOT NULL AND birth_date <= (CURRENT_DATE - '18 years'::interval));
