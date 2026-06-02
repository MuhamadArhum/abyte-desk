import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Revenue from './pages/Revenue';
import ActivityPage from './pages/Activity';
import Settings from './pages/Settings';

const LogoLoader = () => (
  <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-4">
    <div className="relative">
      <img src="/logo.png" alt="AByte" className="w-16 h-16 object-contain animate-pulse" />
      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  </div>
);

function PrivateRoute({ children }: { children: React.ReactElement }) {
  const { admin, loading } = useAuth();
  if (loading) return <LogoLoader />;
  return admin ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const { admin } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={admin ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/*" element={
        <PrivateRoute>
          <Layout>
            <Routes>
              <Route path="/"               element={<Dashboard />} />
              <Route path="/clients"        element={<Clients />} />
              <Route path="/clients/:id"    element={<ClientDetail />} />
              <Route path="/revenue"        element={<Revenue />} />
              <Route path="/activity"       element={<ActivityPage />} />
              <Route path="/settings"       element={<Settings />} />
            </Routes>
          </Layout>
        </PrivateRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
