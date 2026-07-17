import { type InputHTMLAttributes, useState, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconClick?: () => void;
  containerClassName?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconClick,
  containerClassName = '',
  className = '',
  id,
  disabled,
  ...props
}, ref) {
  const [focused, setFocused] = useState(false);
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`w-full ${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-foreground-700 mb-1.5"
        >
          {label}
        </label>
      )}
      <div
        className={`
          relative flex items-center rounded-xl border bg-background-50 transition-all duration-150
          ${focused ? 'border-primary-400 ring-2 ring-primary-100' : 'border-background-300'}
          ${error ? 'border-red-400 ring-2 ring-red-100' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-background-100' : ''}
        `}
      >
        {leftIcon && (
          <div className="w-10 h-10 flex items-center justify-center text-foreground-400">
            <i className={`${leftIcon} text-lg`} />
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full bg-transparent px-3 py-3 text-base text-foreground-900 placeholder:text-foreground-300
            outline-none disabled:cursor-not-allowed
            ${leftIcon ? 'pl-0' : ''}
            ${rightIcon ? 'pr-0' : ''}
            ${className}
          `}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {rightIcon && (
          <button
            type="button"
            onClick={onRightIconClick}
            className="w-10 h-10 flex items-center justify-center text-foreground-400 hover:text-foreground-600 transition-colors cursor-pointer"
            tabIndex={-1}
            aria-label={rightIcon.includes('eye') ? 'Mostrar senha' : 'Ação'}
          >
            <i className={`${rightIcon} text-lg`} />
          </button>
        )}
      </div>
      {error && (
        <p id={`${inputId}-error`} className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
          <i className="ri-error-warning-line text-sm" />
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={`${inputId}-hint`} className="mt-1.5 text-sm text-foreground-500">
          {hint}
        </p>
      )}
    </div>
  );
});

export default Input;