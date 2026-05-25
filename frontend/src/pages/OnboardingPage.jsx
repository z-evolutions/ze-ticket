import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import './OnboardingPage.css'

export default function OnboardingPage() {
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()

  const [email,        setEmail]        = useState(sessionStorage.getItem('onboarding_email') || '')
  const [onboardingPw, setOnboardingPw] = useState(sessionStorage.getItem('onboarding_password') || '')
  const [newPw,        setNewPw]        = useState('')
  const [newPwConfirm, setNewPwConfirm] = useState('')
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (newPw !== newPwConfirm) { setError('Die Passwörter stimmen nicht überein.'); return }
    setLoading(true)
    try {
      const res = await axios.post('/api/auth/onboarding', {
        email, onboarding_password: onboardingPw,
        new_password: newPw, new_password_confirm: newPwConfirm,
      })
      sessionStorage.removeItem('onboarding_email')
      sessionStorage.removeItem('onboarding_password')
      localStorage.setItem('ze-token', res.data.access_token)
      window.location.href = '/dashboard'
    } catch (err) {
      const detail = err.response?.data?.detail
      setError(Array.isArray(detail) ? detail.map(d => d.msg).join(' ') : detail || 'Fehler beim Passwort setzen.')
    } finally { setLoading(false) }
  }

  return (
    <div className="onboarding-page">
      <button className="theme-toggle" onClick={toggleTheme}>
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
      <div className="onboarding-card glass">
        <div className="onboarding-header">
          <div className="onboarding-logo">ZE</div>
          <h1 className="onboarding-title">{t('auth.onboarding_title')}</h1>
          <p className="onboarding-subtitle">{t('auth.onboarding_subtitle')}</p>
        </div>
        <div className="onboarding-info">🔐 {t('auth.onboarding_info')}</div>
        <form onSubmit={handleSubmit} className="onboarding-form">
          <div className="form-group">
            <label>{t('auth.email')}</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>{t('auth.onboarding_temp_pw')} <span className="onboarding-hint">{t('auth.onboarding_temp_pw_hint')}</span></label>
            <input type="password" value={onboardingPw} onChange={e => setOnboardingPw(e.target.value)}
              placeholder="Temporäres Passwort" required />
          </div>
          <div className="onboarding-divider" />
          <div className="form-group">
            <label>{t('auth.onboarding_new_pw')}</label>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
              placeholder="Mindestens 10 Zeichen" required autoFocus />
          </div>
          <div className="form-group">
            <label>{t('auth.onboarding_new_pw_confirm')}</label>
            <input type="password" value={newPwConfirm} onChange={e => setNewPwConfirm(e.target.value)}
              placeholder="Passwort wiederholen" required />
          </div>
          <div className="onboarding-policy">{t('auth.onboarding_policy')}</div>
          {error && <div className="onboarding-error">{error}</div>}
          <button type="submit" className="onboarding-btn" disabled={loading}>
            {loading ? t('auth.onboarding_submitting') : t('auth.onboarding_submit')}
          </button>
          <button type="button" className="onboarding-logout"
            onClick={() => { sessionStorage.clear(); window.location.href = '/login' }}>
            {t('auth.onboarding_back')}
          </button>
        </form>
      </div>
    </div>
  )
}
