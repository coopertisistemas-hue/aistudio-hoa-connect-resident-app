import type { WaterServiceInfo } from '@/fixtures/types';

export const waterService: WaterServiceInfo = {
  meterId: 'HID-2024-0891',
  meterLabel: 'Hidrômetro principal',
  installationLocation: 'Área de serviço — Bloco 3, Apto 201',
  serviceStatus: 'active',
  serviceStatusLabel: 'Ativo',
  lastReadingDate: '2026-07-15',
  lastReadingValue: 22,
  nextReadingWindow: '10 a 15 de agosto de 2026',
  unit: 'm³',
};

export const waterServiceUnavailable: WaterServiceInfo = {
  meterId: 'HID-2024-0891',
  meterLabel: 'Hidrômetro principal',
  installationLocation: 'Área de serviço — Bloco 3, Apto 201',
  serviceStatus: 'under_review',
  serviceStatusLabel: 'Em verificação',
  lastReadingDate: '2026-06-15',
  lastReadingValue: 19,
  nextReadingWindow: 'Indisponível',
  unit: 'm³',
};