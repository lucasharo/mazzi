-- LIVE-authoritative reference data candidate. Operational rows excluded.
-- Canonical non-PII requirement required by R10D.
INSERT INTO public.compliance_requirements (
  id, provider_type, document_type, title, description, is_mandatory,
  effective_from, scope
)
VALUES (
  'req_termo_conduta_mazzi',
  'INSTRUCTOR'::public.provider_type,
  'MAZZI_TERMS_ACCEPTANCE',
  'Termos de conduta MAZZI',
  'Aceite dos termos vigentes da MAZZI.',
  TRUE,
  '2026-01-01'::timestamptz,
  'PROVIDER'::public.compliance_document_scope
)
ON CONFLICT (id) DO UPDATE SET
  provider_type = EXCLUDED.provider_type,
  document_type = EXCLUDED.document_type,
  is_mandatory = EXCLUDED.is_mandatory,
  effective_from = EXCLUDED.effective_from,
  scope = EXCLUDED.scope;
