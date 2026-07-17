import type {
  NotificationScenarioKey,
  NotificationItem,
  NotificationOverview,
  NoticeItem,
  CommunicationPreference,
  SimulatedNotificationEvent,
} from '@/fixtures/types';

// ─── In-memory read-state store ──────────────────────────────────────

let unreadNotificationIds = new Set<string>();
let readNoticeIds = new Set<string>();

export function markNotificationRead(id: string) {
  unreadNotificationIds.delete(id);
}

export function markNotificationUnread(id: string) {
  unreadNotificationIds.add(id);
}

export function markAllNotificationsRead() {
  unreadNotificationIds.clear();
}

export function markNoticeRead(id: string) {
  readNoticeIds.add(id);
}

export function markNoticeUnread(id: string) {
  readNoticeIds.delete(id);
}

export function isNotificationUnread(id: string, initialUnread: boolean): boolean {
  if (unreadNotificationIds.has(id)) return true;
  if (initialUnread) {
    unreadNotificationIds.add(id);
    return true;
  }
  return false;
}

export function isNoticeRead(id: string, initialRead: boolean): boolean {
  if (readNoticeIds.has(id)) return true;
  if (initialRead) {
    readNoticeIds.add(id);
    return true;
  }
  return false;
}

export function resetReadState() {
  unreadNotificationIds.clear();
  readNoticeIds.clear();
}

// ─── Base notifications (shared across scenarios) ────────────────────

