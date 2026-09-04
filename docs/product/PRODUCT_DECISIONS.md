# Product Decisions (MAZZI)

> **REGISTRO HISTÓRICO DE DECISÕES DE PRODUTO**  
> Este documento registra formalmente as decisões de produto estabelecidas na plataforma MAZZI.
> Nenhum agente ou desenvolvedor deve alterar ou contradizer uma decisão sem abrir uma nova entrada `DEC-XXX` aprovada pelo Tech Lead e Product Manager.

---

## DEC-017: Fundo de Mediação e Reserva Prudencial para Contestações

- **Data**: 2026-09-01
- **Status**: `REQUIRES_REGULATORY_VALIDATION` / percentual não aprovado
- **Tema**: Tesouraria, Disputas, Chargebacks e Retirada de Caixa
- **Contexto**: Em determinadas contestações, aluno e prestador podem ter responsabilidade parcial e a MAZZI pode decidir ressarcir o aluno sem descontar integralmente o prestador, assumindo a perda econômica.
- **Decisão documental**: Separar o fundo de mediação voluntária da reserva técnica de chargebacks/reembolsos. O primeiro é formado com receita própria da plataforma; o segundo cobre a exposição financeira relacionada ao GMV.
- **Aporte de referência do fundo de mediação**: Faixa de 2% a 5% da receita líquida mensal da MAZZI. Para o início, fica registrado **5% como proposta prudencial**, ainda não autorizada para produção.
- **Dimensionamento**: O percentual deve ser confrontado com uma incidência grave estimada de 1% a 3% das aulas, custo médio por acordo e pior caso aprovado. O fundo precisa respeitar o maior valor entre saldo mínimo de pior caso e perdas esperadas no horizonte de segurança.
- **Teto por caso**: Configurável e sujeito a análise administrativa acima do limite. Aplica-se somente ao goodwill voluntário e nunca reduz direitos legais, contratuais ou obrigações do meio de pagamento (`LEGAL_OVERRIDE`).
- **Regra para retirada**: Somente o caixa excedente ao fundo de mediação, à reserva de exposição, às obrigações tributárias, aos valores de terceiros, aos pagamentos pendentes e ao capital de giro mínimo pode ser considerado caixa livre.
- **Reserva de exposição**: Mantém fórmula própria baseada em 100% da exposição conhecida mais buffer sobre GMV ainda sujeito a reembolso/contestação. O exemplo Stripe de 30% por 30 dias é ilustrativo, não uma decisão MAZZI.
- **Percentual definitivo**: Depende de ticket médio, take rate, volume esperado, histórico de incidentes e validação financeira/jurídica.
- **Implementação**: Nenhuma automação financeira deve usar percentual fixo até a aprovação. Quando aprovado, cálculo, configuração, auditoria e bloqueio de retirada devem residir no backend e usar centavos inteiros.
- **Relacionado a**: [`09-payments.md`](../09-payments.md), `DEC-014`, política de disputas e configuração financeira do Admin.

---

## DEC-001: Confirmação de Cadastro e Recuperação por OTP de 8 Dígitos
- **Data**: 2026-08-17
- **Status**: `APROVADA & IMPLEMENTADA`
- **Tema**: Autenticação & Experiência do Usuário (Auth)
- **Decisão**: Substituir links longos de e-mail por códigos numéricos OTP de 8 dígitos (`{{ .Token }}`) para confirmação de cadastro e recuperação de senha.
- **Motivo**: Reduz atrito no mobile, evita problemas com clientes de e-mail corporativos que desarmam links e acelera o onboarding.
- **Impacto**: Criação do componente `OtpInput`, novos endpoints no `auth-service.ts` e suporte a cooldown de 45 segundos para reenvio.
- **Relacionado a**: [`MVP_RULES.md`](./MVP_RULES.md), `AppLogin.tsx`.

---

