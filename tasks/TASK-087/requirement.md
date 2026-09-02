# TASK-087 — Integração FCM DEV e validação E2E de notificações push

TASK: TASK-087
STATUS: PRODUCT_READY
OWNER: MAZZI Product
LAST_UPDATED: 2026-09-02

## 1. Objetivo

Disponibilizar notificações push reais do MAZZI no ambiente DEV usando Firebase Cloud Messaging (FCM) para Web Push, mantendo o histórico, a autorização e o destino das notificações sob controle do MAZZI/Supabase e comprovando a jornada completa até a abertura da entidade correta no aplicativo.

## 2. Problema

A implementação local da TASK-086 possui persistência de notificações, registro de dispositivos, navegação contextual e suporte a Service Worker, mas ainda não foi integrada a um provedor real de push. É necessário validar que um evento real do MAZZI chega ao navegador/dispositivo correto, funciona com o aplicativo aberto e fechado e preserva o destino após autenticação.

## 3. Usuário Afetado

- `STUDENT`: recebe notificações de reservas e mensagens relacionadas às suas aulas.
- `INSTRUCTOR`: recebe notificações de reservas, mensagens e eventos financeiros relacionados à sua operação.
- `SCHOOL_ADMIN`: permanece elegível apenas para eventos explicitamente suportados pelo produto; não é necessário criar novos eventos administrativos nesta entrega.
- `PLATFORM_ADMIN`: usa os dados de notificação para operação e diagnóstico, sem receber push de produção nesta tarefa.

## 4. Escopo

- Integrar o aplicativo MAZZI DEV ao projeto Firebase DEV correspondente ao MAZZI.
- Usar FCM como transporte de Web Push para o Service Worker único já existente.
- Configurar somente os dados públicos necessários no cliente e manter credenciais privadas exclusivamente no lado servidor.
- Habilitar o registro de mais de um dispositivo por usuário, com associação ao usuário e ao contexto do aplicativo (`STUDENT` ou `PRO`).
- Manter no MAZZI a persistência da notificação, o histórico, a autorização, a deduplicação e a resolução do destino.
- Validar o evento obrigatório `BOOKING_CONFIRMED` para um usuário DEV controlado, desde o evento até a abertura da reserva correta.
- Validar o recebimento com o app em primeiro plano/background (warm start) e com o PWA fechado (cold start).
- Validar a preservação do destino quando a sessão estiver ausente ou expirada e o usuário precisar fazer login.
- Validar o destino `PAYOUT_PAID` para o contexto PRO quando houver fixture DEV segura; caso não exista, registrar a limitação sem criar dado financeiro inconsistente.
- Validar, se a infraestrutura principal estiver estável, `NEW_MESSAGE` associado a uma reserva, sem expor o conteúdo privado completo no lock screen.
- Disponibilizar a integração somente no ambiente DEV após os gates de qualidade e as validações E2E exigidas.

## 5. Fora de Escopo

- Qualquer alteração, configuração, deploy, envio de push ou alteração de dados em Production.
- Criação de Firebase Auth, Firestore, Realtime Database, Firebase Hosting ou Firebase Functions sem necessidade indispensável comprovada e decisão aprovada.
- Substituição ou duplicação do Service Worker existente.
- Criação de novos eventos de negócio não necessários para validar os fluxos desta tarefa.
- Alteração da arquitetura aprovada da TASK-086 sem evidência técnica de necessidade.
- Envio de push para usuários reais, dispositivos não controlados ou dados com PII real durante a validação.
- Conteúdo integral de mensagens privadas, documentos, evidências de contestação ou dados financeiros sensíveis no push.
- Prompts automáticos de permissão na inicialização do aplicativo.
- Migração do backend, autenticação ou fonte de verdade do Supabase para Firebase.

## 6. Regras de Negócio

