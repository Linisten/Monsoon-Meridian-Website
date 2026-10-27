import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';
import Layout from './components/layout/Layout';

// Lazy load pages for performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Sales = lazy(() => import('./pages/Sales'));
const Purchase = lazy(() => import('./pages/Purchase'));
const Stock = lazy(() => import('./pages/Stock'));
const Reports = lazy(() => import('./pages/Reports'));
const Login = lazy(() => import('./pages/Login'));
const GenericMaster = lazy(() => import('./pages/GenericMaster'));
const Settings = lazy(() => import('./pages/Settings'));
const Marketing = lazy(() => import('./pages/Marketing'));
const BarcodeGenerator = lazy(() => import('./pages/BarcodeGenerator'));
const Users = lazy(() => import('./pages/Users'));
const Activities = lazy(() => import('./pages/Activities'));

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { isAuthenticated, isAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
};

// Loading component for Suspense
const PageLoader = () => (
  <div style={{
    height: '100vh', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    background: '#111',
    color: '#fff',
    fontFamily: 'sans-serif'
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>Loading...</div>
      <div style={{ fontSize: '14px', opacity: 0.6 }}>Preparing your workstation</div>
    </div>
  </div>
);

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="sales" element={<Sales />} />
          <Route path="purchase" element={<Purchase />} />
          <Route path="stock" element={<Stock />} />
          <Route path="reports" element={<Reports />} />
          <Route path="master/:type" element={<GenericMaster />} />
          <Route path="marketing" element={<AdminRoute><Marketing /></AdminRoute>} />
          <Route path="barcode" element={<BarcodeGenerator />} />
          <Route path="settings" element={<Settings />} />
          
          {/* Admin Exclusive: User Management & Real-time Activities */}
          <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
          <Route path="users/:userId" element={<AdminRoute><Users /></AdminRoute>} />
          <Route path="activities" element={<AdminRoute><Activities /></AdminRoute>} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

function App() {
  return (
    <ConfirmProvider>
      <AuthProvider>
        <HashRouter>
          <AppRoutes />
        </HashRouter>
      </AuthProvider>
    </ConfirmProvider>
  );
}

export default App;
