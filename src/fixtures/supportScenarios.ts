import type {
  SupportScenarioKey,
  SupportRequest,
  SupportOverview,
  SupportCategoryOption,
  FAQItem,
  FAQCategoryOption,
  AssociationContactInfo,
  RequestSubmissionResult,
  SupportRating,
  SupportMessage,
  NewRequestFormData,
  SupportRequestStatus,
} from '@/fixtures/types';

// ─── In-Memory Session Store ────────────────────────────────────

export let activeSupportScenario: SupportScenarioKey = 'one_open';

const sessionRequests = new Map<string, SupportRequest>();

export function setSupportScenario(scenario: SupportScenarioKey) {
  activeSupportScenario = scenario;
}

export function getSupportScenario(): SupportScenarioKey {
  return activeSupportScenario;
}

export function resetSupportState() {
  sessionRequests.clear();
}

// ─── Category Options ─────────────────────────────────────────────────

export const supportCategoryOptions: SupportCategoryOption[] = [
  { value: 'consumption_or_reading', label: 'Consumo ou leitura', icon: 'ri-drop-line', description: 'Dúvidas ou divergências sobre leituras de hidrômetro e valores de consumo registrados.' },
  { value: 'invoice_or_payment', label: 'Fatura ou pagamento', icon: 'ri-bill-line', description: 'Questões sobre faturas, cobranças, pagamentos não identificados ou segunda via.' },
  { value: 'meter', label: 'Hidrômetro', icon: 'ri-speed-line', description: 'Problemas com o equipamento, dificuldade de acesso, substituição ou leitura do hidrômetro.' },
  { value: 'leak_or_possible_issue', label: 'Vazamento ou possível problema', icon: 'ri-alert-line', description: 'Suspeita de vazamento interno, externo ou alteração atípica no consumo de água.' },
  { value: 'supply_interruption', label: 'Interrupção de abastecimento', icon: 'ri-shut-down-line', description: 'Falta de água, baixa pressão ou interrupções programadas ou emergenciais.' },
  { value: 'registration_update', label: 'Atualização cadastral', icon: 'ri-user-settings-line', description: 'Alteração de dados do morador, titularidade, contato ou número de ocupantes.' },
  { value: 'document', label: 'Documento', icon: 'ri-file-text-line', description: 'Solicitação de declarações, certidões, atas, regulamentos ou outros documentos da associação.' },
  { value: 'suggestion', label: 'Sugestão', icon: 'ri-lightbulb-line', description: 'Ideias, melhorias ou sugestões para a associação, áreas comuns ou serviços.' },
  { value: 'complaint', label: 'Reclamação', icon: 'ri-feedback-line', description: 'Manifestação de insatisfação sobre serviços, infraestrutura, barulho ou conduta.' },
  { value: 'other', label: 'Outro assunto', icon: 'ri-more-line', description: 'Qualquer outro tema que não se encaixe nas categorias acima.' },
];

// ─── FAQ Items ───────────────────────────────────────────────────────

export const faqCategories: FAQCategoryOption[] = [
  { value: 'consumption', label: 'Consumo e leituras', icon: 'ri-drop-line' },
  { value: 'invoices', label: 'Faturas e pagamentos', icon: 'ri-bill-line' },
  { value: 'meter', label: 'Hidrômetro', icon: 'ri-speed-line' },
  { value: 'supply', label: 'Abastecimento', icon: 'ri-water-flash-line' },
  { value: 'registration', label: 'Cadastro', icon: 'ri-user-settings-line' },
  { value: 'support', label: 'Atendimento', icon: 'ri-customer-service-line' },
];

