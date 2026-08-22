// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { membershipId, tryActivate, endMembership } = vi.hoisted(() => ({
  membershipId: '7c309d68-5a6a-4aad-9b70-2d7e711827c3',
  tryActivate: vi.fn().mockResolvedValue({}),
  endMembership: vi.fn().mockResolvedValue({}),
}));

vi.mock('../src/lib/db-service', () => ({
  dbService: {
    listMySchoolInvitations: vi.fn().mockResolvedValue([]),
    listSchoolMemberships: vi.fn().mockResolvedValue([{
      id: membershipId,
      userId: 'f5b6e7d8-c901-42a3-b456-789012345678',
      name: 'Marcos Vinícius Prado',
      email: 'instrutor03@mazzi.com.br',
      membershipStatus: 'PENDING_COMPLIANCE',
      isActive: false,
    }]),
    listSchoolInstructorInvitations: vi.fn().mockResolvedValue([]),
    getSchoolInstructorComplianceSummary: vi.fn().mockResolvedValue([{
      membershipId,
      membershipStatus: 'PENDING_COMPLIANCE',
      globalComplianceValid: true,
      membershipComplianceValid: false,
      eligible: true,
    }]),
    tryActivateSchoolInstructorMembership: tryActivate,
    endSchoolInstructorMembership: endMembership,
  },
}));

import { SchoolMembershipPanel } from '../src/apps/provider/components/SchoolMembershipPanel';

describe('SchoolMembershipPanel', () => {
  it('renders the mapped instructor and activates using the real membership UUID', async () => {
    render(
      <SchoolMembershipPanel
        provider={{ id: 'school-1', type: 'DRIVING_SCHOOL' } as any}
        isInstructor={false}
        isInviteModalOpen
        onOpenInviteModal={vi.fn()}
        onCloseInviteModal={vi.fn()}
      />,
    );

    expect(await screen.findByText('Marcos Vinícius Prado')).toBeTruthy();
    expect(screen.getByText('instrutor03@mazzi.com.br')).toBeTruthy();
    expect(screen.getByText('Elegível')).toBeTruthy();
    expect(screen.getByPlaceholderText('E-mail do instrutor')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Convidar' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Ativar' }));

    await waitFor(() => expect(tryActivate).toHaveBeenCalledWith(membershipId));
    expect(tryActivate.mock.calls[0][0]).not.toBeUndefined();
  });

  it('confirms removal and ends the membership through the secure RPC', async () => {
    render(
      <SchoolMembershipPanel
        provider={{ id: 'school-1', type: 'DRIVING_SCHOOL' } as any}
        isInstructor={false}
        isInviteModalOpen={false}
        onOpenInviteModal={vi.fn()}
        onCloseInviteModal={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Remover instrutor' }));
    expect(await screen.findByText(/da autoescola\?/)).toBeTruthy();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remover instrutor' }));

    await waitFor(() => expect(endMembership).toHaveBeenCalledWith(membershipId, 'Removido pela autoescola'));
  });
});
