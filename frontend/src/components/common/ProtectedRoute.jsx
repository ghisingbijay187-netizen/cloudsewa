import { Navigate, Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import useLocalState from '../../hooks/useLocalState';

const MOBILE_QUERY = '(max-width: 900px)';

const ProtectedRoute = ({ adminOnly = false }) => {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const [collapsed, setCollapsed] = useLocalState('sidebar:collapsed', false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const onChange = (e) => {
      setIsMobile(e.matches);
      if (!e.matches) setDrawerOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  if (loading) return <LoadingSpinner />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const closeDrawer = () => setDrawerOpen(false);

  const handleHamburger = () => {
    if (isMobile) setDrawerOpen((o) => !o);
    else setCollapsed((c) => !c);
  };

  const sidebarOpen = isMobile ? drawerOpen : !collapsed;

  return (
    <div className={`app-layout${collapsed ? ' sidebar-collapsed' : ''}`}>
      {isMobile && (
        <div
          className={`sidebar-backdrop${drawerOpen ? ' active' : ''}`}
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}
      <Sidebar
        collapsed={collapsed}
        open={drawerOpen}
        onNavigate={isMobile ? closeDrawer : undefined}
      />
      <div className="main-content">
        <Navbar onToggleSidebar={handleHamburger} sidebarOpen={sidebarOpen} />
        <Outlet />
      </div>
    </div>
  );
};

export default ProtectedRoute;
