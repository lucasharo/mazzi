# TASK-088 — Relatório de auditoria de performance

## Status

`PERFORMANCE_AUDIT_READY`

`PRODUCTION_UNTOUCHED`

Esta execução foi limitada a auditoria e plano. Não houve alteração no código da aplicação, banco, configuração de Production, deploy, commit ou push.

## Baseline

- Branch: `feature/premium-ui-v2`
- HEAD: `d2c12ac4247de67676b9d5e9efce1d3536fa5147` (`fix: remove design system build warning`)
- Status: código rastreado limpo; existem apenas metadados locais não rastreados em `.codex-remote-attachments/` e `supabase/.temp/`, preservados.
- Testes atuais: `npm run test` — 128 arquivos, 847 testes aprovados.
- Lint: `npm run lint` — aprovado.
- Build: `npm run build` — aprovado; permanece apenas o aviso conhecido de chunk grande do showcase (`812.37 kB`), sem erro funcional.
- Data fetching: chamadas diretas pelo `dbService`/Supabase e alguns componentes; não há React Query, TanStack Query, SWR, `QueryClient` ou camada de cache/deduplicação global.
- Cliente Supabase: um cliente compartilhado em `src/lib/supabase.ts`.
- Auth: `AuthContext` possui deduplicação de hydration em voo, mas o fluxo ainda produz múltiplos `auth/v1/user` durante a inicialização observada.
- StrictMode: ativo nos entrypoints Student, profissional, admin e landing. O replay de efeitos é comportamento de DEV; uma contagem dobrada por esse motivo não deve ser tratada como duplicação de produção, mas componentes duplicados, remounts, polling e listeners independentes continuam sendo achados reais.
- Roteamento: `useMobileAppRoute` com renderização condicional da aba ativa; a tela anterior desmonta ao trocar de aba.

## Método de medição

Foram limpos os resource timings e executados fluxos reais no navegador DEV local, usando a lista de recursos carregados pelo browser e filtrando chamadas para o projeto Supabase DEV `bhvpkgonhlujmxvwnxix`. As contagens abaixo são chamadas HTTP/RPC observadas, não contagem de itens retornados.

Quando a contagem é `2 DEV / 1 produção`, a segunda chamada é atribuída ao replay de efeito do StrictMode. Quando há uma segunda causa independente no código, ela é marcada como duplicação real.

## Student

| Tela/fluxo | Request | Quantidade | Motivo | Duplicada? | Prioridade | Arquivo |
|---|---|---:|---|---|---|---|
| Entrada/autenticação | `auth/v1/user` | 3+ DEV | hydration, listener de auth e consumidores durante a montagem | precisa rastrear; parte pode ser replay/refresh | P2 | `src/components/auth/AuthContext.tsx` |
| Entrada | `bookings?select=*` | 2 DEV / 1 produção esperada | effect de bookings com `[user, bookingsRefreshKey]` | DEV-only na carga inicial | P2 | `src/apps/student/StudentApp.tsx` |
| Entrada | RPCs `get_my_booking_names`, `get_my_booking_categories` e reviews | 2 DEV / 1 produção esperada | cada `getBookings` faz enriquecimento em lote | DEV-only na carga inicial | P2 | `src/lib/db-service.ts` |
| Entrada/header | unread notifications | 2 DEV / 1 por montagem | `NotificationIndicator` busca contador ao montar | refetch por remount de header | P2 | `src/components/ui/NotificationIndicator.tsx` |
| Buscar → Aulas | unread notifications | 2 DEV / 1 produção esperada | header da aba Buscar desmonta/monta e carrega contador | refetch de remount | P2 | `NotificationIndicator.tsx`, `StudentApp.tsx` |
| Detalhe de booking | `get_my_booking_disputes` | 4 DEV / 2 produção | `BookingDisputePanel` é renderizado duas vezes em `BookingDetailsModal`; cada instância possui o próprio effect | **sim, confirmada** | P1 | `src/apps/student/components/BookingDetailsModal.tsx` |
| Detalhe → chat | `get_or_create_conversation_for_booking` | 2 DEV / 1 produção esperada | effect de abertura do chat | StrictMode na carga do modal | P2 | `src/components/chat/BookingChatPanel.tsx` |
| Chat | `messages?...conversation_id` | 3 DEV; 2 causas em produção | carga inicial e nova leitura no callback `SUBSCRIBED` do Realtime; StrictMode repete o fluxo inicial | **sim, a leitura inicial + SUBSCRIBED é real** | P1 | `src/components/chat/BookingChatPanel.tsx` |
| Retorno ao app | `getBookings` | potencialmente 2 | listeners de `focus` e `visibilitychange` incrementam a mesma chave em sequência | risco confirmado no código; precisa smoke no dispositivo | P2 | `src/apps/student/StudentApp.tsx` |
| Busca | `searchPublicProviderResults` | 1 por mudança efetiva; pode refazer ao trocar modo | effect depende de `searchViewMode` embora o dataset possa ser o mesmo | potencial | P2 | `src/apps/student/StudentApp.tsx` |
| Busca/paginação | mesma RPC de busca | potencialmente >1 | `IntersectionObserver` pode avançar página antes de o estado de loading estabilizar | risco, não reproduzido como duplicata | P3 | `src/apps/student/StudentApp.tsx` |
| Seleção de horário | `get_public_booking_horizon_days` + `get_available_slots_public` | 1 abertura; pode repetir se `existingBookings` mudar por referência | callback `fetchSlots` depende do array recebido pelo pai | potencial | P2 | `src/apps/student/components/SlotSelectorModal.tsx` |
| Perfil | avatar | 1 por montagem/alteração relevante | effect carrega avatar para preencher o perfil | necessário, mas candidato a cache | P3 | `src/apps/student/StudentApp.tsx` |

