import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, User, ShieldCheck, HeartPulse } from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  showNav?: boolean;
}

export default function Layout({ children, title, showNav = true }: LayoutProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans print:bg-white">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 no-print">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/')}>
            <div className="w-10 h-10 bg-brand-gradient rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200 group-hover:scale-105 transition-transform">
              <HeartPulse size={24} />
            </div>
            <div className="flex flex-col" translate="no">
              <span className="text-xl font-black tracking-tighter italic font-display leading-none">
                <span className="text-brand-blue">info</span>
                <span className="text-brand-green">+</span>
                <span className="text-brand-green">saúde</span>
              </span>
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest leading-none mt-0.5">Seus dados sempre à mão</span>
            </div>
          </div>
          
          {showNav && auth.currentUser && (
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-500 hover:text-red-600 transition-colors"
              title="Sair"
            >
              <LogOut size={20} />
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4">
        {title && (
          <h1 className="text-2xl font-bold text-slate-900 mb-6">{title}</h1>
        )}
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 no-print">
        <div className="max-w-4xl mx-auto px-4 text-center text-slate-500 text-sm" translate="no">
          <p>&copy; 2026 Info+Saúde. Seus dados de saúde sempre à mão.</p>
        </div>
      </footer>
    </div>
  );
}
