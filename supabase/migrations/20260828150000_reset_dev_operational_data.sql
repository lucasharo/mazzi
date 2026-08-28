BEGIN;

-- Limpeza controlada do ambiente DEV. Mantém identidades, cadastros,
-- documentos, arquivos do Storage e auditoria para permitir novos testes.
CREATE TEMP TABLE dev_providers_without_bucket_files ON COMMIT DROP AS
SELECT p.id
FROM public.providers AS p
LEFT JOIN public.compliance_documents AS d
  ON d.provider_id = p.id
  AND d.storage_path IS NOT NULL
  AND d.storage_path NOT LIKE 'acceptance://%'
LEFT JOIN storage.objects AS o
  ON o.bucket_id = 'provider-compliance-docs'
  AND o.name = d.storage_path
GROUP BY p.id
HAVING COUNT(DISTINCT o.id) = 0;

-- Prestadores sem arquivo físico não ficam elegíveis para consulta pública.
UPDATE public.providers AS p
SET status = 'PENDING_REVIEW'::public.provider_status,
    updated_at = NOW()
WHERE p.id IN (SELECT id FROM dev_providers_without_bucket_files);

UPDATE public.service_offerings AS o
SET is_active = FALSE,
    status = 'INACTIVE',
    updated_at = NOW()
WHERE o.provider_id IN (SELECT id FROM dev_providers_without_bucket_files);

-- Remove dados operacionais de teste respeitando as referências entre tabelas.
DELETE FROM public.refunds;
DELETE FROM public.payouts;
DELETE FROM public.payments;
DELETE FROM public.reviews;
DELETE FROM public.conversations;
DELETE FROM public.bookings;
DELETE FROM public.quotes;
DELETE FROM public.payment_webhook_events;

COMMIT;