### Detalhes Student

- O fluxo obrigatório equivalente à navegação atual foi coberto como `Buscar → Aulas → Buscar → Aulas`, pois o Student não possui uma aba separada chamada Home: as abas atuais são Buscar, Aulas e Perfil. A primeira entrada já carrega bookings; voltar para Aulas não disparou nova chamada no snapshot medido.
- O painel de notificações foi aberto, fechado e aberto novamente. Cada abertura produziu uma leitura completa de até 50 notificações e uma leitura do contador; em DEV cada uma apareceu duas vezes pelo StrictMode. Na produção, uma leitura completa por abertura é esperada, mas não existe cache/TTL para a segunda abertura.
- `getBookings` evita N+1 de nomes/categorias ao fazer RPCs em lote. Para reviews, `getReviewedBookingIds` também faz um único `.in(...)`; não foi encontrado N+1 nesse caminho.
- Checkout é predominantemente event-driven: criação de payment attempt/quote e retorno Stripe ocorrem por abertura/ação, não por render puro. Há efeitos de retomada do checkout que podem recarregar bookings de forma intencional; devem permanecer fora de otimização genérica até testes específicos de retorno.

## Profissional

| Tela/fluxo | Request | Quantidade | Motivo | Duplicada? | Prioridade | Arquivo |
|---|---|---:|---|---|---|---|
| Entrada | bundle de workspace: provider, vehicles, offerings, bookings, compliance, availabilities e exceptions | 2 DEV / 1 produção esperada | `getProviderWorkspace` faz sete selects em paralelo; effect inicial é repetido no StrictMode | replay DEV; bundle amplo em produção | P1 | `src/lib/db-service.ts`, `src/apps/provider/ProviderApp.tsx` |
| Entrada instrutor | unified bookings, global blocks e compliance global | 2 DEV / 1 produção esperada | complemento do carregamento de workspace para usuário instrutor | replay DEV; sobrecarga de carga inicial | P2 | `ProviderApp.tsx` |
| Entrada | `refresh_expired_compliance_documents` | 2+ DEV | chamado no workspace e em loaders de compliance | repetição de manutenção junto da leitura | P2 | `db-service.ts` |
| Entrada/perfil | `getMyProfileAvatar` | 2 por execução de effect também em produção | o effect dispara uma chamada isolada e a mesma chamada dentro de `Promise.all` | **sim, confirmada** | P1 | `src/apps/provider/ProviderApp.tsx` |
| Início → Gestão/Agenda | workspace | 0 na transição medida | dados já estavam no estado global do app | comportamento bom | — | `ProviderApp.tsx` |
| Gestão → Ganhos | `get_provider_earnings_summary` + `get_my_provider_upcoming_payouts` | 2 DEV / 1 produção esperada | montagem de `ProviderEarningsTab` | StrictMode; refetch esperado ao montar, sem cache | P2 | `ProviderEarningsTab.tsx`, `db-service.ts` |
| Ganhos → Início | mesmos RPCs | 2 DEV / 1 produção esperada | dashboard desmontado anteriormente monta `ProviderEarningsDashboardCard` e busca o mesmo período | **sim, fluxo duplicado em produção ao trocar tela** | P1 | `ProviderDashboardTab.tsx`, `ProviderEarningsTab.tsx` |
| Início/qualquer aba não-Aulas | bookings | 1 a cada 15 s | fallback polling ativo em dashboard, ganhos, gestão e perfil mesmo com Realtime | **sim, refetch desnecessário** | P1 | `src/apps/provider/ProviderApp.tsx` |
| Troca de aba | channel de bookings | recriado a cada troca | dependency array inclui `activeTab`; cleanup existe, mas há churn | potencial de evento duplicado durante transição | P2 | `ProviderApp.tsx` |
| Realtime provider/instrutor | dois filtros na mesma channel | 1 channel, 2 handlers | filtro por `instructor_id` e por `provider_id` chama o mesmo callback | pode duplicar callback quando uma mudança satisfaz ambos | P2 | `ProviderApp.tsx` |
| Notificações | lista completa + unread count | 2 DEV por tipo | painel e indicador têm propósitos diferentes; StrictMode duplica cada effect | não é a mesma query; segunda abertura não é cacheada | P2 | `NotificationsPanel.tsx`, `NotificationIndicator.tsx` |
| Gestão escola | memberships/invitations/compliance summary | 1 workspace + 1 ao montar painel | app carrega membership para o workspace e `SchoolMembershipPanel` carrega de novo quando Gestão abre | **sim, provável em produção ao abrir Gestão** | P2 | `ProviderApp.tsx`, `SchoolMembershipPanel.tsx` |
| Atualizar workspace | sete selects + RPCs derivados | 1 conjunto por clique/evento | `refreshCurrentTab` recarrega workspace inteiro para Schedule e Management | **sim, overfetch** | P1 | `ProviderApp.tsx`, `db-service.ts` |

