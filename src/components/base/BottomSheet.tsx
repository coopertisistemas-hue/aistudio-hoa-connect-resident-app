import { useEffect, type ReactNode } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  height?: string;
}

export default function BottomSheet({
  open,
  onClose,
  children,
  title,
  height = 'auto',
}: BottomSheetProps) {
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
    <div className="fixed inset-0 z-[90]">
      <div
        className="absolute inset-0 bg-black/40 transition-opacity duration-200"
        onClick={onClose}
      />
      <div
        className={`
          absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl
          transform transition-transform duration-250 ease-out
          ${open ? 'translate-y-0' : 'translate-y-full'}
          safe-bottom
        `}
        style={{ maxHeight: height }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-background-300" />
        </div>
        {title && (
          <div className="px-5 pb-2">
            <h3 className="text-lg font-semibold text-foreground-900">{title}</h3>
          </div>
        )}
        <div className="px-5 pb-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}