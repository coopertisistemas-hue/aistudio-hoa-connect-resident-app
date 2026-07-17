import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/base/Button';
import Input from '@/components/base/Input';
import Alert from '@/components/base/Alert';
import { verificationChannels } from '@/fixtures/verification';
import DemoControls from '@/demo/DemoControls';
import { demoStates } from '@/fixtures/demoStates';

type Step = 1 | 2 | 3 | 4 | 5;

interface StepInfo {
  title: string;
  description: string;
}

const stepInfo: Record<Step, StepInfo> = {
  1: { title: 'Recuperar senha', description: 'Informe seu CPF ou e-mail para recuperar o acesso' },
  2: { title: 'Escolha o canal', description: 'Para onde devemos enviar o código de verificação?' },
  3: { title: 'Verificar código', description: 'Digite o código de 6 dígitos enviado' },
  4: { title: 'Nova senha', description: 'Crie uma senha segura para sua conta' },
  5: { title: 'Senha alterada', description: 'Sua senha foi redefinida com sucesso' },
};

const MOCK_CODE = '123456';

export default function PasswordRecoveryPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [cpf, setCpf] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [demoStateKey, setDemoStateKey] = useState('default');
  const [successMessage, setSuccessMessage] = useState('');

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  };

  const resetErrors = () => {
    setError('');
    setErrors({});
  };

  const handleStep1 = (e: FormEvent) => {
    e.preventDefault();
    resetErrors();

    if (!cpf) {
      setErrors({ cpf: 'Informe seu CPF ou e-mail' });
      return;
    }

    if (demoStateKey === 'identityNotFound') {
      setError('Não encontramos um cadastro com este CPF.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(2);
    }, 1000);
  };

  const handleStep2 = () => {
    if (!selectedChannel) {
      setErrors({ channel: 'Selecione um canal de verificação' });
      return;
    }
    resetErrors();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(3);
    }, 800);
  };

  const handleStep3 = (e: FormEvent) => {
    e.preventDefault();
    resetErrors();

    if (!verificationCode || verificationCode.length < 6) {
      setErrors({ code: 'Digite o código de 6 dígitos' });
      return;
    }

    if (demoStateKey === 'codeInvalid') {
      setError('Código incorreto. Verifique e tente novamente.');
      return;
    }

    if (demoStateKey === 'codeExpired') {
      setError('Este código expirou. Solicite um novo.');
      return;
    }

    if (verificationCode !== MOCK_CODE) {
      setError('Código incorreto. Verifique e tente novamente.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(4);
    }, 800);
  };

  const handleStep4 = (e: FormEvent) => {
    e.preventDefault();
    resetErrors();

    const newErrs: Record<string, string> = {};

    if (!newPassword) {
      newErrs.newPassword = 'Crie uma senha';
    } else if (newPassword.length < 8) {
      newErrs.newPassword = 'A senha deve ter pelo menos 8 caracteres';
    }

    if (!confirmPassword) {
      newErrs.confirmPassword = 'Confirme a nova senha';
    } else if (newPassword !== confirmPassword) {
      newErrs.confirmPassword = 'As senhas não conferem';
    }

    if (Object.keys(newErrs).length > 0) {
      setErrors(newErrs);
      return;
    }

    if (demoStateKey === 'passwordMismatch') {
      setError('As senhas não conferem.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(5);
    }, 1000);
  };

  const handleDemoState = (key: string) => {
    setDemoStateKey(key);
    const states = demoStates.passwordRecovery;
    const state = states[key as keyof typeof states];
    if (state) {
      setError(state.message);
    }
  };

  const handleBack = () => {
    if (step === 1) {
      navigate('/login');
      return;
    }
    resetErrors();
    setStep((prev) => (prev - 1) as Step);
  };

  const info = stepInfo[step];
  const totalSteps = 5;

  // Build demo states for current step
  const getDemoStatesForStep = () => {
    const states = demoStates.passwordRecovery;
    if (step === 1) return { default: { type: 'default', message: '' }, identityNotFound: states.identityNotFound };
    if (step === 3) return { default: { type: 'default', message: '' }, codeInvalid: states.codeInvalid, codeExpired: states.codeExpired };
    if (step === 4) return { default: { type: 'default', message: '' }, passwordMismatch: states.passwordMismatch, passwordTooShort: states.passwordTooShort };
    return { default: { type: 'default', message: '' } };
  };

  return (
    <div className="min-h-screen bg-background-50 flex flex-col max-w-app mx-auto">
      <div className="flex-1 flex flex-col px-6 pt-12 pb-6">
        <button
          onClick={handleBack}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-background-200 transition-colors cursor-pointer text-foreground-500 -ml-2 mb-4"
          aria-label="Voltar"
        >
          <i className="ri-arrow-left-line text-xl" />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-primary-600 bg-primary-100 px-2 py-0.5 rounded-full">
            Etapa {step} de {totalSteps}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-foreground-900 font-heading mb-1">
          {info.title}
        </h1>
        <p className="text-sm text-foreground-500 mb-8">
          {info.description}
        </p>

        {/* Step indicator */}
        <div className="flex gap-1.5 mb-8">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full flex-1 transition-colors duration-300 ${
                i + 1 <= step ? 'bg-primary-500' : 'bg-background-300'
              }`}
            />
          ))}
        </div>

        {error && (
          <Alert variant="error" className="mb-4" onDismiss={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Step 1: Identity */}
        {step === 1 && (
          <form onSubmit={handleStep1} className="flex-1 flex flex-col">
            <Input
              label="CPF ou e-mail"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => {
                const val = e.target.value;
                setCpf(val.includes('@') ? val : formatCpf(val));
                resetErrors();
              }}
              error={errors.cpf}
              leftIcon="ri-user-line"
              inputMode={cpf.includes('@') ? 'email' : 'numeric'}
            />

            <div className="mt-auto">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={loading}
              >
                Continuar
              </Button>
            </div>
          </form>
        )}

        {/* Step 2: Choose channel */}
        {step === 2 && (
          <div className="flex-1 flex flex-col">
            <div className="space-y-3">
              {verificationChannels.map((channel) => (
                <button
                  key={channel.id}
                  onClick={() => {
                    setSelectedChannel(channel.id);
                    resetErrors();
                  }}
                  className={`
                    w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all cursor-pointer
                    ${selectedChannel === channel.id
                      ? 'border-primary-400 bg-primary-50 ring-1 ring-primary-200'
                      : 'border-background-200 bg-white hover:border-background-300'}
                  `}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    selectedChannel === channel.id ? 'bg-primary-100' : 'bg-background-100'
                  }`}>
                    <i className={`${channel.icon} text-lg ${selectedChannel === channel.id ? 'text-primary-600' : 'text-foreground-500'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground-800">{channel.label}</p>
                    <p className="text-xs text-foreground-500 truncate">{channel.maskedValue}</p>
                    <p className="text-xs text-foreground-400 mt-0.5">{channel.description}</p>
                  </div>
                  {selectedChannel === channel.id && (
                    <i className="ri-checkbox-circle-fill text-primary-500 text-xl flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
            {errors.channel && (
              <p className="mt-2 text-sm text-red-600">{errors.channel}</p>
            )}

            <div className="mt-auto">
              <Button
                onClick={handleStep2}
                variant="primary"
                size="lg"
                fullWidth
                loading={loading}
              >
                Enviar código
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Verification code */}
        {step === 3 && (
          <form onSubmit={handleStep3} className="flex-1 flex flex-col">
            <p className="text-sm text-foreground-500 mb-4">
              Enviamos um código de 6 dígitos para{' '}
              <strong className="text-foreground-700">
                {selectedChannel === 'email' ? 'c****s@email.com' : '(41) 9****-1234'}
              </strong>
            </p>

            <Input
              label="Código de verificação"
              placeholder="000000"
              value={verificationCode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                setVerificationCode(val);
                resetErrors();
              }}
              error={errors.code}
              inputMode="numeric"
              maxLength={6}
              leftIcon="ri-shield-keyhole-line"
            />

            <button
              type="button"
              onClick={() => {
                resetErrors();
                setVerificationCode('');
              }}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium cursor-pointer mt-3 self-start transition-colors"
            >
              Reenviar código
            </button>

            <div className="mt-auto">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={loading}
              >
                Verificar
              </Button>
            </div>
          </form>
        )}

        {/* Step 4: New password */}
        {step === 4 && (
          <form onSubmit={handleStep4} className="flex-1 flex flex-col">
            <div className="space-y-4">
              <Input
                label="Nova senha"
                type={showPassword ? 'text' : 'password'}
                placeholder="Mínimo de 8 caracteres"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  resetErrors();
                }}
                error={errors.newPassword}
                leftIcon="ri-lock-line"
                rightIcon={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}
                onRightIconClick={() => setShowPassword(!showPassword)}
                autoComplete="new-password"
              />

              <Input
                label="Confirmar nova senha"
                type={showPassword ? 'text' : 'password'}
                placeholder="Repita a nova senha"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  resetErrors();
                }}
                error={errors.confirmPassword}
                leftIcon="ri-lock-line"
                rightIcon={showPassword ? 'ri-eye-off-line' : 'ri-eye-line'}
                onRightIconClick={() => setShowPassword(!showPassword)}
                autoComplete="new-password"
              />
            </div>

            <div className="mt-auto">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                loading={loading}
              >
                Redefinir senha
              </Button>
            </div>
          </form>
        )}

        {/* Step 5: Success */}
        {step === 5 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-6">
              <i className="ri-shield-check-line text-3xl text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-foreground-900 mb-2">
              Senha alterada com sucesso
            </h2>
            <p className="text-sm text-foreground-500 max-w-xs">
              Sua senha foi redefinida. Agora você pode acessar sua conta com a nova senha.
            </p>
            <div className="mt-8 w-full">
              <Button
                onClick={() => navigate('/login')}
                variant="primary"
                size="lg"
                fullWidth
              >
                Ir para o login
              </Button>
            </div>
          </div>
        )}
      </div>

      <DemoControls
        states={getDemoStatesForStep()}
        currentState={demoStateKey}
        onSelectState={handleDemoState}
      />
    </div>
  );
}