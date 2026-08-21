import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './ui/Button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  readonly props: ErrorBoundaryProps;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  state: ErrorBoundaryState = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if ((import.meta as any).env?.DEV) {
      console.error('[MAZZI_ERROR_BOUNDARY]', {
        message: error.message,
        componentStack: errorInfo.componentStack,
      });
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isPaymentProductionBlock = this.state.message.includes('FAKE_GATEWAY_UNAVAILABLE_IN_PRODUCTION');

    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-900">
        <section className="w-full max-w-md rounded-3xl bg-white border border-slate-200 shadow-2xl p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <div>
            <h1 className="text-lg font-black text-slate-950">
              Não foi possível carregar esta área
            </h1>
            <p className="text-sm text-slate-600 mt-2">
              {isPaymentProductionBlock
                ? 'O checkout simulado está bloqueado em produção. Configure Mercado Pago antes de habilitar cobrança real.'
                : 'Encontramos um erro inesperado. Tente recarregar a página.'}
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={() => window.location.reload()}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Recarregar
          </Button>
        </section>
      </main>
    );
  }
}
