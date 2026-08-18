# QA Report — TASK-002

TASK: TASK-002  
STATUS: QA_APPROVED  
OWNER: MAZZI QA  
LAST_UPDATED: 2026-08-18  

---

# 1. Resumo da Avaliação
O MAZZI QA realizou os testes de validação técnica e de segurança solicitados para o hardening da RPC `update_my_profile` e reconciliação do histórico de migrations no Supabase remoto (`bhvpkgonhlujmxvwnxix`).

---

# 2. Checklist de Validação de Testes QA (Cenários A a N)

| Item | Cenário de Teste QA | Resultado | Observações / Evidência |
|---|---|---|---|
| **A** | Usuário autenticado atualiza `name` | **PASSOU** | Atualização realizada via RPC e salva no PostgreSQL |
| **B** | Usuário autenticado atualiza `phone` | **PASSOU** | Formato de telefone salvo com sucesso |
| **C** | Usuário autenticado atualiza `avatar_url` | **PASSOU** | URL do avatar salva com sucesso |
| **D** | Usuário autenticado atualiza `birth_date` adulta válida (>= 18 anos) | **PASSOU** | Data salva com sucesso no banco |
| **E** | Usuário autenticado tenta `birth_date` menor de 18 anos | **BLOQUEADO** | Bloqueado pelo trigger com erro `MINIMUM_AGE_VIOLATION` |
| **F** | Usuário autenticado tenta `birth_date` futura | **BLOQUEADO** | Bloqueado pelo trigger com erro `BIRTH_DATE_FUTURE` |
| **G** | Mutação direta de `cpf` via UPDATE na tabela `users` | **BLOQUEADO** | Rejeitado por `permission denied` (RLS) / trigger `CPF_IMMUTABLE` |
| **H** | Tentativa de atualizar perfil de outro usuário | **BLOQUEADO** | A RPC utiliza estritamente `auth.uid()`, ignorando IDs de terceiros |
| **I** | Alteração de `role` via RPC | **IMPOSSÍVEL** | A RPC não possui parâmetro de `role` |
| **J** | Alteração de `status` via RPC | **IMPOSSÍVEL** | A RPC não possui parâmetro de `status` |
| **K** | Usuário anônimo (`anon`) chama RPC `update_my_profile` | **NEGADO** | Retorna erro de permissão do PostgreSQL (`permission denied`) |
| **L** | Chamada da assinatura antiga de 2 argumentos (`update_my_profile(text, text)`) | **FALHOU (CORRETO)** | Retorna erro informando que a função não existe no schema |
| **M** | Chamada da assinatura antiga de 3 argumentos (`update_my_profile(text, text, text)`) | **FALHOU (CORRETO)** | Retorna erro informando que a função não existe no schema |
| **N** | Apenas a assinatura canônica de 4 argumentos permanece | **CONFIRMADO** | Confirmado via `pg_proc` no PostgreSQL (`Overloads count: 1`) |

---

# 3. Confirmação SQL da RPC e Grants

- **Assinaturas Existentes**: Exclusivamente `update_my_profile(p_name text, p_phone text, p_avatar_url text, p_birth_date text) RETURNS void`.
- **PUBLIC Execute**: **`NÃO`** (Revogado).
- **anon Execute**: **`NÃO`** (Revogado).
- **authenticated Execute**: **`SIM`** (Concedido).
- **search_path**: **`public, pg_temp`** (Configurado).

---

# 4. Veredito do QA

**STATUS: APROVADO (`QA_APPROVED`)**
