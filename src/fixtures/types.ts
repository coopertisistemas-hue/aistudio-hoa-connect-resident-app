import type { ScenarioKey } from '@/fixtures/scenarios';

export interface HomeOverview {
  scenario: ScenarioKey;
  primaryStatus: PrimaryStatus;
  consumptionPreview: ConsumptionPreviewData;
  noticePreview: NoticePreviewData;
  supportPreview: SupportPreviewData | null;
  recentActivity: ActivityItem[];
}

export interface PrimaryStatus {
  type: 'invoice_pending' | 'invoice_due_soon' | 'invoice_overdue' | 'invoice_under_review' | 'no_pending' | 'service_unavailable';
  title: string;
  message: string;
  invoiceAmount?: string;
  dueDate?: string;
  dueDays?: number;
  reference?: string;
  statusBadge: { label: string; variant: 'success' | 'warning' | 'error' | 'info' | 'neutral' };
  primaryAction: { label: string; path: string };
  secondaryAction?: { label: string; path: string };
}

export interface ConsumptionPreviewData {
  available: boolean;
  month?: string;
  consumption?: number;
  unit?: string;
  previousConsumption?: number;
  variationPercent?: number;
  trend?: 'up' | 'down' | 'stable';
  averageDaily?: number;
  history?: { month: string; consumption: number }[];
  readingDate?: string;
  nextReadingEstimate?: string;
  maxConsumption?: number;
}

export interface NoticePreviewData {
  id: string;
  title: string;
  summary: string;
  date: string;
  type: 'maintenance' | 'meeting' | 'info' | 'billing' | 'general' | 'urgent';
  priority: 'high' | 'normal' | 'low';
  isNew: boolean;
  category: string;
  fullContent?: string;
}

export interface SupportPreviewData {
  protocol: string;
  category: string;
  status: 'open' | 'in_progress' | 'waiting' | 'resolved';
  statusLabel: string;
  lastUpdate: string;
  description: string;
}

export interface ActivityItem {
  id: string;
  type: 'invoice_issued' | 'payment_received' | 'reading_recorded' | 'notice_published' | 'ticket_updated';
  label: string;
  description: string;
  date: string;
  icon: string;
}

export interface ResidenceContext {
  id: string;
  nickname: string;
  address: string;
  shortAddress: string;
  unit: string;
  block?: string;
  status: 'active' | 'inactive';
  isPrimary: boolean;
}

export interface ResidenceDetail {
  id: string;
  nickname: string;
  fullAddress: string;
  unit: string;
  block?: string;
  type: string;
  bedrooms: number;
  residentsCount: number;
  occupancy: string;
  status: string;
  registrationNumber: string;
  associationName: string;
  associationShortName: string;
}

export interface WaterServiceInfo {
  meterId: string;
  meterLabel: string;
  installationLocation: string;
  serviceStatus: 'active' | 'interrupted' | 'under_review';
  serviceStatusLabel: string;
  lastReadingDate: string;
  lastReadingValue: number;
  nextReadingWindow: string;
  unit: string;
}

export interface LinkedResident {
  id: string;
  name: string;
  firstName: string;
  relationship: 'holder' | 'authorized' | 'dependent' | 'pending';
  relationshipLabel: string;
  initials: string;
  status: 'active' | 'pending';
}

export interface ContactPreferences {
  invoiceDelivery: string;
  noticeChannel: string;
  primaryPhone: string;
  maskedEmail: string;
  preferredContact: string;
  communicationLanguage: string;
}

export interface AssociationInfo {
  name: string;
  shortName: string;
  address: string;
  phone: string;
  email: string;
  businessHours: string;
  businessDays: string;
  waterUtility: string;
}

export interface DocumentPreview {
  id: string;
  title: string;
  type: string;
  description: string;
  date: string;
  isDemo: boolean;
}

// ─── Consumption Module Types ────────────────────────────────────────

