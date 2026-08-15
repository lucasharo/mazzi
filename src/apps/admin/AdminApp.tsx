// ============================================================================
// MAZZI PLATFORM — SPRINT 12: GOVERNANCE & OPERATIONS ADMIN CONTROL PANEL
// File: src/apps/admin/AdminApp.tsx
// ============================================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../components/auth/AuthContext';
import { dbService } from '../../lib/db-service';
import {
  MOCK_COMPLIANCE_DOCUMENTS,
  MOCK_AUDIT_LOGS,
  MOCK_BOOKINGS,
  MOCK_PROVIDERS,
  MOCK_VEHICLES,
} from '../../data/mockData';
import {
  Provider,
  ComplianceDocument,
  Vehicle,
  Booking,
  AuditLog,
  User,
  UserRole,
} from '../../types';
import {
  approveProvider,
  rejectProvider,
  suspendProvider,
  blockProvider,
  reviewComplianceDocument,
} from '../../domain/provider-lifecycle-service';
import {
  approveVehicle,
  rejectVehicle,
  blockVehicle,
} from '../../domain/vehicles-offerings';
import {
  DEFAULT_PLATFORM_CONFIGURATION,
  updatePlatformConfiguration,
  PlatformConfiguration,
} from '../../domain/platform-config';
import { AuthContext } from '../../domain/rbac';
import {
  evaluateProviderEligibility,
  DEFAULT_COMPLIANCE_REQUIREMENTS,
} from '../../domain/compliance';

// Modular components import
import {
  DashboardTab,
  ProvidersTab,
  ComplianceTab,
  VehiclesTab,
  BookingsTab,
  FinancialTab,
  UsersTab,
  AuditTab,
  SettingsTab,
} from './AdminComponents';

// Pre-defined initial users directory
const INITIAL_USERS: User[] = [
  {
    id: 'usr_admin_1',
    name: 'Carlos Magno (Admin Geral)',
    email: 'admin.carlos@mazzi.com.br',
    phone: '(11) 99999-8888',
    role: 'PLATFORM_ADMIN',
    createdAt: '2026-01-15T08:00:00Z',
  },
  {
    id: 'usr_support_1',
    name: 'Beatriz Lima (Suporte N1)',
    email: 'support.beatriz@mazzi.com.br',
    phone: '(11) 98888-7777',
    role: 'SUPPORT',
    createdAt: '2026-03-10T10:00:00Z',
  },
  {
    id: 'prov_1',
    name: 'Carlos Alberto Silva (Instrutor)',
    email: 'carlos.alberto@gmail.com',
    phone: '(11) 97777-6666',
    role: 'INSTRUCTOR',
    createdAt: '2026-08-01T09:00:00Z',
  },
  {
    id: 'prov_2',
    name: 'Autoescola Paulista (CFC)',
    email: 'contato@autoescolapaulista.com',
    phone: '(11) 5555-4444',
    role: 'SCHOOL_ADMIN',
    createdAt: '2026-08-02T10:00:00Z',
  },
  {
    id: 'usr_student_1',
    name: 'Lucas Ferreira (Aluno)',
    email: 'lucas.ferreira@hotmail.com',
    phone: '(11) 96666-5555',
    role: 'STUDENT',
    createdAt: '2026-08-03T11:00:00Z',
  },
];

