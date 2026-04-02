import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Usuario } from '../types';
import Layout from '../components/Layout';
import { 
  User, 
  Heart, 
  Activity, 
  Shield, 
  AlertTriangle, 
  Pill, 
  Phone, 
  Edit3, 
  CheckCircle, 
  XCircle,
  ExternalLink,
  Download,
  Printer,
  QrCode,
  ArrowRight,
  Info,
  CreditCard,
  Loader2
} from 'lucide-react';

export default function UserDashboard() {
  const [userData, setUserData] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUserData = async () => {
      if (!auth.currentUser) return;
      try {
        const docRef = doc(db, 'usuarios', auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data() as Usuario);
        }
      } catch (error) {
        console.error('Erro ao buscar dados do usuário:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const getPublicUrl = () => {
    if (!userData) return '';
    return `${window.location.origin}/p/${userData.id}`;
  };

  const handleDownloadPdf = () => {
    if (!userData) return;
    const downloadUrl = `${getPublicUrl()}?download=true`;
    
    // Abrir em nova aba para processar o download
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="relative w-20 h-20 mb-6">
            <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs animate-pulse italic">Sincronizando sua Ficha...</p>
        </div>
      </Layout>
    );
  }

  if (!userData) {
    return (
      <Layout>
        <div className="max-w-md mx-auto text-center p-12 bg-white rounded-[3rem] shadow-2xl border-4 border-red-100">
          <div className="w-24 h-24 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner rotate-3">
            <AlertTriangle size={48} />
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-4 italic uppercase tracking-tighter">Erro Crítico</h2>
          <p className="text-slate-500 mb-10 font-medium text-lg leading-relaxed">Não conseguimos localizar seu prontuário médico no sistema.</p>
          <button 
            onClick={() => navigate('/login')}
            className="w-full bg-brand-gradient text-white font-black py-5 rounded-[2rem] hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-brand-blue/20 uppercase tracking-widest italic"
          >
            Tentar Novamente
          </button>
        </div>
      </Layout>
    );
  }

  const translateValue = (value: string | undefined) => {
    if (!value) return '---';
    const translations: Record<string, string> = {
      'Male': 'Masculino',
      'Female': 'Feminino',
      'Other': 'Outro',
      'A+': 'A+', 'A-': 'A-', 'B+': 'B+', 'B-': 'B-', 'AB+': 'AB+', 'AB-': 'AB-', 'O+': 'O+', 'O-': 'O-'
    };
    return translations[value] || value;
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8 pb-20">
        {/* Welcome Hero Section */}
        <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50 rounded-full -mr-48 -mt-48 blur-3xl opacity-40 group-hover:opacity-60 transition-opacity duration-1000"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
            <div className="relative shrink-0">
              <div className="w-32 h-32 md:w-40 md:h-40 bg-slate-900 rounded-[2.5rem] flex items-center justify-center text-5xl md:text-6xl font-black text-white shadow-2xl shadow-slate-300 border-[8px] border-white font-display italic overflow-hidden">
                {userData.nome_completo.charAt(0)}
              </div>
              <div className="absolute -bottom-2 -right-2 w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center text-white border-4 border-white shadow-lg">
                <CheckCircle size={24} />
              </div>
            </div>

            <div className="flex-1 text-center md:text-left space-y-4">
              <div>
                <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
                  <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest border border-blue-100">Paciente Verificado</span>
                  <span className="text-slate-300 font-bold text-xs">/</span>
                  <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">ID: {userData.id}</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-tight italic uppercase">
                  Olá, {userData.nome_completo.split(' ')[0]}!
                </h1>
                <p className="text-slate-500 font-medium text-lg max-w-xl">Sua ficha médica está atualizada e pronta para emergências.</p>
              </div>

              <div className="flex flex-wrap justify-center md:justify-start gap-3 pt-4">
                <button 
                  onClick={() => navigate('/perfil')}
                  className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-tighter italic flex items-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95"
                >
                  <Edit3 size={20} />
                  Editar Minha Ficha
                </button>
                <button 
                  onClick={handleDownloadPdf}
                  className="bg-white text-blue-600 border-2 border-blue-100 px-8 py-4 rounded-2xl font-black uppercase tracking-tighter italic flex items-center gap-3 hover:bg-blue-50 transition-all active:scale-95"
                >
                  <Download size={20} />
                  Baixar PDF
                </button>
              </div>
            </div>

            <div className="hidden lg:block shrink-0 p-6 bg-slate-50 rounded-[2rem] border border-slate-100 text-center space-y-4">
              <div className="w-32 h-32 bg-white rounded-2xl flex items-center justify-center shadow-inner mx-auto border-2 border-slate-100">
                <QrCode size={80} className="text-slate-900 opacity-80" />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Seu QR Code de Emergência</span>
                <button 
                  onClick={() => window.open(getPublicUrl(), '_blank')}
                  className="text-blue-600 font-black text-[10px] uppercase tracking-widest hover:underline flex items-center justify-center gap-2 mx-auto"
                >
                  Ver Perfil Público <ExternalLink size={12} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Critical Info */}
          <div className="lg:col-span-2 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Blood Type Card */}
              <div className="bg-red-50 p-8 rounded-[2.5rem] border-2 border-red-100 shadow-lg shadow-red-100/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-100 rounded-full -mr-16 -mt-16 blur-2xl opacity-50"></div>
                <div className="relative z-10 flex items-center justify-between mb-6">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-red-600 shadow-sm border border-red-100">
                    <Heart size={24} className="fill-red-600" />
                  </div>
                  <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Informação Vital</span>
                </div>
                <div className="relative z-10">
                  <h3 className="text-4xl font-black text-red-900 tracking-tighter italic uppercase mb-1">{userData.tipo_sanguineo || 'N/A'}</h3>
                  <p className="text-red-700 font-bold uppercase tracking-widest text-[10px]">Tipo Sanguíneo</p>
                </div>
              </div>

              {/* Allergies Card */}
              <div className={`p-8 rounded-[2.5rem] border-2 transition-all duration-500 relative overflow-hidden group ${
                userData.alergias ? 'bg-amber-50 border-amber-100 shadow-lg shadow-amber-100/20' : 'bg-slate-50 border-slate-100'
              }`}>
                <div className="relative z-10 flex items-center justify-between mb-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border ${
                    userData.alergias ? 'bg-white text-amber-600 border-amber-100' : 'bg-white text-slate-300 border-slate-100'
                  }`}>
                    <AlertTriangle size={24} />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${
                    userData.alergias ? 'text-amber-400' : 'text-slate-400'
                  }`}>Alergias</span>
                </div>
                <div className="relative z-10">
                  <h3 className={`text-xl font-black tracking-tight italic uppercase leading-tight ${
                    userData.alergias ? 'text-amber-900' : 'text-slate-400 italic'
                  }`}>
                    {userData.alergias || 'Nenhuma alergia informada'}
                  </h3>
                </div>
              </div>
            </div>

            {/* Detailed Info Sections */}
            <div className="bg-white p-8 md:p-10 rounded-[3rem] shadow-xl shadow-slate-200/40 border border-slate-100 space-y-10">
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-8 bg-blue-600 rounded-full"></div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tighter italic uppercase">Resumo Médico</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-6">
                  <div className="flex items-start gap-4 group">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                      <Pill size={22} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Medicamentos Contínuos</span>
                      <p className="text-slate-700 font-bold leading-snug">{userData.medicamentos || 'Nenhum informado'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 group">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
                      <Activity size={22} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Condições Crônicas</span>
                      <p className="text-slate-700 font-bold leading-snug">{userData.condicoes_preexistentes || 'Nenhuma informada'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-start gap-4 group">
                    <div className="w-12 h-12 bg-slate-50 text-slate-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-slate-900 group-hover:text-white transition-all shadow-sm">
                      <Info size={22} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Observações</span>
                      <p className="text-slate-700 font-bold leading-snug">{userData.observacoes || 'Sem observações adicionais'}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 group">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-all shadow-sm">
                      <CheckCircle size={22} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Última Vacina</span>
                      <p className="text-slate-700 font-bold leading-snug">{userData.ultima_vacina || 'Não registrada'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Sidebar Info */}
          <div className="space-y-8">
            {/* Emergency Contacts Card */}
            <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl shadow-slate-300 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
              
              <div className="relative z-10 flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white backdrop-blur-md border border-white/10">
                  <Phone size={24} />
                </div>
                <h3 className="text-xl font-black uppercase italic tracking-tighter">Contatos de Emergência</h3>
              </div>

              <div className="relative z-10 space-y-6">
                <p className="text-2xl font-black leading-tight tracking-tighter whitespace-pre-line text-blue-400">
                  {userData.contatos_emergencia || 'Nenhum contato cadastrado'}
                </p>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                    Estes números serão exibidos no seu perfil público para socorristas.
                  </p>
                </div>
              </div>
            </div>

            {/* Health Plan Card */}
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-125 transition-transform duration-1000"></div>
              
              <div className="relative z-10 flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100">
                  <CreditCard size={24} />
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Plano de Saúde</h3>
              </div>

              <div className="relative z-10 space-y-6">
                {userData.plano_saude_nome ? (
                  <div className="space-y-4">
                    <div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Operadora</span>
                      <p className="text-xl font-black text-slate-900 leading-none">{userData.plano_saude_nome}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nº Carteirinha</span>
                        <p className="text-xs font-mono font-bold text-slate-700">{userData.plano_saude_numero || '---'}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tipo</span>
                        <p className="text-xs font-bold text-slate-700 italic">{userData.plano_saude_tipo || '---'}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-4 text-center">
                    <p className="text-slate-400 italic font-medium">Não informado</p>
                  </div>
                )}
              </div>
            </div>

            {/* Personal Details Card */}
            <div className="bg-slate-50 p-8 rounded-[3rem] border border-slate-200/50 space-y-6">
              <div className="flex items-center gap-3">
                <User size={18} className="text-slate-400" />
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Dados Pessoais</h4>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nascimento</span>
                  <p className="text-sm font-bold text-slate-700">{userData.data_nascimento || '---'}</p>
                </div>
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Sexo</span>
                  <p className="text-sm font-bold text-slate-700">{translateValue(userData.sexo)}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Cartão SUS</span>
                  <p className="text-sm font-mono font-bold text-slate-700">{userData.cartao_sus || '---'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
