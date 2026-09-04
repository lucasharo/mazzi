TASK: TASK-089
STATUS: READY_FOR_QA_WITH_ENVIRONMENT_BLOCKER
OWNER: MAZZI Dev
LAST_UPDATED: 2026-09-04

# O que foi implementado

- Entrada separada de Aula Agora no Student, sem alterar o agendamento tradicional.
- Modal Student com ponto de encontro por autocomplete Geoapify, localização atual, categoria A/B, câmbio e teto derivado por preços elegíveis.
- Busca idempotente, cancelamento, recuperação após refresh e polling controlado para abrir novas ondas somente após a expiração/recusa da onda atual.
- Configuração do PRO por oferta: preço em centavos, distância máxima, habilitação, disponibilidade operacional e localização recente.
- Renovação automática da localização operacional a cada 25 segundos enquanto o PRO está disponível, com nova atualização ao retornar para a aba visível.
- Preview de preços alinhado ao dispatch: não exibe profissionais com localização expirada, chegada acima de 30 minutos ou conflito de agenda.
- O Student revalida os candidatos no clique e mantém o modal aberto com mensagem amigável quando o dispatch retorna `FAILED` ou nenhuma oferta.
- O heartbeat do PRO continua tentando renovar a localização mesmo com a guia em segundo plano, permitindo a busca do Student em outra guia; a validação de frescor permanece no backend.
- A janela de agenda do dispatch foi corrigida para considerar a próxima aula e a margem de deslocamento, em vez de bloquear qualquer aula futura.
- O snapshot de ofertas agora retorna o relógio do servidor; o contador do PRO não depende mais do relógio do celular para decidir quanto tempo resta.
- Ao retornar para a guia do PRO, as ofertas são recarregadas imediatamente, sem depender do polling retardado pelo navegador em segundo plano.
- O contador também é sincronizado imediatamente em `visibilitychange` e `focus`, evitando saltos causados por timers pausados em segundo plano.
- O botão de aceite não é mais bloqueado pela contagem local: uma aba em segundo plano pode pausar o timer, então a validade é decidida exclusivamente pelo RPC atômico do backend.
- O aceite do PRO agora usa um hold interno de Aula Agora com o `student_id` da solicitação, validando oferta, aluno, cotação e vínculo do instrutor antes de criar a booking; o checkout normal continua exigindo `auth.uid() = student_id`.
- O lock de concorrência do hold interno usa o mesmo advisory lock do aluno sem chamar `lock_student_profile`, pois essa função exige que a sessão seja do próprio aluno e gerava `AUTH_REQUIRED` no aceite do PRO.
- O aceite do PRO não aplica `SELF_BOOKING_NOT_ALLOWED`: essa proteção é para o aluno tentar reservar o próprio instrutor; no aceite, o instrutor é necessariamente o dono autorizado da oferta, enquanto o aluno da booking continua vindo da solicitação.
- A validação de slot do agendamento tradicional não é reutilizada no aceite instantâneo, porque ela exige início na hora cheia e rejeitaria `NOW() + ETA`; o caminho Aula Agora mantém o lock do instrutor e a restrição atômica de exclusão da booking.
- O cancelamento de uma booking `PENDING_PAYMENT` agora encerra atomicamente a solicitação de Aula Agora vinculada e suas ofertas pendentes/aceitas; o resolver também ignora qualquer vínculo antigo com booking cancelada, expirada ou com falha de pagamento.
- Após o aceite, o painel do profissional mostra que o aluno está finalizando o pagamento, com aluno, horário e ponto de encontro; o deslocamento só deve começar após a confirmação. A confirmação agora publica `BOOKING_CONFIRMED` para Student e PRO com o `app_context` correto.
- Após uma busca terminal/expirada, a chave de idempotência do Student é limpa para que a próxima tentativa crie uma solicitação nova.
- Card compartilhado de oferta com ETA, distância, preço, duração, expiração e ações aceitar/recusar.
- Primeiro aceite atômico convertendo a oferta em quote/booking normal, preservando preço snapshot e source `AULA_AGORA`.
- Após o aceite, o Student é levado automaticamente ao resumo da aula com o botão Confirmar pagamento, reutilizando o checkout Stripe existente; o retorno confirmado pelo backend reabre a Aula Agora com o mapa e a localização do profissional.
- Tracking pós-match com o mapa Leaflet/OSM já existente e posição exata somente após o pagamento confirmado; bookings `PENDING_PAYMENT` nunca recebem posição.
- Notificação canônica `INSTANT_LESSON_OFFER` no contexto `PRO`, com destino para Gestão → Aula Agora.
- RLS restritiva e acesso frontend somente pelos RPCs encapsulados em `dbService`.

