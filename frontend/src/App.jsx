import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Machines } from './pages/Machines';
import { MachineDetail } from './pages/MachineDetail';
import { FaultCodes } from './pages/FaultCodes';
import { FaultCodeDetail } from './pages/FaultCodeDetail';
import { Resolutions } from './pages/Resolutions';
import { Alerts } from './pages/Alerts';
import { AlertDetail } from './pages/AlertDetail';
import { Chat } from './pages/Chat';
import { AiConsole } from './pages/AiConsole';
import { Analytics } from './pages/Analytics';
import { Login } from './pages/Login';
import { useAuth } from './contexts/AuthContext';
import { SirketHafizasiApprovals } from './pages/SirketHafizasiApprovals';
import { AdminUsers } from './pages/AdminUsers';
import { TestHesap } from './pages/TestHesap';

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-500">Oturum kontrol ediliyor...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

function AppLayoutRoutes() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/machines" element={<Machines />} />
        <Route path="/machines/:id" element={<MachineDetail />} />
        <Route path="/fault-codes" element={<FaultCodes />} />
        <Route path="/fault-codes/:id" element={<FaultCodeDetail />} />
        <Route path="/resolutions" element={<Resolutions />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/alerts/:id" element={<AlertDetail />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/ai-console" element={<AiConsole />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/approvals" element={<SirketHafizasiApprovals />} />
        <Route path="/admin" element={<AdminUsers />} />
        <Route path="/test/hesap" element={<TestHesap />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <AppLayoutRoutes />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
