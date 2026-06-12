import { useState } from 'react';
import { Box } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const ERRORS = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'Usuário não encontrado.',
  'auth/wrong-password': 'Senha incorreta.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
};

export default function Login() {
  const { login, resetPassword } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState('login'); // login | reset
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await resetPassword(email);
        toast('E-mail de redefinição enviado. Verifique sua caixa de entrada.');
        setMode('login');
      }
    } catch (err) {
      toast(ERRORS[err.code] || `Erro: ${err.message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/30">
            <Box size={28} />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">Gestão 3D</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Projetos, produção e custos da sua operação de impressão 3D
          </p>
        </div>

        <form onSubmit={submit} className="card-pad space-y-3.5">
          <div>
            <label className="label">E-mail</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              required
              autoComplete="email"
            />
          </div>

          {mode === 'login' && (
            <div>
              <label className="label">Senha</label>
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete="current-password"
              />
            </div>
          )}

          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Aguarde...' : mode === 'login' ? 'Entrar' : 'Enviar e-mail de redefinição'}
          </button>

          <div className="flex justify-end text-xs">
            {mode === 'login' ? (
              <button type="button" className="text-slate-400 hover:underline" onClick={() => setMode('reset')}>
                Esqueci a senha
              </button>
            ) : (
              <button type="button" className="text-blue-500 hover:underline" onClick={() => setMode('login')}>
                ← Voltar para o login
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