function buildBaseNotifications(residenceId: string, residenceNickname: string): NotificationItem[] {
  const now = Date.now();
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  const twoDaysAgo = new Date(today.getTime() - 172800000);
  const threeDaysAgo = new Date(today.getTime() - 259200000);
  const fiveDaysAgo = new Date(today.getTime() - 432000000);
  const weekAgo = new Date(today.getTime() - 604800000);
  const tenDaysAgo = new Date(today.getTime() - 864000000);

  const fmt = (d: Date) => {
    const iso = d.toISOString().split('T')[0];
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${iso}T${time}:00`;
  };

  return [
    {
      id: 'notif-001',
      category: 'invoice',
      categoryLabel: 'Fatura',
      categoryIcon: 'ri-bill-line',
      title: 'Nova fatura disponível',
      description: `A fatura de Julho/2026 para ${residenceNickname} já está disponível para consulta. Vencimento em 25/07/2026.`,
      dateTime: fmt(today),
      timestamp: today.getTime(),
      unread: true,
      relatedResidenceId: residenceId,
      relatedResidenceNickname: residenceNickname,
      priority: 'info',
      priorityLabel: 'Informativa',
      destination: { type: 'invoice_detail', path: '/faturas/inv-003', label: 'Ver fatura' },
      relatedId: 'inv-003',
    },
    {
      id: 'notif-002',
      category: 'consumption',
      categoryLabel: 'Consumo',
      categoryIcon: 'ri-drop-line',
      title: 'Leitura registrada',
      description: `A leitura do hidrômetro de Julho/2026 foi registrada. Consumo: 20 m³ para ${residenceNickname}.`,
      dateTime: fmt(yesterday),
      timestamp: yesterday.getTime(),
      unread: true,
      relatedResidenceId: residenceId,
      relatedResidenceNickname: residenceNickname,
      priority: 'info',
      priorityLabel: 'Informativa',
      destination: { type: 'consumption_detail', path: '/consumo', label: 'Ver consumo' },
    },
    {
      id: 'notif-003',
      category: 'payment',
      categoryLabel: 'Pagamento',
      categoryIcon: 'ri-check-double-line',
      title: 'Pagamento identificado',
      description: `Seu pagamento da fatura de Junho/2026 (R$ 332,80) foi identificado para ${residenceNickname}.`,
      dateTime: fmt(twoDaysAgo),
      timestamp: twoDaysAgo.getTime(),
      unread: false,
      relatedResidenceId: residenceId,
      relatedResidenceNickname: residenceNickname,
      priority: 'info',
      priorityLabel: 'Informativa',
      destination: { type: 'receipt', path: '/pagamentos/pay-001/comprovante', label: 'Ver comprovante' },
      relatedId: 'pay-001',
    },
    {
      id: 'notif-004',
      category: 'notice',
      categoryLabel: 'Aviso',
      categoryIcon: 'ri-megaphone-line',
      title: 'Manutenção programada',
      description: 'Haverá manutenção na rede de água na próxima quarta-feira, dia 22/07, das 8h às 14h.',
      dateTime: fmt(threeDaysAgo),
      timestamp: threeDaysAgo.getTime(),
      unread: false,
      relatedResidenceId: null,
      relatedResidenceNickname: null,
      priority: 'important',
      priorityLabel: 'Importante',
      destination: { type: 'notice_detail', path: '/avisos/notice-001', label: 'Ler aviso' },
      relatedId: 'notice-001',
    },
    {
      id: 'notif-005',
      category: 'document',
      categoryLabel: 'Documento',
      categoryIcon: 'ri-file-text-line',
      title: 'Documento disponível',
      description: 'A ata da assembleia de Julho/2026 está disponível para consulta.',
      dateTime: fmt(fiveDaysAgo),
      timestamp: fiveDaysAgo.getTime(),
      unread: false,
      relatedResidenceId: null,
      relatedResidenceNickname: null,
      priority: 'info',
      priorityLabel: 'Informativa',
      destination: { type: 'notice_detail', path: '/avisos/notice-003', label: 'Ver documento' },
      relatedId: 'notice-003',
    },
    {
      id: 'notif-006',
      category: 'support',
      categoryLabel: 'Atendimento',
      categoryIcon: 'ri-customer-service-line',
      title: 'Solicitação atualizada',
      description: 'Sua solicitação #PROTO-2026-0042 teve uma atualização.',
      dateTime: fmt(weekAgo),
      timestamp: weekAgo.getTime(),
      unread: false,
      relatedResidenceId: residenceId,
      relatedResidenceNickname: residenceNickname,
      priority: 'info',
      priorityLabel: 'Informativa',
      destination: { type: 'support_detail', path: '/atendimento', label: 'Acompanhar solicitação' },
    },
    {
      id: 'notif-007',
      category: 'payment',
      categoryLabel: 'Pagamento',
      categoryIcon: 'ri-time-line',
      title: 'Pagamento em processamento',
      description: `O pagamento da fatura de Junho/2026 para ${residenceNickname} está em processamento. A identificação pode levar até 3 dias úteis.`,
      dateTime: fmt(tenDaysAgo),
      timestamp: tenDaysAgo.getTime(),
      unread: false,
      relatedResidenceId: residenceId,
      relatedResidenceNickname: residenceNickname,
      priority: 'info',
      priorityLabel: 'Informativa',
      destination: { type: 'invoice_detail', path: '/faturas/inv-002', label: 'Ver fatura' },
      relatedId: 'inv-002',
    },
  ];
}

// ─── Base notices ────────────────────────────────────────────────────

function buildBaseNotices(): NoticeItem[] {
  return [
    {
      id: 'notice-001',
      category: 'maintenance',
      categoryLabel: 'Manutenção',
      categoryIcon: 'ri-tools-line',
      title: 'Manutenção programada — Rede de água',
      summary: 'Haverá interrupção no fornecimento de água na quarta-feira, dia 22/07, das 8h às 14h, para manutenção da rede principal.',
      content: `COMUNICADO DE MANUTENÇÃO\n\nPrezados moradores,\n\nInformamos que haverá manutenção programada na rede de abastecimento de água do condomínio na próxima quarta-feira, dia 22 de julho de 2026, das 8h às 14h.\n\nDurante este período, o fornecimento de água será interrompido em todas as unidades.\n\nRecomendamos:\n• Abastecer reservatórios e caixas d'água até a noite de terça-feira\n• Reduzir o consumo de água na manhã de quarta-feira\n• Evitar uso de máquinas de lavar durante a interrupção\n\nA manutenção inclui:\n• Substituição de válvulas da rede principal\n• Limpeza dos reservatórios superiores\n• Inspeção das bombas de recalque\n\nEm caso de condições climáticas adversas, a data poderá ser alterada. Acompanhe nossos canais oficiais.\n\nAgradecemos a compreensão.\n\nAssociação Residencial Jardim das Nascentes`,
      publishedDate: '2026-07-16',
      priority: 'important',
      priorityLabel: 'Importante',
      read: false,
      audience: 'all_residences',
      audienceLabel: 'Todas as residências',
      relatedResidenceIds: [],
      relatedResidenceLabels: [],
      associationName: 'Associação Residencial Jardim das Nascentes',
      attachments: [
        { id: 'att-001', type: 'comunicado', label: 'Comunicado oficial', description: 'Documento completo com detalhes da manutenção', isDemo: true },
        { id: 'att-002', type: 'calendario', label: 'Calendário de manutenção', description: 'Cronograma detalhado das atividades previstas', isDemo: true },
      ],
      contactPhone: '(41) 3333-4444',
      contactEmail: 'associacao@jardimnascentes.org.br',
    },
    {
      id: 'notice-002',
      category: 'meeting',
      categoryLabel: 'Assembleia',
      categoryIcon: 'ri-group-line',
      title: 'Assembleia geral ordinária — Agosto 2026',
      summary: 'Convidamos todos os moradores para a assembleia geral no dia 10 de agosto, às 19h, no salão de festas.',
      content: `CONVOCAÇÃO — ASSEMBLEIA GERAL ORDINÁRIA\n\nPrezados moradores,\n\nConvocamos todos os proprietários e residentes para a Assembleia Geral Ordinária do condomínio.\n\nData: 10 de agosto de 2026\nHorário: 19h (primeira chamada) | 19h30 (segunda chamada)\nLocal: Salão de Festas — Térreo do Bloco 1\n\nPauta:\n1. Aprovação da ata da assembleia anterior\n2. Prestação de contas do 1º semestre de 2026\n3. Orçamento previsto para o 2º semestre de 2026\n4. Proposta de reajuste da contribuição mensal\n5. Obras e benfeitorias programadas\n6. Eleição de conselheiros fiscais\n7. Assuntos gerais\n\nSua participação é muito importante para as decisões do condomínio.\n\nCaso não possa comparecer, envie sua procuração por e-mail até o dia 08/08.\n\nAssociação Residencial Jardim das Nascentes`,
      publishedDate: '2026-07-12',
      priority: 'important',
      priorityLabel: 'Importante',
      read: false,
      audience: 'all_residences',
      audienceLabel: 'Todas as residências',
      relatedResidenceIds: [],
      relatedResidenceLabels: [],
      associationName: 'Associação Residencial Jardim das Nascentes',
      attachments: [
        { id: 'att-003', type: 'meeting_document', label: 'Edital de convocação', description: 'Documento oficial da convocação', isDemo: true },
        { id: 'att-004', type: 'regulamento', label: 'Regimento interno', description: 'Regimento para consulta prévia', isDemo: true },
      ],
    },
    {
      id: 'notice-003',
      category: 'general',
      categoryLabel: 'Informativo',
      categoryIcon: 'ri-information-line',
      title: 'Coleta seletiva — Novos horários',
      summary: 'A partir de agosto, a coleta seletiva passará a ser realizada às terças e sextas-feiras, das 7h às 9h.',
      content: `INFORMATIVO — COLETA SELETIVA\n\nPrezados moradores,\n\nA partir do dia 1º de agosto de 2026, a coleta seletiva de resíduos recicláveis passará a ser realizada duas vezes por semana.\n\nNovos horários:\n• Terças-feiras: 7h às 9h\n• Sextas-feiras: 7h às 9h\n\nO que pode ser reciclado:\n• Papel e papelão limpos\n• Plásticos (garrafas, embalagens, sacolas)\n• Vidros (embalados para segurança)\n• Metais (latas de alumínio e aço)\n\nO que NÃO deve ir para a coleta seletiva:\n• Resíduos orgânicos\n• Resíduos de banheiro\n• Resíduos hospitalares\n• Lâmpadas e pilhas\n\nOs coletores ficam na área de serviço, ao lado da guarita.\n\nContamos com a colaboração de todos!\n\nAssociação Residencial Jardim das Nascentes`,
      publishedDate: '2026-07-08',
      priority: 'info',
      priorityLabel: 'Informativa',
      read: false,
      audience: 'all_residences',
      audienceLabel: 'Todas as residências',
      relatedResidenceIds: [],
      relatedResidenceLabels: [],
      associationName: 'Associação Residencial Jardim das Nascentes',
      attachments: [
        { id: 'att-005', type: 'orientacao', label: 'Guia de reciclagem', description: 'Guia completo com instruções de separação', isDemo: true },
      ],
    },
    {
      id: 'notice-004',
      category: 'billing',
      categoryLabel: 'Financeiro',
      categoryIcon: 'ri-money-dollar-circle-line',
      title: 'Reajuste da contribuição mensal — 2º semestre',
      summary: 'A contribuição mensal terá reajuste de 5,2% a partir de agosto, conforme aprovado na assembleia de maio.',
      content: `COMUNICADO FINANCEIRO\n\nPrezados moradores,\n\nConforme aprovado na assembleia geral de maio de 2026, informamos o reajuste da contribuição mensal para o 2º semestre.\n\nReajuste: 5,2%\nVigência: A partir de agosto de 2026\n\nNovos valores:\n• Unidades de 2 quartos: R$ 842,50\n• Unidades de 3 quartos: R$ 1.053,20\n\nO reajuste considera:\n• Inflação acumulada (IPCA)\n• Aumento nos custos de manutenção\n• Investimentos em melhorias aprovadas\n\nAs faturas de agosto já serão emitidas com o novo valor.\n\nDúvidas podem ser encaminhadas para o e-mail financeiro.\n\nAssociação Residencial Jardim das Nascentes`,
      publishedDate: '2026-07-01',
      validityEnd: '2026-12-31',
      priority: 'important',
      priorityLabel: 'Importante',
      read: false,
      audience: 'all_residences',
      audienceLabel: 'Todas as residências',
      relatedResidenceIds: [],
      relatedResidenceLabels: [],
      associationName: 'Associação Residencial Jardim das Nascentes',
      attachments: [
        { id: 'att-006', type: 'comunicado', label: 'Ata da assembleia', description: 'Trecho da ata que aprovou o reajuste', isDemo: true },
      ],
      contactEmail: 'financeiro@jardimnascentes.org.br',
    },
    {
      id: 'notice-005',
      category: 'emergency',
      categoryLabel: 'Emergência',
      categoryIcon: 'ri-alert-line',
      title: 'URGENTE: Interrupção de água — Amanhã',
      summary: 'A Sanepar informou interrupção emergencial no fornecimento de água amanhã, dia 18/07, das 6h às 18h.',
      content: `⚠️ AVISO URGENTE\n\nA Sanepar informou que haverá interrupção emergencial no fornecimento de água amanhã, dia 18 de julho de 2026, das 6h às 18h, devido a reparos na rede principal da Rua das Nascentes.\n\nEsta é uma interrupção determinada pela concessionária, não programada pelo condomínio.\n\nRecomendamos:\n• Abastecer reservatórios e caixas d'água ainda hoje\n• Economizar água durante o dia de hoje\n• Evitar uso de máquinas de lavar durante a interrupção\n\nA previsão de retorno é às 18h, mas pode haver variação conforme o andamento dos reparos.\n\nPara emergências durante o período: (41) 3333-4444\n\nAssociação Residencial Jardim das Nascentes`,
      publishedDate: '2026-07-17',
      priority: 'urgent',
      priorityLabel: 'Urgente',
      read: false,
      audience: 'all_residences',
      audienceLabel: 'Todas as residências',
      relatedResidenceIds: [],
      relatedResidenceLabels: [],
      associationName: 'Associação Residencial Jardim das Nascentes',
      attachments: [],
      contactPhone: '(41) 3333-4444',
    },
    {
      id: 'notice-006',
      category: 'water',
      categoryLabel: 'Água',
      categoryIcon: 'ri-drop-line',
      title: 'Campanha de uso consciente de água',
      summary: 'Dicas e orientações para reduzir o consumo de água no condomínio durante o período de estiagem.',
      content: `CAMPANHA — USO CONSCIENTE DE ÁGUA\n\nPrezados moradores,\n\nCom a chegada do período de estiagem, reforçamos a importância do uso consciente de água em nossas unidades.\n\nDicas práticas:\n• Verifique torneiras e registros quanto a vazamentos\n• Feche a torneira ao escovar os dentes ou fazer a barba\n• Utilize a máquina de lavar apenas com carga completa\n• Reaproveite a água da máquina para lavar áreas externas\n• Reduza o tempo de banho\n• Instale arejadores nas torneiras\n\nO consumo médio do condomínio está em 22 m³ por unidade. Nosso objetivo é reduzir para 18 m³ até o final do ano.\n\nPequenas mudanças fazem grande diferença!\n\nAssociação Residencial Jardim das Nascentes`,
      publishedDate: '2026-07-05',
      priority: 'info',
      priorityLabel: 'Informativa',
      read: false,
      audience: 'all_residences',
      audienceLabel: 'Todas as residências',
      relatedResidenceIds: [],
      relatedResidenceLabels: [],
      associationName: 'Associação Residencial Jardim das Nascentes',
      attachments: [
        { id: 'att-007', type: 'orientacao', label: 'Cartilha de economia', description: 'Guia com dicas de economia de água', isDemo: true },
      ],
    },
    {
      id: 'notice-007',
      category: 'maintenance',
      categoryLabel: 'Manutenção',
      categoryIcon: 'ri-tools-line',
      title: 'Pintura da fachada — Bloco 3',
      summary: 'A pintura da fachada do Bloco 3 será realizada entre os dias 25/07 e 05/08.',
      content: `COMUNICADO — PINTURA DE FACHADA\n\nMoradores do Bloco 3,\n\nInformamos que a pintura da fachada do bloco será realizada entre os dias 25 de julho e 5 de agosto de 2026.\n\nDurante o período:\n• Haverá andaimes na fachada\n• Mantenha janelas fechadas para evitar poeira\n• Não estacione próximo à fachada\n• Os profissionais trabalharão das 8h às 17h\n\nPedimos desculpas pelo transtorno temporário.\n\nAssociação Residencial Jardim das Nascentes`,
      publishedDate: '2026-07-14',
      priority: 'info',
      priorityLabel: 'Informativa',
      read: false,
      audience: 'specific_residence',
      audienceLabel: 'Bloco 3',
      relatedResidenceIds: ['prop-001'],
      relatedResidenceLabels: ['Apto 302 — Bloco 3'],
      associationName: 'Associação Residencial Jardim das Nascentes',
      attachments: [],
    },
    {
      id: 'notice-008',
      category: 'general',
      categoryLabel: 'Informativo',
      categoryIcon: 'ri-shield-check-line',
      title: 'Atualização do sistema de câmeras',
      summary: 'O sistema de câmeras de segurança do condomínio foi atualizado. Novas câmeras foram instaladas nas áreas comuns.',
      content: `INFORMATIVO — SEGURANÇA\n\nPrezados moradores,\n\nInformamos que o sistema de câmeras de segurança do condomínio passou por uma atualização completa.\n\nMelhorias realizadas:\n• Substituição de 12 câmeras analógicas por digitais\n• Instalação de 4 novas câmeras nas áreas comuns\n• Novo sistema de gravação com retenção de 30 dias\n• Monitoramento remoto pela equipe de segurança\n\nAs imagens são armazenadas conforme a LGPD e acessadas apenas pela administração e sob protocolo.\n\nAssociação Residencial Jardim das Nascentes`,
      publishedDate: '2026-06-20',
      priority: 'info',
      priorityLabel: 'Informativa',
      read: true,
      audience: 'all_residences',
      audienceLabel: 'Todas as residências',
      relatedResidenceIds: [],
      relatedResidenceLabels: [],
      associationName: 'Associação Residencial Jardim das Nascentes',
      attachments: [],
    },
  ];
}

