import type { FinanceScenarioKey, FinancialOverview, InvoiceData, BoletoInfo, PixInfo, PaymentRecord, ReceiptData, UnrecognizedReasonOption, UnrecognizedConfirmation } from '@/fixtures/types';

// ─── Scenario State ────────────────────────────────────────────────────

export let activeFinanceScenario: FinanceScenarioKey = 'all_paid';
export let activeFinanceResidenceId = 'prop-001';

export function setFinanceScenario(key: FinanceScenarioKey) {
  activeFinanceScenario = key;
}

export function setFinanceResidence(id: string) {
  activeFinanceResidenceId = id;
}

export const financeScenarioLabels: Record<FinanceScenarioKey, string> = {
  all_paid: 'Tudo pago',
  due_soon: 'Vence em breve',
  single_overdue: 'Uma fatura vencida',
  multiple_overdue: 'Múltiplas vencidas',
  payment_processing: 'Pagamento em processamento',
  payment_unidentified: 'Pagamento não identificado',
  under_review: 'Fatura em análise',
  replaced: 'Fatura substituída',
  canceled: 'Fatura cancelada',
  no_invoices: 'Sem faturas',
  boleto_unavailable: 'Boleto indisponível',
  pix_unavailable: 'PIX indisponível',
  document_error: 'Erro no documento',
  partial_list_error: 'Erro parcial na lista',
  offline: 'Offline',
};

// ─── Shared assets ─────────────────────────────────────────────────

