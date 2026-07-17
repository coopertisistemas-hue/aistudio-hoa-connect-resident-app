import type { RouteObject } from "react-router-dom";
import NotFound from "@/pages/NotFound";
import SplashPage from "@/pages/splash/page";
import WelcomePage from "@/pages/welcome/page";
import LoginPage from "@/pages/login/page";
import PasswordRecoveryPage from "@/pages/password-recovery/page";
import FirstAccessPage from "@/pages/first-access/page";
import AccessSuccessPage from "@/pages/access-success/page";
import HomePage from "@/pages/home/page";
import ConsumoPage from "@/pages/consumo/page";
import LeiturasPage from "@/pages/consumo/leituras/page";
import LeituraDetailPage from "@/pages/consumo/leituras/DetailPage";
import FaturasPage from "@/pages/faturas/page";
import InvoiceDetailPage from "@/pages/faturas/InvoiceDetailPage";
import PaymentDocumentPage from "@/pages/faturas/PaymentDocumentPage";
import PagamentosPage from "@/pages/pagamentos/page";
import ReceiptPage from "@/pages/pagamentos/ReceiptPage";
import AtendimentoPage from "@/pages/atendimento/page";
import SolicitacoesPage from "@/pages/atendimento/solicitacoes/page";
import RequestDetailPage from "@/pages/atendimento/solicitacoes/DetailPage";
import NovoAtendimentoPage from "@/pages/atendimento/NovoPage";
import DuvidasPage from "@/pages/atendimento/duvidas/page";
import PerfilPage from "@/pages/perfil/page";
import DadosPessoaisPage from "@/pages/perfil/dados-pessoais/page";
import DadosPessoaisEditPage from "@/pages/perfil/dados-pessoais/EditPage";
import CorrecaoPage from "@/pages/perfil/dados-pessoais/CorrecaoPage";
import ContatosPage from "@/pages/perfil/contatos/page";
import ResidenciasPage from "@/pages/perfil/residencias/page";
import PreferenciasAppPage from "@/pages/perfil/preferencias/page";
import AcessibilidadePage from "@/pages/perfil/acessibilidade/page";
import PrivacidadePage from "@/pages/perfil/privacidade/page";
import SegurancaPage from "@/pages/perfil/seguranca/page";
import SobrePage from "@/pages/perfil/sobre/page";
import AssociacaoPage from "@/pages/perfil/associacao/page";
import MinhaResidenciaPage from "@/pages/minha-residencia/page";
import AvisoPage from "@/pages/aviso/page";
import AvisosPage from "@/pages/avisos/page";
import NoticeDetailPage from "@/pages/avisos/NoticeDetailPage";
import NotificacoesPage from "@/pages/notificacoes/page";
import NotificationDetailPage from "@/pages/notificacoes/NotificationDetailPage";
import PreferenciasPage from "@/pages/notificacoes/PreferenciasPage";
import AtividadePage from "@/pages/atividade/page";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <SplashPage />,
  },
  {
    path: "/splash",
    element: <SplashPage />,
  },
  {
    path: "/welcome",
    element: <WelcomePage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/password-recovery",
    element: <PasswordRecoveryPage />,
  },
  {
    path: "/first-access",
    element: <FirstAccessPage />,
  },
  {
    path: "/access-success",
    element: <AccessSuccessPage />,
  },
  {
    path: "/inicio",
    element: <HomePage />,
  },
  {
    path: "/consumo",
    element: <ConsumoPage />,
  },
  {
    path: "/consumo/leituras",
    element: <LeiturasPage />,
  },
  {
    path: "/consumo/leituras/:readingId",
    element: <LeituraDetailPage />,
  },
  {
    path: "/faturas",
    element: <FaturasPage />,
  },
  {
    path: "/faturas/:invoiceId",
    element: <InvoiceDetailPage />,
  },
  {
    path: "/faturas/:invoiceId/pagamento",
    element: <PaymentDocumentPage />,
  },
  {
    path: "/pagamentos",
    element: <PagamentosPage />,
  },
  {
    path: "/pagamentos/:paymentId/comprovante",
    element: <ReceiptPage />,
  },
  {
    path: "/atendimento",
    element: <AtendimentoPage />,
  },
  {
    path: "/atendimento/solicitacoes",
    element: <SolicitacoesPage />,
  },
  {
    path: "/atendimento/solicitacoes/:requestId",
    element: <RequestDetailPage />,
  },
  {
    path: "/atendimento/novo",
    element: <NovoAtendimentoPage />,
  },
  {
    path: "/atendimento/duvidas",
    element: <DuvidasPage />,
  },
  {
    path: "/perfil",
    element: <PerfilPage />,
  },
  {
    path: "/perfil/dados-pessoais",
    element: <DadosPessoaisPage />,
  },
  {
    path: "/perfil/dados-pessoais/editar",
    element: <DadosPessoaisEditPage />,
  },
  {
    path: "/perfil/dados-pessoais/correcao",
    element: <CorrecaoPage />,
  },
  {
    path: "/perfil/contatos",
    element: <ContatosPage />,
  },
  {
    path: "/perfil/residencias",
    element: <ResidenciasPage />,
  },
  {
    path: "/perfil/preferencias",
    element: <PreferenciasAppPage />,
  },
  {
    path: "/perfil/acessibilidade",
    element: <AcessibilidadePage />,
  },
  {
    path: "/perfil/privacidade",
    element: <PrivacidadePage />,
  },
  {
    path: "/perfil/seguranca",
    element: <SegurancaPage />,
  },
  {
    path: "/perfil/sobre",
    element: <SobrePage />,
  },
  {
    path: "/perfil/associacao",
    element: <AssociacaoPage />,
  },
  {
    path: "/minha-residencia",
    element: <MinhaResidenciaPage />,
  },
  {
    path: "/aviso",
    element: <AvisoPage />,
  },
  {
    path: "/avisos",
    element: <AvisosPage />,
  },
  {
    path: "/avisos/:noticeId",
    element: <NoticeDetailPage />,
  },
  {
    path: "/notificacoes",
    element: <NotificacoesPage />,
  },
  {
    path: "/notificacoes/preferencias",
    element: <PreferenciasPage />,
  },
  {
    path: "/notificacoes/:notificationId",
    element: <NotificationDetailPage />,
  },
  {
    path: "/atividade",
    element: <AtividadePage />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];

export default routes;