import { describe, it, expect } from 'vitest';
import {
  calculateCancellationPolicy,
  DEFAULT_DEVELOPMENT_POLICY,
  CancellationPolicyConfig,
} from '../src/domain/cancellation';

describe('Domain: Configurable Cancellation & Refund Policies', () => {
  const baseParams = {
    totalPaidInCents: 14300, // R$ 143,00 (R$ 130 lesson + R$ 13 platform fee)
    lessonPriceInCents: 13000,
    platformFeeInCents: 1300,
  };

  it('refunds 100% when cancellation is initiated by Provider regardless of time', () => {
    const result = calculateCancellationPolicy({
      ...baseParams,
      cancelledBy: 'PROVIDER',
      hoursUntilLesson: 2,
    });

    expect(result.refundPercentage).toBe(100);
    expect(result.refundAmountInCents).toBe(14300);
    expect(result.providerCompensationInCents).toBe(0);
    expect(result.platformFeeRetainedInCents).toBe(0);
  });

  it('uses DEFAULT_DEVELOPMENT_POLICY with 100% refund for > 24 hours notice by student', () => {
    const result = calculateCancellationPolicy({
      ...baseParams,
      cancelledBy: 'STUDENT',
      hoursUntilLesson: 48,
    });

    expect(result.refundPercentage).toBe(100);
    expect(result.refundAmountInCents).toBe(14300);
    expect(result.providerCompensationInCents).toBe(0);
    expect(result.platformFeeRetainedInCents).toBe(0);
  });

  it('uses DEFAULT_DEVELOPMENT_POLICY with 50% refund between 6h and 24h notice by student', () => {
    const result = calculateCancellationPolicy({
      ...baseParams,
      cancelledBy: 'STUDENT',
      hoursUntilLesson: 12,
    });

    expect(result.refundPercentage).toBe(50);
    expect(result.refundAmountInCents).toBe(7150); // 50% of 14300
    expect(result.providerCompensationInCents).toBe(6500); // 50% of 13000
    expect(
      result.refundAmountInCents +
        result.providerCompensationInCents +
        result.platformFeeRetainedInCents
    ).toBe(14300);
  });

  it('uses DEFAULT_DEVELOPMENT_POLICY with 0% refund for < 6 hours notice by student', () => {
    const result = calculateCancellationPolicy({
      ...baseParams,
      cancelledBy: 'STUDENT',
      hoursUntilLesson: 3,
    });

    expect(result.refundPercentage).toBe(0);
    expect(result.refundAmountInCents).toBe(0);
    expect(result.providerCompensationInCents).toBe(13000);
    expect(result.platformFeeRetainedInCents).toBe(1300);
  });

  it('supports custom administrative policy configuration dynamically injected', () => {
    // Custom strict policy: > 48h = 100%, 12-48h = 70%, < 12h = 0%
    const customAdminPolicy: CancellationPolicyConfig = {
      version: 'CUSTOM_TEST_POLICY',
      providerInitiatedRefundPercentage: 100,
      noShowStudentRefundPercentage: 0,
      noShowProviderRefundPercentage: 100,
      studentInitiatedRules: [
        {
          minHoursBeforeLesson: 48,
          studentRefundPercentage: 100,
          providerCompensationPercentage: 0,
          platformFeeRetainedPercentage: 0,
          description: 'Regra Customizada > 48h',
        },
        {
          minHoursBeforeLesson: 12,
          studentRefundPercentage: 70,
          providerCompensationPercentage: 30,
          platformFeeRetainedPercentage: 0,
          description: 'Regra Customizada 12-48h',
        },
        {
          minHoursBeforeLesson: 0,
          studentRefundPercentage: 0,
          providerCompensationPercentage: 100,
          platformFeeRetainedPercentage: 100,
          description: 'Regra Customizada < 12h',
        },
      ],
    };

    const resultWithCustomPolicy = calculateCancellationPolicy({
      ...baseParams,
      cancelledBy: 'STUDENT',
      hoursUntilLesson: 20, // Between 12h and 48h
      policyConfig: customAdminPolicy,
    });

    expect(resultWithCustomPolicy.refundPercentage).toBe(70);
    expect(resultWithCustomPolicy.refundAmountInCents).toBe(Math.round(14300 * 0.7)); // 10010
  });
});
