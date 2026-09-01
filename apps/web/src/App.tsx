import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import AuthPage from '@/features/auth/AuthPage';
import DocumentLibrary from '@/features/documents/DocumentLibrary';
import ChatWorkspace from '@/features/chat/ChatWorkspace';

function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center text-sm font-medium text-slate-500">Restoring your workspace…</div>;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <AuthPage mode="login" />} />
      <Route path="/register" element={user ? <Navigate to="/" replace /> : <AuthPage mode="register" />} />
      <Route path="/" element={user ? <DocumentLibrary /> : <Navigate to="/login" replace />} />
      <Route path="/chat/:conversationId" element={user ? <ChatWorkspace /> : <Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
