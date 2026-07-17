import type { SupportMessage, SupportAttachment } from '@/fixtures/types';

interface Props {
  message: SupportMessage;
}

export default function MessageBubble({ message }: Props) {
  const isResident = message.senderType === 'resident';
  const isSystem = message.senderType === 'system';

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <div className="px-4 py-2 rounded-2xl bg-background-100 text-center max-w-xs">
          <p className="text-xs text-foreground-500">{message.content}</p>
          {message.attachment && (
            <div className="mt-2 text-xs text-foreground-400">
              <i className="ri-attachment-2 mr-1" />
              {message.attachment.name}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isResident ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${isResident ? '' : 'flex gap-2'}`}>
        {!isResident && (
          <div className="w-7 h-7 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0 mt-1">
            <i className="ri-building-line text-xs text-accent-600" />
          </div>
        )}
        <div>
          <div className={`
            rounded-2xl px-4 py-3
            ${isResident
              ? 'bg-primary-500 text-white rounded-br-md'
              : 'bg-background-100 text-foreground-800 rounded-bl-md border border-background-200'
            }
          `}>
            {!isResident && (
              <p className="text-xs font-semibold text-accent-700 mb-0.5">{message.senderName}</p>
            )}
            <p className={`text-sm leading-relaxed ${isResident ? 'text-white' : 'text-foreground-800'}`}>
              {message.content}
            </p>
            {message.attachment && (
              <div className={`mt-2 flex items-center gap-2 px-2 py-1.5 rounded-lg ${isResident ? 'bg-white/15' : 'bg-background-200'}`}>
                <i className={`ri-attachment-2 text-sm ${isResident ? 'text-white/70' : 'text-foreground-500'}`} />
                <span className={`text-xs truncate ${isResident ? 'text-white/80' : 'text-foreground-600'}`}>
                  {message.attachment.name}
                </span>
              </div>
            )}
          </div>
          <div className={`flex items-center gap-1.5 mt-1 ${isResident ? 'justify-end' : 'justify-start'}`}>
            <span className="text-xs text-foreground-400">
              {new Date(message.dateTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
              {' '}
              {new Date(message.dateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {message.requiresReply && (
              <span className="text-xs font-medium text-accent-600 whitespace-nowrap">
                Aguarda resposta
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}