import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Purchase from './pages/Purchase';
import Stock from './pages/Stock';
import Reports from './pages/Reports';
import Login from './pages/Login';
import GenericMaster from './pages/GenericMaster';
import Settings from './pages/Settings';
import Marketing from './pages/Marketing';
import BarcodeGenerator from './pages/BarcodeGenerator';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="sales" element={<Sales />} />
        <Route path="purchase" element={<Purchase />} />
        <Route path="stock" element={<Stock />} />
        <Route path="reports" element={<Reports />} />
        <Route path="master/:type" element={<GenericMaster />} />
        <Route path="marketing" element={<Marketing />} />
        <Route path="barcode" element={<BarcodeGenerator />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
