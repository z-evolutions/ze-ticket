import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useTranslation } from 'react-i18next'
import { useState, useEffect, useRef, useCallback } from 'react'
import './NavBar.css'
import 'flag-icons/css/flag-icons.min.css'
import { useLogo } from '../hooks/useLogo'
import { useAppName } from '../hooks/useAppName'
import { LANGUAGES } from '../i18n'
import { useToastNotifications } from '../hooks/useToastNotifications'
import NotificationBells from './NotificationBells'

const ADMIN_ROLES = ['admin', 'superadmin']

export default function NavBar() {
  const appName = useAppName()
  const { user, logout } = useAuth()
  const isAgent = user?.role && ['agent', 'manager', 'admin', 'superadmin'].includes(user.role)
  const wsToken = localStorage.getItem('ze-token')
  useToastNotifications(wsToken, () => {})
  const { theme, toggleTheme } = useTheme()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  const logoUrl = useLogo()
  const isAdmin = user?.role && ADMIN_ROLES.includes(user.role)
  const isSuperadmin = user?.role === 'superadmin'

  const navItems = [
    { path: '/dashboard',   label: t('nav.dashboard'),   always: true },
    { path: '/tickets',     label: t('nav.tickets'),     always: true },

    { path: '/maintenance', label: t('nav.maintenance'), superadminOnly: true },
    { path: '/admin',       label: t('nav.admin'),       adminOnly: true },
  ].filter(item => {
    if (item.superadminOnly) return isSuperadmin
    if (item.adminOnly) return isAdmin
    return true
  })

  const [langOpen, setLangOpen] = useState(false)
  const langRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (langRef.current && !langRef.current.contains(e.target)) setLangOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function setLanguage(lang) {
    i18n.changeLanguage(lang)
    localStorage.setItem('ze-language', lang)
    setLangOpen(false)
  }

  return (
    <header className="navbar glass">
      <div className="navbar__brand" onClick={() => navigate('/dashboard')}>
        <div className="navbar__logo">
          {logoUrl
            ? <img src={logoUrl} alt="ZE-Ticket" className="navbar__logo-img" />
            : <span>ZE</span>
          }
        </div>
        <span className="navbar__title">{appName}</span>
      </div>

      <nav className="navbar__nav">
        {navItems.map(item => (
          <button
            key={item.path}
            className={`navbar__btn ${location.pathname.startsWith(item.path) ? 'navbar__btn--active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="navbar__actions">
        {isAgent && <NotificationBells />}
        <div className="navbar__lang-wrap" ref={langRef}>
          <button className="navbar__lang" onClick={() => setLangOpen(o => !o)}>
            <span className={`fi fi-${LANGUAGES.find(l => l.code === i18n.language)?.flag || 'de'}`} style={{fontSize:'1.1rem', borderRadius:'2px'}} />
          </button>
          {langOpen && (
            <div className="navbar__lang-dropdown">
              {LANGUAGES.map(({ code, flag, label }) => (
                <button key={code}
                  className={`navbar__lang-option ${i18n.language === code ? 'navbar__lang-option--active' : ''}`}
                  onClick={() => setLanguage(code)}>
                  <span className={`fi fi-${flag}`} style={{fontSize:'1rem', borderRadius:'2px'}} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="navbar__theme" onClick={toggleTheme}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button className="navbar__user navbar__user--link" onClick={() => navigate('/profile')}>{user?.display_name || user?.email}</button>
        <button className="navbar__logout" onClick={logout}>{t('common.logout')}</button>
      </div>
    </header>
  )
}
