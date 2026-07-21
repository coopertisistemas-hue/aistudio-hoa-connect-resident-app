import { useEffect, useState } from 'react';
import AppShell from '@/components/feature/AppShell';
import { RequireRole } from '@/lib/auth/RequireRole';
import Card from '@/components/base/Card';
import Button from '@/components/base/Button';
import Input from '@/components/base/Input';
import Modal from '@/components/base/Modal';
import LoadingState from '@/components/base/LoadingState';
import Badge from '@/components/base/Badge';
import { useAdminWaterData } from '@/hooks/useAdminWaterData';
import type { WaterMeterInput } from '@/lib/water/types';

export default function AdminMetersPage() {
  const { meters, loading, error, loadMeters, addMeter, removeMeter } = useAdminWaterData();
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState<Partial<WaterMeterInput>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    loadMeters('demo-tenant-001');
  }, [loadMeters]);

  const handleAdd = async () => {
    if (!form.meterNumber || !form.propertyId) {
      setFormError('Número do hidrômetro e propriedade são obrigatórios');
      return;
    }
    const input: WaterMeterInput = {
      tenantId: 'demo-tenant-001',
      propertyId: form.propertyId,
      meterNumber: form.meterNumber,
      installationDate: form.installationDate || new Date().toISOString().split('T')[0],
      initialReading: form.initialReading || 0,
      location: form.location,
      notes: form.notes,
    };
    const result = await addMeter(input);
    if (result) {
      setShowAddModal(false);
      setForm({});
      setFormError(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este hidrômetro?')) {
      await removeMeter(id);
    }
  };

  const statusVariant = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'neutral';
      case 'damaged': return 'error';
      case 'removed': return 'neutral';
      default: return 'neutral';
    }
  };

  return (
    <RequireRole roles={['association_admin', 'association_operator', 'association_finance']}>
      <AppShell>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Hidrômetros</h1>
            <Button onClick={() => setShowAddModal(true)}>
              + Novo Hidrômetro
            </Button>
          </div>

          {loading && <LoadingState />}

          {error && (
            <Card className="p-4 border-red-200 bg-red-50">
              <p className="text-red-700 text-sm">{error}</p>
            </Card>
          )}

          {!loading && meters.length === 0 && (
            <Card className="p-6">
              <p className="text-gray-500 text-center">Nenhum hidrômetro cadastrado</p>
            </Card>
          )}

          <div className="space-y-3">
            {meters.map(meter => (
              <Card key={meter.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{meter.meterNumber}</h3>
                      <Badge variant={statusVariant(meter.status)} className="text-xs">
                        {meter.status === 'active' ? 'Ativo' : meter.status === 'inactive' ? 'Inativo' : meter.status === 'damaged' ? 'Danificado' : 'Removido'}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500">
                      Instalação: {new Date(meter.installationDate).toLocaleDateString('pt-BR')}
                      {meter.location ? ` | Local: ${meter.location}` : ''}
                    </p>
                    <p className="text-sm text-gray-500">
                      Leitura Inicial: {meter.initialReading.toLocaleString('pt-BR')} m³
                    </p>
                    {meter.notes && <p className="text-xs text-gray-400 mt-1">{meter.notes}</p>}
                  </div>
                  <div className="flex gap-2">
                    <a href={`/admin/agua/hidrometros/${meter.id}`}>
                      <Button variant="text" size="sm">Detalhes</Button>
                    </a>
                    <Button variant="secondary" size="sm" onClick={() => handleDelete(meter.id)}>
                      Remover
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Modal open={showAddModal} onClose={() => setShowAddModal(false)}>
            <div className="p-4 space-y-3">
              <h2 className="text-lg font-semibold">Novo Hidrômetro</h2>
              {formError && <p className="text-red-600 text-sm">{formError}</p>}
              <Input
                label="Número do Hidrômetro"
                value={form.meterNumber || ''}
                onChange={e => setForm({ ...form, meterNumber: e.target.value })}
                placeholder="Ex: HIDRO-003"
              />
              <Input
                label="ID da Propriedade"
                value={form.propertyId || ''}
                onChange={e => setForm({ ...form, propertyId: e.target.value })}
                placeholder="UUID da propriedade"
              />
              <Input
                label="Data de Instalação"
                type="date"
                value={form.installationDate || ''}
                onChange={e => setForm({ ...form, installationDate: e.target.value })}
              />
              <Input
                label="Leitura Inicial (m³)"
                type="number"
                value={String(form.initialReading || 0)}
                onChange={e => setForm({ ...form, initialReading: Number(e.target.value) })}
              />
              <Input
                label="Localização"
                value={form.location || ''}
                onChange={e => setForm({ ...form, location: e.target.value })}
                placeholder="Ex: Caixa de entrada — térreo"
              />
              <Input
                label="Observações"
                value={form.notes || ''}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Observações sobre o hidrômetro"
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancelar</Button>
                <Button onClick={handleAdd}>Salvar</Button>
              </div>
            </div>
          </Modal>
        </div>
      </AppShell>
    </RequireRole>
  );
}
