# Product Decisions (MAZZI)

> **REGISTRO HISTÓRICO DE DECISÕES DE PRODUTO**  
> Este documento registra formalmente as decisões de produto estabelecidas na plataforma MAZZI.
> Nenhum agente ou desenvolvedor deve alterar ou contradizer uma decisão sem abrir uma nova entrada `DEC-XXX` aprovada pelo Tech Lead e Product Manager.

---

## DEC-001: Confirmação de Cadastro e Recuperação por OTP de 6 Dígitos
- **Data**: 2026-08-17
- **Status**: `APROVADA & IMPLEMENTADA`
- **Tema**: Autenticação & Experiência do Usuário (Auth)
- **Decisão**: Substituir links longos de e-mail por códigos numéricos OTP de 6 dígitos (`{{ .Token }}`) para confirmação de cadastro e recuperação de senha.
- **Motivo**: Reduz atrito no mobile, evita problemas com clientes de e-mail corporativos que desarmam links e acelera o onboarding.
- **Impacto**: Criação do componente `OtpInput`, novos endpoints no `auth-service.ts` e suporte a cooldown de 45 segundos para reenvio.
- **Relacionado a**: [`MVP_RULES.md`](file:///d:/mazzi_premium_ui_v2/docs/product/MVP_RULES.md), [`AppLogin.tsx`](file:///d:/mazzi_premium_ui_v2/src/components/auth/AppLogin.tsx).

---

## DEC-002: Exigência de CPF Válido e Data de Nascimento (Idade Mínima de 18 Anos)
- **Data**: 2026-08-17
- **Status**: `APROVADA & IMPLEMENTADA`
- **Tema**: Identidade, Compliance e Cadastro do Aluno
- **Decisão**: Tornar o CPF (11 dígitos normalizados, único e matematicamente verificado) e a Data de Nascimento (com idade civil mínima de 18 anos completos) campos obrigatórios no cadastro de novos Alunos.
- **Motivo**: Legislação de trânsito brasileira (CONTRAN) exige que apenas maiores de 18 anos iniciem o processo prático de CNH e garante unicidade de conta por aluno.
- **Impacto**: Migration `20260817000029_add_user_cpf_and_birth_date.sql`, triggers no PostgreSQL, utilitários `cpf.ts` e `age.ts`.
- **Relacionado a**: [`MVP_RULES.md`](file:///d:/mazzi_premium_ui_v2/docs/product/MVP_RULES.md), [`cpf.ts`](file:///d:/mazzi_premium_ui_v2/src/utils/cpf.ts), [`age.ts`](file:///d:/mazzi_premium_ui_v2/src/utils/age.ts).

---

## DEC-003: Consolidação do Horizonte Canônico de Agendamento em 60 Dias
- **Data**: 2026-08-17
- **Status**: `APROVADA & IMPLEMENTADA`
- **Tema**: Agendamento e Disponibilidade
- **Decisão**: Fixar a constante canônica `STUDENT_BOOKING_HORIZON_DAYS = 60` em `src/domain/availability.ts` como fonte única de verdade para toda a plataforma.
- **Motivo**: Eliminar inconsistências entre modal de agendamento, busca e regras de disponibilidade.
- **Impacto**: Busca e modal de slots carregam progressivamente 30 + 30 dias com teto estrito em 60 dias.
- **Relacionado a**: [`availability.ts`](file:///d:/mazzi_premium_ui_v2/src/domain/availability.ts), [`search.ts`](file:///d:/mazzi_premium_ui_v2/src/domain/search.ts), [`SlotSelectorModal.tsx`](file:///d:/mazzi_premium_ui_v2/src/apps/student/components/SlotSelectorModal.tsx).

---

## DEC-004: Matching Estrito em 100% dos Filtros de Busca
- **Data**: 2026-08-17
- **Status**: `APROVADA & IMPLEMENTADA`
- **Tema**: Busca de Prestadores (Search Engine)
- **Decisão**: Nenhum instrutor ou CFC pode aparecer no feed de busca se não atender rigorosamente a todos os filtros selecionados pelo usuário.
- **Motivo**: Evita frustração do aluno ao abrir o card de um prestador que não oferece a categoria, transmissão ou horário desejado.
- **Impacto**: Função `matchingOfferings` e validação estrita em `search.ts`.
- **Relacionado a**: [`MVP_RULES.md`](file:///d:/mazzi_premium_ui_v2/docs/product/MVP_RULES.md), [`search.ts`](file:///d:/mazzi_premium_ui_v2/src/domain/search.ts).

---

## DEC-005: Unidade Monetária Exclusivamente em Centavos Inteiros
- **Data**: 2026-08-14
- **Status**: `APROVADA & IMPLEMENTADA`
- **Tema**: Arquitetura Financeira e Banco de Dados
- **Decisão**: Todos os preços, taxas, comissões, reembolsos e payouts são manipulados e persistidos como números inteiros em centavos (`integer`/`bigint`).
- **Motivo**: Eliminar imprecisões de arredondamento inerentes a números de ponto flutuante (`float`).
- **Impacto**: Tipos de dados no PostgreSQL e módulo `money.ts`.
- **Relacionado a**: [`AGENTS.md`](file:///d:/mazzi_premium_ui_v2/AGENTS.md), [`ARCHITECTURE.md`](file:///d:/mazzi_premium_ui_v2/docs/architecture/ARCHITECTURE.md).

---

## DEC-006: Validação Prévia de E-mail na Recuperação de Senha com CTA de Cadastro
- **Data**: 2026-08-17
- **Status**: `APROVADA & IMPLEMENTADA`
- **Tema**: Autenticação & Onboarding
- **Decisão**: Na tela de recuperação de senha, verificar previamente se o e-mail existe no banco de dados antes de avançar para a digitação de código OTP. Se o e-mail não existir, manter o usuário na tela informando a ausência do cadastro e exibindo botão direto para "Criar minha conta no MAZZI".
- **Motivo**: Melhora a conversão e usabilidade, evitando que novos usuários tentem recuperar senhas de contas inexistentes e fiquem confusos.
- **Impacto**: Migration `20260817000030_check_user_email_exists.sql` e componente `AppLogin.tsx`.
- **Relacionado a**: [`AppLogin.tsx`](file:///d:/mazzi_premium_ui_v2/src/components/auth/AppLogin.tsx), [`auth-service.ts`](file:///d:/mazzi_premium_ui_v2/src/lib/auth-service.ts).

---

## DEC-007: Formulários com Máscaras Progressivas sem Datepicker Nativo e Validação de Nome Completo
- **Data**: 2026-08-17
- **Status**: `APROVADA & IMPLEMENTADA`
- **Tema**: Experiência do Usuário (UI/UX) & Formulários
- **Decisão**: Utilizar campos de texto puro com máscara progressiva para Data de Nascimento (`DD/MM/AAAA`) e Celular (`(00) 00000-0000`), sem abrir o datepicker nativo do sistema operacional. Exigir obrigatoriamente no mínimo 2 termos (nome e sobrenome) no campo de Nome Completo e desativar tooltips nativos do navegador com validação visual inline vermelha (`role="alert"`).
- **Motivo**: Padronização de experiência entre Android, iOS e Desktop, sem comportamentos inesperados de componentes nativos de formulário.
- **Impacto**: Utilitários `phone.ts`, `age.ts` e componente `Input.tsx`.
- **Relacionado a**: [`AppLogin.tsx`](file:///d:/mazzi_premium_ui_v2/src/components/auth/AppLogin.tsx), [`age.ts`](file:///d:/mazzi_premium_ui_v2/src/utils/age.ts), [`phone.ts`](file:///d:/mazzi_premium_ui_v2/src/utils/phone.ts).
