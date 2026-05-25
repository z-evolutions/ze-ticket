import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import PrivacyModal from '../components/PrivacyModal'
import './TicketRequestPage.css'

export default function TicketRequestPage() {
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', subject: '', description: ''
  })
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [showPrivacy,     setShowPrivacy]     = useState(false)
  const [submitting,      setSubmitting]      = useState(false)
  const [error,           setError]           = useState(null)
  const [success,         setSuccess]         = useState(null)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!privacyAccepted) {
      setError(t('privacy.checkbox_required'))
      return
    }
    setSubmitting(true); setError(null)
    try {
      const res = await axios.post('/api/portal/request-ticket', form)
      setSuccess(res.data.ticket_number)
    } catch (err) {
      setError(err.response?.data?.detail || 'Fehler beim Absenden.')
    } finally {
      setSubmitting(false)
    }
  }

  const isValid = form.first_name && form.last_name && form.email &&
                  form.subject && form.description && privacyAccepted

  if (success) {
    return (
      <div className="treq-page">
        <button className="theme-toggle" onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
        <div className="treq-success glass">
          <div className="treq-success__icon">✅</div>
          <h1 className="treq-success__title">{t('portal.form_success_title')}</h1>
          <p className="treq-success__text">{t('portal.form_success_text')}</p>
          <div className="treq-success__number">
            <span className="treq-success__label">{t('portal.form_success_number')}</span>
            <span className="treq-success__ticket">{success}</span>
          </div>
          <button className="treq-back-btn" onClick={() => navigate('/login')}>
            {t('portal.form_back_login')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="treq-page">
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}

      <button className="theme-toggle" onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>

      <div className="treq-card glass">
        <div className="treq-header">
          <div className="treq-logo">ZE</div>
          <h1 className="treq-title">{t('portal.form_title')}</h1>
          <p className="treq-sub">{t('portal.form_sub')}</p>
        </div>

        <form onSubmit={handleSubmit} className="treq-form" noValidate>
          <div className="treq-row">
            <div className="treq-field">
              <label>{t('portal.form_first_name')} <span className="treq-required">*</span></label>
              <input type="text" name="first_name" value={form.first_name}
                onChange={handleChange} required autoFocus />
            </div>
            <div className="treq-field">
              <label>{t('portal.form_last_name')} <span className="treq-required">*</span></label>
              <input type="text" name="last_name" value={form.last_name}
                onChange={handleChange} required />
            </div>
          </div>

          <div className="treq-field">
            <label>{t('portal.form_email')} <span className="treq-required">*</span></label>
            <input type="email" name="email" value={form.email}
              onChange={handleChange} required placeholder="name@beispiel.de" />
          </div>

          <div className="treq-field">
            <label>{t('portal.form_subject')} <span className="treq-required">*</span></label>
            <input type="text" name="subject" value={form.subject}
              onChange={handleChange} required placeholder="Kurze Beschreibung des Problems…" />
          </div>

          <div className="treq-field">
            <label>{t('portal.form_description')} <span className="treq-required">*</span></label>
            <textarea name="description" value={form.description}
              onChange={handleChange} required rows={6}
              placeholder="Beschreiben Sie Ihr Anliegen so detailliert wie möglich…" />
          </div>

          {/* ── Datenschutz-Checkbox ── */}
          <div className="treq-privacy">
            <label className="treq-privacy__label">
              <input
                type="checkbox"
                className="treq-privacy__checkbox"
                checked={privacyAccepted}
                onChange={e => setPrivacyAccepted(e.target.checked)}
              />
              <span className="treq-privacy__text">
                {t('privacy.checkbox_before')}{' '}
                <button
                  type="button"
                  className="treq-privacy__link"
                  onClick={() => setShowPrivacy(true)}
                >
                  {t('privacy.link')}
                </button>
                {' '}{t('privacy.checkbox_after')}
              </span>
            </label>
          </div>

          {error && <div className="treq-error">{error}</div>}

          <div className="treq-footer">
            <button type="button" className="treq-cancel-btn" onClick={() => navigate('/login')}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="treq-submit-btn" disabled={!isValid || submitting}>
              {submitting ? t('portal.form_submitting') : t('portal.form_submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