export const allFaqItems: FAQItem[] = [
  { id: 'faq-1', category: 'consumption', question: 'Como entender o valor registrado na minha leitura?', answer: 'A leitura é feita mensalmente pela equipe da associação. O valor registrado aparece na sua tela de consumo. Se houver dúvidas, compare com leituras anteriores no histórico ou entre em contato conosco.' },
  { id: 'faq-2', category: 'consumption', question: 'Por que meu consumo aumentou este mês?', answer: 'Variações podem ocorrer por vários motivos: mais pessoas em casa, visitas, uso de máquina de lavar com mais frequência, irrigação de jardim ou pequenos vazamentos. Consulte a seção "Entenda seu consumo" para mais detalhes.' },
  { id: 'faq-3', category: 'consumption', question: 'O que fazer se a leitura não foi registrada?', answer: 'Se sua leitura aparece como pendente, a equipe pode não ter conseguido acessar o hidrômetro. Verifique se o acesso está livre e, se necessário, abra um atendimento para agendar uma nova leitura.' },
  { id: 'faq-4', category: 'invoices', question: 'Quando vence minha próxima fatura?', answer: 'As faturas da associação geralmente vencem no dia 20 de cada mês. Consulte a tela de Faturas para ver a data exata da sua próxima cobrança e o valor.' },
  { id: 'faq-5', category: 'invoices', question: 'Como consigo a segunda via da fatura?', answer: 'Na tela de detalhes da fatura, toque em "Documento de pagamento". Lá você encontra tanto o boleto quanto o PIX para pagamento, além da opção de segunda via.' },
  { id: 'faq-6', category: 'invoices', question: 'Paguei a fatura mas ainda aparece pendente. O que fazer?', answer: 'A identificação do pagamento pode levar até 3 dias úteis. Se após esse prazo ainda constar como pendente, utilize a opção "Informar pagamento não identificado" no detalhe da fatura.' },
  { id: 'faq-7', category: 'invoices', question: 'Quais formas de pagamento são aceitas?', answer: 'Aceitamos pagamento via boleto bancário e PIX. Ambos estão disponíveis na tela de documento de pagamento de cada fatura.' },
  { id: 'faq-8', category: 'meter', question: 'Onde fica meu hidrômetro?', answer: 'A localização do hidrômetro depende da sua unidade. Geralmente fica na área de serviço, no hall de entrada ou em um shaft técnico. Consulte os detalhes na tela de consumo.' },
  { id: 'faq-9', category: 'meter', question: 'O hidrômetro foi trocado recentemente. Isso afeta minha leitura?', answer: 'Sim, quando o hidrômetro é substituído, a contagem pode começar do zero. Isso será indicado no seu histórico de leituras. Seu consumo continua sendo calculado normalmente pela associação.' },
  { id: 'faq-10', category: 'supply', question: 'Haverá interrupção no fornecimento de água?', answer: 'Interrupções programadas são comunicadas com antecedência na central de avisos. Para situações emergenciais, a associação envia comunicado o mais rápido possível. Fique atento às notificações.' },
  { id: 'faq-11', category: 'supply', question: 'Estou sem água. O que devo fazer?', answer: 'Primeiro, verifique na central de avisos se há alguma interrupção programada. Se não houver, pode ser um problema local. Abra um atendimento informando a situação e verificaremos com a concessionária.' },
  { id: 'faq-12', category: 'registration', question: 'Como atualizar meus dados de contato?', answer: 'Você pode solicitar a atualização cadastral na tela de atendimento, selecionando a categoria "Atualização cadastral". Um atendente da associação processará sua solicitação.' },
  { id: 'faq-13', category: 'registration', question: 'Mudei de apartamento dentro do condomínio. O que preciso fazer?', answer: 'Entre em contato com a associação pela tela de atendimento, categoria "Atualização cadastral", informando os dados do novo imóvel para que possamos atualizar seu cadastro.' },
  { id: 'faq-14', category: 'support', question: 'Quanto tempo leva para responderem meu atendimento?', answer: 'A associação geralmente responde em até 2 dias úteis. Atendimentos urgentes, como vazamentos ou interrupções, são priorizados. Você pode acompanhar o status pelo app.' },
  { id: 'faq-15', category: 'support', question: 'Como cancelar um atendimento que já resolvi sozinho?', answer: 'No detalhe do atendimento, se ele estiver elegível para cancelamento, você verá a opção "Cancelar solicitação". Basta informar o motivo e confirmar.' },
];

// ─── Association Contact Info ──────────────────────────────────────────

export const associationContact: AssociationContactInfo = {
  businessHours: 'Segunda a sexta, das 8h às 18h',
  businessDays: 'Segunda a sexta-feira',
  address: 'Rua das Nascentes, 500 — Sala da Associação, Térreo, Bloco 1',
  channels: [
    { type: 'phone', label: 'Telefone', value: '(41) 3333-4444', description: 'Atendimento telefônico durante horário comercial', available: true, icon: 'ri-phone-line' },
    { type: 'whatsapp', label: 'WhatsApp', value: '(41) 99999-8888', description: 'Mensagens respondidas em até 4 horas no horário comercial', available: true, icon: 'ri-whatsapp-line' },
    { type: 'email', label: 'E-mail', value: 'associacao@residencialnascentes.com.br', description: 'Respostas em até 1 dia útil', available: true, icon: 'ri-mail-line' },
    { type: 'in_person', label: 'Presencial', value: 'Sala da Associação — Térreo, Bloco 1', description: 'Atendimento presencial durante horário comercial', available: true, icon: 'ri-map-pin-line' },
    { type: 'emergency', label: 'Emergência', value: '(41) 99999-7777', description: 'Apenas para situações urgentes fora do horário comercial (vazamentos graves, falta de água generalizada)', available: true, icon: 'ri-alert-line' },
  ],
  emergencyGuidance: 'O canal de emergência deve ser utilizado apenas para situações urgentes como vazamentos graves, interrupção generalizada de abastecimento ou risco à segurança. Para demais assuntos, utilize os canais de atendimento normais durante o horário comercial.',
};

// ─── Helper: Build Timeline ───────────────────────────────────────────

function tl(id: string, dateTime: string, actorType: 'resident' | 'association' | 'system', actorName: string, title: string, description: string, extra?: { statusChange?: SupportRequestStatus; statusChangeLabel?: string }) {
  return { id, dateTime, actorType, actorName, title, description, statusChange: extra?.statusChange, statusChangeLabel: extra?.statusChangeLabel };
}