// ─── Base preferences ────────────────────────────────────────────────

function buildBasePreferences(): CommunicationPreference[] {
  return [
    {
      id: 'pref-invoices',
      category: 'invoice',
      categoryLabel: 'Faturas e vencimentos',
      description: 'Notificações sobre novas faturas, vencimentos próximos e lembretes.',
      enabled: true,
      mandatory: false,
      channels: ['in_app', 'email'],
      availableChannels: [
        { channel: 'in_app', label: 'App', description: 'Notificação dentro do aplicativo', available: true },
        { channel: 'email', label: 'E-mail', description: 'Mensagem enviada para seu e-mail cadastrado', available: true },
        { channel: 'whatsapp', label: 'WhatsApp', description: 'Mensagem via WhatsApp', available: false },
        { channel: 'sms', label: 'SMS', description: 'Mensagem de texto', available: false },
      ],
    },
    {
      id: 'pref-payments',
      category: 'payment',
      categoryLabel: 'Confirmação de pagamento',
      description: 'Notificações quando um pagamento é identificado ou está em processamento.',
      enabled: true,
      mandatory: false,
      channels: ['in_app'],
      availableChannels: [
        { channel: 'in_app', label: 'App', description: 'Notificação dentro do aplicativo', available: true },
        { channel: 'email', label: 'E-mail', description: 'Mensagem enviada para seu e-mail cadastrado', available: true },
        { channel: 'whatsapp', label: 'WhatsApp', description: 'Mensagem via WhatsApp', available: false },
        { channel: 'sms', label: 'SMS', description: 'Mensagem de texto', available: false },
      ],
    },
    {
      id: 'pref-consumption',
      category: 'consumption',
      categoryLabel: 'Consumo e leituras',
      description: 'Notificações sobre novas leituras do hidrômetro e dados de consumo.',
      enabled: true,
      mandatory: false,
      channels: ['in_app', 'email'],
      availableChannels: [
        { channel: 'in_app', label: 'App', description: 'Notificação dentro do aplicativo', available: true },
        { channel: 'email', label: 'E-mail', description: 'Mensagem enviada para seu e-mail cadastrado', available: true },
        { channel: 'whatsapp', label: 'WhatsApp', description: 'Mensagem via WhatsApp', available: false },
        { channel: 'sms', label: 'SMS', description: 'Mensagem de texto', available: false },
      ],
    },
    {
      id: 'pref-consumption-alerts',
      category: 'consumption',
      categoryLabel: 'Alertas de consumo incomum',
      description: 'Alertas quando o consumo de água apresenta variação significativa.',
      enabled: true,
      mandatory: false,
      channels: ['in_app', 'email', 'whatsapp'],
      availableChannels: [
        { channel: 'in_app', label: 'App', description: 'Notificação dentro do aplicativo', available: true },
        { channel: 'email', label: 'E-mail', description: 'Mensagem enviada para seu e-mail cadastrado', available: true },
        { channel: 'whatsapp', label: 'WhatsApp', description: 'Mensagem via WhatsApp', available: true },
        { channel: 'sms', label: 'SMS', description: 'Mensagem de texto', available: false },
      ],
    },
    {
      id: 'pref-support',
      category: 'support',
      categoryLabel: 'Atualizações de atendimento',
      description: 'Notificações quando suas solicitações e chamados são atualizados.',
      enabled: true,
      mandatory: false,
      channels: ['in_app'],
      availableChannels: [
        { channel: 'in_app', label: 'App', description: 'Notificação dentro do aplicativo', available: true },
        { channel: 'email', label: 'E-mail', description: 'Mensagem enviada para seu e-mail cadastrado', available: true },
        { channel: 'whatsapp', label: 'WhatsApp', description: 'Mensagem via WhatsApp', available: false },
        { channel: 'sms', label: 'SMS', description: 'Mensagem de texto', available: false },
      ],
    },
    {
      id: 'pref-notices',
      category: 'notice',
      categoryLabel: 'Avisos da associação',
      description: 'Notificações sobre comunicados, informativos e avisos gerais da associação.',
      enabled: true,
      mandatory: false,
      channels: ['in_app', 'email'],
      availableChannels: [
        { channel: 'in_app', label: 'App', description: 'Notificação dentro do aplicativo', available: true },
        { channel: 'email', label: 'E-mail', description: 'Mensagem enviada para seu e-mail cadastrado', available: true },
        { channel: 'whatsapp', label: 'WhatsApp', description: 'Mensagem via WhatsApp', available: false },
        { channel: 'sms', label: 'SMS', description: 'Mensagem de texto', available: false },
      ],
    },
    {
      id: 'pref-maintenance',
      category: 'maintenance_notice',
      categoryLabel: 'Manutenção e interrupções',
      description: 'Avisos sobre manutenções programadas, interrupções de serviços e situações de emergência.',
      enabled: true,
      mandatory: true,
      mandatoryExplanation: 'Avisos de manutenção e emergência são obrigatórios para garantir sua segurança e informação sobre serviços essenciais.',
      channels: ['in_app', 'email', 'whatsapp'],
      availableChannels: [
        { channel: 'in_app', label: 'App', description: 'Notificação dentro do aplicativo', available: true },
        { channel: 'email', label: 'E-mail', description: 'Mensagem enviada para seu e-mail cadastrado', available: true },
        { channel: 'whatsapp', label: 'WhatsApp', description: 'Mensagem via WhatsApp', available: true },
        { channel: 'sms', label: 'SMS', description: 'Mensagem de texto', available: false },
      ],
    },
  ];
}

