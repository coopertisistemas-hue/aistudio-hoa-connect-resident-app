import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  padding?: 'sm' | 'md' | 'lg' | 'none';
  variant?: 'default' | 'outlined' | 'filled';
}

export default function Card({
  children,
  className = '',
  onClick,
  padding = 'md',
  variant = 'default',
}: CardProps) {
  const paddingClasses = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5',
    none: 'p-0',
  };

  const variantClasses = {
    default: 'bg-white border border-background-200',
    outlined: 'bg-transparent border border-background-300',
    filled: 'bg-background-100 border border-transparent',
  };

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`
        rounded-2xl w-full text-left
        ${paddingClasses[padding]}
        ${variantClasses[variant]}
        ${onClick ? 'cursor-pointer active:scale-[0.98] transition-transform duration-150' : ''}
        ${className}
      `}
    >
      {children}
    </Component>
  );
}