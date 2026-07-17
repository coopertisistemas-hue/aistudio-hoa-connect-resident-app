import type { DocumentPreview } from '@/fixtures/types';

export const propertyDocuments: DocumentPreview[] = [
  {
    id: 'doc-001',
    title: 'Declaração de matrícula',
    type: 'Declaração',
    description: 'Comprovante de matrícula da unidade junto à associação',
    date: '2026-01-10',
    isDemo: true,
  },
  {
    id: 'doc-002',
    title: 'Declaração de residência',
    type: 'Declaração',
    description: 'Declaração de residência para fins de comprovação',
    date: '2026-06-05',
    isDemo: true,
  },
  {
    id: 'doc-003',
    title: 'Termo de serviços',
    type: 'Contrato',
    description: 'Termo de adesão aos serviços da associação',
    date: '2024-03-15',
    isDemo: true,
  },
];