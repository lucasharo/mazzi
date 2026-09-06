# Final Review — TASK-089

TASK: TASK-089
STATUS: READY_FOR_MERGE
OWNER: MAZZI Tech Lead
LAST_UPDATED: 2026-09-05

## 1. Resultado do QA

QA aprovado. Os critérios AC01–AC22 foram avaliados como PASS; os contratos anteriores de Aula Agora foram preservados e a janela de disponibilidade foi adicionada com evidência local, remota e visual.

## 2. Avaliação de Bugs e Riscos

Não há bug BLOCKER, CRITICAL ou HIGH pendente. Os avisos históricos dos advisors e o ETA geodésico estão documentados como riscos residuais, sem bloquear esta consolidação.

## 3. Avaliação Arquitetural e de Segurança

A disponibilidade pessoal está backend-owned em `provider_instant_instructor_status`, com `online_since`/`online_expires_at`, janela não renovável e matching fail-closed. Veículos continuam independentes em `instant_enabled`. A migration é forward-only, foi aplicada somente no Supabase DEV, mantém RLS restritiva, autorização por usuário/membro e grants mínimos.

O fluxo não adiciona estado `ON_THE_WAY` ao booking, não altera a agenda tradicional, não usa dinheiro float, não usa `service_role` no frontend e não expõe o campo legacy como autoridade.

## 4. Dívida Técnica Conscientemente Assumida

- ETA de entrada/saída permanece a aproximação geodésica já documentada até existir routing aprovado.
- Findings históricos do advisor do Supabase permanecem fora do escopo e devem ser tratados em task própria.
- `provider_instant_settings.instant_online` permanece somente como compatibilidade durante a transição; matching e UI usam o estado canônico.

## 5. Conformidade dos Critérios de Aceite

- Janela de 1 hora, expiração no backend, refresh sem renovação e reativação: PASS.
- Perda de elegibilidade, multi-carro, fallback para segundo carro e dedupe por instrutor: PASS, preservados e cobertos pela migration/contratos existentes.
- Privacidade, payment hold, lifecycle, check-in, tracking e navegação externa: PASS, sem alteração regressiva.
- UI, acessibilidade, mobile, lint, testes, build e diff check: PASS.

## 6. Decisão Final

READY_FOR_MERGE. Após push, confirmar os dois workflows obrigatórios. Se ambos concluírem com sucesso, atualizar este artefato para `STATUS: DONE`.