## DEC-002: Exigência de CPF Válido e Data de Nascimento (Idade Mínima de 18 Anos)
- **Data**: 2026-08-17
- **Status**: `APROVADA & IMPLEMENTADA`
- **Tema**: Identidade, Compliance e Cadastro do Aluno
- **Decisão**: Tornar o CPF (11 dígitos normalizados, único e matematicamente verificado) e a Data de Nascimento (com idade civil mínima de 18 anos completos) campos obrigatórios no cadastro de novos Alunos.
- **Motivo**: Legislação de trânsito brasileira (CONTRAN) exige que apenas maiores de 18 anos iniciem o processo prático de CNH e garante unicidade de conta por aluno.
- **Impacto**: Migration `20260817000029_add_user_cpf_and_birth_date.sql`, triggers no PostgreSQL, utilitários `cpf.ts` e `age.ts`.
- **Relacionado a**: [`MVP_RULES.md`](./MVP_RULES.md), `cpf.ts`, `age.ts`.

---

## DEC-003: Consolidação do Horizonte Canônico de Agendamento em 60 Dias
- **Data**: 2026-08-17
- **Status**: `APROVADA & IMPLEMENTADA`
- **Tema**: Agendamento e Disponibilidade
- **Decisão**: Fixar a constante canônica `STUDENT_BOOKING_HORIZON_DAYS = 60` em `src/domain/availability.ts` como fonte única de verdade para toda a plataforma.
- **Motivo**: Eliminar inconsistências entre modal de agendamento, busca e regras de disponibilidade.
- **Impacto**: Busca e modal de slots carregam progressivamente 30 + 30 dias com teto estrito em 60 dias.
- **Relacionado a**: `availability.ts`, `search.ts`, `SlotSelectorModal.tsx`.

---

## DEC-004: Matching Estrito em 100% dos Filtros de Busca
- **Data**: 2026-08-17
- **Status**: `APROVADA & IMPLEMENTADA`
- **Tema**: Busca de Prestadores (Search Engine)
- **Decisão**: Nenhum instrutor ou CFC pode aparecer no feed de busca se não atender rigorosamente a todos os filtros selecionados pelo usuário.
- **Motivo**: Evita frustração do aluno ao abrir o card de um prestador que não oferece a categoria, transmissão ou horário desejado.
- **Impacto**: Função `matchingOfferings` e validação estrita em `search.ts`.
- **Relacionado a**: [`MVP_RULES.md`](./MVP_RULES.md), `search.ts`.

---

## DEC-005: Unidade Monetária Exclusivamente em Centavos Inteiros
- **Data**: 2026-08-14
- **Status**: `APROVADA & IMPLEMENTADA`
- **Tema**: Arquitetura Financeira e Banco de Dados
- **Decisão**: Todos os preços, taxas, comissões, reembolsos e payouts são manipulados e persistidos como números inteiros em centavos (`integer`/`bigint`).
- **Motivo**: Eliminar imprecisões de arredondamento inerentes a números de ponto flutuante (`float`).
- **Impacto**: Tipos de dados no PostgreSQL e módulo `money.ts`.
- **Relacionado a**: `AGENTS.md`, [`ARCHITECTURE.md`](../architecture/ARCHITECTURE.md).

---

## DEC-006: Validação Prévia de E-mail na Recuperação de Senha com CTA de Cadastro
- **Data**: 2026-08-17
- **Status**: `SUPERSEDED` (Substituída integralmente pela `DEC-011` para prevenção de enumeração de contas)
- **Tema**: Autenticação & Onboarding
- **Decisão**: Na tela de recuperação de senha, verificar previamente se o e-mail existe no banco de dados antes de avançar para a digitação de código OTP. Se o e-mail não existir, manter o usuário na tela informando a ausência do cadastro e exibindo botão direto para "Criar minha conta no MAZZI".
- **Motivo**: Melhora a conversão e usabilidade, evitando que novos usuários tentem recuperar senhas de contas inexistentes e fiquem confusos.
- **Impacto**: Migration `20260817000030_check_user_email_exists.sql` e componente `AppLogin.tsx`.
- **Relacionado a**: `AppLogin.tsx`, `auth-service.ts`.

---

## DEC-007: Formulários com Máscaras Progressivas sem Datepicker Nativo e Validação de Nome Completo
- **Data**: 2026-08-17
- **Status**: `APROVADA & IMPLEMENTADA`
- **Tema**: Experiência do Usuário (UI/UX) & Formulários
- **Decisão**: Utilizar campos de texto puro com máscara progressiva para Data de Nascimento (`DD/MM/AAAA`) e Celular (`(00) 00000-0000`), sem abrir o datepicker nativo do sistema operacional. Exigir obrigatoriamente no mínimo 2 termos (nome e sobrenome) no campo de Nome Completo e desativar tooltips nativos do navegador com validação visual inline vermelha (`role="alert"`).
- **Motivo**: Padronização de experiência entre Android, iOS e Desktop, sem comportamentos inesperados de componentes nativos de formulário.
- **Impacto**: Utilitários `phone.ts`, `age.ts` e componente `Input.tsx`.
- **Relacionado a**: `AppLogin.tsx`, `age.ts`, `phone.ts`.

