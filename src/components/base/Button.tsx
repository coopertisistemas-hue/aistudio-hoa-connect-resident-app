import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'text' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  const baseClasses = 'whitespace-nowrap inline-flex items-center justify-center font-medium transition-all duration-150 active:scale-[0.97] cursor-pointer select-none rounded-xl';

  const sizeClasses = {
    sm: 'px-4 py-2 text-sm gap-1.5 min-h-[40px]',
    md: 'px-6 py-3 text-base gap-2 min-h-[48px]',
    lg: 'px-8 py-3.5 text-base gap-2 min-h-[52px]',
  };

  const variantClasses = {
    primary: `bg-primary-500 text-white hover:bg-primary-600 focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 disabled:bg-primary-300 disabled:cursor-not-allowed`,
    secondary: `bg-background-100 text-primary-700 border border-primary-200 hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed`,
    text: `text-primary-600 hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed px-3`,
    icon: `text-foreground-600 hover:bg-background-200 focus-visible:ring-2 focus-visible:ring-foreground-300 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed w-10 h-10 p-0 rounded-full`,
  };

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${widthClass} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <i className="ri-loader-4-line animate-spin" />
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}