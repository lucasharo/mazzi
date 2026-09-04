// ==========================================
// MAZZI PLATFORM — GLOBAL DOMAIN TYPES
// ==========================================

export type UserRole =
  | 'STUDENT'
  | 'INSTRUCTOR'
  | 'DRIVING_SCHOOL'
  | 'SCHOOL_ADMIN'
  | 'SCHOOL_STAFF'
  | 'PLATFORM_ADMIN'
  | 'SUPPORT';

export type ProviderType = 'INSTRUCTOR' | 'DRIVING_SCHOOL';

export type ProviderStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'BLOCKED'
  | 'REJECTED';

export type VehicleCategory = 'A' | 'B' | 'ACC' | 'C' | 'D' | 'E';

export type VehicleType = 'MOTORCYCLE' | 'CAR';

export type TransmissionType = 'MANUAL' | 'AUTOMATIC' | 'NOT_APPLICABLE';

export type VehicleStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'IN_REVIEW'
  | 'ACTIVE'
  | 'INACTIVE'
  | 'EXPIRED'
  | 'BLOCKED';

export type BookingStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PAYMENT_FAILED'
  | 'CONFIRMED'
  | 'ON_THE_WAY'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED_BY_STUDENT'
  | 'CANCELLED_BY_PROVIDER'
  | 'NO_SHOW_STUDENT'
  | 'NO_SHOW_PROVIDER'
  | 'DISPUTED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'EXPIRED';

export type PayoutStatus =
  | 'PENDING'
  | 'AVAILABLE'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'BLOCKED';

export type DocumentStatus =
  | 'PENDING'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED';

export type PaymentMethodType = 'PIX' | 'CREDIT_CARD';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  cpf?: string;
  birthDate?: string;
  role: UserRole;
  avatarUrl?: string;
  studentSavedAddress?: StudentSavedAddress;
  createdAt: string;
}

