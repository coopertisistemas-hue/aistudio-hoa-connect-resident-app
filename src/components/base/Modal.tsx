import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  actions,
}: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40 transition-opacity duration-200"
        onClick={onClose}
      />
      <div
        className={`
          relative bg-white rounded-2xl w-full md:max-w-sm mx-4 mb-4 md:mb-0
          transform transition-all duration-200
          ${open ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
          safe-bottom
        `}
      >
        {title && (
          <div className="px-5 pt-5 pb-2">
            <h3 className="text-lg font-semibold text-foreground-900">{title}</h3>
          </div>
        )}
        <div className="px-5 py-3">{children}</div>
        {actions && (
          <div className="px-5 pb-5 flex gap-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}