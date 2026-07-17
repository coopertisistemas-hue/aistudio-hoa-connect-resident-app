import { useState, type FormEvent, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/base/Button';
import Input from '@/components/base/Input';
import Checkbox from '@/components/base/Checkbox';
import Alert from '@/components/base/Alert';
import { verificationChannels } from '@/fixtures/verification';
import { resident } from '@/fixtures/resident';
import DemoControls from '@/demo/DemoControls';
import { demoStates } from '@/fixtures/demoStates';

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface StepInfo {
  title: string;
  description: string;
}

const stepInfo: Record<Step, StepInfo> = {
  1: { title: 'Primeiro acesso', description: 'Informe seu CPF para ativar sua conta' },
  2: { title: 'Confirme seus dados', description: 'Verifique se estas são suas informações' },
  3: { title: 'Verificação', description: 'Escolha como deseja receber o código' },
  4: { title: 'Código de verificação', description: 'Digite o código de 6 dígitos enviado' },
  5: { title: 'Crie sua senha', description: 'Escolha uma senha segura para acessar o app' },
  6: { title: 'Termos de uso', description: 'Aceite os termos para continuar' },
  7: { title: 'Tudo pronto!', description: 'Sua conta foi ativada com sucesso' },
  8: { title: 'Bem-vindo!', description: 'Agora você já pode usar o aplicativo' },
};

const MOCK_CODE = '123456';

const personalInfo = {
  name: resident.name,
  cpf: resident.cpf,
  email: 'c****s@email.com',
  phone: '(41) 9****-1234',
  property: 'Rua das Nascentes, 500 — Bloco 3, Apto 201',
};

export default function FirstAccessPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(1);
  const [cpf, setCpf] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [demoStateKey, setDemoStateKey] = useState('default');
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);

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

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (step > 1 && step < 7) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [step]);

  const handleStep1 = (e: FormEvent) => {
    e.preventDefault();
    resetErrors();

    const cpfDigits = cpf.replace(/\D/g, '');
    if (!cpfDigits) {
      setErrors({ cpf: 'Informe seu CPF' });
      return;
    }
    if (cpfDigits.length < 11) {
      setErrors({ cpf: 'CPF incompleto' });
      return;
    }

    if (demoStateKey === 'cpfNotFound') {
      setError('CPF não encontrado na base da associação. Verifique os dados com a administração.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(2);
    }, 1000);
  };

  const handleStep3 = () => {
    if (!selectedChannel) {
      setErrors({ channel: 'Selecione um canal' });
      return;
    }
    resetErrors();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(4);
    }, 800);
  };

  const handleStep4 = (e: FormEvent) => {
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
      setStep(5);
    }, 800);
  };

  const handleStep5 = (e: FormEvent) => {
    e.preventDefault();
    resetErrors();

    const newErrs: Record<string, string> = {};

    if (!newPassword) {
      newErrs.newPassword = 'Crie uma senha';
    } else if (newPassword.length < 8) {
      newErrs.newPassword = 'A senha deve ter pelo menos 8 caracteres';
    }

    if (!confirmPassword) {
      newErrs.confirmPassword = 'Confirme a senha';
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
      setStep(6);
    }, 1000);
  };

  const handleStep6 = () => {
    resetErrors();

    if (!acceptedTerms || !acceptedPrivacy) {
      setError('Você precisa aceitar os termos de uso e a política de privacidade para continuar.');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep(7);
    }, 1000);
  };

  const handleDemoState = (key: string) => {
    setDemoStateKey(key);
    const states = demoStates.firstAccess;
    const state = states[key as keyof typeof states];
    if (state) {
      setError(state.message);
    }
  };

  const handleBack = () => {
    if (step === 1) {
      setLeaveConfirmOpen(true);
      return;
    }
    resetErrors();
    setStep((prev) => (prev - 1) as Step);
  };

  const info = stepInfo[step];
  const totalSteps = 8;

  const getDemoStatesForStep = () => {
    const states = demoStates.firstAccess;
    if (step === 1) return { default: { type: 'default', message: '' }, cpfNotFound: states.cpfNotFound };
    if (step === 4) return { default: { type: 'default', message: '' }, codeInvalid: states.codeInvalid, codeExpired: states.codeExpired };
    if (step === 5) return { default: { type: 'default', message: '' }, passwordMismatch: states.passwordMismatch };
    if (step === 6) return { default: { type: 'default', message: '' }, termsNotAccepted: states.termsNotAccepted };
    return { default: { type: 'default', message: '' } };
  };

  return (
    <div className="min-h-screen bg-background-50 flex flex-col max-w-app mx-auto relative">
      {/* Leave confirmation */}
      {leaveConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl mx-4 p-5 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-foreground-900 mb-2">Sair do primeiro acesso?</h3>
            <p className="text-sm text-foreground-600 mb-5">
              Seu progresso não será salvo. Você precisará começar novamente.
            </p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={() => setLeaveConfirmOpen(false)}
              >
                Continuar
              </Button>
              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={() => navigate('/welcome')}
              >
                Sair
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col px-6 pt-12 pb-6">
        <button
          onClick={handleBack}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-background-200 transition-colors cursor-pointer text-foreground-500 -ml-2 mb-4"
          aria-label="Voltar"
        >
          <i className="ri-arrow-left-line text-xl" />
        </button>

        {step < 7 && (
          <>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-primary-600 bg-primary-100 px-2 py-0.5 rounded-full">
                Etapa {step} de {totalSteps}
              </span>
            </div>
          </>
        )}

        <h1 className="text-2xl font-bold text-foreground-900 font-heading mb-1">
          {info.title}
        </h1>
        <p className="text-sm text-foreground-500 mb-8">
          {info.description}
        </p>

        {step < 7 && (
          <div className="flex gap-1.5 mb-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full flex-1 transition-colors duration-300 ${
                  i + 1 <= step ? 'bg-primary-500' : 'bg-background-300'
                }`}
              />
            ))}
          </div>
        )}

        {error && (
          <Alert variant="error" className="mb-4" onDismiss={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Step 1: Enter CPF */}
        {step === 1 && (
          <form onSubmit={handleStep1} className="flex-1 flex flex-col">
            <Input
              label="CPF"
              placeholder="000.000.000-00"
              value={cpf}
              onChange={(e) => {
                setCpf(formatCpf(e.target.value));
                resetErrors();
              }}
              error={errors.cpf}
              leftIcon="ri-id-card-line"
              inputMode="numeric"
              hint="Informe o CPF cadastrado na associação"
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

        {/* Step 2: Confirm personal info */}
        {step === 2 && (
          <div className="flex-1 flex flex-col">
            <div className="bg-white rounded-2xl border border-background-200 p-4 space-y-4">
              <div>
                <p className="text-xs text-foreground-400 mb-0.5">Nome</p>
                <p className="text-sm font-medium text-foreground-800">{personalInfo.name}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-400 mb-0.5">CPF</p>
                <p className="text-sm font-medium text-foreground-800">{personalInfo.cpf}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-400 mb-0.5">E-mail</p>
                <p className="text-sm font-medium text-foreground-800">{personalInfo.email}</p>
              </div>
              <div>
                <p className="text-xs text-foreground-400 mb-0.5">Telefone</p>
                <p className="text-sm font-medium text-foreground-800">{personalInfo.phone}</p>
              </div>
              <div className="pt-2 border-t border-background-200">
                <p className="text-xs text-foreground-400 mb-0.5">Endereço</p>
                <p className="text-sm font-medium text-foreground-800">{personalInfo.property}</p>
              </div>
            </div>

            <p className="text-xs text-foreground-400 mt-3 text-center">
              Se alguma informação estiver incorreta, entre em contato com a associação.
            </p>

            <div className="mt-auto space-y-3">
              <Button
                onClick={() => setStep(3)}
                variant="primary"
                size="lg"
                fullWidth
              >
                Confirmar e continuar
              </Button>
              <Button
                onClick={() => setLeaveConfirmOpen(true)}
                variant="text"
                size="md"
                fullWidth
              >
                Não sou eu
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Choose verification channel */}
        {step === 3 && (
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
                onClick={handleStep3}
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

        {/* Step 4: Verification code */}
        {step === 4 && (
          <form onSubmit={handleStep4} className="flex-1 flex flex-col">
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

        {/* Step 5: Create password */}
        {step === 5 && (
          <form onSubmit={handleStep5} className="flex-1 flex flex-col">
            <div className="space-y-4">
              <Input
                label="Crie sua senha"
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
                hint="Use pelo menos 8 caracteres com letras e números"
              />

              <Input
                label="Confirme sua senha"
                type={showPassword ? 'text' : 'password'}
                placeholder="Repita a senha"
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
                Criar senha
              </Button>
            </div>
          </form>
        )}

        {/* Step 6: Terms */}
        {step === 6 && (
          <div className="flex-1 flex flex-col">
            <div className="space-y-4">
              <Checkbox
                label="Aceito os Termos de Uso do HOA Connect"
                checked={acceptedTerms}
                onChange={(e) => {
                  setAcceptedTerms(e.target.checked);
                  resetErrors();
                }}
              />

              <Checkbox
                label="Aceito a Política de Privacidade e autorizo o tratamento dos meus dados pessoais conforme descrito"
                checked={acceptedPrivacy}
                onChange={(e) => {
                  setAcceptedPrivacy(e.target.checked);
                  resetErrors();
                }}
              />

              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  className="text-xs text-primary-600 hover:text-primary-700 underline cursor-pointer"
                >
                  Ler termos de uso
                </button>
                <span className="text-xs text-foreground-300">·</span>
                <button
                  type="button"
                  className="text-xs text-primary-600 hover:text-primary-700 underline cursor-pointer"
                >
                  Ler política de privacidade
                </button>
              </div>
            </div>

            <div className="mt-auto">
              <Button
                onClick={handleStep6}
                variant="primary"
                size="lg"
                fullWidth
                loading={loading}
              >
                Aceitar e continuar
              </Button>
            </div>
          </div>
        )}

        {/* Step 7: Activation success */}
        {step === 7 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center mb-6 relative">
              <i className="ri-check-line text-4xl text-green-600" />
              <div className="absolute -top-1 -right-1 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <i className="ri-check-line text-white text-sm" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-foreground-900 mb-2">
              Conta ativada!
            </h2>
            <p className="text-sm text-foreground-500 max-w-xs mb-8">
              Sua conta foi criada com sucesso. Agora você pode acessar todos os recursos do aplicativo.
            </p>
            <div className="w-full">
              <Button
                onClick={() => setStep(8)}
                variant="primary"
                size="lg"
                fullWidth
              >
                Continuar
              </Button>
            </div>
          </div>
        )}

        {/* Step 8: Welcome message */}
        {step === 8 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mb-6">
              <i className="ri-user-heart-line text-3xl text-primary-600" />
            </div>
            <h2 className="text-xl font-bold text-foreground-900 mb-1">
              Bem-vindo, {resident.firstName}!
            </h2>
            <p className="text-sm text-foreground-500 max-w-xs mb-8">
              É um prazer ter você aqui. Vamos começar?
            </p>
            <div className="w-full">
              <Button
                onClick={() => navigate('/access-success')}
                variant="primary"
                size="lg"
                fullWidth
              >
                Ir para o início
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