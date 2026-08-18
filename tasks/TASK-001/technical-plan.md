# Technical Plan — TASK-001

TASK: TASK-001  
STATUS: TECH_READY  
OWNER: MAZZI Tech Lead  
LAST_UPDATED: 2026-08-18  

---

# 1. Resumo Técnico
Este plano estabelece a arquitetura e a estratégia de execução para garantir a obrigatoriedade de **CPF válido** e **Data de Nascimento válida (idade >= 18 anos)** para a role `STUDENT`, mantendo o CPF imutável e tornando a Data de Nascimento editável pelo aluno no seu perfil.

Será criada uma nova migration sequencial `20260818000031_student_identity_mandatory_and_editable_birth_date.sql` que:
1. Realiza o backfill das 10 contas de demonstração `STUDENT DEMO` com CPFs sintéticos (11 dígitos, matematicamente válidos, únicos) e datas de nascimento sintéticas (idades de 25 a 45 anos).
2. Adiciona/fortalece a restrição atômica no banco via trigger/constraint para garantir que nenhum usuário `STUDENT` possa existir ou ser criado sem `cpf` válido e `birth_date` com idade >= 18 anos.
3. Atualiza a RPC `public.update_my_profile` para aceitar `p_birth_date` (além de `p_name`, `p_phone`, `p_avatar_url`), derivando o usuário exclusivamente de `auth.uid()` e validando a idade civil >= 18 anos no banco.
4. Mantém a imutabilidade do campo `cpf` contra edições pelo próprio usuário no banco e no frontend.

---

# 2. Matriz de Auditoria dos Usuários Existentes

| Email | Role | Tipo | CPF Atual | Birth Date | Ação Necessária |
|---|---|---|---|---|---|
| `aluno01@mazzi.com.br` | `STUDENT` | DEMO | NULL | NULL | Backfill com CPF sintético + Data sintética |
| `aluno02@mazzi.com.br` | `STUDENT` | DEMO | NULL | NULL | Backfill com CPF sintético + Data sintética |
| `aluno03@mazzi.com.br` | `STUDENT` | DEMO | NULL | NULL | Backfill com CPF sintético + Data sintética |
| `aluno04@mazzi.com.br` | `STUDENT` | DEMO | NULL | NULL | Backfill com CPF sintético + Data sintética |
| `aluno05@mazzi.com.br` | `STUDENT` | DEMO | NULL | NULL | Backfill com CPF sintético + Data sintética |
| `aluno06@mazzi.com.br` | `STUDENT` | DEMO | NULL | NULL | Backfill com CPF sintético + Data sintética |
| `aluno07@mazzi.com.br` | `STUDENT` | DEMO | NULL | NULL | Backfill com CPF sintético + Data sintética |
| `aluno08@mazzi.com.br` | `STUDENT` | DEMO | NULL | NULL | Backfill com CPF sintético + Data sintética |
| `aluno09@mazzi.com.br` | `STUDENT` | DEMO | NULL | NULL | Backfill com CPF sintético + Data sintética |
| `aluno10@mazzi.com.br` | `STUDENT` | DEMO | NULL | NULL | Backfill com CPF sintético + Data sintética |
| `instrutor01..08` | `INSTRUCTOR` | DEMO | NULL | NULL | Nenhuma (Role não-STUDENT) |
| `autoescola01..02` | `SCHOOL_ADMIN` | DEMO | NULL | NULL | Nenhuma (Role não-STUDENT) |
| `admin@mazzi.com.br` | `PLATFORM_ADMIN` | DEMO | NULL | NULL | Nenhuma (Role não-STUDENT) |

*Nota*: Não existem alunos reais incompletos no ambiente atual.

---

# 3. Gerador de CPFs Sintéticos Válidos (Algoritmo Determinístico)
Para as 10 contas `STUDENT DEMO`, os CPFs sintéticos serão gerados usando o algoritmo oficial de dígitos verificadores do CPF (módulo 11) com a raiz `529.XXX.XXX-DV` reservada para testes:
- `aluno01@mazzi.com.br`: `529100000` -> DV `40` -> `52910000040`
- `aluno02@mazzi.com.br`: `529200000` -> DV `03` -> `52920000003`
- `aluno03@mazzi.com.br`: `529300000` -> DV `77` -> `52930000077`
- `aluno04@mazzi.com.br`: `529400000` -> DV `40` -> `52940000040`
- `aluno05@mazzi.com.br`: `529500000` -> DV `14` -> `52950000014`
- `aluno06@mazzi.com.br`: `529600000` -> DV `88` -> `52960000088`
- `aluno07@mazzi.com.br`: `529700000` -> DV `51` -> `52970000051`
- `aluno08@mazzi.com.br`: `529800000` -> DV `25` -> `52980000025`
- `aluno09@mazzi.com.br`: `529900000` -> DV `99` -> `52990000099`
- `aluno10@mazzi.com.br`: `529110000` -> DV `86` -> `52911000086`

