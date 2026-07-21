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
import type { TariffTableInput, TariffBandInput } from '@/lib/water/types';

export default function AdminTariffsPage() {
  const { tariffs, selectedTariff, loading, error, loadTariffs, loadTariff, addTariffTable, removeTariffTable, updateTariffBands } = useAdminWaterData();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBandsModal, setShowBandsModal] = useState(false);
  const [tariffForm, setTariffForm] = useState<Partial<TariffTableInput>>({});
  const [bandsForm, setBandsForm] = useState<TariffBandInput[]>([]);
  const [bandInputs, setBandInputs] = useState('');

  useEffect(() => {
    loadTariffs('demo-tenant-001');
  }, [loadTariffs]);

  const handleAddTariff = async () => {
    if (!tariffForm.name) return;
    const input: TariffTableInput = {
      tenantId: 'demo-tenant-001',
      name: tariffForm.name,
      description: tariffForm.description,
      tariffType: (tariffForm.tariffType as TariffTableInput['tariffType']) || 'progressive',
      effectiveFrom: tariffForm.effectiveFrom || new Date().toISOString().split('T')[0],
      effectiveTo: tariffForm.effectiveTo,
      minConsumption: tariffForm.minConsumption || 0,
      minCharge: tariffForm.minCharge || 0,
    };
    await addTariffTable(input);
    setShowAddModal(false);
    setTariffForm({});
  };

  const handleOpenBands = (tariffId: string) => {
    loadTariff(tariffId);
    setShowBandsModal(true);
  };

  const parseBandsInput = (input: string): TariffBandInput[] => {
    return input.split('\n').filter(line => line.trim()).map((line, i) => {
      const parts = line.split(',').map(s => s.trim());
      return {
        fromConsumption: Number(parts[0]) || 0,
        toConsumption: parts[1] ? Number(parts[1]) : undefined,
        unitPrice: Number(parts[2]) || 0,
        flatFee: Number(parts[3]) || 0,
        sortOrder: i + 1,
      };
    });
  };

  const handleSaveBands = async () => {
    if (!selectedTariff) return;
    const bands = parseBandsInput(bandInputs);
    if (bands.length === 0) return;
    await updateTariffBands(selectedTariff.id, bands);
    setShowBandsModal(false);
    setBandInputs('');
    loadTariffs('demo-tenant-001');
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja remover esta tabela tarifária?')) {
      await removeTariffTable(id);
    }
  };

  return (
    <RequireRole roles={['association_admin', 'association_operator', 'association_finance']}>
      <AppShell>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Tarifas</h1>
            <Button onClick={() => setShowAddModal(true)}>
              + Nova Tabela
            </Button>
          </div>

          {loading && <LoadingState />}

          {error && (
            <Card className="p-4 border-red-200 bg-red-50">
              <p className="text-red-700 text-sm">{error}</p>
            </Card>
          )}

          <div className="space-y-3">
            {tariffs.map(tariff => (
              <Card key={tariff.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{tariff.name}</h3>
                      <Badge variant={tariff.isActive ? 'success' : 'neutral'} className="text-xs">
                        {tariff.isActive ? 'Ativa' : 'Inativa'}
                      </Badge>
                      <Badge variant="neutral" className="text-xs">
                        {tariff.tariffType === 'progressive' ? 'Progressiva' : tariff.tariffType === 'fixed' ? 'Fixa' : 'Mínimo'}
                      </Badge>
                    </div>
                    {tariff.description && (
                      <p className="text-sm text-gray-500 mb-1">{tariff.description}</p>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-xs text-gray-500">
                      <div>Mín: {tariff.minConsumption.toLocaleString('pt-BR')} m³</div>
                      <div>Carga Mín: {tariff.minCharge.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                      <div>Vigência: {new Date(tariff.effectiveFrom).toLocaleDateString('pt-BR')}</div>
                    </div>
                    {tariff.bands && tariff.bands.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-600 mb-1">Faixas:</p>
                        {tariff.bands.map(b => (
                          <span key={b.id} className="inline-block text-xs bg-gray-50 rounded px-2 py-0.5 mr-1 mb-1">
                            {b.fromConsumption}-{b.toConsumption ?? '∞'} m³: R$ {b.unitPrice.toFixed(2)}/m³
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="text" size="sm" onClick={() => handleOpenBands(tariff.id)}>
                      Faixas
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => handleDelete(tariff.id)}>
                      Remover
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Modal open={showAddModal} onClose={() => setShowAddModal(false)}>
            <div className="p-4 space-y-3">
              <h2 className="text-lg font-semibold">Nova Tabela Tarifária</h2>
              <Input
                label="Nome"
                value={tariffForm.name || ''}
                onChange={e => setTariffForm({ ...tariffForm, name: e.target.value })}
                placeholder="Ex: Tarifa Residencial Padrão"
              />
              <Input
                label="Descrição"
                value={tariffForm.description || ''}
                onChange={e => setTariffForm({ ...tariffForm, description: e.target.value })}
              />
              <select
                className="w-full border border-gray-300 rounded-md p-2 text-sm"
                value={tariffForm.tariffType || 'progressive'}
                onChange={e => setTariffForm({ ...tariffForm, tariffType: e.target.value as TariffTableInput['tariffType'] })}
              >
                <option value="progressive">Progressiva</option>
                <option value="fixed">Fixa</option>
                <option value="minimum_charge">Carga Mínima</option>
              </select>
              <Input
                label="Data de Vigência"
                type="date"
                value={tariffForm.effectiveFrom || ''}
                onChange={e => setTariffForm({ ...tariffForm, effectiveFrom: e.target.value })}
              />
              <Input
                label="Consumo Mínimo (m³)"
                type="number"
                value={String(tariffForm.minConsumption || 0)}
                onChange={e => setTariffForm({ ...tariffForm, minConsumption: Number(e.target.value) })}
              />
              <Input
                label="Carga Mínima (R$)"
                type="number"
                step="0.01"
                value={String(tariffForm.minCharge || 0)}
                onChange={e => setTariffForm({ ...tariffForm, minCharge: Number(e.target.value) })}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setShowAddModal(false)}>Cancelar</Button>
                <Button onClick={handleAddTariff}>Salvar</Button>
              </div>
            </div>
          </Modal>

          <Modal open={showBandsModal} onClose={() => setShowBandsModal(false)}>
            <div className="p-4 space-y-3">
              <h2 className="text-lg font-semibold">
                Faixas de Consumo — {selectedTariff?.name}
              </h2>
              <p className="text-xs text-gray-500">
                Formato: uma faixa por linha: de,até,preço_unitário,taxa_fixa<br />
                Ex: 0,10,5.00,0 (0-10 m³ a R$5.00/m³)<br />
                Ex: 30,,15.00,0 (acima de 30 m³ a R$15.00/m³ — deixe "até" em branco para ilimitado)
              </p>
              <textarea
                className="w-full border border-gray-300 rounded-md p-2 text-sm font-mono"
                rows={6}
                value={bandInputs}
                onChange={e => setBandInputs(e.target.value)}
                placeholder={selectedTariff?.bands?.map(b =>
                  `${b.fromConsumption},${b.toConsumption ?? ''},${b.unitPrice},${b.flatFee}`
                ).join('\n') || ''}
              />
              {selectedTariff?.bands && selectedTariff.bands.length > 0 && (
                <p className="text-xs text-gray-400">
                  Faixas atuais: {selectedTariff.bands.length}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="secondary" onClick={() => setShowBandsModal(false)}>Cancelar</Button>
                <Button onClick={handleSaveBands}>Salvar Faixas</Button>
              </div>
            </div>
          </Modal>
        </div>
      </AppShell>
    </RequireRole>
  );
}
