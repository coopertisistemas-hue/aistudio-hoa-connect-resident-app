import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Card from '@/components/base/Card';
import Badge from '@/components/base/Badge';
import Button from '@/components/base/Button';
import Skeleton from '@/components/base/Skeleton';
import EmptyState from '@/components/base/EmptyState';
import BottomSheet from '@/components/base/BottomSheet';
import { showToast } from '@/components/base/Toast';
import { useRequestDetail, useReplyAction, useCancelRequest, useCloseRequest, useReopenRequest, useRatingAction, useConfirmVisitAction } from '@/hooks/useSupportData';
import TimelineItem, { AttachmentCard } from '@/pages/atendimento/components/TimelineItem';
import MessageBubble from '@/pages/atendimento/components/MessageBubble';
import VisitCard from '@/pages/atendimento/components/VisitCard';
import RatingFlow from '@/pages/atendimento/components/RatingFlow';

const statusColor: Record<string, 'info' | 'warning' | 'success' | 'error' | 'neutral'> = {
  'Em triagem': 'info',
  'Em análise': 'warning',
  'Em andamento': 'warning',
  'Enviada': 'info',
  'Recebida': 'info',
  'Aguardando morador': 'warning',
  'Aguardando associação': 'info',
  'Visita agendada': 'info',
  'Visita confirmada': 'success',
  'Resolvida': 'success',
  'Concluída': 'success',
  'Cancelada': 'neutral',
  'Reaberta': 'warning',
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  normal: { label: 'Normal', color: 'text-foreground-500' },
  important: { label: 'Importante', color: 'text-accent-600' },
  urgent: { label: 'Urgente', color: 'text-red-600' },
};

