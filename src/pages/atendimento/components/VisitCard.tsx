import type { VisitProposal } from '@/fixtures/types';
import Button from '@/components/base/Button';

interface Props {
  visit: VisitProposal;
  onConfirm: () => void;
  onRequestAnotherTime: () => void;
  onCancelVisit: () => void;
  confirming: boolean;
}

export default function VisitCard({ visit, onConfirm, onRequestAnotherTime, onCancelVisit, confirming }: Props) {
  const date = new Date(visit.proposedDate + 'T00:00:00');

  return (
    <div className="rounded-2xl border border-accent-200 bg-accent-50/50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-accent-100 flex items-center justify-center flex-shrink-0">
          <i className="ri-calendar-check-line text-accent-600 text-sm" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground-900">
            {visit.confirmed ? 'Visita confirmada' : 'Visita proposta'}
          </p>
          <p className="text-xs text-foreground-500">{visit.purpose}</p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <i className="ri-calendar-line text-foreground-400 w-4 text-center flex-shrink-0" />
          <span className="text-foreground-700">
            {date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <i className="ri-time-line text-foreground-400 w-4 text-center flex-shrink-0" />
          <span className="text-foreground-700">{visit.timeWindow}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <i className="ri-map-pin-line text-foreground-400 w-4 text-center flex-shrink-0" />
          <span className="text-foreground-700">{visit.address}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <i className="ri-user-line text-foreground-400 w-4 text-center flex-shrink-0" />
          <span className="text-foreground-700">{visit.contactPerson}</span>
        </div>
      </div>

      {visit.preparationInstructions && (
        <div className="bg-white rounded-xl p-3 mb-4 border border-accent-100">
          <p className="text-xs font-medium text-foreground-800 mb-1">Preparação:</p>
          <p className="text-xs text-foreground-600">{visit.preparationInstructions}</p>
        </div>
      )}

      {visit.confirmable && (
        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            size="sm"
            fullWidth
            loading={confirming}
            onClick={onConfirm}
          >
            <i className="ri-check-line mr-1" />
            Confirmar visita
          </Button>
          <Button
            variant="text"
            size="sm"
            fullWidth
            onClick={onRequestAnotherTime}
          >
            Solicitar outro horário
          </Button>
          <button
            className="text-xs text-foreground-400 hover:text-red-500 transition-colors cursor-pointer py-1"
            onClick={onCancelVisit}
          >
            Não preciso mais da visita
          </button>
        </div>
      )}

      {visit.confirmed && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-xl border border-green-100">
          <i className="ri-check-double-line text-green-600 text-sm" />
          <span className="text-sm text-green-700 font-medium">Visita confirmada</span>
        </div>
      )}
    </div>
  );
}