---

## DEC-008: Lançamento Público Inicial do App Aluno Restrito à Categoria B
- **Complemento aprovado em 2026-09-04 (TASK-090)**: Aula Agora seleciona B automaticamente. A tela de categoria fica fora do fluxo por enquanto, sem contar no progresso; perguntas visíveis: endereço → câmbio → valor máximo. Categoria A continua fora da oferta pública.
- **Data**: 2026-08-18
- **Status**: `APROVADA & IMPLEMENTADA`
- **Tema**: Escopo do Produto & Oferta Pública do App Aluno
- **Decisão**: Restringir a oferta pública inicial do App do Aluno exclusivamente à Categoria B (Automóvel). A Categoria A (Motocicleta) não será oferecida como opção pública inicial para o aluno neste momento, porém toda a arquitetura, modelos de dados, enums, contratos de busca e tipos de domínio permanecem integralmente preparados para ativação futura da Categoria A sem necessidade de refatoração de backend ou banco de dados.
- **Motivo**: Foco de go-to-market e validação da demanda inicial de alunos na Grande São Paulo com menor complexidade operacional inicial.
- **Impacto**: O App do Aluno realiza buscas com `category: 'B'` por padrão e exibe apenas Categoria B, enquanto os componentes de UI exibem dinamicamente `Cat. {category}` se fornecida.
- **Relacionado a**: [`MVP_RULES.md`](./MVP_RULES.md), [`02-mvp-scope.md`](../02-mvp-scope.md), `search.ts`.

---

## DEC-009: Obrigatoriedade de CPF e Data de Nascimento para Alunos e Data de Nascimento Editável no Perfil
- **Data**: 2026-08-18
- **Status**: `APROVADA & IMPLEMENTADA` (Substitui parcialmente a imutabilidade total da data de nascimento de `DEC-002`)
- **Tema**: Identidade do Aluno, Compliance & Perfil
- **Decisão**: Todo usuário com a role `STUDENT` deve obrigatoriamente possuir CPF válido e Data de Nascimento válida (idade civil >= 18 anos completos). O campo `cpf` permanece estritamente imutável e exibido exclusivamente mascarado (`***.***.***-XX`). O campo `birth_date` passa a ser editável pelo próprio aluno em seu Perfil via RPC `update_my_profile`, com validação atômica no banco (rejeitando datas futuras e idade civil < 18 anos). Todas as contas de demonstração (`STUDENT DEMO`) foram migradas com CPFs sintéticos únicos e matematicamente válidos.
- **Motivo**: Garantir integridade cadastral sem impedir correções de datas digitadas erroneamente no onboarding.
- **Impacto**: Migration `20260818000031_student_identity_mandatory_and_editable_birth_date.sql`, RPC `update_my_profile` e tela de Perfil do Aluno em `StudentApp.tsx`.
- **Relacionado a**: [`MVP_RULES.md`](./MVP_RULES.md), [`SECURITY_RULES.md`](../architecture/SECURITY_RULES.md), `StudentApp.tsx`, `db-service.ts`.

---

