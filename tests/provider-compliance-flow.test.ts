import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (file: string) => readFileSync(file, 'utf8');
const providerApp = read('src/apps/provider/ProviderApp.tsx');
const managementTab = read('src/apps/provider/components/ProviderManagementTab.tsx');
const dashboardTab = read('src/apps/provider/components/ProviderDashboardTab.tsx');
const invitationMigration = read('supabase/migrations/20260905103000_school_invitation_contexts.sql');
const dbService = read('src/lib/db-service.ts');
const adminComponents = read('src/apps/admin/AdminComponents.tsx');
const errorMapper = read('src/lib/error-mapper.ts');
const globalCompliance = read('src/domain/compliance.ts');
const storageMigration = read('supabase/migrations/20260814000005_compliance_regulatory_hardening.sql');
const runtimeMigration = read('supabase/migrations/20260821212131_school_compliance_runtime_rpcs.sql');
const ownerAccessMigration = read('supabase/migrations/20260905100000_fix_school_owner_admin_access.sql');

describe('provider offering and compliance reconciliation contracts', () => {
  it('keeps the server-side offering RPC as the lifecycle authority', () => {
    expect(dbService).toContain("sp.rpc('provider_save_service_offering'");
  });

  it('allows a non-active provider to prepare an inactive offering while keeping publication blocked', () => {
    expect(providerApp).toContain("initialStatus: currentProvider.status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE'");
    expect(providerApp).toContain('onToggleOfferingStatus');
    expect(managementTab).not.toContain("disabled={currentProvider.status !== 'ACTIVE'");
    expect(managementTab).toContain('Status atual:');
  });

  it('does not expose a client path to change provider status', () => {
    expect(providerApp).not.toMatch(/updateProviderStatus\([^)]*['"]ACTIVE['"]/);
    expect(providerApp).not.toMatch(/\.from\(['"]providers['"]\)[\s\S]{0,160}\.update/);
  });

  it('keeps the authoritative inactive-provider rejection in the migration', () => {
    const offeringMigration = read('supabase/migrations/20260824124740_task_094_vehicle_offering_lifecycle_authority.sql');
    expect(offeringMigration).toContain('OFFERING_PROVIDER_NOT_ACTIVE');
    expect(offeringMigration).toContain("v_provider.status <> 'ACTIVE'");
  });

  it('maps lifecycle errors to actionable messages', () => {
    expect(errorMapper).toContain('OFFERING_PROVIDER_NOT_ACTIVE');
    expect(errorMapper).toContain('OFFERING_VEHICLE_NOT_ACTIVE');
    expect(errorMapper).toContain('OFFERING_INSTRUCTOR_NOT_ELIGIBLE');
    expect(errorMapper).toContain('DUPLICATE_ACTIVE_OFFERING');
  });

  it('defines the canonical global document types', () => {
    expect(globalCompliance).toContain('USER_GLOBAL_COMPLIANCE_DOCUMENT_TYPES');
    expect(globalCompliance).toContain("'CNH_EAR'");
    expect(globalCompliance).toContain("'CREDENTIAL_DETRAN'");
    expect(globalCompliance).toContain("'CRIMINAL_BACKGROUND'");
  });

  it('routes global instructor uploads through the global scope', () => {
    expect(providerApp).toContain('USER_GLOBAL_COMPLIANCE_DOCUMENT_TYPES.has(uploadModalDocType)');
    expect(providerApp).toContain("scope: isGlobalDocument ? 'USER_GLOBAL' : 'PROVIDER'");
    expect(providerApp).toContain('providerId: isGlobalDocument ? undefined : currentProvider.id');
  });

  it('does not let the browser choose the persisted global user_id', () => {
    const uploadStart = providerApp.indexOf('await dbService.saveComplianceDoc({');
    const uploadEnd = providerApp.indexOf('setSelectedComplianceFile(null);', uploadStart);
    const uploadSource = providerApp.slice(uploadStart, uploadEnd);
    expect(uploadSource).not.toContain('userId:');
    expect(runtimeMigration).toContain('user_id, vehicle_id, membership_id, scope');
    expect(runtimeMigration).toContain('auth.uid()');
  });

  it('keeps provider-owned documents in provider scope', () => {
    expect(providerApp).toContain("scope: isGlobalDocument ? 'USER_GLOBAL' : 'PROVIDER'");
    expect(dbService).toContain("if (scope !== 'PROVIDER' || !doc.providerId");
  });

  it('uses the private compliance storage bucket contract', () => {
    expect(providerApp).toContain(".from('provider-compliance-docs')");
    expect(storageMigration).toContain("'provider-compliance-docs'");
    expect(storageMigration).toContain('public = FALSE');
  });

  it('removes the storage object when database persistence fails', () => {
    expect(providerApp).toContain(".remove([storagePath])");
    expect(providerApp).toContain('Compliance document upload failed');
  });

  it('keeps global reads scoped by authenticated user', () => {
    expect(dbService).toContain("sp.rpc('list_my_global_compliance')");
    expect(runtimeMigration).toContain('d.user_id = auth.uid()');
    expect(runtimeMigration).toContain("d.scope = 'USER_GLOBAL'::public.compliance_document_scope");
  });

  it('projects scope and membership relationship in the Admin read', () => {
    expect(dbService).toContain('membership_id,scope,document_type');
    expect(dbService).toContain('async getAdminComplianceDocs()');
  });

  it('joins global instructor documents to the Admin provider by user_id only', () => {
    expect(adminComponents).toContain("d.scope === 'USER_GLOBAL'");
    expect(adminComponents).toContain('d.userId === selectedProv.userId');
    expect(adminComponents).toContain("selectedProv.type === 'INSTRUCTOR'");
  });

  it('does not expose private storage paths to the Admin projection', () => {
    expect(dbService).not.toContain('membership_id,scope,document_type,status,rejection_reason,expires_at,reviewed_by,reviewed_at,created_at,storage_path');
    expect(adminComponents).not.toContain('selectedDoc.storagePath');
  });

  it('preserves reviewer authorization and private storage RLS', () => {
    expect(runtimeMigration).toContain('public.is_compliance_reviewer()');
    expect(storageMigration).toContain('is_compliance_reviewer()');
    expect(storageMigration).toContain('bucket_id = \'provider-compliance-docs\'');
  });

  it('recognizes an active direct school owner as an administrator', () => {
    expect(ownerAccessMigration).toContain("p.type = 'DRIVING_SCHOOL'");
    expect(ownerAccessMigration).toContain('p.user_id = auth.uid()');
    expect(ownerAccessMigration).toContain("u.status = 'ACTIVE'");
    expect(ownerAccessMigration).toContain("role = 'SCHOOL_ADMIN'");
  });

  it('shows pending school invitations on the instructor dashboard', () => {
    expect(managementTab).not.toContain("label: 'Convites'");
    expect(dashboardTab).toContain('schoolInvitations');
    expect(dashboardTab).toContain('Abrir convite de autoescola');
    expect(dashboardTab).toContain('onAcceptSchoolInvitation');
    expect(dashboardTab).toContain('onDeclineSchoolInvitation');
    expect(invitationMigration).toContain('school_avatar_url');
    expect(invitationMigration).toContain('COALESCE(p.trade_name, p.legal_name)');
  });

  it('separates approved compliance from the school membership lifecycle', () => {
    const memberships = read('src/apps/provider/components/SchoolMembershipPanel.tsx');
    expect(memberships).toContain('const complianceApproved = compliance?.globalComplianceValid === true && compliance.membershipComplianceValid === true;');
    expect(memberships).toContain("complianceApproved ? 'Compliance aprovado' : 'Compliance pendente'");
  });

  it('keeps MAZZI terms acceptance independent from the other compliance documents', () => {
    expect(managementTab).toContain("document.type === 'MAZZI_TERMS_ACCEPTANCE'");
    expect(managementTab).toContain('<ProfessionalTermsViewer');
    expect(managementTab).toContain('const accepted = await onAcceptComplianceTerms();');
    expect(managementTab).not.toContain('hasPendingCompliance && isTermsAcceptance');
  });
});
