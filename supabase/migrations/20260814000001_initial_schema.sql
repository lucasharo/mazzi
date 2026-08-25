-- ============================================================================
-- MAZZI PLATFORM — SPRINT 02 DATABASE MIGRATION (Supabase / PostgreSQL 16)
-- File: 20260814000001_initial_schema.sql
-- ============================================================================

-- 1. EXTENSIONS
-- Note: gen_random_uuid() is built natively into PostgreSQL 13+. uuid-ossp is omitted.
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. CUSTOM ENUMS
CREATE TYPE user_role AS ENUM (
  'STUDENT',
  'INSTRUCTOR',
  'DRIVING_SCHOOL',
  'SCHOOL_ADMIN',
  'SCHOOL_STAFF',
  'PLATFORM_ADMIN',
  'SUPPORT'
);

CREATE TYPE user_status AS ENUM (
  'ACTIVE',
  'BLOCKED',
  'SUSPENDED',
  'PENDING_VERIFICATION'
);

CREATE TYPE provider_type AS ENUM (
  'INSTRUCTOR',
  'DRIVING_SCHOOL'
);

CREATE TYPE provider_status AS ENUM (
  'DRAFT',
  'PENDING_REVIEW',
  'ACTIVE',
  'SUSPENDED',
  'BLOCKED',
  'REJECTED'
);

CREATE TYPE vehicle_category AS ENUM (
  'A',
  'B'
);

CREATE TYPE vehicle_transmission AS ENUM (
  'MANUAL',
  'AUTOMATIC'
);

CREATE TYPE vehicle_status AS ENUM (
  'PENDING',
  'IN_REVIEW',
  'ACTIVE',
  'INACTIVE',
  'EXPIRED',
  'BLOCKED'
);

CREATE TYPE compliance_doc_type AS ENUM (
  'CNH',
  'CREDENTIAL_DETRAN',
  'CRLV',
  'DUAL_PEDAL_INSPECTION',
  'CRIMINAL_BACKGROUND',
  'CONTRACT_SOCIAL',
  'CFC_ALVARA'
);

CREATE TYPE compliance_status AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED'
);

CREATE TYPE booking_status AS ENUM (
  'DRAFT',
  'PENDING_PAYMENT',
  'PAYMENT_FAILED',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED_BY_STUDENT',
  'CANCELLED_BY_PROVIDER',
  'NO_SHOW_STUDENT',
  'NO_SHOW_PROVIDER',
  'DISPUTED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
  'EXPIRED'
);

CREATE TYPE payment_method AS ENUM (
  'PIX',
  'CREDIT_CARD'
);

CREATE TYPE payment_status AS ENUM (
  'PENDING',
  'AUTHORIZED',
  'PAID',
  'FAILED',
  'REFUNDED',
  'CHARGEBACK'
);

CREATE TYPE payout_status AS ENUM (
  'PENDING',
  'AVAILABLE',
  'PROCESSING',
  'PAID',
  'FAILED',
  'BLOCKED'
);

-- ============================================================================
-- 3. CORE ENTITIES (18 EXACT TABLES)
-- ============================================================================

-- Table 1: users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NOT NULL,
  role user_role NOT NULL DEFAULT 'STUDENT',
  status user_status NOT NULL DEFAULT 'ACTIVE',
  avatar_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Table 2: providers (Independent Instructors and CFCs)
-- Geographic coordinates stored as GEOGRAPHY(Point, 4326) for native meter calculations and geodesic accuracy
CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  type provider_type NOT NULL,
  legal_name VARCHAR(255) NOT NULL,
  trade_name VARCHAR(255) NOT NULL,
  document_number VARCHAR(30) NOT NULL UNIQUE, -- CPF or CNPJ
  status provider_status NOT NULL DEFAULT 'DRAFT',
  bio TEXT,
  rating_average NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  rating_count INTEGER NOT NULL DEFAULT 0,
  service_radius_km INTEGER NOT NULL DEFAULT 5,
  location GEOGRAPHY(Point, 4326),
  neighborhood VARCHAR(100),
  city VARCHAR(100) NOT NULL DEFAULT 'São Paulo',
  state VARCHAR(2) NOT NULL DEFAULT 'SP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 3: driving_school_staff (CFC Staff/Instructors)
CREATE TABLE IF NOT EXISTS driving_school_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'SCHOOL_STAFF',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(school_id, user_id)
);

-- Table 4: vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
  brand VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  year INTEGER NOT NULL,
  license_plate VARCHAR(20) NOT NULL, -- Private/Sensitive
  license_plate_masked VARCHAR(20) NOT NULL, -- Publicly safe
  renavam VARCHAR(30), -- Private/Sensitive
  category vehicle_category NOT NULL,
  transmission vehicle_transmission NOT NULL,
  has_dual_pedal BOOLEAN NOT NULL DEFAULT TRUE,
  has_dashcam BOOLEAN NOT NULL DEFAULT FALSE,
  status vehicle_status NOT NULL DEFAULT 'PENDING',
  photos TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Table 5: service_offerings
