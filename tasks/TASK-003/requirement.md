# TASK-003 — Requisito de Produto: Recuperação de Senha sem Enumeração de Contas

**Versão**: 1.0  
**Data**: 2026-08-18  
**Autor**: MAZZI Product Team  
**Status**: `APROVADO`

---

## 1. Contexto e Problema

Anteriormente, o sistema realizava um pre-check de existência do e-mail via RPC `check_user_email_exists` antes de enviar o código de recuperação de senha. Isso exibia mensagens como *"Este e-mail não está cadastrado no MAZZI"*, permitindo a atacantes descobrirem quais e-mails possuem conta cadastrada na plataforma (Enumeração de Contas por E-mail).

---

## 2. Decisão de Produto (DEC-011)

1. **Anti-Enumeração Obrigatória**: O fluxo de recuperação de senha NÃO deve revelar se um e-mail possui ou não uma conta cadastrada.
2. **Resposta Pública Canônica**: Para qualquer e-mail sintaticamente válido submetido na tela de recuperação, a plataforma deve exibir rigorosamente a mesma mensagem de sucesso:
   > *"Se existir uma conta associada a este e-mail, enviaremos um código de recuperação."*
3. **Desativação do Pre-Check**: O frontend deve acionar diretamente a chamada de reset (`resetPasswordForEmail`) sem consultar previamente se a conta existe.
4. **Remoção da RPC**: A RPC `check_user_email_exists(text)` deve ser removida do Supabase remoto e o client `auth-service` não deve expor APIs mortas de consulta.

---

## 3. Critérios de Aceite (AC)

- **`AC01`**: Para um e-mail cadastrado (ex: `aluno01@mazzi.com.br`), a tela de recuperação exibe a mensagem pública canônica e navega para a tela de OTP.
- **`AC02`**: Para um e-mail não cadastrado (ex: `inexistente_99@mazzi.com.br`), a tela de recuperação exibe **exatamente a mesma mensagem pública canônica** e navega para a tela de OTP, sem revelar a inexistência.
- **`AC03`**: Formatos de e-mail sintaticamente inválidos (ex: `email_sem_arroba`) continuam sendo validados e bloqueados localmente antes da submissão.
- **`AC04`**: A RPC `check_user_email_exists` é removida do Supabase e chamadas via client anon/authenticated retornam erro de função não encontrada.
- **`AC05`**: As funcionalidades de login rápido em ambiente de desenvolvimento (`DevQuickLogin` e `demo-accounts.ts`) e o fluxo de OTP de signup/recovery permanecem 100% funcionais.
