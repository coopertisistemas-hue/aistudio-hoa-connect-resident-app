import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export default function EmptyState({
  icon = 'ri-inbox-line',
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      <div className="w-16 h-16 rounded-full bg-background-200 flex items-center justify-center mb-4">
        <i className={`${icon} text-2xl text-foreground-400`} />
      </div>
      <h3 className="text-base font-medium text-foreground-800 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-foreground-500 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}