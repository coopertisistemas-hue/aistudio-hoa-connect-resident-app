import type {
  ProfileScenarioKey,
  ResidentProfile,
  EditableProfileFields,
  ProtectedProfileField,
  ContactInfo,
  ContactMethod,
  LinkedResidenceItem,
  ResidenceInvitation,
  AppPreference,
  AccessibilityPreference,
  SecurityInfo,
  SimulatedSession,
  ProfileOverview,
  PrivacySection,
  PrivacyDataCategory,
  AboutInfo,
  DeviceAppInfo,
  CorrectionRequestForm,
  CorrectionConfirmation,
  SignOutResult,
  SignOutType,
  NewRequestFormData,
} from '@/fixtures/types';
import { submitNewRequest } from '@/fixtures/supportScenarios';

// ─── Session-local state ───────────────────────────────────────────

export let activeProfileScenario: ProfileScenarioKey = 'complete';

export function setProfileScenario(scenario: ProfileScenarioKey): void {
  activeProfileScenario = scenario;
}

export function getProfileScenario(): ProfileScenarioKey {
  return activeProfileScenario;
}

// ─── Base profile data ─────────────────────────────────────────────

const baseProfile: ResidentProfile = {
  id: 'res-001',
  fullName: 'Carlos Eduardo Silva',
  preferredName: 'Carlos',
  displayName: 'Carlos Silva',
  cpf: '123.456.789-00',
  cpfMasked: '***.456.789-**',
  birthDate: '15/03/1985',
  role: 'holder',
  roleLabel: 'Titular',
  registrationRef: 'MAT-45678',
  registrationDate: '15/03/2024',
  profileStatus: 'active',
  profileStatusLabel: 'Ativo',
  initials: 'CS',
  pronounPreference: null,
  photoUrl: null,
  completenessLabel: 'Perfil completo',
  associationName: 'Associação de Moradores Parque das Águas',
};

const baseEditableFields: EditableProfileFields = {
  preferredName: 'Carlos',
  displayName: 'Carlos Silva',
  pronounPreference: '',
};

const baseProtectedFields: ProtectedProfileField[] = [
  {
    key: 'full_name',
    label: 'Nome completo',
    value: 'Carlos Eduardo Silva',
    explanation: 'O nome completo é controlado pela associação com base no cadastro de titularidade. Alterações devem ser solicitadas formalmente.',
    correctionRequested: false,
  },
  {
    key: 'cpf',
    label: 'CPF',
    value: '***.456.789-**',
    explanation: 'O CPF é um dado de identificação fiscal protegido. Somente a associação pode atualizá-lo mediante comprovação documental.',
    correctionRequested: false,
  },
  {
    key: 'birth_date',
    label: 'Data de nascimento',
    value: '15/03/1985',
    explanation: 'A data de nascimento é um dado cadastral controlado pela associação. Para correções, é necessário apresentar documento oficial.',
    correctionRequested: false,
  },
  {
    key: 'role',
    label: 'Vínculo com a residência',
    value: 'Titular',
    explanation: 'O vínculo de titularidade é definido pela associação e está associado à matrícula do imóvel.',
    correctionRequested: false,
  },
  {
    key: 'registration',
    label: 'Registro na associação',
    value: 'MAT-45678 — 15/03/2024',
    explanation: 'O registro de associação é gerido pela administração e vincula o morador à unidade.',
    correctionRequested: false,
  },
];

const baseContactMethods: ContactMethod[] = [
  {
    type: 'phone',
    label: 'Telefone principal',
    value: '(41) 99876-1234',
    valueMasked: '(41) 9****-1234',
    isVerified: true,
    verificationState: 'verified',
    verificationLabel: 'Verificado',
    editable: true,
  },
  {
    type: 'whatsapp',
    label: 'WhatsApp',
    value: '(41) 99876-1234',
    valueMasked: '(41) 9****-1234',
    isVerified: true,
    verificationState: 'verified',
    verificationLabel: 'Verificado',
    editable: true,
  },
  {
    type: 'primary_email',
    label: 'E-mail principal',
    value: 'carlos.silva@email.com',
    valueMasked: 'c****s@email.com',
    isVerified: true,
    verificationState: 'verified',
    verificationLabel: 'Verificado',
    editable: true,
  },
  {
    type: 'secondary_email',
    label: 'E-mail secundário',
    value: 'carlos.silva.alt@email.com',
    valueMasked: 'c****s.a**@email.com',
    isVerified: false,
    verificationState: 'pending',
    verificationLabel: 'Pendente',
    editable: true,
  },
];

