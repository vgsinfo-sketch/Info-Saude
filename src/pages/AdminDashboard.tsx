import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc, deleteDoc, updateDoc, where, onSnapshot, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Usuario, Anexo } from '../types';
import Layout from '../components/Layout';
import { Plus, Search, User, Trash2, Edit2, QrCode, X, Save, ShieldAlert, CheckCircle2, ExternalLink, Copy, Eye, ArrowLeft, CreditCard, Printer, FileText, Loader2, Download, Upload, Camera } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, updatePassword, signInWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restoreData, setRestoreData] = useState<any[] | null>(null);
  const [formData, setFormData] = useState<Partial<Usuario>>({
    nome_completo: '',
    cpf: '',
    id: '',
    role: 'user',
    plano_saude_nome: '',
    plano_saude_numero: '',
    plano_saude_tipo: '',
    data_nascimento: '',
    sexo: '',
    data_cadastro: '',
    data_validade: '',
    foto: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteConfirmAnexo, setDeleteConfirmAnexo] = useState<Anexo | null>(null);
  const [loadingAnexo, setLoadingAnexo] = useState(false);

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

  const handleViewAnexo = async (anexo: Anexo) => {
    if (!selectedUser) return;
    
    setLoadingAnexo(true);
    try {
      const docId = selectedUser.uid || selectedUser.id;
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
        }
      }
    } catch (err) {
      console.error('Erro ao visualizar:', err);
    } finally {
      setLoadingAnexo(false);
    }
  };

  const handleDownloadAnexo = async (anexo: Anexo) => {
    if (!selectedUser) return;
    
    setLoadingAnexo(true);
    try {
      const docId = selectedUser.uid || selectedUser.id;
      const contentRef = doc(db, 'usuarios', docId, 'anexos_data', anexo.id);
      const contentSnap = await getDoc(contentRef);
      
      if (contentSnap.exists()) {
        const data = contentSnap.data();
        const base64 = data.content;
        
        const link = document.createElement('a');
        link.href = base64;
        link.download = anexo.nome;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (err) {
      console.error('Erro ao baixar:', err);
    } finally {
      setLoadingAnexo(false);
    }
  };

  const handleDeleteAnexo = (anexo: Anexo) => {
    setDeleteConfirmAnexo(anexo);
  };

  const confirmDeleteAnexo = async () => {
    if (!selectedUser || !deleteConfirmAnexo) return;

    setLoadingAnexo(true);
    try {
      const docId = selectedUser.uid || selectedUser.id;
      
      // Deletar do Firestore (subcoleção)
      const contentRef = doc(db, 'usuarios', docId, 'anexos_data', deleteConfirmAnexo.id);
      await deleteDoc(contentRef);

      // Atualizar lista no documento principal
      const updatedAnexos = (selectedUser.anexos || []).filter(a => a.id !== deleteConfirmAnexo.id);
      const userRef = doc(db, 'usuarios', docId);
      await setDoc(userRef, { anexos: updatedAnexos }, { merge: true });
      
      // Atualizar estado local do usuário selecionado
      setSelectedUser({ ...selectedUser, anexos: updatedAnexos });
      
      setSuccess('Anexo removido com sucesso!');
      setDeleteConfirmAnexo(null);
    } catch (err: any) {
      console.error('Erro ao deletar:', err);
      setError('Erro ao remover anexo: ' + (err.message || 'Tente novamente.'));
    } finally {
      setLoadingAnexo(false);
    }
  };

  const handleDeleteAllAnexos = async () => {
    if (!selectedUser || !selectedUser.anexos || selectedUser.anexos.length === 0) return;
    
    if (!confirm(`Deseja realmente excluir TODOS os anexos do usuário ${selectedUser.nome_completo}? Esta ação não pode ser desfeita.`)) return;

    setLoadingAnexo(true);
    try {
      const docId = selectedUser.uid || selectedUser.id;
      
      // Deletar todos da subcoleção
      for (const anexo of selectedUser.anexos) {
        const contentRef = doc(db, 'usuarios', docId, 'anexos_data', anexo.id);
        await deleteDoc(contentRef);
      }

      // Limpar lista no documento principal
      const userRef = doc(db, 'usuarios', docId);
      await setDoc(userRef, { anexos: [] }, { merge: true });
      
      // Atualizar estado local
      setSelectedUser({ ...selectedUser, anexos: [] });
      setSuccess('Todos os anexos foram removidos!');
    } catch (err: any) {
      console.error('Erro ao deletar todos:', err);
      setError('Erro ao remover anexos: ' + (err.message || 'Tente novamente.'));
    } finally {
      setLoadingAnexo(false);
    }
  };

  const handleFirestoreError = (err: any, operation: string, path: string) => {
    const errInfo = {
      error: err.message || String(err),
      operation,
      path,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified
      }
    };
    console.error(`Erro no Firestore (${operation}):`, JSON.stringify(errInfo, null, 2));
    setError(`Erro ao ${operation}: ${err.message || 'Erro desconhecido'}. Verifique o console para detalhes técnicos.`);
  };

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    
    setLoading(true);
    setError('');
    console.log('Setting up users snapshot listener...');
    
    // Add a timeout to avoid infinite loading if snapshot takes too long to initial fire
    const timeoutId = setTimeout(() => {
      if (loading) {
        setLoading(false);
        setError('A sincronização está demorando mais que o esperado. Verifique sua conexão ou tente recarregar a página.');
      }
    }, 15000);

    try {
      const q = query(collection(db, 'usuarios'));
      unsubscribe = onSnapshot(q, (querySnapshot) => {
        clearTimeout(timeoutId);
        console.log('Users snapshot received. Size:', querySnapshot.size, 'Empty:', querySnapshot.empty);
        const usersData = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as Usuario));
        setUsuarios(usersData);
        setLoading(false);
      }, (err) => {
        clearTimeout(timeoutId);
        console.error('Error in users snapshot listener:', err);
        setError(`Erro ao carregar usuários: ${err.message}. Verifique se as regras do Firestore estão corretas e se você está logado.`);
        setLoading(false);
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('Error setting up users listener:', err);
      setError(`Erro ao configurar sincronização: ${err.message}`);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  const handleExportData = () => {
    try {
      const dataStr = JSON.stringify(usuarios, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
      
      const exportFileDefaultName = `Backup_InfoSaude_${new Date().toISOString().split('T')[0]}.json`;
      
      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportFileDefaultName);
      linkElement.click();
      
      setSuccess('Backup exportado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao exportar:', err);
      setError('Erro ao exportar backup: ' + err.message);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (Array.isArray(json)) {
          setRestoreData(json);
          setIsRestoreModalOpen(true);
        } else {
          setError('Arquivo inválido. O backup deve ser uma lista de usuários.');
        }
      } catch (err) {
        setError('Erro ao ler arquivo. Certifique-se de que é um JSON válido.');
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const confirmRestore = async () => {
    if (!restoreData) return;
    
    setLoading(true);
    setIsRestoreModalOpen(false);
    let successCount = 0;
    let errorCount = 0;

    try {
      for (const user of restoreData) {
        try {
          const uid = user.uid || user.id;
          if (!uid) continue;
          
          await setDoc(doc(db, 'usuarios', uid), user, { merge: true });
          successCount++;
        } catch (err) {
          console.error('Erro ao restaurar usuário:', user.nome_completo, err);
          errorCount++;
        }
      }
      
      setSuccess(`Restauração concluída! ${successCount} usuários restaurados.${errorCount > 0 ? ` ${errorCount} erros.` : ''}`);
      setRestoreData(null);
    } catch (err: any) {
      setError('Erro crítico na restauração: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedData = async () => {
    setIsSeedModalOpen(false);
    setLoading(true);
    try {
      const testUser: Usuario = {
        uid: 'TEST_USER_' + Date.now(),
        id: 'TEST123',
        nome_completo: 'Usuário de Teste InfoSaúde',
        cpf: '123.456.789-00',
        data_nascimento: '1990-01-01',
        sexo: 'Masculino',
        tipo_sanguineo: 'O+',
        alergias: 'Nenhuma',
        medicamentos: 'Nenhum',
        condicoes: 'Saudável',
        contato_emergencia_nome: 'Emergência',
        contato_emergencia_tel: '(00) 00000-0000',
        role: 'user',
        email: 'teste@infosaude.com'
      };
      
      await setDoc(doc(db, 'usuarios', testUser.uid), testUser);
      setSuccess('Usuário de teste criado com sucesso! Se ele não aparecer na lista, verifique as regras do Firestore.');
    } catch (err: any) {
      console.error('Erro ao criar usuário de teste:', err);
      setError('Erro ao criar usuário de teste: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.nome_completo || !formData.cpf || !formData.id) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }

    try {
      // Clean CPF for consistency
      const cleanCpf = formData.cpf?.replace(/\D/g, '') || '';
      
      // Check if ID already exists
      const idCheck = usuarios.find(u => u.id === formData.id);
      if (idCheck) {
        setError('Este ID de cartão já está em uso.');
        return;
      }

      // To create a user without logging out the admin, we use a secondary app instance
      let secondaryApp;
      if (getApps().some(app => app.name === 'SecondaryApp')) {
        secondaryApp = getApp('SecondaryApp');
      } else {
        secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
      }
      const secondaryAuth = getAuth(secondaryApp);
      
      const email = `${cleanCpf}@infosaude.com`;
      const trimmedId = (formData.id?.trim() || '').toUpperCase();
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, trimmedId);
      const newUserUid = userCredential.user.uid;

      // Calculate registration and validity dates
      const today = new Date();
      const nextYear = new Date();
      nextYear.setFullYear(today.getFullYear() + 1);

      const finalData = {
        ...formData,
        cpf: cleanCpf, // Store cleaned CPF
        email: email, // Store email for easier lookup
        id: trimmedId,
        uid: newUserUid,
        role: 'user',
        data_cadastro: today.toISOString().split('T')[0],
        data_validade: nextYear.toISOString().split('T')[0]
      };

      // Remove undefined values to prevent Firestore errors
      const cleanData = Object.entries(finalData).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);

      // Save to Firestore
      try {
        await setDoc(doc(db, 'usuarios', newUserUid), cleanData);
      } catch (fsErr) {
        handleFirestoreError(fsErr, 'criar documento no banco de dados', `usuarios/${newUserUid}`);
        return;
      }

      // Cleanup secondary app
      await signOut(secondaryAuth);
      
      setSuccessMessage('Usuário criado com sucesso!');
      setIsSuccessModalOpen(true);
      console.log('Admin success modal triggered (create)');
      setIsModalOpen(false);
      setFormData({ 
        nome_completo: '', 
        cpf: '', 
        id: '', 
        role: 'user',
        plano_saude_nome: '',
        plano_saude_numero: '',
        plano_saude_tipo: ''
      });
    } catch (err: any) {
      console.error(err);
      setError('Erro ao criar usuário: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedUser || !formData.nome_completo || !formData.id) {
      setError('Por favor, preencha os campos obrigatórios (Nome e ID).');
      return;
    }

    try {
      const trimmedId = formData.id.trim();
      const cleanCpf = formData.cpf?.replace(/\D/g, '') || '';
      const userRef = doc(db, 'usuarios', selectedUser.uid);
      
      console.log('Atualizando usuário no Firestore:', selectedUser.uid, { ...formData, cpf: cleanCpf });
      
      // If ID changed, we should try to update the Auth password
      if (trimmedId !== selectedUser.id) {
        console.log('ID changed from', selectedUser.id, 'to', trimmedId, '. Attempting to update Auth password...');
        try {
          let secondaryApp;
          if (getApps().some(app => app.name === 'PasswordApp')) {
            secondaryApp = getApp('PasswordApp');
          } else {
            secondaryApp = initializeApp(firebaseConfig, 'PasswordApp');
          }
          const secondaryAuth = getAuth(secondaryApp);
          const email = `${selectedUser.cpf.replace(/\D/g, '')}@infosaude.com`;
          
          // Sign in with OLD ID as password
          console.log('Signing in to secondary app to update password for:', email);
          const userCredential = await signInWithEmailAndPassword(secondaryAuth, email, selectedUser.id);
          // Update to NEW ID as password
          await updatePassword(userCredential.user, trimmedId);
          await signOut(secondaryAuth);
          console.log('Auth password updated successfully to match new ID.');
        } catch (authErr: any) {
          console.error('Failed to update Auth password:', authErr);
          // We continue but warn
          setError('O cadastro foi atualizado no banco, mas não foi possível alterar a senha de acesso (ID). O usuário deve usar a senha antiga ou você deve resetar manualmente.');
        }
      }

      const { uid, ...updateData } = formData;
      const email = `${cleanCpf}@infosaude.com`;
      
      const finalData = {
        ...updateData,
        cpf: cleanCpf,
        email: email,
        id: trimmedId,
        plano_saude_nome: formData.plano_saude_nome || '',
        plano_saude_numero: formData.plano_saude_numero || '',
        plano_saude_tipo: formData.plano_saude_tipo || ''
      };

      // Remove undefined values to prevent Firestore errors
      const cleanData = Object.entries(finalData).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = value;
        }
        return acc;
      }, {} as Record<string, any>);

      console.log('Dados finais para atualização no Firestore:', cleanData);

      try {
        await setDoc(userRef, cleanData as any, { merge: true });
      } catch (fsErr) {
        handleFirestoreError(fsErr, 'atualizar documento no banco de dados', `usuarios/${selectedUser.uid}`);
        return;
      }
      
      setSuccessMessage('Cadastro atualizado com sucesso!');
      setIsSuccessModalOpen(true);
      console.log('Admin success modal triggered');
      setIsEditModalOpen(false);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao atualizar cadastro: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const user = auth.currentUser;
      if (user) {
        await updatePassword(user, newPassword);
        setSuccess('Senha alterada com sucesso!');
        setIsSecurityModalOpen(false);
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      console.error(err);
      setError('Erro ao alterar senha. Talvez você precise fazer login novamente para esta ação.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    setUserToDelete(uid);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'usuarios', userToDelete));
      setUsuarios(usuarios.filter(u => u.uid !== userToDelete));
      setSuccess('Usuário excluído com sucesso!');
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
    } catch (err) {
      handleFirestoreError(err, 'excluir documento no banco de dados', `usuarios/${userToDelete}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsuarios = usuarios.filter(u => 
    (u.nome_completo || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.cpf || '').replace(/\D/g, '').includes(searchTerm.replace(/\D/g, '')) ||
    (u.id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getPublicUrl = (id: string) => {
    // Ensure we have a valid ID, fallback to window.location.origin if needed
    const baseUrl = window.location.origin;
    // Using HashRouter, we need to include the #
    return `${baseUrl}/#/public-profile/${id}`;
  };

  const openPublicLink = (id: string) => {
    navigate(`/public-profile/${id}`);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess('Link copiado para a área de transferência!');
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <Layout title="Painel Administrativo">
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .print-label, .print-label * {
              visibility: visible;
            }
            .print-label {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              height: auto;
              padding: 20px;
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              justify-content: center !important;
              background: white !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>
      <div className="space-y-8 pb-12">
        {/* Actions Bar */}
        <div className="flex flex-col md:flex-row gap-2 justify-between items-center bg-white p-3 rounded-[1.5rem] shadow-lg shadow-slate-100 border border-slate-100">
          <div className="relative w-full md:w-[20rem]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-medium"
            />
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
            <button
              onClick={() => {
                if (auth.currentUser) {
                  signOut(auth).then(() => navigate('/login'));
                } else {
                  window.location.href = '/#/login';
                }
              }}
              className="bg-slate-100 text-slate-600 px-3 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 hover:bg-slate-200 transition-all text-[10px] uppercase tracking-widest italic font-display"
            >
              <ArrowLeft size={14} /> Sair
            </button>
            <button
              onClick={handleRefresh}
              className="bg-slate-100 text-slate-600 px-3 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 hover:bg-slate-200 transition-all text-[10px] uppercase tracking-widest italic font-display"
            >
              <CheckCircle2 size={14} /> Atualizar
            </button>
            <button
              onClick={handleExportData}
              className="bg-slate-100 text-slate-600 px-3 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 hover:bg-slate-200 transition-all text-[10px] uppercase tracking-widest italic font-display"
              title="Backup"
            >
              <Download size={14} /> Backup
            </button>
            <label className="bg-slate-100 text-slate-600 px-3 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 hover:bg-slate-200 transition-all text-[10px] uppercase tracking-widest italic font-display cursor-pointer">
              <Upload size={14} /> Restaurar
              <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
            </label>
            <button
              onClick={() => setIsSeedModalOpen(true)}
              className="bg-amber-50 text-amber-700 px-3 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 hover:bg-amber-100 transition-all text-[10px] uppercase tracking-widest italic font-display border border-amber-200"
            >
              <Plus size={14} /> Teste
            </button>
            <button
              onClick={() => {
                setFormData({ 
                  nome_completo: '', 
                  cpf: '', 
                  id: '', 
                  role: 'user',
                  plano_saude_nome: '',
                  plano_saude_numero: '',
                  plano_saude_tipo: '',
                  data_nascimento: '',
                  sexo: ''
                });
                setIsModalOpen(true);
              }}
              className="bg-brand-gradient hover:opacity-90 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-lg shadow-blue-100 text-xs italic font-display uppercase tracking-tighter"
            >
              <Plus size={16} /> Novo Cadastro
            </button>
            {auth.currentUser && (
              <button
                onClick={() => setIsSecurityModalOpen(true)}
                className="bg-slate-100 text-slate-600 px-3 py-2 rounded-lg font-bold flex items-center justify-center gap-1.5 hover:bg-slate-200 transition-all text-[10px] uppercase tracking-widest italic font-display"
              >
                <Lock size={14} /> Segurança
              </button>
            )}
          </div>
        </div>

        {success && (
          <div className="p-5 bg-green-50 text-green-700 rounded-3xl flex items-center gap-3 font-bold border-2 border-green-100 animate-in fade-in slide-in-from-top-4 duration-300">
            <CheckCircle2 size={22} /> {success}
          </div>
        )}

        {error && (
          <div className="p-5 bg-red-50 text-red-700 rounded-3xl flex items-center gap-3 font-bold border-2 border-red-100 animate-in fade-in slide-in-from-top-4 duration-300">
            <ShieldAlert size={22} /> {error}
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-slate-100 border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Usuário</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identificação</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Link de Emergência</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-16 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-brand-blue"></div>
                        <p className="text-slate-400 font-bold uppercase tracking-widest">Carregando usuários...</p>
                        <button 
                          onClick={() => handleRefresh()}
                          className="mt-4 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors uppercase tracking-widest"
                        >
                          Recarregar
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : filteredUsuarios.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-8 py-16 text-center text-slate-400 font-bold uppercase tracking-widest">Nenhum usuário encontrado.</td>
                  </tr>
                ) : (
                  filteredUsuarios.map((u) => (
                    <tr key={u.uid} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-brand-blue/10 text-brand-blue rounded-xl flex items-center justify-center font-black text-lg italic font-display overflow-hidden shrink-0">
                            {u.foto ? (
                              <img src={u.foto} alt={u.nome_completo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              (u.nome_completo || 'U').charAt(0)
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-xs tracking-tight">{u.nome_completo}</div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                              {u.role === 'admin' ? 'Administrador' : 'Usuário'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="text-slate-600 font-bold text-xs">{u.cpf}</div>
                        <div className="text-[9px] text-brand-blue font-black uppercase tracking-tighter italic font-display">{u.id}</div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => openPublicLink(u.id)}
                            className="text-[9px] bg-brand-blue/5 text-brand-blue px-2 py-0.5 rounded-lg hover:bg-brand-blue/10 transition-colors font-black uppercase tracking-tighter italic font-display flex items-center gap-1"
                          >
                            <ExternalLink size={10} /> Link
                          </button>
                          <button 
                            onClick={() => copyToClipboard(getPublicUrl(u.id))}
                            className="p-1 text-slate-300 hover:text-brand-blue transition-colors rounded-lg hover:bg-brand-blue/5"
                            title="Copiar Link"
                          >
                            <Copy size={14} />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => {
                              setSelectedUser(u);
                              setFormData({
                                nome_completo: '',
                                cpf: '',
                                id: '',
                                role: 'user',
                                plano_saude_nome: '',
                                plano_saude_numero: '',
                                plano_saude_tipo: '',
                                ...u
                              });
                              setIsEditModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/5 rounded-lg transition-all" title="Editar">
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedUser(u);
                              setIsDetailsModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-brand-green hover:bg-brand-green/5 rounded-lg transition-all" title="Detalhes">
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedUser(u);
                              setIsQrModalOpen(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all" title="QR Code">
                            <QrCode size={16} />
                          </button>
                          <button 
                            onClick={() => {
                              const printId = u.id || u.uid;
                              const printUrl = `${getPublicUrl(printId)}?print=true`;
                              console.log('Abrindo nova aba para impressão:', printId, printUrl);
                              
                              // Usar um link temporário para evitar bloqueio de pop-up
                              const link = document.createElement('a');
                              link.href = printUrl;
                              link.target = '_blank';
                              link.rel = 'noopener noreferrer';
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Imprimir">
                            <Printer size={16} />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.uid)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all" title="Excluir">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {isRestoreModalOpen && restoreData && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Upload size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight uppercase italic font-display">Confirmar Restauração</h3>
              <p className="text-slate-500 mb-8 font-medium">
                Você está prestes a restaurar <strong>{restoreData.length}</strong> usuários. Dados existentes com o mesmo ID serão mesclados ou sobrescritos. Deseja continuar?
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setIsRestoreModalOpen(false);
                    setRestoreData(null);
                  }}
                  className="flex-1 px-6 py-3 rounded-xl border-2 border-slate-100 font-bold text-slate-400 hover:bg-slate-50 transition-all uppercase tracking-widest italic font-display text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmRestore}
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-100 uppercase tracking-widest italic font-display text-sm disabled:opacity-50"
                >
                  {loading ? 'Restaurando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Seed Confirmation Modal */}
      {isSeedModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Plus size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2 tracking-tight uppercase italic font-display">Teste de Conexão</h3>
              <p className="text-slate-500 mb-8 font-medium">
                Deseja criar um usuário de teste para verificar a conexão com o banco de dados?
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setIsSeedModalOpen(false)}
                  className="flex-1 px-6 py-3 rounded-xl border-2 border-slate-100 font-bold text-slate-400 hover:bg-slate-50 transition-all uppercase tracking-widest italic font-display text-sm"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSeedData}
                  disabled={loading}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-amber-100 uppercase tracking-widest italic font-display text-sm disabled:opacity-50"
                >
                  {loading ? 'Criando...' : 'Criar Teste'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[60] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Trash2 size={24} />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-1 tracking-tight uppercase italic font-display">Confirmar Exclusão</h3>
              <p className="text-slate-500 mb-6 font-medium text-sm">
                Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 px-4 py-2 rounded-lg border-2 border-slate-100 font-bold text-slate-400 hover:bg-slate-50 transition-all uppercase tracking-widest italic font-display text-[10px]"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteUser}
                  disabled={loading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg transition-all shadow-lg shadow-red-100 uppercase tracking-widest italic font-display text-[10px] disabled:opacity-50"
                >
                  {loading ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-500">
          <div className="bg-white rounded-3xl sm:rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 border border-slate-100 max-h-[95vh] flex flex-col">
            <div className="bg-brand-gradient p-5 sm:p-6 flex justify-between items-center text-white shrink-0">
              <h3 className="text-lg sm:text-xl font-black italic font-display uppercase tracking-tighter">Novo Cadastro de Saúde</h3>
              <button onClick={() => setIsModalOpen(false)} className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto">
              {/* Foto de Perfil */}
              <div className="flex flex-col items-center gap-2 py-2 border-b border-slate-50">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-xl bg-slate-100 flex items-center justify-center">
                    {formData.foto ? (
                      <img 
                        src={formData.foto} 
                        alt="Foto de Perfil" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User size={28} className="text-slate-300" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 p-1.5 bg-brand-blue text-white rounded-full shadow-lg cursor-pointer hover:bg-blue-700 transition-all active:scale-90">
                    <Camera size={12} />
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const base64 = await compressImage(file);
                          setFormData({ ...formData, foto: base64 });
                        }
                      }} 
                      className="hidden" 
                    />
                  </label>
                </div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Foto de Perfil (Opcional)</p>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Nome Completo *</label>
                <input
                  type="text"
                  value={formData.nome_completo}
                  onChange={(e) => setFormData({...formData, nome_completo: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-sm font-medium"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">CPF *</label>
                  <input
                    type="text"
                    value={formData.cpf}
                    onChange={(e) => setFormData({...formData, cpf: e.target.value})}
                    placeholder="000.000.000-00"
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Número de Identificação *</label>
                  <input
                    type="text"
                    value={formData.id}
                    onChange={(e) => setFormData({...formData, id: e.target.value})}
                    placeholder="Ex: INFO-001"
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-bold italic font-display"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Data de Nascimento</label>
                  <input
                    type="date"
                    value={formData.data_nascimento || ''}
                    onChange={(e) => setFormData({...formData, data_nascimento: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Sexo</label>
                  <select
                    value={formData.sexo || ''}
                    onChange={(e) => setFormData({...formData, sexo: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all font-medium text-xs appearance-none cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Outro">Outro</option>
                    <option value="Não informado">Não informado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Cartão SUS</label>
                  <input
                    type="text"
                    value={formData.cartao_sus || ''}
                    onChange={(e) => setFormData({...formData, cartao_sus: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Tipo Sanguíneo</label>
                  <select
                    value={formData.tipo_sanguineo || ''}
                    onChange={(e) => setFormData({...formData, tipo_sanguineo: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all font-bold text-sm appearance-none cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Telefone</label>
                  <input
                    type="text"
                    value={formData.telefone || ''}
                    onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                    placeholder="(00) 00000-0000"
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Última Vacina</label>
                  <input
                    type="text"
                    value={formData.ultima_vacina || ''}
                    onChange={(e) => setFormData({...formData, ultima_vacina: e.target.value})}
                    placeholder="Ex: Gripe - 10/2023"
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-medium"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2 pt-1 border-t border-slate-100">
                  <h4 className="text-[9px] font-black text-brand-blue uppercase tracking-[0.2em] mb-2 italic font-display">Plano de Saúde</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Operadora</label>
                      <input
                        type="text"
                        value={formData.plano_saude_nome || ''}
                        onChange={(e) => setFormData({...formData, plano_saude_nome: e.target.value})}
                        placeholder="Ex: Unimed..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Nº do Cartão</label>
                      <input
                        type="text"
                        value={formData.plano_saude_numero || ''}
                        onChange={(e) => setFormData({...formData, plano_saude_numero: e.target.value})}
                        placeholder="0000..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Tipo do Plano</label>
                      <textarea
                        value={formData.plano_saude_tipo || ''}
                        onChange={(e) => setFormData({...formData, plano_saude_tipo: e.target.value})}
                        placeholder="Ex: Enfermaria..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-medium h-12 resize-none"
                      />
                    </div>
                  </div>
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Contatos de Emergência</label>
                  <textarea
                    value={formData.contatos_emergencia || ''}
                    onChange={(e) => setFormData({...formData, contatos_emergencia: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all h-16 resize-none text-xs font-medium"
                    placeholder="Nome e Telefone..."
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Condições Preexistentes</label>
                  <textarea
                    value={formData.condicoes_preexistentes || ''}
                    onChange={(e) => setFormData({...formData, condicoes_preexistentes: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all h-16 resize-none text-xs font-medium"
                    placeholder="Ex: Diabetes..."
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Alergias</label>
                  <textarea
                    value={formData.alergias || ''}
                    onChange={(e) => setFormData({...formData, alergias: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all h-16 resize-none text-xs font-medium"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Medicamento Contínuo</label>
                  <textarea
                    value={formData.medicamentos || ''}
                    onChange={(e) => setFormData({...formData, medicamentos: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all h-16 resize-none text-xs font-medium"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Observações</label>
                  <textarea
                    value={formData.observacoes || ''}
                    onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all h-16 resize-none text-xs font-medium"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2 pt-1 border-t border-slate-100">
                  <h4 className="text-[9px] font-black text-brand-blue uppercase tracking-[0.2em] mb-2 italic font-display">Validade do Cadastro</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Data de Cadastro</label>
                      <input
                        type="date"
                        value={formData.data_cadastro || ''}
                        onChange={(e) => {
                          const newDate = e.target.value;
                          const validDate = new Date(newDate);
                          validDate.setFullYear(validDate.getFullYear() + 1);
                          setFormData({ 
                             ...formData, 
                             data_cadastro: newDate,
                             data_validade: validDate.toISOString().split('T')[0]
                           });
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Data de Validade (1 Ano)</label>
                      <input
                        type="date"
                        value={formData.data_validade || ''}
                        onChange={(e) => setFormData({...formData, data_validade: e.target.value})}
                        className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-3 py-2 rounded-lg border-2 border-slate-100 font-bold text-slate-400 hover:bg-slate-50 transition-all uppercase tracking-widest italic font-display text-[10px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-lg transition-all shadow-lg shadow-slate-200 uppercase tracking-widest italic font-display text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Salvando...' : 'Salvar Cadastro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {isQrModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-500 no-print">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 border border-slate-100 print-label">
            <div className="bg-brand-gradient p-6 flex justify-between items-center text-white no-print">
              <h3 className="text-xl font-black italic font-display uppercase tracking-tighter">QR Code de Identificação</h3>
              <button onClick={() => setIsQrModalOpen(false)} className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center text-center">
              <div className="bg-white p-4 rounded-[2rem] shadow-2xl shadow-slate-100 border-4 border-brand-blue/10 mb-4">
                <QRCodeSVG 
                  value={getPublicUrl(selectedUser.id)} 
                  size={180}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <h4 className="text-xl font-black text-slate-900 mb-1 tracking-tight">{selectedUser.nome_completo}</h4>
              <p className="text-brand-blue font-black uppercase italic font-display text-base mb-4">Nº Identificação: {selectedUser.id}</p>
              
              <div className="flex gap-2 w-full mb-4 no-print">
                <button
                  onClick={() => openPublicLink(selectedUser.id)}
                  className="flex-1 bg-brand-blue/10 text-brand-blue font-black py-3 rounded-xl hover:bg-brand-blue/20 transition-all flex items-center justify-center gap-2 uppercase tracking-widest italic font-display text-[10px]"
                >
                  <ExternalLink size={14} /> Ver Link
                </button>
                <button
                  onClick={() => copyToClipboard(getPublicUrl(selectedUser.id))}
                  className="flex-1 bg-slate-100 text-slate-600 font-black py-3 rounded-xl hover:bg-slate-200 transition-all flex items-center justify-center gap-2 uppercase tracking-widest italic font-display text-[10px]"
                >
                  <Copy size={14} /> Copiar
                </button>
              </div>

              <p className="text-slate-500 mb-6 font-medium leading-relaxed no-print text-xs">
                Este QR Code aponta para a página pública de emergência do usuário. Imprima e cole no cartão de identificação.
              </p>
              <button
                onClick={() => window.print()}
                className="w-full bg-slate-900 text-white font-black py-4 rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 uppercase tracking-widest italic font-display shadow-xl shadow-slate-200 mb-3 no-print text-[10px]"
              >
                <Printer size={18} /> Imprimir Etiqueta
              </button>
              <button
                onClick={() => setIsQrModalOpen(false)}
                className="w-full bg-white text-slate-400 border-2 border-slate-100 font-black py-3 rounded-xl hover:bg-slate-50 transition-all uppercase tracking-widest italic font-display no-print text-[10px]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {isDetailsModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-500">
          <div className="bg-white rounded-[3rem] w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-500 border border-slate-100">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-brand-gradient text-white rounded-xl flex items-center justify-center font-bold text-xl italic font-display shadow-lg shadow-blue-100 overflow-hidden">
                  {selectedUser.foto ? (
                    <img src={selectedUser.foto} alt={selectedUser.nome_completo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    selectedUser.nome_completo.charAt(0)
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight">{selectedUser.nome_completo}</h3>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-[9px]">Nº Identificação: {selectedUser.id} | CPF: {selectedUser.cpf}</p>
                </div>
              </div>
              <button onClick={() => setIsDetailsModalOpen(false)} className="bg-slate-200/50 hover:bg-slate-200 p-1.5 rounded-lg transition-colors text-slate-500">
                <X size={18} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-900 border-b-2 border-brand-blue/10 pb-1.5 flex items-center gap-2 uppercase tracking-tighter italic font-display text-base">
                    <User size={16} className="text-brand-blue" /> Informações Pessoais
                  </h4>
                  <div className="space-y-2">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Data de Nascimento</span>
                      <span className="text-sm font-bold text-slate-700">{selectedUser.data_nascimento || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Sexo</span>
                      <span className="text-sm font-bold text-slate-700">{selectedUser.sexo || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Cartão SUS</span>
                      <span className="text-sm font-bold text-slate-700">{selectedUser.cartao_sus || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Tipo Sanguíneo</span>
                      <span className="text-lg font-bold text-brand-blue italic font-display">{selectedUser.tipo_sanguineo || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Telefone</span>
                      <span className="text-sm font-bold text-slate-700">{selectedUser.telefone || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Última Vacina</span>
                      <span className="text-sm font-bold text-slate-700">{selectedUser.ultima_vacina || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col p-2 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Data de Cadastro</span>
                      <span className="text-sm font-bold text-slate-700">{selectedUser.data_cadastro ? new Date(selectedUser.data_cadastro).toLocaleDateString('pt-BR') : 'N/A'}</span>
                    </div>
                    <div className="flex flex-col p-2 bg-blue-50 rounded-lg border border-blue-100">
                      <span className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mb-0.5">Válido Até</span>
                      <span className="text-sm font-bold text-blue-900">{selectedUser.data_validade ? new Date(selectedUser.data_validade).toLocaleDateString('pt-BR') : 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-slate-900 border-b-2 border-brand-blue/10 pb-1.5 flex items-center gap-2 uppercase tracking-tighter italic font-display text-base">
                    <CreditCard size={16} className="text-brand-blue" /> Plano de Saúde
                  </h4>
                  <div className="space-y-2">
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Nome do Plano</span>
                      <span className="text-sm font-bold text-slate-700">{selectedUser.plano_saude_nome || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Nº do Cartão</span>
                      <span className="text-sm font-bold text-slate-700">{selectedUser.plano_saude_numero || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Tipo do Plano</span>
                      <p className="text-sm font-bold text-slate-700 leading-tight break-words">{selectedUser.plano_saude_tipo || 'N/A'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-slate-900 border-b-2 border-brand-green/10 pb-1.5 flex items-center gap-2 uppercase tracking-tighter italic font-display text-base">
                    <ShieldAlert size={16} className="text-brand-green" /> Dados de Emergência
                  </h4>
                  <div className="space-y-2">
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                      <p className="text-[9px] font-bold text-amber-700 uppercase tracking-widest mb-1">Alergias</p>
                      <p className="text-sm font-bold text-amber-900 leading-tight">{selectedUser.alergias || 'Nenhuma informada'}</p>
                    </div>
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-[9px] font-bold text-blue-700 uppercase tracking-widest mb-1">Medicamento Contínuo</p>
                      <p className="text-sm font-bold text-blue-900 leading-tight">{selectedUser.medicamentos || 'Nenhum informado'}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 border-b-2 border-slate-100 pb-1.5 uppercase tracking-tighter italic font-display text-base">Outras Informações</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Contatos de Emergência</p>
                    <p className="text-sm font-bold text-slate-700 whitespace-pre-line leading-relaxed">{selectedUser.contatos_emergencia || 'Nenhum informado'}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Condições Preexistentes</p>
                    <p className="text-sm font-bold text-slate-700 whitespace-pre-line leading-relaxed">{selectedUser.condicoes_preexistentes || 'Nenhuma informada'}</p>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 md:col-span-2">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Observações</p>
                    <p className="text-sm font-bold text-slate-700 whitespace-pre-line leading-relaxed">{selectedUser.observacoes || 'Nenhuma observação informada'}</p>
                  </div>
                </div>
              </div>

              {/* Attachments Section - Admin View */}
              {selectedUser.anexos && selectedUser.anexos.length > 0 && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between border-b-2 border-slate-100 pb-2">
                    <h4 className="font-bold text-slate-900 uppercase tracking-tighter italic font-display text-lg">Documentos Anexos</h4>
                    <button
                      onClick={handleDeleteAllAnexos}
                      className="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-widest transition-colors flex items-center gap-1"
                    >
                      <Trash2 size={12} /> Excluir Todos
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedUser.anexos.map((anexo) => (
                      <div 
                        key={anexo.id}
                        className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-md transition-all group w-full"
                      >
                        <div className={`p-3 rounded-xl shrink-0 ${anexo.tipo === 'laudo' ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
                          {loadingAnexo ? <Loader2 size={24} className="animate-spin" /> : <FileText size={24} />}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-bold text-slate-900 truncate">{anexo.nome}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                            {anexo.tipo === 'laudo' ? 'Laudo Médico' : 'Receita'} • {new Date(anexo.data).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleViewAnexo(anexo)}
                            disabled={loadingAnexo}
                            className="p-2 text-slate-400 hover:text-brand-blue transition-colors"
                            title="Visualizar"
                          >
                            <ExternalLink size={18} />
                          </button>
                          <button
                            onClick={() => handleDownloadAnexo(anexo)}
                            disabled={loadingAnexo}
                            className="p-2 text-slate-400 hover:text-brand-green transition-colors"
                            title="Baixar"
                          >
                            <Download size={18} />
                          </button>
                          <button
                            onClick={() => handleDeleteAnexo(anexo)}
                            disabled={loadingAnexo}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-6 bg-brand-gradient rounded-[2rem] shadow-lg shadow-blue-100 flex items-center justify-between text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12 blur-2xl"></div>
                <div className="relative z-10 flex-1 pr-4">
                  <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mb-1">Link Público de Emergência</p>
                  <p className="text-base font-bold italic font-display break-all leading-none">{getPublicUrl(selectedUser.id)}</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => openPublicLink(selectedUser.id)}
                    className="relative z-10 p-3 bg-white/20 backdrop-blur-md text-white rounded-xl border border-white/30 hover:bg-white/30 transition-all active:scale-90"
                    title="Ver Link"
                  >
                    <ExternalLink size={20} />
                  </button>
                  <button 
                    onClick={() => copyToClipboard(getPublicUrl(selectedUser.id))}
                    className="relative z-10 p-3 bg-white/20 backdrop-blur-md text-white rounded-xl border border-white/30 hover:bg-white/30 transition-all active:scale-90"
                    title="Copiar Link"
                  >
                    <Copy size={20} />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
              <button
                onClick={() => {
                  const printId = selectedUser.id || selectedUser.uid;
                  const printUrl = `${getPublicUrl(printId)}?print=true`;
                  console.log('Abrindo nova aba para impressão (modal):', printId, printUrl);
                  
                  // Usar um link temporário para evitar bloqueio de pop-up
                  const link = document.createElement('a');
                  link.href = printUrl;
                  link.target = '_blank';
                  link.rel = 'noopener noreferrer';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="px-4 bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 uppercase tracking-widest italic font-display text-sm shadow-lg shadow-blue-100"
              >
                <Printer size={18} /> Imprimir Ficha
              </button>
              <button
                onClick={() => {
                  handleDeleteUser(selectedUser.uid);
                  setIsDetailsModalOpen(false);
                }}
                className="px-4 bg-red-50 text-red-600 font-bold py-4 rounded-xl hover:bg-red-100 transition-all flex items-center justify-center gap-2 uppercase tracking-widest italic font-display text-sm"
              >
                <Trash2 size={18} /> Excluir
              </button>
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="flex-1 bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-all uppercase tracking-widest italic font-display shadow-lg shadow-slate-200 text-sm"
              >
                Fechar Detalhes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {isEditModalOpen && selectedUser && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-2 sm:p-4 animate-in fade-in duration-500">
          <div className="bg-white rounded-3xl sm:rounded-[3rem] w-full max-w-3xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col animate-in zoom-in-95 duration-500 border border-slate-100">
            <div className="bg-brand-gradient p-5 sm:p-6 flex justify-between items-center text-white shrink-0">
              <h3 className="text-lg sm:text-xl font-black italic font-display uppercase tracking-tighter">Editar Cadastro: {selectedUser.nome_completo}</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleUpdateUser} className="p-4 sm:p-6 overflow-y-auto space-y-3 sm:space-y-4">
              {/* Foto de Perfil */}
              <div className="flex flex-col items-center gap-2 py-2 border-b border-slate-50">
                <div className="relative group">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-xl bg-slate-100 flex items-center justify-center">
                    {formData.foto ? (
                      <img 
                        src={formData.foto} 
                        alt="Foto de Perfil" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User size={28} className="text-slate-300" />
                    )}
                  </div>
                  <label className="absolute bottom-0 right-0 p-1.5 bg-brand-blue text-white rounded-full shadow-lg cursor-pointer hover:bg-blue-700 transition-all active:scale-90">
                    <Camera size={12} />
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const base64 = await compressImage(file);
                          setFormData({ ...formData, foto: base64 });
                        }
                      }} 
                      className="hidden" 
                    />
                  </label>
                </div>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Foto de Perfil (Opcional)</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Nome Completo</label>
                  <input
                    type="text"
                    value={formData.nome_completo}
                    onChange={(e) => setFormData({...formData, nome_completo: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-sm font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Número de Identificação (ID)</label>
                  <input
                    type="text"
                    value={formData.id}
                    onChange={(e) => setFormData({...formData, id: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-bold italic font-display"
                  />
                  <p className="text-[8px] text-amber-600 mt-0.5 ml-1 italic font-bold uppercase tracking-widest leading-tight">
                    <ShieldAlert size={8} className="inline mr-1" /> Atenção: Alterar o ID mudará o link do QR Code.
                  </p>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Data de Nascimento</label>
                  <input
                    type="date"
                    value={formData.data_nascimento || ''}
                    onChange={(e) => setFormData({...formData, data_nascimento: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Sexo</label>
                  <select
                    value={formData.sexo || ''}
                    onChange={(e) => setFormData({...formData, sexo: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all font-medium text-xs appearance-none cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    <option value="Masculino">Masculino</option>
                    <option value="Feminino">Feminino</option>
                    <option value="Outro">Outro</option>
                    <option value="Não informado">Não informado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Cartão SUS</label>
                  <input
                    type="text"
                    value={formData.cartao_sus || ''}
                    onChange={(e) => setFormData({...formData, cartao_sus: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">CPF</label>
                  <input
                    type="text"
                    value={formData.cpf || ''}
                    onChange={(e) => setFormData({...formData, cpf: e.target.value})}
                    placeholder="000.000.000-00"
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Telefone</label>
                  <input
                    type="text"
                    value={formData.telefone || ''}
                    onChange={(e) => setFormData({...formData, telefone: e.target.value})}
                    placeholder="(00) 00000-0000"
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Última Vacina</label>
                  <input
                    type="text"
                    value={formData.ultima_vacina || ''}
                    onChange={(e) => setFormData({...formData, ultima_vacina: e.target.value})}
                    placeholder="Ex: Gripe - 10/2023"
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-medium"
                  />
                </div>
                <div className="sm:col-span-2 pt-1 border-t border-slate-100">
                  <h4 className="text-[9px] font-black text-brand-blue uppercase tracking-[0.2em] mb-2 italic font-display">Plano de Saúde</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Operadora</label>
                      <input
                        type="text"
                        value={formData.plano_saude_nome || ''}
                        onChange={(e) => setFormData({...formData, plano_saude_nome: e.target.value})}
                        placeholder="Ex: Unimed..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Nº do Cartão</label>
                      <input
                        type="text"
                        value={formData.plano_saude_numero || ''}
                        onChange={(e) => setFormData({...formData, plano_saude_numero: e.target.value})}
                        placeholder="0000..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Tipo do Plano</label>
                      <textarea
                        value={formData.plano_saude_tipo || ''}
                        onChange={(e) => setFormData({...formData, plano_saude_tipo: e.target.value})}
                        placeholder="Ex: Enfermaria..."
                        className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-medium h-12 resize-none"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Tipo Sanguíneo</label>
                  <select
                    value={formData.tipo_sanguineo || ''}
                    onChange={(e) => setFormData({...formData, tipo_sanguineo: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all font-bold text-sm appearance-none cursor-pointer"
                  >
                    <option value="">Selecione...</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Alergias</label>
                  <textarea
                    value={formData.alergias || ''}
                    onChange={(e) => setFormData({...formData, alergias: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all h-16 resize-none text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Medicamento Contínuo</label>
                  <textarea
                    value={formData.medicamentos || ''}
                    onChange={(e) => setFormData({...formData, medicamentos: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all h-16 resize-none text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Contatos de Emergência</label>
                  <textarea
                    value={formData.contatos_emergencia || ''}
                    onChange={(e) => setFormData({...formData, contatos_emergencia: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none h-16 resize-none text-xs font-medium"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Condições Preexistentes</label>
                  <textarea
                    value={formData.condicoes_preexistentes || ''}
                    onChange={(e) => setFormData({...formData, condicoes_preexistentes: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none h-16 resize-none text-xs font-medium"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Observações</label>
                  <textarea
                    value={formData.observacoes || ''}
                    onChange={(e) => setFormData({...formData, observacoes: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none h-16 resize-none text-xs font-medium"
                    placeholder="Informações adicionais..."
                  />
                </div>
                <div className="sm:col-span-2 pt-1 border-t border-slate-100">
                  <h4 className="text-[9px] font-black text-brand-blue uppercase tracking-[0.2em] mb-2 italic font-display">Validade do Cadastro</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Data de Cadastro</label>
                      <input
                        type="date"
                        value={formData.data_cadastro || ''}
                        onChange={(e) => {
                          const newDate = e.target.value;
                          const validDate = new Date(newDate);
                          validDate.setFullYear(validDate.getFullYear() + 1);
                          setFormData({ 
                            ...formData, 
                            data_cadastro: newDate,
                            data_validade: validDate.toISOString().split('T')[0]
                          });
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Data de Validade (1 Ano)</label>
                      <input
                        type="date"
                        value={formData.data_validade || ''}
                        onChange={(e) => setFormData({...formData, data_validade: e.target.value})}
                        className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-xs font-medium"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-2 flex flex-col sm:flex-row gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteUser(selectedUser.uid);
                    setIsEditModalOpen(false);
                  }}
                  className="px-3 bg-red-50 text-red-600 font-bold py-2 rounded-lg hover:bg-red-100 transition-all flex items-center justify-center gap-2 uppercase tracking-widest italic font-display text-[10px]"
                >
                  <Trash2 size={14} /> Excluir
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 px-3 py-2 rounded-lg border-2 border-slate-100 font-bold text-slate-400 hover:bg-slate-50 transition-all uppercase tracking-widest italic font-display text-[10px]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-lg transition-all shadow-lg shadow-slate-200 uppercase tracking-widest italic font-display text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Success Confirmation Modal */}
      {isSuccessModalOpen && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl flex items-center justify-center z-[9999] p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100 p-8 text-center">
            <div className="w-20 h-20 bg-green-50 text-green-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-100">
              <CheckCircle2 size={40} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight uppercase italic font-display">Sucesso!</h3>
            <p className="text-slate-500 mb-8 font-medium">
              {successMessage}
            </p>
            <button
              onClick={() => setIsSuccessModalOpen(false)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-slate-200 uppercase tracking-widest italic font-display"
            >
              OK, Entendido
            </button>
          </div>
        </div>
      )}

      {/* Security Modal */}
      {isSecurityModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in duration-500">
          <div className="bg-white rounded-[3rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-500 border border-slate-100">
            <div className="bg-brand-gradient p-6 flex justify-between items-center text-white">
              <h3 className="text-xl font-black italic font-display uppercase tracking-tighter">Segurança da Conta</h3>
              <button onClick={() => setIsSecurityModalOpen(false)} className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              <div className="w-12 h-12 bg-slate-50 text-brand-blue rounded-xl flex items-center justify-center mx-auto mb-2">
                <Lock size={24} />
              </div>
              <p className="text-slate-500 text-center font-medium mb-4 text-sm">
                Altere sua senha de acesso para garantir a segurança da área administrativa.
              </p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Nova Senha</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-sm font-medium"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Confirmar Nova Senha</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-brand-blue/10 focus:border-brand-blue outline-none transition-all text-sm font-medium"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-slate-900 text-white font-black py-3 rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 uppercase tracking-widest italic font-display shadow-xl shadow-slate-200 disabled:opacity-50 text-[10px]"
                >
                  {loading ? 'Alterando...' : 'Atualizar Senha'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsSecurityModalOpen(false)}
                  className="w-full bg-white text-slate-400 border-2 border-slate-100 font-black py-2 rounded-xl hover:bg-slate-50 transition-all uppercase tracking-widest italic font-display text-[10px]"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Attachment Confirmation Modal */}
      {deleteConfirmAnexo && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center z-[70] p-4 animate-in fade-in duration-300">
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
    </Layout>
  );
}
