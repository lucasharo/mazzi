import {
  formatCurrencyBRL,
  formatDatePtBR,
  formatTimePtBR,
} from './email-formatters.ts';
import { assertPublicReference } from './email-references.ts';
import { buildEmailUrls, type EmailRuntimeConfig } from './email-config.ts';
import type {
  ProBookingConfirmedParams,
  ProPayoutCompletedParams,
  StudentCancellationRefundParams,
  StudentPaymentConfirmedParams,
  StudentRefundCompletedParams,
} from './email-types.ts';

export interface CanonicalVehicleEmailData {
  brand: string;
  model: string;
  year: number;
  transmission: string;
  color: string;
}

export interface CanonicalBookingEmailData {
  id: string;
  publicReference: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  priceInCents: number;
  platformFeeInCents: number;
  totalInCents: number;
  licenseCategory: string;
  studentName: string;
  providerName: string;
  providerFirstName: string;
  vehicle: CanonicalVehicleEmailData;
}

export interface CanonicalPaymentEmailData {
  publicReference: string;
  amountInCents: number;
}

export interface CanonicalRefundEmailData {
  amountInCents: number;
}

export interface CanonicalPayoutEmailData {
  publicReference: string;
  amountInCents: number;
  grossAmountInCents: number;
  platformFeeInCents: number;
  releasedAt: string;
  method: string;
  bankName: string;
  bankBranchLast2: string;
  bankAccountLast4: string;
  providerFirstName: string;
}

export interface EmailAssemblerContext {
  config: EmailRuntimeConfig;
  booking: CanonicalBookingEmailData;
  payment?: CanonicalPaymentEmailData;
  refund?: CanonicalRefundEmailData;
}

function transmissionLabel(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (normalized === 'AUTOMATIC' || normalized === 'AUTOMÁTICO') return 'Automático';
  if (normalized === 'MANUAL') return 'Manual';
  return value.trim();
}

function vehicleParams(vehicle: CanonicalVehicleEmailData) {
  return {
    vehicle_brand: vehicle.brand.trim(),
    vehicle_model: vehicle.model.trim(),
    vehicle_year: String(vehicle.year),
    vehicle_transmission: transmissionLabel(vehicle.transmission),
    vehicle_color: vehicle.color.trim(),
  };
}

function bookingParams(context: EmailAssemblerContext) {
  const { booking } = context;
  const urls = buildEmailUrls(context.config, { bookingReference: booking.publicReference });
  return {
    provider_name: booking.providerName.trim(),
    lesson_date: formatDatePtBR(booking.scheduledStartAt),
    lesson_start_time: formatTimePtBR(booking.scheduledStartAt),
    lesson_end_time: formatTimePtBR(booking.scheduledEndAt),
    license_category: booking.licenseCategory.trim(),
    ...vehicleParams(booking.vehicle),
    booking_reference: assertPublicReference(booking.publicReference, 'booking_reference'),
    lesson_url: urls.studentLesson || '',
  };
}

export function buildStudentPaymentConfirmedEmailData(context: EmailAssemblerContext): StudentPaymentConfirmedParams {
  if (!context.payment) throw new Error('EMAIL_PAYMENT_REQUIRED');
  const { booking, payment, config } = context;
  const urls = buildEmailUrls(config, {
    bookingReference: booking.publicReference,
    paymentReference: payment.publicReference,
  });
  return {
    student_name: booking.studentName.trim(),
    total_paid: formatCurrencyBRL(booking.totalInCents),
    lesson_amount: formatCurrencyBRL(booking.priceInCents),
    payment_reference: assertPublicReference(payment.publicReference, 'payment_reference'),
    provider_name: booking.providerName.trim(),
    lesson_date: formatDatePtBR(booking.scheduledStartAt),
    lesson_start_time: formatTimePtBR(booking.scheduledStartAt),
    lesson_end_time: formatTimePtBR(booking.scheduledEndAt),
    license_category: booking.licenseCategory.trim(),
    ...vehicleParams(booking.vehicle),
    lesson_url: urls.studentLesson || '',
  };
}

