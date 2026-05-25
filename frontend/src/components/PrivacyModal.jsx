import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import './PrivacyModal.css'

export default function PrivacyModal({ onClose, type = 'privacy_text' }) {
  const { t } = useTranslation()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axios.get(`/api/config/${type}/rendered`)
      .then(r => setContent(r.data.value || ''))
      .catch(() => setContent('<p>Inhalt konnte nicht geladen werden.</p>'))
      .finally(() => setLoading(false))
  }, [type])

  function handleBackdrop(e) {
    if (e.target === e.currentTarget) onClose()
  }

  const title = type === 'imprint_text'
    ? t('privacy.imprint_title')
    : t('privacy.title')

  const closeBtn = type === 'imprint_text'
    ? t('privacy.imprint_close')
    : t('privacy.close_btn')

  return (
    <div className="privacy-overlay" onClick={handleBackdrop}>
      <div className="privacy-modal glass">
        <div className="privacy-modal__header">
          <h2 className="privacy-modal__title">{title}</h2>
          <button className="privacy-modal__close" onClick={onClose} aria-label="Schließen">✕</button>
        </div>

        <div className="privacy-modal__body">
          {loading
            ? <div className="privacy-loading">Lade…</div>
            : <div
                className="privacy-content"
                dangerouslySetInnerHTML={{ __html: content }}
              />
          }
        </div>

        <div className="privacy-modal__footer">
          <button className="privacy-close-btn" onClick={onClose}>
            {closeBtn}
          </button>
        </div>
      </div>
    </div>
  )
}
