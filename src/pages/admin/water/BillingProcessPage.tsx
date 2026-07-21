import { useEffect, useState } from 'react';
import AppShell from '@/components/feature/AppShell';
import { RequireRole } from '@/lib/auth/RequireRole';
import Card from '@/components/base/Card';
import Button from '@/components/base/Button';
import LoadingState from '@/components/base/LoadingState';
import Badge from '@/components/base/Badge';
import { useAdminWaterData } from '@/hooks/useAdminWaterData';
import type { BillingPreview, BillingProcessResult } from '@/lib/water/types';

export default function AdminBillingProcessPage() {
  const {
    billingPreview, billingResult, loading, error,
    loadBillingPreview, executeBilling,
  } = useAdminWaterData();

  const [step, setStep] = useState<'select' | 'preview' | 'result'>('select');
  const [selectedCycleId] = useState('demo-cycle-001');
  const [preview, setPreview] = useState<BillingPreview | null>(null);
  const [result, setResult] = useState<BillingProcessResult | null>(null);

  const handlePreview = async () => {
    const data = await loadBillingPreview(selectedCycleId);
    if (data) {
      setPreview(data);
      setStep('preview');
    }
  };

  const handleExecute = async () => {
    const data = await executeBilling(selectedCycleId);
    if (data) {
      setResult(data);
      setStep('result');
    }
  };

  const handleReset = () => {
    setPreview(null);
    setResult(null);
    setStep('select');
  };

  return (
    <RequireRole roles={['association_admin', 'association_operator', 'association_finance']}>
      <AppShell>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Faturamento de Água</h1>
            {step !== 'select' && (
              <Button variant="secondary" size="sm" onClick={handleReset}>
                Novo Faturamento
              </Button>
            )}
          </div>

          {error && (
            <Card className="p-4 border-red-200 bg-red-50">
              <p className="text-red-700 text-sm">{error}</p>
            </Card>
          )}

          {loading && <LoadingState />}

          {/* Step 1: Select Cycle */}
          {step === 'select' && (
            <Card className="p-6 space-y-4">
              <h2 className="font-semibold text-lg">Etapa 1 — Selecionar Ciclo</h2>
              <p className="text-sm text-gray-500">
                Selecione o ciclo de faturamento para processar as leituras de água do período.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-sm font-medium text-blue-800">Ciclo Selecionado</p>
                <p className="text-sm text-blue-700">Período: 07/2026 (01/07/2026 — 31/07/2026)</p>
                <p className="text-sm text-blue-700">Vencimento: 15/08/2026</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Atenção:</strong> O faturamento de água segue o princípio "Preview-First".
                  A prévia executa todos os cálculos mas não persiste nada no banco.
                  Após validação do operador, o processamento definitivo gera faturas, itens, lançamentos contábeis e auditoria.
                </p>
              </div>
              <Button onClick={handlePreview} className="w-full">
                Gerar Prévia de Faturamento
              </Button>
            </Card>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && preview && (
            <div className="space-y-4">
              <Card className="p-4 border-green-200 bg-green-50">
                <h2 className="font-semibold text-green-800">
                  Etapa 2 — Prévia do Faturamento (NÃO PERSISTIDO)
                </h2>
                <p className="text-sm text-green-700 mt-1">
                  Período: {preview.cycleStart} — {preview.cycleEnd} | Ref: {preview.referencePeriod}
                </p>
                <p className="text-sm text-green-700">
                  Vencimento: {new Date(preview.dueDate).toLocaleDateString('pt-BR')}
                </p>
              </Card>

              {preview.items.length === 0 ? (
                <Card className="p-6">
                  <p className="text-gray-500 text-center">Nenhum consumo a ser faturado neste período</p>
                  <Button variant="secondary" onClick={handleReset} className="mt-4 w-full">
                    Voltar
                  </Button>
                </Card>
              ) : (
                <>
                  {preview.items.map((item, idx) => (
                    <Card key={idx} className="p-4">
                      <h3 className="font-semibold mb-2">
                        {item.meterNumber} — Consumo: {item.consumption.toLocaleString('pt-BR')} m³
                      </h3>

                      <div className="space-y-2 mb-3">
                        {item.tariffResult.minChargeApplied ? (
                          <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
                            <p className="text-sm text-yellow-800">
                              <strong>Carga Mínima Aplicada:</strong>{' '}
                              {item.tariffResult.minCharge.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </p>
                            <p className="text-xs text-yellow-600">
                              Consumo ({item.tariffResult.calculatedConsumption.toLocaleString('pt-BR')} m³) abaixo do mínimo ({item.tariffResult.minConsumption.toLocaleString('pt-BR')} m³)
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {item.tariffResult.bands.map((band, bi) => (
                              <div key={bi} className="flex justify-between text-sm bg-gray-50 rounded px-2 py-1">
                                <span>
                                  {band.fromConsumption}-{band.toConsumption ?? '∞'} m³: {band.consumption.toLocaleString('pt-BR')} m³ × R$ {band.unitPrice.toFixed(2)}
                                </span>
                                <span className="font-medium">
                                  {band.charge.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between pt-2 border-t border-gray-200">
                        <span className="font-semibold">Total</span>
                        <span className="font-bold text-lg">
                          {item.tariffResult.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                      </div>
                    </Card>
                  ))}

                  <Card className="p-4 border-blue-200 bg-blue-50">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-blue-800">Total Geral (Água)</span>
                      <span className="font-bold text-xl text-blue-800">
                        {preview.totalWaterAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  </Card>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <p className="text-sm text-yellow-800">
                      <strong>Validação do Operador:</strong> Revise os valores acima. Os cálculos
                      acima são idênticos aos que serão usados no processamento definitivo.
                      A única diferença é que ainda não há persistência.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={handleReset} className="flex-1">
                      Cancelar
                    </Button>
                    <Button onClick={handleExecute} className="flex-1">
                      Confirmar e Processar Faturamento
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Result */}
          {step === 'result' && result && (
            <div className="space-y-4">
              <Card className={`p-4 border-2 ${result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                <h2 className="font-semibold text-lg">
                  Etapa 3 — {result.success ? 'Faturamento Concluído' : 'Erro no Faturamento'}
                </h2>
                {result.success ? (
                  <div className="mt-3 space-y-2 text-sm">
                    <p className="text-green-800">
                      <strong>{result.invoicesGenerated}</strong> fatura(s) gerada(s)
                    </p>
                    <p className="text-green-800">
                      Total faturado: <strong>{result.totalAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                    </p>
                    <div className="mt-2">
                      <p className="text-xs text-green-700 font-medium mb-1">Faturas Geradas:</p>
                      {result.invoiceIds.map((id, i) => (
                        <div key={i} className="text-xs font-mono text-green-600 bg-green-100 rounded px-2 py-1 mb-1">
                          {id}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-red-700 text-sm mt-2">
                    Ocorreram erros durante o processamento. Verifique os detalhes abaixo.
                  </p>
                )}
              </Card>

              {result.errors.length > 0 && (
                <Card className="p-4 border-yellow-200 bg-yellow-50">
                  <h3 className="font-semibold text-sm text-yellow-800 mb-2">Erros Encontrados</h3>
                  {result.errors.map((err, i) => (
                    <div key={i} className="text-sm text-yellow-700 border-b border-yellow-200 pb-1 mb-1">
                      <strong>{err.meterNumber}:</strong> {err.error}
                    </div>
                  ))}
                </Card>
              )}

              <Card className="p-4">
                <h3 className="font-semibold mb-2">Próximos Passos</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>1. As faturas foram geradas com status "emitida"</p>
                  <p>2. Itens de fatura foram criados com categoria "water"</p>
                  <p>3. Lançamentos contábeis foram registrados no livro razão</p>
                  <p>4. Entradas de auditoria financeira foram geradas</p>
                  <p>5. Pagamentos serão processados no EPF-03</p>
                </div>
              </Card>

              <div className="flex gap-3">
                <a href="/admin/finance/faturas" className="flex-1">
                  <Button variant="secondary" className="w-full">
                    Ver Faturas (Finanças)
                  </Button>
                </a>
                <Button onClick={handleReset} className="flex-1">
                  Novo Processamento
                </Button>
              </div>
            </div>
          )}
        </div>
      </AppShell>
    </RequireRole>
  );
}