### Detalhes profissional

- O fluxo medido foi `Início → Gestão/Agenda → Ganhos → Início → Gestão/Agenda`. Agenda não refetchou porque o workspace já estava pré-carregado; Ganhos fez os RPCs de earnings; voltar a Início fez a leitura novamente pelo card de dashboard.
- `getProviderWorkspace` faz sete selects paralelos, o que evita serialização, mas entrega dados de veículos, ofertas, compliance, disponibilidade e bookings para qualquer aba. É o maior ponto de overfetch estrutural.
- A channel de bookings tem cleanup com `removeChannel`, portanto não há evidência de leak permanente nessa parte. O problema é a recriação desnecessária ao trocar de aba e a sobreposição com polling.
- O callback de Realtime chama `refreshCurrentTab`. Em abas diferentes de Aulas isso significa novo bundle de workspace; uma alteração de booking pode causar sete selects e chamadas derivadas mesmo quando a tela só precisa atualizar o contador.

## useEffect

| Arquivo/effect | Problema | Impacto | Correção sugerida |
|---|---|---|---|
| `ProviderApp.tsx`, perfil | `getMyProfileAvatar()` isolado e dentro de `Promise.all` | duas chamadas por execução | fazer uma única chamada e compartilhar o resultado |
| `BookingDetailsModal.tsx` + `BookingDisputePanel.tsx` | duas instâncias do painel com effects idênticos | duas leituras em produção; quatro em DEV | renderizar uma instância conforme o layout desejado |
| `BookingChatPanel.tsx` | carga inicial lê mensagens e `SUBSCRIBED` lê novamente | leitura repetida no primeiro carregamento | deduplicar leitura em voo e usar o snapshot inicial como baseline do channel |
| `ProviderEarningsDashboardCard`/`ProviderEarningsTab` | duas telas separadas consultam o mesmo resumo de 30 dias | refetch ao voltar para Início | cache/in-flight registry por período, ou estado compartilhado do earnings resource |
| `ProviderApp.tsx`, polling | effect com `setInterval` em todas as abas não-Aulas | request a cada 15 s com Realtime ativo | limitar fallback à indisponibilidade do channel e ao recurso necessário |
| `ProviderApp.tsx`, Realtime | `activeTab` na dependency do channel | unsubscribe/subscribe a cada aba | manter channel por usuário/provider e deixar callback decidir atualização |
| `ProviderApp.tsx`, polling | dependency `[user]` é objeto amplo/instável | reinício potencial do timer | depender de `user?.id` e papel efetivo estável |
| `StudentApp.tsx`, foco | `focus` e `visibilitychange` usam a mesma invalidação | duas recargas ao retornar ao app | coalescer eventos por janela curta ou usar apenas visibility state transition |
| `StudentApp.tsx`, busca | dependency `searchViewMode` refaz consulta | request sem mudança de filtros | separar transformação visual do fetch do dataset |
| `SlotSelectorModal.tsx` | `fetchSlots` depende de `existingBookings` e é dependency do effect | refetch ao mudar referência do array | usar assinatura estável dos ids/status ou controlar abertura explicitamente |
| `SchoolMembershipPanel.tsx` | componente refaz carga já feita pelo workspace | chamadas repetidas em Gestão | receber dados carregados ou usar resource compartilhado |
| `AuthContext.tsx` | hydration e auth listener podem observar o mesmo estado | múltiplos `auth/v1/user` na inicialização | manter uma única pipeline de sessão e medir antes/depois |

