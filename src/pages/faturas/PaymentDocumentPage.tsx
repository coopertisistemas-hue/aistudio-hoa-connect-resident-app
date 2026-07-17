import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import AppShell from '@/components/feature/AppShell';
import Card from '@/components/base/Card';
import { useFinancasData } from '@/hooks/useFinancasData';
import type { InvoiceData, BoletoInfo, PixInfo } from '@/fixtures/types';
import { showToast } from '@/components/base/Toast';

type Tab = 'boleto' | 'pix';

export default function PaymentDocumentPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();
  const { fetchInvoice, fetchBoleto, fetchPix } = useFinancasData();

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [boleto, setBoleto] = useState<BoletoInfo | null>(null);
  const [pix, setPix] = useState<PixInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [docError, setDocError] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('boleto');
  const [boletoError, setBoletoError] = useState(false);
  const [pixError, setPixError] = useState(false);

  useEffect(() => {
    if (!invoiceId) return;
    setLoading(true);
    setDocError(false);
    setBoletoError(false);
    setPixError(false);

    Promise.all([
      fetchInvoice(invoiceId),
      fetchBoleto(invoiceId),
      fetchPix(invoiceId),
    ]).then(([inv, bol, px]) => {
      setInvoice(inv);
      setBoleto(bol);
      setPix(px);
      setLoading(false);
    }).catch(() => {
      setDocError(true);
      setLoading(false);
    });
  }, [invoiceId, fetchInvoice, fetchBoleto, fetchPix]);

  function handleCopy(text: string, label: string) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`${label} copiado!`, 'success');
    }).catch(() => {
      showToast('Erro ao copiar. Tente novamente.', 'error');
    });
  }

  function handleSimulatedDownload() {
    showToast('Download simulado para demonstração.', 'info');
  }

  function handleSimulatedShare() {
    showToast('Compartilhamento simulado para demonstração.', 'info');
  }

  if (loading) {
    return (
      <AppShell>
        <div className="space-y-3 animate-pulse">
          <div className="h-5 w-24 bg-background-200 rounded" />
          <div className="h-40 bg-background-200 rounded-xl" />
          <div className="h-60 bg-background-200 rounded-xl" />
        </div>
      </AppShell>
    );
  }

  if (docError || !invoice) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <i className="ri-error-warning-line text-3xl text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-foreground-900 mb-1">Documento indisponível</h2>
          <p className="text-sm text-foreground-500 max-w-xs mb-6">Não foi possível carregar o documento de pagamento agora.</p>
          <button onClick={() => navigate(-1)} className="px-6 py-2.5 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap">
            Voltar
          </button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full hover:bg-background-200 flex items-center justify-center cursor-pointer transition-colors" aria-label="Voltar">
          <i className="ri-arrow-left-line text-foreground-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground-900 font-heading">Pagamento</h1>
          <span className="text-xs text-foreground-500">{invoice.reference} — {invoice.formattedAmount}</span>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-background-200 rounded-full p-1 mb-4">
        <button
          onClick={() => setActiveTab('boleto')}
          className={`flex-1 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
            activeTab === 'boleto' ? 'bg-white text-foreground-900 shadow-sm' : 'text-foreground-500 hover:text-foreground-700'
          }`}
        >
          <i className="ri-barcode-line text-sm" />
          Boleto
        </button>
        <button
          onClick={() => setActiveTab('pix')}
          className={`flex-1 py-2 rounded-full text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
            activeTab === 'pix' ? 'bg-white text-foreground-900 shadow-sm' : 'text-foreground-500 hover:text-foreground-700'
          }`}
        >
          <i className="ri-qr-code-line text-sm" />
          PIX
        </button>
      </div>

      {activeTab === 'boleto' && (
        <div>
          {boletoError || !boleto ? (
            <Card variant="outlined" className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <i className="ri-barcode-line text-2xl text-red-500" />
              </div>
              <p className="text-sm text-foreground-600 font-medium mb-1">Boleto indisponível</p>
              <p className="text-xs text-foreground-500">O boleto não está disponível no momento. Tente usar o PIX ou aguarde.</p>
            </Card>
          ) : (
            <>
              {/* Boleto document */}
              <Card variant="outlined" className="border-2 border-background-300 mb-3">
                <div className="bg-background-50 rounded-lg p-4 font-mono text-xs">
                  <div className="flex justify-between items-start mb-4 pb-3 border-b border-dashed border-background-300">
                    <div>
                      <span className="block text-foreground-400 mb-1">Beneficiário</span>
                      <span className="text-foreground-900 font-semibold">{boleto.beneficiaryName}</span>
                      <span className="block text-foreground-500 text-[10px]">CNPJ: {boleto.beneficiaryDocument}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-foreground-400 mb-1">Vencimento</span>
                      <span className="text-foreground-900 font-bold text-sm">{new Date(boleto.dueDate).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>

                  <div className="flex justify-between mb-4">
                    <div>
                      <span className="block text-foreground-400 mb-1">Pagador</span>
                      <span className="text-foreground-900 font-semibold">{boleto.payerName}</span>
                      <span className="block text-foreground-500 text-[10px]">CPF: {boleto.payerDocument}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-foreground-400 mb-1">Banco</span>
                      <span className="text-foreground-900 font-semibold">{boleto.bankName}</span>
                      <span className="block text-foreground-500 text-[10px]">Cód: {boleto.bankCode}</span>
                    </div>
                  </div>

                  <div className="text-center py-3 mb-3 bg-white rounded-lg border border-background-200">
                    <span className="block text-foreground-400 text-[10px] mb-1">Valor do documento</span>
                    <span className="text-xl font-bold text-foreground-900">{boleto.formattedAmount}</span>
                  </div>

                  <div className="mb-2">
                    <span className="block text-foreground-400 text-[10px] mb-1">Linha digitável</span>
                    <span className="text-foreground-900 text-[11px] leading-relaxed break-all font-semibold">{boleto.digitableLine}</span>
                  </div>

                  <span className="block text-foreground-400 text-[10px] italic">Documento simulado para demonstração</span>
                </div>
              </Card>

              {/* Boleto actions */}
              <div className="space-y-2">
                <button
                  onClick={() => handleCopy(boleto.digitableLine, 'Linha digitável')}
                  className="w-full py-3 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
                >
                  <i className="ri-file-copy-line text-lg" />
                  Copiar linha digitável
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={handleSimulatedDownload}
                    className="flex-1 py-2.5 rounded-xl border border-background-300 text-sm font-medium text-foreground-600 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
                  >
                    <i className="ri-download-line" />
                    Download PDF
                  </button>
                  <button
                    onClick={handleSimulatedShare}
                    className="flex-1 py-2.5 rounded-xl border border-background-300 text-sm font-medium text-foreground-600 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
                  >
                    <i className="ri-share-line" />
                    Compartilhar
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'pix' && (
        <div>
          {pixError || !pix || !pix.available ? (
            <Card variant="outlined" className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <i className="ri-qr-code-line text-2xl text-red-500" />
              </div>
              <p className="text-sm text-foreground-600 font-medium mb-1">PIX indisponível</p>
              <p className="text-xs text-foreground-500 mb-3">{pix?.unavailableReason || 'O PIX não está disponível no momento. Tente usar o boleto.'}</p>
              <button
                onClick={() => setActiveTab('boleto')}
                className="px-6 py-2 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap"
              >
                Ver boleto
              </button>
            </Card>
          ) : (
            <>
              {/* PIX QR visual simulation */}
              <Card variant="outlined" className="text-center py-6 mb-3">
                <span className="text-xs text-foreground-500 block mb-3">QR Code PIX</span>
                <div className="w-36 h-36 mx-auto bg-background-200 rounded-xl flex items-center justify-center mb-3">
                  <div className="text-center">
                    <i className="ri-qr-code-line text-5xl text-primary-500 opacity-50" />
                    <span className="block text-[10px] text-foreground-400 mt-1">Simulação</span>
                  </div>
                </div>
                <span className="text-xl font-bold text-foreground-900">{pix.formattedAmount}</span>
                <span className="block text-xs text-foreground-500 mt-1">Válido até {new Date(pix.expiresAt).toLocaleDateString('pt-BR')}</span>
                <span className="block text-[10px] text-foreground-400 mt-2">QR Code simulado para demonstração</span>
              </Card>

              {/* PIX code */}
              <Card variant="outlined" className="mb-3">
                <span className="text-xs text-foreground-500 block mb-2">Código PIX copia e cola</span>
                <div className="bg-background-50 p-3 rounded-lg">
                  <p className="text-xs text-foreground-700 break-all font-mono leading-relaxed">{pix.pixCode}</p>
                </div>
              </Card>

              {/* PIX info */}
              <Card variant="filled" className="mb-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-foreground-500">Beneficiário</span>
                    <span className="text-foreground-800 font-medium">{pix.beneficiaryName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-500">Chave</span>
                    <span className="text-foreground-800 font-medium">{pix.beneficiaryKey}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-500">Validade</span>
                    <span className="text-foreground-800 font-medium">{new Date(pix.expiresAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </Card>

              {/* PIX actions */}
              <div className="space-y-2">
                <button
                  onClick={() => handleCopy(pix.pixCode, 'Código PIX')}
                  className="w-full py-3 rounded-xl bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-2"
                >
                  <i className="ri-file-copy-line text-lg" />
                  Copiar código PIX
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={handleSimulatedShare}
                    className="flex-1 py-2.5 rounded-xl border border-background-300 text-sm font-medium text-foreground-600 hover:bg-background-100 transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
                  >
                    <i className="ri-share-line" />
                    Compartilhar
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Context note */}
      <div className="mt-4 p-3 rounded-xl bg-background-50 border border-background-200">
        <p className="text-xs text-foreground-500 leading-relaxed">
          <i className="ri-information-line mr-1" />
          Ao copiar o código ou abrir o boleto, a fatura não é automaticamente quitada. O pagamento é identificado pela associação após a compensação bancária, o que pode levar até 2 dias úteis.
        </p>
      </div>
    </AppShell>
  );
}