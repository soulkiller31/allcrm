import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import WhatsApp from './pages/WhatsApp';
import Templates from './pages/Templates';
import MessageLogs from './pages/MessageLogs';
import Invoice from './pages/Invoice';
import Billing from './pages/Billing';
import Services from './pages/Services';
import Settings from './pages/Settings';

function ThemedToaster() {
  const { isDark } = useTheme();
  const toastStyle = isDark
    ? { style: { background: '#1a1d26', color: '#e5e7eb', border: '1px solid #2a2e3a', borderRadius: '12px' },
        success: { iconTheme: { primary: '#10b981', secondary: '#1a1d26' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#1a1d26' } } }
    : { style: { background: '#ffffff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '12px' },
        success: { iconTheme: { primary: '#10b981', secondary: '#ffffff' } },
        error: { iconTheme: { primary: '#ef4444', secondary: '#ffffff' } } };
  return <Toaster position="top-right" toastOptions={toastStyle} />;
}

const Page = ({ children, requireSub = true }) => (
  <ProtectedRoute requireSub={requireSub}>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

function AppInner() {
  return (
    <>
      <ThemedToaster />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/onboarding" element={
          <ProtectedRoute requireSub={false}><Onboarding /></ProtectedRoute>
        } />
        <Route path="/billing" element={
          <ProtectedRoute requireSub={false}><Layout><Billing /></Layout></ProtectedRoute>
        } />
        <Route path="/" element={<Page><Dashboard /></Page>} />
        <Route path="/customers" element={<Page><Customers /></Page>} />
        <Route path="/invoice" element={<Page><Invoice /></Page>} />
        <Route path="/services" element={<Page><Services /></Page>} />
        <Route path="/whatsapp" element={<Page><WhatsApp /></Page>} />
        <Route path="/templates" element={<Page><Templates /></Page>} />
        <Route path="/message-logs" element={<Page><MessageLogs /></Page>} />
        <Route path="/settings" element={<Page requireSub={false}><Settings /></Page>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppInner />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
