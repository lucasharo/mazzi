-- TASK-093: point the current compliance catalog entry at the canonical v2 terms.
BEGIN;

UPDATE public.compliance_requirements
SET title = 'Termo de Adesão, Uso e Conduta do Profissional MAZZI',
    description = 'Aceite explícito e versionado dos termos vigentes da MAZZI.',
    source_reference = 'Termo de Adesão, Uso e Conduta do Profissional MAZZI v2.0 (Regra Interna de Marketplace)',
    source_identifier = 'MAZZI_PROFESSIONAL_TERMS_V2'
WHERE document_type = 'MAZZI_TERMS_ACCEPTANCE'
  AND provider_type = 'INSTRUCTOR'::public.provider_type;

COMMIT;

