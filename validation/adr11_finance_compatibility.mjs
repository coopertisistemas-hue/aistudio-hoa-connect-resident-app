import assert from 'node:assert/strict';
import process from 'node:process';
import { createServer, loadConfigFromFile, mergeConfig } from 'vite';

const vectorRows = [];

function renderedStateForOverview(result) {
  if (result.isOffline) {
    return 'offline-banner';
  }
  if (result.listError) {
    return 'list-error';
  }
  if (result.error) {
    return 'generic-error';
  }
  if (result.overview && result.overview.invoices.length === 0) {
    return 'empty-list';
  }
  return 'overview-loaded';
}

function renderedStateForInvoiceDetail(invoice) {
  return invoice ? 'invoice-detail' : 'invoice-unavailable';
}

function renderedStateForPaymentDocument(invoice, boleto, pix) {
  if (!invoice) {
    return 'document-unavailable';
  }
  if (!boleto || boleto.documentAvailable === false) {
    return 'boleto-unavailable';
  }
  if (!pix || pix.available === false) {
    return 'pix-unavailable';
  }
  return 'payment-document';
}

function renderedStateForReceipt(receipt) {
  return receipt ? 'receipt-loaded' : 'receipt-unavailable';
}

async function main() {
  const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' });
  const server = await createServer(mergeConfig(loaded?.config ?? {}, {
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
  }));

  try {
    const financeScenarios = await server.ssrLoadModule('/src/fixtures/financialScenarios.ts');
    const financeService = await server.ssrLoadModule('/src/demo/financeService.ts');

    const runOverviewLikeHook = async (residenceId) => {
      const result = {
        overview: null,
        error: null,
        listError: false,
        isOffline: false,
      };

      try {
        financeScenarios.setFinanceResidence(residenceId);
        result.overview = await financeService.fetchFinancialOverview(residenceId);
      } catch (error) {
        if (error.message === 'OFFLINE') {
          result.isOffline = true;
          result.error = 'Você está offline. Conecte-se à internet para atualizar.';
        } else if (error.message === 'ITEM_ERROR') {
          result.listError = true;
        } else {
          result.error = 'Não foi possível carregar as informações financeiras. Tente novamente.';
        }
      }

      return result;
    };

    const hookFetchInvoice = async (invoiceId) => {
      try {
        return await financeService.fetchInvoiceDetail(invoiceId);
      } catch {
        return null;
      }
    };

    const hookFetchBoleto = async (invoiceId) => {
      try {
        return await financeService.fetchBoletoInfo(invoiceId);
      } catch {
        return null;
      }
    };

    const hookFetchPix = async (invoiceId) => {
      try {
        return await financeService.fetchPixInfo(invoiceId);
      } catch {
        return null;
      }
    };

    const hookFetchPayments = async (residenceId) => {
      try {
        return await financeService.fetchPaymentHistory(residenceId);
      } catch {
        return [];
      }
    };

    const hookFetchPayment = async (paymentId) => {
      try {
        return await financeService.fetchPaymentDetail(paymentId);
      } catch {
        return null;
      }
    };

    const hookFetchReceipt = async (paymentId) => {
      try {
        return await financeService.fetchReceiptData(paymentId);
      } catch {
        return null;
      }
    };

    const addVector = (row) => vectorRows.push(row);

    financeScenarios.setFinanceScenario('all_paid');
    financeScenarios.setFinanceResidence('prop-001');
    const ec01Overview = await runOverviewLikeHook('prop-001');
    assert.equal(ec01Overview.overview?.scenario, 'all_paid');
    addVector({
      case: 'EC-01',
      flow: 'invoice list success',
      demo_fixture: 'all_paid',
      demo_service_outcome: 'FinancialOverview',
      assembler_input: 'FinancialOverview(all_paid)',
      assembler_output: `invoices=${ec01Overview.overview?.invoices.length ?? 0}`,
      api_status_or_error: '200',
      hook_interpretation: 'overview object',
      rendered_ui_state: renderedStateForOverview(ec01Overview),
      compatibility_result: 'PASS',
    });

    financeScenarios.setFinanceScenario('no_invoices');
    const ec02Overview = await runOverviewLikeHook('prop-001');
    assert.equal(ec02Overview.overview?.invoices.length, 0);
    addVector({
      case: 'EC-02',
      flow: 'empty invoice list',
      demo_fixture: 'no_invoices',
      demo_service_outcome: 'FinancialOverview with empty invoices',
      assembler_input: 'FinancialOverview(no_invoices)',
      assembler_output: '[]',
      api_status_or_error: '200',
      hook_interpretation: 'overview object with empty invoices',
      rendered_ui_state: renderedStateForOverview(ec02Overview),
      compatibility_result: 'PASS',
    });

    financeScenarios.setFinanceScenario('all_paid');
    const ec03Invoice = await hookFetchInvoice('missing-invoice');
    assert.equal(ec03Invoice, null);
    addVector({
      case: 'EC-03',
      flow: 'invoice detail missing',
      demo_fixture: 'all_paid + unknown invoiceId',
      demo_service_outcome: 'null',
      assembler_input: 'null',
      assembler_output: 'null',
      api_status_or_error: '404->null',
      hook_interpretation: 'null',
      rendered_ui_state: renderedStateForInvoiceDetail(ec03Invoice),
      compatibility_result: 'PASS',
    });

    financeScenarios.setFinanceScenario('boleto_unavailable');
    const ec04Invoice = await hookFetchInvoice('inv-2026-07');
    const ec04Boleto = await hookFetchBoleto('inv-2026-07');
    assert.ok(ec04Invoice);
    assert.ok(ec04Boleto);
    assert.equal(ec04Boleto.documentAvailable, false);
    addVector({
      case: 'EC-04',
      flow: 'payment document unavailable',
      demo_fixture: 'boleto_unavailable',
      demo_service_outcome: 'BoletoInfo with documentAvailable=false',
      assembler_input: 'BoletoInfo(documentAvailable=false)',
      assembler_output: ec04Boleto.documentStatus,
      api_status_or_error: '200',
      hook_interpretation: 'object retained, no global error',
      rendered_ui_state: renderedStateForPaymentDocument(ec04Invoice, ec04Boleto, await hookFetchPix('inv-2026-07')),
      compatibility_result: 'PASS',
    });

    financeScenarios.setFinanceScenario('offline');
    const ec05Overview = await runOverviewLikeHook('prop-001');
    assert.equal(ec05Overview.isOffline, true);
    addVector({
      case: 'EC-05',
      flow: 'offline list request',
      demo_fixture: 'offline',
      demo_service_outcome: 'throws OFFLINE',
      assembler_input: 'transport failure',
      assembler_output: 'OFFLINE',
      api_status_or_error: 'network failure',
      hook_interpretation: 'offline banner state',
      rendered_ui_state: renderedStateForOverview(ec05Overview),
      compatibility_result: 'PASS',
    });

    const ec06Invoice = await hookFetchInvoice('inv-2026-07');
    assert.equal(ec06Invoice, null);
    addVector({
      case: 'EC-06',
      flow: 'offline finance detail',
      demo_fixture: 'offline',
      demo_service_outcome: 'throws OFFLINE',
      assembler_input: 'transport failure',
      assembler_output: 'null',
      api_status_or_error: 'network failure',
      hook_interpretation: 'catch to null',
      rendered_ui_state: renderedStateForInvoiceDetail(ec06Invoice),
      compatibility_result: 'PASS',
    });

    financeScenarios.setFinanceScenario('partial_list_error');
    const ec07Overview = await runOverviewLikeHook('prop-001');
    assert.ok(ec07Overview.overview);
    const ec07Invoice = await hookFetchInvoice('inv-2026-04');
    assert.equal(ec07Invoice, null);
    addVector({
      case: 'EC-07',
      flow: 'item-specific error',
      demo_fixture: 'partial_list_error',
      demo_service_outcome: 'detail throws ITEM_ERROR, overview still succeeds',
      assembler_input: 'ITEM_ERROR on fetchInvoiceDetail(inv-2026-04)',
      assembler_output: 'null',
      api_status_or_error: 'ITEM_ERROR',
      hook_interpretation: 'catch to null, not listError',
      rendered_ui_state: renderedStateForInvoiceDetail(ec07Invoice),
      compatibility_result: 'PASS',
    });

    financeScenarios.setFinanceScenario('document_error');
    const ec08Boleto = await hookFetchBoleto('inv-2026-07');
    const ec08Pix = await hookFetchPix('inv-2026-07');
    assert.equal(ec08Boleto, null);
    assert.equal(ec08Pix, null);
    addVector({
      case: 'EC-08',
      flow: 'DOCUMENT_ERROR handling',
      demo_fixture: 'document_error',
      demo_service_outcome: 'throws DOCUMENT_ERROR',
      assembler_input: 'DOCUMENT_ERROR',
      assembler_output: 'null',
      api_status_or_error: 'DOCUMENT_ERROR',
      hook_interpretation: 'catch to null; no universal sentinel handling',
      rendered_ui_state: 'document-unavailable',
      compatibility_result: 'PASS',
    });

    financeScenarios.setFinanceScenario('all_paid');
    const ec09Payment = await hookFetchPayment('missing-payment');
    const ec09Receipt = await hookFetchReceipt('missing-payment');
    assert.equal(ec09Payment, null);
    assert.equal(ec09Receipt, null);
    addVector({
      case: 'EC-09',
      flow: 'unknown backend failure / missing payment resource',
      demo_fixture: 'all_paid + unknown paymentId',
      demo_service_outcome: 'null',
      assembler_input: 'missing payment',
      assembler_output: 'null',
      api_status_or_error: '404->null',
      hook_interpretation: 'null, not misleading success',
      rendered_ui_state: renderedStateForReceipt(ec09Receipt),
      compatibility_result: 'PASS',
    });

    financeScenarios.setFinanceScenario('all_paid');
    const malformedBoleto = await hookFetchBoleto('missing-invoice');
    const malformedPix = await hookFetchPix('missing-invoice');
    assert.equal(malformedBoleto, null);
    assert.equal(malformedPix, null);
    addVector({
      case: 'EC-10',
      flow: 'malformed assembler input / missing upstream resource',
      demo_fixture: 'all_paid + missing invoice for payment doc',
      demo_service_outcome: 'null',
      assembler_input: 'null upstream resource',
      assembler_output: 'null',
      api_status_or_error: '404->null',
      hook_interpretation: 'null with controlled unavailable state',
      rendered_ui_state: 'document-unavailable',
      compatibility_result: 'PASS',
    });

    financeScenarios.setFinanceScenario('all_paid');
    const paymentHistory = await hookFetchPayments('prop-001');
    assert.ok(Array.isArray(paymentHistory));
    addVector({
      case: 'EC-11',
      flow: 'payment history success',
      demo_fixture: 'all_paid',
      demo_service_outcome: `PaymentRecord[${paymentHistory.length}]`,
      assembler_input: 'payment history',
      assembler_output: `records=${paymentHistory.length}`,
      api_status_or_error: '200',
      hook_interpretation: 'payment history array',
      rendered_ui_state: paymentHistory.length > 0 ? 'payment-history' : 'empty-payments',
      compatibility_result: 'PASS',
    });

    console.log(JSON.stringify({
      generated_at: new Date().toISOString(),
      total_cases: vectorRows.length,
      passed: vectorRows.filter((row) => row.compatibility_result === 'PASS').length,
      failed: vectorRows.filter((row) => row.compatibility_result !== 'PASS').length,
      vectors: vectorRows,
    }, null, 2));
  } finally {
    await server.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