Datas de Nascimento Sintéticas Determinísticas:
- `aluno01`: `1995-05-15` (31 anos)
- `aluno02`: `1998-08-20` (28 anos)
- `aluno03`: `1992-03-10` (34 anos)
- `aluno04`: `1996-11-25` (29 anos)
- `aluno05`: `1990-01-05` (36 anos)
- `aluno06`: `1997-07-12` (29 anos)
- `aluno07`: `1994-09-18` (31 anos)
- `aluno08`: `1999-12-30` (26 anos)
- `aluno09`: `1991-04-22` (35 anos)
- `aluno10`: `1993-06-08` (33 anos)

---

# 4. Arquivos Afetados

- **[NEW]** [`supabase/migrations/20260818000031_student_identity_mandatory_and_editable_birth_date.sql`](file:///d:/mazzi_premium_ui_v2/supabase/migrations/20260818000031_student_identity_mandatory_and_editable_birth_date.sql)
- **[NEW]** [`scripts/apply-student-identity-migration.ts`](file:///d:/mazzi_premium_ui_v2/scripts/apply-student-identity-migration.ts)
- **[MODIFY]** [`src/lib/db-service.ts`](file:///d:/mazzi_premium_ui_v2/src/lib/db-service.ts)
- **[MODIFY]** [`src/apps/student/StudentApp.tsx`](file:///d:/mazzi_premium_ui_v2/src/apps/student/StudentApp.tsx)
- **[MODIFY]** [`docs/product/PRODUCT_DECISIONS.md`](file:///d:/mazzi_premium_ui_v2/docs/product/PRODUCT_DECISIONS.md)
- **[MODIFY]** [`docs/product/MVP_RULES.md`](file:///d:/mazzi_premium_ui_v2/docs/product/MVP_RULES.md)
- **[MODIFY]** [`docs/architecture/SECURITY_RULES.md`](file:///d:/mazzi_premium_ui_v2/docs/architecture/SECURITY_RULES.md)
- **[NEW]** [`tests/student-identity-and-profile.test.ts`](file:///d:/mazzi_premium_ui_v2/tests/student-identity-and-profile.test.ts)

---

# 5. Estratégia de Implementação (Passo a Passo)

1. **Migration PostgreSQL**:
   - Backfill seguro dos 10 `STUDENT DEMO` com os CPFs sintéticos válidos e `birth_date` sintéticas.
   - Atualizar a função e trigger de validação `trg_validate_users_identity`:
     - Se `role = 'STUDENT'`: `cpf` e `birth_date` não podem ser `NULL`.
     - Validar CPF via algoritmo oficial de dois dígitos (módulo 11).
     - Validar `birth_date` (`birth_date <= CURRENT_DATE` AND `age >= 18`).
     - Se `OLD.cpf IS NOT NULL` e `NEW.cpf <> OLD.cpf`: lançar exceção "O CPF não pode ser alterado.".
   - Atualizar a RPC `public.update_my_profile`:
     - Assinatura: `update_my_profile(p_name text, p_phone text, p_avatar_url text, p_birth_date text DEFAULT NULL)`
     - Derivar `v_user_id = auth.uid()`.
     - Se o usuário for `STUDENT` e `p_birth_date` for fornecido: validar civilmente e verificar idade >= 18 anos.
     - Atualizar `name`, `phone`, `avatar_url` e `birth_date` (se não for `NULL`).

2. **Aplicação Remota e Testes**:
   - Executar `scripts/apply-student-identity-migration.ts` contra o banco Supabase remoto.

3. **Atualização do Frontend**:
   - Atualizar `dbService.updateMyProfile` em `src/lib/db-service.ts` para enviar `p_birth_date`.
   - Atualizar a tela de Perfil em `StudentApp.tsx`:
     - Exibir CPF mascarado: `***.***.***-XX` (desabilitado/read-only).
     - Exibir Data de Nascimento formatada `DD/MM/AAAA`.
     - No modo "Editar perfil", habilitar o campo Data de Nascimento com máscara `DD/MM/AAAA`.
     - Em caso de cancelamento, restaurar a data original.
     - Em caso de salvar, chamar `updateMyProfile`, atualizar estado e exibir feedback.

4. **Testes Unitários & Integração Real**:
   - Criar `tests/student-identity-and-profile.test.ts` cobrindo todas as regras.
   - Testar login e update de perfil real com conta demo `aluno01@mazzi.com.br`.

5. **Portões de Qualidade**:
   - `npm run lint`, `npm test`, `npm run build:all`.

---

# 6. Instruções para o MAZZI Dev
- Siga estritamente as regras de imutabilidade do CPF e validação de idade >= 18 anos.
- Utilize a skill `ui-ux-pro-max` para os ajustes visuais no Perfil do Aluno.
- Não exiba CPFs completos em logs ou relatórios.
