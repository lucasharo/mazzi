# Requirement — TASK-001

TASK: TASK-001  
STATUS: PRODUCT_READY  
OWNER: MAZZI Product  
LAST_UPDATED: 2026-08-18  

---

# 1. Objetivo
Reformular e fortalecer o modelo de **Identidade do Aluno** no MAZZI, eliminando a permissão legacy de alunos ativos com `cpf = NULL` ou `birth_date = NULL`. A partir desta entrega, todo usuário `STUDENT` deve obrigatoriamente possuir CPF válido e Data de Nascimento válida (idade civil >= 18 anos completos). As contas de demonstração (`STUDENT DEMO`) sem dados completos devem ser atualizadas com dados sintéticos/fictícios matematicamente válidos e únicos. Além disso, a Data de Nascimento passa a ser **editável** no Perfil do Aluno com validações estritas no banco e no frontend, enquanto o CPF permanece **estritamente imutável** e exibido apenas mascarado (`***.***.***-XX`).

---

# 2. Problema
Anteriormente, os campos `cpf` e `birth_date` na tabela `public.users` foram configurados como `NULLABLE` por compatibilidade com contas legadas. Isso permitia a existência de alunos sem verificação completa de idade civil e sem chave de unicidade por CPF. Adicionalmente, a regra anterior impedia a alteração da data de nascimento em caso de correção pelo próprio aluno.

---

# 3. Usuários Afetados
- `STUDENT` (Alunos da plataforma MAZZI).

---

# 4. Escopo (In-Scope)
- **Obrigatoriedade no Banco & Aplicação**: Garantir via triggers, RLS e constraints do PostgreSQL que nenhum novo `STUDENT` possa ser criado ou ativado sem `cpf` válido e `birth_date` válida (idade >= 18 anos).
- **Backfill Sintético das Contas DEMO**: Atualizar as contas de demonstração (`STUDENT DEMO`) que não possuem CPF/data de nascimento com CPFs fictícios sintéticos (11 dígitos, matematicamente válidos, únicos) e datas de nascimento sintéticas (idade >= 18 anos completos).
- **Tratamento de Alunos Reais**: Se existirem alunos reais incompletos, não gerar dados falsos; registrar auditoria.
- **CPF Imutável & Mascarado no Perfil**: Manter o CPF estritamente imutável para o usuário comum e exibi-lo no Perfil do Aluno exclusivamente na forma mascarada (`***.***.***-XX`), sem botão de alteração.
- **Data de Nascimento Editável no Perfil**: Permitir que o próprio aluno atualize sua data de nascimento via Perfil (`DD/MM/AAAA`), sujeita a validação visual/inline no frontend (`validateBirthDate`) e validação atômica no banco de dados (rejeitando datas futuras, datas civis inválidas e menores de 18 anos).
- **RPC `update_my_profile` Atualizada**: Atualizar a função PostgreSQL segura `update_my_profile` para aceitar `p_birth_date`, derivando o usuário autenticado de `auth.uid()` sem aceitar parâmetros de `cpf`, `role` ou `user_id`.

---

# 5. Fora de Escopo (Out-of-Scope)
- Alteração do fluxo de verificação OTP por e-mail no cadastro ou login.
- Edição de CPF pelo próprio aluno.
- Atribuição de dados fictícios a contas de usuários reais.
- Alterações em módulos de busca, agendamento, veículos, pagamentos ou portais de Instrutor/Admin.

---

# 6. Regras de Negócio Mandatórias
1. **Contrato de Identidade do Aluno**:
   - `IF role = 'STUDENT'` -> `cpf IS NOT NULL AND birth_date IS NOT NULL AND isValidCpf(cpf) = TRUE AND age(birth_date) >= 18`.
2. **Imutabilidade do CPF**:
   - O campo `cpf` não pode ser modificado por atualizações realizadas pelo próprio usuário (`STUDENT`).
