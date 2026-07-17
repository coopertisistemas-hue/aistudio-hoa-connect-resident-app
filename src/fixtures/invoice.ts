export const currentInvoice = {
  id: 'inv-2026-07',
  reference: 'Julho 2026',
  dueDate: '2026-07-20',
  amount: 347.50,
  formattedAmount: 'R$ 347,50',
  status: 'pending',
  statusLabel: 'A vencer',
  daysUntilDue: 3,
  barcode: '34191.79001 01043.510047 91020.150004 1 12345678901234',
  items: [
    { description: 'Taxa de manutenção', amount: 220.00 },
    { description: 'Água (22 m³)', amount: 95.70 },
    { description: 'Fundo de reserva', amount: 31.80 },
  ],
};

export const previousInvoices = [
  {
    id: 'inv-2026-06',
    reference: 'Junho 2026',
    dueDate: '2026-06-20',
    amount: 332.80,
    formattedAmount: 'R$ 332,80',
    status: 'paid',
    statusLabel: 'Pago',
    paidAt: '2026-06-18',
  },
  {
    id: 'inv-2026-05',
    reference: 'Maio 2026',
    dueDate: '2026-05-20',
    amount: 341.20,
    formattedAmount: 'R$ 341,20',
    status: 'paid',
    statusLabel: 'Pago',
    paidAt: '2026-05-19',
  },
];