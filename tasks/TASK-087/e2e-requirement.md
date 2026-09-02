# TASK-087 — Fechamento do E2E FCM no DEV

TASK: TASK-087
STATUS: PRODUCT_READY
OWNER: MAZZI Product
LAST_UPDATED: 2026-09-02

## 1. Objetivo

Comprovar, no ambiente DEV, a jornada real de uma notificação push FCM desde um evento MAZZI até o recebimento no dispositivo, a interação do usuário e a abertura do destino correto no aplicativo.

Esta continuação deve corrigir somente falhas comprovadas durante a validação do E2E. Não deve reimplementar o FCM nem alterar a arquitetura já aprovada.

## 2. Problema

Os testes automatizados e a infraestrutura DEV foram validados, mas ainda não há evidência operacional do recebimento de push com o aplicativo visível, em segundo plano, fechado ou após autenticação. Sem essas provas, a integração não pode ser considerada pronta para uso no DEV.

## 3. Usuário Afetado

- `STUDENT`: recebe a confirmação de uma reserva e deve ser levado à reserva correta.
- `INSTRUCTOR`: recebe eventos próprios do contexto PRO, quando houver um cenário DEV seguro disponível.
- `PLATFORM_ADMIN`: acompanha a validação e os registros operacionais, sem receber notificações de produção nesta tarefa.

## 4. Escopo

- Validar o registro real de um dispositivo DEV para o contexto `STUDENT`.
- Validar o evento `BOOKING_CONFIRMED` no fluxo completo.
- Validar recebimento com o aplicativo em primeiro plano.
- Validar recebimento com o aplicativo em segundo plano (warm start).
- Validar recebimento com o aplicativo fechado (cold start).
- Validar a retomada do destino original depois de um login solicitado após o toque na notificação.
- Confirmar que o Centro de Notificações e o push levam ao mesmo destino para a mesma notificação.
- Validar o comportamento amigável quando a entidade do destino não existe, foi removida ou não pode ser acessada.
- Validar a privacidade do conteúdo exibido e recebido.
- Validar um push do contexto PRO quando existir fixture DEV segura, sem fabricar dados financeiros incorretos.
- Publicar Student DEV e PRO DEV somente após os testes locais e pelo túnel HTTPS exigidos passarem.
- Repetir no ambiente DEV publicado os cenários obrigatórios de background, cold start e pós-login.
- Registrar evidências objetivas e o resultado de cada cenário.

## 5. Fora de Escopo

- Qualquer alteração em Production, incluindo Firebase, banco, secrets, deploy, dados ou envio de push.
- Criação de um segundo Service Worker ou de um fluxo paralelo de notificações.
- Troca do roteador ou reimplementação da integração FCM existente sem falha comprovada.
- Criação de eventos de negócio novos apenas para facilitar o teste.
- Envio para usuários, contas ou dispositivos não controlados.
- Uso de dados reais, PII, conteúdo integral de mensagens, evidências de contestação ou detalhes financeiros sensíveis no push.
- Criação de fixture financeira inconsistente para testar o contexto PRO.
- Expansão de eventos push além dos cenários já suportados.

## 6. Regras de Negócio

1. O ambiente usado deve ser identificado inequivocamente como DEV antes de qualquer ação remota.
2. A reserva confirmada só deve ser usada como evento de teste quando a confirmação estiver registrada pela fonte de verdade do MAZZI.
3. O push deve preservar o usuário, o contexto e o destino da notificação original.
4. O toque em uma notificação de reserva deve abrir `Aulas` e a reserva específica correspondente, sem cair em uma Home genérica.
5. Se a sessão estiver ausente ou expirada, o destino original deve sobreviver ao login e ser retomado após a autenticação.
6. O recebimento em segundo plano não pode criar janelas duplicadas quando já houver uma janela aplicável.
7. O recebimento com o aplicativo fechado deve abrir o Student e hidratar o destino correto antes de apresentar a reserva.
8. Uma entidade inexistente, removida ou inacessível deve produzir fallback amigável, sem erro técnico bruto ou exposição indevida de dados.
9. O conteúdo do push deve ser mínimo e não pode conter CPF, CNPJ, endereço completo, secrets, tokens, private keys, dados financeiros desnecessários ou conteúdo privado excessivo.
10. O cenário PRO é opcional apenas quando não houver fixture DEV segura; essa ausência deve ser registrada explicitamente e não pode bloquear a validação do Student.
11. O status só pode ser considerado pronto quando os cenários obrigatórios, os gates de qualidade, o deploy DEV e a validação pós-deploy estiverem aprovados.