# Arquivos alterados

- `supabase/migrations/20260904011639_task_089_instant_lesson.sql`
- `supabase/migrations/20260904015114_task_089_instant_price_matches_dispatch.sql`
- `supabase/migrations/20260904032658_task_089_dynamic_schedule_window.sql`
- `supabase/migrations/20260904034327_task_089_offer_server_clock.sql`
- `supabase/migrations/20260904131400_task_089_instant_match_booking_hold.sql`
- `supabase/migrations/20260904132315_task_089_instant_match_actor_lock.sql`
- `supabase/migrations/20260904132533_task_089_instant_match_context_checks.sql`
- `supabase/migrations/20260904132856_task_089_instant_match_slot_validation.sql`
- `supabase/migrations/20260904140000_task_089_instant_request_cleanup_after_cancel.sql`
- `supabase/migrations/20260904143000_task_089_instant_payment_status_notification.sql`
- `supabase/migrations/20260904150000_task_089_instant_payment_map_gate.sql`
- `src/domain/instant-lesson.ts`
- `src/components/instant/*`
- `src/apps/student/StudentApp.tsx`
- `src/apps/student/components/InstantLessonModal.tsx`
- `src/apps/provider/ProviderApp.tsx`
- `src/apps/provider/components/ProviderManagementTab.tsx`
- `src/apps/provider/components/ProviderInstantLessonPanel.tsx`
- `src/lib/db-service.ts`, `src/lib/notification-navigation.ts`, `src/types/index.ts`

# Migrations criadas e aplicadas

- Criada e aplicada no Supabase DEV como `20260904011639_task_089_instant_lesson.sql`.
- Criada e aplicada no Supabase DEV como `20260904015114_task_089_instant_price_matches_dispatch.sql`.
- Criada e aplicada no Supabase DEV como `20260904032658_task_089_dynamic_schedule_window.sql`.
- Criada e aplicada no Supabase DEV como `20260904034327_task_089_offer_server_clock.sql`.
- Criada e aplicada no Supabase DEV como `20260904131400_task_089_instant_match_booking_hold.sql`.
- Hotfixes `20260904132315_task_089_instant_match_actor_lock.sql`, `20260904132533_task_089_instant_match_context_checks.sql` e `20260904132856_task_089_instant_match_slot_validation.sql` aplicados diretamente no DEV e mantidos no repositório para o histórico da correção.
- O histórico DEV ainda contém divergências históricas em versões não presentes no diretório local; a migration foi aplicada diretamente pelo mecanismo seguro do Supabase, sem reparo destrutivo do ledger e sem qualquer alteração em Production.

# Testes adicionados

- `tests/instant-lesson-domain.test.ts`
- `tests/instant-lesson-contract.test.ts`
- `tests/instant-lesson-ui.test.tsx`

# Testes executados

- Direcionados: 2 arquivos, 22 testes aprovados.
- Suíte completa: 133 arquivos, 874 testes aprovados.
- `npm run lint`: aprovado.
- `npm run build:all`: Student, Instructor, Admin e Landing aprovados.
- `git diff --check`: aprovado; somente avisos de conversão de final de linha dos arquivos já existentes.

# Testes manuais realizados

- Student local: modal Aula Agora permanece aberto durante o fluxo inicial.
- Student local: modal permanece aberto quando a disponibilidade falha; o CTA não troca para um estado de busca transitório.
- PRO local + Supabase DEV: profissional Carlos permaneceu `instant_online=true` e sua localização foi renovada após mais de 28 segundos, com idade observada de 23,4 segundos.

## Causa raiz do fechamento visual

O preview mostrava o preço do instrutor sem aplicar as mesmas regras de tempo real do dispatch. No caso reproduzido, o instrutor tinha localização com 110 segundos e conflito com aula futura; o dispatch retornou `FAILED` e `offers_created: 0`. O Student exibia temporariamente a busca otimista e imediatamente a removia ao consultar que não havia uma solicitação ativa, causando o “pisca”. O preview e o fluxo de início agora usam as mesmas guardas e o estado otimista foi removido.

Na análise seguinte, a aula futura de 08:00 também estava sendo tratada como conflito absoluto. O dispatch agora bloqueia somente uma aula em andamento ou uma próxima aula que não comporte chegada, duração e margem de segurança; o preview usa a mesma janela dinâmica.

