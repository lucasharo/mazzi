# TASK-004 — Plano Técnico de Engenharia: Hardening do Login Rápido DEV

**Versão**: 1.0  
**Data**: 2026-08-18  
**Autor**: MAZZI Tech Lead  
**Status**: `APROVADO`

---

## 1. Estratégia Técnica

1. **Remoção da Constante de Senha**: Eliminar `DEV_QUICK_LOGIN_PASSWORD` de `src/components/auth/dev/demo-accounts.ts`.
2. **Resolução Dinâmica por Role**: Implementar `getDemoPasswordForAccount` em `src/components/auth/dev/DevQuickLogin.tsx` lendo as variáveis:
   - `VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD`
   - `VITE_DEV_QUICK_LOGIN_INSTRUCTOR_PASSWORD`
   - `VITE_DEV_QUICK_LOGIN_SCHOOL_PASSWORD`
   - `VITE_DEV_QUICK_LOGIN_ADMIN_PASSWORD`
3. **Validação de Credencial Ausente**: Se a variável não estiver definida ao tentar autenticar, abortar e exibir mensagem DEV amigável (`"Credencial local de desenvolvimento não configurada."`).
4. **Rotação Remota de Senhas no Supabase Auth**: Gerar 4 senhas crypto-random distintas e atualizar remotamente todas as 21 contas demo via Supabase Admin API (`updateUserById`), atualizando `.env.local`.
5. **Correção de Scripts**: Atualizar `scripts/test-real-avatar-upload.ts` e `scripts/test-real-supabase-profile-update.ts` para utilizar `VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD` sem mutar senhas no banco.
6. **Invalidação das Senhas Antigas**: Confirmar que a credencial anterior `[REDACTED_INVALIDATED_CREDENTIAL]` é REJEITADA em tentativas de login.
