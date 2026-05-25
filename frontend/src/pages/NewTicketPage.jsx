import { useState, useRef } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { createTicket } from '../api/tickets'
import NavBar from '../components/NavBar'
import './NewTicketPage.css'

export default function NewTicketPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const PRIORITY_OPTIONS = [
    { value: 'niedrig',  label: t('tickets.priority_niedrig') },
    { value: 'normal',   label: t('tickets.priority_normal') },
    { value: 'hoch',     label: t('tickets.priority_hoch') },
    { value: 'kritisch', label: t('tickets.priority_kritisch') },
  ]

  const [subject,     setSubject]     = useState('')
  const [description, setDescription] = useState('')
  const [priority,    setPriority]    = useState('normal')
  const [tagInput,    setTagInput]    = useState('')
  const [tags,        setTags]        = useState([])
  const [submitting,  setSubmitting]  = useState(false)
  const [files,        setFiles]        = useState([])
  const fileRef = useRef(null)
  const [error,       setError]       = useState(null)

  function addTag() {
    const cleaned = tagInput.trim().toLowerCase().replace(/\s+/g, '-')
    if (cleaned && !tags.includes(cleaned) && tags.length < 10) {
      setTags(prev => [...prev, cleaned])
    }
    setTagInput('')
  }

  function handleTagKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
    if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags(prev => prev.slice(0, -1))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!subject.trim() || !description.trim()) {
      setError(t('new_ticket.error_required')); return
    }
    setSubmitting(true); setError(null)
    try {
      const ticket = await createTicket({ subject, description, priority, tags })
      // Anhänge hochladen
      for (const file of files) {
        const formData = new FormData()
        formData.append('file', file)
        try {
          await axios.post(`/api/attachments/upload?ticket_id=${ticket.id}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          })
        } catch {}
      }
      navigate(`/tickets/${ticket.id}`)
    } catch {
      setError(t('new_ticket.error_submit'))
      setSubmitting(false)
    }
  }

  const isValid = subject.trim().length > 0 && description.trim().length > 0

  return (
    <div className="new-page">
      <NavBar />
      <main className="new-main">
        <div className="new-breadcrumb">
          <button className="new-back-btn" onClick={() => navigate('/tickets')}>
            {t('new_ticket.back')}
          </button>
          <span className="new-breadcrumb__label">{t('new_ticket.breadcrumb')}</span>
        </div>

        <div className="new-layout">
          <form className="new-form glass" onSubmit={handleSubmit} noValidate>
            <h1 className="new-form__title">{t('new_ticket.title')}</h1>
            {error && <div className="new-error">{error}</div>}

            <div className="new-field">
              <label className="new-label" htmlFor="subject">
                {t('new_ticket.subject')} <span className="new-required">*</span>
              </label>
              <input id="subject" type="text" className="new-input"
                placeholder={t('new_ticket.subject_placeholder')}
                value={subject} onChange={e => setSubject(e.target.value)}
                maxLength={500} autoFocus />
              <span className="new-char-count">{subject.length}/500</span>
            </div>

            <div className="new-field">
              <label className="new-label" htmlFor="description">
                {t('new_ticket.description')} <span className="new-required">*</span>
              </label>
              <textarea id="description" className="new-textarea"
                placeholder={t('new_ticket.description_placeholder')}
                value={description} onChange={e => setDescription(e.target.value)} rows={8} />
            </div>

            <div className="new-field">
              <label className="new-label">{t('new_ticket.priority')}</label>
              <div className="new-priority-group">
                {PRIORITY_OPTIONS.map(opt => (
                  <button key={opt.value} type="button"
                    className={`new-priority-btn new-priority-btn--${opt.value} ${priority === opt.value ? 'new-priority-btn--active' : ''}`}
                    onClick={() => setPriority(opt.value)}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="new-field">
              <label className="new-label">
                {t('new_ticket.tags')} <span className="new-optional">{t('new_ticket.tags_optional')}</span>
              </label>
              <div className="new-tag-input-wrap">
                {tags.map(tag => (
                  <span key={tag} className="new-tag">
                    {tag}
                    <button type="button" className="new-tag__remove" onClick={() => setTags(prev => prev.filter(t => t !== tag))}>×</button>
                  </span>
                ))}
                <input type="text" className="new-tag-input"
                  placeholder={tags.length === 0 ? t('new_ticket.tags_placeholder') : ''}
                  value={tagInput} onChange={e => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown} onBlur={addTag} />
              </div>
              <span className="new-field-hint">{t('new_ticket.tags_hint')}</span>
            </div>

            <div className="new-form__footer">
              {/* ── Dateianhänge ── */}
              <div className="new-attachments">
                <label className="new-label">{t('new_ticket.attachments')} (optional)</label>
                <div className="new-dropzone" onClick={() => fileRef.current?.click()}>
                  <input type="file" ref={fileRef} multiple style={{ display: 'none' }}
                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.zip"
                    onChange={e => setFiles(Array.from(e.target.files))}
                  />
                  {files.length === 0
                    ? <span className="new-dropzone__hint">📎 {t('new_ticket.choose_attachment')}</span>
                    : <span className="new-dropzone__files">{files.map(f => f.name).join(', ')}</span>
                  }
                </div>
              </div>

              <button type="button" className="new-cancel-btn" onClick={() => navigate('/tickets')}>
                {t('new_ticket.cancel')}
              </button>
              <button type="submit" className="new-submit-btn" disabled={!isValid || submitting}>
                {submitting ? t('new_ticket.submitting') : t('new_ticket.submit')}
              </button>
            </div>
          </form>

          <aside className="new-hints glass">
            <h3 className="new-hints__title">{t('new_ticket.hints_title')}</h3>
            <ul className="new-hints__list">
              <li><span className="new-hints__icon">📝</span><span><strong>{t('new_ticket.hint_subject').split(' — ')[0]}</strong> — {t('new_ticket.hint_subject').split(' — ')[1]}</span></li>
              <li><span className="new-hints__icon">🔍</span><span><strong>{t('new_ticket.hint_details').split(' — ')[0]}</strong> — {t('new_ticket.hint_details').split(' — ')[1]}</span></li>
              <li><span className="new-hints__icon">⚡</span><span><strong>{t('new_ticket.hint_priority').split(' — ')[0]}</strong> — {t('new_ticket.hint_priority').split(' — ')[1]}</span></li>
              <li><span className="new-hints__icon">🏷️</span><span><strong>{t('new_ticket.hint_tags').split(' — ')[0]}</strong> — {t('new_ticket.hint_tags').split(' — ')[1]}</span></li>
            </ul>
            <div className="new-hints__divider" />
            <div className="new-hints__info">
              <span className="new-hints__info-label">{t('new_ticket.info_format')}</span>
              <span className="new-hints__info-value">ZE-{new Date().getFullYear()}-XXXX</span>
            </div>
            <div className="new-hints__info">
              <span className="new-hints__info-label">{t('new_ticket.info_channel')}</span>
              <span className="new-hints__info-value">{t('new_ticket.info_channel_web')}</span>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}