const baseContactInfo: ContactInfo = {
  methods: baseContactMethods,
  preferredChannel: 'E-mail',
};

const baseLinkedResidences: LinkedResidenceItem[] = [
  {
    id: 'prop-001',
    nickname: 'Apto Bloco 3',
    address: 'Rua das Nascentes, 500 — Bloco 3, Apto 201',
    residentRole: 'holder',
    roleLabel: 'Titular',
    associationName: 'Parque das Águas',
    connectionStatus: 'active',
    connectionStatusLabel: 'Ativa',
    isActiveContext: true,
  },
  {
    id: 'prop-002',
    nickname: 'Casa Centro',
    address: 'Rua Visconde de Nácar, 1200 — Casa 7',
    residentRole: 'authorized_resident',
    roleLabel: 'Morador autorizado',
    associationName: 'Parque das Águas',
    connectionStatus: 'linked',
    connectionStatusLabel: 'Vinculada',
    isActiveContext: false,
  },
];

const baseInvitations: ResidenceInvitation[] = [];

const baseAppPreferences: AppPreference[] = [
  {
    id: 'initial_screen',
    label: 'Tela inicial',
    description: 'Qual tela abrir ao acessar o aplicativo',
    type: 'select',
    value: 'inicio',
    options: [
      { value: 'inicio', label: 'Início', available: true },
      { value: 'faturas', label: 'Faturas', available: true },
      { value: 'consumo', label: 'Consumo', available: true },
    ],
    editable: true,
  },
  {
    id: 'default_residence',
    label: 'Residência padrão',
    description: 'Residência selecionada ao abrir o aplicativo',
    type: 'select',
    value: 'prop-001',
    options: [
      { value: 'prop-001', label: 'Apto Bloco 3', available: true },
      { value: 'prop-002', label: 'Casa Centro', available: true },
    ],
    editable: true,
  },
  {
    id: 'list_density',
    label: 'Densidade das listas',
    description: 'Espaçamento entre itens nas listas',
    type: 'select',
    value: 'comfortable',
    options: [
      { value: 'compact', label: 'Compacta', available: true },
      { value: 'comfortable', label: 'Confortável', available: true },
    ],
    editable: true,
  },
  {
    id: 'show_values_home',
    label: 'Mostrar valores no Início',
    description: 'Exibir valores de faturas e consumo na tela inicial',
    type: 'toggle',
    value: true,
    editable: true,
  },
  {
    id: 'residence_change_confirmation',
    label: 'Confirmação ao trocar residência',
    description: 'Pedir confirmação antes de alternar entre residências vinculadas',
    type: 'toggle',
    value: true,
    editable: true,
  },
  {
    id: 'session_lock',
    label: 'Bloqueio automático',
    description: 'Solicitar senha após período de inatividade',
    type: 'select',
    value: '5min',
    options: [
      { value: 'never', label: 'Nunca', available: true },
      { value: '1min', label: 'Após 1 minuto', available: true },
      { value: '5min', label: 'Após 5 minutos', available: true },
      { value: '15min', label: 'Após 15 minutos', available: true },
    ],
    editable: true,
  },
  {
    id: 'language',
    label: 'Idioma',
    description: 'Idioma do aplicativo',
    type: 'select',
    value: 'pt-BR',
    options: [
      { value: 'pt-BR', label: 'Português', available: true },
      { value: 'en', label: 'English — em preparação', available: false },
      { value: 'es', label: 'Español — em preparação', available: false },
    ],
    editable: true,
  },
  {
    id: 'date_format',
    label: 'Formato de data',
    description: 'Formato de exibição das datas',
    type: 'select',
    value: 'DD/MM/AAAA',
    options: [
      { value: 'DD/MM/AAAA', label: 'DD/MM/AAAA', available: true },
      { value: 'AAAA-MM-DD', label: 'AAAA-MM-DD', available: true },
    ],
    editable: true,
  },
];

