-- ============================================================================
-- MAZZI PLATFORM — SPRINT 02 SEED DATA (DEVELOPMENT ONLY)
-- File: seed.sql
-- ============================================================================

-- Clean demo data if re-running
TRUNCATE TABLE
  analytics_events,
  audit_logs,
  cancellation_policy_rules,
  cancellation_policies,
  platform_configurations,
  compliance_documents,
  reviews,
  messages,
  conversations,
  payouts,
  refunds,
  payments,
  bookings,
  quotes,
  availability_exceptions,
  availabilities,
  service_offerings,
  vehicles,
  driving_school_staff,
  providers,
  users
CASCADE;

-- 1. SEED PLATFORM CONFIGURATIONS
INSERT INTO platform_configurations (key, value, description)
VALUES
  (
    'platform_fees',
    '{"default_percentage": 10, "status": "DEVELOPMENT_DEFAULT"}'::jsonb,
    'Taxa percentual de comissão MAZZI (Configuração inicial de desenvolvimento)'
  ),
  (
    'quote_settings',
    '{"expiration_minutes": 10}'::jsonb,
    'Tempo de validade da cotação antes do checkout'
  ),
  (
    'payout_settings',
    '{"safety_period_hours": 24}'::jsonb,
    'Período de retenção de segurança pós aula concluída para liberação de repasse'
  );

-- 2. SEED CANCELLATION POLICY (DEFAULT DEVELOPMENT)
WITH default_policy AS (
  INSERT INTO cancellation_policies (
    id,
    name,
    is_active,
    provider_initiated_refund_percentage,
    no_show_student_refund_percentage,
    no_show_provider_refund_percentage
  )
  VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Política Padrão de Desenvolvimento MAZZI',
    TRUE,
    100,
    0,
    100
  )
  RETURNING id
)
INSERT INTO cancellation_policy_rules (
  policy_id,
  min_hours_before_lesson,
  student_refund_percentage,
  provider_compensation_percentage,
  platform_fee_retained_percentage,
  description
)
VALUES
  ('00000000-0000-0000-0000-000000000001', 24, 100, 0, 0, 'Mais de 24h: 100% de reembolso ao aluno'),
  ('00000000-0000-0000-0000-000000000001', 6, 50, 50, 0, 'Entre 6h e 24h: 50% de reembolso ao aluno'),
  ('00000000-0000-0000-0000-000000000001', 0, 0, 100, 100, 'Menos de 6h ou no-show: Sem reembolso');

-- 3. SEED USERS
INSERT INTO users (id, email, name, phone, role, status)
VALUES
  ('11111111-1111-1111-1111-111111111101', 'aluno.demo@mazzi.com.br', 'Ana Clara Silva (Demo)', '11988880001', 'STUDENT', 'ACTIVE'),
  ('11111111-1111-1111-1111-111111111102', 'carlos.instrutor@mazzi.com.br', 'Carlos Alberto de Souza (Demo)', '11988880002', 'INSTRUCTOR', 'ACTIVE'),
  ('11111111-1111-1111-1111-111111111103', 'admin.paulista@mazzi.com.br', 'Diretor Autoescola Paulista (Demo)', '11988880003', 'SCHOOL_ADMIN', 'ACTIVE'),
  ('11111111-1111-1111-1111-111111111104', 'marcos.instrutor@mazzi.com.br', 'Marcos Vinícius (Demo)', '11988880004', 'INSTRUCTOR', 'ACTIVE'),
  ('11111111-1111-1111-1111-111111111105', 'admin.master@mazzi.com.br', 'Administrador MAZZI (Demo)', '11988880099', 'PLATFORM_ADMIN', 'ACTIVE');

