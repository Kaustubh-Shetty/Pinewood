import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { setupPushNotifications } from './lib/push';
import TopBar from './components/TopBar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AddBill from './pages/AddBill';
import BillDetail from './pages/BillDetail';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, flatId, loading } = useAuth();
  if (loading) return <div className="page">Loading…</div>;
  if (!session || !flatId) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PushRegistration() {
  const { flatId } = useAuth();

  useEffect(() => {
    if (!flatId) return;
    setupPushNotifications().catch((err) => console.warn('Push notifications unavailable:', err));
  }, [flatId]);

  return null;
}

function Shell() {
  return (
    <RequireAuth>
      <PushRegistration />
      <TopBar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/add-bill" element={<AddBill />} />
        <Route path="/bills/:billId" element={<BillDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </RequireAuth>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={<Shell />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
