import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import DashboardPreview from './components/dashboard/DashboardPreview';
import DocumentsPage from './pages/DocumentsPage';
import IngestionPage from './pages/IngestionPage';
import AuditPage from './pages/AuditPage';
import UsersPage from './pages/UsersPage';
import TriagePage from './pages/TriagePage';
import { RoleRoute } from './components/auth/RoleRoute';
import { useAuth } from './hooks/useAuth';
import {
  AUDIT_ACCESS_ROLES,
  DOCUMENT_ACCESS_ROLES,
  INGEST_ACCESS_ROLES,
  USER_MANAGEMENT_ROLES,
  getHomeRoute,
} from './utils/permissions';

const HomeRedirect = () => {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role === 'GESTOR_USUARIOS') {
    return <Navigate to="/usuarios" replace />;
  }
  return <Navigate to={getHomeRoute(user?.role)} replace />;
};

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
            <Route
              path="/dashboard"
              element={
                <RoleRoute allowedRoles={DOCUMENT_ACCESS_ROLES} fallbackPath="/usuarios">
                  <DashboardPreview />
                </RoleRoute>
              }
            />
            <Route
              path="/documentos"
              element={
                <RoleRoute allowedRoles={DOCUMENT_ACCESS_ROLES} fallbackPath="/usuarios">
                  <DocumentsPage />
                </RoleRoute>
              }
            />
            <Route
              path="/ingesta"
              element={
                <RoleRoute allowedRoles={INGEST_ACCESS_ROLES}>
                  <IngestionPage />
                </RoleRoute>
              }
            />
            <Route
              path="/auditoria"
              element={
                <RoleRoute allowedRoles={AUDIT_ACCESS_ROLES}>
                  <AuditPage />
                </RoleRoute>
              }
            />
            <Route
              path="/usuarios"
              element={
                <RoleRoute allowedRoles={USER_MANAGEMENT_ROLES}>
                  <UsersPage />
                </RoleRoute>
              }
            />
            <Route
              path="/triaje"
              element={
                <RoleRoute allowedRoles={DOCUMENT_ACCESS_ROLES} fallbackPath="/usuarios">
                  <TriagePage />
                </RoleRoute>
              }
            />
          </Route>

          <Route path="/" element={<HomeRedirect />} />
          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;