## 7. Fluxo Principal (Happy Path)

1. Abrir o Student pelo endereço HTTPS DEV publicado ou pelo túnel HTTPS de validação.
2. Entrar com uma conta Student DEV controlada.
3. Ativar notificações por ação explícita do usuário e confirmar o registro do dispositivo no contexto `STUDENT`.
4. Criar ou disparar, pela jornada real do MAZZI, uma confirmação DEV de reserva para esse aluno.
5. Confirmar o recebimento com o Student visível.
6. Repetir o evento com a aplicação em segundo plano e verificar a notificação do sistema.
7. Repetir o evento com a aplicação fechada, tocar na notificação e verificar a abertura da reserva específica.
8. Repetir com a sessão ausente ou expirada, tocar na notificação, autenticar e confirmar a retomada da mesma reserva.
9. Abrir a mesma notificação pelo Centro de Notificações e confirmar o mesmo destino.
10. Repetir, quando seguro e disponível, um evento do contexto PRO e validar seu destino correspondente.

## 8. Casos de Borda e Exceções

- Permissão de notificação negada, configuração pública ausente ou navegador sem suporte: informar estado amigável e não bloquear o aplicativo.
- Token ou registro duplicado: manter um único registro lógico ativo para o mesmo dispositivo e contexto.
- Push recebido após logout: não abrir dados de outro usuário; exigir autenticação e respeitar o destino autorizado.
- Reserva removida, inexistente ou inacessível: mostrar fallback amigável em `Aulas`.
- Toques repetidos: não abrir múltiplas janelas ou destinos concorrentes.
- Dispositivo com mais de um contexto permitido: manter o isolamento entre Student e PRO.
- Falha temporária de entrega: registrar a falha e verificar o comportamento de reprocessamento previsto, sem declarar sucesso apenas pelo aceite do provedor.
- Ausência de fixture PRO segura: marcar `PRO_PUSH: NOT_TESTED` com o motivo real.

## 9. Estados de Erro e Mensagens Amigáveis

- Ativação indisponível: “As notificações não estão disponíveis neste navegador.”
- Permissão negada: “As notificações estão bloqueadas no navegador. Ative-as nas configurações do dispositivo para receber avisos.”
- Falha no registro: “Não foi possível ativar as notificações agora. Tente novamente.”
- Destino indisponível: “Esta aula não está mais disponível.”
- Sessão necessária: apresentar o login e, após sucesso, retomar a reserva original.
- Falha de entrega: não exibir segredo, token, resposta bruta do provedor ou detalhes internos; registrar a evidência apenas no relatório operacional.

## 10. Critérios de Aceite

