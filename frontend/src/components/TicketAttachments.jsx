import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import './TicketAttachments.css'

const ICONS = {
  'application/pdf': '📄',
  'image/jpeg': '🖼️',
  'image/png': '🖼️',
  'image/gif': '🖼️',
  'image/webp': '🖼️',
  'text/plain': '📝',
  'text/csv': '📊',
  'application/zip': '🗜️',
  'application/x-zip-compressed': '🗜️',
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export default function TicketAttachments({ ticketId, isAgent }) {
  const [attachments, setAttachments] = useState([])
  const [uploading,   setUploading]   = useState(false)
  const [error,       setError]       = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    loadAttachments()
  }, [ticketId])

  async function loadAttachments() {
    try {
      const res = await axios.get(`/api/attachments/ticket/${ticketId}`)
      setAttachments(res.data)
    } catch {}
  }

  async function handleDownload(attachment) {
    try {
      const res = await axios.get(attachment.url, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: attachment.mimetype })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch {
      setError('Fehler beim Herunterladen.')
    }
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true); setError(null)
    try {
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        const res = await axios.post(
          `/api/attachments/upload?ticket_id=${ticketId}`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        )
        setAttachments(prev => [...prev, res.data])
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Fehler beim Hochladen.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Anhang wirklich löschen?')) return
    try {
      await axios.delete(`/api/attachments/${id}`)
      setAttachments(prev => prev.filter(a => a.id !== id))
    } catch {
      setError('Fehler beim Löschen.')
    }
  }

  return (
    <div className="attachments-section glass">
      <div className="attachments-header">
        <span className="attachments-title">Anhänge</span>
        <span className="attachments-count">{attachments.length}</span>
        {isAgent && (
          <>
            <input type="file" ref={fileRef} multiple
              style={{ display: 'none' }} onChange={handleUpload}
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.zip"
            />
            <button className="attachments-upload-btn"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}>
              {uploading ? '⏳' : '+ Datei'}
            </button>
          </>
        )}
      </div>

      {error && <div className="attachments-error">{error}</div>}

      {attachments.length === 0 ? (
        <div className="attachments-empty">Keine Anhänge</div>
      ) : (
        <div className="attachments-list">
          {attachments.map(a => (
            <div key={a.id} className="attachment-item">
              <span className="attachment-icon">
                {ICONS[a.mimetype] || '📎'}
              </span>
              <button className="attachment-name attachment-name--btn"
                onClick={() => handleDownload(a)}>
                {a.filename}
              </button>
              <span className="attachment-size">{formatBytes(a.filesize)}</span>
              {isAgent && (
                <button className="attachment-delete-btn"
                  onClick={() => handleDelete(a.id)}
                  title="Löschen">✕</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
