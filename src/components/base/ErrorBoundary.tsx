import { Component, type ReactNode, type ErrorInfo } from 'react';
import Button from '@/components/base/Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Silently log in demo mode — never expose stack traces to UI
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error.message);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-background-50 flex flex-col items-center justify-center text-center px-6 max-w-app mx-auto safe-top safe-bottom">
          <div className="w-20 h-20 rounded-full bg-background-200 flex items-center justify-center mb-6">
            <i className="ri-emotion-sad-line text-3xl text-foreground-400" />
          </div>
          <h1 className="text-xl font-bold text-foreground-900 font-heading mb-2">
            Algo deu errado
          </h1>
          <p className="text-sm text-foreground-500 max-w-xs mb-6">
            Ocorreu um erro inesperado. Tente recarregar o aplicativo.
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={this.handleReset}
          >
            <i className="ri-refresh-line mr-1" />
            Recarregar
          </Button>
          <p className="text-[10px] text-foreground-300 mt-6">
            HOA Connect · Demonstração
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}