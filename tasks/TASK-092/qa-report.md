# TASK-092 — QA das preferências de notificações

TASK: TASK-092
STATUS: QA_APPROVED
OWNER: MAZZI QA
LAST_UPDATED: 2026-09-05

## Resultado

APROVADO COM RESSALVAS OPERACIONAIS. A implementação foi validada no código,
na suíte local, nos builds, no DEV Supabase e em smoke visual dos dois apps.

## Ambiente Auditado

- Repositório `D:\mazzi_premium_ui_v2`.
- Supabase DEV `bhvpkgonhlujmxvwnxix`.
- Student DEV `http://127.0.0.1:3001/` e Provider DEV `http://127.0.0.1:3002/`.
- Viewports visuais: 375px, 390px e 430px.
- Production não auditada nem alterada.

## Critérios de Aceite

- **AC01 — PASS**: seção aparece nos Perfis Student e PRO.
- **AC02 — PASS**: catálogo contextual lista 9 tipos no Student e 13 no PRO, cobrindo os 16 tipos canônicos no conjunto.
- **AC03 — PASS**: inputs checkbox têm labels, descrição, estado anunciado e área visual com alvo adequado.
- **AC04 — PASS**: preferência ausente é interpretada como ligada.
- **AC05 — PASS**: alteração foi persistida no DEV e o registro final foi confirmado por SQL.
- **AC06 — PASS**: RPCs usam `auth.uid`, tipo é validado, grants anônimos e acesso direto à tabela estão bloqueados.
- **AC07 — PASS**: trigger retorna `NULL` apenas para novo evento explicitamente desabilitado; não há deleção de histórico.
- **AC08 — PASS**: erro de leitura/gravação apresenta mensagem e rollback do estado otimista.
- **AC09 — PASS**: lint, 955 testes e quatro builds aprovados.

## Happy Path

Os dois apps carregaram o Perfil, exibiram a seção e mostraram switches ligados
quando não havia preferência salva. No Student, um switch foi desligado e
religado, com atualização imediata da UI e persistência confirmada no DEV.

## Negative Tests

O teste estático cobre sessão obrigatória, tipo inválido, rollback e ausência de
deleção histórica. A tabela tem política `FOR ALL ... USING (FALSE)` para
`anon`/`authenticated` e nenhum grant direto.

## Segurança e RLS/RBAC

RLS está ativo em `user_notification_preferences`; as RPCs não recebem
`user_id`, usam a sessão corrente e só são executáveis por `authenticated`.
Advisors não retornaram aviso relacionado à nova tabela após o hardening.

## Mobile e Responsividade

Em 375px, Student e PRO mantiveram a lista dentro da largura disponível, com
descrições quebrando naturalmente e switches alinhados à direita. Em 390px e
430px, a seção permaneceu presente e o DOM confirmou `scrollWidth` igual ao
viewport, sem overflow horizontal. O componente usa `min-h-[68px]`, foco
visível e transição curta sem deslocar o layout.

## Acessibilidade (a11y)

Cada switch é um checkbox nativo com label, `aria-label`, `aria-describedby`,
estado `checked` e estado `disabled` durante gravação. Ícones são SVG Lucide e
decorativos.

## Regressão

146 arquivos e 955 testes aprovados; Student, Instructor, Admin e Landing
compilaram com sucesso. Os avisos de chunk grande são preexistentes do bundle.

## Bugs Encontrados

Nenhum BUG BLOCKER, CRITICAL ou HIGH pendente.

## Riscos Identificados

Não foi executada uma tentativa destrutiva de acesso cruzado em identidade
separada no DEV. O isolamento está coberto pela função sem `user_id` externo,
RLS/grants verificados e testes de contrato.

## Recomendação para o Tech Lead

Homologar como DONE/READY_FOR_MERGE, mantendo Production intocada até o fluxo
de preferências ser aprovado no ciclo normal de release.
