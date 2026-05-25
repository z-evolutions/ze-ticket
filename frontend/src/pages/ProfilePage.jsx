import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import NavBar from '../components/NavBar'
import './ProfilePage.css'

function PasswordStrength({ password }) {
  const { t } = useTranslation()
  const checks = [
    { label: t('profile.pw_check_length'),  ok: password.length >= 10 },
    { label: t('profile.pw_check_upper'),   ok: /[A-Z]/.test(password) },
    { label: t('profile.pw_check_lower'),   ok: /[a-z]/.test(password) },
    { label: t('profile.pw_check_number'),  ok: /[0-9]/.test(password) },
    { label: t('profile.pw_check_special'), ok: /[^A-Za-z0-9]/.test(password) },
  ]
  const score = checks.filter(c => c.ok).length
  const color = score <= 2 ? '#ef4444' : score <= 3 ? '#f59e0b' : '#22c55e'
  const label = score <= 2 ? t('profile.pw_strength_weak')
    : score <= 3 ? t('profile.pw_strength_medium')
    : score === 4 ? t('profile.pw_strength_good')
    : t('profile.pw_strength_strong')

  return (
    <div className="pw-strength">
      <div className="pw-strength__bar">
        <div className="pw-strength__fill" style={{ width: `${score * 20}%`, background: color }} />
      </div>
      <div className="pw-strength__meta">
        <span style={{ color }}>{label}</span>
        <div className="pw-strength__checks">
          {checks.map((c, i) => (
            <span key={i} className={`pw-strength__check ${c.ok ? 'pw-strength__check--ok' : ''}`}>
              {c.ok ? '✓' : '○'} {c.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const { user, login } = useAuth()
  const { setTheme } = useTheme()
  const { t, i18n } = useTranslation()
  const fileRef = useRef(null)

  const [form, setForm] = useState({
    display_name: '',
    full_name: '',
    theme: 'dark',
    language: 'de',
  })
  const [avatarUrl,       setAvatarUrl]       = useState(null)
  const [saving,          setSaving]          = useState(false)
  const [saveMsg,         setSaveMsg]         = useState(null)
  const [pw,              setPw]              = useState({ current: '', new: '', confirm: '' })
  const [pwSaving,        setPwSaving]        = useState(false)
  const [pwMsg,           setPwMsg]           = useState(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarMsg,       setAvatarMsg]       = useState(null)

  useEffect(() => {
    axios.get('/api/users/me').then(res => {
      const u = res.data
      setForm({
        display_name: u.display_name || '',
        full_name:    u.full_name    || '',
        theme:        u.theme        || 'dark',
        language:     u.language     || 'de',
      })
      setAvatarUrl(u.avatar_url || null)
    })
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setSaveMsg(null)
    try {
      await axios.patch('/api/users/me', form)
      setTheme(form.theme)
      i18n.changeLanguage(form.language)
      localStorage.setItem('ze-language', form.language)
      setSaveMsg({ type: 'success', text: t('profile.saved') })
    } catch {
      setSaveMsg({ type: 'error', text: t('profile.save_error') })
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 3000)
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setAvatarMsg({ type: 'error', text: t('profile.avatar_too_large') }); return
    }
    setAvatarUploading(true); setAvatarMsg(null)
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await axios.post('/api/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setAvatarUrl(res.data.avatar_url)
      setAvatarMsg({ type: 'success', text: '✓' })
    } catch (err) {
      setAvatarMsg({ type: 'error', text: err.response?.data?.detail || t('profile.avatar_error') })
    } finally {
      setAvatarUploading(false)
      setTimeout(() => setAvatarMsg(null), 3000)
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault()
    if (pw.new !== pw.confirm) {
      setPwMsg({ type: 'error', text: t('profile.password_mismatch') }); return
    }
    setPwSaving(true); setPwMsg(null)
    try {
      await axios.post('/api/users/me/password', {
        current_password: pw.current,
        new_password: pw.new,
      })
      setPwMsg({ type: 'success', text: t('profile.password_changed') })
      setPw({ current: '', new: '', confirm: '' })
    } catch (err) {
      setPwMsg({ type: 'error', text: err.response?.data?.detail || t('profile.password_error') })
    } finally {
      setPwSaving(false)
      setTimeout(() => setPwMsg(null), 4000)
    }
  }

  const avatarSrc = avatarUrl ? `${avatarUrl}?t=${Date.now()}` : null

  return (
    <div className="profile-page">
      <NavBar />
      <main className="profile-main">
        <h1 className="profile-title">{t('profile.title')}</h1>

        <div className="profile-grid">

          {/* ── Avatar ── */}
          <div className="profile-card glass profile-card--avatar">
            <h2 className="profile-section-title">{t('profile.section_avatar')}</h2>
            <div className="profile-avatar-wrap">
              {avatarSrc
                ? <img src={avatarSrc} alt="Avatar" className="profile-avatar-img" />
                : <div className="profile-avatar-placeholder">{form.display_name?.[0]?.toUpperCase() || '?'}</div>
              }
            </div>
            <input type="file" ref={fileRef}
              accept="image/jpeg,image/png,image/webp,image/gif"
              style={{ display: 'none' }} onChange={handleAvatarChange} />
            <button className="profile-avatar-btn" onClick={() => fileRef.current?.click()} disabled={avatarUploading}>
              {avatarUploading ? t('profile.avatar_uploading') : t('profile.avatar_upload')}
            </button>
            <p className="profile-avatar-hint">{t('profile.avatar_hint')}</p>
            {avatarMsg && <p className={`profile-msg profile-msg--${avatarMsg.type}`}>{avatarMsg.text}</p>}
          </div>

          {/* ── Allgemein ── */}
          <div className="profile-card glass profile-card--main">
            <h2 className="profile-section-title">{t('profile.section_general')}</h2>
            <form onSubmit={handleSave} className="profile-form">
              <div className="profile-field">
                <label>{t('profile.email')} <span className="profile-hint">{t('profile.email_hint')}</span></label>
                <input type="email" value={user?.email || ''} disabled className="profile-input--disabled" />
              </div>
              <div className="profile-field">
                <label>{t('profile.display_name')}</label>
                <input type="text" value={form.display_name}
                  onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))} required />
              </div>
              <div className="profile-field">
                <label>{t('profile.full_name')} <span className="profile-hint">{t('profile.full_name_hint')}</span></label>
                <input type="text" value={form.full_name}
                  onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
              </div>
              <div className="profile-row">
                <div className="profile-field">
                  <label>{t('profile.theme')}</label>
                  <select value={form.theme} onChange={e => setForm(p => ({ ...p, theme: e.target.value }))}>
                    <option value="dark">{t('profile.theme_dark')}</option>
                    <option value="light">{t('profile.theme_light')}</option>
                  </select>
                </div>
                <div className="profile-field">
                  <label>{t('profile.language')}</label>
                  <select value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))}>
                    <option value="de">{t('profile.language_de')}</option>
                    <option value="en">{t('profile.language_en')}</option>
                  </select>
                </div>
              </div>
              {saveMsg && <p className={`profile-msg profile-msg--${saveMsg.type}`}>{saveMsg.text}</p>}
              <div className="profile-form-footer">
                <button type="submit" className="profile-save-btn" disabled={saving}>
                  {saving ? t('profile.saving') : t('profile.save')}
                </button>
              </div>
            </form>
          </div>

          {/* ── Passwort ── */}
          <div className="profile-card glass profile-card--password">
            <h2 className="profile-section-title">{t('profile.section_password')}</h2>
            <form onSubmit={handlePasswordChange} className="profile-form">
              <div className="profile-field">
                <label>{t('profile.current_password')}</label>
                <input type="password" value={pw.current}
                  onChange={e => setPw(p => ({ ...p, current: e.target.value }))}
                  required placeholder="••••••••••" />
              </div>
              <div className="profile-field">
                <label>{t('profile.new_password')}</label>
                <input type="password" value={pw.new}
                  onChange={e => setPw(p => ({ ...p, new: e.target.value }))}
                  required placeholder="••••••••••" />
                {pw.new && <PasswordStrength password={pw.new} />}
              </div>
              <div className="profile-field">
                <label>{t('profile.new_password_confirm')}</label>
                <input type="password" value={pw.confirm}
                  onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
                  required placeholder="••••••••••" />
              </div>
              {pwMsg && <p className={`profile-msg profile-msg--${pwMsg.type}`}>{pwMsg.text}</p>}
              <div className="profile-form-footer">
                <button type="submit" className="profile-pw-btn" disabled={pwSaving}>
                  {pwSaving ? t('profile.password_changing') : t('profile.password_change')}
                </button>
              </div>
            </form>
          </div>

        </div>
      </main>
    </div>
  )
}
