const LABELS = {
  received: 'Received',
  processing: 'Processing',
  merged: 'Merged',
  extracted: 'Extracted',
  validated: 'Validated',
  submitted: 'Submitted',
  failed: 'Failed',
}

export default function StatusStamp({ status }) {
  const key = status || 'received'
  return <span className={`stamp ${key}`}>{LABELS[key] || key}</span>
}
