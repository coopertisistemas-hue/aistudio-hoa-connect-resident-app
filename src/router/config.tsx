import type { RouteObject } from "react-router-dom";
import { lazy, Suspense } from "react";
import LoadingState from "@/components/base/LoadingState";

const NotFound = lazy(() => import("@/pages/NotFound"));
const SplashPage = lazy(() => import("@/pages/splash/page"));
const WelcomePage = lazy(() => import("@/pages/welcome/page"));
const LoginPage = lazy(() => import("@/pages/login/page"));
const PasswordRecoveryPage = lazy(() => import("@/pages/password-recovery/page"));
const FirstAccessPage = lazy(() => import("@/pages/first-access/page"));
const AccessSuccessPage = lazy(() => import("@/pages/access-success/page"));
const HomePage = lazy(() => import("@/pages/home/page"));
const ConsumoPage = lazy(() => import("@/pages/consumo/page"));
const LeiturasPage = lazy(() => import("@/pages/consumo/leituras/page"));
const LeituraDetailPage = lazy(() => import("@/pages/consumo/leituras/DetailPage"));
const FaturasPage = lazy(() => import("@/pages/faturas/page"));
const InvoiceDetailPage = lazy(() => import("@/pages/faturas/InvoiceDetailPage"));
const PaymentDocumentPage = lazy(() => import("@/pages/faturas/PaymentDocumentPage"));
const PagamentosPage = lazy(() => import("@/pages/pagamentos/page"));
const ReceiptPage = lazy(() => import("@/pages/pagamentos/ReceiptPage"));
const AtendimentoPage = lazy(() => import("@/pages/atendimento/page"));
const SolicitacoesPage = lazy(() => import("@/pages/atendimento/solicitacoes/page"));
const RequestDetailPage = lazy(() => import("@/pages/atendimento/solicitacoes/DetailPage"));
const NovoAtendimentoPage = lazy(() => import("@/pages/atendimento/NovoPage"));
const DuvidasPage = lazy(() => import("@/pages/atendimento/duvidas/page"));
const PerfilPage = lazy(() => import("@/pages/perfil/page"));
const DadosPessoaisPage = lazy(() => import("@/pages/perfil/dados-pessoais/page"));
const DadosPessoaisEditPage = lazy(() => import("@/pages/perfil/dados-pessoais/EditPage"));
const CorrecaoPage = lazy(() => import("@/pages/perfil/dados-pessoais/CorrecaoPage"));
const ContatosPage = lazy(() => import("@/pages/perfil/contatos/page"));
const ResidenciasPage = lazy(() => import("@/pages/perfil/residencias/page"));
const PreferenciasAppPage = lazy(() => import("@/pages/perfil/preferencias/page"));
const AcessibilidadePage = lazy(() => import("@/pages/perfil/acessibilidade/page"));
const PrivacidadePage = lazy(() => import("@/pages/perfil/privacidade/page"));
const SegurancaPage = lazy(() => import("@/pages/perfil/seguranca/page"));
const SobrePage = lazy(() => import("@/pages/perfil/sobre/page"));
const AssociacaoPage = lazy(() => import("@/pages/perfil/associacao/page"));
const MinhaResidenciaPage = lazy(() => import("@/pages/minha-residencia/page"));
const AvisoPage = lazy(() => import("@/pages/aviso/page"));
const AvisosPage = lazy(() => import("@/pages/avisos/page"));
const NoticeDetailPage = lazy(() => import("@/pages/avisos/NoticeDetailPage"));
const NotificacoesPage = lazy(() => import("@/pages/notificacoes/page"));
const NotificationDetailPage = lazy(() => import("@/pages/notificacoes/NotificationDetailPage"));
const PreferenciasPage = lazy(() => import("@/pages/notificacoes/PreferenciasPage"));
const AtividadePage = lazy(() => import("@/pages/atividade/page"));
// Admin Finance Pages (EPF-01)
const AdminFinancePage = lazy(() => import("@/pages/admin/finance/page"));
const AdminBillingCyclesPage = lazy(() => import("@/pages/admin/finance/BillingCyclesPage"));
const AdminInvoicesPage = lazy(() => import("@/pages/admin/finance/InvoicesPage"));
const AdminInvoiceDetailPage = lazy(() => import("@/pages/admin/finance/InvoiceDetailPage"));
const AdminPaymentsPage = lazy(() => import("@/pages/admin/finance/PaymentsPage"));
const AdminPaymentDetailPage = lazy(() => import("@/pages/admin/finance/PaymentDetailPage"));
const AdminReportsPage = lazy(() => import("@/pages/admin/finance/ReportsPage"));
const AdminAuditLogPage = lazy(() => import("@/pages/admin/finance/AuditLogPage"));

const loadingFallback = <div className="flex items-center justify-center min-h-screen bg-background-50"><LoadingState /></div>;

