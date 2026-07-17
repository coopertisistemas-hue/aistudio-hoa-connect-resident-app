import { useNavigate } from 'react-router-dom';
import Button from '@/components/base/Button';
import { association } from '@/fixtures/association';

export default function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background-50 flex flex-col max-w-app mx-auto">
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mb-6">
          <i className="ri-community-line text-3xl text-primary-600" />
        </div>

        <h1 className="text-2xl font-bold text-foreground-900 text-center font-heading mb-3">
          Bem-vindo ao
          <br />
          <span className="text-primary-600">HOA Connect</span>
        </h1>

        <p className="text-sm text-foreground-600 text-center max-w-xs leading-relaxed mb-8">
          O aplicativo que conecta você à sua associação de moradores. 
          Simples, rápido e sempre à mão.
        </p>

        <div className="w-full space-y-3 mb-8">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ri-bill-line text-accent-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground-800">Acesse suas faturas</p>
              <p className="text-xs text-foreground-500">Consulte e baixe seus boletos a qualquer momento</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ri-drop-line text-accent-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground-800">Acompanhe seu consumo</p>
              <p className="text-xs text-foreground-500">Visualize seu consumo de água mês a mês</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <i className="ri-customer-service-line text-accent-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground-800">Fale com a associação</p>
              <p className="text-xs text-foreground-500">Envie mensagens e acompanhe solicitações</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 pb-8 safe-bottom space-y-3">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => navigate('/login')}
        >
          Entrar
        </Button>
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={() => navigate('/first-access')}
        >
          Primeiro acesso
        </Button>

        <p className="text-xs text-foreground-400 text-center pt-2">
          {association.shortName}
        </p>
      </div>
    </div>
  );
}