// ─── Precomputed Requests ──────────────────────────────────────────

const reqProp001: SupportRequest[] = [
  {
    id: 'req-001',
    protocol: '2026-0158',
    category: 'leak_or_possible_issue',
    categoryLabel: 'Vazamento ou possível problema',
    status: 'in_analysis',
    statusLabel: 'Em análise',
    statusExplanation: 'Sua solicitação está sendo analisada pela equipe de manutenção. Um técnico verificará a situação relatada.',
    priority: 'important',
    priorityLabel: 'Importante',
    subject: 'Possível vazamento na área de serviço',
    description: 'Notei uma mancha de umidade na parede da área de serviço, próxima ao hidrômetro. O gesso está começando a descascar. Gostaria que a associação verificasse se há algum vazamento na tubulação.',
    residenceId: 'prop-001',
    residenceNickname: 'Apto Bloco 3',
    associationName: 'Associação Residencial Nascentes',
    relatedEntity: { type: 'residence', id: 'prop-001', label: 'Apto 201 — Bloco 3' },
    attachments: [
      { id: 'att-1', name: 'foto_parede_umidade.jpg', type: 'photo', size: '2.4 MB', isDemo: true },
    ],
    contactChannel: 'whatsapp',
    preferredTime: 'Manhã',
    createdAt: '2026-07-14T09:30:00',
    updatedAt: '2026-07-15T14:20:00',
    responsibleArea: 'Equipe de Manutenção',
    expectedNextStep: 'A equipe de manutenção fará uma vistoria no local em até 3 dias úteis.',
    timeline: [
      tl('tl-1', '2026-07-14T09:30:00', 'resident', 'Você', 'Solicitação enviada', 'Atendimento aberto com a descrição do possível vazamento e envio de foto.', { statusChange: 'submitted', statusChangeLabel: 'Enviada' }),
      tl('tl-2', '2026-07-14T09:35:00', 'system', 'Sistema', 'Solicitação recebida', 'Protocolo 2026-0158 registrado. Sua solicitação será encaminhada para triagem.', { statusChange: 'received', statusChangeLabel: 'Recebida' }),
      tl('tl-3', '2026-07-15T08:10:00', 'association', 'Associação', 'Em triagem', 'A solicitação foi analisada pela equipe e encaminhada para a área de manutenção.', { statusChange: 'in_triage', statusChangeLabel: 'Em triagem' }),
      tl('tl-4', '2026-07-15T14:20:00', 'association', 'Associação', 'Em análise', 'A equipe de manutenção está analisando o caso e programará uma vistoria.', { statusChange: 'in_analysis', statusChangeLabel: 'Em análise' }),
    ],
    messages: [
      { id: 'msg-1', dateTime: '2026-07-15T14:25:00', senderType: 'association', senderName: 'Associação', content: 'Olá! Recebemos sua solicitação sobre a umidade na área de serviço. Nossa equipe de manutenção fará uma vistoria no local nos próximos dias. Enquanto isso, evite utilizar a área para não agravar a situação. Qualquer dúvida, estamos à disposição.', unread: false, attachment: undefined, requiresReply: false },
    ],
    visitProposal: null,
    hasUnreadMessages: false,
    eligibleActions: [
      { type: 'reply', label: 'Responder', icon: 'ri-chat-1-line' },
      { type: 'attach', label: 'Anexar documento', icon: 'ri-attachment-2' },
      { type: 'cancel_request', label: 'Cancelar solicitação', icon: 'ri-close-circle-line' },
    ],
  },
  {
    id: 'req-002',
    protocol: '2026-0142',
    category: 'document',
    categoryLabel: 'Documento',
    status: 'awaiting_association',
    statusLabel: 'Aguardando associação',
    statusExplanation: 'Sua solicitação de documento foi recebida e está sendo preparada pela associação.',
    priority: 'normal',
    priorityLabel: 'Normal',
    subject: 'Declaração de residência para matrícula escolar',
    description: 'Preciso de uma declaração de residência para matrícula escolar do meu filho. O documento precisa constar o endereço completo e o nome dos moradores.',
    residenceId: 'prop-001',
    residenceNickname: 'Apto Bloco 3',
    associationName: 'Associação Residencial Nascentes',
    relatedEntity: { type: 'none', id: '', label: 'Nenhum' },
    attachments: [],
    contactChannel: 'email',
    createdAt: '2026-07-10T14:00:00',
    updatedAt: '2026-07-12T10:00:00',
    responsibleArea: 'Secretaria',
    expectedNextStep: 'A declaração será emitida em até 5 dias úteis e disponibilizada aqui.',
    timeline: [
      tl('tl-5', '2026-07-10T14:00:00', 'resident', 'Você', 'Solicitação enviada', 'Pedido de declaração de residência para matrícula escolar.', { statusChange: 'submitted', statusChangeLabel: 'Enviada' }),
      tl('tl-6', '2026-07-10T14:05:00', 'system', 'Sistema', 'Solicitação recebida', 'Protocolo 2026-0142 registrado.', { statusChange: 'received', statusChangeLabel: 'Recebida' }),
      tl('tl-7', '2026-07-12T10:00:00', 'association', 'Associação', 'Em processamento', 'Documento em elaboração pela secretaria.', { statusChange: 'awaiting_association', statusChangeLabel: 'Aguardando associação' }),
    ],
    messages: [
      { id: 'msg-2', dateTime: '2026-07-12T10:05:00', senderType: 'association', senderName: 'Associação', content: 'Recebemos seu pedido de declaração de residência. O documento ficará pronto em até 5 dias úteis e você será notificado quando estiver disponível.', unread: false, attachment: undefined, requiresReply: false },
    ],
    visitProposal: null,
    hasUnreadMessages: false,
    eligibleActions: [
      { type: 'reply', label: 'Responder', icon: 'ri-chat-1-line' },
      { type: 'cancel_request', label: 'Cancelar solicitação', icon: 'ri-close-circle-line' },
    ],
  },
];