Na análise do aceite, a oferta exibida com “5s” já havia expirado no relógio do servidor: foi criada às 03:41:02, expirou às 03:41:17 e o aceite chegou às 03:41:21. O contador local podia divergir do Supabase; o snapshot com `server_now` e o recarregamento ao voltar à guia corrigem essa inconsistência visual.

Na análise seguinte, o timer local ficou pausado enquanto a guia estava em segundo plano e reapareceu com um valor antigo, saltando de 39s para 10s. O contador agora força a sincronização ao retornar à guia e ao receber o relógio do servidor.

Na reprodução final, o card aparecia como pendente no banco, mas o botão já estava desabilitado pelo relógio local; quando liberado pelo agente, o aceite passou a ser encaminhado ao RPC e a validade ficou novamente sob autoridade do servidor. Também foi identificado que buscas anteriores podiam reutilizar a chave de idempotência após uma falha, o que foi corrigido limpando a chave ao não existir solicitação ativa.

Na validação seguinte, o aceite retornou `STUDENT_ID_MISMATCH`: `respond_to_instant_offer` executava `create_booking_hold` sob a sessão do instrutor, embora essa função seja exclusiva do aluno. O RPC agora chama `create_instant_booking_hold`, com autorização explícita do instrutor/provedor na oferta e conferência de que a cotação pertence ao aluno e aos mesmos recursos da oferta.

Na primeira validação da correção, o hold interno alcançou `lock_student_profile`, que também exige `auth.uid()` igual ao aluno e retornou `AUTH_REQUIRED`. O hotfix substitui somente esse lock por `pg_advisory_xact_lock` dentro do procedimento já protegido e mantém todas as validações de vínculo, cotação, elegibilidade, disponibilidade e idempotência.

Na validação seguinte, o procedimento interno aplicou `SELF_BOOKING_NOT_ALLOWED` ao ator instrutor. Essa checagem foi removida somente do caminho de aceite, pois o instrutor autenticado precisa aceitar a própria oferta; a autorização da oferta e a conferência de todos os IDs permanecem obrigatórias.

Na validação seguinte, o procedimento chegou à validação de slot do agendamento tradicional, que exige hora cheia, e retornou `INSTANT_SCHEDULE_CONFLICT` para o início imediato com ETA. Essa validação foi retirada apenas do caminho instantâneo; a proteção contra corrida continua no advisory lock e na exclusão temporal do PostgreSQL.

Na reprodução mais recente, a booking de Aula Agora foi cancelada, mas a solicitação permaneceu `MATCHED`, fazendo o Student reabrir indefinidamente a aula antiga. A nova migration reconcilia esses registros, encerra o estado instantâneo junto com o cancelamento e filtra o resolver por bookings realmente ativas (`PENDING_PAYMENT`, `CONFIRMED` ou `IN_PROGRESS`), liberando a nova busca sem remover a proteção de uma aula válida.

Na validação do aceite, a booking criada ficava `PENDING_PAYMENT` e era removida do painel do profissional pelo filtro de não pagos. Agora ela aparece em Aula Agora com o ponto de encontro e o aviso de aguardar o pagamento; `confirm_booking_payment` notifica o aluno e o profissional somente quando a confirmação autorizada ocorrer.

No fluxo Student, o aceite agora fecha o modal de busca e abre o resumo da própria booking pendente com `Confirmar pagamento`, sem criar um checkout paralelo. O ID da booking é preservado durante o redirecionamento Stripe. No retorno, somente `PAID + CONFIRMED` libera o mapa; a função `get_instant_tracking` também rejeita o estado `PENDING_PAYMENT` como gate adicional no backend.

# Limitações e riscos conhecidos

- `supabase db lint --linked --fail-on error` retorna erros históricos já existentes no schema DEV, fora da migration TASK-089.
- `supabase db push --linked --dry-run` não consegue prosseguir enquanto o repositório local não contém várias versões presentes no ledger remoto. O ambiente precisa ser reconciliado pelo responsável do banco antes de aplicar esta migration.
- O cálculo de ETA é geodésico/conservador; não é rota viária.
- A localização operacional é o último ponto por instrutor, sem histórico persistente.

# Handoff para QA

Auditar os critérios AC01–AC37, especialmente concorrência do aceite, RLS, notificações por contexto, waves, expiração, privacidade pré-match e o fluxo completo Student/PRO após a aplicação controlada da migration no DEV.
