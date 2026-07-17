import type { CommunicationPreference, CommunicationChannel } from '@/fixtures/types';

interface PreferenceToggleProps {
  preference: CommunicationPreference;
  isModified: boolean;
  onToggle: (id: string) => void;
  onChannelToggle: (prefId: string, channel: CommunicationChannel) => void;
}

export default function PreferenceToggle({
  preference,
  isModified,
  onToggle,
  onChannelToggle,
}: PreferenceToggleProps) {
  return (
    <div className={`rounded-2xl p-4 border transition-colors ${
      isModified
        ? 'bg-primary-50/60 border-primary-200'
        : preference.mandatory
          ? 'bg-background-50 border-background-200'
          : 'bg-white border-background-200'
    }`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h4 className="text-sm font-semibold text-foreground-800">{preference.categoryLabel}</h4>
            {preference.mandatory && (
              <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                Obrigatório
              </span>
            )}
          </div>
          <p className="text-xs text-foreground-500">{preference.description}</p>
        </div>
        <button
          onClick={() => onToggle(preference.id)}
          disabled={preference.mandatory}
          className={`
            relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0
            ${preference.mandatory
              ? 'bg-accent-200 cursor-not-allowed opacity-60'
              : preference.enabled
                ? 'bg-primary-500 cursor-pointer'
                : 'bg-foreground-300 cursor-pointer'
            }
          `}
          role="switch"
          aria-checked={preference.enabled}
          aria-label={`${preference.enabled ? 'Desativar' : 'Ativar'} ${preference.categoryLabel}`}
        >
          <span
            className={`
              absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200
              ${preference.enabled ? 'translate-x-5.5' : 'translate-x-0.5'}
            `}
          />
        </button>
      </div>

      {preference.mandatory && preference.mandatoryExplanation && (
        <p className="text-[11px] text-foreground-400 italic mb-2">
          {preference.mandatoryExplanation}
        </p>
      )}

      {preference.enabled && (
        <div className="flex flex-wrap gap-1.5 pt-1.5">
          {preference.availableChannels.map((ch) => {
            const isSelected = preference.channels.includes(ch.channel);
            return (
              <button
                key={ch.channel}
                onClick={() => onChannelToggle(preference.id, ch.channel)}
                disabled={!ch.available}
                className={`
                  flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium
                  transition-all duration-150 whitespace-nowrap
                  ${!ch.available
                    ? 'bg-background-100 text-foreground-300 cursor-not-allowed line-through'
                    : isSelected
                      ? 'bg-primary-100 text-primary-700 border border-primary-200 cursor-pointer'
                      : 'bg-background-100 text-foreground-500 border border-background-200 cursor-pointer hover:border-background-300'
                  }
                `}
              >
                <i className={`${channelIcon(ch.channel)} text-xs`} />
                {ch.label}
                {!ch.available && (
                  <span className="text-[9px] text-foreground-300 ml-0.5">indisponível</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function channelIcon(channel: CommunicationChannel): string {
  switch (channel) {
    case 'in_app': return 'ri-smartphone-line';
    case 'email': return 'ri-mail-line';
    case 'whatsapp': return 'ri-whatsapp-line';
    case 'sms': return 'ri-chat-1-line';
    default: return 'ri-notification-line';
  }
}