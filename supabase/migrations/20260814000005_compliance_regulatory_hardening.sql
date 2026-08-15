-- ============================================================================
-- MAZZI PLATFORM — SPRINT 04: COMPLIANCE REGULATORY HARDENING & STORAGE MIGRATION
-- File: 20260814000005_compliance_regulatory_hardening.sql
-- ============================================================================

-- 1. ADD REGULATORY SOURCE & JURISDICTION METADATA TO COMPLIANCE REQUIREMENTS
ALTER TABLE public.compliance_requirements
  ALTER COLUMN state DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS country VARCHAR(2) NOT NULL DEFAULT 'BR',
  ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) NOT NULL DEFAULT 'INTERNAL_MAZZI_RULE',
  ADD COLUMN IF NOT EXISTS source_reference TEXT NOT NULL DEFAULT 'Regra Interna MAZZI',
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_identifier VARCHAR(100),
  ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ;

-- 2. UPDATE EXISTING AND INSERT CATALOG REQUIREMENTS WITH EXACT REGULATORY BASES
INSERT INTO public.compliance_requirements (
  id, country, state, jurisdiction, provider_type, document_type, title, description,
  is_mandatory, source_type, source_reference, source_identifier, regulatory_status,
  validity_period_days, effective_from, last_validated_at
) VALUES
  (
    'req_cnh_ear', 'BR', NULL, 'FEDERAL', 'INSTRUCTOR', 'CNH_EAR',
    'CNH com Observação EAR (Exerce Atividade Remunerada)',
    'Carteira Nacional de Habilitação válida (Categoria A ou B) com anotação oficial EAR conforme o CTB.',
    TRUE, 'FEDERAL_LAW', 'Lei Federal nº 9.503/1997 (CTB), Art. 147, § 5º',
    'LEI_9503_ART147_PAR5', 'OFFICIALLY_VALIDATED', 1825, '2026-01-01T00:00:00Z', '2026-08-14T00:00:00Z'
  ),
  (
    'req_instrutor_formacao_fed', 'BR', NULL, 'FEDERAL', 'INSTRUCTOR', 'CREDENTIAL_DETRAN',
    'Certificado e Requisitos Profissionais de Instrutor de Trânsito',
    'Comprovação de curso de formação e atendimento aos requisitos profissionais conforme art. 4º da Lei nº 12.302/2010 e art. 110 da Resolução CONTRAN nº 1.020/2025.',
    TRUE, 'FEDERAL_LAW', 'Lei Federal nº 12.302/2010, Art. 4º e Resolução CONTRAN nº 1.020/2025, Art. 110',
    'LEI_12302_ART4_CONTRAN_1020_ART110', 'OFFICIALLY_VALIDATED', 730, '2026-01-01T00:00:00Z', '2026-08-14T00:00:00Z'
  ),
  (
    'req_antecedentes_instrutor_fed', 'BR', NULL, 'FEDERAL', 'INSTRUCTOR', 'CRIMINAL_BACKGROUND',
    'Certidão Negativa de Antecedentes Criminais (Requisito Regulatório Federal)',
    'Certidão negativa de antecedentes criminais para exercício da profissão conforme art. 110 da Resolução CONTRAN nº 1.020/2025 e art. 4º, VI da Lei nº 12.302/2010.',
    TRUE, 'CONTRAN_RESOLUTION', 'Resolução CONTRAN nº 1.020/2025, Art. 110 e Lei Federal nº 12.302/2010, Art. 4º, VI',
    'CONTRAN_1020_ART110_ANTECEDENTES', 'OFFICIALLY_VALIDATED', 90, '2026-01-01T00:00:00Z', '2026-08-14T00:00:00Z'
  ),
  (
    'req_credencial_detran_sp', 'BR', 'SP', 'STATE', 'INSTRUCTOR', 'CREDENTIAL_DETRAN_SP',
    'Credenciamento e Cadastro Operacional no DETRAN-SP',
    'Registro e credenciamento ativo no cadastro operacional do DETRAN-SP conforme portarias estaduais de regulação.',
    TRUE, 'DETRAN_STATE_REGULATION', 'Portaria DETRAN-SP de Credenciamento e Cadastro Operacional de Instrutores',
    'DETRAN_SP_PORTARIA_INSTRUTOR', 'REQUIRES_REGULATORY_VALIDATION', 730, '2026-01-01T00:00:00Z', '2026-08-14T00:00:00Z'
  ),
  (
    'req_contran_789_historico', 'BR', NULL, 'FEDERAL', 'INSTRUCTOR', 'CREDENTIAL_HISTORICAL',
    'Regulamentação Histórica de Instrutores (CONTRAN 789/2020)',
    'Normativa histórica de credenciamento superada e consolidada pela Resolução CONTRAN nº 1.020/2025 (Arts. 109-111).',
    FALSE, 'CONTRAN_RESOLUTION', 'Resolução CONTRAN nº 789/2020 (Superada pela Resolução CONTRAN nº 1.020/2025)',
    'CONTRAN_789_2020_SUPERSEDED', 'SUPERSEDED', NULL, '2020-06-01T00:00:00Z', '2026-08-14T00:00:00Z'
  ),
  (
    'req_termo_conduta_mazzi', 'BR', NULL, 'INTERNAL_PLATFORM', 'INSTRUCTOR', 'MAZZI_TERMS_ACCEPTANCE',
    'Código de Ética e Segurança da Plataforma MAZZI',
    'Termo de adesão às diretrizes de qualidade, assiduidade e conduta profissional do marketplace MAZZI (norma interna, não obrigação legal).',
    TRUE, 'INTERNAL_MAZZI_RULE', 'Política de Confiança e Segurança MAZZI v1.0 (Regra Interna de Marketplace)',
    'MAZZI_SAFETY_POLICY_SEC_2', 'REQUIRES_REGULATORY_VALIDATION', NULL, '2026-01-01T00:00:00Z', '2026-08-14T00:00:00Z'
  ),
  (
    'req_cnpj_contrato_fed', 'BR', NULL, 'FEDERAL', 'DRIVING_SCHOOL', 'COMPANY_REGISTRATION',
    'Comprovante de Inscrição CNPJ e Atos Constitutivos',
    'Comprovante de Inscrição e de Situação Cadastral no CNPJ e registro dos atos constitutivos na Junta Comercial.',
    TRUE, 'FEDERAL_LAW', 'Lei Federal nº 10.406/2002 (Código Civil, Art. 985 e Art. 1.150) e Instrução Normativa RFB nº 2.119/2022',
    'CC_LEI_10406_IN_RFB_2119', 'OFFICIALLY_VALIDATED', NULL, '2026-01-01T00:00:00Z', '2026-08-14T00:00:00Z'
  ),
  (
    'req_credenciamento_cfc_fed', 'BR', NULL, 'FEDERAL', 'DRIVING_SCHOOL', 'CFC_AUTHORIZATION',
    'Diretrizes Federais de Credenciamento de CFC (CONTRAN)',
    'Requisitos federais de credenciamento e funcionamento de CFC conforme Resolução CONTRAN nº 1.020/2025, Arts. 118, 119 e 120.',
    TRUE, 'CONTRAN_RESOLUTION', 'Resolução CONTRAN nº 1.020/2025, Art. 118, Art. 119 e Art. 120',
    'CONTRAN_1020_ARTS_118_120', 'OFFICIALLY_VALIDATED', NULL, '2026-01-01T00:00:00Z', '2026-08-14T00:00:00Z'
  ),
  (
    'req_portaria_cfc_sp', 'BR', 'SP', 'STATE', 'DRIVING_SCHOOL', 'CFC_AUTHORIZATION_STATE',
    'Portaria de Credenciamento de CFC no DETRAN-SP',
    'Ato de credenciamento operacional e autorização de funcionamento expedido pelo DETRAN-SP conforme delegado pelo Art. 120 da Resolução CONTRAN nº 1.020/2025.',
    TRUE, 'DETRAN_STATE_REGULATION', 'Portaria DETRAN-SP de Credenciamento de CFC e Art. 120 da Resolução CONTRAN nº 1.020/2025',
    'DETRAN_SP_PORTARIA_CFC', 'REQUIRES_REGULATORY_VALIDATION', 365, '2026-01-01T00:00:00Z', '2026-08-14T00:00:00Z'
  ),
  (
    'req_alvara_funcionamento_mun', 'BR', 'SP', 'MUNICIPAL', 'DRIVING_SCHOOL', 'CFC_ALVARA',
    'Alvará Municipal de Funcionamento e Localização',
    'Alvará municipal vigente emitido pela Prefeitura Municipal da sede do CFC.',
    TRUE, 'MUNICIPAL_REGULATION', 'Lei Municipal de Uso e Ocupação do Solo / Código de Posturas Municipal',
    'ALVARA_POSTURAS_MUNICIPAL', 'REQUIRES_REGULATORY_VALIDATION', 365, '2026-01-01T00:00:00Z', '2026-08-14T00:00:00Z'
  )