const reqProp002: SupportRequest[] = [
  {
    id: 'req-100',
    protocol: '2026-0161',
    category: 'invoice_or_payment',
    categoryLabel: 'Fatura ou pagamento',
    status: 'awaiting_resident',
    statusLabel: 'Aguardando morador',
    statusExplanation: 'A associação precisa de mais informações sobre o pagamento que você mencionou.',
    priority: 'normal',
    priorityLabel: 'Normal',
    subject: 'Pagamento de Julho não identificado',
    description: 'Efetuei o pagamento da fatura de Julho via PIX no dia 15/07, mas ainda consta como pendente no aplicativo.',
    residenceId: 'prop-002',
    residenceNickname: 'Casa Centro',
    associationName: 'Associação Residencial Nascentes',
    relatedEntity: { type: 'invoice', id: 'inv-prop2-07', label: 'Fatura — Julho 2026', path: '/faturas/inv-prop2-07' },
    attachments: [
      { id: 'att-2', name: 'comprovante_pix_julho.pdf', type: 'receipt', size: '156 KB', isDemo: true },
    ],
    contactChannel: 'whatsapp',
    createdAt: '2026-07-16T11:15:00',
    updatedAt: '2026-07-17T09:30:00',
    responsibleArea: 'Financeiro',
    expectedNextStep: 'Aguardando sua resposta com os dados solicitados pela associação.',
    timeline: [
      tl('tl-8', '2026-07-16T11:15:00', 'resident', 'Você', 'Solicitação enviada', 'Relato de pagamento não identificado da fatura de Julho.', { statusChange: 'submitted', statusChangeLabel: 'Enviada' }),
      tl('tl-9', '2026-07-16T11:20:00', 'system', 'Sistema', 'Solicitação recebida', 'Protocolo 2026-0161 registrado.', { statusChange: 'received', statusChangeLabel: 'Recebida' }),
      tl('tl-10', '2026-07-17T09:30:00', 'association', 'Associação', 'Informações solicitadas', 'Financeiro pede mais dados sobre a transação.', { statusChange: 'awaiting_resident', statusChangeLabel: 'Aguardando morador' }),
    ],
    messages: [
      { id: 'msg-3', dateTime: '2026-07-17T09:32:00', senderType: 'association', senderName: 'Associação', content: 'Olá! Verificamos seu comprovante, mas o código da transação PIX que você enviou não está completo. Você poderia nos enviar o comprovante completo ou informar o ID completo da transação que aparece no seu aplicativo do banco?', unread: true, attachment: undefined, requiresReply: true },
    ],
    visitProposal: null,
    hasUnreadMessages: true,
    eligibleActions: [
      { type: 'reply', label: 'Responder', icon: 'ri-chat-1-line' },
      { type: 'attach', label: 'Anexar documento', icon: 'ri-attachment-2' },
      { type: 'view_invoice', label: 'Ver fatura', icon: 'ri-bill-line' },
    ],
  },
];

function buildDefaultRequests(): SupportRequest[] {
  return [...reqProp001, ...reqProp002];
}

// ─── Scenario Builders ───────────────────────────────────────────────

function buildOverview(override: Partial<SupportOverview> & { scenario: SupportScenarioKey }): SupportOverview {
  return {
    hasActiveRequests: false,
    openCount: 0,
    awaitingResidentCount: 0,
    recentlyUpdatedCount: 0,
    statusMessage: 'Você não possui solicitações em aberto.',
    statusType: 'no_requests',
    requests: [],
    residenceId: 'prop-001',
    ...override,
  };
}

