-- Align the persisted compliance document enum with the canonical requirement catalog.
-- Forward-only: existing enum values and rows remain unchanged.

ALTER TYPE public.compliance_doc_type ADD VALUE IF NOT EXISTS 'CNH_EAR';
ALTER TYPE public.compliance_doc_type ADD VALUE IF NOT EXISTS 'CREDENTIAL_DETRAN_SP';
ALTER TYPE public.compliance_doc_type ADD VALUE IF NOT EXISTS 'CREDENTIAL_HISTORICAL';
ALTER TYPE public.compliance_doc_type ADD VALUE IF NOT EXISTS 'MAZZI_TERMS_ACCEPTANCE';
ALTER TYPE public.compliance_doc_type ADD VALUE IF NOT EXISTS 'COMPANY_REGISTRATION';
ALTER TYPE public.compliance_doc_type ADD VALUE IF NOT EXISTS 'CFC_AUTHORIZATION';
ALTER TYPE public.compliance_doc_type ADD VALUE IF NOT EXISTS 'CFC_AUTHORIZATION_STATE';
