import React, { useState } from 'react';
import { BriefcaseBusiness, Check, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../../components/auth/AuthContext';
import { Modal } from '../../../components/ui/Modal';
import { Button, PrimaryButton } from '../../../components/ui/Button';
import { mapFriendlyErrorMessage } from '../../../lib/error-mapper';

const blockerMessages: Record<string, string> = {
  IDENTITY_INCOMPLETE: 'Complete seus dados de identidade antes de ativar o perfil profissional.',
  ACTIVE_STUDENT_BOOKING: 'Finalize ou aguarde suas aulas ativas antes de migrar para o MAZZI PRO.',
  PENDING_STUDENT_PAYMENT: 'Existe um pagamento de aula pendente. Conclua ou aguarde a expiração antes de migrar.',
  STUDENT_DISPUTE_OPEN: 'Existe uma contestação de aula em aberto. Resolva-a antes de migrar.',
  ROLE_CONFLICT: 'Esta conta possui uma função incompatível com a migração para o MAZZI PRO.',
  USER_INACTIVE: 'Sua conta está inativa e não pode ser migrada agora.',
};

export const StudentProMigrationCard: React.FC = () => {
  const { onboardInstructor, getStudentToProMigrationStatus, migrateStudentProfileToInstructor } = useAuth();
  const [isBusy, setIsBusy] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const runOnboarding = async () => {
    setIsBusy(true); setError(null); setFeedback(null);
    try {
      await onboardInstructor();
      setFeedback('Perfil profissional ativado. Você continua com o perfil de aluno e já pode acessar o MAZZI PRO.');
    } catch (err) {
      setError(mapFriendlyErrorMessage(err, 'Não foi possível ativar o perfil profissional agora.'));
    } finally { setIsBusy(false); }
  };

  const prepareMigration = async () => {
    setIsBusy(true); setError(null); setFeedback(null);
    try {
      const status = await getStudentToProMigrationStatus();
      if (!status.can_migrate) {
        const message = status.blockers.map((blocker) => blockerMessages[blocker] || blocker).join(' ');
        setError(message || 'Sua conta ainda não atende aos critérios para migração.');
        return;
      }
      setIsConfirmOpen(true);
    } catch (err) {
      setError(mapFriendlyErrorMessage(err, 'Não foi possível verificar sua elegibilidade.'));
    } finally { setIsBusy(false); }
  };

  const confirmMigration = async () => {
    setIsBusy(true); setError(null);
    try {
      await migrateStudentProfileToInstructor();
      setIsConfirmOpen(false);
    } catch (err) {
      setError(mapFriendlyErrorMessage(err, 'Não foi possível migrar seu perfil para o MAZZI PRO.'));
    } finally { setIsBusy(false); }
  };

  return (
    <>
      <section className="rounded-3xl border border-[var(--mazzi-border)] bg-white p-5 shadow-xs" aria-labelledby="student-pro-migration-title">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <BriefcaseBusiness className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">MAZZI PRO</p>
            <h4 id="student-pro-migration-title" className="mt-0.5 text-base font-bold text-slate-900">Quer dar aulas?</h4>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">Ative um perfil profissional mantendo o aluno ou migre sua conta para usar somente o MAZZI PRO.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" leftIcon={<ShieldCheck className="h-4 w-4" />} disabled={isBusy} onClick={() => void runOnboarding()}>
            Ativar perfil profissional
          </Button>
          <PrimaryButton type="button" rightIcon={<ArrowRight className="h-4 w-4" />} isLoading={isBusy} onClick={() => void prepareMigration()}>
            Migrar para MAZZI PRO
          </PrimaryButton>
        </div>
        {feedback && <p className="mt-3 text-xs font-semibold text-emerald-700" role="status">{feedback}</p>}
        {error && <p className="mt-3 text-xs font-semibold text-rose-700" role="alert">{error}</p>}
      </section>

      <Modal
        isOpen={isConfirmOpen}
        onClose={() => { if (!isBusy) setIsConfirmOpen(false); }}
        title="Migrar para o MAZZI PRO"
        footer={<><Button type="button" variant="dangerSoft" disabled={isBusy} onClick={() => setIsConfirmOpen(false)}>Cancelar</Button><PrimaryButton type="button" isLoading={isBusy} leftIcon={<Check className="h-4 w-4" />} onClick={() => void confirmMigration()}>Confirmar migração</PrimaryButton></>}
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>Essa opção transforma sua conta principal em uma conta profissional.</p>
          <ul className="list-disc space-y-2 pl-5 text-xs leading-relaxed">
            <li>Seu histórico de aluno será preservado.</li>
            <li>O mesmo e-mail, senha e dados de identidade continuarão válidos.</li>
            <li>O acesso principal passará a ser o MAZZI PRO.</li>
          </ul>
          <p className="rounded-2xl bg-amber-50 p-3 text-xs font-semibold text-amber-900">Depois da confirmação, esta tela de aluno será encerrada para esta conta.</p>
        </div>
      </Modal>
    </>
  );
};