export function getSupportOverview(residenceId?: string): SupportOverview {
  const rid = residenceId || 'prop-001';

  switch (activeSupportScenario) {
    case 'no_requests':
      return buildOverview({ scenario: 'no_requests', residenceId: rid });

    case 'one_open':
      return buildOverview({
        scenario: 'one_open',
        hasActiveRequests: true,
        openCount: 1,
        recentlyUpdatedCount: 1,
        statusMessage: 'Uma solicitação está em andamento. Acompanhe pelo detalhe.',
        statusType: 'all_ok',
        requests: [reqProp001[0]],
        residenceId: rid,
      });

    case 'several_open':
      return buildOverview({
        scenario: 'several_open',
        hasActiveRequests: true,
        openCount: 2,
        recentlyUpdatedCount: 2,
        statusMessage: 'Você tem 2 solicitações em andamento.',
        statusType: 'attention',
        requests: [...reqProp001],
        residenceId: rid,
      });

    case 'awaiting_resident':
      return buildOverview({
        scenario: 'awaiting_resident',
        hasActiveRequests: true,
        openCount: 2,
        awaitingResidentCount: 1,
        recentlyUpdatedCount: 1,
        statusMessage: 'Uma solicitação aguarda sua resposta.',
        statusType: 'action_needed',
        requests: [reqProp001[0], reqProp002[0]],
        residenceId: rid,
      });

    case 'awaiting_association':
      return buildOverview({
        scenario: 'awaiting_association',
        hasActiveRequests: true,
        openCount: 2,
        recentlyUpdatedCount: 1,
        statusMessage: 'A associação está preparando sua declaração.',
        statusType: 'all_ok',
        requests: [...reqProp001],
        residenceId: rid,
      });

    case 'in_triage': {
      const r = { ...reqProp001[0], status: 'in_triage' as const, statusLabel: 'Em triagem', statusExplanation: 'Sua solicitação está sendo avaliada pela equipe para o encaminhamento correto.', expectedNextStep: 'Após a triagem, a solicitação será direcionada à área responsável.' };
      return buildOverview({ scenario: 'in_triage', hasActiveRequests: true, openCount: 1, recentlyUpdatedCount: 1, statusMessage: 'Sua solicitação está em triagem.', statusType: 'all_ok', requests: [r], residenceId: rid });
    }

    case 'in_analysis':
      return buildOverview({ scenario: 'in_analysis', hasActiveRequests: true, openCount: 1, recentlyUpdatedCount: 1, statusMessage: 'Sua solicitação está sendo analisada pela equipe de manutenção.', statusType: 'all_ok', requests: [reqProp001[0]], residenceId: rid });

    case 'visit_proposed': {
      const r = {
        ...reqProp001[0],
        status: 'visit_scheduled' as const,
        statusLabel: 'Visita agendada',
        statusExplanation: 'Uma vistoria foi agendada para o seu imóvel.',
        expectedNextStep: 'Confirme a visita ou solicite outro horário, se necessário.',
        visitProposal: {
          proposedDate: '2026-07-22',
          timeWindow: '08:00 — 12:00',
          address: 'Rua das Nascentes, 500 — Bloco 3, Apto 201',
          purpose: 'Vistoria de possível vazamento na parede da área de serviço',
          preparationInstructions: 'Manter a área de serviço acessível. Se possível, evitar uso de máquina de lavar durante a vistoria.',
          contactPerson: 'Carlos — Manutenção',
          contactPhone: '(41) 3333-4444',
          confirmed: false,
          confirmable: true,
        },
      };
      return buildOverview({ scenario: 'visit_proposed', hasActiveRequests: true, openCount: 1, recentlyUpdatedCount: 1, statusMessage: 'Uma visita foi agendada para o dia 22/07.', statusType: 'action_needed', requests: [r], residenceId: rid });
    }

    case 'visit_confirmed': {
      const r = {
        ...reqProp001[0],
        status: 'visit_scheduled' as const,
        statusLabel: 'Visita confirmada',
        statusExplanation: 'Você confirmou a vistoria. O técnico irá no dia e horário combinados.',
        expectedNextStep: 'Aguardar a visita no dia 22/07 entre 8h e 12h.',
        visitProposal: {
          proposedDate: '2026-07-22',
          timeWindow: '08:00 — 12:00',
          address: 'Rua das Nascentes, 500 — Bloco 3, Apto 201',
          purpose: 'Vistoria de possível vazamento na parede da área de serviço',
          preparationInstructions: 'Manter a área de serviço acessível.',
          contactPerson: 'Carlos — Manutenção',
          contactPhone: '(41) 3333-4444',
          confirmed: true,
          confirmable: false,
        },
      };
      return buildOverview({ scenario: 'visit_confirmed', hasActiveRequests: true, openCount: 1, recentlyUpdatedCount: 1, statusMessage: 'Visita confirmada para 22/07.', statusType: 'all_ok', requests: [r], residenceId: rid });
    }

    case 'resolved': {
      const r = {
        ...reqProp001[0],
        status: 'resolved' as const,
        statusLabel: 'Resolvida',
        statusExplanation: 'A vistoria foi realizada e o problema foi identificado e corrigido.',
        expectedNextStep: 'Caso esteja tudo certo, você pode encerrar ou avaliar o atendimento.',
        timeline: [
          ...reqProp001[0].timeline,
          tl('tl-11', '2026-07-17T10:00:00', 'association', 'Associação', 'Problema resolvido', 'Vistoria realizada. Pequeno vazamento na conexão foi reparado.', { statusChange: 'resolved', statusChangeLabel: 'Resolvida' }),
        ],
        messages: [
          ...reqProp001[0].messages,
          { id: 'msg-4', dateTime: '2026-07-17T10:05:00', senderType: 'association', senderName: 'Associação', content: 'Realizamos a vistoria hoje e identificamos um pequeno vazamento na conexão da tubulação. O reparo já foi feito. A parede deve secar nos próximos dias. Se notar qualquer outro problema, nos avise.', unread: false, attachment: undefined, requiresReply: false },
        ],
        eligibleActions: [
          { type: 'reply', label: 'Responder', icon: 'ri-chat-1-line' },
          { type: 'close_request', label: 'Encerrar solicitação', icon: 'ri-check-double-line' },
          { type: 'rate', label: 'Avaliar atendimento', icon: 'ri-star-line' },
        ],
      };
      return buildOverview({ scenario: 'resolved', hasActiveRequests: true, openCount: 1, recentlyUpdatedCount: 1, statusMessage: 'Sua solicitação foi resolvida.', statusType: 'all_ok', requests: [r], residenceId: rid });
    }

    case 'recently_closed': {
      const r = {
        ...reqProp001[0],
        status: 'closed' as const,
        statusLabel: 'Concluída',
        statusExplanation: 'Esta solicitação foi encerrada e arquivada.',
        expectedNextStep: 'Nenhuma ação pendente.',
        eligibleActions: [
          { type: 'reopen_request', label: 'Reabrir solicitação', icon: 'ri-refresh-line' },
        ],
        rating: { score: 5, comment: 'Muito bom atendimento, rápido e eficiente.', submittedDate: '2026-07-17T15:00:00' },
      };
      return buildOverview({ scenario: 'recently_closed', hasActiveRequests: false, openCount: 0, statusMessage: 'Nenhuma solicitação em aberto no momento.', statusType: 'no_requests', requests: [r], residenceId: rid });
    }

    case 'eligible_reopen': {
      const r = {
        ...reqProp001[0],
        status: 'closed' as const,
        statusLabel: 'Concluída',
        statusExplanation: 'Esta solicitação foi encerrada. Se o problema persistir, você pode reabri-la.',
        expectedNextStep: 'Caso o problema não tenha sido totalmente resolvido, reabra a solicitação.',
        eligibleActions: [
          { type: 'reopen_request', label: 'Reabrir solicitação', icon: 'ri-refresh-line' },
        ],
      };
      return buildOverview({ scenario: 'eligible_reopen', hasActiveRequests: false, openCount: 0, statusMessage: 'Nenhuma solicitação em aberto.', statusType: 'no_requests', requests: [r], residenceId: rid });
    }

    case 'canceled': {
      const r = {
        ...reqProp001[0],
        status: 'canceled' as const,
        statusLabel: 'Cancelada',
        statusExplanation: 'Esta solicitação foi cancelada por você.',
        expectedNextStep: 'Se precisar, abra um novo atendimento.',
        eligibleActions: [],
      };
      return buildOverview({ scenario: 'canceled', hasActiveRequests: false, openCount: 0, statusMessage: 'Nenhuma solicitação em aberto.', statusType: 'no_requests', requests: [r], residenceId: rid });
    }

    case 'unread_message': {
      const r = {
        ...reqProp001[0],
        hasUnreadMessages: true,
        messages: [
          ...reqProp001[0].messages,
          { id: 'msg-5', dateTime: '2026-07-17T11:00:00', senderType: 'association', senderName: 'Associação', content: 'Nossa equipe precisa de mais informações sobre o local exato da umidade. Você poderia nos informar se ela está na parede do fundo ou na lateral? Isso ajuda a identificar a origem do possível vazamento.', unread: true, attachment: undefined, requiresReply: true },
        ],
      };
      return buildOverview({ scenario: 'unread_message', hasActiveRequests: true, openCount: 1, recentlyUpdatedCount: 1, statusMessage: 'Nova mensagem da associação.', statusType: 'action_needed', requests: [r], residenceId: rid });
    }

    case 'attachment_unavailable': {
      const r = {
        ...reqProp001[0],
        attachments: [
          { id: 'att-3', name: 'foto_parede.jpg', type: 'photo', size: '2.4 MB', isDemo: true },
        ],
      };
      return buildOverview({ scenario: 'attachment_unavailable', hasActiveRequests: true, openCount: 1, recentlyUpdatedCount: 1, statusMessage: 'Solicitação em andamento.', statusType: 'all_ok', requests: [r], residenceId: rid });
    }

    case 'multi_residence': {
      if (rid === 'prop-002') {
        return buildOverview({
          scenario: 'multi_residence',
          hasActiveRequests: true,
          openCount: 1,
          awaitingResidentCount: 1,
          recentlyUpdatedCount: 1,
          statusMessage: 'Uma solicitação da Casa Centro aguarda sua resposta.',
          statusType: 'action_needed',
          requests: [reqProp002[0]],
          residenceId: 'prop-002',
        });
      }
      return buildOverview({
        scenario: 'multi_residence',
        hasActiveRequests: true,
        openCount: 1,
        recentlyUpdatedCount: 1,
        statusMessage: 'Uma solicitação do Apto Bloco 3 está em andamento.',
        statusType: 'all_ok',
        requests: [reqProp001[0]],
        residenceId: 'prop-001',
      });
    }

    case 'offline':
    case 'message_error':
    case 'submit_error':
    case 'partial_list_error':
    case 'detail_unavailable':
    default:
      return buildOverview({ scenario: activeSupportScenario, hasActiveRequests: true, openCount: 1, recentlyUpdatedCount: 1, statusMessage: 'Uma solicitação está em andamento.', statusType: 'all_ok', requests: [reqProp001[0]], residenceId: rid });
  }
}

