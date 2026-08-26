import React, { useState } from 'react';
import { BriefcaseBusiness, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../../components/auth/AuthContext';
import { Button } from '../../../components/ui/Button';
import { mapFriendlyErrorMessage } from '../../../lib/error-mapper';

function professionalNotice(providerStatus?: string): string {
  switch (providerStatus) {
    case 'ACTIVE':
      return 'Seu perfil profissional já está ativo. Para gerenciar aulas, veículos, ofertas e agenda, acesse o aplicativo MAZZI PRO.';
    case 'BLOCKED':
    case 'SUSPENDED':
    case 'REJECTED':
      return 'Seu perfil profissional já existe. Para consultar a situação do cadastro, acesse o aplicativo MAZZI PRO.';
    default:
      return 'Seu perfil profissional já foi criado. Para concluir o cadastro e acompanhar a aprovação, acesse o aplicativo MAZZI PRO.';
  }
}

/** Multi-role UX: professional onboarding adds capability to this identity. */
export const StudentProMigrationCard: React.FC = () => {
  const { user, beginInstructorOnboarding } = useAuth();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const hasProfessionalProfile = Boolean(user?.providerId || user?.roles.includes('INSTRUCTOR'));

  const runOnboarding = async () => {
    setIsBusy(true);
    setError(null);
    setFeedback(null);
    try {
      beginInstructorOnboarding();
    } catch (err) {
      setError(mapFriendlyErrorMessage(err, 'Não foi possível ativar o perfil profissional agora.'));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-[var(--mazzi-border)] bg-white p-5 shadow-xs" aria-labelledby="student-pro-profile-title">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <BriefcaseBusiness className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">MAZZI PRO</p>
          <h4 id="student-pro-profile-title" className="mt-0.5 text-base font-bold text-slate-900">
            {hasProfessionalProfile ? 'Perfil profissional' : 'Quer dar aulas?'}
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {hasProfessionalProfile
              ? professionalNotice(user?.providerStatus)
              : 'Ative um perfil profissional mantendo também o seu perfil de aluno.'}
          </p>
        </div>
      </div>

      {!hasProfessionalProfile && (
        <div className="mt-4 flex justify-center">
          <Button
            type="button"
            variant="outline"
            leftIcon={<ShieldCheck className="h-4 w-4" />}
            disabled={isBusy}
            onClick={() => void runOnboarding()}
          >
            Ativar perfil profissional
          </Button>
        </div>
      )}

      {feedback && <p className="mt-3 text-xs font-semibold text-emerald-700" role="status">{feedback}</p>}
      {error && <p className="mt-3 text-xs font-semibold text-rose-700" role="alert">{error}</p>}
    </section>
  );
};
