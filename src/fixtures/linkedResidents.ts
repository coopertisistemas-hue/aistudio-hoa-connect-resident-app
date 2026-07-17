import type { LinkedResident } from '@/fixtures/types';

export const linkedResidents: LinkedResident[] = [
  {
    id: 'lr-001',
    name: 'Carlos Eduardo Silva',
    firstName: 'Carlos',
    relationship: 'holder',
    relationshipLabel: 'Titular',
    initials: 'CS',
    status: 'active',
  },
  {
    id: 'lr-002',
    name: 'Mariana Oliveira Silva',
    firstName: 'Mariana',
    relationship: 'authorized',
    relationshipLabel: 'Autorizada',
    initials: 'MS',
    status: 'active',
  },
  {
    id: 'lr-003',
    name: 'Pedro Silva',
    firstName: 'Pedro',
    relationship: 'dependent',
    relationshipLabel: 'Dependente',
    initials: 'PS',
    status: 'active',
  },
];

export const linkedResidentsWithPending: LinkedResident[] = [
  ...linkedResidents,
  {
    id: 'lr-004',
    name: 'Ana Beatriz Silva',
    firstName: 'Ana',
    relationship: 'pending',
    relationshipLabel: 'Convite pendente',
    initials: 'AS',
    status: 'pending',
  },
];