import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, orderBy, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Usuario } from '../types';
import Layout from '../components/Layout';
import { 
  Users, 
  Search, 
  Edit2, 
  Trash2, 
  Plus, 
  Shield, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Filter,
  MoreVertical,
  Download,
  Printer,
  UserPlus,
  ArrowRight,
  Loader2,
  ExternalLink
} from 'lucide-react';

export default function AdminDashboard() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'user'>('all');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsuarios = async () => {
      try {
        const q = query(collection(db, 'usuarios'), orderBy('nome_completo'));
        const querySnapshot = await getDocs(q);
        const docs = querySnapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as Usuario));
        setUsuarios(docs);
      } catch (error) {
        console.error('Erro ao buscar usuários:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsuarios();
  }, []);

  const handleDelete = async (uid: string, nome: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o usuário ${nome}?`)) {
      try {
        await deleteDoc(doc(db, 'usuarios', uid));
        setUsuarios(usuarios.filter(u => u.uid !== uid));
      } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        alert('Erro ao excluir usuário. Tente novamente.');
      }
    }
  };

  const toggleAdmin = async (usuario: Usuario) => {
    const newRole = usuario.role === 'admin' ? 'user' : 'admin';
    try {
      await updateDoc(doc(db, 'usuarios', usuario.uid), {
        role: newRole
      });
      setUsuarios(usuarios.map(u => 
        u.uid === usuario.uid ? { ...u, role: newRole } : u
      ));
    } catch (error) {
      console.error('Erro ao atualizar cargo:', error);
      alert('Erro ao atualizar cargo.');
    }
  };

  const filteredUsuarios = usuarios.filter(u => {
    const matchesSearch = u.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         u.cpf.includes(searchTerm) ||
                         u.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const getPublicUrl = (id: string) => {
    // Use the current origin for the public URL
    return `${window.location.origin}/p/${id}`;
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="relative w-20 h-20 mb-6">
            <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-slate-500 font-bold uppercase tracking-widest text-xs animate-pulse">Sincronizando Base de Dados...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-8 pb-20">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full -mr-32 -mt-32 blur-3xl opacity-50"></div>
          
          <div className="relative z-10 space-y-2">
            <div className="flex items-center gap-3 text-blue-600 font-black uppercase tracking-[0.3em] text-[10px]">
              <Shield size={14} /> Painel de Controle
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tighter italic uppercase">Gestão de Usuários</h1>
            <p className="text-slate-500 font-medium">Gerencie acessos, fichas médicas e identidades do sistema.</p>
          </div>

          <div className="relative z-10 flex flex-wrap gap-3">
            <div className="bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 flex items-center gap-4">
              <div className="text-right">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Total de Registros</span>
                <span className="text-xl font-black text-slate-900 italic">{usuarios.length}</span>
              </div>
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 shadow-sm border border-slate-100">
                <Users size={20} />
              </div>
            </div>
            <button 
              onClick={() => navigate('/admin/usuarios/novo')}
              className="bg-brand-gradient text-white px-8 py-4 rounded-2xl font-black uppercase tracking-tighter italic flex items-center gap-3 hover:opacity-90 transition-all shadow-xl shadow-blue-200 active:scale-95"
            >
              <UserPlus size={20} />
              Novo Usuário
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="bg-white p-6 rounded-[2rem] shadow-lg shadow-slate-200/40 border border-slate-100 flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Buscar por nome, CPF ou ID do cartão..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent focus:border-blue-100 focus:bg-white rounded-2xl outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400"
            />
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
              <button
                onClick={() => setFilterRole('all')}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  filterRole === 'all' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setFilterRole('admin')}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  filterRole === 'admin' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Admins
              </button>
              <button
                onClick={() => setFilterRole('user')}
                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                  filterRole === 'user' ? 'bg-white text-blue-600 shadow-md' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Usuários
              </button>
            </div>
          </div>
        </div>

        {/* Users Table/Grid */}
        <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Identidade</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">ID Cartão</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Status/Cargo</th>
                  <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredUsuarios.map((usuario) => (
                  <tr key={usuario.uid} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white font-black italic text-xl shadow-lg shadow-slate-200 group-hover:scale-110 transition-transform">
                          {usuario.nome_completo.charAt(0)}
                        </div>
                        <div>
                          <div className="font-black text-slate-900 text-lg tracking-tight leading-none mb-1">{usuario.nome_completo}</div>
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">CPF: {usuario.cpf}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 font-mono text-xs font-bold">
                        {usuario.id}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <button 
                        onClick={() => toggleAdmin(usuario)}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                          usuario.role === 'admin' 
                            ? 'bg-blue-50 text-blue-600 border-blue-100' 
                            : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-slate-100'
                        }`}
                      >
                        {usuario.role === 'admin' ? <Shield size={12} /> : <Users size={12} />}
                        {usuario.role === 'admin' ? 'Administrador' : 'Usuário Comum'}
                      </button>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            const printUrl = `${getPublicUrl(usuario.id)}?print=true`;
                            console.log('Abrindo URL de impressão:', printUrl);
                            
                            // Método mais robusto para abrir em nova aba e evitar bloqueadores de pop-up
                            const link = document.createElement('a');
                            link.href = printUrl;
                            link.target = '_blank';
                            link.rel = 'noopener noreferrer';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                          title="Imprimir Ficha"
                        >
                          <Printer size={18} />
                        </button>
                        <button
                          onClick={() => {
                            const downloadUrl = `${getPublicUrl(usuario.id)}?download=true`;
                            const link = document.createElement('a');
                            link.href = downloadUrl;
                            link.target = '_blank';
                            link.rel = 'noopener noreferrer';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="p-3 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                          title="Baixar PDF"
                        >
                          <Download size={18} />
                        </button>
                        <button
                          onClick={() => navigate(`/admin/usuarios/editar/${usuario.uid}`)}
                          className="p-3 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                          title="Editar Registro"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(usuario.uid, usuario.nome_completo)}
                          className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Excluir Usuário"
                        >
                          <Trash2 size={18} />
                        </button>
                        <button
                          onClick={() => window.open(getPublicUrl(usuario.id), '_blank')}
                          className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
                          title="Ver Perfil Público"
                        >
                          <ExternalLink size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredUsuarios.length === 0 && (
            <div className="p-20 text-center space-y-4">
              <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                <Search size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Nenhum registro encontrado</h3>
              <p className="text-slate-400 font-medium max-w-xs mx-auto">Tente ajustar sua busca ou filtros para encontrar o que procura.</p>
              <button 
                onClick={() => {setSearchTerm(''); setFilterRole('all');}}
                className="text-blue-600 font-black uppercase tracking-widest text-[10px] hover:underline"
              >
                Limpar todos os filtros
              </button>
            </div>
          )}
        </div>

        {/* Quick Actions Footer */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-blue-200 relative overflow-hidden group cursor-pointer" onClick={() => navigate('/admin/usuarios/novo')}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
            <UserPlus className="mb-4 opacity-80" size={32} />
            <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2">Cadastrar Paciente</h3>
            <p className="text-blue-100 text-sm font-medium mb-6">Adicione novos usuários e gere IDs de acesso instantaneamente.</p>
            <div className="flex items-center gap-2 font-black uppercase tracking-widest text-[10px]">
              Começar Agora <ArrowRight size={14} />
            </div>
          </div>

          <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-xl shadow-slate-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
            <Activity className="mb-4 opacity-80 text-emerald-400" size={32} />
            <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2">Relatórios de Saúde</h3>
            <p className="text-slate-400 text-sm font-medium mb-6">Visualize estatísticas gerais da base de pacientes cadastrados.</p>
            <div className="flex items-center gap-2 font-black uppercase tracking-widest text-[10px] text-emerald-400">
              Em breve <Loader2 size={14} className="animate-spin" />
            </div>
          </div>

          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 relative overflow-hidden group">
            <Shield className="mb-4 text-blue-600" size={32} />
            <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter mb-2">Segurança & Logs</h3>
            <p className="text-slate-500 text-sm font-medium mb-6">Monitore acessos e alterações críticas no sistema de prontuários.</p>
            <div className="flex items-center gap-2 font-black uppercase tracking-widest text-[10px] text-slate-400">
              Acessar Logs <ArrowRight size={14} />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
