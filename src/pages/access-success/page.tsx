import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/base/Button';
import { resident } from '@/fixtures/resident';
import { association } from '@/fixtures/association';

export default function AccessSuccessPage() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-background-50 flex flex-col items-center justify-center px-6 max-w-app mx-auto">
      <div
        className={`
          flex flex-col items-center text-center transition-all duration-500 ease-out
          ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        `}
      >
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center">
            <i className="ri-check-line text-4xl text-green-600" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center shadow-sm">
            <i className="ri-home-4-line text-white text-sm" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground-900 font-heading mb-1">
          Olá, {resident.firstName}!
        </h1>
        <p className="text-sm text-foreground-500 max-w-xs mb-3">
          Bem-vindo ao aplicativo da
        </p>
        <p className="text-base font-semibold text-primary-700 mb-6">
          {association.shortName}
        </p>

        <p className="text-sm text-foreground-500 max-w-xs leading-relaxed mb-10">
          Agora você pode acessar suas faturas, acompanhar o consumo de água, 
          receber avisos e falar diretamente com a associação.
        </p>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => navigate('/inicio')}
        >
          Ir para o início
        </Button>
      </div>
    </div>
  );
}