import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import Layout from '../components/Layout';
import { ShieldCheck, User, Fingerprint, Key, Activity as HeartPulse } from 'lucide-react';

export default function Login() {
  const [cpf, setCpf] = useState('');
  const [id, setId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Map CPF to a virtual email for Firebase Auth
      const cleanCpf = cpf.replace(/\D/g, '');
      const trimmedId = id.trim().toUpperCase();
      
      if (cleanCpf.length !== 11) {
        setError('CPF deve conter 11 dígitos.');
        setLoading(false);
        return;
      }

      if (trimmedId.length < 6) {
        setError('O ID do seu cartão deve ter pelo menos 6 caracteres.');
        setLoading(false);
        return;
      }

      const email = `${cleanCpf}@infosaude.com`;
      const userCredential = await signInWithEmailAndPassword(auth, email, trimmedId);
      console.log('Login successful:', userCredential.user.uid);
      
      // Check if user is admin to redirect accordingly
      if (email === 'admin@infosaude.com' || email === 'admin@admin.com' || email === 'vgsinfo@gmail.com') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error('Login error detail:', err);
      if (err.code === 'auth/invalid-credential') {
        setError('Dados de acesso incorretos. Verifique seu CPF e ID do cartão. Certifique-se de que o ID está correto (Ex: INFO-123).');
      } else if (err.code === 'auth/user-not-found') {
        setError('Usuário não localizado. Verifique se o CPF e ID estão digitados corretamente.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Falha de conexão. Verifique sua internet.');
      } else {
        setError('Erro ao validar acesso. Tente novamente em instantes.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showNav={false}>
      <div className="min-h-[calc(100vh-160px)] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl shadow-blue-100 overflow-hidden border border-slate-100">
          <div className="bg-brand-gradient p-10 text-white text-center relative overflow-hidden">
            {/* Decorative elements similar to the image */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12 blur-xl"></div>
            
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 border border-white/30">
                <HeartPulse size={32} />
              </div>
              <h2 className="text-4xl font-black tracking-tighter italic font-display" translate="no">
                <span>info</span>
                <span className="text-white/70">+</span>
                <span>saúde</span>
              </h2>
              <p className="text-white/80 text-sm font-medium italic mt-1">Seus Dados de Saúde Sempre à Mão</p>
            </div>
          </div>

          <div className="p-8">
            <div className="mb-8 text-center">
              <h3 className="text-xl font-bold text-slate-800">Acesso do Usuário</h3>
              <p className="text-slate-500 text-sm">Entre com seus dados de identificação</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  CPF do Titular
                </label>
                <div className="relative">
                  <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input
                    type="text"
                    value={cpf}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-blue outline-none transition-all text-lg font-medium"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">
                  ID do Cartão
                </label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                  <input
                    type="text"
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    placeholder="Ex: INFO-123"
                    className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-brand-blue outline-none transition-all text-lg font-medium"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold flex items-center gap-2 border border-red-100 animate-shake">
                  <ShieldCheck size={18} />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-gradient hover:opacity-90 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-xl italic font-display"
              >
                {loading ? 'ENTRANDO...' : 'ACESSAR DADOS'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  );
}
