# 08 — Ciclo de Vida do Booking e Concorrência Temporal (Sprint 08)

## 1. Visão Geral da Arquitetura de Reservas MAZZI

Consequências por cancelamentos injustificados do instrutor na Aula Agora: [DEC-018 e política de disciplina](./product/INSTANT_CANCELLATION_CONDUCT.md). Não modificar aulas agendadas nem repasses por essa suspensão.

Na Aula Agora, o ponto de encontro é a localização do aluno registrada na solicitação. A confirmação de pagamento exibe esse local somente para consulta, sem escolha entre endereço da autoescola e endereço do aluno. O checkout reutiliza a aula criada no aceite e preserva seu ponto de encontro.

O fundo dos mapas usa temporariamente OpenStreetMap Standard com Leaflet, sem CARTO no fluxo ativo. Manter os créditos visíveis, respeitar o cache HTTP e não implementar download em massa ou offline. O servidor público do OSM não oferece SLA; revisar o provedor antes de ampliar o uso comercial. Política: https://operations.osmfoundation.org/policies/tiles/.

A plataforma MAZZI separa rigidamente a fase de **Cotação Comercial (`Quote`)** da fase de **Reserva Transacional de Calendário (`Booking Hold`)**.

- **`Quote` (Cotação Comercial)**: Concongela preços, taxas e dados operacionais de uma aula por 10 minutos. **NÃO reserva horário na agenda**.
- **`Booking Hold` (Reserva Transacional)**: Valida a proposta, executa a limpeza de holds expirados e insere uma reserva temporária no status `PENDING_PAYMENT` com trava atômica `TSTZRANGE` e restrições de exclusão no PostgreSQL (`EXCLUDE USING gist`). A cotação e a retenção inicial do horário usam o mesmo vencimento configurado no Admin (10 minutos por padrão), inclusive para Pix e cartão. Quando o pagamento é iniciado antes desse vencimento, o horário permanece protegido por uma janela técnica adicional de processamento.

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
[PENDING_PAYMENT] -------- (Passou o prazo configurado sem Pix/Cartão) ----> [EXPIRED]
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

### Janela de processamento do pagamento

O prazo da cotação fecha o início de novas tentativas, mas não cancela uma tentativa já iniciada. Ao criar o pagamento, o backend registra `payments.payment_started_at` e `payments.payment_processing_until`, estende atomicamente o hold do booking por cinco minutos e mantém o horário bloqueado. O webhook assinado pode confirmar o pagamento durante essa janela, mesmo que a cotação já tenha vencido. Depois dela, a reserva não é reativada: o pagamento é registrado como tardio e o webhook solicita um reembolso idempotente.

O navegador não é a fonte de confirmação: o retorno do checkout é apenas informativo; a confirmação depende do webhook/reconciliação server-side e de chave de idempotência.

Quando o prazo de pagamento termina sem confirmação, `EXPIRED` é o status interno usado para liberar o horário. Na interface, essa situação é apresentada como **Pagamento não realizado**.

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

## Elegibilidade no runtime

Ofertas e slots públicos filtram instrutores inelegíveis. Quotes e novos bookings falham fechados quando o instrutor não está elegível. Atualizações administrativas comuns continuam permitidas; a elegibilidade é revalidada especificamente no check-in e no início da aula. O snapshot mantém `selectionMode`.