const routes: RouteObject[] = [
  { path: "/", element: <Suspense fallback={loadingFallback}><SplashPage /></Suspense> },
  { path: "/splash", element: <Suspense fallback={loadingFallback}><SplashPage /></Suspense> },
  { path: "/welcome", element: <Suspense fallback={loadingFallback}><WelcomePage /></Suspense> },
  { path: "/login", element: <Suspense fallback={loadingFallback}><LoginPage /></Suspense> },
  { path: "/password-recovery", element: <Suspense fallback={loadingFallback}><PasswordRecoveryPage /></Suspense> },
  { path: "/first-access", element: <Suspense fallback={loadingFallback}><FirstAccessPage /></Suspense> },
  { path: "/access-success", element: <Suspense fallback={loadingFallback}><AccessSuccessPage /></Suspense> },
  { path: "/inicio", element: <Suspense fallback={loadingFallback}><HomePage /></Suspense> },
  { path: "/consumo", element: <Suspense fallback={loadingFallback}><ConsumoPage /></Suspense> },
  { path: "/consumo/leituras", element: <Suspense fallback={loadingFallback}><LeiturasPage /></Suspense> },
  { path: "/consumo/leituras/:readingId", element: <Suspense fallback={loadingFallback}><LeituraDetailPage /></Suspense> },
  { path: "/faturas", element: <Suspense fallback={loadingFallback}><FaturasPage /></Suspense> },
  { path: "/faturas/:invoiceId", element: <Suspense fallback={loadingFallback}><InvoiceDetailPage /></Suspense> },
  { path: "/faturas/:invoiceId/pagamento", element: <Suspense fallback={loadingFallback}><PaymentDocumentPage /></Suspense> },
  { path: "/pagamentos", element: <Suspense fallback={loadingFallback}><PagamentosPage /></Suspense> },
  { path: "/pagamentos/:paymentId/comprovante", element: <Suspense fallback={loadingFallback}><ReceiptPage /></Suspense> },
  { path: "/atendimento", element: <Suspense fallback={loadingFallback}><AtendimentoPage /></Suspense> },
  { path: "/atendimento/solicitacoes", element: <Suspense fallback={loadingFallback}><SolicitacoesPage /></Suspense> },
  { path: "/atendimento/solicitacoes/:requestId", element: <Suspense fallback={loadingFallback}><RequestDetailPage /></Suspense> },
  { path: "/atendimento/novo", element: <Suspense fallback={loadingFallback}><NovoAtendimentoPage /></Suspense> },
  { path: "/atendimento/duvidas", element: <Suspense fallback={loadingFallback}><DuvidasPage /></Suspense> },
  { path: "/perfil", element: <Suspense fallback={loadingFallback}><PerfilPage /></Suspense> },
  { path: "/perfil/dados-pessoais", element: <Suspense fallback={loadingFallback}><DadosPessoaisPage /></Suspense> },
  { path: "/perfil/dados-pessoais/editar", element: <Suspense fallback={loadingFallback}><DadosPessoaisEditPage /></Suspense> },
  { path: "/perfil/dados-pessoais/correcao", element: <Suspense fallback={loadingFallback}><CorrecaoPage /></Suspense> },
  { path: "/perfil/contatos", element: <Suspense fallback={loadingFallback}><ContatosPage /></Suspense> },
  { path: "/perfil/residencias", element: <Suspense fallback={loadingFallback}><ResidenciasPage /></Suspense> },
  { path: "/perfil/preferencias", element: <Suspense fallback={loadingFallback}><PreferenciasAppPage /></Suspense> },
  { path: "/perfil/acessibilidade", element: <Suspense fallback={loadingFallback}><AcessibilidadePage /></Suspense> },
  { path: "/perfil/privacidade", element: <Suspense fallback={loadingFallback}><PrivacidadePage /></Suspense> },
  { path: "/perfil/seguranca", element: <Suspense fallback={loadingFallback}><SegurancaPage /></Suspense> },
  { path: "/perfil/sobre", element: <Suspense fallback={loadingFallback}><SobrePage /></Suspense> },
  { path: "/perfil/associacao", element: <Suspense fallback={loadingFallback}><AssociacaoPage /></Suspense> },
  { path: "/minha-residencia", element: <Suspense fallback={loadingFallback}><MinhaResidenciaPage /></Suspense> },
  { path: "/aviso", element: <Suspense fallback={loadingFallback}><AvisoPage /></Suspense> },
  { path: "/avisos", element: <Suspense fallback={loadingFallback}><AvisosPage /></Suspense> },
  { path: "/avisos/:noticeId", element: <Suspense fallback={loadingFallback}><NoticeDetailPage /></Suspense> },
  { path: "/notificacoes", element: <Suspense fallback={loadingFallback}><NotificacoesPage /></Suspense> },
  { path: "/notificacoes/preferencias", element: <Suspense fallback={loadingFallback}><PreferenciasPage /></Suspense> },
  { path: "/notificacoes/:notificationId", element: <Suspense fallback={loadingFallback}><NotificationDetailPage /></Suspense> },
  { path: "/atividade", element: <Suspense fallback={loadingFallback}><AtividadePage /></Suspense> },
  // Admin Finance Routes (EPF-01 — role-protected)
  { path: "/admin/finance", element: <Suspense fallback={loadingFallback}><AdminFinancePage /></Suspense> },
  { path: "/admin/finance/ciclos", element: <Suspense fallback={loadingFallback}><AdminBillingCyclesPage /></Suspense> },
  { path: "/admin/finance/faturas", element: <Suspense fallback={loadingFallback}><AdminInvoicesPage /></Suspense> },
  { path: "/admin/finance/faturas/:invoiceId", element: <Suspense fallback={loadingFallback}><AdminInvoiceDetailPage /></Suspense> },
  { path: "/admin/finance/pagamentos", element: <Suspense fallback={loadingFallback}><AdminPaymentsPage /></Suspense> },
  { path: "/admin/finance/pagamentos/:paymentId", element: <Suspense fallback={loadingFallback}><AdminPaymentDetailPage /></Suspense> },
  { path: "/admin/finance/relatorios", element: <Suspense fallback={loadingFallback}><AdminReportsPage /></Suspense> },
  { path: "/admin/finance/auditoria", element: <Suspense fallback={loadingFallback}><AdminAuditLogPage /></Suspense> },
  { path: "*", element: <Suspense fallback={loadingFallback}><NotFound /></Suspense> },
];

export default routes;