1. `PRODUCTION_UNTOUCHED`: Production deve permanecer intocada durante toda a tarefa. Em caso de dúvida sobre o ambiente, nenhuma ação remota deve ser executada até a identificação inequívoca de DEV.
2. O projeto Firebase e todos os recursos usados nesta entrega devem ser identificados inequivocamente como DEV. Não criar projetos Firebase duplicados ou desnecessários.
3. Firebase é exclusivamente o transporte de push. O Supabase continua sendo a fonte de verdade para persistência, autorização, histórico e resolução de destino das notificações.
4. Uma notificação só pode ser entregue ao usuário e ao contexto (`STUDENT` ou `PRO`) autorizados pelo registro persistido no MAZZI.
5. Um usuário pode possuir vários dispositivos; o sistema não pode impor um único token por usuário.
6. Token duplicado, rotacionado, expirado ou inválido deve ser tratado sem duplicar notificações e sem apagar o histórico da notificação original.
7. Um mesmo evento de negócio não pode gerar pushes duplicados, inclusive após retry ou reprocessamento.
8. Retries devem ser limitados e aplicados somente a falhas transitórias; não pode existir retry infinito ou tempestade de notificações.
9. Falha ou recusa da permissão de notificações, ausência de suporte do navegador ou token indisponível não pode impedir o uso normal do MAZZI.
10. Ao tocar em uma notificação, o usuário deve ser direcionado ao contexto e à entidade originalmente registrados. Se a entidade estiver indisponível ou sem autorização, o app deve abrir a área segura correspondente e exibir feedback amigável.
11. O comportamento de warm start deve reutilizar a janela existente quando possível e não abrir janelas duplicadas desnecessariamente.
12. O comportamento de cold start deve carregar o aplicativo, hidratar o destino pendente e abrir a entidade correta depois que o app estiver pronto.
13. Se a sessão estiver expirada, o destino original deve sobreviver ao login; cair na Home sem tentar retomar o destino não atende ao requisito.
14. Títulos e corpos de push devem seguir minimização de dados: não incluir CPF, CNPJ, endereço residencial completo, chave bancária, documentos, evidências de contestação, conteúdo financeiro sensível desnecessário ou o texto completo de mensagem privada.
15. Secrets, chaves privadas, bearer tokens e credenciais de servidor não podem aparecer no frontend, bundle, Git, documentação ou logs. Tokens de dispositivo devem ser reduzidos/mascarados nos logs quando possível.
16. Logs de diagnóstico podem conter apenas identificadores não sensíveis da notificação/entrega, contexto, tipo, status do FCM e erro sanitizado.
17. O primeiro fluxo E2E obrigatório é `BOOKING_CONFIRMED` no contexto `STUDENT`; a conexão do Firebase, a geração do token ou uma resposta HTTP bem-sucedida isolada não caracterizam conclusão.
18. O cold start real com o PWA fechado é critério obrigatório de aceite.
19. Qualquer infraestrutura remota autorizada para a entrega deve ser exclusivamente DEV; não é permitido aplicar migrations, cadastrar secrets, fazer deploy ou enviar push em Production.

## 7. Fluxo Principal (Happy Path)

1. Um usuário DEV controlado acessa o MAZZI e autentica-se.
2. O usuário escolhe a UX existente para habilitar notificações; o navegador concede a permissão.
3. O Service Worker único do MAZZI está registrado e o FCM obtém um token para o dispositivo.
4. O token é associado no MAZZI ao usuário correto e ao contexto correto, sem ficar visível para outros usuários.
5. Uma reserva DEV é confirmada por um evento válido `BOOKING_CONFIRMED`.
6. A notificação é persistida no MAZZI e encaminhada ao dispositivo elegível por FCM sem duplicidade.
7. O usuário recebe o push no navegador/dispositivo e toca na notificação.
8. O aplicativo Student é aberto ou retomado, navega para `Aulas` e exibe a reserva específica do evento.
9. O mesmo destino pode ser aberto pelo sino/central de notificações, usando a mesma notificação persistida.
10. O mesmo fluxo é repetido com o PWA fechado para comprovar cold start e, quando aplicável, com sessão expirada para comprovar a retomada pós-login.

## 8. Casos de Borda e Exceções

- Permissão em estado `default`: o aplicativo mantém a UX existente e não força o prompt na inicialização.
- Permissão `denied`: o aplicativo continua utilizável e informa de forma amigável que os push estão desativados.
- Navegador sem suporte: o aplicativo continua utilizável e não registra um dispositivo inválido.
- Token rotacionado ou duplicado: o registro deve ser atualizado/normalizado sem criar múltiplas entregas para o mesmo evento e dispositivo.
- Token inválido ou expirado informado pelo FCM: a entrega é marcada como falha apropriada, o dispositivo é desativado/atualizado conforme o contrato vigente e não há repetição indefinida.
- Falha transitória do provedor: aplica-se retry limitado e a notificação histórica permanece preservada.
- Reserva inexistente, inacessível ou sem autorização: o app não quebra, não vaza dados, abre `Aulas` e mostra uma mensagem amigável.
- Usuário com múltiplos dispositivos: cada dispositivo elegível pode receber a notificação uma vez, sem duplicidade por retry.
- Identidade com múltiplos papéis: uma notificação com `app_context=PRO` abre o PRO e não deve ser interpretada pelo Student.
- Ausência de fixture DEV segura para `PAYOUT_PAID` ou multi-role: não criar dados inconsistentes; executar a cobertura automatizada possível e registrar a limitação real.
- Evento repetido, webhook/retry ou reprocessamento: o evento mantém idempotência e não dispara push duplicado.

