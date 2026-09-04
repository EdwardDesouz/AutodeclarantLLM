export default function CrossCheckBanner({ checks }) {
  if (!checks || checks.length === 0) return null

  return (
    <div className="field-section">
      <div className="field-section-title">Cross-document validation</div>
      {checks.map((check, idx) => (
        <div key={idx} className={`cross-check ${check.match ? 'match' : 'mismatch'}`}>
          <span className="cross-check-icon">{check.match ? '\u2713' : '\u2715'}</span>
          <span>
            <strong>{check.field}:</strong>{' '}
            {check.match
              ? `Matches across ${check.sources.join(', ')} (${check.value}).`
              : `Mismatch — ${check.sources.map((s) => `${s.name} = ${s.value}`).join(', ')}.`}
          </span>
        </div>
      ))}
    </div>
  )
}