3. **Data de Nascimento Editável**:
   - A data de nascimento pode ser editada pelo próprio aluno via Perfil, mas a atualização só é persistida se for uma data civil válida, não futura e resultando em idade civil >= 18 anos completos na data atual.
4. **Mascaramento de CPF**:
   - O CPF nunca deve ser exibido por completo no aplicativo do aluno. Formato obrigatório: `***.***.***-XX`.
5. **Segurança RPC**:
   - A RPC `update_my_profile` é a única via de atualização de perfil do usuário comum, identificando o usuário exclusivamente por `auth.uid()`.

---

# 7. Fluxo Principal (Happy Path)
1. Aluno navega até a aba **Perfil** no App do Aluno.
2. Na seção "Dados do perfil", visualiza seu Nome, Telefone, E-mail, CPF mascarado (`***.***.***-XX`) e Data de Nascimento formatada (`DD/MM/AAAA`).
3. Clica em "Editar perfil":
   - Os campos Nome, Telefone, Foto e Data de Nascimento ficam editáveis.
   - O campo CPF permanece desabilitado/read-only com a indicação "CPF não pode ser alterado pelo aplicativo".
4. O aluno altera a Data de Nascimento (usando máscara `DD/MM/AAAA`) e clica em "Salvar perfil".
5. O aplicativo valida a idade (>= 18 anos), chama `dbService.updateMyProfile` e persiste a data via RPC no banco.
6. A interface exibe mensagem de sucesso e restaura a visualização com os dados atualizados.

---

# 8. Casos de Borda e Exceções
- **Tentativa de Inserir Data de Menor de 18 Anos**: Exibe erro inline no frontend ("Você precisa ter pelo menos 18 anos completos.") e o banco de dados rejeita a alteração caso o payload seja forçado via API.
- **Cancelar Edição**: Restaura os valores originais de Nome, Telefone, Foto e Data de Nascimento sem salvar nada.
- **Tentativa de Alteração Direta do CPF por API**: O PostgreSQL (trigger / RPC) rejeita o comando lançando exceção de segurança.

---

# 9. Critérios de Aceite

- **AC01**: Todo cadastro de novo `STUDENT` exige obrigatoriamente CPF válido e Data de Nascimento com idade >= 18 anos.
- **AC02**: Todas as contas `STUDENT DEMO` existentes sem identidade são atualizadas via migration com CPFs sintéticos (11 dígitos, matematicamente válidos, únicos) e datas de nascimento com idade >= 18 anos.
- **AC03**: Nenhuma conta de usuário real recebe dados sintéticos/fictícios.
- **AC04**: O CPF do `STUDENT` permanece imutável e protegido contra alterações pelo próprio usuário no banco e no frontend.
- **AC05**: O CPF é exibido no Perfil do Aluno exclusivamente mascarado no formato `***.***.***-XX`.
- **AC06**: A Data de Nascimento é exibida no Perfil e torna-se editável ao clicar em "Editar perfil", utilizando a máscara `DD/MM/AAAA`.
- **AC07**: A alteração da Data de Nascimento valida no frontend e no banco que a data é civilmente válida, não futura e que a idade resultante é >= 18 anos.
- **AC08**: A RPC `update_my_profile` atualiza `name`, `phone`, `avatar_url` e `birth_date` para o usuário derivado de `auth.uid()`, sem aceitar parâmetros de `cpf` ou `role`.

---

# 10. Dependências
- Migration `20260817000029_add_user_cpf_and_birth_date.sql` (schema base).
- Utilitários [`src/utils/cpf.ts`](file:///d:/mazzi_premium_ui_v2/src/utils/cpf.ts) e [`src/utils/age.ts`](file:///d:/mazzi_premium_ui_v2/src/utils/age.ts).

---

# 11. Handoff para Tech Lead
Requisitos prontos para planejamento técnico pelo **MAZZI Tech Lead**.
