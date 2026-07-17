export const demoStates = {
  login: {
    default: { type: 'default', message: '' },
    loading: { type: 'loading', message: 'Verificando suas informações...' },
    invalidCredentials: { type: 'error', message: 'CPF ou senha incorretos. Tente novamente.' },
    accountNotFound: { type: 'error', message: 'Não encontramos uma conta com este CPF.' },
    accountInactive: { type: 'error', message: 'Esta conta está temporariamente indisponível. Entre em contato com a associação.' },
    networkError: { type: 'error', message: 'Não foi possível conectar. Verifique sua internet e tente novamente.' },
    success: { type: 'success', message: 'Login realizado com sucesso!' },
  },
  passwordRecovery: {
    identityNotFound: { type: 'error', message: 'Não encontramos um cadastro com este CPF.' },
    codeInvalid: { type: 'error', message: 'Código incorreto. Verifique e tente novamente.' },
    codeExpired: { type: 'error', message: 'Este código expirou. Solicite um novo.' },
    passwordMismatch: { type: 'error', message: 'As senhas não conferem.' },
    passwordTooShort: { type: 'error', message: 'A senha deve ter pelo menos 8 caracteres.' },
  },
  firstAccess: {
    cpfNotFound: { type: 'error', message: 'CPF não encontrado na base da associação. Verifique os dados com a administração.' },
    codeInvalid: { type: 'error', message: 'Código incorreto. Verifique e tente novamente.' },
    codeExpired: { type: 'error', message: 'Este código expirou. Solicite um novo.' },
    passwordMismatch: { type: 'error', message: 'As senhas não conferem.' },
    termsNotAccepted: { type: 'error', message: 'Você precisa aceitar os termos de uso para continuar.' },
  },
};

export type DemoStateKey = keyof typeof demoStates;