Effects com cleanup correto e sem duplicação funcional identificada: listeners de notificações, Firebase foreground, channels Student/PRO e timer de detalhe de booking. Isso não elimina a necessidade de testar remount e logout.

## Supabase

### Requisições repetidas confirmadas ou de alta confiança

- `get_my_booking_disputes`: duas instâncias visuais gerando a mesma RPC.
- `messages`: leitura inicial e leitura no `SUBSCRIBED` do mesmo conversation id.
- `getMyProfileAvatar`: duas chamadas no mesmo effect do Provider.
- earnings 30 dias: dashboard e tela completa são recursos separados sem cache.
- bookings do Provider: polling a cada 15 s se sobrepõe ao Realtime.
- workspace do Provider: refresh de uma aba recarrega sete recursos e complementos derivados.

### N+1

Não foi confirmado N+1 nos principais fluxos auditados. Student usa RPCs em lote para nomes/categorias e uma consulta `.in(...)` para reviews. Provider usa `Promise.all` para os sete selects. A oportunidade é reduzir largura e repetição do bundle, não trocar por joins sem medir o contrato das telas.

### Oportunidades de consolidação

- criar resource compartilhado/in-flight para earnings por `provider + período`;
- compartilhar lista/contador de notificações por `app_context` e invalidar ao marcar como lida;
- separar `getProviderWorkspace` em recursos por domínio somente se o custo de manutenção compensar;
- retornar um snapshot de mensagens usado tanto pela carga inicial quanto pela confirmação do Realtime;
- deixar refresh de booking atualizar apenas bookings/contador, em vez de workspace completo.

Não há recomendação de alteração de schema nesta task.

## Realtime e listeners

| Área | Situação | Risco |
|---|---|---|
| Student bookings | channel tem cleanup `removeChannel`; dependency estável por user/app | baixo risco de leak; eventos podem gerar refetch adicional |
| Provider bookings | cleanup presente; channel recriada com `activeTab` | churn e possível janela de callbacks concorrentes |
| Provider filters | dois filtros chamam o mesmo callback | storm lógico se uma alteração casar com os dois filtros |
| Chat | cleanup de channel, polling encerrado quando saudável e listener de visibilidade removido | leitura duplicada no `SUBSCRIBED`; baixa evidência de leak |
| Firebase foreground | cleanup retornado pela subscription | sem leak confirmado |
| NotificationIndicator | listener de `NOTIFICATIONS_CHANGED` é removido; cada indicador faz sua própria leitura | várias instâncias podem consultar o mesmo contador |

## Navegação e remount

- Student e profissional renderizam somente a aba ativa. A troca desmonta a tela anterior.
- Student mantém bookings no `StudentApp`, por isso voltar para Aulas não refez a lista no cenário medido; header, indicador, notificações, chat e modais continuam sujeitos a remount.
- Profissional mantém o workspace em `ProviderApp`, por isso Agenda não refez carga na transição; Ganhos e o card do dashboard têm fetching próprio e não compartilham estado.
- O custo do remount é aceitável para telas puramente visuais, mas precisa de resource cache para notificações, earnings e chat.
- Não trocar o roteador nesta task.

## Mutations

- Student usa `bookingsRefreshKey` após confirmação, cancelamento, retorno Stripe e atualização de booking. É previsível, porém recarrega a lista inteira mesmo quando o item alterado já é conhecido.
- Provider chama `loadWorkspace` após salvar perfil e após mudanças de compliance; isso é seguro para consistência, mas atualiza sete fontes e pode incluir chamadas derivadas desnecessárias.
- Realtime também chama `refreshCurrentTab`, criando potencial de refresh completo depois de uma mutation cujo resultado já poderia atualizar estado local.
- A recomendação é priorizar atualização do item afetado e invalidação seletiva somente após preservar as garantias de backend/RLS. Não aplicar update otimista em estados financeiros sem contrato de confirmação.

## Top 10 problemas por impacto real

