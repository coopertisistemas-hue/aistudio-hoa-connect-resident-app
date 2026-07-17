export const notices = [
  {
    id: 'notice-001',
    title: 'Manutenção programada — Rede de água',
    summary: 'Haverá interrupção no fornecimento de água na próxima quarta-feira, dia 22, das 8h às 14h, para manutenção da rede.',
    date: '2026-07-16',
    type: 'maintenance',
    priority: 'high',
    isNew: true,
  },
  {
    id: 'notice-002',
    title: 'Assembleia geral — Agosto 2026',
    summary: 'Convidamos todos os moradores para a assembleia geral no dia 10 de agosto, às 19h, no salão de festas.',
    date: '2026-07-12',
    type: 'meeting',
    priority: 'normal',
    isNew: false,
  },
  {
    id: 'notice-003',
    title: 'Coleta seletiva — Novos horários',
    summary: 'A partir de agosto, a coleta seletiva passará a ser realizada às terças e sextas-feiras, das 7h às 9h.',
    date: '2026-07-08',
    type: 'info',
    priority: 'normal',
    isNew: false,
  },
];

export const latestNotice = notices[0];