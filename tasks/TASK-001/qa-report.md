# QA Report — TASK-001

TASK: TASK-001  
STATUS: QA_APPROVED  
OWNER: MAZZI QA  
LAST_UPDATED: 2026-08-18  

---

# 1. Resumo da Avaliação
O MAZZI QA realizou uma auditoria técnica e funcional completa das alterações do modelo de **Identidade do Aluno** e **Edição de Data de Nascimento no Perfil**.
Todas as verificações de obrigatoriedade, validação matemática do CPF, imutabilidade do CPF, edição de data de nascimento (idade civil >= 18 anos), segurança de RLS/RPC e ausência de exposição de CPFs foram aprovadas sem ressalvas.

---

# 2. Checklist de Validação dos Critérios de Aceite

| ID | Critério de Aceite | Resultado | Observações |
|---|---|---|---|
| **AC01** | Obrigatoriedade de CPF e Data de Nascimento para novos `STUDENT` | **APROVADO** | Testado via trigger PostgreSQL e RLS policy |
| **AC02** | Backfill das contas DEMO com CPFs sintéticos válidos e únicos (idade >= 18) | **APROVADO** | 10 contas de alunos demo atualizadas e verificadas no Supabase |
| **AC03** | Preservação das contas de usuários reais sem atribuição de dados falsos | **APROVADO** | Confirmado que 0 contas reais foram afetadas |
| **AC04** | Imutabilidade do CPF para a role `STUDENT` | **APROVADO** | Tentativas de alteração via UPDATE ou RPC são bloqueadas no banco |
| **AC05** | CPF exibido exclusivamente mascarado (`***.***.***-XX`) | **APROVADO** | Confirmado visualmente e no código em `StudentApp.tsx` |
| **AC06** | Data de Nascimento editável no Perfil com máscara `DD/MM/AAAA` | **APROVADO** | Campo editável com formatação em tempo real no frontend |
| **AC07** | Validação da Data de Nascimento (não futura, civilmente válida, idade >= 18) | **APROVADO** | Rejeição validada no React e no trigger do banco com a exceção `MINIMUM_AGE_VIOLATION` |
| **AC08** | RPC `update_my_profile` segura e isolada por `auth.uid()` | **APROVADO** | A RPC não aceita `p_user_id` nem parâmetros de `cpf`/`role` |

---

# 3. Testes Funcionais e de Segurança Executados

1. **Validação do CPF Sintético**:
   - Algoritmo de 2 dígitos verificadores (módulo 11) validado para todas as 10 contas demo.
   - Unicidade das 10 contas confirmada (`Set.size === 10`).

2. **Testes de Invasão / Mutação Direta**:
   - Tentativa de enviar `cpf` alterado via `update_my_profile`: A RPC não aceita o parâmetro.
   - Tentativa de enviar data de nascimento de menor de 18 anos (`2020-01-01`): O banco lança a exceção `MINIMUM_AGE_VIOLATION`.

3. **Restauração e Cancelamento de Edição**:
   - Ao clicar em "Cancelar" no Perfil, o estado de `profileBirthDate` é restaurado para o valor original sem efetuar chamadas ao banco.

4. **Portões de Qualidade**:
   - Lint (`tsc --noEmit`): 0 erros.
   - Testes Automatizados: 377/377 aprovados.
   - Build: `student`, `instructor`, `admin` 100% OK.

---

# 4. Veredito do QA

**STATUS: APROVADO (`QA_APPROVED`)**
