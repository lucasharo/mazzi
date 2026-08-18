# TASK-004 — Relatório de Garantia da Qualidade (QA): Hardening do Login Rápido DEV

**Versão**: 1.0  
**Data**: 2026-08-18  
**Autor**: MAZZI QA Team  
**Status**: `APROVADO`

---

## 1. Matriz de Validação de QA

| ID | Item de Teste | Resultado | Observações |
|---|---|---|---|
| `QA-01` | DevQuickLogin e lista de contas preservados | `PASS` | Componente e 21 contas de teste permanecem disponíveis em DEV |
| `QA-02` | Busca por passwords hardcoded no repositório versionado | `PASS` | Zero senhas funcionais encontradas no Git |
| `QA-03` | Verificação do arquivo `.env.local` | `PASS` | Confirmado como ignorado (`git check-ignore .env.local`) |
| `QA-04` | Produção (`import.meta.env.DEV === false`) | `PASS` | DevQuickLogin não é renderizado |
| `QA-05` | DEV sem flag (`VITE_ENABLE_DEV_QUICK_LOGIN="false"`) | `PASS` | DevQuickLogin não é renderizado |
| `QA-06` | DEV com flag (`VITE_ENABLE_DEV_QUICK_LOGIN="true"`) | `PASS` | DevQuickLogin renderizado e funcional |
| `QA-07` | Login Student Demo (`aluno01@mazzi.com.br`) | `PASS` | Autenticado via `VITE_DEV_QUICK_LOGIN_STUDENT_PASSWORD` |
| `QA-08` | Login Instructor Demo (`instrutor01@mazzi.com.br`) | `PASS` | Autenticado via `VITE_DEV_QUICK_LOGIN_INSTRUCTOR_PASSWORD` |
| `QA-09` | Login School Demo (`autoescola01@mazzi.com.br`) | `PASS` | Autenticado via `VITE_DEV_QUICK_LOGIN_SCHOOL_PASSWORD` |
| `QA-10` | Login Admin Demo (`admin@mazzi.com.br`) | `PASS` | Autenticado via `VITE_DEV_QUICK_LOGIN_ADMIN_PASSWORD` (Isolado) |
| `QA-11` | Invalidação das senhas antigas (`[REDACTED_INVALIDATED_CREDENTIAL]`) | `PASS` | Tentativa de login com senha antiga é **REJEITADA** |
| `QA-12` | Scripts de upload de avatar e atualização de perfil | `PASS` | Executam login com credencial local sem mutar senha no banco |

---

## 2. Veredito do QA

- **Parecer**: `APROVADO` (Pronto para homologação final do Tech Lead).