1. **P1 — polling de bookings a cada 15 s em quase todas as abas do profissional**, concorrendo com Realtime.
2. **P1 — `getProviderWorkspace` como bundle obrigatório de sete selects em qualquer refresh**.
3. **P1 — earnings do dashboard e da tela Ganhos sem resource compartilhado**.
4. **P1 — painel de disputa Student montado duas vezes**.
5. **P1 — chat relê mensagens ao receber `SUBSCRIBED`**.
6. **P1 — avatar do Provider buscado duas vezes no mesmo effect**.
7. **P2 — channel Provider recriada a cada troca de aba e callback compartilhado por dois filtros**.
8. **P2 — notifications list/unread sem cache e com novas leituras por remount/abertura**.
9. **P2 — foco e visibility do Student podem invalidar bookings duas vezes**.
10. **P2 — membership da escola pode ser carregada pelo workspace e novamente pelo painel de Gestão**.

## Quick wins

- remover a chamada duplicada de avatar no effect do Provider;
- eliminar a segunda instância de `BookingDisputePanel`;
- coalescer a leitura inicial do chat com a confirmação `SUBSCRIBED`;
- não recriar a channel Provider por `activeTab`;
- coalescer `focus`/`visibilitychange` do Student;
- impedir polling quando o Realtime estiver saudável;
- compartilhar o resultado de earnings 30 dias entre dashboard e aba completa.

## Refactors maiores

Somente depois dos quick wins e de nova medição:

- resource/cache leve por domínio com TTL e invalidação explícita;
- separar o workspace Provider por recursos de tela, preservando autorização no backend;
- consolidar notificações em store por `app_context`;
- criar testes de lifecycle para montagem, remount, logout e troca de role.

Não há justificativa nesta auditoria para introduzir React Query, trocar o router ou alterar o banco.

## Plano de implementação seguro

### Fase 0 — instrumentação de teste

Adicionar apenas nos testes/ambiente DEV contadores de request por resource key, sem logar dados sensíveis. Definir limites por fluxo e capturar concorrência.

### Fase 1 — duplicações confirmadas

Corrigir avatar, disputa, chat e earnings compartilhado. Cobrir testes de componente e contagem de requests. Repetir os mesmos fluxos Student/PRO.

### Fase 2 — lifecycle e Realtime

Coalescer foco/visibilidade, estabilizar channel Provider, tratar múltiplos filtros e desligar polling quando a assinatura estiver saudável. Testar reconexão e logout.

### Fase 3 — invalidação seletiva

Reduzir refresh de workspace após mutations e separar, com métricas, recursos de Gestão/Agenda. Atualizações financeiras continuam dependentes do backend e de webhook/evento autorizado.

### Fase 4 — validação pré-lançamento

Rodar unit/integration/performance smoke, comparar baseline, executar build e gates, testar DEV publicado e revisar segurança/RLS. Só então considerar commit/deploy.

## Estimativa de impacto

| Correção | Redução esperada | Risco | Complexidade |
|---|---|---|---|
| avatar duplicado | 1 request por carregamento de perfil | baixa | baixa |
| disputa duplicada | -50% das RPCs de disputa | baixa | baixa |
| chat inicial | -1 leitura por abertura saudável | média | baixa/média |
| earnings compartilhado | evita 1 conjunto de RPCs ao voltar ao Início | média | média |
| polling com Realtime | até 4 requests de bookings por minuto por sessão, além dos eventos | média | média |
| channel estável | menos subscribe/unsubscribe e callbacks de transição | média | média |
| refresh seletivo Provider | evita até 7 selects por atualização de tela | média/alta | alta |
| cache de notificações | reduz leituras repetidas em abertura/remount | média | média |

As reduções são estimativas por fluxo e não promessa global; devem ser confirmadas pela instrumentação da Fase 0.

## Testes de não regressão propostos

- Student: Buscar/Aulas em ciclo, painel de notificações abrir-fechar-abrir, detalhe de booking, chat entrar-sair-voltar e retorno por focus/visibility.
- Profissional: Início/Agenda/Ganhos/Início/Agenda, notificações, detalhe, chat e atualização de workspace.
- Montagem: StrictMode DEV não deve ser usado como único critério; comparar contagem em build de produção local.
- Realtime: um channel por usuário/provider, cleanup após logout, reconexão sem duplicar eventos e sem polling concorrente saudável.
- Mutations: completar/cancelar aula, salvar perfil, compliance e marcar notificação; verificar que somente o recurso afetado é revalidado.
- Segurança: manter RLS/RBAC e não expor dados de outro aluno, autoescola ou instrutor.
- Gates: `npm run test`, `npm run lint`, `npm run build`; depois repetir no DEV publicado antes de qualquer deploy adicional.

## Próximo status

`READY_FOR_PERFORMANCE_OPTIMIZATION`
