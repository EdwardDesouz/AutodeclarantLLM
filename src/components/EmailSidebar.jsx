import { useState, useMemo } from 'react'
import StatusStamp from './StatusStamp'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.round(hrs / 24)}d ago`
}

export default function EmailSidebar({ emails = [], activeId, onSelect, onDismiss, loading }) {
  const [expandedAccount, setExpandedAccount] = useState(null)

  const accounts = useMemo(() => {
    const map = {}
    for (const email of emails) {
      const key = email.sender || 'Unknown'
      if (!map[key]) map[key] = []
      map[key].push(email)
    }
    return Object.entries(map).map(([sender, list]) => ({
      sender,
      count: list.length,
      emails: list,
    }))
  }, [emails])

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Inbox &middot; {emails.length}</h2>
      </div>

      {loading && (
        <div style={{ padding: 16 }}>
          <div className="skeleton-line" style={{ width: '80%' }} />
          <div className="skeleton-line" style={{ width: '60%' }} />
        </div>
      )}

      {!loading && accounts.length === 0 && (
        <div className="empty-state">
          <div className="stamp-outline">EMPTY</div>
          <p>No unopened declarations. New emails will appear here.</p>
        </div>
      )}

      {!loading && accounts.map((acct) => (
        <div key={acct.sender} className="account-group">
          <button
            className="account-header"
            onClick={() =>
              setExpandedAccount(expandedAccount === acct.sender ? null : acct.sender)
            }
          >
            <span className="account-name">{acct.sender}</span>
            <span className="account-badge">{acct.count}</span>
            <span className={`account-chevron ${expandedAccount === acct.sender ? 'open' : ''}`}>▾</span>
          </button>

          {expandedAccount === acct.sender && (
            <div className="account-emails">
              {acct.emails.map((email) => (
                <div
                  key={email.id}
                  className={`email-item ${activeId === email.id ? 'active' : ''}`}
                >
                  <button
                    className="email-item-dismiss"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDismiss(email.id)
                    }}
                    aria-label="Dismiss"
                  >
                    ✕
                  </button>

                  <button className="email-item-body" onClick={() => onSelect(email.id)}>
                    <div className="email-subject">{email.subject || '(no subject)'}</div>
                    <div className="email-meta-row">
                      <StatusStamp status={email.status} />
                      <span className="attachment-count">
                        {email.attachment_count} file{email.attachment_count === 1 ? '' : 's'}
                      </span>
                      <span className="attachment-count" style={{ marginLeft: 'auto' }}>
                        {timeAgo(email.received_date)}
                      </span>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </aside>
  )
}