-- 4. SEED GLOBAL INSTRUCTOR COMPLIANCE (DEVELOPMENT ONLY)
-- Active demo offerings require all mandatory global documents to be approved.
INSERT INTO compliance_documents (
  provider_id,
  user_id,
  vehicle_id,
  membership_id,
  scope,
  document_type,
  storage_path,
  status,
  expires_at
)
VALUES
  (NULL, '11111111-1111-1111-1111-111111111102', NULL, NULL, 'USER_GLOBAL', 'CNH', 'replay://demo/carlos/cnh', 'APPROVED', '2099-12-31T23:59:59Z'),
  (NULL, '11111111-1111-1111-1111-111111111102', NULL, NULL, 'USER_GLOBAL', 'CREDENTIAL_DETRAN', 'replay://demo/carlos/credential-detran', 'APPROVED', '2099-12-31T23:59:59Z'),
  (NULL, '11111111-1111-1111-1111-111111111102', NULL, NULL, 'USER_GLOBAL', 'CRIMINAL_BACKGROUND', 'replay://demo/carlos/criminal-background', 'APPROVED', '2099-12-31T23:59:59Z'),
  (NULL, '11111111-1111-1111-1111-111111111104', NULL, NULL, 'USER_GLOBAL', 'CNH', 'replay://demo/marcos/cnh', 'APPROVED', '2099-12-31T23:59:59Z'),
  (NULL, '11111111-1111-1111-1111-111111111104', NULL, NULL, 'USER_GLOBAL', 'CREDENTIAL_DETRAN', 'replay://demo/marcos/credential-detran', 'APPROVED', '2099-12-31T23:59:59Z'),
  (NULL, '11111111-1111-1111-1111-111111111104', NULL, NULL, 'USER_GLOBAL', 'CRIMINAL_BACKGROUND', 'replay://demo/marcos/criminal-background', 'APPROVED', '2099-12-31T23:59:59Z');

-- 5. SEED PROVIDERS (1 Instructor, 1 Driving School)
INSERT INTO providers (
  id,
  user_id,
  type,
  legal_name,
  trade_name,
  document_number,
  status,
  bio,
  rating_average,
  rating_count,
  service_radius_km,
  location,
  neighborhood,
  city,
  state
)
VALUES
  (
    '22222222-2222-2222-2222-222222222201',
    '11111111-1111-1111-1111-111111111102',
    'INSTRUCTOR',
    'Carlos Alberto de Souza Treinamentos ME',
    'Instrutor Carlos - Pinheiros',
    '12345678900',
    'ACTIVE',
    'Instrutor credenciado há 12 anos. Especialista em baliza, controle de embreagem e superação do medo de dirigir.',
    4.95,
    64,
    5,
    ST_SetSRID(ST_MakePoint(-46.6872, -23.5658), 4326),
    'Pinheiros',
    'São Paulo',
    'SP'
  ),
  (
    '22222222-2222-2222-2222-222222222202',
    '11111111-1111-1111-1111-111111111103',
    'DRIVING_SCHOOL',
    'Centro de Formação de Condutores Paulista Ltda',
    'Autoescola Paulista - Bela Vista',
    '12345678000195',
    'ACTIVE',
    'Tradicional CFC da região central com pista de treinamento e frota renovada com ar-condicionado.',
    4.88,
    142,
    8,
    ST_SetSRID(ST_MakePoint(-46.6544, -23.5629), 4326),
    'Bela Vista',
    'São Paulo',
    'SP'
  );

-- Staff link for Driving School
INSERT INTO driving_school_staff (school_id, user_id, role, is_active)
VALUES
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111104', 'INSTRUCTOR', TRUE);

-- 6. SEED VEHICLES
INSERT INTO vehicles (
  id,
  provider_id,
  brand,
  model,
  year,
  license_plate,
  license_plate_masked,
  renavam,
  category,
  transmission,
  has_dual_pedal,
  has_dashcam,
  status,
  photos
)
VALUES
  (
    '33333333-3333-3333-3333-333333333301',
    '22222222-2222-2222-2222-222222222201',
    'Hyundai',
    'HB20 Vision 1.0',
    2024,
    'BRA-2E19',
    'BRA-***9',
    '10928374651',
    'B',
    'MANUAL',
    TRUE,
    TRUE,
    'ACTIVE',
    ARRAY['https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600&auto=format&fit=crop&q=80']
  ),
  (
    '33333333-3333-3333-3333-333333333302',
    '22222222-2222-2222-2222-222222222202',
    'Chevrolet',
    'Onix Plus Turbo',
    2023,
    'SPK-4F88',
    'SPK-***8',
    '98765432100',
    'B',
    'AUTOMATIC',
    TRUE,
    FALSE,
    'ACTIVE',
    ARRAY['https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=600&auto=format&fit=crop&q=80']
  );

