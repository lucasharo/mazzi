# QA Report — TASK-087

TASK: TASK-087  
STATUS: QA_APPROVED_WITH_LIMITATIONS  
OWNER: MAZZI QA  
LAST_UPDATED: 2026-09-02

## 1. Veredito Final

**APROVADO COM RESSALVAS.** As falhas automatizáveis encontradas na auditoria anterior foram corrigidas e validadas. Permanecem somente limitações que dependem de navegador/dispositivo controlado: confirmar a VAPID pública no build DEV e executar o E2E real de push, incluindo warm start, cold start e retomada pós-login.

## 2. Ambiente Auditado

- Repositório: `D:/mazzi_premium_ui_v2`, branch `feature/premium-ui-v2`.
- Firebase: projeto DEV `mazzi-af65c`, Web App MAZZI existente.
- Supabase: projeto DEV `bhvpkgonhlujmxvwnxix` (`mazzi-dev`).
- Supabase remoto: migrations TASK-086/TASK-087 registradas; migration do webhook registrada como `20260902154300`; Edge Function `dispatch-push-notification` ativa na versão 2, com `verify_jwt=false` protegido por segredo customizado.
- Infraestrutura concorrente: somente `public/sw.js`; não existe `firebase-messaging-sw.js`.
- Production: nenhuma alteração ou validação mutável foi realizada. `PRODUCTION_UNTOUCHED`.

## 3. Avaliação dos Critérios de Aceite

- **AC01 — PASS**: Firebase e Supabase DEV foram identificados; a credencial FCM agora é recusada quando `account.project_id` diverge de `FIREBASE_PROJECT_ID`.
- **AC02 — PASS**: FCM usa o único `public/sw.js` e a mesma `ServiceWorkerRegistration`; não há worker concorrente.
- **AC03 — PASS**: registro deriva `auth.uid()`, valida papel/contexto `STUDENT`/`PRO`, e as tabelas de devices não são consultáveis por usuários.
- **AC04 — PASS**: registro usa chave única por usuário/contexto/provider/fingerprint, suporta rotação e múltiplos dispositivos, e o logout desativa o device de forma best-effort.
- **AC05 — PASS**: trigger de fan-out e `UNIQUE(notification_id, device_id)` preservam no máximo uma entrega lógica por device elegível.
- **AC06 — PENDENTE NÃO AUTOMATIZÁVEL**: falta comprovar no navegador/dispositivo o fluxo real `BOOKING_CONFIRMED` até o push recebido e a abertura da reserva.
- **AC07 — PENDENTE NÃO AUTOMATIZÁVEL**: warm start/background ainda depende de browser/dispositivo controlado.
- **AC08 — PENDENTE NÃO AUTOMATIZÁVEL**: cold start com PWA fechado ainda não foi executado.
- **AC09 — PENDENTE NÃO AUTOMATIZÁVEL**: retomada pós-login com push real ainda não foi executada.
- **AC10 — PASS**: sino e push utilizam o mesmo `notification-navigation` e o mesmo destino allowlisted.
- **AC11 — PASS COM RESSALVA**: separação `STUDENT`/`PRO` está implementada; validação manual multi-role permanece dependente de fixture/dispositivo.
- **AC12 — PASS COM RESSALVA**: payout está allowlisted para `PRO`/Ganhos; não foi criado dado financeiro artificial para E2E.
- **AC13 — PASS COM RESSALVA**: `NEW_MESSAGE` envia somente payload data-only mínimo, sem conteúdo integral; E2E de chat/lock screen permanece pendente.
- **AC14 — PASS**: CTA explícito, sem prompt automático, com estados de configuração, suporte e permissão sem bloquear o app.
- **AC15 — PASS**: claim atômico, unique constraint, retry limitado, classificação de token inválido e invalidação do device estão implementados e cobertos pelo teste de contrato.
- **AC16 — PASS**: destinos são allowlisted e o fallback compartilhado evita URL arbitrária e mantém o contexto seguro.
- **AC17 — PASS**: não há credenciais privadas, bearer token, service account ou token FCM completo em frontend, documentação ou logs auditados.
- **AC18 — PASS COM RESSALVA**: testes de cliente, worker, navegação, registry e dispatcher estão presentes; os cenários que exigem permissão/entrega física permanecem na matriz E2E manual.
- **AC19 — PASS**: `npm run lint`, `npm test`, `npm run build:all` e `git diff --check` passaram nesta reauditoria.
- **AC20 — PENDENTE NÃO AUTOMATIZÁVEL**: a prontidão final exige prova real do fluxo completo e cold start, ainda não executada.

## 4. Testes do Fluxo Principal (Happy Path)

- Normalização de payload FCM flat data-only: PASS.
- Rejeição de destino incompatível: PASS.
- Configuração incompleta sem bloqueio do app: PASS.
- Capability/permissão e worker único: PASS.
- Dispatcher sem autenticação: GET retornou `405`; POST sem segredo retornou `401`.
- Migration remota: tabelas, trigger de enqueue e trigger de webhook presentes no DEV.
- RLS/grants remotos: `authenticated` não possui acesso direto às tabelas privadas; RPCs de claim/finalização/invalidação são server-only.
- E2E real `BOOKING_CONFIRMED` → FCM → push → toque → reserva: **pendente de dispositivo controlado**.

## 5. Testes de Caminhos Negativos e Validação

