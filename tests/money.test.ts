import { describe, it, expect } from 'vitest';
import {
  formatCentsToBRL,
  calculatePlatformFeeAndPayout,
  addCents,
  subtractCents,
} from '../src/domain/money';

describe('Domain: Money in Cents (Anti-Float Precision)', () => {
  it('formats cents to standard Brazilian Real currency format', () => {
    expect(formatCentsToBRL(10000)).toBe('R$ 100,00');
    expect(formatCentsToBRL(12550)).toBe('R$ 125,50');
    expect(formatCentsToBRL(0)).toBe('R$ 0,00');
    expect(formatCentsToBRL(99)).toBe('R$ 0,99');
    expect(formatCentsToBRL(1500000)).toBe('R$ 15.000,00');
  });

  it('calculates platform fee (10%) and provider payout without float rounding errors', () => {
    // R$ 130,00 -> 13000 cents
    const { platformFeeInCents, providerPayoutInCents } = calculatePlatformFeeAndPayout(13000, 10);
    expect(platformFeeInCents).toBe(1300); // R$ 13,00
    expect(providerPayoutInCents).toBe(11700); // R$ 117,00
    expect(platformFeeInCents + providerPayoutInCents).toBe(13000);
  });

  it('handles edge case odd cent fee calculations with exact integer closure', () => {
    // R$ 125,50 -> 12550 cents -> 10% is 1255 cents
    const { platformFeeInCents, providerPayoutInCents } = calculatePlatformFeeAndPayout(12550, 10);
    expect(platformFeeInCents).toBe(1255);
    expect(providerPayoutInCents).toBe(11295);
    expect(platformFeeInCents + providerPayoutInCents).toBe(12550);
  });

  it('safely adds and subtracts monetary integers in cents', () => {
    expect(addCents(10000, 2500, 50)).toBe(12550);
    expect(subtractCents(12550, 2500)).toBe(10050);
  });
});
