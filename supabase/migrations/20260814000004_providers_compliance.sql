-- ============================================================================
-- MAZZI PLATFORM — SPRINT 04: PROVIDERS & COMPLIANCE MIGRATION
-- File: 20260814000004_providers_compliance.sql
-- ============================================================================

-- 1. ADD ADDITIONAL LIFECYCLE & AUDIT COLUMNS TO PROVIDERS TABLE
ALTER TABLE public.providers
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
  ADD COLUMN IF NOT EXISTS public_contact VARCHAR(100),
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. CREATE CONFIGURABLE COMPLIANCE REQUIREMENTS CATALOG TABLE
CREATE TABLE IF NOT EXISTS public.compliance_requirements (
  id VARCHAR(100) PRIMARY KEY,
  provider_type provider_type NOT NULL,
  category vehicle_category,
  state VARCHAR(2) NOT NULL DEFAULT 'SP',
  jurisdiction VARCHAR(100) NOT NULL DEFAULT 'STATE',
  document_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  regulatory_status VARCHAR(50) NOT NULL DEFAULT 'REQUIRES_REGULATORY_VALIDATION',
  validity_period_days INTEGER,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  effective_to TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.compliance_requirements ENABLE ROW LEVEL SECURITY;

-- 3. SEED INITIAL COMPLIANCE REQUIREMENTS (With Explicit Regulatory Status)
INSERT INTO public.compliance_requirements (
  id, provider_type, document_type, title, description, is_mandatory, regulatory_status, validity_period_days
) VALUES
  ('req_cnh_ear', 'INSTRUCTOR', 'CNH_EAR', 'CNH com Observação EAR (Exerce Atividade Remunerada)', 'Carteira Nacional de Habilitação válida com anotação oficial EAR (CTB Art. 147).', TRUE, 'OFFICIALLY_VALIDATED', 1825),
  ('req_credencial_detran', 'INSTRUCTOR', 'CREDENTIAL_DETRAN', 'Credencial de Instrutor de Trânsito', 'Registro de credenciamento oficial de instrutor emitido pelo DETRAN.', TRUE, 'REQUIRES_REGULATORY_VALIDATION', 730),
  ('req_antecedentes', 'INSTRUCTOR', 'CRIMINAL_BACKGROUND', 'Certidão Negativa de Antecedentes Criminais', 'Certidão emitida nos últimos 90 dias pelos órgãos de segurança estaduais e federais.', TRUE, 'REQUIRES_REGULATORY_VALIDATION', 90),
  ('req_cnpj_contrato', 'DRIVING_SCHOOL', 'COMPANY_REGISTRATION', 'Cartão CNPJ e Contrato Social / Requerimento', 'Comprovante cadastral ativo com atividade de Centro de Formação de Condutores.', TRUE, 'OFFICIALLY_VALIDATED', NULL),
  ('req_portaria_cfc', 'DRIVING_SCHOOL', 'CFC_AUTHORIZATION', 'Portaria de Credenciamento DETRAN (CFC)', 'Portaria ou autorização governamental de funcionamento do CFC.', TRUE, 'REQUIRES_REGULATORY_VALIDATION', 365),
  ('req_alvara_funcionamento', 'DRIVING_SCHOOL', 'CFC_ALVARA', 'Alvará de Funcionamento e Localização', 'Alvará municipal vigente da sede do CFC.', TRUE, 'REQUIRES_REGULATORY_VALIDATION', 365)
ON CONFLICT (id) DO NOTHING;

-- 4. SECURITY DEFINER HELPER FUNCTIONS FOR PROVIDER & COMPLIANCE RLS
-- Fixed search_path = public, pg_temp, zero dynamic SQL, strict booleans.

-- Helper 4.1: Checks if user owns or manages the provider record
CREATE OR REPLACE FUNCTION public.is_provider_owner(target_provider_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
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

REVOKE ALL ON FUNCTION public.is_provider_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_provider_owner(UUID) TO authenticated;

-- Helper 4.2: Checks if current user is authorized to review compliance
CREATE OR REPLACE FUNCTION public.is_compliance_reviewer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.users u ON u.id = ur.user_id
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('PLATFORM_ADMIN', 'SUPPORT')
      AND u.status = 'ACTIVE'
  );
$$;

REVOKE ALL ON FUNCTION public.is_compliance_reviewer() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_compliance_reviewer() TO authenticated;

-- 5. HARDENED ROW LEVEL SECURITY (RLS) POLICIES

-- 5.1 COMPLIANCE_REQUIREMENTS POLICIES
DROP POLICY IF EXISTS "Public can view active compliance requirements" ON compliance_requirements;
CREATE POLICY "Public can view active compliance requirements" ON compliance_requirements
  FOR SELECT TO authenticated, anon
  USING (true);

-- 5.2 PROVIDERS TABLE POLICIES
DROP POLICY IF EXISTS "Public can view active approved providers" ON providers;
DROP POLICY IF EXISTS "Providers can view own provider record" ON providers;
DROP POLICY IF EXISTS "Providers can create initial draft profile" ON providers;
DROP POLICY IF EXISTS "Providers can update own draft or pending profile" ON providers;
DROP POLICY IF EXISTS "Admins can manage all providers" ON providers;

-- Public can view active approved providers
CREATE POLICY "Public can view active approved providers" ON providers
  FOR SELECT TO authenticated, anon
  USING (status = 'ACTIVE');

-- Provider owners can view their draft/pending/rejected provider record
CREATE POLICY "Providers can view own provider record" ON providers
  FOR SELECT TO authenticated
  USING (
    is_current_user_active() AND (
      is_provider_owner(id)
      OR is_platform_admin()
    )
  );

-- Authenticated users can insert their own DRAFT profile (Preventing initial insertion as ACTIVE)
CREATE POLICY "Providers can create initial draft profile" ON providers
  FOR INSERT TO authenticated
  WITH CHECK (
    is_current_user_active()
    AND user_id = auth.uid()
    AND status = 'DRAFT'
  );

-- Provider owners can update their own details BUT cannot self-elevate to ACTIVE
CREATE POLICY "Providers can update own draft or pending profile" ON providers
  FOR UPDATE TO authenticated
  USING (
    is_current_user_active()
    AND is_provider_owner(id)
    AND status IN ('DRAFT', 'PENDING_REVIEW', 'REJECTED')
  )
  WITH CHECK (
    is_current_user_active()
    AND is_provider_owner(id)
    AND status IN ('DRAFT', 'PENDING_REVIEW') -- Cannot set status = ACTIVE
  );

-- Admins can manage all provider records (including setting status = ACTIVE / REJECTED)
CREATE POLICY "Admins can manage all providers" ON providers
  FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- 5.3 COMPLIANCE_DOCUMENTS POLICIES (Strict Private Storage Reference)
DROP POLICY IF EXISTS "Providers can read own compliance documents" ON compliance_documents;
DROP POLICY IF EXISTS "Providers can insert own compliance documents" ON compliance_documents;
DROP POLICY IF EXISTS "Admins can review compliance documents" ON compliance_documents;

-- Provider owners can view their own documents; Admins can view all. Anon is STRICTLY BLOCKED.
CREATE POLICY "Providers can read own compliance documents" ON compliance_documents
  FOR SELECT TO authenticated
  USING (
    is_current_user_active() AND (
      is_provider_owner(provider_id)
      OR user_id = auth.uid()
      OR is_compliance_reviewer()
    )
  );

-- Provider owners can upload documents for review under their own provider ID
CREATE POLICY "Providers can insert own compliance documents" ON compliance_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    is_current_user_active()
    AND (is_provider_owner(provider_id) OR user_id = auth.uid())
    AND status = 'PENDING'
  );

-- Only Admins / Compliance Reviewers can update document status (e.g. approve/reject)
CREATE POLICY "Admins can review compliance documents" ON compliance_documents
  FOR UPDATE TO authenticated
  USING (
    is_current_user_active() AND is_compliance_reviewer()
  )
  WITH CHECK (
    is_current_user_active() AND is_compliance_reviewer()
  );

-- 6. REFRESH PUBLIC PROVIDER VIEW (Data Boundary Sanitization)
DROP VIEW IF EXISTS public.providers_public_view CASCADE;
CREATE VIEW public.providers_public_view AS
SELECT
  p.id,
  p.user_id,
  p.trade_name AS display_name,
  p.avatar_url,
  p.type AS provider_type,
  p.bio,
  p.rating_average,
  p.rating_count,
  p.neighborhood,
  p.city,
  p.state,
  p.service_radius_km,
  p.status,
  (p.status = 'ACTIVE') AS is_verified,
  p.created_at
FROM public.providers p
WHERE p.status = 'ACTIVE';

GRANT SELECT ON public.providers_public_view TO authenticated, anon;
