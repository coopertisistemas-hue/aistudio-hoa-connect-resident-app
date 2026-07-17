import type { TimelineEvent, SupportAttachment } from '@/fixtures/types';

interface Props {
  event: TimelineEvent;
  isLast: boolean;
}

const actorStyles: Record<string, { bg: string; text: string }> = {
  resident: { bg: 'bg-primary-100', text: 'text-primary-700' },
  association: { bg: 'bg-accent-100', text: 'text-accent-700' },
  system: { bg: 'bg-background-200', text: 'text-foreground-600' },
};

export default function TimelineItem({ event, isLast }: Props) {
  const style = actorStyles[event.actorType] || actorStyles.system;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${style.bg}`}>
          {event.actorType === 'resident' ? (
            <i className="ri-user-line text-sm text-primary-600" />
          ) : event.actorType === 'association' ? (
            <i className="ri-building-line text-sm text-accent-600" />
          ) : (
            <i className="ri-refresh-line text-sm text-foreground-500" />
          )}
        </div>
        {!isLast && <div className="w-0.5 flex-1 min-h-[20px] bg-background-200 mt-1" />}
      </div>
      <div className={`min-w-0 flex-1 ${isLast ? '' : 'pb-4'}`}>
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-xs font-semibold ${style.text}`}>{event.actorName}</span>
          <span className="text-xs text-foreground-400">
            {new Date(event.dateTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            {' '}
            {new Date(event.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <p className="text-sm font-medium text-foreground-800 mb-0.5">{event.title}</p>
        <p className="text-sm text-foreground-600">{event.description}</p>
        {event.statusChangeLabel && (
          <span className="inline-block mt-1.5 px-2 py-0.5 rounded-full bg-background-200 text-xs font-medium text-foreground-600">
            Status: {event.statusChangeLabel}
          </span>
        )}
        {event.attachment && (
          <AttachmentCard attachment={event.attachment} />
        )}
      </div>
    </div>
  );
}

export function AttachmentCard({ attachment }: { attachment: SupportAttachment }) {
  const iconMap: Record<string, string> = {
    photo: 'ri-image-line',
    receipt: 'ri-file-text-line',
    document: 'ri-file-text-line',
    meter_image: 'ri-camera-line',
    other: 'ri-attachment-2',
  };

  return (
    <div className="mt-2 flex items-center gap-2.5 px-3 py-2 rounded-xl bg-background-100 border border-background-200">
      <div className="w-8 h-8 rounded-lg bg-background-200 flex items-center justify-center flex-shrink-0">
        <i className={`${iconMap[attachment.type] || 'ri-attachment-2'} text-sm text-foreground-500`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground-700 truncate">{attachment.name}</p>
        <p className="text-xs text-foreground-400">{attachment.size}</p>
      </div>
    </div>
  );
}