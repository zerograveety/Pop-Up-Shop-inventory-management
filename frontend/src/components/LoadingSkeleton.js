export default function LoadingSkeleton({ type = 'card' }) {
  if (type === 'card') {
    return (
      <div className="panel skeleton-card loading-skeleton">
        <div style={{ height: '60%', background: 'inherit' }} />
        <div style={{ padding: 'var(--space-4)' }}>
          <div className="skeleton-text loading-skeleton" />
          <div className="skeleton-text short loading-skeleton" />
          <div style={{ marginTop: 'var(--space-3)', height: '36px' }} className="loading-skeleton" />
        </div>
      </div>
    );
  }

  if (type === 'list') {
    return (
      <div className="list-item">
        <div style={{ flex: 1 }}>
          <div className="skeleton-text medium loading-skeleton" />
          <div className="skeleton-text short loading-skeleton" />
        </div>
        <div className="skeleton-text short loading-skeleton" style={{ width: '80px' }} />
      </div>
    );
  }

  return <div className="skeleton-text loading-skeleton" />;
}