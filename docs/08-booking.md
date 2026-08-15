# 08 — Ciclo de Vida do Booking e Concorrência Temporal (Sprint 08)

## 1. Visão Geral da Arquitetura de Reservas MAZZI

A plataforma MAZZI separa rigidamente a fase de **Cotação Comercial (`Quote`)** da fase de **Reserva Transacional de Calendário (`Booking Hold`)**.

- **`Quote` (Cotação Comercial)**: Concongela preços, taxas e dados operacionais de uma aula por 10 minutos. **NÃO reserva horário na agenda**.
- **`Booking Hold` (Reserva Transacional)**: Valida a proposta, executa a limpeza de holds expirados e insere uma reserva temporária no status `PENDING_PAYMENT` com trava atômica `TSTZRANGE` e restrições de exclusão no PostgreSQL (`EXCLUDE USING gist`).

---

## 2. Máquina de Estados do Quote e do Booking

### Máquina de Estados do Quote (`quote_status`)
```
[ACTIVE] ------ (Passaram 10 min) ------> [EXPIRED]
   |
(Consumido via Booking Hold)
   v
[CONSUMED] (Bloqueado contra reuso)
   |
(Cancelado manualmente)
   v
[CANCELLED]
```

### Máquina de Estados do Booking (`booking_status`)
```
[PENDING_PAYMENT] -------- (Passaram 10 min de Hold sem Pix/Cartão) -------> [EXPIRED]
   |
   +---------------------- (Falha de Pagamento) --------------------------> [PAYMENT_FAILED]
   |
(Webhook do Gateway de Pagamento assinado)
   v
[CONFIRMED]
   |
(Check-in efetuado)
   v
[IN_PROGRESS]
   |
(Aula concluída)
   v
[COMPLETED] --------> [Avaliação do Aluno]
   |
(Fluxos Excepcionais)
   +---> [CANCELLED_BY_STUDENT] / [CANCELLED_BY_PROVIDER]
   +---> [NO_SHOW_STUDENT] / [NO_SHOW_PROVIDER]
   +---> [DISPUTED] ---> [REFUNDED] / [PARTIALLY_REFUNDED]
```

---

## 3. Garantias de Segurança e Proteção Anti-Double Booking

### Restrições de Exclusão no PostgreSQL (`EXCLUDE USING gist`)
A tabela `public.bookings` utiliza restrições de exclusão no nível do banco de dados para impedir sobreposição temporal para o **mesmo Instrutor** OU para o **mesmo Veículo**:

```sql
-- Restrição para Instrutor
ALTER TABLE public.bookings
  ADD CONSTRAINT exclude_instructor_overlapping_bookings
  EXCLUDE USING gist (
    instructor_id WITH =,
    slot_range WITH &&
  )
  WHERE (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'));

-- Restrição para Veículo
ALTER TABLE public.bookings
  ADD CONSTRAINT exclude_vehicle_overlapping_bookings
  EXCLUDE USING gist (
    vehicle_id WITH =,
    slot_range WITH &&
  )
  WHERE (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'));
```

### Regras do Intervalo Semi-Aberto `[start, end)`
- O campo `slot_range` é gerado via `tstzrange(scheduled_start_at, scheduled_end_at, '[)')`.
- Anotação `[)` significa início inclusivo e fim exclusivo.
- Exemplo: Aula 10:00–10:50 (`[10:00, 10:50)`) e Aula 10:50–11:40 (`[10:50, 11:40)`) **NÃO conflitam**.

### Proteção Contra Adulteração de Preços e Recursos (Price & Resource Tampering)
- O frontend envia apenas `quoteId` e `idempotencyKey`.
- O backend ignora quaisquer valores numéricos ou IDs de veículos/instrutores enviados pelo cliente na requisição de reserva.
- Todos os valores comerciais (`priceInCents`, `platformFeeInCents`, `totalInCents`) e alocações de recursos são extraídos exclusivamente do `Quote` congelado.

### Idempotência
- A requisição de reserva aceita o parâmetro `idempotencyKey`.
- Se a mesma chave for reenviada para o mesmo estudante, o procedimento retorna a reserva existente sem criar novo hold ou cobrar duas vezes.

---

## 4. Stored Procedure Transacional (`create_booking_hold`)

O procedimento SQL executado atomicamente em transação realiza as seguintes etapas:
1. Verificação de chave de idempotência.
2. Varredura e expiração de holds antigos (`UPDATE bookings SET status = 'EXPIRED' WHERE status = 'PENDING_PAYMENT' AND hold_expires_at <= NOW()`).
3. Bloqueio pessimista de linha do Quote (`SELECT * FROM quotes WHERE id = p_quote_id FOR UPDATE`).
4. Revalidação de elegibilidade operacional (`providers.status = 'ACTIVE'`, `vehicles.status = 'ACTIVE'`, `service_offerings.is_active = TRUE`).
5. Construção do snapshot histórico imutável (`snapshot_data`).
6. Inserção do Booking em `PENDING_PAYMENT` (se houver conflito de horário, o PostgreSQL dispara violação de exclusão `23P01`).
7. Marcação do Quote como `CONSUMED`.

---

## 5. Mapeamento de Erros e Códigos HTTP

| Código do Erro / Código DB | Erro de Domínio MAZZI | HTTP Status | Descrição |
| :--- | :--- | :--- | :--- |
| `23P01` (Exclusion Violation) | `SLOT_NO_LONGER_AVAILABLE` | `409 Conflict` | Horário ou veículo já reservado por outro aluno. |
| `23505` (Unique Violation) | `DUPLICATE_IDEMPOTENCY_KEY` | `409 Conflict` | Requisição duplicada com a mesma chave de idempotência. |
| `P0002` (Not Found) | `QUOTE_NOT_FOUND` | `404 Not Found` | Proposta comercial não localizada. |
| `42501` / RLS | `FORBIDDEN` | `403 Forbidden` | Tentativa de utilizar proposta de outro estudante. |
| Business Check | `QUOTE_EXPIRED` | `400 Bad Request` | Proposta comercial expirada. |
| Business Check | `QUOTE_ALREADY_CONSUMED` | `409 Conflict` | Proposta comercial já utilizada anteriormente. |
| Business Check | `PROVIDER_NOT_ACTIVE` | `422 Unprocessable` | Prestador inativo na plataforma. |
| Business Check | `VEHICLE_NOT_ACTIVE` | `422 Unprocessable` | Veículo desativado ou expirado. |