export default function RequestDetailPage() {
  const navigate = useNavigate();
  const { requestId } = useParams<{ requestId: string }>();
  const { request, loading, error, isOffline, refresh } = useRequestDetail(requestId || '');

  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [closeOpen, setCloseOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [rateOpen, setRateOpen] = useState(false);

  const { sendReply, sending } = useReplyAction();
  const { cancel } = useCancelRequest();
  const { close } = useCloseRequest();
  const { reopen } = useReopenRequest();
  const { rate, loading: ratingLoading } = useRatingAction();
  const { confirm: confirmVisit, loading: confirmingVisit } = useConfirmVisitAction();

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-full bg-background-100 flex items-center justify-center">
            <i className="ri-arrow-left-line text-foreground-400" />
          </div>
          <Skeleton className="h-6 w-40" />
        </div>
        <Skeleton className="h-32 w-full rounded-2xl mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (error || !request) {
    return (
      <AppShell>
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-background-100 flex items-center justify-center cursor-pointer">
            <i className="ri-arrow-left-line text-foreground-600" />
          </button>
          <h1 className="text-xl font-bold text-foreground-900 font-heading">Detalhe</h1>
        </div>
        <EmptyState
          icon="ri-error-warning-line"
          title="Detalhe indisponível"
          description={isOffline ? 'Você está offline.' : error || 'Solicitação não encontrada.'}
          action={
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={refresh}>Tentar novamente</Button>
              <Button variant="text" size="sm" onClick={() => navigate(-1)}>Voltar</Button>
            </div>
          }
        />
      </AppShell>
    );
  }

  const hasTimeline = request.timeline.length > 0;
  const hasMessages = request.messages.length > 0;
  const statusVariant = statusColor[request.statusLabel] || 'info';
  const priority = priorityConfig[request.priority] || priorityConfig.normal;

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-background-100 flex items-center justify-center cursor-pointer hover:bg-background-200 transition-colors flex-shrink-0"
        >
          <i className="ri-arrow-left-line text-foreground-600" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-foreground-900 font-heading line-clamp-1">
            {request.subject}
          </h1>
          <p className="text-xs text-foreground-500 font-mono">#{request.protocol}</p>
        </div>
        {request.status !== 'closed' && request.status !== 'canceled' && (
          <button
            className="w-9 h-9 rounded-full bg-background-100 flex items-center justify-center cursor-pointer hover:bg-background-200 transition-colors flex-shrink-0"
            onClick={refresh}
            aria-label="Atualizar"
          >
            <i className="ri-refresh-line text-foreground-600" />
          </button>
        )}
      </div>

      {/* Status Banner */}
      <Card className="mb-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={statusVariant} size="sm">{request.statusLabel}</Badge>
              <span className={`text-xs font-medium ${priority.color}`}>{priority.label}</span>
            </div>
            <p className="text-sm text-foreground-600">{request.statusExplanation}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-foreground-500 pt-2 border-t border-background-200">
          <span>Criado em {new Date(request.createdAt).toLocaleDateString('pt-BR')}</span>
          <span>Atualizado {new Date(request.updatedAt).toLocaleDateString('pt-BR')}</span>
          <span>{request.residenceNickname}</span>
          <span>{request.responsibleArea}</span>
        </div>
      </Card>

      {/* Details */}
      <Card className="mb-4">
        <div className="space-y-3">
          <div>
            <p className="text-xs text-foreground-500 mb-0.5">Categoria</p>
            <p className="text-sm font-medium text-foreground-800">{request.categoryLabel}</p>
          </div>
          {request.relatedEntity.type !== 'none' && (
            <div>
              <p className="text-xs text-foreground-500 mb-0.5">Relacionado a</p>
              {request.relatedEntity.path ? (
                <button
                  onClick={() => navigate(request.relatedEntity.path!)}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700 cursor-pointer flex items-center gap-1"
                >
                  {request.relatedEntity.label}
                  <i className="ri-arrow-right-up-line text-xs" />
                </button>
              ) : (
                <p className="text-sm font-medium text-foreground-800">{request.relatedEntity.label}</p>
              )}
            </div>
          )}
          <div>
            <p className="text-xs text-foreground-500 mb-0.5">Descrição</p>
            <p className="text-sm text-foreground-700 leading-relaxed">{request.description}</p>
          </div>
          <div>
            <p className="text-xs text-foreground-500 mb-0.5">Contato preferencial</p>
            <p className="text-sm text-foreground-700">{request.contactChannel === 'whatsapp' ? 'WhatsApp' : request.contactChannel === 'email' ? 'E-mail' : request.contactChannel === 'phone' ? 'Telefone' : 'App'}</p>
            {request.preferredTime && (
              <p className="text-xs text-foreground-400 mt-0.5">Melhor horário: {request.preferredTime}</p>
            )}
          </div>

          {/* Attachments */}
          {request.attachments.length > 0 && (
            <div className="space-y-2">
              {request.attachments.map((att) => (
                <AttachmentCard key={att.id} attachment={att} />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Visit */}
      {request.visitProposal && (
        <div className="mb-4">
          <VisitCard
            visit={request.visitProposal}
            confirming={confirmingVisit}
            onConfirm={async () => {
              const result = await confirmVisit(request.id);
              if (result) {
                showToast('Visita confirmada para demonstração.', 'success');
                refresh();
              }
            }}
            onRequestAnotherTime={() => showToast('Solicitação de novo horário registrada para demonstração.', 'info')}
            onCancelVisit={() => showToast('Solicitação de cancelamento da visita registrada para demonstração.', 'info')}
          />
        </div>
      )}

      {/* Expected Next Step */}
      <div className="mb-4 px-4 py-3 rounded-2xl bg-accent-50 border border-accent-100">
        <div className="flex items-center gap-2 mb-1">
          <i className="ri-lightbulb-line text-accent-600 text-sm" />
          <p className="text-xs font-semibold text-accent-700">Próximo passo</p>
        </div>
        <p className="text-sm text-foreground-700">{request.expectedNextStep}</p>
      </div>

      {/* Rating */}
      {request.rating && (
        <Card className="mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
              <i className="ri-star-fill text-amber-600 text-sm" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground-800">Sua avaliação</p>
              <p className="text-amber-600 text-sm">{'★'.repeat(request.rating.score)}{'☆'.repeat(5 - request.rating.score)}</p>
              {request.rating.comment && (
                <p className="text-xs text-foreground-500 mt-0.5">{request.rating.comment}</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Timeline */}
      {hasTimeline && (
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-foreground-800 mb-3">Linha do tempo</h3>
          <div className="space-y-0">
            {request.timeline.map((event, idx) => (
              <TimelineItem key={event.id} event={event} isLast={idx === request.timeline.length - 1} />
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {(hasMessages || request.eligibleActions.some((a) => a.type === 'reply')) && (
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-foreground-800 mb-3">Mensagens</h3>
          {hasMessages ? (
            <div className="space-y-3">
              {request.messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground-500 text-center py-4">Nenhuma mensagem ainda.</p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {request.eligibleActions.length > 0 && (
        <div className="flex flex-col gap-2 mb-5">
          {request.eligibleActions.map((action) => (
            <ActionButton
              key={action.type}
              action={action}
              onClick={() => {
                switch (action.type) {
                  case 'reply': setReplyOpen(true); break;
                  case 'cancel_request': setCancelOpen(true); break;
                  case 'close_request': setCloseOpen(true); break;
                  case 'reopen_request': setReopenOpen(true); break;
                  case 'rate': setRateOpen(true); break;
                  case 'view_invoice': navigate(action.type === 'view_invoice' ? '/faturas' : ''); break;
                  case 'view_reading': navigate('/consumo'); break;
                  case 'view_notice': navigate('/avisos'); break;
                  case 'view_receipt': navigate('/pagamentos'); break;
                  case 'attach':
                  case 'add_info':
                    showToast('Funcionalidade disponível para demonstração.', 'info');
                    break;
                  default:
                    showToast('Ação registrada para demonstração.', 'info');
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Offline */}
      {isOffline && (
        <div className="mb-5 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-2">
          <i className="ri-wifi-off-line text-amber-600 text-sm" />
          <span className="text-sm text-amber-700">Você está offline. Algumas ações não estão disponíveis.</span>
        </div>
      )}

      {/* Reply Bottom Sheet */}
      <BottomSheet open={replyOpen} onClose={() => { setReplyText(''); setReplyOpen(false); }} title="Responder">
        <div className="space-y-3">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value.slice(0, 500))}
            placeholder="Escreva sua mensagem..."
            rows={3}
            className="w-full rounded-xl border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 placeholder:text-foreground-300 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 resize-none"
          />
          <div className="text-xs text-foreground-400 text-right">{replyText.length}/500</div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" fullWidth onClick={() => { setReplyText(''); setReplyOpen(false); }}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="sm"
              fullWidth
              loading={sending}
              disabled={!replyText.trim()}
              onClick={async () => {
                const result = await sendReply(request.id, replyText.trim());
                if (result) {
                  showToast('Resposta adicionada para demonstração.', 'success');
                  setReplyText('');
                  setReplyOpen(false);
                  refresh();
                } else {
                  showToast('Erro ao enviar resposta.', 'error');
                }
              }}
            >
              Enviar
            </Button>
          </div>
          <button
            className="w-full text-center text-sm text-foreground-400 hover:text-primary-600 transition-colors cursor-pointer py-1"
            onClick={() => showToast('Anexo simulado para demonstração.', 'info')}
          >
            <i className="ri-attachment-2 mr-1" />Anexar documento
          </button>
        </div>
      </BottomSheet>

      {/* Cancel Bottom Sheet */}
      <BottomSheet open={cancelOpen} onClose={() => { setCancelReason(''); setCancelOpen(false); }} title="Cancelar solicitação">
        <div className="space-y-3">
          <p className="text-sm text-foreground-600">
            Informe o motivo do cancelamento. Sua solicitação será arquivada e você poderá abrir uma nova se necessário.
          </p>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value.slice(0, 300))}
            placeholder="Descreva o motivo..."
            rows={2}
            className="w-full rounded-xl border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 placeholder:text-foreground-300 outline-none focus:border-primary-400 resize-none"
          />
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" fullWidth onClick={() => { setCancelReason(''); setCancelOpen(false); }}>
              Voltar
            </Button>
            <Button
              variant="primary"
              size="sm"
              fullWidth
              disabled={!cancelReason.trim()}
              onClick={async () => {
                const result = await cancel(request.id, cancelReason.trim());
                if (result) {
                  showToast('Solicitação cancelada para demonstração.', 'success');
                  setCancelOpen(false);
                  refresh();
                }
              }}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Close Bottom Sheet */}
      <BottomSheet open={closeOpen} onClose={() => setCloseOpen(false)} title="Encerrar solicitação">
        <div className="space-y-3">
          <p className="text-sm text-foreground-600">
            Confirme que sua solicitação foi atendida. Após o encerramento, você poderá avaliar o atendimento.
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" fullWidth onClick={() => setCloseOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="primary"
              size="sm"
              fullWidth
              onClick={async () => {
                const result = await close(request.id);
                if (result) {
                  showToast('Solicitação encerrada para demonstração.', 'success');
                  setCloseOpen(false);
                  refresh();
                }
              }}
            >
              Encerrar
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Reopen Bottom Sheet */}
      <BottomSheet open={reopenOpen} onClose={() => { setReopenReason(''); setReopenOpen(false); }} title="Reabrir solicitação">
        <div className="space-y-3">
          <p className="text-sm text-foreground-600">
            Descreva o que ainda precisa ser resolvido para que a associação possa dar continuidade ao seu atendimento.
          </p>
          <textarea
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value.slice(0, 500))}
            placeholder="O que ainda não foi resolvido?"
            rows={3}
            className="w-full rounded-xl border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 placeholder:text-foreground-300 outline-none focus:border-primary-400 resize-none"
          />
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" fullWidth onClick={() => { setReopenReason(''); setReopenOpen(false); }}>
              Voltar
            </Button>
            <Button
              variant="primary"
              size="sm"
              fullWidth
              disabled={!reopenReason.trim()}
              onClick={async () => {
                const result = await reopen(request.id, reopenReason.trim());
                if (result) {
                  showToast('Solicitação reaberta para demonstração.', 'success');
                  setReopenOpen(false);
                  refresh();
                }
              }}
            >
              Reabrir
            </Button>
          </div>
        </div>
      </BottomSheet>

      {/* Rating Bottom Sheet */}
      <BottomSheet open={rateOpen} onClose={() => setRateOpen(false)} title="Avaliar atendimento">
        <RatingFlow
          loading={ratingLoading}
          onSubmit={async (score, comment) => {
            const result = await rate(request.id, score, comment);
            if (result) {
              showToast('Avaliação registrada para demonstração.', 'success');
              setRateOpen(false);
              refresh();
            }
          }}
          onSkip={() => setRateOpen(false)}
        />
      </BottomSheet>
    </AppShell>
  );
}

function ActionButton({ action, onClick }: { action: { type: string; label: string; icon: string }; onClick: () => void }) {
  const isPrimary = ['reply', 'confirm_visit', 'rate'].includes(action.type);

  return (
    <Button
      variant={isPrimary ? 'primary' : 'secondary'}
      size="sm"
      fullWidth
      onClick={onClick}
    >
      <i className={`${action.icon} mr-1`} />
      {action.label}
    </Button>
  );
}