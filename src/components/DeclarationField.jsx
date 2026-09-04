function confidenceLevel(confidence) {
  if (confidence == null) return null
  if (confidence < 0.85) return 'low'
  return 'ok'
}

export default function DeclarationField({ label, value, confidence, onChange, mismatch }) {
  const level = mismatch ? 'mismatch' : confidenceLevel(confidence)
  const inputClass = [
    'field-input',
    level === 'low' ? 'conf-low' : '',
    level === 'mismatch' ? 'conf-mismatch' : '',
  ].filter(Boolean).join(' ')

  const showTag = confidence != null

  return (
    <div>
      <div className="field-row">
        <label className="field-label">{label}</label>
        <div className={`field-input-wrap ${showTag ? 'has-tag' : ''}`}>
          <input
            className={inputClass}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value)}
          />
          {showTag && (
            <span className="confidence-tag">{Math.round(confidence * 100)}%</span>
          )}
        </div>
      </div>
      {level === 'low' && (
        <div className="review-note" style={{ marginLeft: 118 }}>
          &#9650; Low confidence &mdash; verify against source document
        </div>
      )}
      {level === 'mismatch' && (
        <div className="review-note mismatch" style={{ marginLeft: 118 }}>
          &#9650; Value differs across documents &mdash; review required
        </div>
      )}
    </div>
  )
}