## 9. Estados de Erro e Mensagens Amigáveis

- `LOADING`: “Preparando notificações…” enquanto o registro do dispositivo é inicializado.
- `SUCCESS`: “Notificações ativadas neste dispositivo.” após registro confirmado.
- `DISABLED`: “As notificações estão desativadas. Você pode continuar usando o MAZZI normalmente.”
- `UNSUPPORTED`: “Este navegador não oferece suporte a notificações push.”
- `ERROR`: “Não foi possível ativar as notificações agora. Tente novamente mais tarde.”
- Destino indisponível: “Esta reserva não está disponível. Abrimos suas aulas para você continuar.”
- Sessão expirada: conduzir ao login sem descartar o destino pendente; após autenticação, retomar a entidade autorizada.
- Falha de entrega: registrar o erro sanitizado para diagnóstico, sem exibir credenciais, tokens ou detalhes técnicos ao usuário.

## 10. Critérios de Aceite

- **AC01**: O projeto e os recursos usados para a integração são identificados como Firebase DEV do MAZZI, e não existe qualquer alteração em Production; a evidência deve declarar `PRODUCTION_UNTOUCHED`.
- **AC02**: O aplicativo DEV usa o FCM para Web Push por meio do Service Worker único já existente, sem criar um segundo Service Worker ou uma fonte concorrente de notificações.
- **AC03**: Com usuário DEV autenticado e permissão concedida, um dispositivo registra seu token no MAZZI associado ao usuário e ao `app_context` correto; outro usuário não consegue consultar esse registro.
- **AC04**: O registro suporta pelo menos dois dispositivos do mesmo usuário sem sobrescrever indevidamente um dispositivo válido, e logout/desativação impede novas entregas ao dispositivo desativado conforme o contrato vigente.
- **AC05**: O evento `BOOKING_CONFIRMED` gera uma notificação persistida e no máximo uma entrega por dispositivo elegível, preservando `notification_id`, usuário, `app_context=STUDENT`, `entity_type=BOOKING`, `entity_id` e ação corretos.
- **AC06**: O E2E real de `BOOKING_CONFIRMED` é comprovado no navegador/dispositivo DEV: evento MAZZI → notificação persistida → dispatcher → FCM → push recebido → toque → Student → `Aulas` → reserva correta.
- **AC07**: O E2E de warm start recebe o push com o app aberto ou em background, foca/reutiliza a janela existente e navega para a reserva correta sem abrir múltiplas janelas desnecessárias.
- **AC08**: O E2E de cold start recebe o push com o PWA fechado, abre o app, hidrata o destino e exibe a reserva correta; um token gerado ou um HTTP 200 isolado não substitui essa prova real.
- **AC09**: Com sessão ausente ou expirada, o toque no push leva ao login e, depois da autenticação, retoma o destino original autorizado; não é aceitável cair apenas na Home.
- **AC10**: O sino/NotificationsPanel usa a mesma notificação persistida e o mesmo resolvedor de destino do push, abrindo a mesma entidade correta.
- **AC11**: Uma notificação com `app_context=PRO` abre o contexto PRO correto; se não houver fixture DEV segura para validar manualmente multi-role, a limitação e a cobertura automatizada ficam documentadas.
- **AC12**: Havendo payout DEV seguro, `PAYOUT_PAID` abre `Ganhos` no PRO e o payout relevante; sem fixture segura, nenhum payout inconsistente é criado e a pendência é registrada.
- **AC13**: Havendo infraestrutura estável, `NEW_MESSAGE` abre a reserva e o chat corretos sem expor o conteúdo completo da mensagem no lock screen; se não for validado, a limitação é registrada.
- **AC14**: Permissões `default`, `granted`, `denied` e navegador sem suporte são tratados sem bloquear o uso do MAZZI e sem prompt automático na inicialização.
- **AC15**: Token inválido/expirado, erro transitório e evento repetido são tratados com falha registrada, retry limitado, atualização/desativação do dispositivo quando aplicável e sem duplicar push ou perder o histórico.
- **AC16**: O fallback para reserva inexistente/inacessível não quebra o app, não vaza dados, abre `Aulas` e apresenta mensagem amigável.
- **AC17**: Payloads, logs e documentação não contêm private key, bearer token, secret, token FCM completo desnecessário ou dados sensíveis proibidos.
- **AC18**: Os testes automatizados e gates locais previstos para a integração passam sem redução de cobertura: casos de configuração ausente, suporte/permissão, registro/rotação/duplicidade, token inválido, destino, warm start, cold start, pós-login, fallback, multi-role e destinos financeiros/chat quando aplicáveis.
- **AC19**: Antes de qualquer disponibilização DEV, `npm run lint`, `npm test`, `npm run build:all`, `git diff --check` e as validações de banco previstas no projeto estão verdes, com números reais registrados no relatório final.
- **AC20**: A entrega só pode ser declarada pronta quando houver prova real do fluxo completo e do cold start; conexão Firebase, token gerado, dispatcher respondendo ou Edge Function retornando 200 isoladamente não são suficientes.

