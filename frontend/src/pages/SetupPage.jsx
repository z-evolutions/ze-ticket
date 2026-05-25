import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import './SetupPage.css'

export default function SetupPage() {
  const { theme, toggleTheme } = useTheme()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [checking,  setChecking]  = useState(true)
  const [form,      setForm]      = useState({
    email: '', display_name: '', full_name: '', password: '', password_confirm: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState(null)
  const [success,    setSuccess]    = useState(false)

  useEffect(() => {
    // Prüfen ob Setup nötig — wenn nicht → Login
    axios.get('/api/setup/status').then(res => {
      if (!res.data.setup_required) {
        navigate('/login', { replace: true })
      } else {
        setChecking(false)
      }
    }).catch(() => setChecking(false))
  }, [])

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password !== form.password_confirm) {
      setError('Passwörter stimmen nicht überein.'); return
    }
    setSubmitting(true); setError(null)
    try {
      await axios.post('/api/setup/create-admin', form)
      setSuccess(true)
      setTimeout(() => navigate('/login', { replace: true }), 3000)
    } catch (err) {
      setError(err.response?.data?.detail || 'Fehler beim Anlegen des Administrators.')
    } finally {
      setSubmitting(false)
    }
  }

  const isValid = form.email && form.display_name && form.password && form.password_confirm

  if (checking) return null

  if (success) {
    return (
      <div className="setup-page">
        <div className="setup-card glass">
          <div className="setup-success">
            <span className="setup-success__icon">✅</span>
            <h1>Administrator angelegt!</h1>
            <p>Sie werden in Kürze zur Anmeldeseite weitergeleitet…</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="setup-page">
      <button className="theme-toggle" onClick={toggleTheme}>
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      <div className="setup-card glass">
        <div className="setup-header">
          <div className="setup-logo">ZE</div>
          <h1 className="setup-title">ZE-Ticket — Ersteinrichtung</h1>
          <p className="setup-sub">Legen Sie den ersten Administrator an um zu beginnen.</p>
        </div>

        <div className="setup-warning">
          ⚠️ Diese Seite ist nur zugänglich solange kein Administrator existiert.
          Nach dem Anlegen wird sie dauerhaft gesperrt.
        </div>

        <form onSubmit={handleSubmit} className="setup-form">
          <div className="setup-field">
            <label>E-Mail <span className="setup-required">*</span></label>
            <input type="email" name="email" value={form.email}
              onChange={handleChange} required autoFocus
              placeholder="admin@beispiel.de" />
          </div>

          <div className="setup-row">
            <div className="setup-field">
              <label>Anzeigename <span className="setup-required">*</span></label>
              <input type="text" name="display_name" value={form.display_name}
                onChange={handleChange} required placeholder="Max M." />
            </div>
            <div className="setup-field">
              <label>Vollständiger Name</label>
              <input type="text" name="full_name" value={form.full_name}
                onChange={handleChange} placeholder="Max Mustermann" />
            </div>
          </div>

          <div className="setup-row">
            <div className="setup-field">
              <label>Passwort <span className="setup-required">*</span></label>
              <input type="password" name="password" value={form.password}
                onChange={handleChange} required placeholder="Mindestens 10 Zeichen" />
            </div>
            <div className="setup-field">
              <label>Passwort bestätigen <span className="setup-required">*</span></label>
              <input type="password" name="password_confirm" value={form.password_confirm}
                onChange={handleChange} required placeholder="Passwort wiederholen" />
            </div>
          </div>

          <div className="setup-policy">
            Mindestens 10 Zeichen · Groß- & Kleinbuchstaben · Zahl · Sonderzeichen
          </div>

          {error && <div className="setup-error">{error}</div>}

          <button type="submit" className="setup-submit-btn" disabled={!isValid || submitting}>
            {submitting ? 'Wird angelegt…' : 'Administrator anlegen & System starten'}
          </button>
        </form>
      </div>
    </div>
  )
}