## DEC-010: Gateway Fake/Mock como Implementação Financeira Ativa Durante Validação do MVP
- **Data**: 2026-08-18
- **Status**: `APROVADA & IMPLEMENTADA` (Esclarece e complementa as regras financeiras de `DEC-003` e `MVP_RULES.md`)
- **Tema**: Meios de Pagamento, Infraestrutura Financeira & Gateway
- **Decisão**: Manter o `FakePaymentGateway` (`src/domain/payments/fake-adapter.ts`) como o gateway financeiro ativo durante a fase de desenvolvimento, testes e validação inicial do MVP. O fluxo de pagamento dentro do aplicativo permanece funcional (PIX e Cartão de Crédito simulados), sem nenhuma movimentação financeira real ou chamadas HTTP ao vivo para o Mercado Pago no ambiente atual. Os adaptadores e arquitetura do Mercado Pago (`src/domain/payments/mercadopago-adapter.ts`) permanecem preparados e preservados no código-fonte, mas a integração HTTP real ao vivo com o gateway externo está oficialmente adiada para uma TASK futura dedicada.
- **Motivo**: Permitir validação completa da jornada do aluno e do prestador sem dependência de credenciais bancárias de produção ou risco de cobranças indevidas durante o desenvolvimento.
- **Impacto**: O checkout utiliza o gateway simulado `FakePaymentGateway` por padrão em desenvolvimento. As regras financeiras continuam calculadas em centavos inteiros no backend.
- **Relacionado a**: [`MVP_RULES.md`](./MVP_RULES.md), [`CURRENT_IMPLEMENTATION_STATUS.md`](../CURRENT_IMPLEMENTATION_STATUS.md), [`ARCHITECTURE.md`](../architecture/ARCHITECTURE.md), `gateway-factory.ts`.

---

## DEC-011: Recuperação de Senha sem Enumeração de Contas (Anti-Account Enumeration)
- **Data**: 2026-08-18
- **Status**: `APROVADA & IMPLEMENTADA` (Substitui integralmente a `DEC-006`)
- **Tema**: Autenticação, Segurança & Privacidade
- **Decisão**: A recuperação de senha NÃO deve consultar ou revelar previamente se um e-mail possui ou não uma conta cadastrada no MAZZI. Para qualquer e-mail sintaticamente válido submetido, a interface apresenta rigorosamente a mesma resposta pública de sucesso: *"Se existir uma conta associada a este e-mail, enviaremos um código de recuperação."*. A RPC `check_user_email_exists` foi removida do banco de dados via migration `20260818000033_disable_email_account_enumeration.sql` e a chamada no frontend aciona diretamente `resetPasswordForEmail` sem ramificações visuais por status de conta.
- **Motivo**: Hardening de segurança para prevenir enumeração de contas por e-mail e vazamento de privacidade de alunos e prestadores cadastrados.
- **Impacto**: Migration `20260818000033_disable_email_account_enumeration.sql`, remoção da RPC no Supabase remoto e componente `AppLogin.tsx`.
- **Relacionado a**: [`MVP_RULES.md`](./MVP_RULES.md), [`SECURITY_RULES.md`](../architecture/SECURITY_RULES.md), `AppLogin.tsx`, `auth-service.ts`.

---

## DEC-012: Login Rápido DEV Preservado com Credenciais Locais Não Versionadas
- **Data**: 2026-08-18
- **Status**: `APROVADA & IMPLEMENTADA`
- **Tema**: Autenticação, Ferramental DEV & Segurança de Credenciais
- **Decisão**: A funcionalidade de Login Rápido DEV (`DevQuickLogin.tsx`) e a lista de contas de demonstração (`demo-accounts.ts`) continuam existindo integralmente para agilizar os testes de desenvolvimento. Todas as passwords e segredos hardcoded foram removidos do código versionado e do Git. As credenciais das contas demo foram rotacionadas remotamente no Supabase Auth e passam a ser resolvidas exclusivamente a partir de variáveis de ambiente locais não versionadas (`.env.local`), separadas por grupo de role (`STUDENT`, `INSTRUCTOR`, `SCHOOL`, `PLATFORM_ADMIN`). A funcionalidade é carregada apenas em ambiente `import.meta.env.DEV` com a flag `VITE_ENABLE_DEV_QUICK_LOGIN="true"`.
- **Motivo**: Manter a alta produtividade do ecossistema de desenvolvimento sem expor senhas ou credenciais funcionais no histórico/HEAD do repositório versionado.
- **Impacto**: Componentes `DevQuickLogin.tsx`, `demo-accounts.ts`, `.env.example` e `.env.local`.
---

