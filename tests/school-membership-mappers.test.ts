import { describe, expect, it } from 'vitest';
import {
  mapSchoolInstructorComplianceSummaryFromDb,
  mapSchoolMembershipFromDb,
} from '../src/lib/db-service';

describe('school membership RPC mappers', () => {
  it('maps the membership RPC contract to the UI model', () => {
    expect(mapSchoolMembershipFromDb({
      membership_id: '7c309d68-5a6a-4aad-9b70-2d7e711827c3',
      user_id: 'f5b6e7d8-c901-42a3-b456-789012345678',
      instructor_name: 'Marcos Vinícius Prado',
      instructor_email: 'instrutor03@mazzi.com.br',
      membership_status: 'PENDING_COMPLIANCE',
      is_active: false,
      accepted_at: null,
    })).toEqual({
      id: '7c309d68-5a6a-4aad-9b70-2d7e711827c3',
      userId: 'f5b6e7d8-c901-42a3-b456-789012345678',
      name: 'Marcos Vinícius Prado',
      email: 'instrutor03@mazzi.com.br',
      membershipStatus: 'PENDING_COMPLIANCE',
      isActive: false,
      acceptedAt: undefined,
    });
  });

  it('maps overall_eligible without relying on an ambiguous eligible field', () => {
    expect(mapSchoolInstructorComplianceSummaryFromDb({
      membership_id: 'membership-1',
      membership_status: 'ACTIVE',
      global_compliance_valid: true,
      membership_compliance_valid: true,
      overall_eligible: true,
      valid_until: '2026-12-31',
    }).eligible).toBe(true);

    expect(mapSchoolInstructorComplianceSummaryFromDb({
      membership_id: 'membership-2',
      membership_status: 'PENDING_COMPLIANCE',
      global_compliance_valid: true,
      membership_compliance_valid: false,
      overall_eligible: false,
    }).eligible).toBe(false);
  });
});
