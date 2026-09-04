export default function TopBar({ pendingCount, lastSync }) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <h1>Manifest Desk</h1>
        <span className="brand-tag">Declarant Review</span>
      </div>
      <div className="topbar-meta">
        {pendingCount > 0 && (
          <span className="pending-pill">
            <span className="dot" />
            {pendingCount} awaiting review
          </span>
        )}
        <span>Synced {lastSync}</span>
      </div>
    </header>
  )
}