## DEC-013: Política Comercial de Cancelamento do MVP
- **Complemento**: a DEC-018 especifica consequências não financeiras por cancelamento injustificado na Aula Agora; não altera os percentuais de reembolso abaixo.
- **Data**: 2026-08-18
- **Status**: `APROVADA & IMPLEMENTADA`
- **Tema**: Cancelamento de Aulas, Reembolsos, Repasses & Direitos do Consumidor
- **Decisão**: Aprovar a tabela canônica oficial de cancelamento do MVP (`MVP_CANCELLATION_POLICY`):
  1. **Aluno com >= 24h de antecedência**: 100% de reembolso ao aluno; 0% de comissão ao prestador.
  2. **Aluno entre 6h e 24h de antecedência** (6h <= t < 24h): 50% de reembolso ao aluno; 50% tratado contabilmente no domínio de marketplace.
  3. **Aluno com < 6h de antecedência**: 0% de reembolso (`LATE_CANCELLATION`).
  4. **Prestador (Instrutor / Autoescola) cancela (qualquer antecedência)**: 100% de reembolso integral ao aluno. Motivo é **obrigatorio** para o prestador. Nenhuma multa automática aplicada no MVP.
  5. **No-Show do Aluno**: 0% de reembolso.
  6. **No-Show do Prestador**: 100% de reembolso integral ao aluno.
  7. **Motivo do Aluno**: Opcional.
  8. **Motivo do Prestador**: Obrigatório (opções predefinidas `VEHICLE_ISSUE`, `PERSONAL_EMERGENCY`, `SCHEDULE_CONFLICT`, `WEATHER_OR_SAFETY`, `OPERATIONAL_ISSUE`, `OTHER`).
  9. **Legal Override (`LEGAL_OVERRIDE`)**: Direitos legais obrigatórios do consumidor aplicáveis prevalecem sobre a política comercial.
- **Motivo**: Definir regras comerciais claras e justas para alunos e prestadores credenciados, eliminando pendências e garantindo previsibilidade de cancelamento no MVP.
- **Impacto**: Domínio `src/domain/cancellation.ts`, constante `MVP_CANCELLATION_POLICY`, RPC `cancel_booking_v2`, modal de cancelamento em `BookingDetailsModal.tsx` e portal do prestador.
- **Relacionado a**: [`MVP_RULES.md`](./MVP_RULES.md), [`03-business-rules.md`](../03-business-rules.md), `cancellation.ts`.

---

## DEC-014: Checkout Mercado Pago Alternável e Restrito ao Ambiente de Teste
- **Data**: 2026-08-27
- **Status**: `APROVADA & IMPLEMENTADA EM DEV` (Complementa a `DEC-010`)
- **Tema**: Pagamentos, Segurança e Homologação
- **Decisão**: Preservar o `FakePaymentGateway` como padrão e permitir selecionar `mercadopago` por `VITE_PAYMENT_GATEWAY_PROVIDER`. O modo Mercado Pago utiliza Card Payment Brick e Pix, uma parcela no cartão, captura online e credenciais de teste. O Pix pode exigir conclusão posterior por webhook assinado ou consulta autoritativa. A Edge Function exige `MERCADOPAGO_ENVIRONMENT=test`, usa valor persistido em centavos, autenticação e idempotência; somente confirmação server-side `approved` finaliza pagamento e reserva no backend.
- **Motivo**: Homologar a integração real de API e UX sem movimentar dinheiro nem remover o ambiente simulado.
- **Impacto**: `MercadoPagoCardCheckout.tsx`, Edge Function `process-mercadopago-card-payment`, migration TASK-079 e variáveis documentadas em `.env.example`. Produção permanece desabilitada.
- **Relacionado a**: [`MVP_RULES.md`](./MVP_RULES.md), [`09-payments.md`](../09-payments.md), `tasks/TASK-079/`, `tasks/TASK-080/`.

---

## DEC-015: Pix Mercado Pago com Confirmação Posterior e Repasse Manual
- **Data**: 2026-08-27
- **Status**: `APROVADA & IMPLEMENTADA EM DEV`
- **Tema**: Recebimento Pix, Segurança e Operação Financeira
- **Decisão**: O checkout Mercado Pago passa a oferecer Pix em ambiente de teste. A criação do pagamento é online e retorna QR Code/copia e cola, mas a reserva permanece `PENDING_PAYMENT` até confirmação server-side por webhook assinado ou consulta autoritativa. O repasse ao prestador permanece manual pelo Admin; OAuth, split automático e transferência Pix automática continuam fora do escopo.
- **Motivo**: Pix exige acompanhar o status após o aluno efetuar o pagamento; confirmar a reserva somente na criação do QR Code causaria reservas indevidamente confirmadas.
- **Impacto**: Edge Functions de criação e webhook Pix, `payment_webhook_events`, destino Pix do PRO, painel financeiro do Admin e migration `20260828023332_pix_receiving_and_manual_payouts.sql`.
- **Relacionado a**: [`MVP_RULES.md`](./MVP_RULES.md), [`09-payments.md`](../09-payments.md), `tasks/TASK-080/`.

