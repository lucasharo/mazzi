# TASK-086 — Ganhos e desempenho do PRO com navegação profunda de notificações

TASK: TASK-086
STATUS: PRODUCT_READY
OWNER: MAZZI Product
LAST_UPDATED: 2026-09-02

---

## 1. Objetivo

Entregar ao MAZZI PRO uma visão confiável e mobile-first de ganhos e desempenho, com período selecionável, repasses, avaliações e evolução recente.

Em paralelo, transformar as notificações em entradas acionáveis capazes de levar o usuário ao aplicativo, à tela, à entidade e à ação corretas, inclusive quando o aplicativo estiver fechado ou a sessão precisar ser renovada.

## 2. Problema

O profissional não consegue responder rapidamente quanto ganhou, quanto já recebeu, quanto ainda receberá, quando receberá ou por que um valor está bloqueado. A tela também não oferece uma leitura confiável do desempenho baseada em avaliações reais.

As notificações atuais funcionam principalmente como histórico. Ao acioná-las, o usuário pode cair apenas em uma tela genérica, perder o contexto da reserva/repasse ou voltar para a Home após login, especialmente em cold start.

## 3. Usuário Afetado

- `INSTRUCTOR`: consulta seus ganhos, repasses e avaliações e recebe destinos no MAZZI PRO.
- `SCHOOL_ADMIN`: consulta dados consolidados do provider autorizado e recebe destinos permitidos no contexto PRO/CFC.
- `STUDENT`: recebe notificações de reservas, mensagens, cancelamentos, lembretes, contestações e avaliações quando aplicáveis ao seu contexto.
- `PLATFORM_ADMIN`: mantém acesso às notificações administrativas já existentes; não recebe acesso adicional a dados financeiros de outros contextos por meio de uma notificação.

## 4. Escopo

### 4.1 Ganhos e desempenho no PRO

- Disponibilizar a tela **Ganhos e desempenho** para instrutor autônomo e autoescola/CFC.
- Oferecer os períodos de `7 dias`, `14 dias` e `30 dias`, com `30 dias` como seleção inicial.
- Exibir, de forma semanticamente distinta:
  - ganhos líquidos das aulas concluídas no período;
  - valor efetivamente recebido;
  - valor a receber (`PENDING`, `AVAILABLE` e `PROCESSING`);
  - valor bloqueado, exclusivamente em `BLOCKED`, com motivo amigável quando houver motivo canônico.
- Exibir **Próximos repasses**, usando a data de liberação prevista, agrupando de forma compreensível por hoje, amanhã ou data/dia da semana e mostrando o total previsto para os próximos 7 dias.
- Diferenciar visualmente repasses agendados, disponíveis, em transferência e bloqueados. Repasse bloqueado não pode parecer um recebimento futuro normal.
- Exibir gráfico simples de ganhos por dia, adequado ao mobile.
- Exibir na Home do PRO um resumo compacto com ganhos recentes, valor a receber, valor bloqueado e acesso para ver detalhes.
- Exibir avaliações reais e progresso de avaliadores únicos até o limite de 30 alunos.
- Após 30 alunos únicos, exibir médias por dimensão, pontos fortes e principal ponto de atenção com texto determinístico baseado exclusivamente nos dados reais.
- Suportar visão consolidada de autoescola/CFC. O contrato deve preservar a possibilidade de análise por instrutor.
- Remover qualquer nota artificial ou fallback de avaliação que mostre `5,0` sem avaliações reais.

### 4.2 Destino canônico das notificações

- Definir um contrato de destino tipado e allowlisted, contendo no mínimo contexto do aplicativo, tipo de entidade, identificador da entidade e ação.
- O contrato deve representar, conforme aplicável, detalhes de uma reserva, chat da reserva, detalhe de repasse, seção de avaliações/desempenho e pendência de compliance.
- O destino deve ser resolvido pelo mecanismo de navegação existente, sem criar um segundo router.
- O mesmo resolvedor deve ser usado pelo sino de notificações e pelo push.
- A notificação acionável deve ser marcada como lida segundo a regra existente, fechar o painel e abrir o destino correto.
- Suportar navegação de segundo nível que sobreviva a refresh, PWA, cold start e hospedagem estática.
- Suportar múltiplos contextos para a mesma identidade: `app_context` é obrigatório e o destino deve abrir no app correto.

### 4.3 Destinos e eventos

