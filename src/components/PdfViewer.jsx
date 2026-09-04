import { useEffect, useRef } from 'react'

// --- Drag-to-scroll hook -------------------------------------------------
// Attach the returned ref to any element with overflow: auto/scroll.
// Click + drag with the mouse will pan the content, same as holding
// the "hand tool" in a PDF/image viewer.
function useDragScroll() {
  const ref = useRef(null)
  const state = useRef({ dragging: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const onPointerDown = (e) => {
      // only left mouse button, and only if content actually overflows
      if (e.button !== 0) return
      const overflows = el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight
      if (!overflows) return

      state.current.dragging = true
      state.current.startX = e.pageX
      state.current.startY = e.pageY
      state.current.scrollLeft = el.scrollLeft
      state.current.scrollTop = el.scrollTop

      el.classList.add('is-dragging')
      // prevents text/image selection while dragging
      e.preventDefault()
    }

    const onPointerMove = (e) => {
      if (!state.current.dragging) return
      const dx = e.pageX - state.current.startX
      const dy = e.pageY - state.current.startY
      el.scrollLeft = state.current.scrollLeft - dx
      el.scrollTop = state.current.scrollTop - dy
    }

    const stopDragging = () => {
      if (!state.current.dragging) return
      state.current.dragging = false
      el.classList.remove('is-dragging')
    }

    el.addEventListener('mousedown', onPointerDown)
    // listen on window so dragging still works if the cursor
    // leaves the element mid-drag
    window.addEventListener('mousemove', onPointerMove)
    window.addEventListener('mouseup', stopDragging)
    window.addEventListener('mouseleave', stopDragging)

    return () => {
      el.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('mousemove', onPointerMove)
      window.removeEventListener('mouseup', stopDragging)
      window.removeEventListener('mouseleave', stopDragging)
    }
  }, [])

  return ref
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function typeLabel(type) {
  switch (type) {
    case 'pdf': return 'PDF'
    case 'image': return 'IMAGE'
    case 'excel': return 'EXCEL'
    case 'word': return 'WORD'
    default: return 'FILE'
  }
}

const TYPE_ORDER = { pdf: 0, word: 1, excel: 2, other: 3, image: 4 }

function sortAttachments(list) {
  return [...list].sort((a, b) => (TYPE_ORDER[a.type] ?? 3) - (TYPE_ORDER[b.type] ?? 3))
}

function AttachmentBlock({ attachment }) {
  const { type, url, filename, size } = attachment
  const dragRef = useDragScroll()

  return (
    <div className="attachment-block">
      <div className="attachment-block-label">
        <span className="pdf-file-icon">{typeLabel(type)}</span>
        <span className="attachment-block-name">{filename}</span>
        {size ? <span className="attachment-block-size">{formatSize(size)}</span> : null}
      </div>

      {type === 'pdf' && (
        <div className="pdf-frame-wrap" ref={dragRef}>
          <iframe src={url} title={filename} />
          <div className="pdf-frame-edge" />
        </div>
      )}

      {type === 'image' && (
        <div className="attachment-image-wrap" ref={dragRef}>
          <img src={url} alt={filename} draggable={false} />
        </div>
      )}

      {(type === 'excel' || type === 'word' || type === 'other') && (
        <div className="attachment-fallback">
          <div className="attachment-fallback-name">{filename}</div>
          {size && <div className="attachment-fallback-size">{formatSize(size)}</div>}
          <a className="btn btn-primary attachment-download-btn" href={url} download={filename} target="_blank" rel="noreferrer">Open / Download</a>
        </div>
      )}
    </div>
  )
}

export default function PdfViewer({ email, attachments = [] }) {
  const scrollAreaRef = useRef(null)

  useEffect(() => {
    if (scrollAreaRef.current) scrollAreaRef.current.scrollTop = 0
  }, [email?.id])

  if (!email) {
    return (
      <div className="pdf-panel">
        <div className="pdf-empty">
          <div className="stamp-outline">NO DOC</div>
          <p>Select a declaration from the inbox to view its merged document.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pdf-panel">
      <div className="pdf-view-area" ref={scrollAreaRef}>
        <div className="mail-summary">
          <div className="mail-summary-top">
            <div className="mail-summary-subject">{email.subject || '(no subject)'}</div>
            {attachments.length > 0 && (
              <span className="attachment-count-badge">
                {attachments.length} attachment{attachments.length === 1 ? '' : 's'}
              </span>
            )}
          </div>
          <div className="mail-summary-meta">
            <span>{email.sender}</span>
            <span>&middot;</span>
            <span>{formatDate(email.received_date)}</span>
          </div>
          {email.body_preview && (
            <div className="mail-summary-body">{email.body_preview}</div>
          )}
        </div>

        {attachments.length === 0 ? (
          <p style={{ padding: 24, color: 'var(--muted)' }}>No attachments found for this email.</p>
        ) : (
          sortAttachments(attachments).map((att) => <AttachmentBlock key={att.id} attachment={att} />)
        )}
      </div>
    </div>
  )
}