import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from 'lucide-react';

const studentAppUrl = import.meta.env.VITE_STUDENT_APP_URL || 'https://mazzi-aluno-dev.pages.dev';
const providerAppUrl = import.meta.env.VITE_PROVIDER_APP_URL || 'https://mazzi-profissional-dev.pages.dev';

const benefits = [
  {
    icon: MapPin,
    eyebrow: 'Perto de você',
    title: 'Encontre o profissional certo',
    description: 'Veja instrutores e autoescolas disponíveis na sua região, com avaliações e ofertas claras.',
  },
  {
    icon: CalendarDays,
    eyebrow: 'Sem complicação',
    title: 'Agende no seu ritmo',
    description: 'Escolha o melhor horário para a sua rotina e acompanhe sua reserva em um só lugar.',
  },
  {
    icon: ShieldCheck,
    eyebrow: 'Com segurança',
    title: 'Pague com tranquilidade',
    description: 'Um fluxo transparente do agendamento à aula, com suporte e informações sempre à mão.',
  },
];

const providerBenefits = [
  'Agenda organizada e fácil de administrar',
  'Mais visibilidade para suas ofertas',
  'Pagamentos e reservas em um só lugar',
];

function Logo() {
  return (
    <a className="landing-logo" href="#inicio" aria-label="MAZZI — início">
      <img src="/brand/mazzi-logo.png" alt="" width="44" height="44" aria-hidden="true" />
      <span>MAZZI</span>
    </a>
  );
}