| Evento | Contexto | Destino | Ação |
|---|---|---|---|
| `BOOKING_CONFIRMED` | Aluno ou PRO | Aulas / reserva | Detalhes |
| `BOOKING_CANCELLED` | Aluno ou PRO | Aulas / reserva | Detalhes |
| `NEW_MESSAGE` | Aluno ou PRO | Aulas / reserva | Chat |
| Check-in | Aluno ou PRO | Aulas / reserva | Detalhes |
| Aula concluída | Aluno | Aulas / reserva | Avaliação, se elegível |
| Contestação | Contexto correspondente | Reserva/contestação | Detalhes |
| Compliance | PRO | Gestão / compliance | Documento ou pendência |
| `PAYOUT_PAID` | PRO | Ganhos / repasse | Detalhes |
| `PAYOUT_BLOCKED` | PRO | Ganhos / repasse | Detalhes |
| `PAYOUT_FAILED` | PRO | Ganhos / repasse | Detalhes |
| `REVIEW_RECEIVED` | PRO | Ganhos / desempenho | Avaliações |

`BOOKING_CONFIRMED` é o primeiro evento obrigatório para validação ponta a ponta da entrega de push. Os demais eventos existentes devem ser conectados quando a infraestrutura estiver pronta e sem duplicar notificações históricas.

### 4.4 Push e ciclo de dispositivo

- O push é uma entrega adicional do evento e não substitui a notificação in-app, que continua sendo o histórico do produto.
- O usuário deve poder ativar notificações em um momento contextual, por ação explícita **Ativar notificações**, sem bloquear o uso do MAZZI em caso de recusa.
- A experiência deve tratar permissão concedida, negada, não decidida, navegador sem suporte e restrições relevantes de PWA/iOS.
- Deve ser possível associar mais de um dispositivo à mesma identidade e a contextos diferentes, com tokens rotacionáveis e desativação de token inválido.
- Logout, troca/renovação de token e desativação devem impedir novas entregas ao dispositivo quando aplicável.
- O payload de push deve conter somente o mínimo necessário para identificar o evento e o destino, sem mensagem privada completa ou dados sensíveis.
- O service worker existente deve permanecer único e conservar sua política de não cachear Supabase, autenticação, REST/RPC, Storage privado ou APIs privadas.

## 5. Fora de Escopo

- Criar um segundo router ou substituir as rotas hash existentes por uma infraestrutura paralela.
- Construir BI complexo, dashboards empresariais, gamificação, pontuação ou recomendações por IA.
- Usar LLM/IA para redigir insights de avaliações.
- Liberar `SELECT` direto de payouts para o navegador ou expor dados financeiros por identificador arbitrário.
- Alterar o cálculo financeiro, o split, a política de cancelamento ou a confirmação de pagamento como parte desta task.
- Trocar o checkout operacional Stripe definido pela `DEC-016`, reativar Mercado Pago ou transformar o checkout fake em pagamento real.
- Enviar push para usuários de produção, configurar secrets de produção ou alterar o Supabase de produção.
- Colocar secrets, service accounts ou tokens privados no browser ou no repositório.
- Criar integrações governamentais oficiais, aulas teóricas, categorias congeladas do MVP, pacotes de aulas ou veículo do aluno.
- Exibir CPF, CNPJ, documentos, endereço privado, evidências de contestação ou detalhes financeiros excessivos no push.

## 6. Regras de Negócio