export function buildStudentCancellationRefundEmailData(context: EmailAssemblerContext): StudentCancellationRefundParams {
  if (!context.payment || !context.refund) throw new Error('EMAIL_REFUND_AND_PAYMENT_REQUIRED');
  const { booking, payment, refund, config } = context;
  const urls = buildEmailUrls(config, { paymentReference: payment.publicReference });
  return {
    mazzi_logo_src: config.logoUrl,
    student_name: booking.studentName.trim(),
    provider_name: booking.providerName.trim(),
    lesson_date: formatDatePtBR(booking.scheduledStartAt),
    lesson_start_time: formatTimePtBR(booking.scheduledStartAt),
    lesson_end_time: formatTimePtBR(booking.scheduledEndAt),
    license_category: booking.licenseCategory.trim(),
    ...vehicleParams(booking.vehicle),
    amount_paid: formatCurrencyBRL(payment.amountInCents),
    refund_amount: formatCurrencyBRL(refund.amountInCents),
    payment_reference: assertPublicReference(payment.publicReference, 'payment_reference'),
    refund_details_url: urls.refundDetails || '',
  };
}

export function buildStudentRefundCompletedEmailData(context: EmailAssemblerContext): StudentRefundCompletedParams {
  return buildStudentCancellationRefundEmailData(context);
}

export function buildProBookingConfirmedEmailData(context: EmailAssemblerContext): ProBookingConfirmedParams {
  const { booking, config } = context;
  const urls = buildEmailUrls(config, { bookingReference: booking.publicReference });
  return {
    mazzi_logo_src: config.logoUrl,
    provider_first_name: booking.providerFirstName.trim(),
    student_name: booking.studentName.trim(),
    lesson_date: formatDatePtBR(booking.scheduledStartAt),
    lesson_start_time: formatTimePtBR(booking.scheduledStartAt),
    lesson_end_time: formatTimePtBR(booking.scheduledEndAt),
    license_category: booking.licenseCategory.trim(),
    ...vehicleParams(booking.vehicle),
    lesson_amount: formatCurrencyBRL(booking.priceInCents),
    mazzi_fee_amount: formatCurrencyBRL(booking.platformFeeInCents),
    provider_expected_amount: formatCurrencyBRL(booking.priceInCents),
    booking_reference: assertPublicReference(booking.publicReference, 'booking_reference'),
    lesson_url: urls.proLesson || '',
  };
}

export function buildProPayoutCompletedEmailData(input: {
  config: EmailRuntimeConfig;
  payout: CanonicalPayoutEmailData;
}): ProPayoutCompletedParams {
  const { payout, config } = input;
  const urls = buildEmailUrls(config, { payoutReference: payout.publicReference });
  const bankFragmentsUnavailable = payout.bankBranchLast2 === 'não informado' && payout.bankAccountLast4 === 'não informado';
  if (!bankFragmentsUnavailable && (!/^\d{2}$/.test(payout.bankBranchLast2) || !/^\d{4}$/.test(payout.bankAccountLast4))) {
    throw new Error('EMAIL_BANK_FRAGMENT_INVALID');
  }
  return {
    mazzi_logo_src: config.logoUrl,
    provider_first_name: payout.providerFirstName.trim(),
    payout_amount: formatCurrencyBRL(payout.amountInCents),
    payout_date: formatDatePtBR(payout.releasedAt),
    payout_method: payout.method.trim(),
    bank_name: payout.bankName.trim(),
    bank_branch_last2: payout.bankBranchLast2,
    bank_account_last4: payout.bankAccountLast4,
    gross_amount: formatCurrencyBRL(payout.grossAmountInCents),
    mazzi_fee_amount: formatCurrencyBRL(payout.platformFeeInCents),
    payout_reference: assertPublicReference(payout.publicReference, 'payout_reference'),
    earnings_url: urls.earnings || '',
  };
}
