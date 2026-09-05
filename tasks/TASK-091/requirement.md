# TASK-091 — Consolidação da Aula Agora PRO

TASK: TASK-091
STATUS: PRODUCT_READY
OWNER: MAZZI Product
LAST_UPDATED: 2026-09-04

## 1. Objetivo

Consolidar o ciclo da Aula Agora PRO com autoridade no backend, separando o
status comercial da reserva do estado operacional de deslocamento, preservando
o fluxo visual já aprovado e fechando as lacunas de privacidade, autorização,
idempotência, mapa e migrations no ambiente DEV.

## 2. Problema

O frontend ainda transforma `CONFIRMED` em `ON_THE_WAY`, usa fallback direto no
browser quando a RPC falha e pode expor o ponto exato antes do pagamento. O DEV
também está divergente das migrations locais de matching e deslocamento.

## 3. Usuário Afetado

Aluno, instrutor/PRO, autoescola e plataforma.

## 4. Escopo

- Manter `booking.status` no lifecycle canônico: `PENDING_PAYMENT`,
  `CONFIRMED`, `IN_PROGRESS`, `COMPLETED` e estados terminais.
- Derivar o estado operacional da Aula Agora separadamente, com precedência
  documentada para pagamento, deslocamento, chegada/check-in e aula iniciada.
- Remover `ON_THE_WAY` de `BookingStatus` e de todas as listas de lifecycle.
- Fazer `set_provider_on_the_way` ser exclusiva do instrutor atribuído,
  idempotente e persistida no backend, com notificação semântica e auditoria.
- Remover fallback de banco, `sessionStorage` e sucesso artificial do browser.
- Garantir que `PENDING_PAYMENT` retorne ao PRO apenas contexto aproximado e
  que `CONFIRMED` libere endereço estruturado, coordenadas, mapa e navegação.
- Preservar ponto de encontro estruturado e navegação por coordenadas exatas,
  sem coordenada genérica de São Paulo.
- Reconciliar as funções de multi-role, contagem de instrutores, ondas de 3 e
  janela de agenda no DEV por migration forward-only.
- Preservar agendamento tradicional, pagamento server-side, check-in, chat,
  mapa Leaflet/OSM e as melhorias visuais já existentes.

## 5. Fora de Escopo

Production, dinheiro real, redesign amplo, React Native, novas categorias
públicas, alteração do lifecycle tradicional, novo sistema de tracking ou
qualquer acesso frontend com `service_role`.

## 6. Regras de Negócio

1. `CONFIRMED` continua sendo o status da reserva enquanto o PRO se desloca.
2. `ON_THE_WAY` existe somente como estado operacional derivado de dado
   persistido no backend.
3. Somente o instrutor atribuído pode registrar “Estou a caminho”; owner,
   SCHOOL_ADMIN e SCHOOL_STAFF não podem declarar deslocamento de outro
   instrutor.
4. A primeira chamada registra o instante e uma notificação; retries mantêm o
   instante e não criam outra notificação.
5. Antes do pagamento, o PRO não recebe endereço nem coordenadas exatas da Aula
   Agora; após `CONFIRMED`, recebe o objeto estruturado completo.
6. Falha da RPC não muda estado local nem grava qualquer dado alternativo.
7. Aluno com `CONFIRMED + provider_on_the_way_at` permanece em Hoje/ativas,
   nunca no Histórico por causa do deslocamento.
8. Matching deve usar instrutores distintos, no máximo 3 por onda, preço como
   gate e janela `ETA ida + duração + ETA até próxima aula + margem`; ausência
   de localização operacional segura da próxima aula falha fechada quando
   necessário.

## 7. Fluxo Principal (Happy Path)

Aceite do PRO → booking `PENDING_PAYMENT` → PRO aguarda pagamento → webhook
confirma → booking `CONFIRMED` → endereço exato é liberado → PRO registra
deslocamento → aluno recebe “PRO a caminho” → check-in → `IN_PROGRESS` →
`COMPLETED`.

## 8. Casos de Borda e Exceções

Sessão ausente, usuário com múltiplas roles, outro instrutor, owner de
autoescola, retry idempotente, RPC ausente, booking cancelada/expirada/
concluída, ponto sem coordenadas, localização stale, refresh, concorrência de
aceite, conflito de agenda e falha de realtime.

## 9. Estados de Erro e Mensagens

Falhas devem permanecer fail-closed e usar mensagens amigáveis existentes:
permissão negada, sessão expirada, reserva não encontrada, estado inválido,
localização exata indisponível, conflito de agenda e tentativa novamente.

## 10. Critérios de Aceite

- **AC01**: Nenhum mapper altera `booking.status`; `ON_THE_WAY` não pertence a `BookingStatus`.
- **AC02**: `CONFIRMED` com timestamp de deslocamento deriva operacionalmente para `ON_THE_WAY` e continua em Hoje/ativas do Aluno.
- **AC03**: RPC de deslocamento aceita somente instrutor atribuído e `CONFIRMED`, sem aceitar retry que sobrescreva timestamp.
- **AC04**: Retry idempotente não duplica notificação nem evento de auditoria.
- **AC05**: Falha/ausência da RPC não usa tabela, snapshot, notification ou storage do browser como fallback.
- **AC06**: `PENDING_PAYMENT` redige o ponto exato no contrato de leitura do PRO; `CONFIRMED` libera ponto estruturado e navegação exata.
- **AC07**: DEV possui as funções corrigidas, grants restritivos, enum canônico, multi-role, contagem distinta, onda 3 e janela fail-closed.
- **AC08**: Agendamento tradicional e o mapa/realtime/pagamento existentes não regredem.
- **AC09**: Testes adversariais cobrem mapper, Hoje/Histórico, autorização, idempotência, privacidade, navegação e RPC ausente.
- **AC10**: `npm run lint`, `npm test`, `npm run build:all` e `git diff --check` passam; QA e revisão final registram evidências. Sem isso, a task fica bloqueada para release.

## 11. Dependências

`.agents/workflows/mazzi-feature.md`, `docs/08-booking.md`, `MVP_RULES.md`,
`SECURITY_RULES.md`, TASK-089, TASK-090, migrations de Aula Agora, Supabase
DEV `bhvpkgonhlujmxvwnxix` e os componentes atuais de mapa/checkout/check-in.

## 12. Decisões Pendentes

Nenhuma regra de produto pendente. A publicação DEV somente poderá ocorrer
após todos os gates e validação controlada; Production permanece intocada.

## 13. Riscos de Produto

Qualquer exposição de endereço antes do pagamento, mudança de status comercial,
fallback local ou autorização ampla de deslocamento é risco crítico de
privacidade, cobrança ou operação.

## 14. Handoff para Tech Lead

Auditar as funções live e migrations ausentes; produzir plano técnico
forward-only. Não considerar a UI existente prova de autoridade do backend.