export type ConsumptionScenarioKey =
  | 'normal'
  | 'below_usual'
  | 'gradual_increase'
  | 'unusual_peak'
  | 'no_reading'
  | 'estimated_reading'
  | 'under_review'
  | 'inconsistency'
  | 'replaced_meter'
  | 'no_history'
  | 'partial_error';

export type ConsumptionClassification =
  | 'dentro_do_esperado'
  | 'abaixo_do_habitual'
  | 'acima_do_habitual'
  | 'atencao_recomendada'
  | 'leitura_indisponivel'
  | 'dados_em_revisao';

export interface CurrentPeriodSummary {
  referencePeriod: string;
  readingDate: string;
  consumption: number;
  unit: string;
  previousPeriod: string;
  previousConsumption: number;
  comparisonLabel: string;
  usualRange: { min: number; max: number };
  interpretation: string;
  classification: ConsumptionClassification;
  classificationLabel: string;
}

export interface MeterReadingContext {
  meterId: string;
  meterLabel: string;
  installationLocation: string;
  latestReading: number;
  previousReading: number;
  readingDate: string;
  readingMethod: string;
  nextReadingWindow: string;
  status: string;
  statusLabel: string;
}

export interface HistoricalDataPoint {
  id: string;
  period: string;
  consumption: number;
  readingDate: string;
  readingValue: number;
  previousReadingValue: number;
  status: 'registered' | 'estimated' | 'revised' | 'pending' | 'not_performed' | 'under_review';
  statusLabel: string;
  readingOrigin: string;
  comparison?: string;
  note?: string;
  revisionHistory?: RevisionEntry[];
}

export interface RevisionEntry {
  date: string;
  type: string;
  description: string;
}

export interface ConsumptionInsight {
  id: string;
  title: string;
  description: string;
  recommendation?: string;
  action?: { label: string; path?: string };
}

export interface ConsumptionAlert {
  id: string;
  severity: 'info' | 'warning' | 'attention';
  severityLabel: string;
  title: string;
  description: string;
  date: string;
  referencePeriod: string;
  recommendedAction: string;
  contactAction: boolean;
}

