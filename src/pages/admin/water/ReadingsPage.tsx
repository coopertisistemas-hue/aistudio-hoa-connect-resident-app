import { useEffect, useState } from 'react';
import AppShell from '@/components/feature/AppShell';
import { RequireRole } from '@/lib/auth/RequireRole';
import Card from '@/components/base/Card';
import Button from '@/components/base/Button';
import Input from '@/components/base/Input';
import LoadingState from '@/components/base/LoadingState';
import Badge from '@/components/base/Badge';
import { useAdminWaterData } from '@/hooks/useAdminWaterData';
import type { MeterReadingInput } from '@/lib/water/types';

export default function AdminReadingsPage() {
  const { meters, selectedMeter, loading, error, loadMeters, loadMeter, loadReadings, addReading } = useAdminWaterData();
  const [selectedMeterId, setSelectedMeterId] = useState<string>('');
  const [readingForm, setReadingForm] = useState<Partial<MeterReadingInput>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    loadMeters('demo-tenant-001');
  }, [loadMeters]);

  useEffect(() => {
    if (selectedMeterId) {
      loadMeter(selectedMeterId);
    }
  }, [selectedMeterId, loadMeter]);

  const handleAddReading = async () => {
    if (!selectedMeterId) {
      setFormError('Selecione um hidrômetro');
      return;
    }
    if (!readingForm.readingValue && readingForm.readingValue !== 0) {
      setFormError('Valor da leitura é obrigatório');
      return;
    }
    const input: MeterReadingInput = {
      tenantId: 'demo-tenant-001',
      meterId: selectedMeterId,
      readingDate: readingForm.readingDate || new Date().toISOString().split('T')[0],
      readingValue: Number(readingForm.readingValue),
      source: readingForm.source || 'manual',
      notes: readingForm.notes,
    };
    const result = await addReading(input);
    if (result) {
      setReadingForm({});
      setFormError(null);
      loadReadings(selectedMeterId);
    }
  };

  return (
    <RequireRole roles={['association_admin', 'association_operator', 'association_finance']}>
      <AppShell>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Leituras</h1>
          </div>

          {error && (
            <Card className="p-4 border-red-200 bg-red-50">
              <p className="text-red-700 text-sm">{error}</p>
            </Card>
          )}

          <Card className="p-4">
            <h2 className="font-semibold mb-3">Registrar Leitura</h2>
            {formError && <p className="text-red-600 text-sm mb-2">{formError}</p>}
            <div className="space-y-3">
              <select
                className="w-full border border-gray-300 rounded-md p-2 text-sm"
                value={selectedMeterId}
                onChange={e => setSelectedMeterId(e.target.value)}
              >
                <option value="">Selecione um hidrômetro...</option>
                {meters.map(m => (
                  <option key={m.id} value={m.id}>{m.meterNumber} — {m.location || m.id}</option>
                ))}
              </select>
              <Input
                label="Valor da Leitura (m³)"
                type="number"
                step="0.001"
                value={String(readingForm.readingValue || '')}
                onChange={e => setReadingForm({ ...readingForm, readingValue: Number(e.target.value) })}
                placeholder="Ex: 1250.500"
              />
              <Input
                label="Data da Leitura"
                type="date"
                value={readingForm.readingDate || ''}
                onChange={e => setReadingForm({ ...readingForm, readingDate: e.target.value })}
              />
              <select
                className="w-full border border-gray-300 rounded-md p-2 text-sm"
                value={readingForm.source || 'manual'}
                onChange={e => setReadingForm({ ...readingForm, source: e.target.value as MeterReadingInput['source'] })}
              >
                <option value="manual">Manual</option>
                <option value="estimated">Estimada</option>
                <option value="corrected">Corrigida</option>
              </select>
              <Input
                label="Observações"
                value={readingForm.notes || ''}
                onChange={e => setReadingForm({ ...readingForm, notes: e.target.value })}
                placeholder="Observações sobre a leitura"
              />
              <Button onClick={handleAddReading} className="w-full">
                Registrar Leitura
              </Button>
            </div>
          </Card>

          {selectedMeter && (
            <Card className="p-4">
              <h2 className="font-semibold mb-3">
                Histórico — {selectedMeter.meter.meterNumber}
              </h2>
              {loading && <LoadingState />}
              {selectedMeter.readings.length === 0 && (
                <p className="text-sm text-gray-400">Nenhuma leitura registrada</p>
              )}
              <div className="space-y-2">
                {selectedMeter.readings.map(reading => (
                  <div key={reading.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <div>
                      <p className="text-sm font-medium">{reading.readingValue.toLocaleString('pt-BR')} m³</p>
                      <p className="text-xs text-gray-500">{new Date(reading.readingDate).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <Badge variant="neutral" className="text-xs">
                      {reading.source === 'initial' ? 'Inicial' : reading.source === 'estimated' ? 'Estimada' : reading.source === 'corrected' ? 'Corrigida' : 'Manual'}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </AppShell>
    </RequireRole>
  );
}
