import { useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  path: string;
  label: string;
  icon: string;
  iconActive: string;
}

const navItems: NavItem[] = [
  { path: '/inicio', label: 'Início', icon: 'ri-home-line', iconActive: 'ri-home-fill' },
  { path: '/consumo', label: 'Consumo', icon: 'ri-drop-line', iconActive: 'ri-drop-fill' },
  { path: '/faturas', label: 'Faturas', icon: 'ri-bill-line', iconActive: 'ri-bill-fill' },
  { path: '/atendimento', label: 'Atendimento', icon: 'ri-customer-service-line', iconActive: 'ri-customer-service-fill' },
  { path: '/perfil', label: 'Perfil', icon: 'ri-user-line', iconActive: 'ri-user-fill' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === '/inicio') return location.pathname === '/inicio';
    return location.pathname.startsWith(path);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-background-200 safe-bottom z-40"
      role="navigation"
      aria-label="Navegação principal"
    >
      <div className="flex items-center justify-around max-w-app mx-auto h-14">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`
                flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 h-full
                transition-colors duration-150 cursor-pointer select-none
                ${active ? 'text-primary-600' : 'text-foreground-400 hover:text-foreground-600'}
              `}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <i className={`${active ? item.iconActive : item.icon} text-xl`} />
              <span className="text-[10px] font-medium leading-none whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}