export interface StudentSavedAddress {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  postalCode?: string;
  placeId?: string;
  addressLine1?: string;
  addressLine2?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface Provider {
  id: string;
  userId?: string;
  name: string; // Display Name / Trade Name
  legalName?: string; // Razão Social / Nome Completo Civil
  documentNumber?: string; // CPF or CNPJ (PRIVATE)
  phone?: string; // Telefone interno (PRIVATE)
  publicContact?: string; // Contato comercial público
  commercialEmail?: string; // E-mail de contato comercial
  type: ProviderType;
  status: ProviderStatus;
  ratingAverage: number;
  ratingCount: number;
  distanceKm?: number;
  neighborhood: string;
  city: string;
  state?: string;
  serviceRadiusKm?: number;
  latitude?: number;
  longitude?: number;
  meetingPointLatitude?: number;
  meetingPointLongitude?: number;
  meetingPointName?: string;
  serviceAreaCenterLatitude?: number;
  serviceAreaCenterLongitude?: number;
  categories: VehicleCategory[];
  transmissions: TransmissionType[];
  startingPriceInCents: number;
  avatarUrl?: string;
  bio?: string;
  nextAvailableSlot?: string;
  isVerified: boolean;
  submittedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  suspendedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  address?: ProviderAddress;
}

export interface ProviderAddress {
  formatted?: string;
  addressLine1?: string;
  addressLine2?: string;
  street?: string;
  houseNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  postalCode?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
  source?: 'GEOAPIFY' | 'MAP_PIN' | 'LEGACY';
  locationMode?: 'STANDARD_ADDRESS' | 'NO_HOUSE_NUMBER' | 'MAP_PIN';
  noHouseNumber?: boolean;
  locationConfirmed?: boolean;
  confirmationMethod?: 'GEOAPIFY' | 'MAP_PIN';
  complement?: string;
}

export type ComplianceDocCategory =
  | 'IDENTITY_DOCUMENT'
  | 'DRIVER_LICENSE'
  | 'PROFESSIONAL_CREDENTIAL'
  | 'CRIMINAL_BACKGROUND'
  | 'COMPANY_REGISTRATION'
  | 'CFC_AUTHORIZATION'
  | 'VEHICLE_DOCUMENT_FUTURE'
  | 'OTHER';

export type RegulatorySourceType =
  | 'FEDERAL_LAW'
  | 'CONTRAN_RESOLUTION'
  | 'DETRAN_STATE_REGULATION'
  | 'MUNICIPAL_REGULATION'
  | 'INTERNAL_MAZZI_RULE';

export type RegulatoryValidationStatus =
  | 'OFFICIALLY_VALIDATED'
  | 'REQUIRES_REGULATORY_VALIDATION'
  | 'SUPERSEDED'
  | 'INACTIVE';

export type JurisdictionLevel =
  | 'FEDERAL'
  | 'STATE'
  | 'MUNICIPAL'
  | 'INTERNAL_PLATFORM';

export interface ComplianceRequirement {
  id: string;
  country: string; // e.g. 'BR'
  state?: string; // e.g. 'SP' (optional for federal/national rules)
  jurisdiction: JurisdictionLevel;
  providerType: ProviderType;
  category?: VehicleCategory;
  documentType: string;
  title: string;
  description: string;
  isMandatory: boolean;
  sourceType: RegulatorySourceType;
  sourceReference: string; // e.g. 'Lei Federal nº 9.503/1997 (CTB) Art. 147, § 5º'
  sourceUrl?: string;
  sourceIdentifier?: string;
  regulatoryStatus: RegulatoryValidationStatus;
  validityPeriodDays?: number;
  effectiveFrom: string;
  effectiveTo?: string;
  lastValidatedAt?: string;
}

export interface ComplianceDocument {
  id: string;
  providerId: string;
  providerName?: string;
  userId?: string;
  membershipId?: string;
  scope?: 'USER_GLOBAL' | 'PROVIDER' | 'MEMBERSHIP' | 'VEHICLE';
  type: string;
  title: string;
  status: DocumentStatus;
  fileName: string;
  storagePath: string; // Private bucket path: providers/{providerId}/compliance/{docId}/{filename}
  fileSize?: number;
  mimeType?: string;
  uploadedAt: string;
  expiresAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface PublicProviderProfile {
  id: string;
  displayName: string;
  avatarUrl?: string;
  providerType: ProviderType;
  bio?: string;
  ratingAverage: number;
  ratingCount: number;
  isVerified: boolean;
  neighborhood: string;
  city: string;
  categories: VehicleCategory[];
  transmissions: TransmissionType[];
  startingPriceInCents: number;
  serviceAreaDescription: string;
}

export interface Vehicle {
  id: string;
  providerId: string;
  brand: string;
  model: string;
  year: number;
  licensePlate: string; // PRIVATE OPERATIONAL DATA (Never exposed to public)
  licensePlateMasked?: string; // Sanitized plate e.g. "ABC-****" for internal display
  category: VehicleCategory;
  vehicleType: VehicleType;
  transmission: TransmissionType;
  status: VehicleStatus;
  blockedReason?: string;
  color?: string;
  description?: string;
  photos: string[]; // Public vehicle media URLs
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface PublicVehicleProfile {
  id: string;
  providerId: string;
  brand: string;
  model: string;
  year: number;
  vehicleType: VehicleType;
  category: VehicleCategory;
  transmission: TransmissionType;
  color?: string;
  photos: string[];
  displayTitle: string;
}

export interface ServiceOffering {
  id: string;
  providerId: string;
  instructorId?: string;
  instructorName?: string;
  vehicleId: string;
  category: VehicleCategory;
  transmission?: TransmissionType;
  durationMinutes: number; // MVP: 50 minutes (CONTRAN hour-class)
  priceInCents: number; // Integer cents > 0 (e.g. 10000 = R$ 100,00)
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface PublicServiceOfferingDto {
  id: string;
  providerId: string;
  vehicle: PublicVehicleProfile;
  category: VehicleCategory;
  durationMinutes: number;
  priceInCents: number;
  status: 'ACTIVE' | 'INACTIVE';
  isEligible: boolean;
}

export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export interface AvailabilityRule {
  id: string;
  providerId: string;
  instructorId?: string;
  vehicleId?: string;
  dayOfWeek: DayOfWeek;
  dayOfWeekNumber?: number; // ISO 1-7 (1=Monday, 7=Sunday) or JS 0-6 (0=Sunday)
  startTime: string; // HH:mm format, e.g. "08:00"
  endTime: string; // HH:mm format, e.g. "12:00"
  timezone: string; // IANA timezone string, default 'America/Sao_Paulo'
  effectiveFrom?: string; // YYYY-MM-DD
  effectiveTo?: string; // YYYY-MM-DD
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type ExceptionType = 'BLOCK' | 'AVAILABLE_OVERRIDE';

export type ExceptionReasonCategory =
  | 'VACATION'
  | 'MAINTENANCE'
  | 'PERSONAL'
  | 'HOLIDAY'
  | 'MANUAL_BLOCK'
  | 'OTHER';

export interface AvailabilityException {
  id: string;
  providerId: string;
  instructorId?: string;
  vehicleId?: string;
  type: ExceptionType;
  reasonCategory: ExceptionReasonCategory;
  reason: string; // Internal/private note (NEVER exposed publicly to students)
  startAt: string; // ISO 8601 string, e.g. "2026-09-07T08:00:00Z"
  endAt: string; // ISO 8601 string
  createdAt?: string;
  updatedAt?: string;
  isActive?: boolean;
}

export interface AvailabilityCandidate {
  startAt: string; // ISO 8601 UTC timestamp
  endAt: string; // ISO 8601 UTC timestamp
  date: string; // YYYY-MM-DD local date
  startTime: string; // HH:mm local start time
  endTime: string; // HH:mm local end time
  providerId: string;
  offeringId: string;
  instructorId: string;
  instructorName?: string;
  vehicleId: string;
  vehicleName?: string;
  durationMinutes: number;
  priceInCents: number;
  category: VehicleCategory;
}

export interface SlotGenerationOptions {
  offering: ServiceOffering;
  provider: Provider;
  vehicles: Vehicle[];
  instructors?: { id: string; name: string; isAvailable?: boolean; categories?: VehicleCategory[] }[];
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  timezone?: string; // Default 'America/Sao_Paulo'
  stepMinutes?: number; // Default offering.durationMinutes
  bufferMinutes?: number; // Default 0
  minimumNoticeMinutes?: number; // Default 120 (2h)
  maxAdvanceDays?: number; // Default 30
  now?: Date; // Injected reference time for deterministic testing (default new Date())
  availabilityRules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  existingBookings: Booking[];
  instructorGlobalBlocks?: { start_at: string; end_at: string }[];
  actorRole?: UserRole;
}

export interface AvailabilitySlot {
  id: string;
  providerId: string;
  instructorId?: string;
  instructorName?: string;
  vehicleId: string;
  vehicleName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  isBooked: boolean;
  startAt?: string;
  endAt?: string;
}

export type QuoteStatus = 'ACTIVE' | 'EXPIRED' | 'CONSUMED' | 'CANCELLED';

export interface Quote {
  id: string;
  studentId: string;
  providerId: string;
  providerName: string;
  offeringId: string;
  instructorId: string;
  instructorName: string;
  vehicleId: string;
  vehicleName: string;
  category: VehicleCategory;
  transmission: TransmissionType;
  scheduledDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  scheduledStartAt: string; // ISO 8601 UTC
  scheduledEndAt: string; // ISO 8601 UTC
  durationMinutes: number;
  priceInCents: number;
  platformFeeInCents: number;
  totalInCents: number;
  status: QuoteStatus;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
  idempotencyKey?: string;
}

export interface BookingSnapshot {
  source?: string;
  providerId: string;
  providerName: string;
  providerType: ProviderType;
  instructorId: string;
  instructorName: string;
  vehicleId: string;
  vehicleName: string;
  vehicleBrand?: string;
  vehicleModel?: string;
  vehicleType?: VehicleType;
  transmission?: TransmissionType;
  category: VehicleCategory;
  durationMinutes: number;
  priceInCents: number;
  platformFeeInCents: number;
  totalInCents: number;
  meetingPoint: string | { latitude?: number; longitude?: number; address?: string };
  fullMeetingPoint?: string;
}

export interface Booking {
  id: string;
  studentId: string;
  studentName?: string;
  providerId: string;
  providerName: string;
  instructorId: string;
  instructorName: string;
  vehicleId: string;
  vehicleName: string;
  offeringId: string;
  quoteId?: string;
  category: VehicleCategory;
  scheduledDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  scheduledStartAt: string; // ISO 8601 UTC
  scheduledEndAt: string; // ISO 8601 UTC
  status: BookingStatus;
  holdExpiresAt?: string; // ISO 8601 UTC timestamp for PENDING_PAYMENT hold expiration
  snapshot: BookingSnapshot;
  studentCheckedIn?: boolean;
  instructorCheckedIn?: boolean;
  meetingPoint: string;
  fullMeetingPoint?: string;
  idempotencyKey?: string;
  priceInCents: number;
  platformFeeInCents: number;
  gatewayFeeInCents?: number;
  paymentStatus?: MazziPaymentStatus;
  paymentPaidAt?: string;
  totalInCents: number;
  createdAt: string;
  updatedAt?: string;
  confirmedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  refundAmountInCents?: number;
  lessonDateTime?: string;
  expiredAt?: string;
  checkinStudentAt?: string;
  checkinInstructorAt?: string;
  lessonStartedAt?: string;
  lessonFinishedAt?: string;
}

// ==========================================
// SPRINT 09 — PAYMENTS, COMMISSION & PAYOUT TYPES
// ==========================================

export type MazziPaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'CHARGEBACK';

export type PaymentGatewayType = 'MERCADOPAGO' | 'STRIPE' | 'STRIPE_US_TEST' | 'DEVELOPMENT_MOCK';

export type ProviderPaymentAccountStatus =
  | 'NOT_STARTED'
  | 'PENDING'
  | 'REQUIRES_ACTION'
  | 'ACTIVE'
  | 'RESTRICTED'
  | 'DISABLED';

export interface ProviderMaskedPayoutAccount {
  kind: 'bank_account' | 'card';
  bankName?: string;
  last4?: string;
  country?: string;
  currency?: string;
  status?: string;
}

export type InstantLessonRequestStatus =
  | 'SEARCHING'
  | 'MATCHED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'FAILED';

export type InstantLessonOfferStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'LOST_RACE';

export interface InstantLessonSettings {
  id?: string;
  providerId: string;
  offeringId: string;
  instantEnabled: boolean;
  instantOnline: boolean;
  instantPriceInCents: number;
  maxDistanceKm: number;
  updatedAt?: string;
}

export interface InstantLessonPriceOption {
  maxPriceInCents: number | null;
  eligibleProviderCount: number;
}

export interface InstantLessonRequest {
  id: string;
  studentId: string;
  meetingPoint: StudentSavedAddress;
  category: VehicleCategory;
  transmission: TransmissionType | 'ALL';
  maxPriceInCents: number | null;
  status: InstantLessonRequestStatus;
  expiresAt: string;
  matchedProviderId?: string;
  matchedOfferingId?: string;
  bookingId?: string;
  createdAt: string;
}

export interface InstantLessonOffer {
  id: string;
  requestId: string;
  providerId: string;
  offeringId: string;
  instructorId: string;
  vehicleId: string;
  providerName?: string;
  category: VehicleCategory;
  transmission: TransmissionType;
  durationMinutes: number;
  offeredPriceInCents: number;
  distanceMeters: number;
  etaMinutes: number;
  status: InstantLessonOfferStatus;
  expiresAt: string;
  createdAt: string;
}

export interface InstantLessonTracking {
  bookingId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  etaMinutes?: number;
}

export interface ProviderPaymentAccount {
  id: string;
  providerId: string;
  gateway: PaymentGatewayType;
  externalAccountId: string;
  status: ProviderPaymentAccountStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingUrl?: string;
  metadata?: Record<string, any>;
  maskedPayoutAccount?: ProviderMaskedPayoutAccount;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  bookingId: string;
  studentId: string;
  providerId: string;
  gateway: PaymentGatewayType;
  externalPaymentId?: string;
  idempotencyKey: string;
  method: PaymentMethodType;
  status: MazziPaymentStatus;
  amountInCents: number; // Integer cents (R$ 100,00 = 10000)
  platformFeeInCents: number; // Integer cents (R$ 10,00 = 1000)
  providerAmountInCents: number; // Integer cents (R$ 90,00 = 9000)
  gatewayFeeInCents?: number; // Integer cents (Mercado Pago processing fee)
  sellerNetAmountInCents?: number; // Integer cents (Net payout to seller)
  pixQrCode?: string; // PIX "Copia e Cola" string
  pixQrCodeBase64?: string; // QR code image representation
  pixExpiresAt?: string; // ISO 8601 UTC timestamp
  paymentStartedAt?: string;
  paymentProcessingUntil?: string;
  stripeClientSecret?: string; // Client secret scoped to the authenticated payer
  cardLast4?: string;
  cardBrand?: string;
  metadata?: Record<string, any>;
  paidAt?: string;
  failedAt?: string;
  cancelledAt?: string;
  refundedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type RefundStatus = 'PENDING' | 'PROCESSED' | 'FAILED';

export interface Refund {
  id: string;
  paymentId: string;
  bookingId: string;
  amountInCents: number;
  reason: string;
  externalRefundId?: string;
  idempotencyKey: string;
  status: RefundStatus;
  createdAt: string;
  completedAt?: string;
}

export interface Payout {
  id: string;
  providerId: string;
  bookingId: string;
  amountInCents: number;
  status: PayoutStatus;
  scheduledReleaseAt: string; // ISO 8601 UTC (completed_at + configured safety period; 72h by default)
  releasedAt?: string;
  externalPayoutId?: string;
  idempotencyKey: string;
  grossAmountInCents?: number;
  platformFeeInCents?: number;
  gatewayFeeInCents?: number;
  gatewayFeeSource?: 'GATEWAY_RESPONSE' | 'CONFIGURED_ESTIMATE';
  transferMethod?: 'MANUAL_PIX' | 'MANUAL_BANK_ACCOUNT' | 'STRIPE_CONNECT';
  destinationKeyType?: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM' | 'BANK_ACCOUNT' | 'STRIPE_ACCOUNT';
  destinationKey?: string;
  destinationKeyMasked?: string;
  providerName?: string;
  recipientName?: string;
  recipientDocument?: string;
  transferReference?: string;
  processedBy?: string;
  processedAt?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type BookingDisputeStatus = 'OPEN' | 'AWAITING_STUDENT_RESPONSE' | 'AWAITING_PROVIDER_RESPONSE' | 'UNDER_REVIEW' | 'RESOLVED' | 'CANCELLED';
export type BookingDisputeReason = 'PROVIDER_NO_SHOW' | 'STUDENT_NO_SHOW' | 'LESSON_NOT_DELIVERED' | 'TIME_MISMATCH' | 'MEETING_POINT_MISMATCH' | 'SERVICE_MISMATCH' | 'SAFETY_CONCERN' | 'OTHER';
export type BookingDisputeResolution = 'NO_ACTION' | 'FULL_REFUND' | 'PARTIAL_REFUND' | 'RELEASE_PAYOUT' | 'RESCHEDULE';
export type BookingDisputeMessageType = 'DESCRIPTION' | 'RESPONSE' | 'INFORMATION_REQUEST';

export interface BookingDisputeMessage {
  id: string;
  disputeId: string;
  authorId?: string;
  authorRole: 'STUDENT' | 'PROVIDER' | 'ADMIN';
  type: BookingDisputeMessageType;
  content: string;
  createdAt: string;
}

export interface BookingDispute {
  id: string;
  bookingId: string;
  openedBy: string;
  openedByRole: 'STUDENT' | 'PROVIDER';
  reasonCode: BookingDisputeReason;
  description: string;
  status: BookingDisputeStatus;
  responseBy?: string;
  responseText?: string;
  respondedAt?: string;
  resolutionCode?: BookingDisputeResolution;
  resolutionNotes?: string;
  refundAmountInCents?: number;
  responseDueAt: string;
  informationRequest?: string;
  messages?: BookingDisputeMessage[];
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingDisputeEvidence {
  id: string;
  disputeId: string;
  uploadedBy: string;
  storagePath: string;
  evidenceType: 'IMAGE' | 'DOCUMENT' | 'LOCATION' | 'OTHER';
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';

export interface PixDestination {
  id?: string;
  providerId: string;
  keyType: PixKeyType;
  pixKey: string;
  pixKeyMasked?: string;
  holderName: string;
  holderDocument?: string;
  isActive: boolean;
  updatedAt?: string;
}

export type BankAccountType = 'CHECKING' | 'SAVINGS';

/** Dados bancários privados usados para repasses ao prestador. */
export interface BankAccount {
  id?: string;
  providerId: string;
  bankCode: string;
  branchNumber: string;
  accountNumber: string;
  accountDigit: string;
  accountType: BankAccountType;
  holderName: string;
  holderDocument?: string;
  accountNumberMasked?: string;
  isActive: boolean;
  updatedAt?: string;
}

export type FinancialEventType =
  | 'PAYMENT_CREATED'
  | 'PAYMENT_PAID'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_CANCELLED'
  | 'REFUND_REQUESTED'
  | 'REFUND_COMPLETED'
  | 'PLATFORM_FEE_RECORDED'
  | 'PAYOUT_PENDING'
  | 'PAYOUT_HELD'
  | 'PAYOUT_AVAILABLE'
  | 'PAYOUT_PAID'
  | 'CHARGEBACK_RECEIVED';

export interface FinancialEvent {
  id: string;
  eventType: FinancialEventType;
  bookingId?: string;
  paymentId?: string;
  providerId?: string;
  studentId?: string;
  amountInCents: number;
  platformFeeInCents: number;
  providerAmountInCents: number;
  metadata?: Record<string, any>;
  createdAt: string;
}

export type WebhookEventStatus = 'RECEIVED' | 'PROCESSED' | 'IGNORED' | 'FAILED';

export interface PaymentWebhookEvent {
  id: string;
  gateway: PaymentGatewayType;
  externalEventId: string;
  externalPaymentId?: string;
  eventType: string;
  status: WebhookEventStatus;
  payloadHash?: string;
  receivedAt: string;
  processedAt?: string;
  errorMessage?: string;
}

export interface CreatePaymentRequest {
  bookingId: string;
  method: PaymentMethodType;
  idempotencyKey: string;
  gatewayToken?: string; // Tokenized card ID or gateway token (NEVER raw PAN/CVV)
  cardHolderName?: string;
  cardInstallments?: number;
}

export interface RefundPaymentRequest {
  paymentId: string;
  amountInCents?: number; // Optional if full refund
  reason: string;
  idempotencyKey: string;
  cancelledByRole?: UserRole;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: string;
  newValue?: string;
  timestamp: string;
  ipAddress: string;
}

// ==========================================
// SPRINT 13 — BOOKING CHAT, REVIEWS & IN-APP NOTIFICATIONS
// ==========================================

export interface Conversation {
  id: string;
  bookingId: string;
  studentId: string;
  providerId: string;
  instructorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

export interface Review {
  id: string;
  bookingId: string;
  studentId: string;
  providerId: string;
  instructorId: string;
  ratingOverall: number;
  ratingDidactics?: number;
  ratingPunctuality?: number;
  ratingSafety?: number;
  ratingVehicle?: number;
  ratingCordiality?: number;
  comment?: string;
  createdAt: string;
  updatedAt?: string;
}

export type NotificationType =
  | 'BOOKING_CONFIRMED'
  | 'BOOKING_CANCELLED'
  | 'NEW_MESSAGE'
  | 'STUDENT_CHECKIN'
  | 'PROVIDER_CHECKIN'
  | 'LESSON_STARTED'
  | 'LESSON_COMPLETED'
  | 'CONTESTATION_UPDATED'
  | 'COMPLIANCE_PENDING'
  | 'PAYOUT_PAID'
  | 'PAYOUT_BLOCKED'
  | 'PAYOUT_FAILED'
  | 'INSTANT_LESSON_OFFER'
  | 'REVIEW_AVAILABLE'
  | 'REVIEW_RECEIVED';

export type NotificationAppContext = 'STUDENT' | 'PRO' | 'ADMIN';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
  appContext?: NotificationAppContext;
  navigationAction?: 'details' | 'chat' | 'review' | 'reviews' | 'compliance' | 'instant_offer';
}

// ==========================================
// MARKETPLACE ANALYTICS TYPES (SPRINT 14)
// ==========================================

export type AnalyticsPeriodPreset = 7 | 30 | 90;

export type ProductAnalyticsEventName =
  | 'PROVIDER_SEARCH'
  | 'PROVIDER_PROFILE_VIEW'
  | 'AVAILABLE_SLOTS_VIEW'
  | 'CHECKOUT_STARTED'
  | 'CHECKOUT_CANCELLED';

export interface AnalyticsPeriod {
  from: string;
  to: string;
  timezone: 'America/Sao_Paulo';
}

export interface AdminAnalyticsSummary {
  period: AnalyticsPeriod;
  users: {
    active_students: number;
    active_instructor_users: number;
    active_school_admin_users: number;
    active_users_total: number;
  };
  supply: {
    active_providers: number;
    active_individual_providers: number;
    active_driving_schools: number;
    active_vehicles: number;
    active_offerings: number;
  };
  bookings: {
    created: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    no_show: number;
    expired: number;
  };
  funnel: {
    quotes_created: number;
    bookings_created: number;
    payments_created: number;
    payments_paid: number;
    quote_to_booking_rate: number | null;
    booking_to_paid_rate: number | null;
  };
  financial_dev: {
    paid_volume_cents: number;
    platform_fee_volume_cents: number;
    refund_volume_cents: number;
    payout_pending_cents: number;
    payout_paid_cents: number;
    label: string;
  };
  quality: {
    reviews_created: number;
    rating_average: number | null;
  };
  engagement: {
    provider_searches: number;
    provider_profile_views: number;
    available_slots_views: number;
    checkout_started: number;
    checkout_cancelled: number;
  };
}

export interface ProviderAnalyticsSummary {
  period: AnalyticsPeriod;
  provider_contexts: number;
  bookings: {
    created: number;
    confirmed: number;
    completed: number;
    cancelled: number;
    no_show: number;
    upcoming: number;
  };
  financial_dev: {
    payments_paid: number;
    paid_volume_cents: number;
    platform_fee_volume_cents: number;
    label: string;
  };
  quality: {
    reviews_count: number;
    rating_average: number | null;
  };
  supply: {
    active_vehicles: number;
    active_offerings: number;
  };
}

// ==========================================
// PRO EARNINGS & PERFORMANCE
// ==========================================

export type ProviderEarningsPeriodPreset = 7 | 14 | 30;

export interface ProviderEarningsMetrics {
  net_earned_cents: number;
  received_cents: number;
  to_receive_cents: number;
  blocked_cents: number;
  failed_cents: number;
  lessons_completed: number;
  average_ticket_cents?: number | null;
}

export interface ProviderEarningsSeriesPoint {
  date: string;
  net_earned_cents: number;
  lessons_completed: number;
}

export interface ProviderUpcomingPayout {
  id?: string;
  date: string;
  amount_in_cents: number;
  payout_count: number;
  status?: PayoutStatus;
  payout_ids?: string[];
  failure_reason?: string | null;
}

export interface ProviderPayoutDetail {
  id: string;
  status: PayoutStatus;
  amount_in_cents: number;
  scheduled_release_at: string;
  released_at?: string | null;
  processed_at?: string | null;
  failure_reason?: string | null;
}

export type ProviderReviewDimension = 'didactics' | 'punctuality' | 'safety' | 'vehicle' | 'cordiality';

export interface ProviderEarningsReviews {
  review_count: number;
  distinct_students_count: number;
  rating_overall: number | null;
  dimensions: Record<ProviderReviewDimension, number | null>;
}

export interface ProviderEarningsSummary {
  period: AnalyticsPeriod;
  current: ProviderEarningsMetrics;
  previous: ProviderEarningsMetrics;
  series: ProviderEarningsSeriesPoint[];
  upcoming_payouts: ProviderUpcomingPayout[];
  upcoming_total_cents: number;
  reviews: ProviderEarningsReviews;
  generated_at: string;
}

// ==========================================
// SEARCH & GEO DISCOVERY TYPES (SPRINT 07)
// ==========================================

export interface SearchRequest {
  latitude?: number;
  longitude?: number;
  radiusMeters?: number; // Distance in meters (backend ST_DWithin unit)
  category?: VehicleCategory; // MVP: 'A' | 'B'
  date?: string; // YYYY-MM-DD
  timeRange?: {
    startTime?: string; // HH:mm
    endTime?: string; // HH:mm
  };
  providerType?: ProviderType | 'ALL';
  transmission?: TransmissionType | 'ALL';
  minPriceInCents?: number;
  maxPriceInCents?: number;
  minimumRating?: number;
  page?: number;
  limit?: number;
  cursor?: string;
  sortBy?: 'RECOMMENDED' | 'DISTANCE' | 'RATING' | 'PRICE_ASC' | 'PRICE_DESC';
}

export type PublicMapLocationType =
  | 'MEETING_POINT'
  | 'SERVICE_AREA'
  | 'NEIGHBORHOOD_CENTROID'
  | 'REGIONAL_CENTROID'
  | 'UNAVAILABLE';

export interface PublicMapLocation {
  latitude?: number;
  longitude?: number;
  type: PublicMapLocationType;
  label: string;
}

export interface PublicOfferingSummary {
  id: string;
  vehicleId: string;
  vehicleTitle: string;
  vehicleType: VehicleType;
  category: VehicleCategory;
  transmission: TransmissionType;
  photos: string[];
  durationMinutes: number;
  priceInCents: number;
}

export interface PublicSearchProviderResult {
  providerId: string;
  displayName: string;
  providerType: ProviderType;
  avatarUrl?: string;
  verificationBadge: string; // "Verificado pela plataforma"
  isVerified: boolean;
  ratingAverage: number;
  ratingCount: number;
  ratingSource: 'DEMO' | 'REAL';
  approximateDistanceKm: number; // Rounded e.g. 1.8
  roundedDistanceMeters: number; // Rounded to nearest 100m e.g. 1800
  formattedDistance: string; // "1,8 km"
  neighborhood: string;
  city: string;
  categories: VehicleCategory[];
  transmissions: TransmissionType[];
  startingPriceInCents: number;
  normalizedPricePerFiftyMinInCents: number;
  publicOfferings: PublicOfferingSummary[];
  availableSlotCount: number;
  availableResourceCount?: number; // Aggregated instructor/vehicle count
  nextAvailableSlot?: string;
  nextAvailableCandidate?: AvailabilityCandidate;
  publicMapLocation: PublicMapLocation;
  rankingScore: number;
}

export interface SearchResultResponse {
  results: PublicSearchProviderResult[];
  totalCount: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
  appliedFilters: SearchRequest;
  executionTimeMs: number;
}

export interface SearchRankingConfiguration {
  distanceWeight: number; // e.g. 0.35
  ratingWeight: number; // e.g. 0.25
  priceWeight: number; // e.g. 0.20
  availabilityWeight: number; // e.g. 0.20
  priceNormalizationMinutes?: number; // Configurable duration unit (e.g. 50 minutes)
  benchmarkPriceInCents?: number; // Configurable benchmark price (e.g. R$ 120,00)
  slotDensityMinScore?: number; // Configurable min slot density score (e.g. 0.3)
  slotDensityMaxScore?: number; // Configurable max slot density score (e.g. 1.0)
  slotDensityScaleBaseSlots?: number; // Configurable base slot count for log curve (e.g. 15)
}

// ==========================================
// REGISTRY OF PENDING PRODUCT/ARCHITECTURE DECISIONS
// ==========================================

export const PENDING_DECISIONS = {
  DATABASE_INTEGRATION_VALIDATION_PENDING: 'DATABASE_INTEGRATION_VALIDATION_PENDING',
  RLS_DATABASE_TEST_PENDING: 'RLS_DATABASE_TEST_PENDING',
  GLOBAL_RLS_REGRESSION_TEST_PENDING: 'GLOBAL_RLS_REGRESSION_TEST_PENDING',
  DECISION_PENDING_SUSPENDED_ACCESS_POLICY: 'DECISION_PENDING_SUSPENDED_ACCESS_POLICY',
  DECISION_PENDING_SCHOOL_STAFF_VEHICLE_OFFERING_PERMISSIONS: 'DECISION_PENDING_SCHOOL_STAFF_VEHICLE_OFFERING_PERMISSIONS',
  DECISION_PENDING_SCHOOL_STAFF_AVAILABILITY_PERMISSIONS: 'DECISION_PENDING_SCHOOL_STAFF_AVAILABILITY_PERMISSIONS',
  VEHICLE_MEDIA_STORAGE_PENDING: 'VEHICLE_MEDIA_STORAGE_PENDING',
  DECISION_PENDING_SCHOOL_INSTRUCTOR_SELECTION: 'DECISION_PENDING_SCHOOL_INSTRUCTOR_SELECTION',
  GEOCODING_PROVIDER_PRODUCTION_PENDING: 'GEOCODING_PROVIDER_PRODUCTION_PENDING',
  MAP_TILE_PROVIDER_PRODUCTION_PENDING: 'MAP_TILE_PROVIDER_PRODUCTION_PENDING',
  SEARCH_RATE_LIMITING_PENDING: 'SEARCH_RATE_LIMITING_PENDING',
  DECISION_PENDING_PLATFORM_FEE_PERCENTAGE: 'DECISION_PENDING_PLATFORM_FEE_PERCENTAGE',
  DECISION_PENDING_GATEWAY_FEE_ALLOCATION: 'DECISION_PENDING_GATEWAY_FEE_ALLOCATION',
  DECISION_PENDING_PAYOUT_SETTLEMENT_MODEL: 'DECISION_PENDING_PAYOUT_SETTLEMENT_MODEL',
  DECISION_PENDING_CANCELLATION_POLICY: 'DECISION_PENDING_CANCELLATION_POLICY',
  PAYMENT_GATEWAY_SANDBOX_VALIDATION_PENDING: 'PAYMENT_GATEWAY_SANDBOX_VALIDATION_PENDING',
  PAYMENT_SPLIT_SANDBOX_VALIDATION_PENDING: 'PAYMENT_SPLIT_SANDBOX_VALIDATION_PENDING',
} as const;