const associationName = 'Associação Residencial Parque das Nascentes';
const residentName = 'Carlos Eduardo Oliveira';
const payerDocument = '***.456.789-**';

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function padDate(month: number, day: number): string {
  return `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ─── Line Items Builders ────────────────────────────────────────────

const standardLineItems = (waterAmount: number, maintenanceAmount: number, reserveAmount: number) => [
  { description: 'Taxa de manutenção condominial', amount: maintenanceAmount, formattedAmount: formatCurrency(maintenanceAmount), type: 'maintenance' as const },
  { description: 'Consumo de água (hidrômetro)', amount: waterAmount, formattedAmount: formatCurrency(waterAmount), type: 'water' as const },
  { description: 'Fundo de reserva', amount: reserveAmount, formattedAmount: formatCurrency(reserveAmount), type: 'reserve' as const },
];

const adjustmentLineItem = (amount: number, label: string) => ({
  description: label, amount, formattedAmount: formatCurrency(amount), type: 'adjustment' as const,
});

const discountLineItem = (amount: number, label: string) => ({
  description: label, amount, formattedAmount: formatCurrency(amount), type: 'discount' as const,
});

const interestLineItem = (amount: number) => ({
  description: 'Multa e juros por atraso', amount, formattedAmount: formatCurrency(amount), type: 'fine' as const,
});

// ─── Invoice Builders ───────────────────────────────────────────────

function buildInvoice(
  id: string,
  docNumber: string,
  reference: string,
  referencePeriod: string,
  month: number,
  day: number,
  waterAmount: number,
  maintenanceAmount: number,
  reserveAmount: number,
  status: InvoiceData['status'],
  statusLabel: string,
  statusExplanation: string,
  overrides: Partial<InvoiceData> = {},
): InvoiceData {
  const baseAmount = waterAmount + maintenanceAmount + reserveAmount;
  const hasAdjustment = overrides.lineItems ? overrides.lineItems.some(l => l.type === 'adjustment') : false;
  const hasDiscount = overrides.lineItems ? overrides.lineItems.some(l => l.type === 'discount') : false;
  const hasFine = overrides.lineItems ? overrides.lineItems.some(l => l.type === 'fine') : false;

  let finalAmount = baseAmount;
  if (hasAdjustment) finalAmount += (overrides.lineItems?.find(l => l.type === 'adjustment')?.amount || 0);
  if (hasDiscount) finalAmount += (overrides.lineItems?.find(l => l.type === 'discount')?.amount || 0);
  if (hasFine) finalAmount += (overrides.lineItems?.find(l => l.type === 'fine')?.amount || 0);

  const lineItems = overrides.lineItems || standardLineItems(waterAmount, maintenanceAmount, reserveAmount);

  return {
    id,
    documentNumber: docNumber,
    reference,
    referencePeriod,
    residenceId: overrides.residenceId || activeFinanceResidenceId,
    residenceNickname: overrides.residenceNickname || 'Apto Bloco 3 - 302',
    associationName: overrides.associationName || associationName,
    dueDate: padDate(month, day),
    issuedDate: padDate(month, 5),
    amount: finalAmount,
    formattedAmount: formatCurrency(finalAmount),
    status,
    statusLabel,
    statusExplanation,
    lineItems,
    hasBoleto: overrides.hasBoleto ?? true,
    hasPix: overrides.hasPix ?? true,
    isReplaced: overrides.isReplaced ?? false,
    isEligibleForSecondCopy: overrides.isEligibleForSecondCopy ?? true,
    ...overrides,
  };
}

// ─── Residence 1: Apto Bloco 3 - 302 ───────────────────────────────

function buildAptoInvoices(): InvoiceData[] {
  return [
    buildInvoice('inv-2026-07', 'DOC-2026-00007', 'Julho 2026', 'Julho/2026', 7, 20, 95.70, 220.00, 31.80, 'open', 'Aberta', 'Fatura em aberto. O vencimento é em 20 de julho.'),
    buildInvoice('inv-2026-06', 'DOC-2026-00006', 'Junho 2026', 'Junho/2026', 6, 20, 88.50, 220.00, 31.80, 'paid', 'Paga', 'Pagamento identificado em 18 de junho.', { paymentDate: '2026-06-18', paymentMethod: 'PIX', paidAmount: 340.30, paidAmountFormatted: formatCurrency(340.30) }),
    buildInvoice('inv-2026-05', 'DOC-2026-00005', 'Maio 2026', 'Maio/2026', 5, 20, 92.10, 220.00, 31.80, 'paid', 'Paga', 'Pagamento identificado em 19 de maio.', { paymentDate: '2026-05-19', paymentMethod: 'PIX', paidAmount: 343.90, paidAmountFormatted: formatCurrency(343.90) }),
    buildInvoice('inv-2026-04', 'DOC-2026-00004', 'Abril 2026', 'Abril/2026', 4, 20, 90.30, 220.00, 31.80, 'paid', 'Paga', 'Pagamento identificado em 17 de abril.', { paymentDate: '2026-04-17', paymentMethod: 'Boleto', paidAmount: 342.10, paidAmountFormatted: formatCurrency(342.10) }),
    buildInvoice('inv-2026-03', 'DOC-2026-00003', 'Março 2026', 'Março/2026', 3, 20, 97.20, 220.00, 31.80, 'paid', 'Paga', 'Pagamento identificado em 19 de março.', { paymentDate: '2026-03-19', paymentMethod: 'PIX', paidAmount: 349.00, paidAmountFormatted: formatCurrency(349.00) }),
    buildInvoice('inv-2026-02', 'DOC-2026-00002', 'Fevereiro 2026', 'Fevereiro/2026', 2, 20, 85.60, 220.00, 31.80, 'paid', 'Paga', 'Pagamento identificado em 18 de fevereiro.', { paymentDate: '2026-02-18', paymentMethod: 'Boleto', paidAmount: 337.40, paidAmountFormatted: formatCurrency(337.40) }),
    buildInvoice('inv-2026-01', 'DOC-2026-00001', 'Janeiro 2026', 'Janeiro/2026', 1, 20, 94.00, 220.00, 31.80, 'paid', 'Paga', 'Pagamento identificado em 19 de janeiro.', { paymentDate: '2026-01-19', paymentMethod: 'PIX', paidAmount: 345.80, paidAmountFormatted: formatCurrency(345.80) }),
  ];
}

// ─── Residence 2: Casa Centro ──────────────────────────────────────

function buildCasaInvoices(): InvoiceData[] {
  return [
    buildInvoice('inv-casa-2026-07', 'DOC-2026-C0007', 'Julho 2026', 'Julho/2026', 7, 20, 162.30, 380.00, 55.00, 'open', 'Aberta', 'Fatura em aberto. O vencimento é em 20 de julho.', { residenceId: 'prop-002', residenceNickname: 'Casa Centro', associationName }),
    buildInvoice('inv-casa-2026-06', 'DOC-2026-C0006', 'Junho 2026', 'Junho/2026', 6, 20, 148.70, 380.00, 55.00, 'paid', 'Paga', 'Pagamento identificado em 17 de junho.', { residenceId: 'prop-002', residenceNickname: 'Casa Centro', associationName, paymentDate: '2026-06-17', paymentMethod: 'PIX', paidAmount: 583.70, paidAmountFormatted: formatCurrency(583.70) }),
    buildInvoice('inv-casa-2026-05', 'DOC-2026-C0005', 'Maio 2026', 'Maio/2026', 5, 20, 155.40, 380.00, 55.00, 'paid', 'Paga', 'Pagamento identificado em 18 de maio.', { residenceId: 'prop-002', residenceNickname: 'Casa Centro', associationName, paymentDate: '2026-05-18', paymentMethod: 'Boleto', paidAmount: 590.40, paidAmountFormatted: formatCurrency(590.40) }),
    buildInvoice('inv-casa-2026-04', 'DOC-2026-C0004', 'Abril 2026', 'Abril/2026', 4, 20, 160.10, 380.00, 55.00, 'paid', 'Paga', 'Pagamento identificado em 19 de abril.', { residenceId: 'prop-002', residenceNickname: 'Casa Centro', associationName, paymentDate: '2026-04-19', paymentMethod: 'PIX', paidAmount: 595.10, paidAmountFormatted: formatCurrency(595.10) }),
  ];
}

// ─── Payment Records ───────────────────────────────────────────────

function buildAptoPayments(): PaymentRecord[] {
  return [
    { id: 'pay-001', invoiceId: 'inv-2026-06', reference: 'Junho 2026', referencePeriod: 'Junho/2026', residenceId: 'prop-001', residenceNickname: 'Apto Bloco 3 - 302', amount: 340.30, formattedAmount: formatCurrency(340.30), paymentDate: '2026-06-18', identificationDate: '2026-06-19', paymentMethod: 'PIX', status: 'identified', statusLabel: 'Identificado', receiptReference: 'REC-2026-00042', hasReceipt: true },
    { id: 'pay-002', invoiceId: 'inv-2026-05', reference: 'Maio 2026', referencePeriod: 'Maio/2026', residenceId: 'prop-001', residenceNickname: 'Apto Bloco 3 - 302', amount: 343.90, formattedAmount: formatCurrency(343.90), paymentDate: '2026-05-19', identificationDate: '2026-05-20', paymentMethod: 'PIX', status: 'identified', statusLabel: 'Identificado', receiptReference: 'REC-2026-00038', hasReceipt: true },
    { id: 'pay-003', invoiceId: 'inv-2026-04', reference: 'Abril 2026', referencePeriod: 'Abril/2026', residenceId: 'prop-001', residenceNickname: 'Apto Bloco 3 - 302', amount: 342.10, formattedAmount: formatCurrency(342.10), paymentDate: '2026-04-17', identificationDate: '2026-04-18', paymentMethod: 'Boleto', status: 'identified', statusLabel: 'Identificado', receiptReference: 'REC-2026-00031', hasReceipt: true },
    { id: 'pay-004', invoiceId: 'inv-2026-03', reference: 'Março 2026', referencePeriod: 'Março/2026', residenceId: 'prop-001', residenceNickname: 'Apto Bloco 3 - 302', amount: 349.00, formattedAmount: formatCurrency(349.00), paymentDate: '2026-03-19', identificationDate: '2026-03-20', paymentMethod: 'PIX', status: 'identified', statusLabel: 'Identificado', receiptReference: 'REC-2026-00025', hasReceipt: true },
  ];
}

// ─── Scenario Builders ─────────────────────────────────────────────

function buildAllPaid(residenceId: string): FinancialOverview {
  const invoices = residenceId === 'prop-002' ? buildCasaInvoices() : buildAptoInvoices();
  const allPaid = invoices.map(inv => ({ ...inv, status: 'paid' as const, statusLabel: 'Paga', statusExplanation: 'Pagamento identificado.' }));
  const payments = residenceId === 'prop-002'
    ? [{ id: 'pay-casa-001', invoiceId: 'inv-casa-2026-06', reference: 'Junho 2026', referencePeriod: 'Junho/2026', residenceId: 'prop-002', residenceNickname: 'Casa Centro', amount: 583.70, formattedAmount: formatCurrency(583.70), paymentDate: '2026-06-17', identificationDate: '2026-06-18', paymentMethod: 'PIX', status: 'identified' as const, statusLabel: 'Identificado', receiptReference: 'REC-2026-C0042', hasReceipt: true }]
    : buildAptoPayments();
  const paid = allPaid.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.paidAmount || i.amount), 0);

  return {
    scenario: 'all_paid',
    accountStatus: 'tudo_em_dia',
    accountStatusLabel: 'Tudo em dia',
    accountStatusMessage: 'Você está em dia com a associação. Nenhuma fatura pendente no momento.',
    nextDueInvoice: null,
    overdueAmount: null,
    overdueFormattedAmount: null,
    paidThisYear: paid,
    paidThisYearFormatted: formatCurrency(paid),
    invoices: allPaid,
    payments,
    residenceId,
  };
}

function buildDueSoon(residenceId: string): FinancialOverview {
  const baseInvoices = residenceId === 'prop-002' ? buildCasaInvoices() : buildAptoInvoices();
  const payments = residenceId === 'prop-002' ? [] : buildAptoPayments();
  const nextInvoice = { ...baseInvoices[0], status: 'due_soon' as const, statusLabel: 'Vence em breve', statusExplanation: 'Fatura com vencimento em 3 dias. Não deixe para a última hora!', dueDate: '2026-07-20' };

  const invoices = [nextInvoice, ...baseInvoices.slice(1)];
  const paid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.paidAmount || i.amount), 0);

  return {
    scenario: 'due_soon',
    accountStatus: 'vencimento_proximo',
    accountStatusLabel: 'Vencimento próximo',
    accountStatusMessage: 'Sua fatura de Julho vence em 3 dias. Efetue o pagamento para manter os serviços em dia.',
    nextDueInvoice: nextInvoice,
    overdueAmount: null,
    overdueFormattedAmount: null,
    paidThisYear: paid,
    paidThisYearFormatted: formatCurrency(paid),
    invoices,
    payments,
    residenceId,
  };
}

function buildSingleOverdue(residenceId: string): FinancialOverview {
  const baseInvoices = residenceId === 'prop-002' ? buildCasaInvoices() : buildAptoInvoices();
  const payments = residenceId === 'prop-002' ? [] : buildAptoPayments();

  const overdueInvoice: InvoiceData = {
    ...baseInvoices[1],
    status: 'overdue',
    statusLabel: 'Vencida',
    statusExplanation: 'Esta fatura está vencida desde 20 de junho. Regularize para evitar a suspensão dos serviços.',
    dueDate: '2026-06-20',
    amount: 340.30,
    formattedAmount: formatCurrency(340.30),
    lineItems: [...standardLineItems(88.50, 220.00, 31.80)],
  };

  const openInvoice = baseInvoices[0];
  const remaining = baseInvoices.slice(2);
  const invoices = [openInvoice, overdueInvoice, ...remaining];
  const paid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.paidAmount || i.amount), 0);

  return {
    scenario: 'single_overdue',
    accountStatus: 'fatura_vencida',
    accountStatusLabel: 'Fatura vencida',
    accountStatusMessage: 'Há uma fatura vencida. Regularize o quanto antes para evitar a suspensão dos serviços.',
    nextDueInvoice: openInvoice,
    overdueAmount: 340.30,
    overdueFormattedAmount: formatCurrency(340.30),
    paidThisYear: paid,
    paidThisYearFormatted: formatCurrency(paid),
    invoices,
    payments,
    residenceId,
  };
}

function buildMultipleOverdue(residenceId: string): FinancialOverview {
  const baseInvoices = residenceId === 'prop-002' ? buildCasaInvoices() : buildAptoInvoices();
  const payments = residenceId === 'prop-002' ? [] : buildAptoPayments();

  const overdue1: InvoiceData = {
    ...baseInvoices[1],
    status: 'overdue', statusLabel: 'Vencida',
    statusExplanation: 'Vencida desde 20 de junho.',
    dueDate: '2026-06-20',
    lineItems: [...standardLineItems(88.50, 220.00, 31.80), interestLineItem(35.40)],
    amount: 375.70, formattedAmount: formatCurrency(375.70),
  };

  const overdue2: InvoiceData = {
    ...baseInvoices[2],
    status: 'overdue', statusLabel: 'Vencida',
    statusExplanation: 'Vencida desde 20 de maio. Acumula multa e juros.',
    dueDate: '2026-05-20',
    lineItems: [...standardLineItems(92.10, 220.00, 31.80), interestLineItem(68.70)],
    amount: 412.60, formattedAmount: formatCurrency(412.60),
  };

  const openInvoice = baseInvoices[0];
  const remaining = baseInvoices.slice(3);
  const invoices = [openInvoice, overdue1, overdue2, ...remaining];
  const paid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.paidAmount || i.amount), 0);
  const totalOverdue = 375.70 + 412.60;

  return {
    scenario: 'multiple_overdue',
    accountStatus: 'fatura_vencida',
    accountStatusLabel: 'Faturas vencidas',
    accountStatusMessage: 'Há duas faturas vencidas. Entre em contato com a associação para regularizar sua situação.',
    nextDueInvoice: openInvoice,
    overdueAmount: totalOverdue,
    overdueFormattedAmount: formatCurrency(totalOverdue),
    paidThisYear: paid,
    paidThisYearFormatted: formatCurrency(paid),
    invoices,
    payments,
    residenceId,
  };
}

function buildPaymentProcessing(residenceId: string): FinancialOverview {
  const baseInvoices = residenceId === 'prop-002' ? buildCasaInvoices() : buildAptoInvoices();
  const payments = residenceId === 'prop-002' ? [] : buildAptoPayments();

  const processingInvoice: InvoiceData = {
    ...baseInvoices[1],
    status: 'processing', statusLabel: 'Processando',
    statusExplanation: 'Seu pagamento foi recebido e está em processamento. A identificação pode levar até 2 dias úteis.',
    paymentDate: '2026-06-19',
    paymentMethod: 'PIX',
  };

  const openInvoice = baseInvoices[0];
  const remaining = baseInvoices.slice(2);
  const invoices = [openInvoice, processingInvoice, ...remaining];
  const paid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.paidAmount || i.amount), 0);

  return {
    scenario: 'payment_processing',
    accountStatus: 'pendente_identificacao',
    accountStatusLabel: 'Pagamento em processamento',
    accountStatusMessage: 'Seu pagamento de Junho foi recebido e está sendo processado. A identificação pode levar até 2 dias úteis.',
    nextDueInvoice: openInvoice,
    overdueAmount: null,
    overdueFormattedAmount: null,
    paidThisYear: paid,
    paidThisYearFormatted: formatCurrency(paid),
    invoices,
    payments,
    residenceId,
  };
}

function buildPaymentUnidentified(residenceId: string): FinancialOverview {
  const baseInvoices = residenceId === 'prop-002' ? buildCasaInvoices() : buildAptoInvoices();
  const payments = residenceId === 'prop-002' ? [] : buildAptoPayments();

  const unidentifiedInvoice: InvoiceData = {
    ...baseInvoices[1],
    status: 'unidentified', statusLabel: 'Não identificado',
    statusExplanation: 'Ainda não conseguimos identificar o pagamento desta fatura. Se você já pagou, utilize a opção "Informar pagamento" para nos ajudar.',
    dueDate: '2026-06-20',
  };

  const openInvoice = baseInvoices[0];
  const remaining = baseInvoices.slice(2);
  const invoices = [openInvoice, unidentifiedInvoice, ...remaining];
  const paid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.paidAmount || i.amount), 0);

  return {
    scenario: 'payment_unidentified',
    accountStatus: 'pendente_identificacao',
    accountStatusLabel: 'Pagamento não identificado',
    accountStatusMessage: 'Seu pagamento ainda está sendo identificado. Caso já tenha pago, informe o comprovante.',
    nextDueInvoice: openInvoice,
    overdueAmount: 340.30,
    overdueFormattedAmount: formatCurrency(340.30),
    paidThisYear: paid,
    paidThisYearFormatted: formatCurrency(paid),
    invoices,
    payments,
    residenceId,
  };
}

function buildUnderReview(residenceId: string): FinancialOverview {
  const baseInvoices = residenceId === 'prop-002' ? buildCasaInvoices() : buildAptoInvoices();
  const payments = residenceId === 'prop-002' ? [] : buildAptoPayments();

  const reviewInvoice: InvoiceData = {
    ...baseInvoices[0],
    status: 'under_review', statusLabel: 'Em análise',
    statusExplanation: 'Esta fatura está em análise pela administração. Os valores podem ser ajustados. Você será notificado quando a revisão for concluída.',
  };

  const remaining = baseInvoices.slice(1);
  const invoices = [reviewInvoice, ...remaining];
  const paid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.paidAmount || i.amount), 0);

  return {
    scenario: 'under_review',
    accountStatus: 'dados_em_revisao',
    accountStatusLabel: 'Dados em revisão',
    accountStatusMessage: 'Sua fatura atual está em análise. Nenhuma ação é necessária agora. Você será notificado quando houver uma atualização.',
    nextDueInvoice: null,
    overdueAmount: null,
    overdueFormattedAmount: null,
    paidThisYear: paid,
    paidThisYearFormatted: formatCurrency(paid),
    invoices,
    payments,
    residenceId,
  };
}

function buildReplaced(residenceId: string): FinancialOverview {
  const baseInvoices = residenceId === 'prop-002' ? buildCasaInvoices() : buildAptoInvoices();
  const payments = residenceId === 'prop-002' ? [] : buildAptoPayments();

  const oldInvoice: InvoiceData = {
    ...baseInvoices[1],
    status: 'replaced', statusLabel: 'Substituída',
    statusExplanation: 'Esta fatura foi substituída por uma versão corrigida. Utilize a fatura atualizada para pagamento.',
    isReplaced: true, replacedById: 'inv-2026-06-v2', isEligibleForSecondCopy: false,
    secondCopyNote: 'Esta fatura foi substituída. A segunda via não está disponível para documentos substituídos.',
  };

  const newInvoice: InvoiceData = {
    ...baseInvoices[1],
    id: 'inv-2026-06-v2', documentNumber: 'DOC-2026-00006-V2',
    reference: 'Junho 2026 (Corrigida)', referencePeriod: 'Junho/2026',
    amount: 328.50, formattedAmount: formatCurrency(328.50),
    status: 'paid', statusLabel: 'Paga', statusExplanation: 'Fatura corrigida. Pagamento identificado em 20 de junho.',
    paymentDate: '2026-06-20', paymentMethod: 'PIX',
    paidAmount: 328.50, paidAmountFormatted: formatCurrency(328.50),
    lineItems: [...standardLineItems(78.50, 220.00, 30.00), adjustmentLineItem(-11.80, 'Ajuste: Correção leitura água')],
    replacesId: 'inv-2026-06',
  };

  const openInvoice = baseInvoices[0];
  const remaining = baseInvoices.slice(2);
  const invoices = [openInvoice, newInvoice, oldInvoice, ...remaining];
  const paid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.paidAmount || i.amount), 0);

  return {
    scenario: 'replaced',
    accountStatus: 'tudo_em_dia',
    accountStatusLabel: 'Tudo em dia',
    accountStatusMessage: 'Uma fatura anterior foi substituída por uma versão corrigida. A situação está regularizada.',
    nextDueInvoice: openInvoice,
    overdueAmount: null,
    overdueFormattedAmount: null,
    paidThisYear: paid,
    paidThisYearFormatted: formatCurrency(paid),
    invoices,
    payments: [newInvoice, ...payments].slice(0, 4) as unknown as PaymentRecord[],
    residenceId,
  };
}

function buildCanceled(residenceId: string): FinancialOverview {
  const baseInvoices = residenceId === 'prop-002' ? buildCasaInvoices() : buildAptoInvoices();
  const payments = residenceId === 'prop-002' ? [] : buildAptoPayments();

  const canceledInvoice: InvoiceData = {
    ...baseInvoices[2],
    status: 'canceled', statusLabel: 'Cancelada',
    statusExplanation: 'Esta fatura foi cancelada pela administração. Nenhum pagamento é necessário.',
    hasBoleto: false, hasPix: false, isEligibleForSecondCopy: false,
    secondCopyNote: 'Fatura cancelada. A segunda via não está disponível.',
  };

  const openInvoice = baseInvoices[0];
  const remaining = [baseInvoices[1], ...baseInvoices.slice(3)];
  const invoices = [openInvoice, ...remaining.slice(0, 1), canceledInvoice, ...remaining.slice(1)];
  const paid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.paidAmount || i.amount), 0);

  return {
    scenario: 'canceled',
    accountStatus: 'tudo_em_dia',
    accountStatusLabel: 'Tudo em dia',
    accountStatusMessage: 'Uma fatura anterior foi cancelada. Nenhum pagamento é necessário para ela.',
    nextDueInvoice: openInvoice,
    overdueAmount: null,
    overdueFormattedAmount: null,
    paidThisYear: paid,
    paidThisYearFormatted: formatCurrency(paid),
    invoices,
    payments,
    residenceId,
  };
}

function buildNoInvoices(residenceId: string): FinancialOverview {
  return {
    scenario: 'no_invoices',
    accountStatus: 'nenhuma_fatura',
    accountStatusLabel: 'Nenhuma fatura',
    accountStatusMessage: 'Não há faturas disponíveis para esta residência no momento.',
    nextDueInvoice: null,
    overdueAmount: null,
    overdueFormattedAmount: null,
    paidThisYear: 0,
    paidThisYearFormatted: formatCurrency(0),
    invoices: [],
    payments: [],
    residenceId,
  };
}

// ─── Main Getter ────────────────────────────────────────────────────

export function getFinancialOverview(): FinancialOverview {
  const rid = activeFinanceResidenceId;
  const scenario = activeFinanceScenario;

  switch (scenario) {
    case 'all_paid': return buildAllPaid(rid);
    case 'due_soon': return buildDueSoon(rid);
    case 'single_overdue': return buildSingleOverdue(rid);
    case 'multiple_overdue': return buildMultipleOverdue(rid);
    case 'payment_processing': return buildPaymentProcessing(rid);
    case 'payment_unidentified': return buildPaymentUnidentified(rid);
    case 'under_review': return buildUnderReview(rid);
    case 'replaced': return buildReplaced(rid);
    case 'canceled': return buildCanceled(rid);
    case 'no_invoices': return buildNoInvoices(rid);
    case 'boleto_unavailable': {
      const base = buildDueSoon(rid);
      const inv = base.invoices[0];
      if (inv) { inv.hasBoleto = false; inv.hasPix = true; }
      return base;
    }
    case 'pix_unavailable': {
      const base = buildDueSoon(rid);
      const inv = base.invoices[0];
      if (inv) { inv.hasBoleto = true; inv.hasPix = false; }
      return base;
    }
    case 'document_error': {
      const base = buildDueSoon(rid);
      return { ...base, scenario: 'document_error' };
    }
    case 'partial_list_error': {
      return { ...buildAllPaid(rid), scenario: 'partial_list_error' };
    }
    default:
      return buildAllPaid(rid);
  }
}

export function getInvoiceById(invoiceId: string): InvoiceData | null {
  const overview = getFinancialOverview();
  return overview.invoices.find(i => i.id === invoiceId) || null;
}

export function getPaymentsForResidence(residenceId: string): PaymentRecord[] {
  const overview = getFinancialOverview();
  return overview.payments.filter(p => p.residenceId === residenceId);
}

export function getPaymentById(paymentId: string): PaymentRecord | null {
  const overview = getFinancialOverview();
  return overview.payments.find(p => p.id === paymentId) || null;
}

// ─── Boleto Info ────────────────────────────────────────────────────

export function getBoletoInfo(invoiceId: string): BoletoInfo | null {
  const invoice = getInvoiceById(invoiceId);
  if (!invoice) return null;

  let documentStatus: BoletoInfo['documentStatus'] = 'available';
  let documentStatusLabel = 'Disponível';

  if (invoice.status === 'paid') { documentStatus = 'already_paid'; documentStatusLabel = 'Fatura já paga'; }
  else if (invoice.status === 'canceled') { documentStatus = 'unavailable'; documentStatusLabel = 'Fatura cancelada'; }
  else if (invoice.status === 'replaced') { documentStatus = 'replaced'; documentStatusLabel = 'Fatura substituída'; }
  else if (activeFinanceScenario === 'boleto_unavailable') { documentStatus = 'unavailable'; documentStatusLabel = 'Boleto temporariamente indisponível'; }
  else if (activeFinanceScenario === 'document_error') { documentStatus = 'generating'; documentStatusLabel = 'Documento em geração'; }

  return {
    invoiceId,
    dueDate: invoice.dueDate,
    amount: invoice.amount,
    formattedAmount: invoice.formattedAmount,
    payerName: residentName,
    payerDocument,
    beneficiaryName: associationName,
    beneficiaryDocument: '12.345.678/0001-90',
    digitableLine: '34191.79001 01043.510047 91020.150004 1 12345678901234',
    bankName: 'Banco do Brasil',
    bankCode: '001',
    documentAvailable: documentStatus === 'available' || documentStatus === 'already_paid',
    documentStatus,
    documentStatusLabel,
  };
}

// ─── PIX Info ────────────────────────────────────────────────────────

export function getPixInfo(invoiceId: string): PixInfo | null {
  const invoice = getInvoiceById(invoiceId);
  if (!invoice) return null;

  let available = true;
  let unavailableReason: string | undefined;

  if (invoice.status === 'paid') { available = false; unavailableReason = 'Esta fatura já foi paga.'; }
  else if (invoice.status === 'canceled') { available = false; unavailableReason = 'Esta fatura foi cancelada.'; }
  else if (invoice.status === 'replaced') { available = false; unavailableReason = 'Esta fatura foi substituída.'; }
  else if (activeFinanceScenario === 'pix_unavailable') { available = false; unavailableReason = 'A opção PIX está temporariamente indisponível. Utilize o boleto.'; }
  else if (activeFinanceScenario === 'document_error') { available = false; unavailableReason = 'Erro ao gerar código PIX. Tente novamente.'; }

  return {
    invoiceId,
    pixCode: '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865406347.505802BR5913Associacao Re6009Sao Paulo62070503***6304A1B2',
    amount: invoice.amount,
    formattedAmount: invoice.formattedAmount,
    beneficiaryName: associationName,
    beneficiaryKey: '12.345.678/0001-90',
    expiresAt: invoice.dueDate + 'T23:59:59',
    available,
    unavailableReason,
  };
}

// ─── Receipt ─────────────────────────────────────────────────────────

export function getReceiptData(paymentId: string): ReceiptData | null {
  const payment = getPaymentById(paymentId);
  if (!payment) return null;

  return {
    paymentId,
    receiptReference: payment.receiptReference,
    associationName,
    residentName,
    residenceNickname: payment.residenceNickname,
    invoiceReference: payment.reference,
    amountPaid: payment.amount,
    formattedAmountPaid: payment.formattedAmount,
    paymentDate: payment.paymentDate,
    identificationDate: payment.identificationDate,
    paymentMethod: payment.paymentMethod,
    paymentStatus: payment.statusLabel,
    validationNote: 'Este comprovante é uma representação digital do pagamento identificado pela associação. Os dados apresentados são informativos.',
    isDemo: true,
  };
}

// ─── Unrecognized Payment Flow ──────────────────────────────────────

export const unrecognizedReasons: UnrecognizedReasonOption[] = [
  { value: 'ja_paguei_mas_consta_pendente', label: 'Já paguei, mas consta como pendente', description: 'Efetuei o pagamento e a fatura ainda aparece como não paga.' },
  { value: 'paguei_valor_diferente', label: 'Paguei valor diferente do cobrado', description: 'O valor que paguei não corresponde ao valor da fatura.' },
  { value: 'paguei_apos_vencimento', label: 'Paguei após o vencimento', description: 'Efetuei o pagamento depois da data de vencimento.' },
  { value: 'comprovante_nao_reconhecido', label: 'Meu comprovante não foi reconhecido', description: 'Enviei o comprovante e ainda não foi identificado.' },
  { value: 'outro', label: 'Outro motivo', description: 'Outra situação relacionada ao pagamento.' },
];

export function submitUnrecognizedPayment(_report: {
  invoiceId: string;
  invoiceReference: string;
  paymentDate: string;
  paymentMethod: string;
  transactionReference?: string;
  reason: string;
  reasonLabel: string;
  description?: string;
}): Promise<UnrecognizedConfirmation> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        protocol: `PROT-${Date.now()}`,
        submittedDate: new Date().toISOString(),
        expectedStep: 'A associação analisará seu relato em até 2 dias úteis. Você receberá uma notificação quando houver atualização.',
      });
    }, 1200);
  });
}