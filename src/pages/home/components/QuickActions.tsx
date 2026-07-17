import { useNavigate } from 'react-router-dom';

interface QuickAction {
  label: string;
  icon: string;
  path: string;
}

const actions: QuickAction[] = [
  { label: 'Ver faturas', icon: 'ri-bill-line', path: '/faturas' },
  { label: 'Meu consumo', icon: 'ri-drop-line', path: '/consumo' },
  { label: 'Emitir 2ª via', icon: 'ri-file-copy-line', path: '/faturas' },
  { label: 'Abrir atendimento', icon: 'ri-customer-service-line', path: '/atendimento' },
];

export default function QuickActions() {
  const navigate = useNavigate();

  return (
    <div className="grid grid-cols-4 gap-2">
      {actions.map((action) => (
        <button
          key={action.path + action.label}
          onClick={() => navigate(action.path)}
          className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white border border-background-200 hover:bg-background-50 transition-colors cursor-pointer active:scale-[0.97]"
        >
          <div className="w-11 h-11 rounded-xl bg-accent-100 flex items-center justify-center">
            <i className={`${action.icon} text-accent-600 text-lg`} />
          </div>
          <span className="text-[11px] font-medium text-foreground-700 text-center leading-tight whitespace-nowrap">
            {action.label}
          </span>
        </button>
      ))}
    </div>
  );
}