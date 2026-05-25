import { useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import PrivacyModal from '../components/PrivacyModal'
import { useLogo } from '../hooks/useLogo'
import './LoginPage.css'

export default function LoginPage() {
  const { theme, toggleTheme } = useTheme()
  const { login } = useAuth()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const [custEmail,    setCustEmail]    = useState('')
  const [custTicket,   setCustTicket]   = useState('')
  const [custPassword, setCustPassword] = useState('')
  const [custError,    setCustError]    = useState('')
  const [custLoading,  setCustLoading]  = useState(false)

  const [showPrivacy,  setShowPrivacy]  = useState(false)
  const [showImprint,  setShowImprint]  = useState(false)
  const logoUrl = useLogo()

  async function handleAgentLogin(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await axios.post('/api/auth/login', { email, password })
      login(res.data.access_token)
      window.location.href = '/dashboard'
    } catch (err) {
      const requiresOnboarding = err.response?.headers?.['x-requires-onboarding']
      if (err.response?.status === 403 && requiresOnboarding === 'true') {
        sessionStorage.setItem('onboarding_email', email)
        sessionStorage.setItem('onboarding_password', password)
        window.location.href = '/onboarding'
        return
      }
      setError(err.response?.data?.detail || t('auth.login_failed'))
    } finally {
      setLoading(false)
    }
  }

  async function handleCustomerLogin(e) {
    e.preventDefault()
    setCustError('')
    setCustLoading(true)
    try {
      const res = await axios.post('/api/auth/customer-login', {
        email: custEmail,
        ticket_number: custTicket,
        password: custPassword,
      })
      login(res.data.access_token)
      window.location.href = `/portal/tickets/${res.data.redirect_ticket_id}`
    } catch (err) {
      setCustError(err.response?.data?.detail || t('portal.customer_login_error'))
    } finally {
      setCustLoading(false)
    }
  }

  function toggleLanguage() {
    const next = i18n.language === 'de' ? 'en' : 'de'
    i18n.changeLanguage(next)
    localStorage.setItem('ze-language', next)
  }

  return (
    <div className="login-page">
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
      {showImprint && <PrivacyModal type="imprint_text" onClose={() => setShowImprint(false)} />}

      <div className="login-top-actions">
        <button className="theme-toggle" onClick={toggleTheme} title="Theme wechseln">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className="login-lang-btn" onClick={toggleLanguage}>
          {i18n.language === 'de' ? '🇬🇧' : '🇩🇪'}
        </button>
      </div>

      <div className="login-header-brand">
        <div className="login-logo">
          {logoUrl
            ? <img src={logoUrl} alt="ZE-Ticket" className="login-logo-img" />
            : <span>ZE</span>
          }
        </div>
        <h1 className="login-brand-title">ZE-Ticket</h1>
        <p className="login-brand-sub">{t('portal.title')}</p>
      </div>

      <div className="login-columns">

        {/* ── Ticket beantragen ── */}
        <div className="login-card login-card--agent glass">
          <div className="login-card__header">
            <span className="login-card__icon">🎫</span>
            <h2 className="login-card__title">{t('portal.new_ticket_apply')}</h2>
          </div>
            <div className="login-request-ticket">
              <button className="login-request-btn" onClick={() => navigate('/ticket-beantragen')}>
                🎫 {t('portal.request_ticket')}
              </button>
              <p className="login-request-sub">{t('portal.request_ticket_sub')}</p>
            </div>
            <p className="login-privacy-hint">
              <button type="button" className="login-privacy-link" onClick={() => setShowPrivacy(true)}>
                {t('privacy.link')}
              </button>
            </p>
        </div>

        {/* ── Kunden-Login ── */}
        <div className="login-card login-card--customer glass">
          <div className="login-card__header">
            <span className="login-card__icon">🎫</span>
            <h2 className="login-card__title">{t('portal.customer_login')}</h2>
            <p className="login-card__sub">{t('portal.customer_login_sub')}</p>
          </div>
          <form onSubmit={handleCustomerLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="cust-email">{t('auth.email')}</label>
              <input id="cust-email" type="email" value={custEmail}
                onChange={e => setCustEmail(e.target.value)}
                placeholder="name@beispiel.de" required autoFocus />
            </div>
            <div className="form-group">
              <label htmlFor="cust-ticket">{t('portal.ticket_number')}</label>
              <input id="cust-ticket" type="text" value={custTicket}
                onChange={e => setCustTicket(e.target.value.toUpperCase())}
                placeholder={t('portal.ticket_number_placeholder')} required />
            </div>
            <div className="form-group">
              <label htmlFor="cust-password">{t('auth.password')}</label>
              <input id="cust-password" type="password" value={custPassword}
                onChange={e => setCustPassword(e.target.value)}
                placeholder="••••••••••" required />
            </div>
            {custError && <div className="login-error">{custError}</div>}
            <button type="submit" className="login-btn login-btn--customer" disabled={custLoading}>
              {custLoading ? t('portal.customer_login_loading') : t('portal.customer_login_btn')}
            </button>
          </form>
        </div>

        {/* ── Mitarbeiter-Login ── */}
            <div className="login-card login-card--agent glass">
              <div className="login-card__header">
                <span className="login-card__icon">👤</span>
                <h2 className="login-card__title">{t('portal.agent_login')}</h2>
                <p className="login-card__sub">{t('portal.agent_login_sub')}</p>
              </div>
              <form onSubmit={handleAgentLogin} className="login-form">
                <div className="form-group">
                  <label htmlFor="email">{t('auth.email')}</label>
                  <input id="email" type="email" value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="name@beispiel.de" required />
                </div>
                <div className="form-group">
                  <label htmlFor="password">{t('auth.password')}</label>
                  <input id="password" type="password" value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••" required />
                </div>
                {error && <div className="login-error">{error}</div>}
                <button type="submit" className="login-btn login-btn--agent" disabled={loading}>
                  {loading ? t('auth.login_loading') : t('auth.login_btn')}
                </button>
                <a href="/reset-password" className="forgot-link">{t('auth.forgot_password')}</a>
              </form>
            </div>

      </div>

      {/* ── Footer Links ── */}
      <div className="login-footer-links">
        <button className="login-privacy-link" onClick={() => setShowPrivacy(true)}>
          {t('privacy.link')}
        </button>
        <span className="login-footer-sep">·</span>
        <button className="login-privacy-link" onClick={() => setShowImprint(true)}>
          {t('privacy.imprint_link')}
        </button>
      </div>
    </div>
  )
}