export interface EducationCard {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface ConsumptionOverview {
  scenario: ConsumptionScenarioKey;
  currentPeriod: CurrentPeriodSummary | null;
  meterReading: MeterReadingContext | null;
  historicalData: HistoricalDataPoint[];
  insights: ConsumptionInsight[];
  alerts: ConsumptionAlert[];
  educationCards: EducationCard[];
}

export type DivergenceReason =
  | 'nao_reconheco_consumo'
  | 'leitura_diferente'
  | 'hidrometro_sem_acesso'
  | 'imovel_desocupado'
  | 'possivel_problema_hidrometro'
  | 'outro';

export interface DivergenceReasonOption {
  value: DivergenceReason;
  label: string;
  description: string;
}

export interface DivergenceReport {
  readingId: string;
  period: string;
  readingDate: string;
  reason: DivergenceReason;
  reasonLabel: string;
  description?: string;
  attachmentName?: string;
}

export interface DivergenceConfirmation {
  protocol: string;
  submittedDate: string;
  expectedStep: string;
}

// ─── Financial Module Types ────────────────────────────────────────

export type FinanceScenarioKey =
  | 'all_paid'
  | 'due_soon'
  | 'single_overdue'
  | 'multiple_overdue'
  | 'payment_processing'
  | 'payment_unidentified'
  | 'under_review'
  | 'replaced'
  | 'canceled'
  | 'no_invoices'
  | 'boleto_unavailable'
  | 'pix_unavailable'
  | 'document_error'
  | 'partial_list_error'
  | 'offline';

export type InvoiceStatus =
  | 'open'
  | 'due_soon'
  | 'overdue'
  | 'paid'
  | 'processing'
  | 'unidentified'
  | 'canceled'
  | 'under_review'
  | 'replaced';

export type AccountStatus =
  | 'tudo_em_dia'
  | 'vencimento_proximo'
  | 'pendente_identificacao'
  | 'fatura_vencida'
  | 'dados_em_revisao'
  | 'nenhuma_fatura'
  | 'servico_indisponivel';

export interface InvoiceLineItem {
  description: string;
  amount: number;
  formattedAmount: string;
  type: 'water' | 'maintenance' | 'reserve' | 'adjustment' | 'discount' | 'interest' | 'fine' | 'other';
}

export interface InvoiceData {
  id: string;
  documentNumber: string;
  reference: string;
  referencePeriod: string;
  residenceId: string;
  residenceNickname: string;
  associationName: string;
  dueDate: string;
  issuedDate: string;
  amount: number;
  formattedAmount: string;
  paidAmount?: number;
  paidAmountFormatted?: string;
  status: InvoiceStatus;
  statusLabel: string;
  statusExplanation: string;
  paymentDate?: string;
  paymentMethod?: string;
  lineItems: InvoiceLineItem[];
  hasBoleto: boolean;
  hasPix: boolean;
  isReplaced: boolean;
  replacedById?: string;
  replacesId?: string;
  isEligibleForSecondCopy: boolean;
  secondCopyNote?: string;
}

export interface BoletoInfo {
  invoiceId: string;
  dueDate: string;
  amount: number;
  formattedAmount: string;
  payerName: string;
  payerDocument: string;
  beneficiaryName: string;
  beneficiaryDocument: string;
  digitableLine: string;
  bankName: string;
  bankCode: string;
  documentAvailable: boolean;
  documentStatus: 'available' | 'expired' | 'generating' | 'unavailable' | 'replaced' | 'already_paid';
  documentStatusLabel: string;
}

export interface PixInfo {
  invoiceId: string;
  pixCode: string;
  amount: number;
  formattedAmount: string;
  beneficiaryName: string;
  beneficiaryKey: string;
  expiresAt: string;
  available: boolean;
  unavailableReason?: string;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  reference: string;
  referencePeriod: string;
  residenceId: string;
  residenceNickname: string;
  amount: number;
  formattedAmount: string;
  paymentDate: string;
  identificationDate: string;
  paymentMethod: string;
  status: PaymentStatus;
  statusLabel: string;
  receiptReference: string;
  hasReceipt: boolean;
}

export type PaymentStatus = 'identified' | 'processing' | 'refunded' | 'under_review' | 'not_reconciled';

export interface ReceiptData {
  paymentId: string;
  receiptReference: string;
  associationName: string;
  residentName: string;
  residenceNickname: string;
  invoiceReference: string;
  amountPaid: number;
  formattedAmountPaid: string;
  paymentDate: string;
  identificationDate: string;
  paymentMethod: string;
  paymentStatus: string;
  validationNote: string;
  isDemo: boolean;
}

export interface FinancialOverview {
  scenario: FinanceScenarioKey;
  accountStatus: AccountStatus;
  accountStatusLabel: string;
  accountStatusMessage: string;
  nextDueInvoice: InvoiceData | null;
  overdueAmount: number | null;
  overdueFormattedAmount: string | null;
  paidThisYear: number;
  paidThisYearFormatted: string;
  invoices: InvoiceData[];
  payments: PaymentRecord[];
  residenceId: string;
}

export type UnrecognizedReason =
  | 'ja_paguei_mas_consta_pendente'
  | 'paguei_valor_diferente'
  | 'paguei_apos_vencimento'
  | 'comprovante_nao_reconhecido'
  | 'outro';

export interface UnrecognizedReasonOption {
  value: UnrecognizedReason;
  label: string;
  description: string;
}

export interface UnrecognizedReport {
  invoiceId: string;
  invoiceReference: string;
  paymentDate: string;
  paymentMethod: string;
  transactionReference?: string;
  reason: UnrecognizedReason;
  reasonLabel: string;
  description?: string;
  attachmentName?: string;
}

export interface UnrecognizedConfirmation {
  protocol: string;
  submittedDate: string;
  expectedStep: string;
}

// ─── Notification & Communication Module Types ────────────────────────────────────────

export type NotificationScenarioKey =
  | 'no_unread'
  | 'one_unread'
  | 'many_unread'
  | 'invoice_notification'
  | 'payment_identified'
  | 'payment_processing'
  | 'reading_recorded'
  | 'unusual_consumption'
  | 'support_update'
  | 'important_notice'
  | 'urgent_maintenance'
  | 'multi_residence'
  | 'no_notices'
  | 'archived_only'
  | 'partial_error'
  | 'detail_unavailable'
  | 'preferences_error'
  | 'offline';

export type NotificationCategory =
  | 'invoice'
  | 'payment'
  | 'consumption'
  | 'support'
  | 'notice'
  | 'profile'
  | 'document';

export type NotificationPriority =
  | 'info'
  | 'important'
  | 'urgent';

export interface NotificationDestination {
  type: 'invoice_detail' | 'payment_history' | 'consumption_detail' | 'reading_detail' | 'notice_detail' | 'support_detail' | 'residence_info' | 'receipt' | 'preview';
  path: string;
  label: string;
}

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  categoryLabel: string;
  categoryIcon: string;
  title: string;
  description: string;
  dateTime: string;
  timestamp: number;
  unread: boolean;
  relatedResidenceId: string | null;
  relatedResidenceNickname: string | null;
  priority: NotificationPriority;
  priorityLabel: string;
  destination: NotificationDestination;
  relatedId?: string;
}