- **RN01 — Fonte financeira**: o ganho líquido exibido ao profissional deve corresponder ao valor financeiro canônico persistido para o payout. `payments.amount_in_cents` não é sinônimo de ganho do profissional.
- **RN02 — Unidade monetária**: todo valor financeiro deve permanecer em centavos inteiros; a apresentação pode formatar o valor em reais, mas não pode introduzir divergência por arredondamento.
- **RN03 — Recebido**: somente payouts efetivamente `PAID` compõem o valor recebido, usando a data real de liberação/processamento adequada ao indicador.
- **RN04 — A receber**: `PENDING`, `AVAILABLE` e `PROCESSING` compõem o valor a receber conforme a semântica financeira canônica. A retenção normal não deve ser rotulada como bloqueio.
- **RN05 — Bloqueado**: somente `BLOCKED` compõe o valor bloqueado. O motivo só deve ser exibido quando existir uma causa canônica; não inventar justificativas.
- **RN06 — Período**: a seleção deve limitar todos os indicadores e a série diária ao mesmo período de 7, 14 ou 30 dias e usar `America/Sao_Paulo` para cortes, rótulos e agregações.
- **RN07 — Próximos repasses**: a previsão deve usar a data de liberação prevista e não deve incluir payout bloqueado como previsão normal.
- **RN08 — Avaliadores únicos**: o desbloqueio do resumo ocorre com 30 alunos distintos que avaliaram, não com 30 registros. Avaliações repetidas do mesmo aluno contam uma única vez.
- **RN09 — Avaliações reais**: sem avaliações reais, mostrar estado vazio/sem avaliações; nunca substituir ausência por média `5,0`.
- **RN10 — Insights**: antes de 30 avaliadores únicos, mostrar o progresso até 30. A partir do limite, dimensões, pontos fortes e ponto de atenção devem ser calculados de modo determinístico, sem extrapolar dados ou usar IA.
- **RN11 — Acesso financeiro**: cada perfil só pode consultar os ganhos do provider para o qual possui vínculo e permissão. Um `provider_id`, `payout_id`, `booking_id` ou destino recebido externamente não concede autorização.
- **RN12 — Destino allowlisted**: notificações e pushes devem transportar dados tipados e permitidos; URL arbitrária, ação desconhecida, entidade inválida ou contexto incompatível devem ser rejeitados.
- **RN13 — Autorização**: deep link apenas indica o destino. A autorização efetiva da reserva, repasse, documento ou chat deve continuar sendo determinada por autenticação, RBAC e RLS do produto.
- **RN14 — Fallback seguro**: se a entidade não existir, estiver inacessível ou expirada, abrir a área geral adequada e mostrar feedback amigável sem revelar dados. Ex.: “Esta aula não está mais disponível.”; payout indisponível deve levar a **Ganhos**.
- **RN15 — Multi-role**: o `app_context` recebido deve ser respeitado. Um destino PRO não pode ser interpretado como destino do Aluno, mesmo quando a identidade for a mesma.
- **RN16 — Pós-login**: destino recebido no push, sino ou rota deve ser preservado durante autenticação e consumido somente após o login que autorizar o recurso. Sessão expirada não pode descartar o destino e levar o usuário diretamente à Home.
- **RN17 — Fonte de histórico**: a notificação in-app é a única fonte de histórico; push não pode gerar uma segunda notificação de negócio nem duplicar rows existentes.
- **RN18 — Privacidade do push**: textos visíveis em tela bloqueada devem ser mínimos e não conter PII, conteúdo integral de mensagens privadas, documentos, evidências ou dados financeiros detalhados.
- **RN19 — Permissão opcional**: recusar notificações não impede navegação, agendamento, consulta de ganhos ou uso de qualquer função disponível sem push.
- **RN20 — Gateway**: pagamentos desta task continuam subordinados à decisão vigente de Stripe Checkout (`DEC-016`), com confirmação server-side; a tela de Ganhos não pode depender de cálculo ou confirmação feita pelo frontend.

## 7. Fluxo Principal (Happy Path)

### 7.1 Consulta de ganhos

1. O profissional abre **Ganhos** no MAZZI PRO.
2. O sistema carrega o período inicial de 30 dias.
3. O profissional pode trocar para 7 ou 14 dias.
4. O sistema apresenta ganhos líquidos, recebido, a receber e bloqueado com suas semânticas distintas.
5. O profissional consulta os próximos repasses, o gráfico diário e a situação das avaliações.
6. Se houver 30 alunos únicos avaliadores, o resumo determinístico de desempenho é exibido; caso contrário, é mostrado o progresso até o desbloqueio.
7. Ao abrir um destino de payout ou avaliações, o PRO seleciona Ganhos e destaca a entidade/seção correspondente.

### 7.2 Navegação a partir de notificação

1. Um evento de negócio gera ou atualiza a notificação in-app.
2. Quando houver dispositivo habilitado, o push adicional contém o evento, contexto e destino allowlisted mínimos.
3. O usuário toca na notificação no app aberto, em uma PWA fechada ou após o dispositivo abrir o app correto.
4. O MAZZI marca a notificação como lida, fecha o painel quando aplicável e resolve o destino pelo resolvedor canônico.
5. O app valida a sessão e o acesso à entidade antes de abrir a tela e a ação solicitadas.
6. Com sessão válida, abre a tela correta e, por exemplo, os detalhes da reserva, o chat da reserva, o payout ou a seção de avaliações.
7. Com sessão expirada, preserva o destino, conclui o login e então repete a resolução autorizada.
8. Se a entidade não estiver disponível, abre o fallback seguro com mensagem amigável.