const baseAccessibilityPreferences: AccessibilityPreference[] = [
  {
    id: 'larger_text',
    label: 'Texto ampliado',
    description: 'Aumenta o tamanho do texto em todo o aplicativo',
    type: 'toggle',
    active: false,
  },
  {
    id: 'enhanced_contrast',
    label: 'Contraste aprimorado',
    description: 'Aumenta o contraste entre texto e fundo para melhor legibilidade',
    type: 'toggle',
    active: false,
  },
  {
    id: 'reduced_motion',
    label: 'Reduzir animações',
    description: 'Minimiza animações e transições visuais',
    type: 'toggle',
    active: false,
  },
  {
    id: 'written_status',
    label: 'Exibir status por escrito',
    description: 'Sempre mostrar rótulos de status por extenso, sem depender apenas de cores',
    type: 'toggle',
    active: true,
  },
  {
    id: 'larger_touch_targets',
    label: 'Áreas de toque ampliadas',
    description: 'Aumenta o tamanho mínimo dos botões e controles',
    type: 'toggle',
    active: false,
  },
  {
    id: 'simplified_charts',
    label: 'Gráficos simplificados',
    description: 'Exibe versões simplificadas dos gráficos de consumo',
    type: 'toggle',
    active: false,
  },
  {
    id: 'screen_reader_descriptions',
    label: 'Descrições para leitor de tela',
    description: 'Adiciona descrições textuais detalhadas para imagens e gráficos',
    type: 'toggle',
    active: false,
  },
  {
    id: 'avoid_auto_animation',
    label: 'Evitar animações automáticas',
    description: 'Não reproduzir animações sem interação do usuário',
    type: 'toggle',
    active: false,
  },
];

const baseSessions: SimulatedSession[] = [
  {
    id: 'sess-001',
    deviceName: 'iPhone 15 — Carlos',
    deviceType: 'Celular',
    lastAccess: 'Hoje, 14:32',
    authMethod: 'Senha e biometria',
    isCurrent: true,
    isTrusted: true,
    location: 'Curitiba, PR',
  },
  {
    id: 'sess-002',
    deviceName: 'MacBook Pro — Carlos',
    deviceType: 'Computador',
    lastAccess: 'Ontem, 20:15',
    authMethod: 'Senha',
    isCurrent: false,
    isTrusted: true,
    location: 'Curitiba, PR',
  },
  {
    id: 'sess-003',
    deviceName: 'iPad — Sala',
    deviceType: 'Tablet',
    lastAccess: '12/07/2026',
    authMethod: 'Senha',
    isCurrent: false,
    isTrusted: true,
    location: 'Curitiba, PR',
  },
];

const baseSecurityInfo: SecurityInfo = {
  sessions: baseSessions,
  sessionLockEnabled: true,
  sessionLockTimeout: '5 minutos',
  recoveryEmail: 'carlos.silva@email.com',
  recoveryEmailMasked: 'c****s@email.com',
  lastPasswordChange: '10/03/2026',
  twoFactorAvailable: true,
};

// ─── Privacy data ──────────────────────────────────────────────────

