import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import DashboardPreview from './components/dashboard/DashboardPreview';
import TriagePage from './pages/TriagePage';
import DocumentsPage from './pages/DocumentsPage';
import IngestionPage from './pages/IngestionPage';
import AuditPage from './pages/AuditPage';

const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPreview />} />
            <Route path="/triaje" element={<TriagePage />} />
            <Route path="/documentos" element={<DocumentsPage />} />
            <Route path="/ingesta" element={<IngestionPage />} />
            <Route path="/auditoria" element={<AuditPage />} />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
