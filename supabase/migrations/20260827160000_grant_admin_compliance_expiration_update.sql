BEGIN;

-- RLS continua restringindo a operação aos revisores; este grant habilita
-- apenas a execução da atualização protegida pela policy existente.
GRANT UPDATE ON public.compliance_documents TO authenticated;

COMMIT;