- **AC01**: O dispositivo Student DEV é registrado após ação explícita do usuário, com conta e contexto corretos, sem duplicação indevida e sem erro de VAPID ou Service Worker.
- **AC02**: Um evento real `BOOKING_CONFIRMED` gera a notificação MAZZI correspondente e chega ao Student visível.
- **AC03**: O cenário foreground termina com `FOREGROUND: PASS`, sem duplicidade e com o comportamento visual esperado.
- **AC04**: O cenário em segundo plano termina com `BACKGROUND: PASS`; o usuário vê o push e o toque leva a `Aulas` e à reserva correta.
- **AC05**: O cenário com o aplicativo fechado termina com `COLD_START: PASS`; o Student abre, carrega a sessão ou solicita login e exibe a reserva correta, sem cair na Home genérica.
- **AC06**: O cenário com sessão ausente ou expirada termina com `POST_LOGIN: PASS`; depois do login, o destino original é retomado e a reserva específica é aberta.
- **AC07**: A mesma notificação aberta pelo Centro de Notificações usa o mesmo destino do push e termina com `NOTIFICATION_CENTER: PASS`.
- **AC08**: O fallback de entidade inexistente, removida ou inacessível termina com `FALLBACK: PASS`, sem quebra da aplicação, erro técnico bruto ou vazamento de dados.
- **AC09**: A inspeção do push termina com `PUSH_PRIVACY: PASS`; nenhum dado sensível ou conteúdo privado excessivo é enviado ou exibido.
- **AC10**: O cenário PRO termina com `PRO_PUSH: PASS` quando houver fixture DEV segura; caso contrário, termina com `PRO_PUSH: NOT_TESTED` acompanhado do motivo real e sem criação de dado inconsistente.
- **AC11**: Student DEV e PRO DEV são publicados somente depois da aprovação dos testes locais e HTTPS, e os cenários background, cold start e pós-login são repetidos no ambiente publicado.
- **AC12**: `npm run lint`, `npm test`, `npm run build:all`, `git diff --check` e as validações de baseline DEV exigidas pelo workflow passam após qualquer correção.
- **AC13**: O CI da branch `feature/premium-ui-v2` fica verde após o commit e push autorizado, sem merge para produção.
- **AC14**: A conclusão registra o encadeamento completo `Evento MAZZI → Supabase → dispatcher → FCM → dispositivo → toque → app correto → destino correto`.
- **AC15**: A entrega final declara literalmente `PRODUCTION_UNTOUCHED` e não executa qualquer ação em Production.

## 11. Dependências

- Requisitos e plano técnico existentes da TASK-087.
- Implementação FCM DEV, registro de dispositivos, navegação de notificações e dispatcher já entregues.
- Projeto Firebase DEV e Supabase DEV identificados e acessíveis.
- Chave VAPID pública presente no build DEV, sem exposição de credenciais privadas.
- Conta Student DEV, dispositivo/navegador controlado e permissão de notificações disponível.
- Endereços HTTPS do túnel e do frontend DEV publicado.
- Fixture DEV segura para o evento Student e, opcionalmente, para o contexto PRO.
- Relatórios anteriores de implementação, QA e revisão final.

## 12. Decisões Pendentes

- [DECISÃO DE PRODUTO NECESSÁRIA] Nenhuma para o fluxo Student obrigatório.
- A disponibilidade de uma fixture PRO segura será confirmada durante a execução; na ausência, o cenário deverá ser marcado como não testado com justificativa.
- O navegador e o dispositivo controlados para a execução física devem ser identificados no relatório, sem registrar tokens ou dados pessoais desnecessários.

## 13. Riscos de Produto

- Um push aceito pelo provedor não comprova que o usuário recebeu a notificação nem que o destino correto foi aberto.
- Diferenças de navegador, sistema operacional, permissão e estado do PWA podem alterar o comportamento de background e cold start.
- Um ambiente publicado com configuração pública incorreta pode parecer funcional no localhost e falhar no DEV publicado.
- A perda do destino durante o login pode levar o usuário à Home e exigir nova navegação manual.
- Repetições de teste com contas ou reservas não controladas podem expor notificações para o usuário errado.

## 14. Handoff para Tech Lead

1. Manter o escopo restrito à comprovação e à correção de falhas reais do E2E FCM DEV.
2. Exigir evidência separada para registro do dispositivo, foreground, background, cold start, pós-login, Centro de Notificações, fallback, privacidade e PRO.
3. Não aceitar como prova apenas o retorno positivo do FCM, a existência do token ou os testes automatizados.
4. Bloquear a publicação caso os testes locais/túnel obrigatórios falhem.
5. Após a publicação DEV, repetir os cenários obrigatórios no endereço publicado antes do encerramento.
6. Autorizar commit e push somente quando todos os critérios obrigatórios e gates estiverem aprovados.
7. Confirmar em toda revisão que Production permaneceu intocada e registrar `PRODUCTION_UNTOUCHED`.