function LandingApp() {
  return (
    <div className="landing-page" id="inicio">
      <header className="landing-header">
        <div className="landing-container landing-header-inner">
          <Logo />
          <nav className="landing-nav" aria-label="Navegação principal">
            <a href="#como-funciona">Como funciona</a>
            <a href="#para-alunos">Para alunos</a>
            <a href="#para-profissionais">Para profissionais</a>
          </nav>
          <a className="landing-header-cta" href={studentAppUrl}>
            Encontrar uma aula <ArrowRight size={16} aria-hidden="true" />
          </a>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-container landing-hero-grid">
            <div className="landing-hero-copy">
              <p className="landing-kicker"><Sparkles size={15} aria-hidden="true" /> Aulas práticas do seu jeito</p>
              <h1>Aprender a dirigir ficou <span>mais simples.</span></h1>
              <p className="landing-hero-text">
                Encontre profissionais de confiança, escolha seu horário e avance para a sua habilitação com mais tranquilidade.
              </p>
              <div className="landing-hero-actions">
                <a className="landing-button landing-button-dark" href={studentAppUrl}>
                  Quero encontrar uma aula <ArrowRight size={18} aria-hidden="true" />
                </a>
                <a className="landing-text-link" href="#como-funciona">Entenda como funciona <ChevronRight size={17} aria-hidden="true" /></a>
              </div>
              <div className="landing-hero-proof">
                <div className="landing-avatar-stack" aria-hidden="true"><span>AS</span><span>LM</span><span>BR</span></div>
                <span>Uma experiência feita para a vida real.</span>
              </div>
            </div>

            <div className="landing-hero-visual" aria-label="Prévia da experiência MAZZI">
              <div className="landing-visual-topline"><span className="landing-status-dot" /> MAZZI está com você</div>
              <div className="landing-visual-card landing-visual-card-main">
                <div className="landing-visual-card-heading"><span>Próxima aula</span><span className="landing-pill">Confirmada</span></div>
                <div className="landing-visual-date"><strong>28</strong><span><b>AGO 2026</b><small>17:00 — 17:50</small></span></div>
                <div className="landing-visual-divider" />
                <div className="landing-visual-person"><span className="landing-initials">LS</span><span><b>Lucas Santos Miranda</b><small><MapPin size={13} aria-hidden="true" /> Pedreira, São Paulo</small></span></div>
              </div>
              <div className="landing-visual-bottom">
                <div><small>Valor da aula</small><strong>R$ 200,00</strong></div>
                <span className="landing-visual-check"><Check size={18} aria-hidden="true" /></span>
              </div>
              <img className="landing-visual-logo" src="/brand/mazzi-mark-transparent.png" alt="" width="120" height="120" aria-hidden="true" />
            </div>
          </div>
        </section>

        <section className="landing-trust-strip" aria-label="Diferenciais MAZZI">
          <div className="landing-container landing-trust-grid">
            <span><ShieldCheck size={18} aria-hidden="true" /> Profissionais verificados</span>
            <span><Star size={18} aria-hidden="true" /> Avaliações reais</span>
            <span><Users size={18} aria-hidden="true" /> Feito para alunos e profissionais</span>
          </div>
        </section>

        <section className="landing-section" id="como-funciona">
          <div className="landing-container">
            <div className="landing-section-heading">
              <p className="landing-kicker">Do primeiro clique à direção</p>
              <h2>Uma jornada mais leve para você chegar lá.</h2>
              <p>Menos desencontro, mais clareza e tudo o que importa reunido em uma experiência simples.</p>
            </div>
            <div className="landing-benefits-grid">
              {benefits.map(({ icon: Icon, eyebrow, title, description }) => (
                <article className="landing-benefit-card" key={title}>
                  <span className="landing-icon-box"><Icon size={22} strokeWidth={2.2} aria-hidden="true" /></span>
                  <p>{eyebrow}</p>
                  <h3>{title}</h3>
                  <span>{description}</span>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-student-section" id="para-alunos">
          <div className="landing-container landing-student-grid">
            <div className="landing-student-visual">
              <div className="landing-mini-label">Sua próxima conquista</div>
              <div className="landing-road-mark" aria-hidden="true"><img src="/brand/mazzi-road-motion.gif" alt="" width="88" height="88" /></div>
              <h3>Mais confiança para cada quilômetro.</h3>
              <p>Escolha quem combina com você, reserve com segurança e acompanhe cada etapa.</p>
              <a className="landing-button landing-button-light" href={studentAppUrl}>Começar agora <ArrowRight size={17} aria-hidden="true" /></a>
            </div>
            <div className="landing-student-copy">
              <p className="landing-kicker">Para quem está aprendendo</p>
              <h2>Sua habilitação começa com uma boa escolha.</h2>
              <p>Na MAZZI, você encontra aulas práticas com informações claras para tomar decisões com confiança.</p>
              <div className="landing-check-list">
                <span><Check size={17} aria-hidden="true" /> Compare ofertas e avaliações</span>
                <span><Check size={17} aria-hidden="true" /> Encontre horários que cabem na sua rotina</span>
                <span><Check size={17} aria-hidden="true" /> Acompanhe suas aulas pelo app</span>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section landing-provider-section" id="para-profissionais">
          <div className="landing-container landing-provider-grid">
            <div className="landing-provider-copy">
              <p className="landing-kicker">Para instrutores e autoescolas</p>
              <h2>Seu trabalho merece uma agenda à altura.</h2>
              <p>Tenha mais autonomia para organizar sua rotina, apresentar suas ofertas e construir relações duradouras com seus alunos.</p>
              <div className="landing-check-list landing-check-list-dark">
                {providerBenefits.map((benefit) => <span key={benefit}><Check size={17} aria-hidden="true" /> {benefit}</span>)}
              </div>
              <a className="landing-button landing-button-yellow" href={providerAppUrl}>Quero ser parceiro <ArrowRight size={17} aria-hidden="true" /></a>
            </div>
            <div className="landing-provider-panel">
              <div className="landing-provider-panel-header"><span>Visão da sua agenda</span><span className="landing-live-pill"><span /> Ao vivo</span></div>
              <div className="landing-calendar-row"><strong>SET</strong><span>25</span><small>Quinta-feira</small></div>
              <div className="landing-schedule-item"><span className="landing-schedule-time">08:00</span><span className="landing-schedule-line" /><span><b>Aula reservada</b><small>Aluno confirmado</small></span><Check size={18} aria-hidden="true" /></div>
              <div className="landing-schedule-item landing-schedule-item-muted"><span className="landing-schedule-time">10:00</span><span className="landing-schedule-line" /><span><b>Horário disponível</b><small>Pronto para receber uma oferta</small></span><ArrowRight size={18} aria-hidden="true" /></div>
            </div>
          </div>
        </section>

        <section className="landing-final-cta">
          <div className="landing-container landing-final-cta-inner">
            <div><p className="landing-kicker">Encontre. Agende. Dirija.</p><h2>O próximo passo é seu.</h2><p>Comece hoje uma experiência mais simples para aprender e ensinar a dirigir.</p></div>
            <a className="landing-button landing-button-dark" href={studentAppUrl}>Conhecer a MAZZI <ArrowRight size={18} aria-hidden="true" /></a>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-container landing-footer-inner"><Logo /><span>© 2026 MAZZI. Encontre. Agende. Dirija.</span><a href="#inicio">Voltar ao topo ↑</a></div>
      </footer>
    </div>
  );
}

export default LandingApp;
