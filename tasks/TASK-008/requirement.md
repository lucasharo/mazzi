# TASK-008 — ESPECIFICAÇÃO DE REQUISITOS (PRODUCT)

- **TASK**: TASK-008
- **PRODUTO**: Plataforma MAZZI (Student & Provider Apps)
- **AUTOR**: MAZZI Product Manager
- **DATA**: 2026-08-18

---

## 1. Objetivos do Produto

1. **Resolver Erro HTTP 405 na Consulta Pública de Slots (`get_available_slots_public`)**:
   - Garantir que a rota de consulta pública de horários seja estritamente READ-ONLY (sem escritas `UPDATE` no banco durante leituras).
2. **Restaurar Contrato Completo de Agendamento em `is_offering_slot_available`**:
   - Eliminar a regressão introduzida na Migration 39 que tornava horários sem agenda cadastrada (ex: domingo 03:17) disponíveis.
   - Reaplicar validação de regras recorrentes (`availabilities`), exceções (`BLOCK` e `AVAILABLE_OVERRIDE`), alinhamento de slot (`slot_interval_minutes`), horizonte de agendamento e status ativo de prestador, instrutor e veículo.
3. **Preservar Arquitetura de Quotes e Idempotência Comercial**:
   - Manter id da tentativa (`checkoutAttemptId`), idempotência por tentativa, `QUOTE_IDEMPOTENCY_KEY_STALE`, expiração de quotes consumidas e remarcação imediata do mesmo horário após cancelamento.
4. **Redesenho UX dos Modais e Botões de Cancelamento (Student & Provider)**:
   - Eliminar botões 50/50 lado a lado para ações destrutivas.
   - Criar botões de gatilho "Soft Danger" (rose sutil em primeiro nível) e CTAs de confirmação destrutivos em destaque (vermelho sólido full-width `min-height >= 48px`).
   - Botão de descarte/manutenção com peso visual ghost/outline para evitar competição visual.
5. **Padrão Global de Action Footers / Floating Bottom CTAs (UI-UX-PRO-MAX)**:
   - Remover placas/cards/fundo branco atrás dos botões de ação inferiores no Student e Provider.
   - Aplicar `bg-transparent` em todos os action footers, fazendo os botões (com sombra suave e border-radius premium) parecerem flutuar organicamente sobre o conteúdo.

---

## 2. Regras Inegociáveis de Publicação / Versionamento

> [!CAUTION]
> **REGRAS DE BRANCH E DEPLOY**:
> - NÃO fazer merge nem push para `main`.
> - NÃO publicar os apps (`mazzi-student`, `mazzi-pro`, `mazzi-admin`).
> - NÃO disparar deploy do GitHub Pages.
> - NÃO aplicar a Migration 40 no Supabase LIVE durante esta execução sem autorização prévia.
> - Trabalhar exclusivamente na branch local `premium_ui_v2`.
> - Status de entrega ao final: **`TASK-008 IMPLEMENTATION READY FOR REVIEW`**.