export type NotificationGroupKey = 'today' | 'yesterday' | 'last_7_days' | 'older';

export interface NotificationGroup {
  key: NotificationGroupKey;
  label: string;
  items: NotificationItem[];
}

export type NotificationFilterKey =
  | 'all'
  | 'unread'
  | 'invoice'
  | 'payment'
  | 'consumption'
  | 'support'
  | 'notice';

export interface NotificationFilterOption {
  key: NotificationFilterKey;
  label: string;
}

export type NoticeCategory =
  | 'maintenance'
  | 'interruption'
  | 'general'
  | 'meeting'
  | 'billing'
  | 'water'
  | 'emergency';

export type NoticeAudience =
  | 'all_residences'
  | 'specific_residence'
  | 'multiple_residences';

export type NoticeAttachmentType =
  | 'comunicado'
  | 'calendario'
  | 'regulamento'
  | 'orientacao'
  | 'meeting_document';

export interface NoticeAttachment {
  id: string;
  type: NoticeAttachmentType;
  label: string;
  description: string;
  isDemo: boolean;
}

export interface NoticeItem {
  id: string;
  category: NoticeCategory;
  categoryLabel: string;
  categoryIcon: string;
  title: string;
  summary: string;
  content: string;
  publishedDate: string;
  validityEnd?: string;
  priority: NotificationPriority;
  priorityLabel: string;
  read: boolean;
  audience: NoticeAudience;
  audienceLabel: string;
  relatedResidenceIds: string[];
  relatedResidenceLabels: string[];
  associationName: string;
  attachments: NoticeAttachment[];
  contactPhone?: string;
  contactEmail?: string;
}

export type NoticeFilterKey =
  | 'all'
  | 'important'
  | 'maintenance'
  | 'interruption'
  | 'community'
  | 'financial'
  | 'archived';

export interface NoticeFilterOption {
  key: NoticeFilterKey;
  label: string;
}

export type CommunicationChannel = 'in_app' | 'email' | 'whatsapp' | 'sms';

export interface CommunicationChannelOption {
  channel: CommunicationChannel;
  label: string;
  description: string;
  available: boolean;
}

export interface CommunicationPreference {
  id: string;
  category: NotificationCategory | 'maintenance_notice';
  categoryLabel: string;
  description: string;
  enabled: boolean;
  mandatory: boolean;
  mandatoryExplanation?: string;
  channels: CommunicationChannel[];
  availableChannels: CommunicationChannelOption[];
}

export interface NotificationOverview {
  scenario: NotificationScenarioKey;
  unreadCount: number;
  notifications: NotificationItem[];
  notices: NoticeItem[];
  preferences: CommunicationPreference[];
  residenceId: string;
}

