# TASK-008 — PLANO TÉCNICO DE IMPLEMENTAÇÃO (TECH LEAD)

- **TASK**: TASK-008
- **AUTOR**: MAZZI Tech Lead
- **DATA**: 2026-08-18

---

## 1. Arquitetura Backend & Migration 40

### 1.1 `supabase/migrations/20260818000040_restore_slot_contract_and_readonly_availability.sql`

```sql
-- Migration 40: Read-Only Availability Engine & Full Scheduling Contract Restoration
```

1. **`is_offering_slot_available(p_offering_id UUID, p_scheduled_start_at TIMESTAMPTZ)`**:
   - Marcar como `STABLE SECURITY DEFINER` com `SET search_path = public, pg_temp;`.
   - **Remover integralmente qualquer instrução DML (`UPDATE public.bookings`)** para garantir execução 100% READ-ONLY em transações STABLE do PostgREST.
   - Validar:
     - `p_scheduled_start_at > NOW()`
     - Offering: `status = 'ACTIVE'`, `is_active = true`, `instructor_id` NOT NULL, `vehicle_id` NOT NULL, `duration_minutes > 0`.
     - Provider: `status = 'ACTIVE'`.
     - Instructor: `status = 'ACTIVE'`.
     - Vehicle: `status = 'ACTIVE'`, `deleted_at IS NULL`, `provider_id = v_offering.provider_id`.
     - Exceções `BLOCK`: se existir bloqueio em `availability_exceptions`, retornar `FALSE`.
     - Exceções `AVAILABLE_OVERRIDE`: se existir override ativo para o período, validar sobreposição.
     - Recorrência `availabilities`: converter para o fuso horário da disponibilidade (`America/Sao_Paulo`), validar `day_of_week` (DOW ISO 1..7), horário inicial/final e datas efetivas (`effective_from`/`effective_to`). Se não houver regra e nem override, retornar `FALSE`.
     - Alinhamento de Slot: verificar se a hora/minuto respeita o `slot_interval_minutes` da configuração.
     - Colisão de Bookings: verificar reservas ativas (`CONFIRMED`, `IN_PROGRESS` ou `PENDING_PAYMENT` com `hold_expires_at > NOW()`). Ignorar reservas canceladas ou `PENDING_PAYMENT` vencidos (`hold_expires_at <= NOW()`).

2. **`create_quote_from_offering` & `create_booking_hold`**:
   - Inserir o expurgo transacional (Housekeeping de escrita) **ANTES** de verificar disponibilidade e inserir novo hold/quote:
     ```sql
     UPDATE public.bookings
     SET status = 'EXPIRED', expired_at = v_now, updated_at = v_now
     WHERE status = 'PENDING_PAYMENT' AND hold_expires_at <= v_now;
     ```

3. **`get_available_slots_public`**:
   - Manter `STABLE SECURITY DEFINER` com `SET search_path = public, pg_temp;`.
   - Como `is_offering_slot_available` passa a ser estritamente read-only, a chamada via `POST /rest/v1/rpc/get_available_slots_public` retornará **HTTP 200 OK** sem causar o erro PostgreSQL `cannot execute UPDATE in a read-only transaction` (HTTP 405).

---

## 2. Refinamento de UI/UX (UI-UX-PRO-MAX)

### 2.1 Action Footers Transparentes (`bg-transparent`)
- Auditar e remover `bg-white`, `bg-slate-50`, `bg-[var(--mazzi-surface)]`, `border-t border-slate-200` de containers inferiores em:
  - `src/components/ui/Modal.tsx`
  - `src/apps/student/components/StudentSearchFilterDrawer.tsx` / `FilterDrawer.tsx`
  - `src/apps/student/components/BookingDetailsModal.tsx`
  - `src/apps/student/components/CheckoutModal.tsx`
  - `src/apps/provider/ProviderApp.tsx`
- Criar/estandardizar wrapper reutilizável `FloatingActionFooter` em `src/components/ui/FloatingActionFooter.tsx`.

### 2.2 Redesenho UX de Cancelamento
- **Student Details**:
  - Alterar de botões 50/50 lado a lado para pilha vertical em mobile:
    - Primary Action: `[ 💬 Abrir Chat ]` (100% largura).
    - Secondary Action: `[ ✕ Cancelar aula ]` (100% largura, Soft Danger `bg-rose-50 text-rose-700 border border-rose-200`).
- **Student & Provider Cancel Modal**:
  - Destructive Action CTA: `[ Confirmar cancelamento ]` (`bg-rose-600 hover:bg-rose-700 text-white rounded-2xl w-full min-h-[48px] shadow-md`).
  - Safe Action: `Manter minha aula` / `Voltar sem cancelar` (Ghost text button, sem competir visualmente).

---

## 3. Matriz de Testes Backend & Frontend

1. **Testes do Backend / Supabase RPC**:
   - `get_available_slots_public` retorna 200 e dados válidos sem soltar exceção read-only.
   - Domingo 03:17 sem disponibilidade retorna `FALSE`.
   - Segunda 09:00 dentro da agenda retorna `TRUE`.
   - `AVAILABLE_OVERRIDE` sobrepõe agenda base.
   - `BLOCK` anula qualquer disponibilidade.
   - Hold vencido (`hold_expires_at <= NOW()`) é ignorado na leitura e limpo no fluxo de escrita.
   - Horário cancelado fica imediatamente livre para nova reserva com novo ID de tentativa (`checkoutAttemptId`).
2. **Testes do Frontend / UI**:
   - Footers não exibem fundo branco nem placas sólidas.
   - Botões de cancelamento seguem hierarquia vertical no mobile sem 50/50.