ON CONFLICT (id) DO UPDATE SET
  country = EXCLUDED.country,
  state = EXCLUDED.state,
  jurisdiction = EXCLUDED.jurisdiction,
  source_type = EXCLUDED.source_type,
  source_reference = EXCLUDED.source_reference,
  source_identifier = EXCLUDED.source_identifier,
  regulatory_status = EXCLUDED.regulatory_status,
  last_validated_at = EXCLUDED.last_validated_at,
  title = EXCLUDED.title,
  description = EXCLUDED.description;

-- 3. PROVISION PRIVATE STORAGE BUCKET FOR COMPLIANCE DOCUMENTS
-- Creates private bucket 'provider-compliance-docs' (public = false)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'provider-compliance-docs',
  'provider-compliance-docs',
  FALSE,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = FALSE,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

-- 4. HARDENED STORAGE RLS POLICIES FOR 'provider-compliance-docs'
-- Storage object paths follow the convention: providers/{provider_id}/compliance/{doc_id}/{filename}

-- 4.1 Storage Upload (INSERT) Policy
DROP POLICY IF EXISTS "Providers can upload own compliance documents to storage" ON storage.objects;
CREATE POLICY "Providers can upload own compliance documents to storage" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'provider-compliance-docs'
    AND is_current_user_active()
    AND (storage.foldername(name))[1] = 'providers'
    AND (storage.foldername(name))[3] = 'compliance'
    AND is_provider_owner(((storage.foldername(name))[2])::uuid)
  );

-- 4.2 Storage Read (SELECT) Policy
DROP POLICY IF EXISTS "Providers and reviewers can read compliance documents from storage" ON storage.objects;
CREATE POLICY "Providers and reviewers can read compliance documents from storage" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'provider-compliance-docs'
    AND is_current_user_active()
    AND (
      -- Provider owner can read own documents
      (
        (storage.foldername(name))[1] = 'providers'
        AND is_provider_owner(((storage.foldername(name))[2])::uuid)
      )
      -- Platform Admin / Support can review all documents
      OR is_compliance_reviewer()
    )
  );

-- 4.3 Storage Delete / Update Policy (Admins only)
DROP POLICY IF EXISTS "Admins can delete compliance documents from storage" ON storage.objects;
CREATE POLICY "Admins can delete compliance documents from storage" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'provider-compliance-docs'
    AND is_platform_admin()
  );