const privacySections: PrivacySection[] = [
  {
    id: 'what_we_show',
    title: 'Quais informações o aplicativo exibe',
    content: 'O HOA Connect exibe informações relacionadas à sua residência e ao seu vínculo com a associação. Isso inclui: dados cadastrais fornecidos pela associação, histórico de consumo de água, faturas e pagamentos, comunicados oficiais, e atendimentos que você iniciar. O aplicativo não coleta dados além dos necessários para essas finalidades.',
    icon: 'ri-eye-line',
  },
  {
    id: 'why_data_appears',
    title: 'Por que esses dados aparecem',
    content: 'Os dados de consumo, financeiros e de comunicação são exibidos porque estão diretamente vinculados à sua unidade e ao seu relacionamento com a associação. A associação é responsável por manter essas informações atualizadas e corretas.',
    icon: 'ri-question-line',
  },
  {
    id: 'association_responsibility',
    title: 'Responsabilidade da associação',
    content: 'A Associação de Moradores Parque das Águas é a responsável pelo tratamento dos dados exibidos no aplicativo. Ela define quais informações estão disponíveis, mantém os cadastros atualizados e atende solicitações de correção de dados.',
    icon: 'ri-building-line',
  },
  {
    id: 'resident_rights',
    title: 'Seus direitos como morador',
    content: 'Você tem o direito de: conhecer quais dados seus estão registrados; solicitar a correção de informações incorretas; saber como seus dados são utilizados; e solicitar informações sobre o tratamento dos seus dados pela associação.',
    icon: 'ri-shield-check-line',
  },
  {
    id: 'correction_request',
    title: 'Como solicitar correções',
    content: 'Para corrigir dados protegidos como nome, CPF ou vínculo, utilize a opção "Solicitar correção" disponível na tela de Dados Pessoais. Sua solicitação será encaminhada à associação e você poderá acompanhar pelo Atendimento.',
    icon: 'ri-edit-line',
  },
  {
    id: 'simulated_data',
    title: 'Dados de demonstração',
    content: 'Esta é uma versão de demonstração do HOA Connect. Todos os dados exibidos são simulados e não correspondem a informações reais de moradores, residências ou associações. Nenhum dado é armazenado ou transmitido para servidores externos.',
    icon: 'ri-information-line',
  },
  {
    id: 'future_context',
    title: 'Versão completa futura',
    content: 'Em uma versão completa do aplicativo, os dados seriam protegidos por autenticação segura, armazenados em ambiente controlado e acessíveis apenas a moradores autorizados. Esta versão de demonstração permite explorar a experiência do aplicativo.',
    icon: 'ri-rocket-line',
  },
];

const privacyDataCategories: PrivacyDataCategory[] = [
  {
    id: 'personal_data',
    name: 'Dados pessoais',
    description: 'Nome, CPF, data de nascimento, vínculo com a residência',
    icon: 'ri-user-line',
    dataTypes: ['Nome completo', 'CPF (mascarado)', 'Data de nascimento', 'Tipo de vínculo'],
    retentionLabel: 'Enquanto durar o vínculo com a associação',
  },
  {
    id: 'contact_data',
    name: 'Dados de contato',
    description: 'Telefone, WhatsApp, e-mails cadastrados',
    icon: 'ri-phone-line',
    dataTypes: ['Telefone principal', 'WhatsApp', 'E-mail principal', 'E-mail secundário'],
    retentionLabel: 'Enquanto o cadastro estiver ativo',
  },
  {
    id: 'residence_data',
    name: 'Dados da residência',
    description: 'Endereço, unidade, matrícula, moradores vinculados',
    icon: 'ri-home-line',
    dataTypes: ['Endereço completo', 'Matrícula', 'Moradores vinculados', 'Tipo de ocupação'],
    retentionLabel: 'Enquanto durar o vínculo com o imóvel',
  },
  {
    id: 'consumption_data',
    name: 'Dados de consumo',
    description: 'Histórico de leituras e consumo de água',
    icon: 'ri-drop-line',
    dataTypes: ['Leituras do hidrômetro', 'Consumo mensal', 'Alertas de consumo'],
    retentionLabel: '36 meses',
  },
  {
    id: 'financial_data',
    name: 'Dados financeiros',
    description: 'Faturas, pagamentos, comprovantes',
    icon: 'ri-bill-line',
    dataTypes: ['Faturas emitidas', 'Pagamentos registrados', 'Comprovantes'],
    retentionLabel: '60 meses',
  },
  {
    id: 'communication_data',
    name: 'Dados de comunicação',
    description: 'Atendimentos, mensagens, notificações',
    icon: 'ri-message-2-line',
    dataTypes: ['Solicitações de atendimento', 'Mensagens trocadas', 'Preferências de notificação'],
    retentionLabel: '24 meses',
  },
];

// ─── About & device info ───────────────────────────────────────────

const aboutInfo: AboutInfo = {
  appName: 'HOA Connect',
  appPurpose: 'Aplicativo para moradores de associações de moradores. Permite acompanhar consumo de água, faturas, pagamentos, comunicados da associação e solicitar atendimento.',
  associationName: 'Associação de Moradores Parque das Águas',
  appVersion: '2.4.0',
  environment: 'Demonstração',
  lastUpdateDate: '15/07/2026',
  supportEmail: 'contato@parquedasaguas.org.br',
  supportPhone: '(41) 3333-4444',
  termsPreview: 'Ao utilizar o HOA Connect, você concorda com os Termos de Uso estabelecidos pela associação. O aplicativo é disponibilizado como ferramenta de comunicação e acesso a informações da sua residência.',
  privacyPreview: 'Seus dados são tratados de acordo com a Política de Privacidade da associação. Consulte a seção Privacidade e Dados para mais informações.',
  accessibilityStatement: 'O HOA Connect foi projetado para ser acessível. Oferecemos opções de texto ampliado, contraste aprimorado, redução de animações e compatibilidade com leitores de tela.',
  acknowledgements: 'HOA Connect é um protótipo de demonstração. Créditos de design e desenvolvimento para a equipe do projeto.',
};

