import { useState, type FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/base/Button';
import Input from '@/components/base/Input';
import Checkbox from '@/components/base/Checkbox';
import Alert from '@/components/base/Alert';
import { association } from '@/fixtures/association';
import { residentCredentials } from '@/fixtures/resident';
import DemoControls from '@/demo/DemoControls';
import { demoStates } from '@/fixtures/demoStates';

type AuthState = {
  type: 'idle' | 'loading' | 'error' | 'success';
  message: string;
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [authState, setAuthState] = useState<AuthState>({ type: 'idle', message: '' });
  const [errors, setErrors] = useState<{ cpf?: string; password?: string }>({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [demoStateKey, setDemoStateKey] = useState('default');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  };

  const validate = () => {
    const newErrors: { cpf?: string; password?: string } = {};
    const cpfDigits = cpf.replace(/\D/g, '');

    if (!cpfDigits) {
      newErrors.cpf = 'Informe seu CPF ou e-mail';
    } else if (cpfDigits.length > 0 && cpfDigits.length < 11 && !cpf.includes('@')) {
      newErrors.cpf = 'CPF incompleto';
    }

    if (!password) {
      newErrors.password = 'Informe sua senha';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!validate()) return;
    if (!isOnline) {
      setAuthState({
        type: 'error',
        message: 'Sem conexão com a internet. Verifique sua rede e tente novamente.',
      });
      return;
    }

    // Demo state overrides
    if (demoStateKey === 'loading') {
      setAuthState({ type: 'loading', message: 'Verificando suas informações...' });
      return;
    }
    if (demoStateKey === 'invalidCredentials') {
      setAuthState({ type: 'error', message: 'CPF ou senha incorretos. Tente novamente.' });
      return;
    }
    if (demoStateKey === 'accountNotFound') {
      setAuthState({ type: 'error', message: 'Não encontramos uma conta com este CPF.' });
      return;
    }
    if (demoStateKey === 'accountInactive') {
      setAuthState({ type: 'error', message: 'Esta conta está temporariamente indisponível. Entre em contato com a associação.' });
      return;
    }
    if (demoStateKey === 'networkError') {
      setAuthState({ type: 'error', message: 'Não foi possível conectar. Verifique sua internet e tente novamente.' });
      return;
    }

    // Simulated login
    const cpfDigits = cpf.replace(/\D/g, '');
    const isDemoCpf = cpfDigits === residentCredentials.cpf.replace(/\D/g, '');
    const isDemoEmail = cpf === residentCredentials.email;
    const isDemoPassword = password === residentCredentials.password;

    if ((isDemoCpf || isDemoEmail) && isDemoPassword) {
      setAuthState({ type: 'loading', message: 'Verificando suas informações...' });
      setTimeout(() => {
        setAuthState({ type: 'success', message: 'Login realizado com sucesso!' });
        setTimeout(() => navigate('/access-success'), 600);
      }, 1200);
    } else {
      setAuthState({ type: 'error', message: 'CPF ou senha incorretos. Tente novamente.' });
    }
  };

  const handleDemoState = (key: string) => {
    setDemoStateKey(key);
    const state = demoStates.login[key as keyof typeof demoStates.login];
    if (state) {
      setAuthState({ type: state.type as AuthState['type'], message: state.message });
    }
  };

  return (
    <div className="min-h-screen bg-background-50 flex flex-col max-w-app mx-auto">
      <div className="flex-1 flex flex-col px-6 pt-12 pb-6">
        <button
          onClick={() => navigate('/welcome')}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-background-200 transition-colors cursor-pointer text-foreground-500 -ml-2 mb-4"
          aria-label="Voltar"
        >
          <i className="ri-arrow-left-line text-xl" />
        </button>

        <h1 className="text-2xl font-bold text-foreground-900 font-heading mb-1">
          Entrar
        </h1>
        <p className="text-sm text-foreground-500 mb-8">
          Acesse sua conta para continuar
        </p>

        {!isOnline && (
          <Alert variant="warning" className="mb-4">
            Você está offline. Conecte-se à internet para fazer login.
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col" noValidate>
          <div className="space-y-4">
            <Input
              label="CPF ou e-mail"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => {
                const val = e.target.value;
                setCpf(val.includes('@') ? val : formatCpf(val));
                setAuthState({ type: 'idle', message: '' });
                setErrors({});
              }}
              error={errors.cpf}
              leftIcon="ri-user-line"
              inputMode={cpf.includes('@') ? 'email' : 'numeric'}
              autoComplete="username"
            />

            <Input
              label="Senha"
              type={showPassword ? 'text' : 'password'}
              placeholder="Sua senha"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setAuthState({ type: 'idle', message: '' });
                setErrors({});
              }}
              error={errors.password}
              leftIcon="ri-lock-line"
              rightIcon={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}
              onRightIconClick={() => setShowPassword(!showPassword)}
              autoComplete="current-password"
            />
          </div>

          <div className="flex items-center justify-between mt-3 mb-6">
            <Checkbox
              label="Lembrar acesso"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <button
              type="button"
              onClick={() => navigate('/password-recovery')}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium cursor-pointer whitespace-nowrap transition-colors"
            >
              Esqueci minha senha
            </button>
          </div>

          {authState.type === 'error' && (
            <Alert variant="error" className="mb-4" onDismiss={() => setAuthState({ type: 'idle', message: '' })}>
              {authState.message}
            </Alert>
          )}

          {authState.type === 'success' && (
            <Alert variant="success" className="mb-4">
              {authState.message}
            </Alert>
          )}

          <div className="mt-auto">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={authState.type === 'loading'}
            >
              Entrar
            </Button>

            <div className="text-center mt-4">
              <button
                type="button"
                onClick={() => navigate('/first-access')}
                className="text-sm text-primary-600 hover:text-primary-700 font-medium cursor-pointer transition-colors"
              >
                Primeiro acesso
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="px-6 pb-8 safe-bottom text-center">
        <p className="text-xs text-foreground-400">{association.shortName}</p>
      </div>

      <DemoControls
        states={demoStates.login}
        currentState={demoStateKey}
        onSelectState={handleDemoState}
      />
    </div>
  );
}