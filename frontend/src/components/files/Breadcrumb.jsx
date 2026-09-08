import { Search, X, ChevronRight } from 'lucide-react';

const Breadcrumb = ({ search, setSearch, currentFolder, setCurrentFolder, breadcrumb, setBreadcrumb }) => {
  const navigateBreadcrumb = (index) => {
    const crumb = breadcrumb[index];
    setBreadcrumb(breadcrumb.slice(0, index));
    setCurrentFolder(crumb.id);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      marginBottom: '20px',
      flexWrap: 'wrap'
    }}>
      <div className="search-bar" style={{ flex: 1, maxWidth: '400px' }}>
        <Search size={16} className="search-icon" />
        <input
          className="form-input"
          placeholder="Search files..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ paddingLeft: '40px' }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{
              position: 'absolute',
              right: '12px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--gray-400)',
              display: 'flex'
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '0.875rem',
        color: 'var(--gray-500)'
      }}>
        <button
          onClick={() => {
            setCurrentFolder(null);
            setBreadcrumb([]);
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: currentFolder ? 'var(--primary-light)' : 'var(--gray-700)',
            fontWeight: currentFolder ? '400' : '600',
            fontSize: '0.875rem'
          }}
        >
          My Files
        </button>
        {breadcrumb.map((crumb, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <ChevronRight size={14} />
            <button
              onClick={() => navigateBreadcrumb(i)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: i === breadcrumb.length - 1
                  ? 'var(--gray-700)'
                  : 'var(--primary-light)',
                fontSize: '0.875rem'
              }}
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};

export default Breadcrumb;