## 8. Casos de Borda e Exceções

- Período sem payouts: mostrar **Nenhum ganho neste período**, zeros somente quando semanticamente corretos e nenhum valor financeiro fictício.
- Sem repasses futuros: mostrar **Nenhum repasse agendado**.
- Payout bloqueado: listar como bloqueado, com motivo apenas se disponível, sem agrupá-lo no total de previsão normal.
- Payout ou reserva removido, expirado ou sem autorização: não abrir detalhes nem revelar se o identificador pertence a outra pessoa; usar fallback amigável.
- Identificador malformado, evento desconhecido, ação inválida ou `app_context` incompatível: rejeitar o destino e abrir a área segura correspondente ou a Home do contexto autorizado.
- Usuário sem permissão financeira: não exibir relatório, payout ou valores de outro provider; apresentar erro amigável de acesso.
- 29 alunos únicos: resumo de percepção permanece bloqueado e o progresso é mostrado.
- 30 alunos únicos: resumo é desbloqueado; múltiplas avaliações de um mesmo aluno não avançam o contador além de uma pessoa.
- Dimensão sem dados ou empate: aplicar apresentação determinística e neutra, sem afirmar ponto forte ou ponto de atenção não sustentado.
- Push duplicado do mesmo evento: não duplicar histórico nem gerar duas ações de negócio.
- Token expirado/rotacionado ou dispositivo desabilitado: não tentar entrega persistente; manter o histórico in-app.
- Push recusado, navegador sem suporte ou PWA com restrição: manter o aplicativo funcional e permitir leitura pelo sino.
- App já aberto: resolver imediatamente sem abrir janela duplicada.
- PWA fechada: abrir/focar o entrypoint do contexto correto e entregar o destino uma única vez.
- Refresh ou cold start durante resolução: o destino deve ser recuperado sem criar loop de navegação ou abrir a Home prematuramente.
- Login cancelado ou falho: manter o destino pendente sem expor a entidade e permitir nova tentativa.
- Falha transitória ao carregar relatório ou entidade: preservar a tela, indicar erro recuperável e permitir tentar novamente.
- Falha do serviço de push: não bloquear a criação da notificação in-app.
- Datas e agregações próximas à meia-noite: manter `America/Sao_Paulo` como referência para evitar corte UTC incorreto.

## 9. Estados de Erro e Mensagens Amigáveis

- `LOADING`: skeleton/estado de carregamento para resumo, repasses, gráfico e avaliações; não mostrar números de seed ou placeholders como se fossem reais.
- `EMPTY` ganhos: **Nenhum ganho neste período**.
- `EMPTY` repasses: **Nenhum repasse agendado**.
- `EMPTY` avaliações: **Você ainda não recebeu avaliações suficientes**.
- `PARTIAL` avaliações: exibir a quantidade de alunos únicos avaliadores de 30 e informar que o resumo detalhado será liberado ao atingir o limite.
- `ERROR` relatório: **Não foi possível carregar seus ganhos agora. Tente novamente.**
- `ERROR` destino indisponível: **Este conteúdo não está mais disponível.** e abrir a área geral segura.
- `ERROR` sem permissão: **Você não tem acesso a estas informações.** sem revelar a existência da entidade.
- `ERROR` push não suportado/recusado: informar que os avisos podem continuar sendo consultados no MAZZI, sem bloquear o uso.
- `DISABLED` ativação de notificações: indicar que o navegador ou a permissão atual não permite ativação e preservar o sino in-app.
- Nenhuma mensagem de erro deve expor SQL, UUID, resposta bruta de gateway, token, stack trace ou dados de outro usuário.

## 10. Critérios de Aceite

