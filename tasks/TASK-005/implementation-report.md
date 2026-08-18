# TASK-005 — Relatório de Implementação, Segurança e Correção de Regressões

**Data**: 2026-08-18  
**Autor**: MAZZI Engineering Team  
**Status**: **`DONE`**  

---

## 1. Resumo das Correções Efetuadas

### A. Diagnóstico e Resolução do Login Rápido DEV ("Credenciais Inválidas")
- **Causa Raiz Técnica**:
  Em [`src/components/auth/dev/DevQuickLogin.tsx`](../../src/components/auth/dev/DevQuickLogin.tsx), a função `getDemoPasswordForAccount` acessava `import.meta.env` diretamente. Em ambientes Node / Vite HMR, o acesso direto a `import.meta.env` gerava `undefined` ou lia senhas contendo aspas duplas envolventes (ex: `"MzZ!Stu..."`). Ao enviar essas aspas para a Supabase Auth remota, o servidor rejeitava a autenticação com "Invalid login credentials".
- **Correção Efetuada**:
  Substituída a leitura direta pelo helper seguro `getRuntimeEnvValue(key)` de [`src/lib/runtime-env.ts`](../../src/lib/runtime-env.ts) e adicionada a higienização explícita de aspas e whitespace (`pass.replace(/^"|"$/g, '').trim()`).
- **Validação com Autenticação Real Remota**:
  **21 de 21 contas demo autenticadas com sucesso absoluto no Supabase remoto**:
  - 10 contas `STUDENT`: **`[OK]`**
  - 8 contas `INSTRUCTOR`: **`[OK]`**
  - 2 contas `SCHOOL_ADMIN`: **`[OK]`**
  - 1 conta `PLATFORM_ADMIN`: **`[OK]`**

### B. Diagnóstico e Resolução da Data de Nascimento (`19/92/0312` → `12/03/1992`)
- **Causa Raiz Técnica**:
  A função `formatDateMask(value)` em [`src/utils/age.ts`](../../src/utils/age.ts) removia cegamente caracteres não numéricos (`value.replace(/\D/g, '')`) antes de aplicar o fatiamento de dígitos. Ao receber a string ISO do banco de dados (ex: `1992-03-12`), ela convertia a string para `19920312` e a fatiava como `19/92/0312`.
- **Correção Efetuada**:
  Atualizada a função `formatDateMask` em [`src/utils/age.ts`](../../src/utils/age.ts) e criada a função `formatBirthDateForDisplay(value)` para interpretar semanticamente a data civil via `parseCivilDate(value)`.
  - Entradas ISO (`1992-03-12`) são parseadas semanticamente como ano 1992, mês 03, dia 12 e formatadas como `12/03/1992`.
  - Entradas nulas/vazias retornam o fallback seguro `'Não informada'`.
  - Entradas em edição continuam em formato ISO (`YYYY-MM-DD`) para compatibilidade com `<input type="date">` do HTML5.

### C. Manutenção do Hardening de Segurança (Migration 37)
- Ordem de autorização mantida: **AUTHORIZATION BEFORE IDEMPOTENCY**.
- Rejeição estrita a status diferentes de `CONFIRMED` e aulas já iniciadas/passadas.

---

## 2. Matriz Ledger de Migrations Reconciliada no Supabase Remote

| Version | Migration Name | Status Ledger |
|---|---|---|
| `20260818000034` | `cancellation_flow_and_rpc` | **`CONFIRMED`** |
| `20260818000035` | `fix_cancellation_rpc_security_and_contract` | **`CONFIRMED`** |
| `20260818000036` | `fix_school_cancellation_authorization` | **`CONFIRMED`** |
| `20260818000037` | `fix_cancellation_authorization_order` | **`CONFIRMED`** |

---

## 3. Higiene de Credenciais

- **`.env.local`**: **`IGNORED`** em `.gitignore` (`git check-ignore` OK) e não rastreado no Git (`git ls-files` VAZIO).
- **Secrets no Git HEAD**: **0 passwords ou connection strings**.