const deviceAppInfo: DeviceAppInfo = {
  deviceLabel: 'iPhone 15 — Carlos',
  installationType: 'Aplicativo móvel',
  environment: 'Demonstração',
  appVersion: '2.4.0',
  offlineCapable: true,
  lastLocalUpdate: '17/07/2026, 10:45',
  storageDescription: 'O aplicativo armazena localmente informações da sessão e preferências para funcionamento offline. Dados de demonstração ocupam aproximadamente 2 MB.',
};

// ─── Profile overview builders ─────────────────────────────────────

function buildProfileOverview(scenario: ProfileScenarioKey): ProfileOverview {
  const profile = { ...baseProfile };
  const editableFields = { ...baseEditableFields };
  const protectedFields = baseProtectedFields.map((f) => ({ ...f }));
  const contactInfo = JSON.parse(JSON.stringify(baseContactInfo)) as ContactInfo;
  const linkedResidences = baseLinkedResidences.map((r) => ({ ...r }));
  const invitations: ResidenceInvitation[] = [];
  const appPreferences = baseAppPreferences.map((p) => ({ ...p, value: p.value, options: p.options ? [...p.options] : undefined }));
  const accessibility = baseAccessibilityPreferences.map((a) => ({ ...a }));
  const security = JSON.parse(JSON.stringify(baseSecurityInfo)) as SecurityInfo;

  switch (scenario) {
    case 'incomplete': {
      profile.preferredName = null;
      profile.completenessLabel = 'Perfil incompleto — 3 informações pendentes';
      editableFields.preferredName = '';
      editableFields.displayName = profile.fullName;
      contactInfo.methods[3].verificationState = 'invalid';
      contactInfo.methods[3].verificationLabel = 'Inválido';
      contactInfo.methods[3].isVerified = false;
      break;
    }
    case 'no_preferred_name': {
      profile.preferredName = null;
      profile.completenessLabel = 'Nome de preferência não informado';
      editableFields.preferredName = '';
      break;
    }
    case 'contact_pending': {
      contactInfo.methods[0].verificationState = 'pending';
      contactInfo.methods[0].verificationLabel = 'Pendente';
      contactInfo.methods[0].isVerified = false;
      contactInfo.methods[2].verificationState = 'pending';
      contactInfo.methods[2].verificationLabel = 'Pendente';
      contactInfo.methods[2].isVerified = false;
      profile.completenessLabel = 'Contatos pendentes de verificação';
      break;
    }
    case 'outdated_phone': {
      contactInfo.methods[0].verificationState = 'outdated';
      contactInfo.methods[0].verificationLabel = 'Desatualizado';
      contactInfo.methods[0].isVerified = false;
      contactInfo.methods[0].valueMasked = '(41) 9****-5678';
      profile.completenessLabel = 'Telefone desatualizado';
      break;
    }
    case 'invalid_email': {
      contactInfo.methods[2].verificationState = 'invalid';
      contactInfo.methods[2].verificationLabel = 'Inválido';
      contactInfo.methods[2].isVerified = false;
      profile.completenessLabel = 'E-mail inválido';
      break;
    }
    case 'multi_residence': {
      linkedResidences.push({
        id: 'prop-003',
        nickname: 'Sítio Família',
        address: 'Estrada do Cerne, km 12 — Lote 4A — Campo Largo, PR',
        residentRole: 'representative',
        roleLabel: 'Representante',
        associationName: 'Parque das Águas',
        connectionStatus: 'linked',
        connectionStatusLabel: 'Vinculada',
        isActiveContext: false,
      });
      break;
    }
    case 'pending_invitation': {
      invitations.push({
        id: 'inv-001',
        residenceId: 'prop-004',
        residenceNickname: 'Apto Bloco 7',
        residenceAddress: 'Rua das Nascentes, 500 — Bloco 7, Apto 502',
        inviterName: 'Mariana Oliveira Silva',
        inviterType: 'resident',
        proposedRole: 'dependent',
        proposedRoleLabel: 'Dependente',
        expiresAt: '25/07/2026',
      });
      break;
    }
    case 'access_under_review': {
      linkedResidences[1].connectionStatus = 'under_review';
      linkedResidences[1].connectionStatusLabel = 'Acesso em análise';
      profile.profileStatus = 'under_review';
      profile.profileStatusLabel = 'Em análise';
      break;
    }
    case 'correction_needed': {
      protectedFields[1].correctionRequested = false;
      profile.completenessLabel = 'Dados protegidos precisam de correção';
      break;
    }
    case 'correction_submitted': {
      protectedFields[1].correctionRequested = true;
      protectedFields[1].correctionProtocol = 'COR-2026-0715-001';
      break;
    }
    case 'accessibility_active': {
      accessibility[0].active = true;
      accessibility[1].active = true;
      accessibility[2].active = true;
      accessibility[3].active = true;
      break;
    }
    case 'high_contrast': {
      accessibility[1].active = true;
      accessibility[3].active = true;
      break;
    }
    case 'reduced_motion': {
      accessibility[2].active = true;
      accessibility[7].active = true;
      break;
    }
    case 'trusted_device': {
      break;
    }
    case 'unknown_device': {
      security.sessions.push({
        id: 'sess-004',
        deviceName: 'Windows Desktop — Desconhecido',
        deviceType: 'Computador',
        lastAccess: 'Hoje, 08:12',
        authMethod: 'Senha',
        isCurrent: false,
        isTrusted: false,
        location: 'São Paulo, SP',
      });
      break;
    }
    case 'password_change_error':
    case 'preference_save_error':
    case 'detail_unavailable':
    case 'partial_service_error':
    case 'offline':
    default:
      break;
  }

  return {
    scenario,
    profile,
    editableFields,
    protectedFields,
    contactInfo,
    linkedResidences,
    invitations,
    appPreferences,
    accessibilityPreferences: accessibility,
    securityInfo: security,
    residenceId: 'prop-001',
  };
}

