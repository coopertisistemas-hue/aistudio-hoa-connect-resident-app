import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./router";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import ErrorBoundary from "@/components/base/ErrorBoundary";
import { AuthProvider } from "@/lib/auth/AuthContext";


function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <I18nextProvider i18n={i18n}>
          <BrowserRouter basename={__BASE_PATH__}>
            <AppRoutes />
          </BrowserRouter>
        </I18nextProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;