// ─── Scenario builders ───────────────────────────────────────────────

function buildOverview(
  scenario: NotificationScenarioKey,
  residenceId: string,
  residenceNickname: string,
  notifications: NotificationItem[],
  notices: NoticeItem[],
  preferences: CommunicationPreference[],
): NotificationOverview {
  const unreadCount = notifications.filter((n) => {
    if (scenario === 'no_unread') return false;
    return isNotificationUnread(n.id, n.unread);
  }).length;

  return {
    scenario,
    unreadCount,
    notifications: notifications.map((n) => ({
      ...n,
      unread: isNotificationUnread(n.id, n.unread),
    })),
    notices: notices.map((n) => ({
      ...n,
      read: isNoticeRead(n.id, n.read),
    })),
    preferences,
    residenceId,
  };
}

export function buildScenario1_NoUnread(): NotificationOverview {
  resetReadState();
  const allRead = buildBaseNotifications('prop-001', 'Apto 302 — Bloco 3').map((n) => ({ ...n, unread: false }));
  const notices = buildBaseNotices().map((n) => ({ ...n, read: true }));
  return buildOverview('no_unread', 'prop-001', 'Apto 302 — Bloco 3', allRead, notices, buildBasePreferences());
}

export function buildScenario2_OneUnread(): NotificationOverview {
  resetReadState();
  const base = buildBaseNotifications('prop-001', 'Apto 302 — Bloco 3');
  const oneUnread = base.map((n, i) => ({ ...n, unread: i === 0 }));
  const notices = buildBaseNotices();
  return buildOverview('one_unread', 'prop-001', 'Apto 302 — Bloco 3', oneUnread, notices, buildBasePreferences());
}

