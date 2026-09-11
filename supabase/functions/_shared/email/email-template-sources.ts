/**
 * Runtime-safe transactional email sources for Edge Function deployments.
 * The canonical HTML files remain under /emails for editing and review.
 */
import {
  proBookingConfirmedEmailTemplate,
  proPayoutCompletedEmailTemplate,
  studentCancellationRefundEmailTemplate,
  studentRefundCompletedEmailTemplate,
} from './email-template-sources-v6.ts';

export const EMAIL_TEMPLATE_SOURCES = {
  'student-cancellation-refund': studentCancellationRefundEmailTemplate,
  'student-refund-completed': studentRefundCompletedEmailTemplate,
  'pro-booking-confirmed': proBookingConfirmedEmailTemplate,
  'pro-payout-completed': proPayoutCompletedEmailTemplate,
} as const;