export function getRequestById(id: string): SupportRequest | null {
  const all = buildDefaultRequests();
  const found = all.find((r) => r.id === id);
  if (found) return found;

  const cached = sessionRequests.get(id);
  return cached || null;
}

export function getAllRequests(residenceId?: string): SupportRequest[] {
  const overview = getSupportOverview(residenceId);
  return overview.requests;
}

// ─── Session Actions ──────────────────────────────────────────────

export function submitNewRequest(form: NewRequestFormData): RequestSubmissionResult {
  const protocol = `2026-${String(Date.now()).slice(-4)}`;
  const now = new Date().toISOString();

  const newRequest: SupportRequest = {
    id: `req-new-${Date.now()}`,
    protocol,
    category: form.category!,
    categoryLabel: supportCategoryOptions.find((c) => c.value === form.category)?.label || 'Outro',
    status: 'submitted',
    statusLabel: 'Enviada',
    statusExplanation: 'Sua solicitação foi registrada e será analisada pela associação em breve.',
    priority: 'normal',
    priorityLabel: 'Normal',
    subject: form.subject,
    description: form.description,
    residenceId: form.residenceId,
    residenceNickname: form.residenceId === 'prop-001' ? 'Apto Bloco 3' : 'Casa Centro',
    associationName: 'Associação Residencial Nascentes',
    relatedEntity: form.relatedEntity,
    attachments: form.attachments,
    contactChannel: form.contactChannel,
    preferredTime: form.preferredTime || undefined,
    occurrenceDate: form.occurrenceDate || undefined,
    createdAt: now,
    updatedAt: now,
    responsibleArea: 'Central de Atendimento',
    expectedNextStep: 'Sua solicitação será triada e respondida em até 2 dias úteis.',
    timeline: [
      { id: `tl-new-${Date.now()}`, dateTime: now, actorType: 'resident', actorName: 'Você', title: 'Solicitação enviada', description: `Atendimento aberto: ${form.subject}`, statusChange: 'submitted', statusChangeLabel: 'Enviada' },
    ],
    messages: [],
    visitProposal: null,
    hasUnreadMessages: false,
    eligibleActions: [
      { type: 'reply', label: 'Responder', icon: 'ri-chat-1-line' },
      { type: 'add_info', label: 'Adicionar informação', icon: 'ri-edit-line' },
      { type: 'cancel_request', label: 'Cancelar solicitação', icon: 'ri-close-circle-line' },
    ],
  };

  sessionRequests.set(newRequest.id, newRequest);

  return {
    protocol,
    submittedDate: now,
    categoryLabel: newRequest.categoryLabel,
    expectedStep: 'Sua solicitação será triada e respondida em até 2 dias úteis.',
    requestId: newRequest.id,
  };
}

