# TASK-091 — Consolidação da Aula Agora PRO

TASK: TASK-091
STATUS: READY_FOR_QA
OWNER: MAZZI Dev
LAST_UPDATED: 2026-09-04

## O que foi Implementado

- Removido `ON_THE_WAY` de `BookingStatus`, listas de lifecycle e apresentação comercial.
- Criado derivador de estado operacional para pagamento, deslocamento, chegada e aula iniciada.
- Mapper preserva o status do banco, o ponto estruturado e o timestamp persistido de deslocamento.
- Removido fallback de `sessionStorage`, atualização direta de booking, inserção direta de notificação e coordenada fictícia do browser.
- PRO passou a carregar bookings por RPC autorizada, com redaction do ponto durante `PENDING_PAYMENT`.
- Navegação só é liberada com coordenadas exatas válidas.

## Arquivos Alterados

`src/types/index.ts`, `src/domain/booking.ts`, `src/domain/checkin.ts`,
`src/domain/instant-lesson.ts`, `src/domain/status-presentation.ts`,
`src/domain/lesson-session.ts`, `src/lib/db-service.ts`, `ProviderApp`,
`ProviderBookingDetailsModal`, `BookingDetailsModal`, `CheckoutModal`,
`InstantLessonActiveBanner` e testes relacionados. A alteração preexistente de
`SlotSelectorModal` foi preservada.

## Migrations Criadas e Aplicadas

- Local: `supabase/migrations/20260904200000_task_091_aula_agora_consolidation.sql`.
- DEV Supabase `bhvpkgonhlujmxvwnxix`: aplicada com sucesso; o ledger registrou
  `task_091_aula_agora_consolidation`.
- Production não foi acessada.

## Decisões Técnicas Tomadas

- `CONFIRMED` permanece canônico enquanto o PRO se desloca.
- `set_provider_on_the_way` exige sessão, instrutor atribuído e `CONFIRMED`,
  trava a reserva, persiste timestamp no backend, notifica semanticamente e audita.
- Matching deduplica por instrutor, usa onda de até 3, localização fresca e
  janela ETA ida + duração + ETA até próxima aula + margem de segurança.
- A leitura do PRO remove as chaves de ponto/coordenadas do snapshot durante
  pagamento pendente e libera o objeto estruturado após confirmação.

## Desvios do Plano Técnico

Nenhum desvio funcional. A migration foi aplicada depois de a correção SQL de
alias intermediário e redaction do snapshot ser validada localmente.

## Testes Adicionados

- Estado operacional derivado sem mutar status comercial.
- Hidratação de `CONFIRMED` com `provider_on_the_way_at`.
- Contratos de notification, idempotência, grants e redaction.
- Check-in sem status comercial `ON_THE_WAY`.

## Testes Executados

- `npm test`: 142 arquivos, 928 testes aprovados.
- `npm run lint`: aprovado (`tsc --noEmit`).
- `npm run build:all`: student, instructor, admin e landing aprovados.
- `git diff --check`: aprovado.
- Auditoria DEV: enum canônico, funções, grants `authenticated`/`anon`,
  `SECURITY DEFINER` e constraint de notification verificados.

## Resultado do Lint

APROVADO.

## Resultado do Build Student

APROVADO.

## Resultado do Build Instructor

APROVADO.

## Resultado do Build Admin

APROVADO.

## Testes Manuais Realizados

Servidor DEV local do instrutor aberto temporariamente; login rápido DEV e
rota de aulas verificados no navegador automatizado sem criar ou alterar aula.
Browser e servidor temporário foram encerrados ao final.

## Limitações e Riscos Conhecidos

Os advisors do projeto DEV continuam reportando avisos históricos de policies e
índices fora do escopo desta task. O teardown de happy-dom emite um `AbortError`
informativo, sem falha de teste. Não foi executado aceite cruzado entre duas
contas em dados live para não alterar dados DEV controlados.

## Handoff para QA

Auditar o diff, a migration live e especialmente autorização do instrutor,
redaction antes do pagamento, repetição de deslocamento, ausência de fallback
local e permanência de `CONFIRMED` em Hoje/ativas.