## 11. Dependências

- Implementação e contratos da TASK-086, incluindo notificações, dispositivos, Service Worker, deep links, autenticação e navegação Student/PRO.
- Projeto Firebase DEV correspondente ao MAZZI e configuração compatível com FCM Web Push.
- Supabase DEV autorizado para persistência, dispatcher, políticas de acesso e secrets server-side.
- Conta e dispositivos DEV controlados para os testes reais.
- Capacidade de executar os quality gates locais e acessar os ambientes DEV após a implementação.
- Identificação do próximo contrato de configuração pública e do armazenamento seguro de credenciais privadas pelo Tech Lead.

## 12. Decisões Pendentes

- `[DECISÃO DE PRODUTO NECESSÁRIA]` Confirmar no preflight o project ID, project number, Web App e identificador da chave pública VAPID do Firebase DEV que serão usados; não presumir projeto ou criar recurso antes dessa confirmação.
- `[DECISÃO DE PRODUTO NECESSÁRIA]` Confirmar, no plano técnico, os nomes finais das variáveis de configuração DEV sem alterar o contrato já existente da TASK-086 quando ele estiver correto.
- `[DECISÃO DE PRODUTO NECESSÁRIA]` Se o ambiente DEV não possuir fixture segura de multi-role, `PAYOUT_PAID` ou `NEW_MESSAGE`, registrar a limitação no relatório em vez de fabricar dados inconsistentes.

## 13. Riscos de Produto

- Configuração equivocada de ambiente pode enviar notificações para usuários reais ou alterar Production; risco bloqueante mitigado pela identificação explícita de DEV e pelo gate `PRODUCTION_UNTOUCHED`.
- Dois Service Workers podem duplicar entregas ou quebrar a navegação; mitigado pela exigência de um único Service Worker.
- Associação incorreta de token pode causar vazamento entre usuários ou papéis; mitigado por RLS/RBAC, contexto explícito e teste de isolamento.
- Falhas de cold start ou pós-login podem fazer o usuário perder o contexto da ação; mitigado pelos critérios E2E obrigatórios.
- Retry sem idempotência pode gerar spam e perda de confiança; mitigado por chave de evento, deduplicação e retry limitado.
- Payload excessivo pode expor dados privados na tela bloqueada; mitigado por minimização e revisão de privacidade.
- Ausência de fixture segura pode limitar a comprovação de eventos PRO; não deve ser compensada com alterações financeiras artificiais.

## 14. Handoff para Tech Lead

- Preservar a arquitetura e a implementação aprovada da TASK-086; propor somente as alterações mínimas necessárias para conectar FCM no DEV.
- Executar primeiro um preflight somente leitura local, Firebase DEV, Supabase DEV e CI, documentando branch, HEAD, status, migrations, funções, secrets por nome e ausência de infraestrutura concorrente.
- Confirmar inequivocamente o ambiente DEV antes de qualquer mutation; Production deve permanecer intocada.
- Planejar o uso de FCM HTTP v1/server-side quando compatível com a TASK-086, mantendo qualquer credencial privada fora do frontend, do Git, da documentação e dos logs.
- Garantir que o FCM use o Service Worker MAZZI já existente e que push e sino compartilhem o mesmo resolvedor de destino.
- Transformar cada AC em teste observável, dando prioridade ao E2E real `BOOKING_CONFIRMED` e ao cold start com PWA fechado.
- Não considerar a tarefa pronta por conectividade Firebase, geração de token ou resposta 200 isolada; a conclusão depende do fluxo ponta a ponta e dos quality gates registrados.
- Após a implementação, enviar ao QA o plano, as evidências de ambiente e os relatórios de testes; qualquer pendência real deve permanecer explícita.
