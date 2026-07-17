import { useNavigate } from 'react-router-dom';

interface ProfileSectionCardProps {
  title: string;
  description?: string;
  icon: string;
  path?: string;
  badge?: string;
  badgeVariant?: 'neutral' | 'warning' | 'error' | 'success';
  onClick?: () => void;
}

export default function ProfileSectionCard({
  title,
  description,
  icon,
  path,
  badge,
  badgeVariant = 'neutral',
  onClick,
}: ProfileSectionCardProps) {
  const navigate = useNavigate();

  const badgeColors: Record<string, string> = {
    neutral: 'bg-secondary-100 text-secondary-700',
    warning: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
    success: 'bg-green-100 text-green-700',
  };

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (path) {
      navigate(path);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-4 p-4 bg-white rounded-xl border border-background-200/70 text-left cursor-pointer hover:bg-background-50 transition-colors duration-150"
    >
      <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
        <i className={`${icon} text-lg text-primary-600`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground-900">{title}</span>
          {badge && (
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap ${badgeColors[badgeVariant]}`}>
              {badge}
            </span>
          )}
        </div>
        {description && (
          <p className="text-xs text-foreground-500 mt-0.5 line-clamp-1">{description}</p>
        )}
      </div>
      <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
        <i className="ri-arrow-right-s-line text-lg text-foreground-400" />
      </div>
    </button>
  );
}