CREATE TABLE IF NOT EXISTS service_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
  instructor_id UUID REFERENCES users(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  category vehicle_category NOT NULL,
  transmission vehicle_transmission NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 50,
  price_in_cents INTEGER NOT NULL CHECK (price_in_cents > 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 6: availabilities (Weekly Recurring Patterns)
CREATE TABLE IF NOT EXISTS availabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_time < end_time)
);

-- Table 7: availability_exceptions (Manual Blocks, Vacations, Maintenance)
CREATE TABLE IF NOT EXISTS availability_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  instructor_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  reason VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_at < end_at)
);

-- Table 8: quotes (Immutable pricing and allocation snapshot)
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  offering_id UUID NOT NULL REFERENCES service_offerings(id) ON DELETE RESTRICT,
  scheduled_start_at TIMESTAMPTZ NOT NULL,
  scheduled_end_at TIMESTAMPTZ NOT NULL,
  price_in_cents INTEGER NOT NULL CHECK (price_in_cents > 0),
  platform_fee_in_cents INTEGER NOT NULL CHECK (platform_fee_in_cents >= 0),
  total_in_cents INTEGER NOT NULL CHECK (total_in_cents > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (scheduled_start_at < scheduled_end_at),
  CHECK (total_in_cents = price_in_cents + platform_fee_in_cents)
);

-- Table 9: bookings
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  offering_id UUID NOT NULL REFERENCES service_offerings(id) ON DELETE RESTRICT,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  status booking_status NOT NULL DEFAULT 'PENDING_PAYMENT',
  scheduled_start_at TIMESTAMPTZ NOT NULL,
  scheduled_end_at TIMESTAMPTZ NOT NULL,
  slot_range TSTZRANGE GENERATED ALWAYS AS (tstzrange(scheduled_start_at, scheduled_end_at, '[)')) STORED,
  meeting_point JSONB NOT NULL DEFAULT '{"name": "Ponto de Encontro Padrão"}'::jsonb,
  price_in_cents INTEGER NOT NULL CHECK (price_in_cents > 0),
  platform_fee_in_cents INTEGER NOT NULL CHECK (platform_fee_in_cents >= 0),
  total_in_cents INTEGER NOT NULL CHECK (total_in_cents > 0),
  snapshot_data JSONB NOT NULL, -- Preserves provider, instructor, and vehicle history
  cancellation_data JSONB,
  checkin_student_at TIMESTAMPTZ,
  checkin_instructor_at TIMESTAMPTZ,
  lesson_started_at TIMESTAMPTZ,
  lesson_finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (scheduled_start_at < scheduled_end_at)
);

-- ============================================================================
-- 4. ANTI-DOUBLE-BOOKING EXCLUSION CONSTRAINTS (PostgreSQL / btree_gist)
-- ============================================================================

-- Active status list proposing agenda occupation:
-- PENDING_PAYMENT (holding slot during quote/checkout window), CONFIRMED, IN_PROGRESS
-- Cancelled, Refunded, Expired or Completed bookings DO NOT lock future schedules.

