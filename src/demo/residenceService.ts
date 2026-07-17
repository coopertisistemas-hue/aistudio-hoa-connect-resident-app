import type { ResidenceDetail, ResidenceContext, WaterServiceInfo, LinkedResident, ContactPreferences, AssociationInfo, DocumentPreview } from '@/fixtures/types';
import { activeScenario } from '@/fixtures/scenarios';
import { residence } from '@/fixtures/residence';
import { association } from '@/fixtures/association';
import { waterService, waterServiceUnavailable } from '@/fixtures/waterService';
import { linkedResidents, linkedResidentsWithPending } from '@/fixtures/linkedResidents';
import { contactPreferences } from '@/fixtures/preferences';
import { associationInfo } from '@/fixtures/associationInfo';
import { propertyDocuments } from '@/fixtures/documents';

export const multipleResidences: ResidenceContext[] = [
  {
    id: 'prop-001',
    nickname: 'Apto Bloco 3',
    address: 'Rua das Nascentes, 500 — Bloco 3, Apto 201',
    shortAddress: 'Bloco 3, Apto 201',
    unit: 'Apto 201',
    block: 'Bloco 3',
    status: 'active',
    isPrimary: true,
  },
  {
    id: 'prop-002',
    nickname: 'Casa Centro',
    address: 'Rua Visconde de Nácar, 1200 — Casa 7',
    shortAddress: 'Casa 7',
    unit: 'Casa 7',
    status: 'active',
    isPrimary: false,
  },
];

export async function fetchResidenceContexts(): Promise<ResidenceContext[]> {
  await new Promise((r) => setTimeout(r, 400));
  if (activeScenario === 'multiResidence') return multipleResidences;
  return [multipleResidences[0]];
}

export async function fetchResidenceDetail(residenceId: string): Promise<ResidenceDetail> {
  await new Promise((r) => setTimeout(r, 600));

  const target = residenceId === 'prop-002'
    ? {
        id: 'prop-002',
        nickname: 'Casa Centro',
        fullAddress: 'Rua Visconde de Nácar, 1200 — Casa 7 — Curitiba, PR',
        unit: 'Casa 7',
        type: 'Casa',
        bedrooms: 4,
        residentsCount: 2,
        occupancy: 'Proprietário',
        status: 'Ativa',
        registrationNumber: 'MAT-78901',
        associationName: association.name,
        associationShortName: association.shortName,
      }
    : {
        id: 'prop-001',
        nickname: 'Apto Bloco 3',
        fullAddress: 'Rua das Nascentes, 500 — Bloco 3, Apto 201 — Curitiba, PR',
        unit: 'Apto 201',
        block: 'Bloco 3',
        type: 'Apartamento',
        bedrooms: residence.bedrooms,
        residentsCount: residence.residents,
        occupancy: 'Titular responsável',
        status: 'Ativa',
        registrationNumber: residence.registrationNumber,
        associationName: association.name,
        associationShortName: association.shortName,
      };

  return target;
}

export async function fetchWaterServiceInfo(): Promise<WaterServiceInfo> {
  await new Promise((r) => setTimeout(r, 500));
  if (activeScenario === 'partialError') return waterServiceUnavailable;
  return waterService;
}

export async function fetchLinkedResidents(): Promise<LinkedResident[]> {
  await new Promise((r) => setTimeout(r, 400));
  return linkedResidentsWithPending;
}

export async function fetchContactPreferences(): Promise<ContactPreferences> {
  await new Promise((r) => setTimeout(r, 300));
  return contactPreferences;
}

export async function fetchAssociationInfo(): Promise<AssociationInfo> {
  await new Promise((r) => setTimeout(r, 300));
  return associationInfo;
}

export async function fetchPropertyDocuments(): Promise<DocumentPreview[]> {
  await new Promise((r) => setTimeout(r, 400));
  return propertyDocuments;
}