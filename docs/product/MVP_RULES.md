# MVP_RULES.md — Regras Canônicas de Produto do MAZZI

> **FONTE CANÔNICA DE VERDADE DO PRODUTO (MAZZI Premium V2)**  
> Este documento consolida todas as regras de negócio e contratos de produto formalmente estabelecidos no código e arquitetura do repositório. Nenhum agente deve alterar ou violar estas diretrizes sem uma correspondente Decisão de Produto (`PRODUCT_DECISIONS.md`).

---

## 1. Visão Geral e Mercado

1. **Definição do Produto**: O MAZZI é um marketplace brasileiro voltado ao agendamento, pagamento e realização de **aulas práticas de direção veicular** (preparatórias ou de aperfeiçoamento para habilitação CNH).
2. **Praça de Lançamento Inicial**: Região Metropolitana de São Paulo (SP), com geolocalização e raio de atendimento em quilômetros.
3. **Público-Alvo**:
   - **Alunos**: Pessoas a partir de 18 anos em processo de habilitação ou habilitados buscando aperfeiçoamento/treinamento para habilitados.
   - **Instrutores Autônomos**: Profissionais credenciados com veículo homologado.
   - **Autoescolas / CFCs**: Centros de Formação de Condutores com frota e equipe de instrutores.

---

## 2. Escopo do MVP vs. Fora de Escopo

### 2.1. No Escopo do MVP
- **App do Aluno** (PWA / Web Mobile-first);
- **Portal do Instrutor** (Gestão de agenda, ofertas, veículos, confirmações e ganhos);
- **Portal Administrativo** (Credenciamento de profissionais, moderação e compliance);
- **Categorias de Habilitação**: Lançamento público inicial do App Aluno restrito à **Categoria B** (Automóvel). *Nota: Embora a arquitetura do MAZZI suporte categorias A e B, o lançamento público inicial do App Aluno será restrito à categoria B. A categoria A permanece preparada tecnicamente para ativação futura.*
- **Transmissões**: Manual e Automática;
- **Veículo do Profissional**: Toda aula é ministrada obrigatoriamente no veículo fornecido e homologado pelo instrutor/CFC;
- **Busca com Filtros Estritos**: Busca geoespacial e por disponibilidade com matching integral de filtros;
- **Agendamento com Horizonte Canônico de 60 Dias**: Visualização progressiva de 30 + 30 dias;
- **Pagamentos Integrados**: Pagamento dentro do aplicativo (PIX e Cartão de Crédito). *Nota: o checkout fake continua padrão. Em DEV, a configuração `mercadopago` permite homologar somente cartão com credenciais de teste e sem cobrança real (DEC-014).*
- **Chat Contextual**: Mensageria interna associada à reserva confirmada;
- **Avaliações**: Sistema de 1 a 5 estrelas e depoimento após a conclusão da aula.

### 2.2. Explicitamente Fora do Escopo do MVP (Congelado)
- Aulas teóricas de legislação de trânsito;
- Categorias C, D, E e ACC;
- Uso de veículo próprio do aluno na aula;
- Pacotes comerciais de aulas (venda apenas de aulas avulsas);
- Gamificação, pontuações ou recompensas;
- IA pedagógica ou análise de telemetria em tempo real;
- Integrações diretas de validação com sistemas governamentais (DETRAN/SENATRAN) — *apenas registro e compliance interno MAZZI*.

---

## 3. Identidade, Autenticação e Cadastro

1. **Mecanismo de Autenticação**: Exclusivamente Supabase Auth nativo.
2. **Confirmação de E-mail**: Realizada via **código OTP de 8 dígitos** enviado por e-mail (`{{ .Token }}`).
3. **Recuperação de Senha**: Realizada via **código OTP de 8 dígitos** com expiração e redefinição segura.
4. **Campos Obrigatórios no Cadastro do Aluno**:
   - `Nome completo`: Mínimo de 3 caracteres;
   - `E-mail`: Válido e único;
   - `Celular`: Com DDD (mínimo 10 dígitos numéricos);
   - `CPF`: Obrigatório, normalizado em 11 dígitos, único no sistema (`idx_users_cpf_unique`) e com validação matemática dos 2 dígitos verificadores;
   - `Data de Nascimento`: Obrigatória (`DATE`), com exigência rigorosa de **18 anos civis completos**;
   - `Senha`: Mínimo de 8 caracteres.