// ─── Getter ────────────────────────────────────────────────────────

export function getProfileOverview(): ProfileOverview {
  return buildProfileOverview(activeProfileScenario);
}

export function getCorrectionTypes(): { value: string; label: string }[] {
  return [
    { value: 'full_name', label: 'Nome completo' },
    { value: 'cpf', label: 'CPF / Documento' },
    { value: 'birth_date', label: 'Data de nascimento' },
    { value: 'resident_role', label: 'Vínculo com a residência' },
    { value: 'residence_relationship', label: 'Relação com a residência' },
    { value: 'registration', label: 'Registro na associação' },
  ];
}

// ─── Simulated actions (session-local mutations) ──────────────────

export function applyProfileEdit(fields: EditableProfileFields): EditableProfileFields {
  const overview = getProfileOverview();
  overview.editableFields = { ...fields };
  if (fields.preferredName) {
    overview.profile.preferredName = fields.preferredName;
  }
  if (fields.displayName) {
    overview.profile.displayName = fields.displayName;
  }
  overview.profile.completenessLabel = 'Perfil atualizado';
  return overview.editableFields;
}

export function applyContactEdit(methodType: string, newValue: string): ContactMethod | null {
  const overview = getProfileOverview();
  const method = overview.contactInfo.methods.find((m) => m.type === methodType);
  if (!method) return null;
  method.value = newValue;
  method.verificationState = 'pending';
  method.verificationLabel = 'Pendente de verificação';
  method.isVerified = false;
  return { ...method };
}

export function applyContactVerification(methodType: string): ContactMethod | null {
  const overview = getProfileOverview();
  const method = overview.contactInfo.methods.find((m) => m.type === methodType);
  if (!method) return null;
  method.verificationState = 'verified';
  method.verificationLabel = 'Verificado';
  method.isVerified = true;
  return { ...method };
}