export const AdminApp: React.FC = () => {
  const { user } = useAuth();

  // Navigation State
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Core Data States
  const [providers, setProviders] = useState<Provider[]>(MOCK_PROVIDERS);
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocument[]>(MOCK_COMPLIANCE_DOCUMENTS);
  const [vehicles, setVehicles] = useState<Vehicle[]>(MOCK_VEHICLES);
  const [bookings, setBookings] = useState<Booking[]>(MOCK_BOOKINGS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(MOCK_AUDIT_LOGS);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [platformConfig, setPlatformConfig] = useState<PlatformConfiguration>(DEFAULT_PLATFORM_CONFIGURATION);

  // Active Session Toggle (Interactive testing for PLATFORM_ADMIN vs SUPPORT)
  const [currentRole, setCurrentRole] = useState<UserRole>('PLATFORM_ADMIN');

  useEffect(() => {
    if (user?.roles && user.roles.length > 0) {
      setCurrentRole(user.roles[0]);
    }
  }, [user]);

  // Load live data from Supabase
  useEffect(() => {
    async function loadRealData() {
      try {
        const [p, v, b, c, a, configs] = await Promise.all([
          dbService.getProviders(),
          dbService.getVehicles(),
          dbService.getBookings(),
          dbService.getComplianceDocs(),
          dbService.getAuditLogs(),
          dbService.getPlatformConfigs(),
        ]);
        if (p.length > 0) setProviders(p);
        if (v.length > 0) setVehicles(v);
        if (b.length > 0) setBookings(b);
        if (c.length > 0) setComplianceDocs(c);
        if (a.length > 0) setAuditLogs(a);
        
        if (configs.length > 0) {
          const mappedConfig = { ...DEFAULT_PLATFORM_CONFIGURATION };
          for (const item of configs) {
            if (item.key in mappedConfig) {
              (mappedConfig as any)[item.key] = item.value;
            }
          }
          setPlatformConfig(mappedConfig);
        }
      } catch (err) {
        console.error('Failed to load live database state in AdminApp:', err);
      }
    }
    loadRealData();
  }, [user]);

  // Resolved Session Context
  const activeActor: AuthContext = {
    userId: user?.id || (currentRole === 'PLATFORM_ADMIN' ? '11111111-1111-1111-1111-111111111105' : '11111111-1111-1111-1111-111111111106'),
    email: user?.email || (currentRole === 'PLATFORM_ADMIN' ? 'admin.geral@mazzi.com.br' : 'suporte@mazzi.com.br'),
    roles: [currentRole],
    status: 'ACTIVE',
  };

  // Helper eligibility evaluator
  const handleEligibilityCheck = (provider: Provider, docs: ComplianceDocument[]) => {
    return evaluateProviderEligibility(provider, docs, DEFAULT_COMPLIANCE_REQUIREMENTS);
  };

  // ==========================================================================
  // PROVIDER STATE TRANSITIONS HANDLERS
  // ==========================================================================
  const handleApproveProvider = (p: Provider) => {
    const pDocs = complianceDocs.filter((d) => d.providerId === p.id);
    try {
      const result = approveProvider(p, activeActor, pDocs, DEFAULT_COMPLIANCE_REQUIREMENTS);
      setProviders((prev) => prev.map((item) => (item.id === p.id ? result.provider : item)));
      setAuditLogs((prev) => [...result.auditLogs, ...prev]);
    } catch (err: any) {
      alert(`Erro regulatório na aprovação: ${err.message}`);
    }
  };

  const handleRejectProvider = (p: Provider, reason: string) => {
    try {
      const result = rejectProvider(p, activeActor, reason);
      setProviders((prev) => prev.map((item) => (item.id === p.id ? result.provider : item)));
      setAuditLogs((prev) => [...result.auditLogs, ...prev]);
    } catch (err: any) {
      alert(`Erro na rejeição: ${err.message}`);
    }
  };

  const handleSuspendProvider = (p: Provider, reason: string) => {
    try {
      const result = suspendProvider(p, activeActor, reason);
      setProviders((prev) => prev.map((item) => (item.id === p.id ? result.provider : item)));
      setAuditLogs((prev) => [...result.auditLogs, ...prev]);
    } catch (err: any) {
      alert(`Erro na suspensão: ${err.message}`);
    }
  };

  const handleBlockProvider = (p: Provider, reason: string) => {
    try {
      const result = blockProvider(p, activeActor, reason);
      setProviders((prev) => prev.map((item) => (item.id === p.id ? result.provider : item)));
      setAuditLogs((prev) => [...result.auditLogs, ...prev]);
    } catch (err: any) {
      alert(`Erro no bloqueio: ${err.message}`);
    }
  };

  // ==========================================================================
  // COMPLIANCE DOCUMENTS HANDLERS
  // ==========================================================================
  const handleApproveDoc = (doc: ComplianceDocument) => {
    try {
      const result = reviewComplianceDocument(doc, 'APPROVE', activeActor);
      setComplianceDocs((prev) => prev.map((item) => (item.id === doc.id ? result.document : item)));
      setAuditLogs((prev) => [result.auditLog, ...prev]);
    } catch (err: any) {
      alert(`Erro ao aprovar documento: ${err.message}`);
    }
  };

  const handleRejectDoc = (doc: ComplianceDocument, reason: string) => {
    try {
      const result = reviewComplianceDocument(doc, 'REJECT', activeActor, reason);
      setComplianceDocs((prev) => prev.map((item) => (item.id === doc.id ? result.document : item)));
      setAuditLogs((prev) => [result.auditLog, ...prev]);
    } catch (err: any) {
      alert(`Erro ao rejeitar documento: ${err.message}`);
    }
  };

  // ==========================================================================
  // VEHICLE TRANSITION HANDLERS
  // ==========================================================================
  const handleApproveVehicle = (v: Vehicle) => {
    try {
      const provider = providers.find((p) => p.id === v.providerId);
      if (!provider) {
        throw new Error('Prestador proprietário não localizado.');
      }
      const reviewerObj = {
        userId: activeActor.userId,
        email: activeActor.email,
        roles: activeActor.roles,
        status: activeActor.status,
      };
      const result = approveVehicle(v, reviewerObj, provider);
      setVehicles((prev) => prev.map((item) => (item.id === v.id ? result.vehicle : item)));
      setAuditLogs((prev) => [result.auditLog, ...prev]);
    } catch (err: any) {
      alert(`Erro ao aprovar veículo: ${err.message}`);
    }
  };

  const handleRejectVehicle = (v: Vehicle, reason: string) => {
    try {
      const reviewerObj = {
        userId: activeActor.userId,
        email: activeActor.email,
        roles: activeActor.roles,
        status: activeActor.status,
      };
      const result = rejectVehicle(v, reviewerObj, reason);
      setVehicles((prev) => prev.map((item) => (item.id === v.id ? result.vehicle : item)));
      setAuditLogs((prev) => [result.auditLog, ...prev]);
    } catch (err: any) {
      alert(`Erro ao rejeitar veículo: ${err.message}`);
    }
  };

  const handleBlockVehicle = (v: Vehicle, reason: string) => {
    try {
      const reviewerObj = {
        userId: activeActor.userId,
        email: activeActor.email,
        roles: activeActor.roles,
        status: activeActor.status,
      };
      const result = blockVehicle(v, reviewerObj, reason);
      setVehicles((prev) => prev.map((item) => (item.id === v.id ? result.vehicle : item)));
      setAuditLogs((prev) => [result.auditLog, ...prev]);
    } catch (err: any) {
      alert(`Erro ao bloquear veículo: ${err.message}`);
    }
  };

  // ==========================================================================
  // REFUND HANDLER (SIMULATED PAYMENTS INTEGRATION)
  // ==========================================================================
  const handleProcessRefund = (b: Booking) => {
    try {
      if (b.status === 'REFUNDED') {
        throw new Error('Esta aula já foi reembolsada.');
      }
      const now = new Date().toISOString();
      const updatedBooking: Booking = {
        ...b,
        status: 'REFUNDED',
      };

      const audit: AuditLog = {
        id: `aud_${Math.random().toString(36).substring(2, 9)}`,
        actorId: activeActor.userId,
        actorName: activeActor.email,
        actorRole: activeActor.roles[0],
        action: 'PAYMENT_REFUNDED',
        entityType: 'PAYMENT',
        entityId: b.id,
        previousValue: b.status,
        newValue: 'REFUNDED',
        timestamp: now,
        ipAddress: '127.0.0.1',
      };

      setBookings((prev) => prev.map((item) => (item.id === b.id ? updatedBooking : item)));
      setAuditLogs((prev) => [audit, ...prev]);
    } catch (err: any) {
      alert(`Erro no processamento do estorno: ${err.message}`);
    }
  };

  // ==========================================================================
  // USER ROLE MANAGEMENT HANDLER
  // ==========================================================================
  const handleChangeRole = (userId: string, newRole: UserRole) => {
    // 1. Least Privilege Check: SUPPORT role denied
    if (!activeActor.roles.includes('PLATFORM_ADMIN')) {
      throw new Error('Acesso Negado: Apenas PLATFORM_ADMIN possui autorização para alterar papéis.');
    }

    // 2. Last Platform Admin Protection
    const userToEdit = users.find((u) => u.id === userId);
    if (!userToEdit) {
      throw new Error('Usuário não localizado.');
    }

    if (userToEdit.role === 'PLATFORM_ADMIN' && newRole !== 'PLATFORM_ADMIN') {
      const adminCount = users.filter((u) => u.role === 'PLATFORM_ADMIN').length;
      if (adminCount <= 1) {
        throw new Error(
          'Violação de Segurança: Não é possível rebaixar o único PLATFORM_ADMIN ativo do sistema (last_platform_admin_protection).'
        );
      }
    }

    const now = new Date().toISOString();
    const updatedUser: User = {
      ...userToEdit,
      role: newRole,
    };

    const audit: AuditLog = {
      id: `aud_${Math.random().toString(36).substring(2, 9)}`,
      actorId: activeActor.userId,
      actorName: activeActor.email,
      actorRole: activeActor.roles[0],
      action: 'USER_ROLE_UPDATED',
      entityType: 'USER',
      entityId: userId,
      previousValue: userToEdit.role,
      newValue: newRole,
      timestamp: now,
      ipAddress: '127.0.0.1',
    };

    setUsers((prev) => prev.map((item) => (item.id === userId ? updatedUser : item)));
    setAuditLogs((prev) => [audit, ...prev]);
  };

  // ==========================================================================
  // PLATFORM CONFIGURATION UPDATE HANDLER
  // ==========================================================================
  const handleUpdateConfig = (updates: Partial<PlatformConfiguration>) => {
    try {
      const result = updatePlatformConfiguration({
        currentConfig: platformConfig,
        actor: activeActor,
        updates,
      });
      setPlatformConfig(result.config);
      setAuditLogs((prev) => [result.auditLog, ...prev]);
    } catch (err: any) {
      alert(`Erro ao alterar configurações: ${err.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 w-full">
      {/* Top Main Navigation Header */}
      <header className="bg-slate-950 text-white px-6 py-4.5 border-b border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-500 text-slate-950 font-black flex items-center justify-center text-xl shadow-md border border-amber-300/20">
            M
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-tight text-white">MAZZI</span>
              <span className="bg-amber-400 text-slate-950 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                GOVERNANCE & OPS
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              Sprint 12 • Portal Administrativo Geral e Consolidação de Segurança
            </p>
          </div>
        </div>

        {/* PROFILE TOGGLE: INTERACTIVE DEMO TESTING (PLATFORM_ADMIN VS SUPPORT) */}
        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 p-2 rounded-2xl shrink-0">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2 hidden md:inline">
            Perfil Operador:
          </span>
          <div className="flex bg-slate-950 p-1 rounded-xl text-[11px] font-bold">
            <button
              onClick={() => setCurrentRole('PLATFORM_ADMIN')}
              className={`px-3 py-1.5 rounded-lg transition ${
                currentRole === 'PLATFORM_ADMIN'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              ADMIN
            </button>
            <button
              onClick={() => setCurrentRole('SUPPORT')}
              className={`px-3 py-1.5 rounded-lg transition ${
                currentRole === 'SUPPORT'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              SUPORTE
            </button>
          </div>
        </div>
      </header>

      {/* Tabs Menu Subheader */}
      <div className="px-6 py-2 border-b border-slate-200 bg-white overflow-x-auto flex gap-1 scrollbar-none shrink-0">
        {[
          { id: 'dashboard', label: 'Visão Geral' },
          { id: 'providers', label: 'Prestadores', count: providers.filter((p) => p.status === 'PENDING_REVIEW').length },
          { id: 'compliance', label: 'Compliance', count: complianceDocs.filter((d) => d.status === 'UNDER_REVIEW').length },
          { id: 'vehicles', label: 'Veículos', count: vehicles.filter((v) => v.status === 'UNDER_REVIEW').length },
          { id: 'bookings', label: 'Reservas' },
          { id: 'financial', label: 'Financeiro' },
          { id: 'users', label: 'Usuários & Papéis' },
          { id: 'audit', label: 'Auditoria' },
          { id: 'settings', label: 'Configurações' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 ${
                isActive
                  ? 'bg-slate-950 text-white'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-amber-400 text-slate-950' : 'bg-rose-100 text-rose-700'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* App Workspace */}
      <main className="p-6 flex-1 max-w-7xl w-full mx-auto">
        {activeTab === 'dashboard' && (
          <DashboardTab
            providers={providers}
            complianceDocs={complianceDocs}
            vehicles={vehicles}
            bookings={bookings}
            auditLogs={auditLogs}
            onNavigate={(target) => setActiveTab(target)}
          />
        )}

        {activeTab === 'providers' && (
          <ProvidersTab
            providers={providers}
            complianceDocs={complianceDocs}
            vehicles={vehicles}
            auditLogs={auditLogs}
            actor={activeActor}
            onApprove={handleApproveProvider}
            onReject={handleRejectProvider}
            onSuspend={handleSuspendProvider}
            onBlock={handleBlockProvider}
            eligibilityChecker={handleEligibilityCheck}
          />
        )}

        {activeTab === 'compliance' && (
          <ComplianceTab
            complianceDocs={complianceDocs}
            actor={activeActor}
            onApproveDoc={handleApproveDoc}
            onRejectDoc={handleRejectDoc}
          />
        )}

        {activeTab === 'vehicles' && (
          <VehiclesTab
            vehicles={vehicles}
            providers={providers}
            onApproveVehicle={handleApproveVehicle}
            onRejectVehicle={handleRejectVehicle}
            onBlockVehicle={handleBlockVehicle}
          />
        )}

        {activeTab === 'bookings' && (
          <BookingsTab
            bookings={bookings}
            auditLogs={auditLogs}
          />
        )}

        {activeTab === 'financial' && (
          <FinancialTab
            bookings={bookings}
            auditLogs={auditLogs}
            actor={activeActor}
            onProcessRefund={handleProcessRefund}
          />
        )}

        {activeTab === 'users' && (
          <UsersTab
            users={users}
            actor={activeActor}
            onChangeRole={handleChangeRole}
          />
        )}

        {activeTab === 'audit' && (
          <AuditTab
            auditLogs={auditLogs}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            config={platformConfig}
            actor={activeActor}
            onUpdateConfig={handleUpdateConfig}
          />
        )}
      </main>
    </div>
  );
};
