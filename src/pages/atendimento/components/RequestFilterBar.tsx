interface FilterOption {
  key: string;
  label: string;
  count?: number;
}

interface Props {
  options: FilterOption[];
  activeKey: string;
  onChange: (key: string) => void;
}

export default function RequestFilterBar({ options, activeKey, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" role="tablist" aria-label="Filtrar solicitações">
      {options.map((opt) => (
        <button
          key={opt.key}
          role="tab"
          aria-selected={activeKey === opt.key}
          onClick={() => onChange(opt.key)}
          className={`
            px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap cursor-pointer
            transition-colors duration-150 flex-shrink-0
            ${activeKey === opt.key
              ? 'bg-primary-500 text-white'
              : 'bg-background-100 text-foreground-600 hover:bg-background-200'
            }
          `}
        >
          {opt.label}
          {opt.count !== undefined && opt.count > 0 && (
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${activeKey === opt.key ? 'bg-white/20' : 'bg-background-200'}`}>
              {opt.count > 99 ? '99+' : opt.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}