export function acceptInvitation(invitationId: string): ResidenceInvitation | null {
  const overview = getProfileOverview();
  const idx = overview.invitations.findIndex((i) => i.id === invitationId);
  if (idx === -1) return null;
  const invitation = overview.invitations[idx];
  overview.invitations.splice(idx, 1);
  overview.linkedResidences.push({
    id: invitation.residenceId,
    nickname: invitation.residenceNickname,
    address: invitation.residenceAddress,
    residentRole: invitation.proposedRole,
    roleLabel: invitation.proposedRoleLabel,
    associationName: 'Parque das Águas',
    connectionStatus: 'linked',
    connectionStatusLabel: 'Vinculada',
    isActiveContext: false,
  });
  return invitation;
}

export function declineInvitation(invitationId: string): boolean {
  const overview = getProfileOverview();
  const idx = overview.invitations.findIndex((i) => i.id === invitationId);
  if (idx === -1) return false;
  overview.invitations.splice(idx, 1);
  return true;
}

export function applyAppPreferenceChange(prefId: string, newValue: boolean | string): boolean {
  const overview = getProfileOverview();
  const pref = overview.appPreferences.find((p) => p.id === prefId);
  if (!pref) return false;
  pref.value = newValue;
  return true;
}

export function applyAccessibilityChange(prefId: string, active: boolean): boolean {
  const overview = getProfileOverview();
  const pref = overview.accessibilityPreferences.find((p) => p.id === prefId);
  if (!pref) return false;
  pref.active = active;
  return true;
}

export function simulatePasswordChange(): { success: boolean; message: string } {
  if (activeProfileScenario === 'password_change_error') {
    return { success: false, message: 'Não foi possível alterar a senha. Tente novamente.' };
  }
  return { success: true, message: 'Senha alterada para demonstração.' };
}

export function removeTrustedDevice(sessionId: string): boolean {
  const overview = getProfileOverview();
  const idx = overview.securityInfo.sessions.findIndex((s) => s.id === sessionId);
  if (idx === -1 || overview.securityInfo.sessions[idx].isCurrent) return false;
  overview.securityInfo.sessions.splice(idx, 1);
  return true;
}

export function simulateSignOut(type: SignOutType): SignOutResult {
  const timestamp = new Date().toISOString();
  return {
    type,
    timestamp,
    message: type === 'current_device'
      ? 'Você saiu da conta neste dispositivo.'
      : 'Você saiu de todos os dispositivos.',
    returnPath: '/welcome',
  };
}

export function submitCorrectionRequest(form: CorrectionRequestForm): CorrectionConfirmation {
  const overview = getProfileOverview();
  const field = overview.protectedFields.find((f) => f.key === form.affectedField);
  const protocol = `COR-2026-0717-${String(Math.floor(Math.random() * 900) + 100)}`;

  if (field) {
    field.correctionRequested = true;
    field.correctionProtocol = protocol;
  }

  const newRequestForm: NewRequestFormData = {
    category: 'registration_update',
    relatedEntity: { type: 'residence', id: overview.residenceId, label: overview.linkedResidences.find((r) => r.isActiveContext)?.nickname || '' },
    subject: `Correção de ${form.affectedFieldLabel}`,
    description: `Valor atual: ${form.currentValue}\nValor solicitado: ${form.requestedValue}\nMotivo: ${form.reason}`,
    occurrenceDate: '',
    contactChannel: 'email',
    preferredTime: '',
    attachments: form.attachmentName
      ? [{ id: `att-cor-${Date.now()}`, name: form.attachmentName, type: 'document', size: '128 KB', isDemo: true }]
      : [],
    residenceId: overview.residenceId,
  };

  const submission = submitNewRequest(newRequestForm);

  return {
    protocol,
    submittedDate: new Date().toLocaleDateString('pt-BR'),
    expectedStep: 'A associação analisará sua solicitação em até 5 dias úteis.',
    requestId: submission.requestId,
  };
}

export function setActiveResidence(residenceId: string): boolean {
  const overview = getProfileOverview();
  const found = overview.linkedResidences.find((r) => r.id === residenceId);
  if (!found || found.connectionStatus === 'inactive' || found.connectionStatus === 'removed') return false;
  overview.linkedResidences.forEach((r) => { r.isActiveContext = r.id === residenceId; });
  overview.residenceId = residenceId;
  return true;
}

// ─── Static exports ────────────────────────────────────────────────

export { privacySections, privacyDataCategories, aboutInfo, deviceAppInfo };