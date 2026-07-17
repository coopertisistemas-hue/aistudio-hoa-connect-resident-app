import { useState } from 'react';
import Button from '@/components/base/Button';

interface Props {
  onSubmit: (score: number, comment?: string) => void;
  onSkip: () => void;
  loading: boolean;
}

const emojis = ['😞', '😐', '🙂', '😊', '😍'];
const labels = ['Ruim', 'Regular', 'Bom', 'Muito bom', 'Excelente'];

export default function RatingFlow({ onSubmit, onSkip, loading }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [step, setStep] = useState<'score' | 'comment' | 'thanks'>('score');

  if (step === 'thanks') {
    return (
      <div className="text-center py-6">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
          <i className="ri-heart-line text-xl text-green-600" />
        </div>
        <p className="text-base font-semibold text-foreground-900 mb-1">
          Obrigado por compartilhar sua experiência.
        </p>
        <p className="text-sm text-foreground-500 mb-4">
          Sua avaliação nos ajuda a melhorar o atendimento.
        </p>
        <Button variant="text" size="sm" onClick={onSkip}>
          Fechar
        </Button>
      </div>
    );
  }

  if (step === 'comment') {
    return (
      <div>
        <div className="flex justify-center gap-2 mb-4">
          <span className="text-3xl">{emojis[selected! - 1]}</span>
        </div>
        <p className="text-sm font-medium text-foreground-800 text-center mb-1">
          {labels[selected! - 1]}
        </p>
        <p className="text-xs text-foreground-500 text-center mb-4">
          Gostaria de deixar algum comentário?
        </p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, 500))}
          placeholder="Compartilhe sua experiência (opcional)..."
          rows={3}
          className="w-full rounded-xl border border-background-300 bg-background-50 px-3 py-2.5 text-sm text-foreground-900 placeholder:text-foreground-300 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 resize-none mb-3"
        />
        <div className="text-xs text-foreground-400 text-right mb-3">
          {comment.length}/500
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" fullWidth onClick={() => setStep('score')}>
            Voltar
          </Button>
          <Button
            variant="primary"
            size="sm"
            fullWidth
            loading={loading}
            onClick={() => {
              onSubmit(selected!, comment || undefined);
              setStep('thanks');
            }}
          >
            Enviar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm font-medium text-foreground-800 text-center mb-1">
        Como foi sua experiência com este atendimento?
      </p>
      <p className="text-xs text-foreground-500 text-center mb-4">
        Toque nas estrelas para avaliar
      </p>
      <div className="flex justify-center gap-1.5 mb-4">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            onClick={() => {
              setSelected(score);
              if (score >= 4) {
                setStep('comment');
              } else {
                setStep('comment');
              }
            }}
            className={`w-12 h-12 rounded-full flex items-center justify-center cursor-pointer transition-all duration-200 text-lg ${
              selected !== null && score <= selected
                ? 'bg-amber-100 text-amber-600 scale-110'
                : 'bg-background-100 text-foreground-400 hover:bg-background-200 hover:scale-105'
            }`}
            aria-label={`Nota ${score}`}
          >
            {score <= (selected || 0) ? '★' : '☆'}
          </button>
        ))}
      </div>
      <button
        className="w-full text-center text-sm text-foreground-400 hover:text-foreground-600 transition-colors cursor-pointer py-2"
        onClick={onSkip}
      >
        Não quero avaliar
      </button>
    </div>
  );
}