export interface SimulatedNotificationEvent {
  id: string;
  category: NotificationCategory;
  title: string;
  description: string;
  timestamp: number;
}

// ─── Support Module Types ────────────────────────────────────────

export type SupportScenarioKey =
  | 'no_requests'
  | 'one_open'
  | 'several_open'
  | 'awaiting_resident'
  | 'awaiting_association'
  | 'in_triage'
  | 'in_analysis'
  | 'visit_proposed'
  | 'visit_confirmed'
  | 'resolved'
  | 'recently_closed'
  | 'eligible_reopen'
  | 'canceled'
  | 'unread_message'
  | 'attachment_unavailable'
  | 'message_error'
  | 'submit_error'
  | 'partial_list_error'
  | 'detail_unavailable'
  | 'multi_residence'
  | 'offline';

export type SupportRequestCategory =
  | 'consumption_or_reading'
  | 'invoice_or_payment'
  | 'meter'
  | 'leak_or_possible_issue'
  | 'supply_interruption'
  | 'registration_update'
  | 'document'
  | 'suggestion'
  | 'complaint'
  | 'other';

export interface SupportCategoryOption {
  value: SupportRequestCategory;
  label: string;
  icon: string;
  description: string;
}

export type SupportRequestStatus =
  | 'draft'
  | 'submitted'
  | 'received'
  | 'in_triage'
  | 'in_analysis'
  | 'awaiting_resident'
  | 'awaiting_association'
  | 'visit_scheduled'
  | 'resolved'
  | 'closed'
  | 'canceled'
  | 'reopened';

export type SupportRequestPriority = 'normal' | 'important' | 'urgent';

export interface RelatedEntity {
  type: 'invoice' | 'payment' | 'reading' | 'notice' | 'residence' | 'existing_request' | 'none';
  id: string;
  label: string;
  path?: string;
}

export interface SupportAttachment {
  id: string;
  name: string;
  type: 'photo' | 'receipt' | 'document' | 'meter_image' | 'other';
  size: string;
  isDemo: boolean;
}

export interface TimelineEvent {
  id: string;
  dateTime: string;
  actorType: 'resident' | 'association' | 'system';
  actorName: string;
  title: string;
  description: string;
  statusChange?: SupportRequestStatus;
  statusChangeLabel?: string;
  attachment?: SupportAttachment;
}

export interface SupportMessage {
  id: string;
  dateTime: string;
  senderType: 'resident' | 'association' | 'system';
  senderName: string;
  content: string;
  unread: boolean;
  attachment?: SupportAttachment;
  requiresReply: boolean;
}

export interface VisitProposal {
  proposedDate: string;
  timeWindow: string;
  address: string;
  purpose: string;
  preparationInstructions: string;
  contactPerson: string;
  contactPhone: string;
  confirmed: boolean;
  confirmable: boolean;
}

export interface SupportRequest {
  id: string;
  protocol: string;
  category: SupportRequestCategory;
  categoryLabel: string;
  status: SupportRequestStatus;
  statusLabel: string;
  statusExplanation: string;
  priority: SupportRequestPriority;
  priorityLabel: string;
  subject: string;
  description: string;
  residenceId: string;
  residenceNickname: string;
  associationName: string;
  relatedEntity: RelatedEntity;
  attachments: SupportAttachment[];
  contactChannel: string;
  preferredTime?: string;
  occurrenceDate?: string;
  createdAt: string;
  updatedAt: string;
  responsibleArea: string;
  expectedNextStep: string;
  timeline: TimelineEvent[];
  messages: SupportMessage[];
  visitProposal: VisitProposal | null;
  hasUnreadMessages: boolean;
  eligibleActions: SupportEligibleAction[];
  rating?: SupportRating;
}

export interface SupportEligibleAction {
  type: 'reply' | 'add_info' | 'attach' | 'confirm_visit' | 'request_another_time' | 'cancel_visit' | 'cancel_request' | 'close_request' | 'reopen_request' | 'rate' | 'view_invoice' | 'view_reading' | 'view_notice' | 'view_receipt';
  label: string;
  icon: string;
}