export function buildScenario3_ManyUnread(): NotificationOverview {
  resetReadState();
  const all = buildBaseNotifications('prop-001', 'Apto 302 — Bloco 3');
  const manyUnread = all.map((n, i) => ({ ...n, unread: i < 5 }));
  const notices = buildBaseNotices().map((n, i) => ({ ...n, read: i >= 4 }));
  return buildOverview('many_unread', 'prop-001', 'Apto 302 — Bloco 3', manyUnread, notices, buildBasePreferences());
}

export function buildScenario4_InvoiceNotification(): NotificationOverview {
  resetReadState();
  const base = buildBaseNotifications('prop-001', 'Apto 302 — Bloco 3');
  const invoiceHeavy = [
    {
      ...base[0],
      title: 'Fatura vence em 3 dias',
      description: 'Sua fatura de Julho/2026 (R$ 332,80) vence em 3 dias. Não deixe para a última hora.',
      priority: 'important' as const,
      priorityLabel: 'Importante',
    },
    base[1], base[2], base[3], base[4], base[5], base[6],
  ];
  const notices = buildBaseNotices();
  return buildOverview('invoice_notification', 'prop-001', 'Apto 302 — Bloco 3', invoiceHeavy, notices, buildBasePreferences());
}

export function buildScenario5_PaymentIdentified(): NotificationOverview {
  resetReadState();
  const base = buildBaseNotifications('prop-001', 'Apto 302 — Bloco 3');
  const paymentHeavy = [
    {
      ...base[0],
      unread: false,
    },
    {
      id: 'notif-pay-001',
      category: 'payment' as const,
      categoryLabel: 'Pagamento',
      categoryIcon: 'ri-check-double-line',
      title: 'Pagamento identificado',
      description: 'Seu pagamento de R$ 332,80 referente a Junho/2026 foi identificado. Obrigado!',
      dateTime: new Date().toISOString().replace('Z', '+00:00'),
      timestamp: Date.now(),
      unread: true,
      relatedResidenceId: 'prop-001',
      relatedResidenceNickname: 'Apto 302 — Bloco 3',
      priority: 'info' as const,
      priorityLabel: 'Informativa',
      destination: { type: 'receipt', path: '/pagamentos/pay-001/comprovante', label: 'Ver comprovante' },
    },
    base[1], base[3], base[4], base[5], base[6],
  ];
  const notices = buildBaseNotices();
  return buildOverview('payment_identified', 'prop-001', 'Apto 302 — Bloco 3', paymentHeavy, notices, buildBasePreferences());
}

