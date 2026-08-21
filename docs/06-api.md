# 06 — Contrato da API RESTful

## Padrões de Endpoint
- Prefixo global: `/api/v1`
- Formato: JSON (UTF-8)
- Autenticação: Header `Authorization: Bearer <token>`
- Idempotência: Header `Idempotency-Key: <uuid>` em operações mutáveis de pagamento e checkout.

## Principais Rotas por Módulo

### 1. Autenticação & Usuários
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/users/me`
- `PUT /api/v1/users/me`

### 2. Busca Pública & Fornecedores
- `GET /api/v1/search?lat=&lng=&radius=&category=A,B&date=&time=&transmission=MANUAL,AUTOMATIC&type=ALL,INSTRUCTOR,DRIVING_SCHOOL`
- `GET /api/v1/providers/:id`
- `GET /api/v1/providers/:id/offerings`
- `GET /api/v1/providers/:id/availability?date=`

### 3. Cotação & Reserva
- `POST /api/v1/quotes` (Gera Quote válido por 10 min)
- `POST /api/v1/bookings` (Cria booking a partir de Quote válido)
- `GET /api/v1/bookings/my`
- `GET /api/v1/bookings/:id`
- `POST /api/v1/bookings/:id/cancel`
- `POST /api/v1/bookings/:id/checkin`

### 4. Pagamentos & Webhooks
- `POST /api/v1/payments/checkout` (Gera PIX QrCode ou Token de Cartão)
- `POST /api/v1/webhooks/payments/:gateway` (Webhook assinado do gateway)
- `GET /api/v1/payments/:id/status`

### 5. Execução de Aula & Avaliação
- `POST /api/v1/lessons/:bookingId/start`
- `POST /api/v1/lessons/:bookingId/finish`
- `POST /api/v1/reviews` (Apenas para `booking.status == COMPLETED`)

### 6. Mazzi Pro (Gestão de Fornecedores)
- `GET /api/v1/pro/dashboard`
- `GET /api/v1/pro/schedule?view=instructor|vehicle&date=`
- `POST /api/v1/pro/vehicles`
- `POST /api/v1/pro/offerings`
- `GET /api/v1/pro/finances`
- `POST /api/v1/pro/compliance/documents`

### 7. Mazzi Admin
- `GET /api/v1/admin/overview`
- `GET /api/v1/admin/marketplace-metrics`
- `GET /api/v1/admin/compliance/pending`
- `POST /api/v1/admin/compliance/documents/:id/review`

## RPCs de Autoescola e compliance

O cliente usa RPCs `SECURITY DEFINER` autenticadas para compliance, convites, vínculos e ativação. `try_activate_school_instructor_membership` só promove o vínculo quando os critérios objetivos de elegibilidade passam.
- `GET /api/v1/admin/audit-logs`
