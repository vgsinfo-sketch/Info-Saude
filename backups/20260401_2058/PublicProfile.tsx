import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Usuario } from '../types';
import Layout from '../components/Layout';
import { Heart, AlertTriangle, Pill, Phone, User, ShieldAlert, Activity, Info, CreditCard, Calendar, Printer, Download, Loader2 } from 'lucide-react';
import html2pdf from 'html2pdf.js';

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const [userData, setUserData] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  console.log('PublicProfile montado com ID:', id);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!id) return;
      setLoading(true);
      try {
        const searchId = id.toUpperCase().trim();
        const cleanId = id.trim();
        
        // Try searching by card ID first
        let q = query(collection(db, 'usuarios'), where('id', '==', searchId), limit(1));
        let querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          // If not found, try searching by original ID (case sensitive)
          q = query(collection(db, 'usuarios'), where('id', '==', cleanId), limit(1));
          querySnapshot = await getDocs(q);
        }

        if (querySnapshot.empty) {
          // If not found, try searching by document ID (uid)
          q = query(collection(db, 'usuarios'), where('uid', '==', cleanId), limit(1));
          querySnapshot = await getDocs(q);
        }

        if (querySnapshot.empty) {
          // Try searching by CPF as well
          const cleanCpf = cleanId.replace(/\D/g, '');
          if (cleanCpf) {
            q = query(collection(db, 'usuarios'), where('cpf', '==', cleanCpf), limit(1));
            querySnapshot = await getDocs(q);
          }
        }

        if (!querySnapshot.empty) {
          setUserData(querySnapshot.docs[0].data() as Usuario);
        } else {
          setError('Usuário não encontrado. Verifique o ID do cartão.');
        }
      } catch (err: any) {
        console.error(err);
        setError(`Erro ao carregar informações: ${err.message || 'Erro desconhecido'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [id]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const isPrint = searchParams.get('print') === 'true' || location.hash.includes('print=true');
    const isDownload = searchParams.get('download') === 'true';
    
    if (userData && isPrint) {
      console.log('Detectada instrução de impressão automática para:', userData.nome_completo);
      // Small delay to ensure rendering is complete
      const timer = setTimeout(() => {
        console.log('Iniciando window.print()...');
        window.print();
        // Clean up the URL after printing
        if (searchParams.get('print') === 'true') {
          navigate(location.pathname, { replace: true });
        }
      }, 2000);
      return () => clearTimeout(timer);
    }

    if (userData && isDownload) {
      console.log('Detectada instrução de download automático para:', userData.nome_completo);
      const timer = setTimeout(() => {
        handleDownloadPdf();
        // Clean up the URL after downloading
        navigate(location.pathname, { replace: true });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [userData, location.search, location.hash, location.pathname, navigate]);

  const handleManualPrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!userData) return;
    
    setIsDownloading(true);
    const element = document.querySelector('.print-container') as HTMLElement;
    
    if (!element) {
      console.error('Elemento .print-container não encontrado');
      setIsDownloading(false);
      return;
    }

    // Adicionar classe temporária para forçar cores seguras (sem oklch)
    element.classList.add('pdf-mode');
    
    // Garantir que a página esteja no topo para evitar problemas de captura
    window.scrollTo(0, 0);
    
    console.log('Iniciando geração de PDF para:', userData.nome_completo);
    
    // Configurações para o PDF
    const opt = {
      margin: 10,
      filename: `Ficha_Medica_${userData.nome_completo.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true,
        letterRendering: true,
        logging: true, // Habilitar logging para depuração
        // Forçar o uso de cores seguras ignorando oklch se possível
        onclone: (clonedDoc: Document) => {
          console.log('Clonagem do DOM concluída, limpando oklch...');
          
          // Remover todas as ocorrências de oklch e color-mix de todas as tags style
          const styles = clonedDoc.querySelectorAll('style');
          styles.forEach(style => {
            try {
              const originalContent = style.innerHTML;
              if (originalContent.toLowerCase().includes('oklch') || originalContent.toLowerCase().includes('color-mix')) {
                // Substituir oklch e color-mix por uma cor segura
                let cleaned = originalContent.replace(/oklch\s*\([^)]+\)/gi, '#ffffff');
                cleaned = cleaned.replace(/color-mix\s*\([^)]+\)/gi, '#ffffff');
                style.innerHTML = cleaned;
                console.log('Limpado oklch/color-mix de uma tag style');
              }
            } catch (e) {
              console.warn('Erro ao limpar oklch de uma tag style:', e);
            }
          });

          // Também limpar oklch e color-mix de atributos style inline em todos os elementos
          const allElements = clonedDoc.querySelectorAll('*');
          let inlineCleanedCount = 0;
          allElements.forEach(el => {
            if (el instanceof HTMLElement && el.getAttribute('style')) {
              try {
                const styleAttr = el.getAttribute('style');
                if (styleAttr && (styleAttr.toLowerCase().includes('oklch') || styleAttr.toLowerCase().includes('color-mix'))) {
                  let cleaned = styleAttr.replace(/oklch\s*\([^)]+\)/gi, '#ffffff');
                  cleaned = cleaned.replace(/color-mix\s*\([^)]+\)/gi, '#ffffff');
                  el.setAttribute('style', cleaned);
                  inlineCleanedCount++;
                }
              } catch (e) {
                // Ignorar
              }
            }
          });
          if (inlineCleanedCount > 0) {
            console.log(`Limpado oklch de ${inlineCleanedCount} elementos inline`);
          }

          // Injetar CSS de fallback massivo para variáveis do Tailwind 4
          const style = clonedDoc.createElement('style');
          style.innerHTML = `
            :root, .pdf-mode {
              --color-slate-50: #f8fafc !important;
              --color-slate-100: #f1f5f9 !important;
              --color-slate-200: #e2e8f0 !important;
              --color-slate-300: #cbd5e1 !important;
              --color-slate-400: #94a3b8 !important;
              --color-slate-500: #64748b !important;
              --color-slate-600: #475569 !important;
              --color-slate-700: #334155 !important;
              --color-slate-800: #1e293b !important;
              --color-slate-900: #0f172a !important;
              --color-blue-50: #eff6ff !important;
              --color-blue-100: #dbeafe !important;
              --color-blue-200: #bfdbfe !important;
              --color-blue-300: #93c5fd !important;
              --color-blue-400: #60a5fa !important;
              --color-blue-500: #3b82f6 !important;
              --color-blue-600: #2563eb !important;
              --color-blue-700: #1d4ed8 !important;
              --color-blue-800: #1e40af !important;
              --color-blue-900: #1e3a8a !important;
              --color-red-50: #fef2f2 !important;
              --color-red-100: #fee2e2 !important;
              --color-red-500: #ef4444 !important;
              --color-red-600: #dc2626 !important;
              --color-red-900: #7f1d1d !important;
              --color-emerald-50: #ecfdf5 !important;
              --color-emerald-500: #10b981 !important;
              --color-emerald-600: #059669 !important;
              --color-amber-50: #fffbeb !important;
              --color-amber-600: #d97706 !important;
              
              /* Forçar cores de texto e fundo para evitar oklch */
              background-color: #f8fafc !important;
              color: #334155 !important;
            }
            .pdf-mode * {
              border-color: #e2e8f0 !important;
              box-shadow: none !important;
              text-shadow: none !important;
            }
            .pdf-mode .bg-white { background-color: #ffffff !important; }
            .pdf-mode .bg-slate-900 { background-color: #0f172a !important; }
            .pdf-mode .bg-blue-600 { background-color: #2563eb !important; }
            .pdf-mode .text-white { color: #ffffff !important; }
            .pdf-mode .text-slate-900 { color: #0f172a !important; }
            .pdf-mode .text-blue-600 { color: #2563eb !important; }
          `;
          clonedDoc.head.appendChild(style);
        }
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    try {
      // Gerar o PDF
      await html2pdf().set(opt).from(element).save();
      console.log('PDF gerado com sucesso');
    } catch (err) {
      console.error('Erro crítico ao gerar PDF:', err);
      // Fallback para impressão normal se o PDF falhar
      alert('Houve um erro ao gerar o PDF. Vamos tentar abrir a janela de impressão do sistema.');
      window.print();
    } finally {
      element.classList.remove('pdf-mode');
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="relative w-24 h-24 mb-8">
          <div className="absolute inset-0 border-8 border-brand-blue/20 rounded-full"></div>
          <div className="absolute inset-0 border-8 border-brand-blue border-t-transparent rounded-full animate-spin"></div>
        </div>
        <h2 className="text-2xl font-black text-brand-blue animate-pulse italic uppercase tracking-tighter">Carregando Perfil...</h2>
      </div>
    );
  }

  if (error || !userData) {
    return (
      <Layout showNav={false}>
        <div className="max-w-md mx-auto mt-12 text-center p-12 bg-white rounded-[3rem] shadow-2xl border-4 border-red-100 animate-in fade-in zoom-in-95 duration-500">
          <div className="w-24 h-24 bg-red-50 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner rotate-3">
            <ShieldAlert size={48} />
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-4 italic uppercase tracking-tighter">Atenção</h2>
          <p className="text-slate-500 mb-10 font-medium text-lg leading-relaxed">
            {error || 'Informações indisponíveis.'}
            <br/>
            <span className="text-xs opacity-50 block mt-2">Buscando por: {id}</span>
          </p>
          <button 
            onClick={() => navigate('/login')}
            className="w-full bg-brand-gradient text-white font-black py-5 rounded-[2rem] hover:opacity-90 active:scale-95 transition-all shadow-xl shadow-brand-blue/20 uppercase tracking-widest italic"
          >
            Voltar ao Início
          </button>
        </div>
      </Layout>
    );
  }

  const getEmergencyPhone = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    // Try to find a sequence of 10 or 11 digits (Brazilian phone format)
    const match = text.match(/(?:\(?\d{2}\)?\s?)?\d{4,5}-?\d{4}/);
    return match ? match[0].replace(/\D/g, '') : cleaned.slice(0, 11);
  };

  const translateValue = (value: string | undefined) => {
    if (!value) return '---';
    const translations: Record<string, string> = {
      'Male': 'Masculino',
      'Female': 'Feminino',
      'Other': 'Outro',
      'user': 'Usuário',
      'admin': 'Administrador',
      'A+': 'A+', 'A-': 'A-', 'B+': 'B+', 'B-': 'B-', 'AB+': 'AB+', 'AB-': 'AB-', 'O+': 'O+', 'O-': 'O-'
    };
    return translations[value] || value;
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans print:bg-white selection:bg-blue-100">
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --brand-primary: #0F172A;
          --brand-accent: #2563EB;
          --brand-danger: #EF4444;
          --brand-success: #10B981;
          --brand-warning: #F59E0B;
        }

        body {
          font-family: "Inter", "Roboto", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          color: #334155;
          -webkit-font-smoothing: antialiased;
        }

        .font-display {
          font-family: "Inter", "Roboto", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }

        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          
          /* Esconder elementos desnecessários */
          .no-print, .print\:hidden, header.print\:hidden { 
            display: none !important; 
          }
          
          /* Resetar e forçar visibilidade */
          html, body, #root, .print-container, main, section, div, p, span, h1, h2, h3, h4, img, svg {
            visibility: visible !important;
            opacity: 1 !important;
            position: static !important;
            overflow: visible !important;
            animation: none !important;
            transition: none !important;
          }
          
          /* Forçar layout de bloco para impressão */
          .flex, .grid {
            display: block !important;
          }
          
          .print-container {
            display: block !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          section {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 30px !important;
            display: block !important;
          }

          html, body {
            background: white !important;
            width: 100% !important;
            height: auto !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .print-container { 
            width: 100% !important; 
            max-width: none !important; 
            margin: 0 !important; 
            padding: 0 !important;
            display: block !important;
          }

          section {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 20px !important;
            border: 1px solid #eee !important;
            padding: 15px !important;
            border-radius: 8px !important;
            display: block !important;
          }

          /* Ajustar textos */
          .text-4xl, .text-5xl { font-size: 22pt !important; color: black !important; font-weight: bold !important; }
          .text-3xl { font-size: 18pt !important; color: black !important; font-weight: bold !important; }
          .text-2xl { font-size: 16pt !important; color: black !important; }
          .text-xl { font-size: 14pt !important; }
          .text-lg { font-size: 12pt !important; }
          .text-sm { font-size: 10pt !important; }
          .text-xs { font-size: 9pt !important; }
          
          /* Cores de fundo */
          .bg-slate-900 { background-color: #0F172A !important; color: white !important; -webkit-print-color-adjust: exact !important; }
          .bg-blue-600 { background-color: #2563EB !important; color: white !important; -webkit-print-color-adjust: exact !important; }
          
          /* Avatar */
          .w-32, .h-32, .md\:w-40, .md\:h-40 { 
            width: 80px !important; 
            height: 80px !important; 
            background-color: #0F172A !important;
            color: white !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 30pt !important;
            border-radius: 10px !important;
          }
          
          /* Grid simplificado */
          .grid {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 10px !important;
          }
          .grid > * {
            flex: 1 1 45% !important;
          }
          
          /* Contatos de emergência */
          .whitespace-pre-line {
            white-space: pre-wrap !important;
          }

          /* Remover efeitos */
          .backdrop-blur-md, .backdrop-blur-sm, .blur-3xl, .shadow-xl, .shadow-2xl, .shadow-lg { 
            backdrop-filter: none !important; 
            filter: none !important; 
            box-shadow: none !important;
          }
        }

        .glass-card {
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(226, 232, 240, 0.8);
        }

        .section-title {
          font-size: 0.7rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.25em;
          color: #94A3B8;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .section-title::after {
          content: "";
          height: 1px;
          flex: 1;
          background: #E2E8F0;
        }

        .badge-verified {
          background: linear-gradient(135deg, #10B981 0%, #059669 100%);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
        }

        /* PDF Mode Overrides for html2canvas (No oklch) */
        .pdf-mode {
          background-color: #f8fafc !important;
          color: #334155 !important;
        }
        .pdf-mode .bg-white { background-color: #ffffff !important; }
        .pdf-mode .bg-slate-50 { background-color: #f8fafc !important; }
        .pdf-mode .bg-slate-100 { background-color: #f1f5f9 !important; }
        .pdf-mode .bg-slate-200 { background-color: #e2e8f0 !important; }
        .pdf-mode .bg-slate-900 { background-color: #0f172a !important; }
        .pdf-mode .bg-blue-50 { background-color: #eff6ff !important; }
        .pdf-mode .bg-blue-600 { background-color: #2563eb !important; }
        .pdf-mode .bg-red-50 { background-color: #fef2f2 !important; }
        .pdf-mode .bg-red-100 { background-color: #fee2e2 !important; }
        .pdf-mode .bg-emerald-50 { background-color: #ecfdf5 !important; }
        .pdf-mode .bg-amber-50 { background-color: #fffbeb !important; }
        
        .pdf-mode .text-slate-900 { color: #0f172a !important; }
        .pdf-mode .text-slate-700 { color: #334155 !important; }
        .pdf-mode .text-slate-600 { color: #475569 !important; }
        .pdf-mode .text-slate-500 { color: #64748b !important; }
        .pdf-mode .text-slate-400 { color: #94a3b8 !important; }
        .pdf-mode .text-slate-300 { color: #cbd5e1 !important; }
        .pdf-mode .text-blue-600 { color: #2563eb !important; }
        .pdf-mode .text-red-600 { color: #dc2626 !important; }
        .pdf-mode .text-red-900 { color: #7f1d1d !important; }
        .pdf-mode .text-emerald-600 { color: #059669 !important; }
        .pdf-mode .text-emerald-500 { color: #10b981 !important; }
        .pdf-mode .text-amber-600 { color: #d97706 !important; }
        
        .pdf-mode .border-slate-100 { border-color: #f1f5f9 !important; }
        .pdf-mode .border-slate-200 { border-color: #e2e8f0 !important; }
        .pdf-mode .border-blue-100 { border-color: #dbeafe !important; }
        .pdf-mode .border-blue-200 { border-color: #bfdbfe !important; }
        .pdf-mode .border-red-100 { border-color: #fee2e2 !important; }
      `}} />

      {/* Minimalist Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-100 py-5 px-6 sticky top-0 z-40 print:hidden">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-200">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 tracking-tight uppercase">Ficha Médica</h1>
              <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-[0.2em] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                Protocolo de Emergência Ativo
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block">ID do Paciente</span>
              <span className="text-xs font-mono font-bold text-slate-900">{userData.id}</span>
            </div>
            <button 
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="p-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors border border-blue-200 disabled:opacity-50"
              title="Baixar PDF"
            >
              {isDownloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-8 pb-24 print-container">
        {/* Hero Section - Identity */}
        <section className="relative group">
          <div className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-xl shadow-slate-200/40 border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50/30 rounded-full -mr-48 -mt-48 blur-3xl opacity-40 group-hover:opacity-60 transition-opacity duration-1000"></div>
            
            <div className="flex flex-col md:flex-row gap-8 items-center md:items-start relative z-10">
              <div className="relative shrink-0">
                <div className="w-32 h-32 md:w-40 md:h-40 bg-slate-900 rounded-[2rem] flex items-center justify-center text-5xl md:text-6xl font-black text-white shadow-2xl shadow-slate-300 border-[8px] border-white font-display italic overflow-hidden">
                  {userData.nome_completo.charAt(0)}
                </div>
                <div className="absolute -bottom-1 -right-1 w-12 h-12 badge-verified rounded-xl flex items-center justify-center text-white border-4 border-white shadow-lg">
                  <Activity size={20} />
                </div>
              </div>

              <div className="flex-1 text-center md:text-left space-y-4">
                <div>
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-md text-[9px] font-black uppercase tracking-widest border border-blue-100">Paciente Verificado</span>
                    <span className="text-slate-300 font-bold text-xs">/</span>
                    <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest">{userData.id}</span>
                  </div>
                  <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter leading-tight mb-2">
                    {userData.nome_completo}
                  </h2>
                  <div className="flex flex-wrap justify-center md:justify-start gap-2">
                    <div className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black flex items-center gap-2 border border-red-100 uppercase tracking-widest shadow-sm">
                      <Heart size={14} className="fill-red-600" />
                      Tipo Sanguíneo: {userData.tipo_sanguineo || 'N/A'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-6 border-t border-slate-50">
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Nascimento</span>
                    <span className="text-sm font-bold text-slate-700">{userData.data_nascimento || '---'}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Sexo</span>
                    <span className="text-sm font-bold text-slate-700">{translateValue(userData.sexo)}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Telefone</span>
                    <span className="text-sm font-bold text-slate-700">{userData.telefone || '---'}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Cartão SUS</span>
                    <span className="text-sm font-bold text-slate-700">{userData.cartao_sus || '---'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Medical Information Grid */}
        <section className="space-y-6">
          <div className="section-title">Informações Médicas Críticas</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Alergias - High Priority Card */}
            <div className={`p-8 rounded-[2rem] border-2 transition-all duration-500 ${userData.alergias ? 'bg-red-50 border-red-100 shadow-lg shadow-red-100/30' : 'bg-slate-50 border-slate-100'} group`}>
              <div className="flex items-center gap-4 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${userData.alergias ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-400'}`}>
                  <AlertTriangle size={20} />
                </div>
                <h4 className="font-black text-slate-900 uppercase tracking-tight text-base">Alergias</h4>
              </div>
              <p className={`text-lg font-bold leading-snug tracking-tight ${userData.alergias ? 'text-red-900' : 'text-slate-400 italic'}`}>
                {userData.alergias || 'Nenhuma alergia crítica informada pelo paciente.'}
              </p>
            </div>

            {/* Medicamentos Card */}
            <div className="p-8 bg-white rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-lg hover:shadow-slate-200/40 transition-all duration-500 group">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                  <Pill size={20} />
                </div>
                <h4 className="font-black text-slate-900 uppercase tracking-tight text-base">Medicamento Continuo</h4>
              </div>
              <p className="text-lg font-bold text-slate-700 leading-snug tracking-tight">
                {userData.medicamentos || 'Nenhum medicamento de uso contínuo informado.'}
              </p>
            </div>

            {/* Condições Card */}
            <div className="p-8 bg-white rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-lg hover:shadow-slate-200/40 transition-all duration-500 group">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
                  <Activity size={20} />
                </div>
                <h4 className="font-black text-slate-900 uppercase tracking-tight text-base">Condições Crônicas</h4>
              </div>
              <p className="text-lg font-bold text-slate-700 leading-snug tracking-tight">
                {userData.condicoes_preexistentes || 'Nenhuma condição clínica relevante informada.'}
              </p>
            </div>

            {/* Vacina Card */}
            <div className="p-8 bg-white rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-lg hover:shadow-slate-200/40 transition-all duration-500 group">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-all">
                  <Activity size={20} />
                </div>
                <h4 className="font-black text-slate-900 uppercase tracking-tight text-base">Última Vacina</h4>
              </div>
              <p className="text-lg font-bold text-slate-700 leading-snug tracking-tight">
                {userData.ultima_vacina || 'Nenhuma informação de vacina registrada.'}
              </p>
            </div>

            {/* Health Insurance - Clean Section */}
            <div className="p-8 bg-white text-slate-900 rounded-[2rem] group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 blur-3xl group-hover:scale-125 transition-transform duration-1000"></div>
              
              <div className="flex items-center gap-4 mb-6 relative z-10">
                <div className="w-10 h-10 bg-slate-50 text-slate-600 rounded-xl flex items-center justify-center border border-slate-100">
                  <CreditCard size={20} />
                </div>
                <h4 className="font-black uppercase tracking-tight text-base text-slate-900">Plano de Saúde</h4>
              </div>

              <div className="space-y-2 relative z-10 insurance-details">
                {userData.plano_saude_nome ? (
                  <>
                    <div className="mb-2">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] block mb-0.5">Operadora</span>
                      <span className="text-xl font-black leading-tight text-slate-900">{userData.plano_saude_nome}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] block mb-0.5">Nº Identificação</span>
                        <span className="text-xs font-mono font-bold tracking-wider leading-none text-slate-700">{userData.plano_saude_numero || '---'}</span>
                      </div>
                      <div>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] block mb-0.5">Categoria</span>
                        <span className="text-xs font-bold italic leading-none text-slate-700">{userData.plano_saude_tipo || '---'}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="py-2">
                    <p className="text-slate-300 italic font-medium text-sm">Informações de convênio não disponíveis.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Emergency Contacts - High Impact Section */}
        <section className="space-y-6">
          <div className="section-title">Contatos de Emergência</div>
          
          <div className="bg-white rounded-[2.5rem] p-8 md:p-12 border border-blue-100 shadow-xl shadow-blue-50 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-50/50 rounded-full -mr-48 -mt-48 blur-3xl opacity-40 group-hover:opacity-60 transition-opacity duration-1000"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="space-y-4 max-w-xl">
                <div className="flex items-center gap-2 text-blue-600 font-black uppercase tracking-[0.3em] text-[10px]">
                  <Phone size={14} /> Telefone de Contato
                </div>
                <p className="text-3xl md:text-4xl font-black leading-tight tracking-tighter whitespace-pre-line text-slate-900">
                  {userData.contatos_emergencia || 'Nenhum contato de emergência cadastrado.'}
                </p>
                <p className="text-slate-500 text-xs font-medium leading-relaxed">
                  Em caso de acidente ou mal-estar súbito, favor entrar em contato com os números acima imediatamente.
                </p>
              </div>
              
              <a 
                href={`tel:${getEmergencyPhone(userData.contatos_emergencia || '')}`}
                className="inline-flex items-center justify-center gap-4 bg-blue-600 text-white px-8 py-5 rounded-[1.5rem] font-black uppercase tracking-tighter italic text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 active:scale-95 shrink-0"
              >
                <Phone size={24} className="fill-white" />
                Ligar Agora
              </a>
            </div>
          </div>
        </section>

        {/* Observations Section */}
        {userData.observacoes && (
          <section className="space-y-6">
            <div className="section-title">Observações Complementares</div>
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-slate-200"></div>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-slate-50 text-slate-400 rounded-2xl">
                  <Info size={24} />
                </div>
                <p className="text-slate-600 font-medium leading-relaxed text-lg italic">
                  "{userData.observacoes}"
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row gap-4 no-print pt-10">
          <button 
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="flex-1 bg-blue-600 text-white font-black py-6 rounded-[2rem] flex items-center justify-center gap-4 text-xl shadow-2xl hover:bg-blue-700 transition-all active:scale-95 uppercase tracking-tighter italic font-display disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isDownloading ? (
              <>
                <Loader2 size={24} className="animate-spin" /> Gerando PDF...
              </>
            ) : (
              <>
                <Download size={24} /> Baixar Ficha em PDF
              </>
            )}
          </button>
          <button 
            onClick={() => navigate('/login')}
            className="px-10 bg-white text-slate-400 border border-slate-200 font-black py-6 rounded-[2rem] hover:bg-slate-50 transition-all active:scale-95 uppercase tracking-widest text-xs italic"
          >
            Sair do Perfil
          </button>
        </div>
      </main>

      <footer className="py-16 px-6 text-center no-print">
        <div className="max-w-4xl mx-auto border-t border-slate-100 pt-10">
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center gap-3 text-slate-300 font-black uppercase tracking-[0.5em] text-[11px] italic">
              <ShieldAlert size={16} /> Info+Saúde &bull; Protocolo de Vida
            </div>
            <div className="space-y-2">
              <p className="text-[10px] text-slate-400 font-bold max-w-md mx-auto leading-relaxed uppercase tracking-widest">
                Este documento contém informações de saúde protegidas. O uso indevido é passível de sanções legais conforme a LGPD.
              </p>
              <p className="text-[9px] text-slate-300 font-medium">
                Última sincronização: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
