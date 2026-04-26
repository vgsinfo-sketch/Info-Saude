import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useState, useEffect, createContext, useContext } from 'react';
import { auth, db } from './firebase';
import { Usuario } from './types';

// Components
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import UserDashboard from './pages/UserDashboard';
import PublicProfile from './pages/PublicProfile';
import Layout from './components/Layout';

interface AuthContextType {
  user: User | null;
  userData: Usuario | null;
  loading: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  isAdmin: false,
});

export const useAuth = () => useContext(AuthContext);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null, currentUser?: User | null) {
  const activeUser = currentUser || auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: activeUser?.uid,
      email: activeUser?.email,
      emailVerified: activeUser?.emailVerified,
      isAnonymous: activeUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return `Erro no banco de dados (${operationType}): ${errInfo.error}`;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const setupUserListener = (uid: string, currentUser: User) => {
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      
      console.log('Setting up onSnapshot for user UID:', uid);
      unsubscribeSnapshot = onSnapshot(
        doc(db, 'usuarios', uid),
        (docSnap) => {
          if (docSnap.exists()) {
            const data = { uid: uid, ...docSnap.data() } as Usuario;
            console.log('User data loaded/updated successfully:', data.nome_completo, 'Role:', data.role);
            setUserData(data);
            setLoading(false);
          } else {
            console.warn('Document not found at path: usuarios/', uid);
            handleFallbackSearch(currentUser);
          }
        },
        (err) => {
          console.error('Error in user data snapshot (uid:', uid, '):', err);
          handleFallbackSearch(currentUser);
        }
      );
    };

    const handleFallbackSearch = async (currentUser: User) => {
      try {
        console.log('Starting fallback search for user email:', currentUser.email, 'UID:', currentUser.uid);
        
        // 1. Try searching by the 'uid' field in case document ID is different
        console.log('Fallback 1: Searching by "uid" field...');
        const qUid = query(collection(db, 'usuarios'), where('uid', '==', currentUser.uid), limit(1));
        const querySnapUid = await getDocs(qUid);
        
        if (!querySnapUid.empty) {
          const foundDoc = querySnapUid.docs[0];
          console.log('User found by "uid" field fallback! Document ID:', foundDoc.id);
          setupUserListener(foundDoc.id, currentUser);
          return;
        }
        console.log('Fallback 1: No match.');

        // 2. Try searching by CPF (extracted from email)
        const cpfFromEmail = currentUser.email?.split('@')[0];
        if (cpfFromEmail && currentUser.email?.endsWith('@infosaude.com')) {
          console.log('Fallback 2: Searching by CPF extracted from email:', cpfFromEmail);
          
          const qCpf = query(collection(db, 'usuarios'), where('cpf', '==', cpfFromEmail), limit(1));
          const querySnapCpf = await getDocs(qCpf);
          
          if (!querySnapCpf.empty) {
            const foundDoc = querySnapCpf.docs[0];
            console.log('User found by CPF fallback! Document ID:', foundDoc.id);
            setupUserListener(foundDoc.id, currentUser);
            return;
          }
          console.log('Fallback 2: No match by direct CPF query.');

          // Also try searching for formatted CPF just in case
          console.log('Fallback 2.1: Listing all users to filter by CPF client-side...');
          const allUsersSnap = await getDocs(collection(db, 'usuarios'));
          console.log('Total users fetched for filtering:', allUsersSnap.size);
          
          if (allUsersSnap.empty) {
            console.warn('The "usuarios" collection is empty!');
          }

          const foundByCpfFilter = allUsersSnap.docs.find(d => {
            const docCpf = d.data().cpf;
            if (!docCpf) return false;
            const cleanDocCpf = String(docCpf).replace(/\D/g, '');
            return cleanDocCpf === cpfFromEmail;
          });

          if (foundByCpfFilter) {
            console.log('User found by CPF client-side filter! Document ID:', foundByCpfFilter.id);
            setupUserListener(foundByCpfFilter.id, currentUser);
            return;
          }
          console.log('Fallback 2.1: No match by CPF filter.');
        }

        // 3. Try searching by email
        console.log('Fallback 3: Searching by "email" field:', currentUser.email);
        const qEmail = query(collection(db, 'usuarios'), where('email', '==', currentUser.email), limit(1));
        const querySnapEmail = await getDocs(qEmail);
        
        if (!querySnapEmail.empty) {
          const foundDoc = querySnapEmail.docs[0];
          console.log('User found by "email" field fallback! Document ID:', foundDoc.id);
          setupUserListener(foundDoc.id, currentUser);
          return;
        }
        console.log('Fallback 3: No match.');

        // 4. Special case for master admins
        const masterEmails = ['admin@infosaude.com', 'admin@admin.com', 'vgsinfo@gmail.com'];
        if (masterEmails.includes(currentUser.email || '')) {
          console.log('Master admin detected, providing virtual profile.');
          setUserData({
            uid: currentUser.uid,
            nome_completo: 'Administrador Master',
            cpf: '00000000000',
            id: 'ADMIN',
            role: 'admin'
          } as Usuario);
        } else {
          console.error('CRITICAL: No user profile found after all fallbacks for:', currentUser.email);
          setUserData(null);
        }
        setLoading(false);
      } catch (err: any) {
        console.error('Error during handleFallbackSearch:', err);
        const msg = handleFirestoreError(err, OperationType.GET, 'usuarios', currentUser);
        setError(msg);
        setLoading(false);
      }
    };

    try {
      const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
        console.log('Auth state changed:', currentUser?.email);
        setUser(currentUser);
        
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
          unsubscribeSnapshot = null;
        }

        if (currentUser) {
          setLoading(true);
          setupUserListener(currentUser.uid, currentUser);
        } else {
          setUserData(null);
          setLoading(false);
        }
      });

      return () => {
        unsubscribeAuth();
        if (unsubscribeSnapshot) unsubscribeSnapshot();
      };
    } catch (err: any) {
      console.error('Auth initialization error:', err);
      setError(err.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    if (loading) {
      timeoutId = setTimeout(() => {
        if (loading) {
          console.warn('Loading timeout reached (15s). Forcing loading to false.');
          setLoading(false);
          if (!userData && user) {
            setError('Tempo limite de carregamento excedido. Verifique sua conexão ou tente novamente.');
          }
        }
      }, 15000);
    }
    return () => clearTimeout(timeoutId);
  }, [loading, userData, user]);

  const isAdmin = userData?.role === 'admin' || 
                  user?.email === 'admin@infosaude.com' || 
                  user?.email === 'admin@admin.com' || 
                  user?.email === 'vgsinfo@gmail.com';

  useEffect(() => {
    if (user) {
      console.log('Current User Status:', { 
        email: user.email, 
        uid: user.uid,
        role: userData?.role, 
        isAdmin,
        hasUserData: !!userData 
      });
    }
  }, [user, userData, isAdmin]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-100 max-w-md w-full">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Erro de Inicialização</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="w-full bg-red-600 text-white py-3 rounded-xl font-bold">
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, userData, loading, isAdmin }}>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          
          <Route path="/admin/*" element={
            isAdmin ? <AdminDashboard /> : <Navigate to="/admin-login" replace />
          } />
          
          <Route path="/dashboard" element={
            user ? <UserDashboard /> : <Navigate to="/login" replace />
          } />
          
          <Route path="/user/:id" element={<PublicProfile />} />
          <Route path="/public-profile/:id" element={<PublicProfile />} />
          <Route path="*" element={
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
              <h1 className="text-4xl font-black text-slate-900 mb-2 italic uppercase tracking-tighter">404</h1>
              <p className="text-slate-500 mb-8 font-medium">Página não encontrada.</p>
              <button 
                onClick={() => window.location.href = '/'}
                className="px-8 py-3 bg-brand-gradient text-white font-black rounded-2xl shadow-lg uppercase tracking-widest italic"
              >
                Voltar ao Início
              </button>
            </div>
          } />
        </Routes>
      </Router>
    </AuthContext.Provider>
  );
}