export function buildScenario6_PaymentProcessing(): NotificationOverview {
  resetReadState();
  const base = buildBaseNotifications('prop-001', 'Apto 302 — Bloco 3');
  const processing = [
    {
      id: 'notif-proc-001',
      category: 'payment' as const,
      categoryLabel: 'Pagamento',
      categoryIcon: 'ri-time-line',
      title: 'Pagamento em processamento',
      description: 'Seu pagamento da fatura de Junho/2026 foi recebido e está em processamento. A identificação pode levar até 3 dias úteis.',
      dateTime: new Date().toISOString().replace('Z', '+00:00'),
      timestamp: Date.now(),
      unread: true,
      relatedResidenceId: 'prop-001',
      relatedResidenceNickname: 'Apto 302 — Bloco 3',
      priority: 'info' as const,
      priorityLabel: 'Informativa',
      destination: { type: 'invoice_detail', path: '/faturas/inv-002', label: 'Ver fatura' },
    },
    base[0], base[1], base[3], base[4], base[5],
  ];
  const notices = buildBaseNotices();
  return buildOverview('payment_processing', 'prop-001', 'Apto 302 — Bloco 3', processing, notices, buildBasePreferences());
}

export function buildScenario7_ReadingRecorded(): NotificationOverview {
  resetReadState();
  const base = buildBaseNotifications('prop-001', 'Apto 302 — Bloco 3');
  const reading = [
    {
      id: 'notif-read-001',
      category: 'consumption' as const,
      categoryLabel: 'Consumo',
      categoryIcon: 'ri-drop-line',
      title: 'Nova leitura registrada',
      description: 'A leitura de Julho/2026 do seu hidrômetro foi registrada. Consumo: 20 m³. Clique para ver os detalhes.',
      dateTime: new Date().toISOString().replace('Z', '+00:00'),
      timestamp: Date.now(),
      unread: true,
      relatedResidenceId: 'prop-001',
      relatedResidenceNickname: 'Apto 302 — Bloco 3',
      priority: 'info' as const,
      priorityLabel: 'Informativa',
      destination: { type: 'consumption_detail', path: '/consumo', label: 'Ver consumo' },
    },
    base[0], base[2], base[3], base[4], base[5], base[6],
  ];
  const notices = buildBaseNotices();
  return buildOverview('reading_recorded', 'prop-001', 'Apto 302 — Bloco 3', reading, notices, buildBasePreferences());
}

