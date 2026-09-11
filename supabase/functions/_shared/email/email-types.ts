export type EmailTemplateName =
  | 'student-payment-confirmed'
  | 'student-cancellation-refund'
  | 'student-refund-completed'
  | 'pro-booking-confirmed'
  | 'pro-payout-completed';

export interface StudentPaymentConfirmedParams {
  mazzi_logo_src?: string;
  student_name: string;
  total_paid: string;
  lesson_amount: string;
  payment_reference: string;
  provider_name: string;
  lesson_date: string;
  lesson_start_time: string;
  lesson_end_time: string;
  license_category: string;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_transmission: string;
  vehicle_color: string;
  lesson_url: string;
}

export interface StudentCancellationRefundParams {
  mazzi_logo_src?: string;
  student_name: string;
  provider_name: string;
  lesson_date: string;
  lesson_start_time: string;
  lesson_end_time: string;
  license_category: string;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_transmission: string;
  vehicle_color: string;
  amount_paid: string;
  refund_amount: string;
  payment_reference: string;
  refund_details_url: string;
}

export interface StudentRefundCompletedParams extends StudentCancellationRefundParams {}

export interface ProBookingConfirmedParams {
  mazzi_logo_src?: string;
  provider_first_name: string;
  student_name: string;
  lesson_date: string;
  lesson_start_time: string;
  lesson_end_time: string;
  license_category: string;
  vehicle_brand: string;
  vehicle_model: string;
  vehicle_year: string;
  vehicle_transmission: string;
  vehicle_color: string;
  lesson_amount: string;
  mazzi_fee_amount: string;
  provider_expected_amount: string;
  booking_reference: string;
  lesson_url: string;
}

export interface ProPayoutCompletedParams {
  mazzi_logo_src?: string;
  provider_first_name: string;
  payout_amount: string;
  payout_date: string;
  payout_method: string;
  bank_name: string;
  bank_branch_last2: string;
  bank_account_last4: string;
  gross_amount: string;
  mazzi_fee_amount: string;
  payout_reference: string;
  earnings_url: string;
}

export interface EmailTemplateParamsMap {
  'student-payment-confirmed': StudentPaymentConfirmedParams;
  'student-cancellation-refund': StudentCancellationRefundParams;
  'student-refund-completed': StudentRefundCompletedParams;
  'pro-booking-confirmed': ProBookingConfirmedParams;
  'pro-payout-completed': ProPayoutCompletedParams;
}

export const EMAIL_TEMPLATE_CONTRACTS: Record<EmailTemplateName, {
  required: readonly string[];
  urls: readonly string[];
}> = {
  'student-payment-confirmed': {
    required: [
      'student_name', 'total_paid', 'lesson_amount', 'payment_reference',
      'provider_name', 'lesson_date', 'lesson_start_time', 'lesson_end_time', 'license_category',
      'vehicle_brand', 'vehicle_model', 'vehicle_year', 'vehicle_transmission', 'vehicle_color', 'lesson_url',
    ],
    urls: ['lesson_url'],
  },
  'student-cancellation-refund': {
    required: [
      'student_name', 'provider_name', 'lesson_date', 'lesson_start_time', 'lesson_end_time',
      'license_category', 'vehicle_brand', 'vehicle_model', 'vehicle_year', 'vehicle_transmission', 'vehicle_color',
      'amount_paid', 'refund_amount', 'payment_reference', 'refund_details_url',
    ],
    urls: ['refund_details_url'],
  },
  'student-refund-completed': {
    required: [
      'student_name', 'provider_name', 'lesson_date', 'lesson_start_time', 'lesson_end_time',
      'license_category', 'vehicle_brand', 'vehicle_model', 'vehicle_year', 'vehicle_transmission', 'vehicle_color',
      'amount_paid', 'refund_amount', 'payment_reference', 'refund_details_url',
    ],
    urls: ['refund_details_url'],
  },
  'pro-booking-confirmed': {
    required: [
      'provider_first_name', 'student_name', 'lesson_date', 'lesson_start_time', 'lesson_end_time',
      'license_category', 'vehicle_brand', 'vehicle_model', 'vehicle_year', 'vehicle_transmission', 'vehicle_color',
      'lesson_amount', 'mazzi_fee_amount', 'provider_expected_amount', 'booking_reference', 'lesson_url',
    ],
    urls: ['lesson_url'],
  },
  'pro-payout-completed': {
    required: [
      'provider_first_name', 'payout_amount', 'payout_date', 'payout_method', 'bank_name',
      'bank_account_last4', 'gross_amount', 'mazzi_fee_amount', 'payout_reference', 'earnings_url',
    ],
    urls: ['earnings_url'],
  },
};

export const EMAIL_TEMPLATE_FILES: Record<EmailTemplateName, string> = {
  'student-payment-confirmed': 'student-payment-confirmed.html',
  'student-cancellation-refund': 'student-cancellation-refund.html',
  'student-refund-completed': 'student-refund-completed.html',
  'pro-booking-confirmed': 'pro-booking-confirmed.html',
  'pro-payout-completed': 'pro-payout-completed.html',
};
