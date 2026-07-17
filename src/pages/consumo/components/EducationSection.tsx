import type { EducationCard } from '@/fixtures/types';
import Card from '@/components/base/Card';

interface EducationSectionProps {
  cards: EducationCard[];
}

export default function EducationSection({ cards }: EducationSectionProps) {
  if (cards.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-foreground-800 font-heading mb-3">Dicas de uso consciente</h3>
      <div className="space-y-2">
        {cards.map((card) => (
          <Card key={card.id}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-secondary-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <i className={`${card.icon} text-secondary-600 text-sm`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground-800">{card.title}</p>
                <p className="text-xs text-foreground-500 mt-1 leading-relaxed">{card.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}