export interface SupportRating {
  score: number;
  comment?: string;
  submittedDate: string;
}

export interface SupportOverview {
  scenario: SupportScenarioKey;
  hasActiveRequests: boolean;
  openCount: number;
  awaitingResidentCount: number;
  recentlyUpdatedCount: number;
  statusMessage: string;
  statusType: 'no_requests' | 'all_ok' | 'attention' | 'action_needed';
  requests: SupportRequest[];
  residenceId: string;
}

export interface AssociationContactChannel {
  type: 'phone' | 'whatsapp' | 'email' | 'in_person' | 'emergency';
  label: string;
  value: string;
  description: string;
  available: boolean;
  icon: string;
}

export interface AssociationContactInfo {
  businessHours: string;
  businessDays: string;
  address: string;
  channels: AssociationContactChannel[];
  emergencyGuidance: string;
}

export type FAQCategory =
  | 'consumption'
  | 'invoices'
  | 'meter'
  | 'supply'
  | 'registration'
  | 'support';

export interface FAQCategoryOption {
  value: FAQCategory;
  label: string;
  icon: string;
}

export interface FAQItem {
  id: string;
  category: FAQCategory;
  question: string;
  answer: string;
}

export interface NewRequestFormData {
  category: SupportRequestCategory | null;
  relatedEntity: RelatedEntity;
  subject: string;
  description: string;
  occurrenceDate: string;
  contactChannel: string;
  preferredTime: string;
  attachments: SupportAttachment[];
  residenceId: string;
}

export interface RequestSubmissionResult {
  protocol: string;
  submittedDate: string;
  categoryLabel: string;
  expectedStep: string;
  requestId: string;
}

export type NewRequestStep = 'category' | 'context' | 'description' | 'attachments' | 'review' | 'confirmation';

// ─── Profile Module Types ────────────────────────────────────────

export type ProfileScenarioKey =
  | 'complete'
  | 'incomplete'
  | 'no_preferred_name'
  | 'contact_pending'
  | 'outdated_phone'
  | 'invalid_email'
  | 'multi_residence'
  | 'pending_invitation'
  | 'access_under_review'
  | 'correction_needed'
  | 'correction_submitted'
  | 'accessibility_active'
  | 'high_contrast'
  | 'reduced_motion'
  | 'trusted_device'
  | 'unknown_device'
  | 'password_change_error'
  | 'preference_save_error'
  | 'detail_unavailable'
  | 'partial_service_error'
  | 'offline';

export type ResidentRole =
  | 'holder'
  | 'financial_responsible'
  | 'authorized_resident'
  | 'dependent'
  | 'representative'
  | 'temporary_guest';

export interface ResidentRoleOption {
  value: ResidentRole;
  label: string;
  description?: string;
}

export interface ResidentProfile {
  id: string;
  fullName: string;
  preferredName: string | null;
  displayName: string | null;
  cpf: string;
  cpfMasked: string;
  birthDate: string;
  role: ResidentRole;
  roleLabel: string;
  registrationRef: string;
  registrationDate: string;
  profileStatus: 'active' | 'inactive' | 'under_review';
  profileStatusLabel: string;
  initials: string;
  pronounPreference: string | null;
  photoUrl: string | null;
  completenessLabel: string;
  associationName: string;
}

export interface EditableProfileFields {
  preferredName: string;
  displayName: string;
  pronounPreference: string;
}

export interface ProtectedProfileField {
  key: string;
  label: string;
  value: string;
  explanation: string;
  correctionRequested: boolean;
  correctionProtocol?: string;
}

export type ContactVerificationState =
  | 'verified'
  | 'pending'
  | 'outdated'
  | 'invalid'
  | 'unavailable';

