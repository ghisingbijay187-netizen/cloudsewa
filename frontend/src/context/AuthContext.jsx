import { createContext, useContext, useState, useEffect } from 'react';
import API from '../api/axios';
import { notify as toast } from '../utils/notify';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on app start
  useEffect(() => {
    const savedToken = localStorage.getItem('cloudsewa_token');
    const savedUser = localStorage.getItem('cloudsewa_user');

    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  // Register
  const register = async (name, email, password) => {
    try {
      const { data } = await API.post('/auth/register', {
        name,
        email,
        password
      });

      // If account is pending admin approval, no token is returned — user
      // must wait for an admin to approve before they can sign in.
      if (!data.token || data.user?.registrationStatus === 'pending') {
        toast.success(data.message || 'Account created. Awaiting administrator approval.');
        return {
          success: true,
          pending: true,
          userId: data.user?.id || data.userId,
          registrationToken: data.registrationToken,
          message: data.message || 'Awaiting administrator approval'
        };
      }

      localStorage.setItem('cloudsewa_token', data.token);
      localStorage.setItem('cloudsewa_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      toast.success('Account created successfully');
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  // Login
  const login = async (email, password) => {
    try {
      const { data } = await API.post('/auth/login', { email, password });

      localStorage.setItem('cloudsewa_token', data.token);
      localStorage.setItem('cloudsewa_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      toast.success('Login successful');
      return { success: true, user: data.user };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      toast.error(message);
      return { success: false, message };
    }
  };

  // Logout
  const logout = async () => {
    try {
      await API.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error.message);
    } finally {
      localStorage.removeItem('cloudsewa_token');
      localStorage.removeItem('cloudsewa_user');
      setToken(null);
      setUser(null);
      toast.success('Logged out successfully');
    }
  };

  // Update user in context
  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('cloudsewa_user', JSON.stringify(updatedUser));
  };

  // Re-fetch the current user from the server (fresh storageUsed etc.)
  const refreshUser = async () => {
    try {
      const { data } = await API.get('/auth/me');
      if (data.user) {
        updateUser(data.user);
      }
    } catch (error) {
      console.error('Refresh user error:', error.message);
    }
  };

  const isAdmin = user?.role === 'admin';
  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      isAdmin,
      isAuthenticated,
      register,
      login,
      logout,
      updateUser,
      refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;