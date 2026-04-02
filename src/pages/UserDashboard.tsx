import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, addDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Usuario, Anexo } from '../types';
import Layout from '../components/Layout';
import { useAuth } from '../App';
import { Save, User, Heart, AlertTriangle, Pill, Phone, Calendar, CreditCard, CheckCircle2, ShieldAlert, Activity, HeartPulse, Printer, Download, Loader2, FileUp, FileText, Trash2, Paperclip, ExternalLink, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function UserDashboard() {
  const navigate = useNavigate();
  const { user, userData: initialUserData, loading: authLoading } = useAuth();
  const [userData, setUserData] = useState<Usuario | null>(initialUserData);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [deleteConfirmAnexo, setDeleteConfirmAnexo] = useState<Anexo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (!file.type.startsWith('image/')) {
          resolve(result);
          return;
        }

        const img = new Image();
        img.src = result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Max dimension 800px for Firestore storage (staying well under 1MB)
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // 0.6 quality to ensure small size
          const base64 = canvas.toDataURL('image/jpeg', 0.6);
          resolve(base64);
        };
      };
    });
  };

  useEffect(() => {
    setUserData(initialUserData);
  }, [initialUserData]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !userData) return;

    setLoading(true);
    try {
      const base64 = await compressImage(file);
      
      // Update local state
      setUserData({ ...userData, foto: base64 });
      
      // Save to Firestore
      const docId = userData.uid || user.uid;
      const userRef = doc(db, 'usuarios', docId);
      await setDoc(userRef, { foto: base64 }, { merge: true });
      
      setSuccess('Foto de perfil atualizada com sucesso!');
    } catch (err: any) {
      console.error('Erro ao carregar foto:', err);
      setError('Erro ao carregar foto: ' + (err.message || 'Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, tipo: 'laudo' | 'receita') => {
    const originalFile = e.target.files?.[0];
    if (!originalFile || !user || !userData) return;

    setUploading(true);
    setUploadProgress(20);
    setError('');
    setSuccess('');

    try {
      // Compress and get Base64
      const base64 = await compressImage(originalFile);
      setUploadProgress(60);

      // Validar tamanho (máximo 1MB para Firestore document)
      if (base64.length > 1000000) {
        setError('O arquivo é muito grande mesmo após compressão. Tente uma imagem menor.');
        setUploading(false);
        return;
      }

      const fileId = Date.now().toString();
      const docId = userData.uid || user.uid;
      
      // Save content to subcollection
      const contentRef = doc(db, 'usuarios', docId, 'anexos_data', fileId);
      await setDoc(contentRef, {
        content: base64,
        mimeType: originalFile.type || (originalFile.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg')
      });
      setUploadProgress(90);

      const newAnexo: Anexo = {
        id: fileId,
        nome: originalFile.name,
        data: new Date().toISOString(),
        tipo: tipo
      };

      const updatedAnexos = [...(userData.anexos || []), newAnexo];
      
      // Atualizar estado local
      setUserData({ ...userData, anexos: updatedAnexos });
      
      // Salvar metadados no documento principal
      const userRef = doc(db, 'usuarios', docId);
      await setDoc(userRef, { anexos: updatedAnexos }, { merge: true });
      
      setSuccess(`${tipo === 'laudo' ? 'Laudo' : 'Receita'} enviado com sucesso!`);
      setUploadProgress(100);
      
      // Limpar o input
      e.target.value = '';
    } catch (err: any) {
      console.error('Erro no processo de upload:', err);
      setError('Erro ao processar arquivo: ' + (err.message || 'Tente novamente.'));
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  const handleViewAnexo = async (anexo: Anexo) => {
    if (!user || !userData) return;
    
    setLoading(true);
    try {
      const docId = userData.uid || user.uid;
      const contentRef = doc(db, 'usuarios', docId, 'anexos_data', anexo.id);
      const contentSnap = await getDoc(contentRef);
      
      if (contentSnap.exists()) {
        const data = contentSnap.data();
        const base64 = data.content;
        
        const newWindow = window.open();
        if (newWindow) {
          newWindow.document.write(`
            <html>
              <head><title>${anexo.nome}</title></head>
              <body style="margin:0; display:flex; align-items:center; justify-content:center; background:#f1f5f9;">
                ${data.mimeType === 'application/pdf' 
                  ? `<embed src="${base64}" type="application/pdf" width="100%" height="100%">`
                  : `<img src="${base64}" style="max-width:100%; max-height:100%; object-fit:contain; box-shadow:0 10px 25px -5px rgba(0,0,0,0.1);">`
                }
              </body>
            </html>
          `);
        } else {
          setError('Bloqueador de pop-ups impediu a visualização.');
        }
      } else {
        setError('Conteúdo do anexo não encontrado.');
      }
    } catch (err: any) {
      console.error('Erro ao visualizar:', err);
      setError('Erro ao carregar anexo.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadAnexo = async (anexo: Anexo) => {
    if (!user || !userData) return;
    
    setLoading(true);
    try {
      const docId = userData.uid || user.uid;
      const contentRef = doc(db, 'usuarios', docId, 'anexos_data', anexo.id);
      const contentSnap = await getDoc(contentRef);
      
      if (contentSnap.exists()) {
        const data = contentSnap.data();
        const base64 = data.content;
        
        // Criar um link temporário para download
        const link = document.createElement('a');
        link.href = base64;
        link.download = anexo.nome;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setSuccess('Download iniciado!');
      } else {
        setError('Conteúdo do anexo não encontrado.');
      }
    } catch (err: any) {
      console.error('Erro ao baixar:', err);
      setError('Erro ao baixar anexo.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAnexo = (anexo: Anexo) => {
    setDeleteConfirmAnexo(anexo);
  };

  const confirmDeleteAnexo = async () => {
    if (!user || !userData || !deleteConfirmAnexo) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const docId = userData.uid || user.uid;
      
      // Deletar do Firestore (subcoleção)
      const contentRef = doc(db, 'usuarios', docId, 'anexos_data', deleteConfirmAnexo.id);
      await deleteDoc(contentRef);

      // Atualizar lista
      const updatedAnexos = (userData.anexos || []).filter(a => a.id !== deleteConfirmAnexo.id);
      setUserData({ ...userData, anexos: updatedAnexos });

      // Salvar no Firestore
      const userRef = doc(db, 'usuarios', docId);
      await setDoc(userRef, { anexos: updatedAnexos }, { merge: true });
      
      setSuccess('Anexo removido com sucesso!');
      setDeleteConfirmAnexo(null);
    } catch (err: any) {
      console.error('Erro ao deletar:', err);
      setError('Erro ao remover anexo: ' + (err.message || 'Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAllAnexos = async () => {
    if (!user || !userData || !userData.anexos || userData.anexos.length === 0) return;
    
    if (!confirm('Deseja realmente excluir TODOS os anexos? Esta ação não pode ser desfeita.')) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const docId = userData.uid || user.uid;
      
      // Deletar todos da subcoleção
      for (const anexo of userData.anexos) {
        const contentRef = doc(db, 'usuarios', docId, 'anexos_data', anexo.id);
        await deleteDoc(contentRef);
      }

      // Limpar lista no documento principal
      const userRef = doc(db, 'usuarios', docId);
      await setDoc(userRef, { anexos: [] }, { merge: true });
      
      setUserData({ ...userData, anexos: [] });
      setSuccess('Todos os anexos foram removidos!');
    } catch (err: any) {
      console.error('Erro ao deletar todos:', err);
      setError('Erro ao remover anexos: ' + (err.message || 'Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      window.location.href = '/#/login';
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userData) return;

    setLoading(true);
    setSuccess('');
    setError('');

    try {
      // Use the document ID from userData (which might be different from user.uid if fallback was used)
      const docId = userData.uid || user.uid;
      const userRef = doc(db, 'usuarios', docId);
      
      // Remove uid from update data to avoid Firestore errors if it's not in the schema
      const { uid, ...updateData } = userData;
      
      // Remove undefined values to prevent Firestore errors
      const cleanData = Object.entries(updateData).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);
      
      console.log('Salvando dados do usuário:', cleanData);
      
      await setDoc(userRef, {
        ...cleanData,
        plano_saude_nome: userData.plano_saude_nome || '',
        plano_saude_numero: userData.plano_saude_numero || '',
        plano_saude_tipo: userData.plano_saude_tipo || ''
      } as any, { merge: true });
      
      setSuccess('Informações atualizadas com sucesso!');
      setShowSuccessModal(true);
      console.log('Success modal triggered');
    } catch (err: any) {
      console.error('Erro ao atualizar:', err);
      setError('Erro ao atualizar informações: ' + (err.message || 'Tente novamente.'));
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <Layout title="Meu Perfil de Saúde">
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-blue mb-6 shadow-lg shadow-blue-100"></div>
          <p className="text-slate-400 font-black uppercase tracking-widest animate-pulse">Sincronizando Dados...</p>
        </div>
      </Layout>
    );
  }

  if (!userData) {
    return (
      <Layout title="Meu Perfil de Saúde">
        <div className="flex flex-col items-center justify-center py-24 text-center px-4">
          <div className="p-6 bg-red-50 rounded-full mb-6">
            <ShieldAlert size={48} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2 italic font-display uppercase tracking-tighter">Registro Não Encontrado</h2>
          <p className="text-slate-500 max-w-md mb-8 font-medium">
            Não conseguimos localizar seu registro médico no sistema. Por favor, entre em contato com o administrador para verificar seu cadastro.
          </p>
          
          {user && (
            <div className="mb-8 p-4 bg-slate-50 rounded-xl text-left border border-slate-200 w-full max-w-md">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Informações de Depuração:</p>
              <p className="text-xs text-slate-600 font-mono break-all">UID: {user.uid}</p>
              <p className="text-xs text-slate-600 font-mono break-all">Email: {user.email}</p>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-4">
            <button 
              onClick={() => window.location.reload()}
              className="px-8 py-3 bg-brand-blue text-white rounded-xl font-bold hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-100 uppercase tracking-widest italic font-display text-sm"
            >
              Tentar Novamente
            </button>
            <button 
              onClick={handleLogout}
              className="px-8 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all active:scale-95 uppercase tracking-widest italic font-display text-sm"
            >
              Sair da Conta
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Meu Perfil de Saúde">
      <div className="space-y-6 pb-12">
        {/* Status Messages */}
        {success && (
          <div className="p-4 bg-green-50 text-green-700 rounded-2xl flex items-center gap-3 font-bold border border-green-100 animate-in fade-in slide-in-from-top-4 duration-300 text-sm">
            <CheckCircle2 size={18} /> {success}
          </div>
        )}
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-3 font-bold border border-red-100 animate-in fade-in slide-in-from-top-4 duration-300 text-sm">
            <ShieldAlert size={18} /> {error}
          </div>
        )}

        <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Personal Info Section */}
          <div className="bg-white p-6 rounded-[2rem] shadow-lg shadow-slate-100 border border-slate-100 space-y-6 relative overflow-hidden group hover:shadow-xl transition-all duration-500">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-blue/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform"></div>
            
            <div className="flex items-center gap-2 text-brand-blue font-bold uppercase tracking-tighter text-lg italic font-display">
              <div className="p-2 bg-brand-blue/10 rounded-xl">
                <User size={20} />
              </div>
              Informações Pessoais
            </div>
            
            {/* Foto de Perfil */}
            <div className="flex flex-col items-center gap-4 py-4 border-b border-slate-50">
              <div className="relative group">
                <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-xl bg-slate-100 flex items-center justify-center">
                  {userData.foto ? (
                    <img 
                      src={userData.foto} 
                      alt="Foto de Perfil" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <User size={48} className="text-slate-300" />
                  )}
                </div>
                <label className="absolute bottom-0 right-0 p-2.5 bg-brand-blue text-white rounded-full shadow-lg cursor-pointer hover:bg-blue-700 transition-all active:scale-90">
                  <Camera size={18} />
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handlePhotoUpload} 
                    className="hidden" 
                  />
                </label>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Foto de Perfil</p>
                <p className="text-[9px] text-slate-400 mt-1">Clique na câmera para alterar</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="group/field">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1 group-focus-within/field:text-brand-blue transition-colors">Nome Completo</label>
                <input
                  type="text"
                  value={userData.nome_completo}
                  onChange={(e) => setUserData({...userData, nome_completo: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-base font-medium"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Data de Nascimento</label>
                  <input
                    type="date"
                    value={userData.data_nascimento || ''}
                    onChange={(e) => setUserData({...userData, data_nascimento: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all font-medium text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Sexo</label>
                  <select
                    value={userData.sexo || ''}
                    onChange={(e) => setUserData({...userData, sexo: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all font-medium text-sm appearance-none cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Outro">Outro</option>
                    <option value="Não informado">Não informado</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">CPF</label>
                  <input
                    type="text"
                    value={userData.cpf}
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-100 text-slate-400 outline-none cursor-not-allowed font-medium text-sm"
                    readOnly
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nº Identificação</label>
                  <input
                    type="text"
                    value={userData.id}
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-100 text-slate-400 outline-none cursor-not-allowed font-medium text-sm"
                    readOnly
                  />
                </div>
              </div>

              {/* Registration and Validity - Admin Only Editable (Read-only for user) */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Data de Cadastro</label>
                  <div className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-100 text-slate-500 font-medium text-sm">
                    {userData.data_cadastro ? new Date(userData.data_cadastro).toLocaleDateString('pt-BR') : 'N/A'}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-brand-blue uppercase tracking-widest mb-1.5 ml-1">Válido Até</label>
                  <div className="w-full px-4 py-3 rounded-xl border border-brand-blue/5 bg-brand-blue/5 text-brand-blue font-bold text-sm italic font-display">
                    {userData.data_validade ? new Date(userData.data_validade).toLocaleDateString('pt-BR') : 'N/A'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1 group-focus-within/field:text-brand-blue transition-colors group-focus-within/field:text-brand-blue transition-colors">Cartão SUS</label>
                  <input
                    type="text"
                    value={userData.cartao_sus || ''}
                    onChange={(e) => setUserData({...userData, cartao_sus: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all font-medium text-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Telefone</label>
                  <input
                    type="text"
                    value={userData.telefone || ''}
                    onChange={(e) => setUserData({...userData, telefone: e.target.value})}
                    placeholder="(00) 00000-0000"
                    className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all font-medium text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Health Info Section */}
          <div className="bg-white p-6 rounded-[2rem] shadow-lg shadow-slate-100 border border-slate-100 space-y-6 relative overflow-hidden group hover:shadow-xl transition-all duration-500">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-green/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform"></div>
            
            <div className="flex items-center gap-2 text-brand-green font-bold uppercase tracking-tighter text-lg italic font-display">
              <div className="p-2 bg-brand-green/10 rounded-xl">
                <Heart size={20} />
              </div>
              Dados de Saúde
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Tipo Sanguíneo</label>
                <select
                  value={userData.tipo_sanguineo || ''}
                  onChange={(e) => setUserData({...userData, tipo_sanguineo: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green outline-none transition-all font-bold text-base appearance-none cursor-pointer"
                >
                  <option value="">Selecione...</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Última Vacina</label>
                <input
                  type="text"
                  value={userData.ultima_vacina || ''}
                  onChange={(e) => setUserData({...userData, ultima_vacina: e.target.value})}
                  placeholder="Ex: Gripe - 10/2023"
                  className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green outline-none transition-all font-medium text-sm"
                />
              </div>
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-[10px] font-black text-brand-green uppercase tracking-[0.2em] mb-4 italic font-display">Plano de Saúde</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Operadora</label>
                    <input
                      type="text"
                      value={userData.plano_saude_nome || ''}
                      onChange={(e) => setUserData({...userData, plano_saude_nome: e.target.value})}
                      placeholder="Ex: Unimed, Bradesco..."
                      className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green outline-none transition-all font-medium text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nº do Cartão</label>
                    <input
                      type="text"
                      value={userData.plano_saude_numero || ''}
                      onChange={(e) => setUserData({...userData, plano_saude_numero: e.target.value})}
                      placeholder="0000 0000 0000 0000"
                      className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green outline-none transition-all font-medium text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Tipo do Plano</label>
                    <textarea
                      value={userData.plano_saude_tipo || ''}
                      onChange={(e) => setUserData({...userData, plano_saude_tipo: e.target.value})}
                      placeholder="Ex: Enfermaria, Apartamento..."
                      className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green outline-none transition-all font-medium text-sm h-20 resize-none"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-2">
                  <AlertTriangle size={12} className="text-amber-500" /> Alergias
                </label>
                <textarea
                  value={userData.alergias || ''}
                  onChange={(e) => setUserData({...userData, alergias: e.target.value})}
                  placeholder="Liste suas alergias..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green outline-none transition-all h-24 resize-none font-medium text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1 flex items-center gap-2">
                  <Pill size={12} className="text-blue-500" /> Medicamento Continuo
                </label>
                <textarea
                  value={userData.medicamentos || ''}
                  onChange={(e) => setUserData({...userData, medicamentos: e.target.value})}
                  placeholder="Liste os medicamentos que você toma..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-green/10 focus:border-brand-green outline-none transition-all h-24 resize-none font-medium text-sm"
                />
              </div>
            </div>
          </div>

          {/* Attachments Section */}
          <div className="bg-white p-6 rounded-[2rem] shadow-lg shadow-slate-100 border border-slate-100 space-y-6 relative overflow-hidden group hover:shadow-xl transition-all duration-500 md:col-span-2">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-blue/5 rounded-full -mr-12 -mt-12 group-hover:scale-110 transition-transform"></div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-brand-blue font-bold uppercase tracking-tighter text-lg italic font-display">
                <div className="p-2 bg-brand-blue/10 rounded-xl">
                  <Paperclip size={20} />
                </div>
                Anexos (Laudos e Receitas)
              </div>
              <div className="flex items-center gap-3">
                {userData.anexos && userData.anexos.length > 0 && (
                  <button
                    onClick={handleDeleteAllAnexos}
                    className="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-widest transition-colors flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Excluir Todos
                  </button>
                )}
                {uploading && (
                  <div className="flex items-center gap-2 text-brand-blue text-xs font-bold animate-pulse">
                    <Loader2 size={14} className="animate-spin" /> {uploadProgress}% ENVIANDO...
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Upload Buttons */}
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 hover:border-brand-blue/50 transition-all group/upload relative overflow-hidden">
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(e, 'laudo')}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={uploading}
                  />
                  <div className="flex flex-col items-center justify-center text-center space-y-2">
                    <div className="p-3 bg-white rounded-xl shadow-sm text-slate-400 group-hover/upload:text-brand-blue transition-colors">
                      {uploading ? <Loader2 size={24} className="animate-spin text-brand-blue" /> : <FileUp size={24} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Anexar Laudo Médico</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest">PDF, JPG ou PNG (Máx 5MB)</p>
                    </div>
                  </div>
                  {uploading && (
                    <div 
                      className="absolute bottom-0 left-0 h-1 bg-brand-blue transition-all duration-300" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  )}
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 hover:border-brand-green/50 transition-all group/upload relative overflow-hidden">
                  <input
                    type="file"
                    onChange={(e) => handleFileUpload(e, 'receita')}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    accept=".pdf,.jpg,.jpeg,.png"
                    disabled={uploading}
                  />
                  <div className="flex flex-col items-center justify-center text-center space-y-2">
                    <div className="p-3 bg-white rounded-xl shadow-sm text-slate-400 group-hover/upload:text-brand-green transition-colors">
                      {uploading ? <Loader2 size={24} className="animate-spin text-brand-green" /> : <FileUp size={24} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Anexar Receita</p>
                      <p className="text-[10px] text-slate-400 uppercase tracking-widest">PDF, JPG ou PNG (Máx 5MB)</p>
                    </div>
                  </div>
                  {uploading && (
                    <div 
                      className="absolute bottom-0 left-0 h-1 bg-brand-green transition-all duration-300" 
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  )}
                </div>
              </div>

              {/* Attachments List */}
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {userData.anexos && userData.anexos.length > 0 ? (
                  userData.anexos.map((anexo) => (
                    <div key={anexo.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group/item">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className={`p-2 rounded-lg shrink-0 ${anexo.tipo === 'laudo' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                          <FileText size={18} />
                        </div>
                        <div className="overflow-hidden">
                          <p className="text-xs font-bold text-slate-900 truncate">{anexo.nome}</p>
                          <p className="text-[9px] text-slate-400 uppercase tracking-widest">
                            {anexo.tipo === 'laudo' ? 'Laudo' : 'Receita'} • {new Date(anexo.data).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleViewAnexo(anexo)}
                          className="p-2 text-slate-400 hover:text-brand-blue transition-colors"
                          title="Visualizar"
                        >
                          <ExternalLink size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadAnexo(anexo)}
                          className="p-2 text-slate-400 hover:text-brand-green transition-colors"
                          title="Baixar"
                        >
                          <Download size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAnexo(anexo)}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Paperclip size={32} className="text-slate-200 mb-2" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhum anexo encontrado</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Emergency Section */}
          <div className="bg-brand-gradient p-8 rounded-[2.5rem] shadow-xl shadow-blue-200 text-white space-y-6 md:col-span-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24 blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16 blur-2xl"></div>

            <div className="relative z-10">
              <div className="flex items-center gap-2 font-bold uppercase tracking-tighter text-xl italic font-display mb-6">
                <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-xl border border-white/30">
                  <Phone size={24} />
                </div>
                Contatos e Condições de Emergência
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="block text-[10px] font-bold text-white/60 uppercase tracking-widest ml-1">Contatos (Nome e Telefone)</label>
                  <textarea
                    value={userData.contatos_emergencia || ''}
                    onChange={(e) => setUserData({...userData, contatos_emergencia: e.target.value})}
                    placeholder="Ex: Maria (Esposa) - (11) 99999-9999"
                    className="w-full px-5 py-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 focus:bg-white/20 focus:ring-4 focus:ring-white/20 outline-none h-32 resize-none font-bold text-base placeholder:text-white/30"
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-[10px] font-bold text-white/60 uppercase tracking-widest ml-1">Condições Preexistentes</label>
                  <textarea
                    value={userData.condicoes_preexistentes || ''}
                    onChange={(e) => setUserData({...userData, condicoes_preexistentes: e.target.value})}
                    placeholder="Ex: Diabetes, Hipertensão..."
                    className="w-full px-5 py-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 focus:bg-white/20 focus:ring-4 focus:ring-white/20 outline-none h-32 resize-none font-bold text-base placeholder:text-white/30"
                  />
                </div>
                <div className="space-y-3 md:col-span-2">
                  <label className="block text-[10px] font-bold text-white/60 uppercase tracking-widest ml-1">Observações</label>
                  <textarea
                    value={userData.observacoes || ''}
                    onChange={(e) => setUserData({...userData, observacoes: e.target.value})}
                    placeholder="Informações adicionais importantes..."
                    className="w-full px-5 py-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 focus:bg-white/20 focus:ring-4 focus:ring-white/20 outline-none h-32 resize-none font-bold text-base placeholder:text-white/30"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 sm:px-12 py-4 rounded-2xl shadow-xl shadow-slate-300 transition-all active:scale-95 flex items-center justify-center gap-3 text-base sm:text-lg italic font-display uppercase tracking-widest"
            >
              {loading ? 'SALVANDO...' : (
                <>
                  <Save size={22} /> SALVAR FICHA MÉDICA
                </>
              )}
            </button>
            
            <button
              type="button"
              onClick={() => {
                navigate(`/public-profile/${userData.id || userData.uid}`);
              }}
              className="w-full sm:w-auto bg-white hover:bg-slate-50 text-brand-blue border-2 border-brand-blue/20 font-bold px-6 sm:px-12 py-4 rounded-2xl shadow-lg shadow-blue-50 transition-all active:scale-95 flex items-center justify-center gap-3 text-base sm:text-lg italic font-display uppercase tracking-widest"
            >
              <HeartPulse size={22} /> VER PERFIL PÚBLICO
            </button>

            <button
              type="button"
              onClick={() => {
                const printId = userData.id || userData.uid;
                navigate(`/public-profile/${printId}?download=true`);
              }}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 sm:px-12 py-4 rounded-2xl shadow-xl shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-3 text-base sm:text-lg italic font-display uppercase tracking-widest"
            >
              <Download size={22} /> BAIXAR PDF
            </button>
          </div>
        </form>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmAnexo && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight italic font-display uppercase">Excluir Arquivo?</h3>
              <p className="text-slate-500 font-medium leading-relaxed mb-8">
                Deseja realmente excluir o arquivo <span className="font-bold text-slate-900">"{deleteConfirmAnexo.nome}"</span>? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmAnexo(null)}
                  className="flex-1 px-6 py-4 rounded-2xl border-2 border-slate-100 font-bold text-slate-400 hover:bg-slate-50 transition-all uppercase tracking-widest italic font-display text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteAnexo}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-red-100 uppercase tracking-widest italic font-display text-sm"
                >
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-500">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 border border-slate-100">
            <div className="bg-brand-gradient h-24 flex items-center justify-center text-white">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30">
                <CheckCircle2 size={32} />
              </div>
            </div>
            <div className="p-8 text-center">
              <h3 className="text-2xl font-bold text-slate-900 mb-3 tracking-tighter italic font-display">DADOS SALVOS!</h3>
              <p className="text-slate-500 mb-8 font-medium leading-relaxed text-sm">
                Suas informações de saúde foram atualizadas com sucesso e já estão disponíveis para consulta em caso de emergência através do seu QR Code.
              </p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-all active:scale-95 shadow-lg shadow-slate-200 uppercase tracking-widest italic font-display text-sm"
              >
                ENTENDIDO
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
