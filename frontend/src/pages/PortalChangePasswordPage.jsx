import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import './PortalTicketsPage.css'

export default function PortalChangePasswordPage() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    current_password: '', new_password: '', new_password_confirm: ''
  })
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState(null)
  const [success,     setSuccess]     = useState(false)
  const [showDelete,  setShowDelete]  = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.new_password !== form.new_password_confirm) {
      setError(t('portal.pw_mismatch')); return
    }
    setSubmitting(true); setError(null)
    try {
      await axios.post('/api/portal/change-password', form)
      setSuccess(true)
      setTimeout(() => navigate('/portal'), 2000)
    } catch (err) {
      setError(err.response?.data?.detail || t('portal.pw_error'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDeleteAccount() {
    setDeleting(true); setDeleteError(null)
    try {
      await axios.post('/api/portal/delete-account')
      logout()
      window.location.href = '/login?deleted=1'
    } catch (err) {
      setDeleteError(err.response?.data?.detail || t('portal.delete_account_error'))
      setDeleting(false)
    }
  }

  return (
    <div className="portal-page">
      <header className="portal-header glass">
        <div className="portal-header__brand" onClick={() => navigate('/portal')}>
          <div className="portal-header__logo">ZE</div>
          <span className="portal-header__title">ZE-Ticket</span>
          <span className="portal-header__badge">Portal</span>
        </div>
        <div className="portal-header__actions">
          <button className="portal-theme-btn" onClick={toggleTheme}>{theme === 'dark' ? '☀️' : '🌙'}</button>
          <span className="portal-header__user">{user?.display_name}</span>
          <button className="portal-logout-btn" onClick={() => { logout(); window.location.href = '/login' }}>
            {t('portal.logout')}
          </button>
        </div>
      </header>

      <main className="portal-main">
        <div className="portal-breadcrumb">
          <button className="portal-back-btn" onClick={() => navigate('/portal')}>
            {t('portal.back_to_tickets')}
          </button>
        </div>

        <div className="portal-pw-card glass">
          <h1 className="portal-pw-title">{t('portal.pw_title')}</h1>
          <p className="portal-pw-sub">{t('portal.pw_sub')}</p>

          {success ? (
            <div className="portal-pw-success">{t('portal.pw_success')}</div>
          ) : (
            <form onSubmit={handleSubmit} className="portal-pw-form">
              <div className="portal-pw-field">
                <label>{t('portal.pw_current')}</label>
                <input type="password" name="current_password"
                  value={form.current_password} onChange={handleChange} required autoFocus />
              </div>
              <div className="portal-pw-field">
                <label>{t('portal.pw_new')}</label>
                <input type="password" name="new_password"
                  value={form.new_password} onChange={handleChange} required
                  placeholder={t('auth.onboarding_placeholder_new')} />
              </div>
              <div className="portal-pw-field">
                <label>{t('portal.pw_confirm')}</label>
                <input type="password" name="new_password_confirm"
                  value={form.new_password_confirm} onChange={handleChange} required />
              </div>
              <div className="portal-pw-policy">{t('portal.pw_policy')}</div>
              {error && <div className="portal-pw-error">{error}</div>}
              <div className="portal-pw-footer">
                <button type="button" className="portal-back-btn"
                  onClick={() => navigate('/portal')}>{t('common.cancel')}</button>
                <button type="submit" className="portal-pw-submit"
                  disabled={!form.current_password || !form.new_password || submitting}>
                  {submitting ? t('common.saving') : t('portal.pw_submit')}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ── Konto löschen ── */}
        <div className="portal-delete-section">
          <button className="portal-delete-btn" onClick={() => setShowDelete(true)}>
            🗑️ {t('portal.delete_account')}
          </button>
        </div>

        {/* ── Bestätigungs-Modal ── */}
        {showDelete && (
          <div className="portal-modal-overlay" onClick={e => e.target === e.currentTarget && setShowDelete(false)}>
            <div className="portal-modal glass">
              <h2 className="portal-modal__title">⚠️ {t('portal.delete_account_title')}</h2>
              <p className="portal-modal__text">{t('portal.delete_account_warning')}</p>
              {deleteError && <div className="portal-pw-error">{deleteError}</div>}
              <div className="portal-modal__footer">
                <button className="portal-back-btn" onClick={() => setShowDelete(false)}>
                  {t('portal.delete_account_cancel')}
                </button>
                <button className="portal-delete-confirm-btn" onClick={handleDeleteAccount} disabled={deleting}>
                  {deleting ? t('portal.deleting') : t('portal.delete_account_confirm')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