export interface ContactMethod {
  type: 'phone' | 'whatsapp' | 'primary_email' | 'secondary_email';
  label: string;
  value: string;
  valueMasked: string;
  isVerified: boolean;
  verificationState: ContactVerificationState;
  verificationLabel: string;
  editable: boolean;
}

export interface ContactInfo {
  methods: ContactMethod[];
  preferredChannel: string;
}

export interface LinkedResidenceItem {
  id: string;
  nickname: string;
  address: string;
  residentRole: ResidentRole;
  roleLabel: string;
  associationName: string;
  connectionStatus: 'active' | 'linked' | 'pending_invitation' | 'under_review' | 'inactive' | 'removed';
  connectionStatusLabel: string;
  isActiveContext: boolean;
}

export interface ResidenceInvitation {
  id: string;
  residenceId: string;
  residenceNickname: string;
  residenceAddress: string;
  inviterName: string;
  inviterType: 'resident' | 'association';
  proposedRole: ResidentRole;
  proposedRoleLabel: string;
  expiresAt: string;
}

export type CorrectionType =
  | 'full_name'
  | 'cpf'
  | 'birth_date'
  | 'resident_role'
  | 'residence_relationship'
  | 'registration';

export interface CorrectionRequestForm {
  affectedField: CorrectionType;
  affectedFieldLabel: string;
  currentValue: string;
  requestedValue: string;
  reason: string;
  attachmentName?: string;
}

export interface CorrectionConfirmation {
  protocol: string;
  submittedDate: string;
  expectedStep: string;
  requestId: string;
}

export interface AppPreference {
  id: string;
  label: string;
  description: string;
  type: 'toggle' | 'select' | 'preview';
  value: boolean | string;
  options?: { value: string; label: string; available: boolean }[];
  editable: boolean;
  editableExplanation?: string;
}

export type AppPreferenceCategory =
  | 'initial_screen'
  | 'default_residence'
  | 'list_density'
  | 'show_values_home'
  | 'residence_change_confirmation'
  | 'session_lock'
  | 'language'
  | 'date_format';

export interface AccessibilityPreference {
  id: string;
  label: string;
  description: string;
  type: 'toggle';
  active: boolean;
  previewNote?: string;
}

export interface SimulatedSession {
  id: string;
  deviceName: string;
  deviceType: string;
  lastAccess: string;
  authMethod: string;
  isCurrent: boolean;
  isTrusted: boolean;
  location: string;
}

export interface SecurityInfo {
  sessions: SimulatedSession[];
  sessionLockEnabled: boolean;
  sessionLockTimeout: string;
  recoveryEmail: string;
  recoveryEmailMasked: string;
  lastPasswordChange: string;
  twoFactorAvailable: boolean;
}

export type SignOutType = 'current_device' | 'all_devices';

export interface SignOutResult {
  type: SignOutType;
  timestamp: string;
  message: string;
  returnPath: string;
}

export interface PrivacySection {
  id: string;
  title: string;
  content: string;
  icon: string;
}

export interface PrivacyDataCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  dataTypes: string[];
  retentionLabel: string;
}

export interface AboutInfo {
  appName: string;
  appPurpose: string;
  associationName: string;
  appVersion: string;
  environment: string;
  lastUpdateDate: string;
  supportEmail: string;
  supportPhone: string;
  termsPreview: string;
  privacyPreview: string;
  accessibilityStatement: string;
  acknowledgements: string;
}

export interface DeviceAppInfo {
  deviceLabel: string;
  installationType: string;
  environment: string;
  appVersion: string;
  offlineCapable: boolean;
  lastLocalUpdate: string;
  storageDescription: string;
}

export interface ProfileOverview {
  scenario: ProfileScenarioKey;
  profile: ResidentProfile;
  editableFields: EditableProfileFields;
  protectedFields: ProtectedProfileField[];
  contactInfo: ContactInfo;
  linkedResidences: LinkedResidenceItem[];
  invitations: ResidenceInvitation[];
  appPreferences: AppPreference[];
  accessibilityPreferences: AccessibilityPreference[];
  securityInfo: SecurityInfo;
  residenceId: string;
}