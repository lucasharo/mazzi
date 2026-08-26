/**
 * Single Source of Truth for Authentication Constants across MAZZI Platform.
 * Ensures OTP token lengths, regex patterns, and timeouts stay 100% aligned.
 */

export const AUTH_OTP_LENGTH = 6;
export const AUTH_OTP_REGEX = /^\d{6}$/;
export const AUTH_OTP_CLEAN_REGEX = /\D/g;
export const AUTH_OTP_RESEND_COOLDOWN_SECONDS = 60;