> **Nota de supersessão (2026-08-30):** As decisões DEC-010, DEC-014 e DEC-015 descrevem o histórico da homologação Mercado Pago. O checkout operacional atual foi migrado para Stripe conforme DEC-016 abaixo. Os registros legados permanecem somente para reconciliação histórica.

## DEC-016: Migração do Checkout para Stripe
- **Data**: 2026-08-30
- **Status**: `APROVADA & IMPLEMENTADA`
- **Tema**: Checkout, Segurança e Reconciliação Financeira
- **Decisão**: O checkout novo usa Stripe Checkout hospedado externamente para cartão de crédito e Pix. O backend cria Checkout Sessions exclusivamente com o valor da reserva persistido em centavos, aplica idempotência, confirma a reserva somente por webhook Stripe com assinatura validada e executa estornos pela Edge Function autenticada do Admin.
- **Motivo**: Substituir a integração de checkout Mercado Pago/Bricks por uma integração customizada única, com confirmação server-side e suporte aos dois meios de pagamento.
- **Impacto**: `StripeHostedCheckout.tsx`, `create-stripe-checkout-session`, `stripe-webhook`, `process-stripe-refund`, migration `stripe_checkout_gateway` e variáveis `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET`. Mercado Pago não é mais selecionável no checkout novo.
- **Relacionado a**: [`09-payments.md`](../09-payments.md), [`CURRENT_IMPLEMENTATION_STATUS.md`](../CURRENT_IMPLEMENTATION_STATUS.md).

## DEC-018: Disciplina por cancelamento injustificado na Aula Agora

- **Data**: 2026-09-04.
- **Status**: `IMPLEMENTADA — backend ativo em DEV; interfaces locais validadas; sem publicação de frontend`.
- **Decisão**: advertência no primeiro cancelamento injustificado; ao atingir três em 30 dias, suspensão do Aula Agora por 24 horas. Preservar aulas agendadas e repasses; não aplicar multa automática.
- **Revisão**: administrador classifica ocorrências com justificativa; profissional pode contestar. Isenções removem a ocorrência da contagem.
- **Escopo e garantias**: [política detalhada](./INSTANT_CANCELLATION_CONDUCT.md).
- **Production**: intocada; validação regulatória antes de ativação comercial.

## DEC-017: Onboarding Connect hospedado iniciado pelo MAZZI
- **Data**: 2026-09-02
- **Status**: `APROVADA — IMPLEMENTAÇÃO OBRIGATÓRIA`
- **Tema**: Recebimento do PRO, experiência do produto e Connect
- **Decisão**: O MAZZI inicia o cadastro e abre um `Account Link` de uso único hospedado pela Stripe. O PRO não deverá criar uma conta Stripe por conta própria nem acessar o Dashboard Stripe para concluir o cadastro. Identidade, aceite contratual e dados bancários são coletados pela Stripe.
- **Transparência**: “Stripe transparente” significa que a Stripe não será apresentada como um segundo produto para o PRO administrar. A página hospedada aparece somente durante o cadastro de recebimentos, com retorno automático ao MAZZI.
- **Dados**: o MAZZI não coleta nem armazena agência, conta ou dados bancários completos. Pode guardar somente o ID Connect, estados de capacidade e o resumo mascarado que a Stripe devolver, como banco e últimos quatro dígitos.
- **Retorno**: `return_url` sincroniza o status autoritativo e `refresh_url` gera um novo link quando o anterior expirar ou já tiver sido usado. O cadastro só libera repasses quando `payouts_enabled=true`.
- **DEV**: a homologação usa sandbox e contas brasileiras de teste. Uma conta Connect americana exige uma plataforma Stripe separada registrada nos EUA; não será criada pela plataforma brasileira da MAZZI.
- **Relacionado a**: [`09-payments.md`](../09-payments.md), [`CURRENT_IMPLEMENTATION_STATUS.md`](../CURRENT_IMPLEMENTATION_STATUS.md).