export function addReplyToRequest(requestId: string, content: string, attachmentName?: string): SupportMessage | null {
  const request = getRequestById(requestId);
  if (!request) return null;

  const newMsg: SupportMessage = {
    id: `msg-reply-${Date.now()}`,
    dateTime: new Date().toISOString(),
    senderType: 'resident',
    senderName: 'Você',
    content,
    unread: false,
    attachment: attachmentName ? { id: `att-reply-${Date.now()}`, name: attachmentName, type: 'document', size: '128 KB', isDemo: true } : undefined,
    requiresReply: false,
  };

  const updated = { ...request, messages: [...request.messages, newMsg], hasUnreadMessages: false, updatedAt: new Date().toISOString() };
  sessionRequests.set(requestId, updated);

  return newMsg;
}

export function cancelRequest(requestId: string, reason: string): SupportRequest | null {
  const request = getRequestById(requestId);
  if (!request || !request.eligibleActions.some((a) => a.type === 'cancel_request')) return null;

  const now = new Date().toISOString();
  const updated: SupportRequest = {
    ...request,
    status: 'canceled',
    statusLabel: 'Cancelada',
    statusExplanation: `Solicitação cancelada. Motivo: ${reason}`,
    updatedAt: now,
    expectedNextStep: 'Solicitação encerrada.',
    eligibleActions: [],
    timeline: [
      ...request.timeline,
      { id: `tl-cancel-${Date.now()}`, dateTime: now, actorType: 'resident', actorName: 'Você', title: 'Solicitação cancelada', description: reason, statusChange: 'canceled', statusChangeLabel: 'Cancelada' },
    ],
  };

  sessionRequests.set(requestId, updated);
  return updated;
}

