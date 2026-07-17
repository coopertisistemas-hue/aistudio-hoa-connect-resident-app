import type { ReactNode } from 'react';

type AlertVariant = 'success' | 'error' | 'warning' | 'info';

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  className?: string;
  onDismiss?: () => void;
}

const variantConfig: Record<AlertVariant, { bg: string; border: string; text: string; icon: string }> = {
  success: {
    bg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-800',
    icon: 'ri-checkbox-circle-line text-green-500',
  },
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-800',
    icon: 'ri-error-warning-line text-red-500',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    icon: 'ri-alert-line text-amber-500',
  },
  info: {
    bg: 'bg-primary-50',
    border: 'border-primary-200',
    text: 'text-primary-800',
    icon: 'ri-information-line text-primary-500',
  },
};

export default function Alert({
  variant = 'info',
  title,
  children,
  className = '',
  onDismiss,
}: AlertProps) {
  const config = variantConfig[variant];

  return (
    <div
      className={`flex gap-3 p-4 rounded-xl border ${config.bg} ${config.border} ${className}`}
      role="alert"
    >
      <i className={`${config.icon} text-xl flex-shrink-0 mt-0.5`} />
      <div className="flex-1 min-w-0">
        {title && <p className={`text-sm font-semibold ${config.text} mb-0.5`}>{title}</p>}
        <div className={`text-sm ${config.text}`}>{children}</div>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className={`w-7 h-7 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors cursor-pointer flex-shrink-0 ${config.text}`}
          aria-label="Fechar"
        >
          <i className="ri-close-line" />
        </button>
      )}
    </div>
  );
}