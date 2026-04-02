import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import Layout from '../components/Layout';
import { ShieldCheck, Mail, Lock, ArrowLeft, Eye, EyeOff } from 'lucide-react';

export default function AdminLogin() {
  const [email, setEmail] = useState('admin@admin.com');
  const [password, setPassword] = useState('admin0102@');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleResetPassword = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      setError('Por favor, insira o e-mail para recuperar a senha.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      await sendPasswordResetEmail(auth, trimmedEmail);
      setSuccess('E-mail de recuperação enviado! Verifique sua caixa de entrada (e a pasta de spam).');
    } catch (err: any) {
      console.error('Reset error:', err);
      setError('Erro ao enviar recuperação: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const trimmedEmail = email.trim().toLowerCase();
    console.log('Attempting admin login with email:', trimmedEmail);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      console.log('Login successful:', userCredential.user.email);
      
      if (trimmedEmail === 'admin@admin.com' || trimmedEmail === 'vgsinfo@gmail.com') {
        // Master admins bypass verification for initial setup ease
        navigate('/admin');
        return;
      }
      
      if (!userCredential.user.emailVerified) {
        setError('Seu e-mail ainda não foi verificado. Verifique sua caixa de entrada.');
        return;
      }
      
      navigate('/admin');
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        if (trimmedEmail === 'admin@admin.com') {
          setError('Usuário não encontrado ou senha incorreta. Se você esqueceu a senha, entre em contato com o suporte técnico para resetar a conta mestre.');
        } else {
          setError('Email ou senha incorretos. Verifique suas credenciais.');
        }
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('O login por E-mail/Senha não está ativado no seu Console do Firebase.');
      } else {
        setError('Erro ao fazer login: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdmin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedEmail !== 'admin@admin.com' && trimmedEmail !== 'vgsinfo@gmail.com') {
      setError('Apenas o e-mail mestre pode ser auto-cadastrado.');
      return;
    }

    if (!password || password.length < 6) {
      setError('Por favor, insira uma senha de pelo menos 6 caracteres para configurar a conta.');
      return;
    }
    
    setLoading(true);
    setError('');
    console.log('Creating master admin account...');
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      console.log('Account created successfully');
      
      // We skip email verification for the master admin to ensure immediate access
      // as requested by the user for testing/stability.
      
      console.log('Setting document...');
      await setDoc(doc(db, 'usuarios', userCredential.user.uid), {
        nome_completo: 'Administrador Mestre',
        cpf: '000.000.000-00',
        id: 'ADMIN-MASTER',
        role: 'admin',
        uid: userCredential.user.uid
      });
      console.log('Master account setup complete.');
      setError(''); // Clear any previous errors
      alert('Conta mestre configurada com sucesso! Agora você pode clicar em "ACESSAR PAINEL".');
    } catch (err: any) {
      console.error('Setup error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está cadastrado. Tente fazer login ou use uma senha diferente se estiver tentando criar agora.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('O login por E-mail/Senha não está ativado no seu Console do Firebase.');
      } else {
        setError('Erro ao criar conta admin: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showNav={false}>
      <div className="min-h-[calc(100vh-160px)] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl shadow-blue-100 overflow-hidden border border-slate-100">
          <div className="bg-slate-900 p-12 text-white text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-brand-blue/10 rounded-full -mr-24 -mt-24 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-green/10 rounded-full -ml-16 -mb-16 blur-2xl"></div>
            
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-20 h-20 bg-white/5 backdrop-blur-xl rounded-[2rem] flex items-center justify-center mb-6 border border-white/10 shadow-2xl">
                <ShieldCheck size={40} className="text-brand-green" />
              </div>
              <h2 className="text-3xl font-black tracking-tighter uppercase font-display italic leading-none">
                Área Administrativa
              </h2>
              <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.4em] mt-4 italic">Acesso Restrito &bull; Segurança Máxima</p>
            </div>
          </div>

          <div className="p-8">
            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1 italic">
                  E-mail de Acesso
                </label>
                <div className="relative group/field">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/field:text-brand-blue transition-colors" size={22} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@infosaude.com"
                    className="w-full pl-14 pr-6 py-5 rounded-[2rem] border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 outline-none transition-all text-lg font-bold placeholder:text-slate-300"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 ml-1 italic">
                  Senha
                </label>
                <div className="relative group/field">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/field:text-brand-blue transition-colors" size={22} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-14 pr-14 py-5 rounded-[2rem] border-2 border-slate-100 bg-slate-50 focus:bg-white focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 outline-none transition-all text-lg font-bold placeholder:text-slate-300"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-blue transition-colors"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-5 bg-red-50 text-red-600 rounded-[2rem] text-sm font-black border-2 border-red-100 animate-in fade-in slide-in-from-top-2 italic">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-5 bg-green-50 text-green-600 rounded-[2rem] text-sm font-black border-2 border-green-100 animate-in fade-in slide-in-from-top-2 italic">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-6 rounded-[2rem] shadow-2xl shadow-slate-200 transition-all active:scale-[0.98] flex items-center justify-center gap-4 text-xl uppercase font-display italic tracking-tighter"
              >
                {loading ? 'ENTRANDO...' : 'ACESSAR PAINEL'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/master-admin')}
                className="w-full bg-brand-gradient hover:opacity-90 text-white font-black py-4 rounded-[2rem] shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 text-sm uppercase font-display italic tracking-widest"
              >
                <ShieldCheck size={18} /> ENTRAR SEM SENHA (EMERGÊNCIA)
              </button>

              <div className="flex flex-col gap-2">
                {(email === 'admin@admin.com' || email === 'vgsinfo@gmail.com') && (
                  <button
                    type="button"
                    onClick={handleCreateAdmin}
                    className="w-full mt-2 text-blue-600 font-bold text-xs hover:underline uppercase tracking-widest"
                  >
                    Configurar Conta Mestre
                  </button>
                )}
                
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="w-full text-slate-400 font-bold text-[10px] hover:text-brand-blue transition-colors uppercase tracking-widest"
                >
                  Esqueci a senha / Recuperar Acesso
                </button>
              </div>
            </form>

            <div className="mt-10 pt-8 border-t-2 border-slate-50 text-center">
              <Link to="/login" className="text-sm font-black text-slate-400 hover:text-brand-blue transition-colors flex items-center justify-center gap-3 uppercase tracking-tighter italic">
                <ArrowLeft size={18} /> Voltar para Acesso Usuário
              </Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