5. **Imutabilidade e Edição no Perfil do Aluno (DEC-009)**:
   - `CPF`: Estritamente imutável após a criação da conta. Exibido no Perfil do Aluno exclusivamente de forma mascarada (`***.***.***-XX`).
   - `Data de Nascimento`: Editável pelo próprio aluno no seu Perfil via RPC `update_my_profile`. Toda atualização é atomicamente validada no banco de dados (rejeitando datas futuras e idade civil < 18 anos).
6. **Segurança de Roles no Cadastro**:
   - Cadastros públicos criam exclusivamente a role `STUDENT`.
   - Nenhuma role privileged (`INSTRUCTOR`, `SCHOOL_ADMIN`, `PLATFORM_ADMIN`) pode ser autoatribuída via frontend ou `user_metadata`.
   - Proteção estrita garantida no PostgreSQL por RLS e triggers.

---

## 4. Busca e Disponibilidade (Matching Estrito)

1. **Contrato de Busca Estrita**: Nenhum prestador (instrutor ou autoescola) pode aparecer nos resultados da busca se não atender a **100% dos filtros ativos selecionados pelo aluno** (categoria, transmissão, tipo de prestador, raio geográfico, data e faixa de horário).
2. **Horizonte de Agendamento**:
   - `STUDENT_BOOKING_HORIZON_DAYS = 60` é a única constante canônica em `src/domain/availability.ts`.
   - Carregamento inicial de 30 dias com extensão sob demanda para 60 dias.
3. **Sem Double Booking**:
   - Um mesmo instrutor OU um mesmo veículo **jamais pode possuir duas aulas sobrepostas no mesmo intervalo de tempo**.
   - Trava atômica garantida por restrições de exclusão temporal no banco de dados.

---

## 5. Regras Financeiras e Pagamentos

1. **Unidade Monetária**: Todos os valores monetários são manipulados e persistidos em **centavos inteiros** (`integer`/`bigint`). Exemplo: R$ 120,00 = `12000`. Jamais utilizar números de ponto flutuante (`float`) para dinheiro.
2. **Fonte da Verdade**: O cálculo de taxas, split de pagamento e confirmação de reserva reside e é validado no Backend.
3. **Gateway de Checkout em DEV (DEC-010 e DEC-014)**:
   - **Padrão**: `FakePaymentGateway`, sem dinheiro real.
   - **Homologação opcional**: Mercado Pago com Card Payment Brick e credenciais de teste, selecionado por variável de ambiente. Produção continua bloqueada.
4. **Transição de Estados de Booking**:
   - `DRAFT` → `PENDING_PAYMENT` → `CONFIRMED` → `IN_PROGRESS` → `COMPLETED`.
   - O booking só transiciona para `CONFIRMED` após notificação/webhook assinado e verificado do gateway de pagamento.
5. **Idempotência**: Todas as transações financeiras e webhooks utilizam `idempotency_key`.

---

## 6. Design System e Experiência do Usuário (UI/UX)

1. **Linguagem Visual Canônica**: **MAZZI Premium V2** (Mobile-first, superfícies claras `#f8fafc`, cantos arredondados generosos `rounded-2xl` e `rounded-3xl`, bordas suaves `var(--mazzi-border)`, amarelo MAZZI `var(--mazzi-yellow)` e tipografia Inter/Outfit com peso balanceado `font-bold` / `font-extrabold`).
2. **Componentes Obrigatórios**:
   - Botão Primário: `PrimaryButton` (amarelo, min-h-[48px]);
   - Botão Secundário: `SecondaryButton` (branco com borda suave, min-h-[44px]);
   - Entradas de Texto: `Input`;
   - Senha: `PasswordInput` com alternância `Eye`/`EyeOff`;
   - OTP: `OtpInput` (8 dígitos, teclado numérico).
3. **Acessibilidade e Estados**: Todo componente interativo deve ter suporte completo a `LOADING`, `EMPTY`, `ERROR`, `SUCCESS` e `DISABLED`, com atributos ARIA e touch targets mínimos de 44px.
