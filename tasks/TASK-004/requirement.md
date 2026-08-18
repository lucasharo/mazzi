# TASK-004 — Requisito de Produto: Hardening do Login Rápido DEV (Preservação e Segurança)

**Versão**: 1.0  
**Data**: 2026-08-18  
**Autor**: MAZZI Product Team  
**Status**: `APROVADO`

---

## 1. Contexto e Objetivo

O componente de **Login Rápido DEV** (`DevQuickLogin.tsx`) e a lista de contas demonstrativas (`demo-accounts.ts`) são fundamentais para a produtividade do time durante os testes da plataforma MAZZI. No entanto, senhas hardcoded estavam expostas no código-fonte versionado.

O objetivo desta TASK é endurecer a segurança dessas credenciais sem remover ou degradar a usabilidade do Login Rápido.

---

## 2. Decisão de Produto (DEC-012)

1. **Preservação do Login Rápido**: A lista de contas demo, os botões e a funcionalidade continuam existindo integralmente. Nenhuma conta demo é deletada.
2. **Remoção de Senhas Versionadas**: Zero passwords ou segredos podem permanecer no código versionado ou no Git.
3. **Resolução via Variáveis de Ambiente Locais**: As senhas são lidas exclusivamente de `.env.local` e separadas por role (`STUDENT`, `INSTRUCTOR`, `SCHOOL`, `PLATFORM_ADMIN`).
4. **Isolamento de Admin**: A conta `PLATFORM_ADMIN` possui credencial própria e isolada dos alunos e instrutores.
5. **Ativação por Flag**: Disponível apenas em ambiente `DEV` com a flag `VITE_ENABLE_DEV_QUICK_LOGIN="true"`.