- **AC01**: O PRO oferece exatamente os períodos de 7, 14 e 30 dias, inicia em 30 dias e recalcula todos os componentes do relatório ao trocar o período.
- **AC02**: O relatório apresenta ganhos líquidos, recebido, a receber e bloqueado com semântica distinta; `BLOCKED` não é contado como a receber ou como previsão normal.
- **AC03**: Os valores apresentados são compatíveis com o payout financeiro canônico e não são recalculados a partir de preço bruto, taxa MAZZI ou taxa de gateway no frontend.
- **AC04**: Recebido considera somente payout `PAID`, e a previsão usa `scheduled_release_at` com agrupamento compreensível e total previsto dos próximos 7 dias.
- **AC05**: O relatório e seus rótulos de data usam `America/Sao_Paulo`, sem deslocamento incorreto na virada do dia ou nos limites dos períodos.
- **AC06**: A série diária mostra ganhos por dia no período selecionado em visualização legível no mobile, sem exigir BI complexo ou scroll horizontal obrigatório.
- **AC07**: A Home do PRO mostra resumo compacto de ganhos recentes, a receber e bloqueado e oferece acesso à tela completa de Ganhos.
- **AC08**: Com zero avaliações reais, a interface não mostra `5,0`, não inventa dimensões e apresenta o estado sem avaliações.
- **AC09**: Com 29 alunos únicos, o resumo detalhado permanece bloqueado; com 30 alunos únicos, é desbloqueado; avaliações repetidas do mesmo aluno contam uma vez.
- **AC10**: Após o desbloqueio, as dimensões, ponto forte e ponto de atenção são determinados exclusivamente pelos dados reais, inclusive em empates ou dimensões sem dados.
- **AC11**: O fluxo de escola/CFC apresenta visão consolidada do provider autorizado e preserva o vínculo entre reviews, provider e instrutor para futura filtragem por instrutor.
- **AC12**: Existe um único contrato de destino com contexto, entidade e ação allowlisted, e sino e push usam o mesmo resolvedor.
- **AC13**: Os eventos previstos resolvem para os destinos da matriz; `NEW_MESSAGE` abre o chat da reserva e eventos de payout/review abrem a seção específica de Ganhos quando aplicável.
- **AC14**: Ao tocar uma notificação acionável, ela é marcada como lida segundo a regra existente, o painel fecha e a tela/entidade/ação correta é aberta sem duplicar navegação.
- **AC15**: O destino funciona com app aberto, PWA fechada, refresh e cold start, abrindo ou focando o entrypoint do `app_context` correto sem criar janela duplicada.
- **AC16**: Com sessão expirada, o destino permanece preservado durante o login e é resolvido após autenticação autorizada; o usuário não cai apenas na Home.
- **AC17**: Destino com UUID malformado, ação desconhecida, contexto incompatível, entidade inexistente ou recurso sem permissão não expõe dados e usa fallback seguro com mensagem amigável.
- **AC18**: Tentativas de manipular identificadores de reserva, payout, documento ou chat não permitem acesso cruzado entre alunos, instrutores, escolas ou administradores.
- **AC19**: `BOOKING_CONFIRMED` funciona como primeiro evento de push ponta a ponta; eventos adicionais não criam rows de notificação duplicadas e a notificação in-app continua sendo o histórico.
- **AC20**: O ciclo de dispositivo contempla múltiplos dispositivos, token duplicado/rotacionado, token inválido, logout e desativação sem expor tokens de terceiros.
- **AC21**: A solicitação de permissão de push ocorre por ação contextual, não bloqueia o produto quando recusada e trata estados concedido, negado, pendente e sem suporte.
- **AC22**: O service worker existente continua único, mantém o cache conservador e não cacheia autenticação, Supabase, APIs privadas, Storage privado ou RPC/REST privado.
- **AC23**: Pushes não incluem CPF, CNPJ, documentos, endereço privado, evidência de contestação, mensagem privada completa ou detalhamento financeiro excessivo.
- **AC24**: Estados `LOADING`, `EMPTY`, `ERROR`, `SUCCESS` e `DISABLED` são representados de maneira compreensível e nenhuma falha exibe erro técnico bruto.
- **AC25**: O checkout e a confirmação server-side definidos pela `DEC-016` permanecem inalterados e a tela de Ganhos não depende de sucesso declarado pelo frontend.

## 11. Dependências

- Arquitetura atual de `ProviderApp`, `StudentApp`, rotas hash, bottom navigation, painel de notificações, autenticação e fluxo pós-login.
- Dados reais de `payouts`, `payments`, `bookings` e `reviews`, respeitando as fontes canônicas já definidas.
- Permissões financeiras e relacionamentos de provider/instrutor/escola existentes.
- Service worker e manifestos PWA atuais.
- Mecanismo de notificações in-app existente.
- Configuração de entrega push aprovada para DEV, incluindo eventual configuração pública necessária no browser e credenciais privadas server-side.
- Avaliação do estado atual de FCM/Web Push e do registro de dispositivos antes de decidir a extensão necessária.
- Compatibilidade com Stripe Checkout e reconciliação financeira da `DEC-016`; nenhuma mudança de gateway é dependência funcional desta task.