-- 7. SEED SERVICE OFFERINGS
INSERT INTO service_offerings (
  id,
  provider_id,
  instructor_id,
  vehicle_id,
  category,
  transmission,
  duration_minutes,
  price_in_cents,
  is_active
)
VALUES
  (
    '44444444-4444-4444-4444-444444444401',
    '22222222-2222-2222-2222-222222222201',
    '11111111-1111-1111-1111-111111111102',
    '33333333-3333-3333-3333-333333333301',
    'B',
    'MANUAL',
    50,
    12000, -- R$ 120,00
    TRUE
  ),
  (
    '44444444-4444-4444-4444-444444444402',
    '22222222-2222-2222-2222-222222222202',
    '11111111-1111-1111-1111-111111111104',
    '33333333-3333-3333-3333-333333333302',
    'B',
    'AUTOMATIC',
    50,
    14000, -- R$ 140,00
    TRUE
  );

-- 8. SEED AVAILABILITY PATTERNS (Monday to Friday, 08:00 to 18:00)
INSERT INTO availabilities (provider_id, instructor_id, vehicle_id, day_of_week, start_time, end_time)
VALUES
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111102', '33333333-3333-3333-3333-333333333301', 1, '08:00', '18:00'),
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111102', '33333333-3333-3333-3333-333333333301', 2, '08:00', '18:00'),
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111102', '33333333-3333-3333-3333-333333333301', 3, '08:00', '18:00'),
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111102', '33333333-3333-3333-3333-333333333301', 4, '08:00', '18:00'),
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111102', '33333333-3333-3333-3333-333333333301', 5, '08:00', '18:00');

-- 9. SEED COMPLETED HISTORICAL BOOKING (For demonstration & review models)
INSERT INTO bookings (
  id,
  student_id,
  provider_id,
  instructor_id,
  vehicle_id,
  offering_id,
  status,
  scheduled_start_at,
  scheduled_end_at,
  price_in_cents,
  platform_fee_in_cents,
  total_in_cents,
  snapshot_data,
  checkin_student_at,
  checkin_instructor_at,
  lesson_started_at,
  lesson_finished_at
)
VALUES (
  '55555555-5555-5555-5555-555555555501',
  '11111111-1111-1111-1111-111111111101',
  '22222222-2222-2222-2222-222222222201',
  '11111111-1111-1111-1111-111111111102',
  '33333333-3333-3333-3333-333333333301',
  '44444444-4444-4444-4444-444444444401',
  'COMPLETED',
  '2026-08-10 14:00:00+00',
  '2026-08-10 14:50:00+00',
  12000,
  1200,
  13200,
  '{"provider_name": "Instrutor Carlos - Pinheiros", "vehicle_model": "Hyundai HB20 Vision 1.0 (2024)", "category": "B"}'::jsonb,
  '2026-08-10 13:58:00+00',
  '2026-08-10 13:59:00+00',
  '2026-08-10 14:00:05+00',
  '2026-08-10 14:50:12+00'
);

-- Seed Payment for completed booking
INSERT INTO payments (
  booking_id,
  method,
  status,
  amount_in_cents,
  idempotency_key,
  paid_at
)
VALUES (
  '55555555-5555-5555-5555-555555555501',
  'PIX',
  'PAID',
  13200,
  'idemp_seed_pay_001',
  '2026-08-09 10:00:00+00'
);

-- Seed Review
INSERT INTO reviews (
  booking_id,
  student_id,
  provider_id,
  instructor_id,
  rating_overall,
  rating_didactics,
  rating_punctuality,
  rating_safety,
  rating_vehicle,
  rating_cordiality,
  comment
)
VALUES (
  '55555555-5555-5555-5555-555555555501',
  '11111111-1111-1111-1111-111111111101',
  '22222222-2222-2222-2222-222222222201',
  '11111111-1111-1111-1111-111111111102',
  5,
  5,
  5,
  5,
  5,
  5,
  'Excelente aula! O instrutor Carlos foi muito calmo, pontual e me ajudou muito na baliza.'
);
