import { useLocation, useNavigate } from "react-router-dom";
import Button from "@/components/base/Button";

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-background-50 flex flex-col items-center justify-center text-center px-6 max-w-app mx-auto">
      <div className="w-20 h-20 rounded-full bg-background-200 flex items-center justify-center mb-6">
        <i className="ri-emotion-sad-line text-3xl text-foreground-400" />
      </div>
      <h1 className="text-xl font-bold text-foreground-900 font-heading mb-2">
        Página não encontrada
      </h1>
      <p className="text-sm text-foreground-500 max-w-xs mb-6">
        A página que você procura não existe ou foi movida.
      </p>
      <Button
        variant="secondary"
        size="md"
        onClick={() => navigate('/inicio')}
      >
        Voltar ao início
      </Button>
    </div>
  );
}