export function closeRequest(requestId: string): SupportRequest | null {
  const request = getRequestById(requestId);
  if (!request || !request.eligibleActions.some((a) => a.type === 'close_request')) return null;

  const now = new Date().toISOString();
  const updated: SupportRequest = {
    ...request,
    status: 'closed',
    statusLabel: 'Concluída',
    statusExplanation: 'Solicitação encerrada por você.',
    updatedAt: now,
    expectedNextStep: 'Nenhuma ação pendente.',
    eligibleActions: request.eligibleActions.filter((a) => a.type !== 'close_request'),
    timeline: [
      ...request.timeline,
      { id: `tl-close-${Date.now()}`, dateTime: now, actorType: 'resident', actorName: 'Você', title: 'Solicitação encerrada', description: 'Atendimento concluído pelo morador.', statusChange: 'closed', statusChangeLabel: 'Concluída' },
    ],
  };

  sessionRequests.set(requestId, updated);
  return updated;
}

export function reopenRequest(requestId: string, reason: string, attachmentName?: string): SupportRequest | null {
  const request = getRequestById(requestId);
  if (!request || !request.eligibleActions.some((a) => a.type === 'reopen_request')) return null;

  const now = new Date().toISOString();
  const updated: SupportRequest = {
    ...request,
    status: 'reopened',
    statusLabel: 'Reaberta',
    statusExplanation: 'Solicitação reaberta e encaminhada novamente para análise.',
    updatedAt: now,
    expectedNextStep: 'A associação analisará sua solicitação reaberta.',
    eligibleActions: [
      { type: 'reply', label: 'Responder', icon: 'ri-chat-1-line' },
      { type: 'cancel_request', label: 'Cancelar solicitação', icon: 'ri-close-circle-line' },
    ],
    attachments: attachmentName ? [...request.attachments, { id: `att-reopen-${Date.now()}`, name: attachmentName, type: 'document', size: '256 KB', isDemo: true }] : request.attachments,
    timeline: [
      ...request.timeline,
      { id: `tl-reopen-${Date.now()}`, dateTime: now, actorType: 'resident', actorName: 'Você', title: 'Solicitação reaberta', description: reason, statusChange: 'reopened', statusChangeLabel: 'Reaberta' },
    ],
  };

  sessionRequests.set(requestId, updated);
  return updated;
}

export function submitRating(requestId: string, score: number, comment?: string): SupportRating | null {
  const request = getRequestById(requestId);
  if (!request) return null;

  const rating: SupportRating = {
    score,
    comment,
    submittedDate: new Date().toISOString(),
  };

  const updated = { ...request, rating, eligibleActions: request.eligibleActions.filter((a) => a.type !== 'rate') };
  sessionRequests.set(requestId, updated);

  return rating;
}

export function confirmVisit(requestId: string): SupportRequest | null {
  const request = getRequestById(requestId);
  if (!request || !request.visitProposal || !request.visitProposal.confirmable) return null;

  const now = new Date().toISOString();
  const updated: SupportRequest = {
    ...request,
    status: 'visit_scheduled',
    statusLabel: 'Visita confirmada',
    statusExplanation: 'Você confirmou a vistoria. O técnico comparecerá na data agendada.',
    updatedAt: now,
    expectedNextStep: 'Aguardar a visita conforme agendado.',
    visitProposal: { ...request.visitProposal, confirmed: true, confirmable: false },
    eligibleActions: request.eligibleActions.filter((a) => a.type !== 'confirm_visit'),
    timeline: [
      ...request.timeline,
      { id: `tl-visit-${Date.now()}`, dateTime: now, actorType: 'resident', actorName: 'Você', title: 'Visita confirmada', description: 'Morador confirmou a vistoria agendada.', statusChange: 'visit_scheduled', statusChangeLabel: 'Visita confirmada' },
    ],
  };

  sessionRequests.set(requestId, updated);
  return updated;
}

// ─── Scenario Labels ──────────────────────────────────────────────────

export const supportScenarioLabels: Record<SupportScenarioKey, string> = {
  no_requests: 'Sem solicitações',
  one_open: 'Uma solicitação aberta',
  several_open: 'Várias solicitações',
  awaiting_resident: 'Aguardando morador',
  awaiting_association: 'Aguardando associação',
  in_triage: 'Em triagem',
  in_analysis: 'Em análise',
  visit_proposed: 'Visita proposta',
  visit_confirmed: 'Visita confirmada',
  resolved: 'Solicitação resolvida',
  recently_closed: 'Recém concluída',
  eligible_reopen: 'Elegível para reabertura',
  canceled: 'Cancelada',
  unread_message: 'Mensagem não lida',
  attachment_unavailable: 'Anexo indisponível',
  message_error: 'Erro ao enviar mensagem',
  submit_error: 'Erro ao enviar solicitação',
  partial_list_error: 'Erro parcial na lista',
  detail_unavailable: 'Detalhe indisponível',
  multi_residence: 'Múltiplas residências',
  offline: 'Offline',
};