- Configuração ausente, navegador sem suporte e permissionamento default/denied: PASS nos testes automatizados disponíveis.
- Payload FCM com URL arbitrária, destino incompatível e contexto inválido: PASS por allowlist cliente/worker/dispatcher.
- Contexto `ADMIN` no worker: PASS — agora rejeitado.
- Credencial Firebase de projeto divergente: PASS — `FCM_PROJECT_MISMATCH` é lançado antes da emissão/envio.
- Token inválido, `UNREGISTERED`, 429/5xx, retry limitado e preservação do histórico: PASS no contrato implementado; entrega real do provedor permanece não exercitada.
- Concorrência de claim e duplicidade: PASS por `FOR UPDATE SKIP LOCKED`, limite de tentativas e constraint única; não foi executado teste concorrente em produção DEV.

## 6. Segurança e Isolamento RLS/RBAC

- **PASS**: `user_push_devices` e `push_deliveries` têm RLS habilitado e não possuem grants para `anon`/`authenticated`.
- **PASS**: somente `authenticated` executa `register_my_push_device`; claim/finalização/invalidação permanecem server-only.
- **PASS**: registro usa `auth.uid()` e valida identidade ativa e contexto permitido; Admin não registra device.
- **PASS**: dispatcher busca a notificação canônica, filtra usuário/contexto/provider e não confia em usuário, texto ou destino enviados no webhook.
- **PASS**: webhook usa segredo armazenado no Vault/secret server-side; `verify_jwt=false` não deixa a função aberta sem autenticação própria.
- **PASS**: `sendFcmDataMessage` compara `FIREBASE_PROJECT_ID` com `account.project_id` antes de assinar/enviar.
- **PASS**: CI não injeta Firebase/VAPID no build de `main`; a configuração FCM só é passada para `feature/premium-ui-v2`.
- Alertas preexistentes do Supabase Advisor, incluindo `spatial_ref_sys` sem RLS e funções SECURITY DEFINER antigas, permanecem fora do escopo desta task e não foram alterados.

## 7. Responsividade e Mobile First

Não validado em navegador nesta execução. A pendência é operacional e não indica falha automatizada: confirmar CTA, overflow e touch targets em 375px, 390px e 430px durante o E2E DEV.

## 8. Acessibilidade (a11y)

- PASS estático: CTA é botão real, tem estado de loading e mensagens com `role="status"`/`role="alert"`.
- Pendente manual: foco via teclado, leitor de tela e prompt real de permissão.

## 9. Regressão

- `npm run lint`: PASS, 0 erros.
- `npm test`: PASS, 126 arquivos e 839 testes.
- `npm run build:all`: PASS para Student, Instructor, Admin e Landing; somente avisos existentes de tamanho de chunks.
- `git diff --check`: PASS; apenas avisos de normalização LF/CRLF.
- `tests/fcm-dispatcher.test.ts`: presente e passou como parte da suíte.
- Migration `20260902154300_task_087_fcm_webhook_dispatch.sql`: presente no working tree e corresponde à migration registrada no DEV.
- O teste completo ainda imprime `DOMException [AbortError]` de teardown do happy-dom, mas termina com código 0 e todos os testes aprovados; registrar para manutenção, sem bloquear esta task.

## 10. Bugs Encontrados

### BUG-001 — E2E físico e cold start ainda não evidenciados

- **Severidade**: LIMITAÇÃO NÃO AUTOMATIZÁVEL
- **Passos para Reproduzir**:
  1. Abrir o build DEV HTTPS em dispositivo controlado.
  2. Ativar notificações com VAPID pública configurada.
  3. Gerar `BOOKING_CONFIRMED` para o Student.
  4. Repetir com app aberto/background e com PWA fechado.
- **Comportamento Esperado**: receber push, tocar, abrir `Aulas` e exibir a reserva correta, inclusive após login.
- **Comportamento Atual**: o fluxo ainda não foi observado em dispositivo real.
- **Evidência**: AC06–AC09 e AC20 dependem de navegador/OS/dispositivo controlado.

### BUG-002 — VAPID pública do build DEV ainda não comprovada

- **Severidade**: LIMITAÇÃO NÃO AUTOMATIZÁVEL/CONFIGURAÇÃO DEV
- **Passos para Reproduzir**: ativar o CTA no build DEV sem confirmar a variável pública `VITE_FCM_VAPID_KEY`.
- **Comportamento Esperado**: `getToken` obter token FCM usando a VAPID pública do projeto `mazzi-af65c`.
- **Comportamento Atual**: a presença e correspondência da VAPID ainda não foram registradas como evidência do build/tunnel.
- **Evidência**: o contrato permanece desativado quando a configuração pública está incompleta; nenhum valor secreto foi exposto.

Não há bugs `BLOCKER`, `CRITICAL` ou `HIGH` automatizáveis pendentes após as correções desta revisão.

## 11. Riscos Identificados

- A entrega FCM e a navegação em background/cold start não podem ser inferidas apenas pelos testes Vitest.
- A origem HTTPS do tunnel deve permanecer estável para preservar o registro/token do dispositivo.
- O Supabase Advisor mantém alertas anteriores fora do escopo.
- O aviso de teardown do happy-dom não falha a suíte, mas merece correção futura.

## 12. Recomendação para o Tech Lead

Aceitar a implementação como `QA_APPROVED_WITH_LIMITATIONS` e encaminhar para a validação final, mantendo explícitas as duas pendências operacionais:

1. Confirmar/injetar a VAPID pública somente no build DEV e registrar apenas sua presença/identificador.
2. Executar o E2E `BOOKING_CONFIRMED` em dispositivo controlado: foreground, background/warm start, PWA fechado/cold start e retomada pós-login.

Após essas evidências, a task poderá ser reavaliada para encerramento final. Não executar qualquer fluxo equivalente em Production.

`PRODUCTION_UNTOUCHED`
