import type { AssociationContactChannel } from '@/fixtures/types';

interface Props {
  channel: AssociationContactChannel;
}

export default function ContactChannelCard({ channel }: Props) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-background-200">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${channel.type === 'emergency' ? 'bg-red-100' : 'bg-background-100'}`}>
        <i className={`${channel.icon} ${channel.type === 'emergency' ? 'text-red-600' : 'text-foreground-600'} text-lg`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground-800 mb-0.5">{channel.label}</p>
        <p className="text-sm text-foreground-600 font-mono">{channel.value}</p>
        <p className="text-xs text-foreground-400 mt-0.5">{channel.description}</p>
      </div>
      {channel.type !== 'emergency' && (
        <button
          className="w-9 h-9 rounded-full bg-background-100 hover:bg-background-200 flex items-center justify-center cursor-pointer flex-shrink-0 transition-colors"
          aria-label={`Copiar ${channel.label}`}
          onClick={() => {
            navigator.clipboard.writeText(channel.value).catch(() => {});
          }}
        >
          <i className="ri-file-copy-line text-foreground-500 text-sm" />
        </button>
      )}
    </div>
  );
}