-- Exclusion constraint 1: An instructor cannot have 2 overlapping active lessons
ALTER TABLE bookings
  ADD CONSTRAINT exclude_instructor_overlapping_bookings
  EXCLUDE USING gist (
    instructor_id WITH =,
    slot_range WITH &&
  )
  WHERE (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'));

-- Exclusion constraint 2: A vehicle cannot be allocated to 2 overlapping active lessons
ALTER TABLE bookings
  ADD CONSTRAINT exclude_vehicle_overlapping_bookings
  EXCLUDE USING gist (
    vehicle_id WITH =,
    slot_range WITH &&
  )
  WHERE (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS'));

-- ============================================================================
-- 5. PAYMENTS, REFUNDS, PAYOUTS (Tables 10, 11, 12)
-- ============================================================================

-- Table 10: payments
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  method payment_method NOT NULL,
  status payment_status NOT NULL DEFAULT 'PENDING',
  amount_in_cents INTEGER NOT NULL CHECK (amount_in_cents > 0),
  external_transaction_id VARCHAR(255),
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  gateway_provider VARCHAR(50) NOT NULL DEFAULT 'supabase_gateway',
  metadata JSONB DEFAULT '{}'::jsonb,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 11: refunds
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  amount_in_cents INTEGER NOT NULL CHECK (amount_in_cents > 0),
  reason VARCHAR(255) NOT NULL,
  external_refund_id VARCHAR(255),
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'PROCESSED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 12: payouts
CREATE TABLE IF NOT EXISTS payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  amount_in_cents INTEGER NOT NULL CHECK (amount_in_cents >= 0),
  status payout_status NOT NULL DEFAULT 'PENDING',
  scheduled_release_at TIMESTAMPTZ NOT NULL, -- completed_at + 24h safety period
  released_at TIMESTAMPTZ,
  external_payout_id VARCHAR(255),
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. CHAT, REVIEWS, COMPLIANCE, AUDIT, CONFIG & ANALYTICS (Tables 13 to 18)
-- ============================================================================

-- Table 13: conversations
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(booking_id)
);

-- Table 14: messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 15: reviews
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
  instructor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rating_overall INTEGER NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  rating_didactics INTEGER CHECK (rating_didactics BETWEEN 1 AND 5),
  rating_punctuality INTEGER CHECK (rating_punctuality BETWEEN 1 AND 5),
  rating_safety INTEGER CHECK (rating_safety BETWEEN 1 AND 5),
  rating_vehicle INTEGER CHECK (rating_vehicle BETWEEN 1 AND 5),
  rating_cordiality INTEGER CHECK (rating_cordiality BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(booking_id) -- Exactly one student review per booking
);

-- Table 16: compliance_documents
CREATE TABLE IF NOT EXISTS compliance_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE,
  document_type compliance_doc_type NOT NULL,
  storage_path VARCHAR(500) NOT NULL, -- Private object reference, never public URL
  status compliance_status NOT NULL DEFAULT 'PENDING',
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 17: audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 18: platform_configurations
CREATE TABLE IF NOT EXISTS platform_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 19: cancellation_policies
CREATE TABLE IF NOT EXISTS cancellation_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  provider_initiated_refund_percentage INTEGER NOT NULL DEFAULT 100,
  no_show_student_refund_percentage INTEGER NOT NULL DEFAULT 0,
  no_show_provider_refund_percentage INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table 20: cancellation_policy_rules
CREATE TABLE IF NOT EXISTS cancellation_policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES cancellation_policies(id) ON DELETE CASCADE,
  min_hours_before_lesson INTEGER NOT NULL,
  student_refund_percentage INTEGER NOT NULL,
  provider_compensation_percentage INTEGER NOT NULL,
  platform_fee_retained_percentage INTEGER NOT NULL,
  description TEXT NOT NULL
);

-- Table 21: analytics_events
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name VARCHAR(100) NOT NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  properties JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. PERFORMANCE AND GEOSPATIAL INDEXES
-- ============================================================================

-- PostGIS Spatial Index for Providers (GEOGRAPHY GIST)
CREATE INDEX IF NOT EXISTS idx_providers_location_gist ON providers USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_providers_status ON providers (status);
CREATE INDEX IF NOT EXISTS idx_providers_user_id ON providers (user_id);

-- Vehicles
CREATE INDEX IF NOT EXISTS idx_vehicles_provider_status ON vehicles (provider_id, status);
CREATE INDEX IF NOT EXISTS idx_vehicles_category ON vehicles (category, transmission);

-- Offerings
CREATE INDEX IF NOT EXISTS idx_offerings_provider_active ON service_offerings (provider_id, is_active);
CREATE INDEX IF NOT EXISTS idx_offerings_vehicle ON service_offerings (vehicle_id);

-- Bookings Search & Query Indexes
CREATE INDEX IF NOT EXISTS idx_bookings_student ON bookings (student_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings (provider_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_instructor_dates ON bookings (instructor_id, scheduled_start_at);
CREATE INDEX IF NOT EXISTS idx_bookings_vehicle_dates ON bookings (vehicle_id, scheduled_start_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status_dates ON bookings (status, scheduled_start_at);

-- Payments & Payouts
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments (booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);
CREATE INDEX IF NOT EXISTS idx_payouts_provider_status ON payouts (provider_id, status);
CREATE INDEX IF NOT EXISTS idx_payouts_release_dates ON payouts (scheduled_release_at) WHERE status = 'PENDING';

-- Audit & Messages
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs (actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_dates ON messages (conversation_id, created_at);

-- ============================================================================
-- 8. SUPABASE SECURITY & ROW LEVEL SECURITY (RLS) DEFENSIVE BASELINE
-- ============================================================================

-- Enable RLS on ALL tables by default to prevent accidental anonymous public exposure
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE driving_school_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE availabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancellation_policy_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Interim Safe Policies for Public Read Catalog (Providers, Active Vehicles, Offerings, Reviews)
-- Detailed user-specific policies will be formally enforced during Sprint 03 (Auth & RBAC).
CREATE POLICY "Public can view active providers" ON providers FOR SELECT USING (status = 'ACTIVE');
CREATE POLICY "Public can view active vehicles" ON vehicles FOR SELECT USING (status = 'ACTIVE');
CREATE POLICY "Public can view active offerings" ON service_offerings FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Public can view reviews" ON reviews FOR SELECT USING (TRUE);
