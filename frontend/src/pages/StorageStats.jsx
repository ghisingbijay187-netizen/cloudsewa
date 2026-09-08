import { useState, useEffect } from 'react';
import API from '../api/axios';
import { RefreshCw } from 'lucide-react';

import StorageOverview from '../components/admin/StorageOverview';
import UserStorageList from '../components/admin/UserStorageList';
import { notify as toast } from '../utils/notify';

const StorageStats = () => {
  const [storageStats, setStorageStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('usage');

  useEffect(() => {
    fetchStorageStats();
    const onFocus = () => fetchStorageStats();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const fetchStorageStats = async () => {
    try {
      setLoading(true);
      const { data } = await API.get('/dashboard/storage');
      setStorageStats(data.storageStats || []);
    } catch (error) {
      console.error('Fetch storage stats error:', error);
      toast.error('Failed to load storage statistics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sortedStats = [...storageStats].sort((a, b) => {
    if (sortBy === 'usage') return b.storageUsed - a.storageUsed;
    if (sortBy === 'percent') return b.percentage - a.percentage;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    return 0;
  });

  return (
    <div className="page-container">

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Storage Statistics</h1>
          <p className="page-subtitle">Monitor storage usage across all users</p>
        </div>
        <button className="btn btn-ghost" onClick={fetchStorageStats}>
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      <StorageOverview storageStats={storageStats} />

      <UserStorageList
        storageStats={storageStats}
        sortedStats={sortedStats}
        sortBy={sortBy}
        setSortBy={setSortBy}
        loading={loading}
      />
    </div>
  );
};

export default StorageStats;