export function buildScenario8_UnusualConsumption(): NotificationOverview {
  resetReadState();
  const alert = [
    {
      id: 'notif-alert-001',
      category: 'consumption' as const,
      categoryLabel: 'Consumo',
      categoryIcon: 'ri-alert-line',
      title: 'Atenção: consumo acima do habitual',
      description: 'Seu consumo de Julho/2026 (46 m³) está 109% acima da sua média. Vale conferir possíveis causas.',
      dateTime: new Date().toISOString().replace('Z', '+00:00'),
      timestamp: Date.now(),
      unread: true,
      relatedResidenceId: 'prop-001',
      relatedResidenceNickname: 'Apto 302 — Bloco 3',
      priority: 'urgent' as const,
      priorityLabel: 'Urgente',
      destination: { type: 'consumption_detail', path: '/consumo', label: 'Ver consumo' },
    },
    ...buildBaseNotifications('prop-001', 'Apto 302 — Bloco 3'),
  ];
  const notices = buildBaseNotices();
  return buildOverview('unusual_consumption', 'prop-001', 'Apto 302 — Bloco 3', alert, notices, buildBasePreferences());
}

export function buildScenario9_SupportUpdate(): NotificationOverview {
  resetReadState();
  const support = [
    {
      id: 'notif-sup-001',
      category: 'support' as const,
      categoryLabel: 'Atendimento',
      categoryIcon: 'ri-customer-service-line',
      title: 'Chamado atualizado',
      description: 'Seu chamado #PROTO-2026-0042 sobre vazamento na área comum foi atualizado. Status: Em andamento.',
      dateTime: new Date().toISOString().replace('Z', '+00:00'),
      timestamp: Date.now(),
      unread: true,
      relatedResidenceId: 'prop-001',
      relatedResidenceNickname: 'Apto 302 — Bloco 3',
      priority: 'info' as const,
      priorityLabel: 'Informativa',
      destination: { type: 'support_detail', path: '/atendimento', label: 'Acompanhar' },
    },
    ...buildBaseNotifications('prop-001', 'Apto 302 — Bloco 3'),
  ];
  const notices = buildBaseNotices();
  return buildOverview('support_update', 'prop-001', 'Apto 302 — Bloco 3', support, notices, buildBasePreferences());
}

export function buildScenario10_ImportantNotice(): NotificationOverview {
  resetReadState();
  const notice = [
    {
      id: 'notif-not-001',
      category: 'notice' as const,
      categoryLabel: 'Aviso',
      categoryIcon: 'ri-megaphone-line',
      title: 'Novo aviso importante',
      description: 'A associação publicou um novo aviso: Manutenção programada da rede de água no dia 22/07.',
      dateTime: new Date().toISOString().replace('Z', '+00:00'),
      timestamp: Date.now(),
      unread: true,
      relatedResidenceId: null,
      relatedResidenceNickname: null,
      priority: 'important' as const,
      priorityLabel: 'Importante',
      destination: { type: 'notice_detail', path: '/avisos/notice-001', label: 'Ler aviso' },
    },
    ...buildBaseNotifications('prop-001', 'Apto 302 — Bloco 3'),
  ];
  const notices = buildBaseNotices();
  return buildOverview('important_notice', 'prop-001', 'Apto 302 — Bloco 3', notice, notices, buildBasePreferences());
}

export function buildScenario11_UrgentMaintenance(): NotificationOverview {
  resetReadState();
  const urgent = [
    {
      id: 'notif-urg-001',
      category: 'notice' as const,
      categoryLabel: 'Aviso',
      categoryIcon: 'ri-alert-line',
      title: '⚠️ Aviso urgente: interrupção de água',
      description: 'Interrupção emergencial de água amanhã, 18/07, das 6h às 18h. Abasteça seus reservatórios hoje.',
      dateTime: new Date().toISOString().replace('Z', '+00:00'),
      timestamp: Date.now(),
      unread: true,
      relatedResidenceId: null,
      relatedResidenceNickname: null,
      priority: 'urgent' as const,
      priorityLabel: 'Urgente',
      destination: { type: 'notice_detail', path: '/avisos/notice-005', label: 'Ler aviso urgente' },
    },
    ...buildBaseNotifications('prop-001', 'Apto 302 — Bloco 3'),
  ];
  const notices = buildBaseNotices();
  return buildOverview('urgent_maintenance', 'prop-001', 'Apto 302 — Bloco 3', urgent, notices, buildBasePreferences());
}

export function buildScenario12_MultiResidence(): NotificationOverview {
  resetReadState();
  const notesApto = buildBaseNotifications('prop-001', 'Apto 302 — Bloco 3');
  const notesCasa = buildBaseNotifications('prop-002', 'Casa Centro').map((n) => ({
    ...n,
    id: n.id + '-casa',
    relatedResidenceId: 'prop-002',
    relatedResidenceNickname: 'Casa Centro',
    destination: { ...n.destination, path: n.destination.path.replace('prop-001', 'prop-002') },
  }));
  const combined = [...notesApto, ...notesCasa];
  const notices = buildBaseNotices();
  return buildOverview('multi_residence', 'prop-001', 'Apto 302 — Bloco 3', combined, notices, buildBasePreferences());
}

export function buildScenario13_NoNotices(): NotificationOverview {
  resetReadState();
  const base = buildBaseNotifications('prop-001', 'Apto 302 — Bloco 3');
  return buildOverview('no_notices', 'prop-001', 'Apto 302 — Bloco 3', base, [], buildBasePreferences());
}

