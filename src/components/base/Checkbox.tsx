import { type InputHTMLAttributes, forwardRef } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  error?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox({
  label,
  error,
  id,
  className = '',
  disabled,
  ...props
}, ref) {
  const inputId = id || label.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className={`flex items-start gap-3 cursor-pointer select-none ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="relative mt-0.5">
          <input
            ref={ref}
            type="checkbox"
            id={inputId}
            className="peer sr-only"
            disabled={disabled}
            {...props}
          />
          <div className="w-5 h-5 rounded-md border-2 border-background-300 bg-background-50 flex items-center justify-center transition-all peer-checked:bg-primary-500 peer-checked:border-primary-500 peer-focus-visible:ring-2 peer-focus-visible:ring-primary-200 peer-focus-visible:ring-offset-2">
            <i className="ri-check-line text-white text-xs opacity-0 peer-checked:opacity-100 transition-opacity" />
          </div>
        </div>
        <span className="text-sm text-foreground-700 leading-snug">{label}</span>
      </label>
      {error && (
        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
          <i className="ri-error-warning-line text-sm" />
          {error}
        </p>
      )}
    </div>
  );
});

export default Checkbox;