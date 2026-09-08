import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import FileManager from './pages/FileManager';
import BackupManager from './pages/BackupManager';
import Trash from './pages/Trash';
import Settings from './pages/Settings';
import AdminPanel from './pages/AdminPanel';
import ActivityLogs from './pages/ActivityLogs';
import StorageStats from './pages/StorageStats';
import NotFound from './pages/NotFound';

// Components
import ProtectedRoute from './components/common/ProtectedRoute';
import LoadingSpinner from './components/common/LoadingSpinner';

import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// Page title map
const PAGE_TITLES = {
  '/dashboard': 'Dashboard',
  '/files': 'File Manager',
  '/backups': 'Backup Manager',
  '/trash': 'Trash',
  '/settings': 'Settings',
  '/admin': 'Admin Panel',
  '/activity': 'Activity Logs',
  '/storage': 'Storage Stats',
  '/login': 'Login',
  '/register': 'Register',
  '/forgot-password': 'Forgot Password',
  '/reset-password': 'Reset Password',
};

const TitleManager = () => {
  const location = useLocation();

  useEffect(() => {
    const title = PAGE_TITLES[location.pathname];
    document.title = title
      ? `CloudSewa : ${title}`
      : 'CloudSewa';
  }, [location.pathname]);

  return null;
};

const AppRoutes = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <TitleManager />
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={!isAuthenticated ? <Login /> : <Navigate to="/dashboard" replace />}
        />
        <Route
          path="/register"
          element={!isAuthenticated ? <Register /> : <Navigate to="/dashboard" replace />}
        />

        <Route
          path="/forgot-password"
          element={!isAuthenticated ? <ForgotPassword /> : <Navigate to="/dashboard" replace />}
        />
        <Route
          path="/reset-password/:token"
          element={!isAuthenticated ? <ResetPassword /> : <Navigate to="/dashboard" replace />}
        />

        {/* Protected routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/files" element={<FileManager />} />
          <Route path="/backups" element={<BackupManager />} />
          <Route path="/trash" element={<Trash />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* Admin only routes */}
        <Route element={<ProtectedRoute adminOnly />}>
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/activity" element={<ActivityLogs />} />
          <Route path="/storage" element={<StorageStats />} />
        </Route>

        {/* Default redirect */}
        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />}
        />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
};

export default App;