## 12. Decisões Pendentes

- **[DECISÃO DE PRODUTO NECESSÁRIA]** Confirmar se a primeira entrega deve conectar apenas `BOOKING_CONFIRMED` ponta a ponta ou também todos os eventos adicionais listados quando já houver origem de evento disponível. O requisito mínimo desta etapa é `BOOKING_CONFIRMED`.
- **[DECISÃO DE PRODUTO NECESSÁRIA]** Definir a política de seleção de instrutor na visão consolidada de CFC: incluir o filtro visual nesta task ou entregar apenas a visão consolidada com contrato preparado para a próxima etapa.
- **[DECISÃO DE PRODUTO NECESSÁRIA]** Confirmar o provedor final de push para DEV/homologação caso a auditoria encontre ausência ou configuração incompleta de FCM/Web Push; não criar credenciais fictícias.
- **[DECISÃO DE PRODUTO NECESSÁRIA]** Confirmar textos finais de push por evento, mantendo os limites de privacidade e sem permitir conteúdo privado completo.
- **[DECISÃO DE PRODUTO NECESSÁRIA]** Confirmar a regra de fronteira do período (inclusão do dia atual e tratamento exato do instante inicial/final), mantendo `America/Sao_Paulo` como timezone obrigatório.
- A taxa, o split e a confirmação do pagamento não são decisão pendente desta task: permanecem regidos pelo backend e pela `DEC-016`.

## 13. Riscos de Produto

- Uma divergência entre payout persistido e qualquer tela existente pode reduzir a confiança do profissional e produzir decisões financeiras erradas.
- Misturar `PENDING`/`AVAILABLE` com `BLOCKED` pode gerar expectativa incorreta sobre recebimento.
- Dados seed/demo ou fallback de rating podem apresentar desempenho falso ao profissional.
- Visão de CFC sem uma decisão clara de escopo pode aumentar a entrega ou deixar o filtro esperado ausente.
- Um destino de notificação sem autorização server-side pode causar acesso indevido entre tenants ou exposição de dados sensíveis.
- Perder o destino no cold start ou após login reduz o valor da notificação e pode causar repetição de ações.
- Push em tela bloqueada pode expor informações privadas se o payload não for minimizado.
- Tokens inválidos ou duplicados podem causar falhas de entrega e custo operacional sem afetar o histórico in-app.
- Configuração incompleta de FCM/Web Push pode limitar a validação real; o produto deve continuar utilizável pelo sino mesmo sem push.
- Mudanças no service worker podem quebrar instalação, atualização ou cache atual da PWA.
- A migração para Stripe já decidida deve permanecer isolada: qualquer regressão de checkout ou alteração remota de pagamento está fora da autorização desta etapa de produto.

## 14. Handoff para Tech Lead

- Usar este documento como contrato funcional para o plano técnico; não implementar regra financeira no frontend.
- Auditar a fonte real de cada métrica e resolver qualquer divergência entre payout, booking, payment e telas existentes antes de escolher a implementação.
- Preservar as permissões financeiras existentes, a proteção de payouts e o isolamento multi-tenant; deep link nunca substitui autorização.
- Evoluir a navegação hash existente e o service worker único; não introduzir router paralelo nem cachear APIs privadas.
- Definir, no plano técnico, a forma de persistir/hidratar o destino através de app aberto, cold start, refresh e login, mantendo apenas campos allowlisted.
- Auditar a configuração atual de FCM/Web Push antes de criar qualquer registro, variável ou migration; se houver lacuna, separar o que é implementação local do que depende de configuração externa.
- Planejar o registro de dispositivos com acesso restrito ao próprio usuário, tokens não expostos e ciclo de desativação/rotação.
- Planejar o primeiro teste end-to-end com `BOOKING_CONFIRMED` e testes de fallback, multi-role, IDOR, sessão expirada e ausência de entidade.
- Considerar os itens da seção “Decisões Pendentes” como bloqueios de produto para o que não estiver determinado; não inventar comportamento para esses pontos.
- Esta etapa não autoriza código, migration, mutation remota, commit, push ou deploy. O próximo artefato esperado é `technical-plan.md` com status `TECH_READY`.