export function buildScenario14_ArchivedOnly(): NotificationOverview {
  resetReadState();
  const base = buildBaseNotifications('prop-001', 'Apto 302 — Bloco 3');
  const archivedNotices = buildBaseNotices()
    .filter((n) => n.priority === 'info')
    .map((n) => ({ ...n, read: true }));
  return buildOverview('archived_only', 'prop-001', 'Apto 302 — Bloco 3', base, archivedNotices, buildBasePreferences());
}

export function buildScenario15_PartialError(): NotificationOverview {
  resetReadState();
  const notices = buildBaseNotices();
  return {
    scenario: 'partial_error',
    unreadCount: 0,
    notifications: [],
    notices,
    preferences: buildBasePreferences(),
    residenceId: 'prop-001',
    _notificationError: true,
  } as NotificationOverview & { _notificationError?: boolean };
}

export function buildScenario16_DetailUnavailable(): NotificationOverview {
  resetReadState();
  const base = buildBaseNotifications('prop-001', 'Apto 302 — Bloco 3');
  const notices = buildBaseNotices();
  return buildOverview('detail_unavailable', 'prop-001', 'Apto 302 — Bloco 3', base, notices, buildBasePreferences());
}

export function buildScenario17_PreferencesError(): NotificationOverview {
  resetReadState();
  const prefs = buildBasePreferences().map((p) => ({ ...p }));
  return {
    scenario: 'preferences_error',
    unreadCount: 2,
    notifications: buildBaseNotifications('prop-001', 'Apto 302 — Bloco 3'),
    notices: buildBaseNotices(),
    preferences: prefs,
    residenceId: 'prop-001',
    _preferencesSaveError: true,
  } as NotificationOverview & { _preferencesSaveError?: boolean };
}

export function buildScenario18_Offline(): NotificationOverview {
  resetReadState();
  const notices = buildBaseNotices();
  return buildOverview('offline', 'prop-001', 'Apto 302 — Bloco 3', [], notices, buildBasePreferences());
}

// ─── Scenario dispatcher ─────────────────────────────────────────────

export let activeNotificationScenario: NotificationScenarioKey = 'many_unread';

export function getNotificationOverview(residenceId?: string): NotificationOverview {
  const builders: Record<NotificationScenarioKey, () => NotificationOverview> = {
    no_unread: buildScenario1_NoUnread,
    one_unread: buildScenario2_OneUnread,
    many_unread: buildScenario3_ManyUnread,
    invoice_notification: buildScenario4_InvoiceNotification,
    payment_identified: buildScenario5_PaymentIdentified,
    payment_processing: buildScenario6_PaymentProcessing,
    reading_recorded: buildScenario7_ReadingRecorded,
    unusual_consumption: buildScenario8_UnusualConsumption,
    support_update: buildScenario9_SupportUpdate,
    important_notice: buildScenario10_ImportantNotice,
    urgent_maintenance: buildScenario11_UrgentMaintenance,
    multi_residence: buildScenario12_MultiResidence,
    no_notices: buildScenario13_NoNotices,
    archived_only: buildScenario14_ArchivedOnly,
    partial_error: buildScenario15_PartialError,
    detail_unavailable: buildScenario16_DetailUnavailable,
    preferences_error: buildScenario17_PreferencesError,
    offline: buildScenario18_Offline,
  };

  return builders[activeNotificationScenario]();
}

export function setNotificationScenario(scenario: NotificationScenarioKey) {
  activeNotificationScenario = scenario;
}

export function getNotificationById(id: string): NotificationItem | undefined {
  const overview = getNotificationOverview();
  return overview.notifications.find((n) => n.id === id);
}

export function getNoticeById(id: string): NoticeItem | undefined {
  const overview = getNotificationOverview();
  return overview.notices.find((n) => n.id === id);
}

export function getUnreadCount(): number {
  const overview = getNotificationOverview();
  return overview.notifications.filter((n) => n.unread).length;
}

// ─── Simulated in-app events ─────────────────────────────────────────

let simulatedEventQueue: SimulatedNotificationEvent[] = [];

export function queueSimulatedEvent(event: SimulatedNotificationEvent) {
  simulatedEventQueue.push(event);
}

export function dequeueSimulatedEvent(): SimulatedNotificationEvent | undefined {
  return simulatedEventQueue.shift();
}

export function hasPendingSimulatedEvent(): boolean {
  return simulatedEventQueue.length > 0;
}

export const simulatedEventTemplates: SimulatedNotificationEvent[] = [
  {
    id: 'sim-ev-001',
    category: 'invoice',
    title: 'Nova fatura disponível',
    description: 'Fatura de Julho/2026 disponível para consulta.',
    timestamp: Date.now(),
  },
  {
    id: 'sim-ev-002',
    category: 'payment',
    title: 'Pagamento identificado',
    description: 'Pagamento de R$ 332,80 identificado com sucesso.',
    timestamp: Date.now(),
  },
  {
    id: 'sim-ev-003',
    category: 'consumption',
    title: 'Leitura registrada',
    description: 'Nova leitura do hidrômetro disponível.',
    timestamp: Date.now(),
  },
  {
    id: 'sim-ev-004',
    category: 'notice',
    title: 'Novo aviso publicado',
    description: 'A associação publicou um novo comunicado.',
    timestamp: Date.now(),
  },
];