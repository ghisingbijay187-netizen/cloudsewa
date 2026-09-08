import { useState, useEffect } from 'react';
import API from '../api/axios';
import { Filter, RefreshCw } from 'lucide-react';

import ActivityFilters from '../components/admin/ActivityFilters';
import ActivityStats from '../components/admin/ActivityStats';
import ActivityLogTable from '../components/admin/ActivityLogTable';
import useSessionState from '../hooks/useSessionState';
import { notify as toast } from '../utils/notify';

const ActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useSessionState('al:action', '');
  const [startDate, setStartDate] = useSessionState('al:startDate', '');
  const [endDate, setEndDate] = useSessionState('al:endDate', '');
  const [page, setPage] = useSessionState('al:page', 1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const [counts, setCounts] = useState({ fileOps: 0, authEvents: 0, backupEvents: 0 });
  const LIMIT = 20;

  useEffect(() => {
    fetchLogs();
  }, [page, action, startDate, endDate]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', LIMIT);
      if (action) params.append('action', action);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const { data } = await API.get(`/dashboard/activity?${params}`);
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
      setCounts(data.counts || { fileOps: 0, authEvents: 0, backupEvents: 0 });
    } catch (error) {
      console.error('Fetch logs error:', error);
      toast.error('Failed to load activity logs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setAction('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  return (
    <div className="page-container">

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Activity Logs</h1>
          <p className="page-subtitle">
            Complete audit trail of all system events —{' '}
            {loading && logs.length === 0 ? 'Loading…' : `${total} total records`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn btn-ghost"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={16} />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => { setPage(1); fetchLogs(); }}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {showFilters && (
        <ActivityFilters
          action={action}
          startDate={startDate}
          endDate={endDate}
          onActionChange={(v) => { setAction(v); setPage(1); }}
          onStartDateChange={(v) => { setStartDate(v); setPage(1); }}
          onEndDateChange={(v) => { setEndDate(v); setPage(1); }}
          onReset={handleReset}
        />
      )}

      <ActivityStats total={total} counts={counts} loading={loading} />

      <ActivityLogTable
        logs={logs}
        loading={loading}
        total={total}
        page={page}
        setPage={setPage}
        totalPages={totalPages}
        limit={LIMIT}
        action={action}
        startDate={startDate}
        endDate={endDate}
        onReset={handleReset}
      />
    </div>
  );
};

export default ActivityLogs;
