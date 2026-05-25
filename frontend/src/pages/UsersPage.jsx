import axios from 'axios'
import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useTranslation } from 'react-i18next'
import { fetchUsers, createUser, updateUser, resetUserPassword } from '../api/users'
import NavBar from '../components/NavBar'
import { formatDate } from '../utils/dateFormat'
import './UsersPage.css'

const ROLE_CLASS = {
  superadmin: 'users-role--superadmin', admin: 'users-role--admin',
  manager: 'users-role--manager', agent: 'users-role--agent', kunde: 'users-role--kunde',
}



const EMPTY_FORM = { email: '', display_name: '', full_name: '', role: 'agent' }

export default function UsersPage({ embedded = false } = {}) {
  const { user: currentUser } = useAuth()
  const { t } = useTranslation()

  const ROLE_OPTIONS = [
    { value: 'superadmin', label: t('users.role_superadmin') },
    { value: 'admin',      label: t('users.role_admin') },
    { value: 'manager',    label: t('users.role_manager') },
    { value: 'agent',      label: t('users.role_agent') },
    { value: 'kunde',      label: t('users.role_kunde') },
  ]

  const [users,      setUsers]      = useState([])
  const [total,      setTotal]      = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(EMPTY_FORM)
  const [createError,setCreateError]= useState(null)
  const [creating,   setCreating]   = useState(false)
  const [createdInfo,setCreatedInfo]= useState(null)
  const [editUser,   setEditUser]   = useState(null)
  const [editForm,   setEditForm]   = useState({})
  const [editError,  setEditError]  = useState(null)
  const [editing,    setEditing]    = useState(false)
  const [resetMsg,   setResetMsg]   = useState({})

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true); setError(null)
    try {
      const data = await fetchUsers()
      setUsers(data.users); setTotal(data.total)
    } catch { setError(t('users.error_load')) }
    finally { setLoading(false) }
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!createForm.email || !createForm.display_name) { setCreateError(t('users.error_load')); return }
    setCreating(true); setCreateError(null)
    try {
      const newUser = await createUser(createForm)
      setUsers(prev => [newUser, ...prev]); setTotal(prev => prev + 1)
      setCreateForm(EMPTY_FORM); setShowCreate(false)
      setCreatedInfo({ email: newUser.email })
    } catch (err) { setCreateError(err.response?.data?.detail || t('users.error_load')) }
    finally { setCreating(false) }
  }

  function openEdit(u) {
    setEditUser(u)
    setEditForm({ display_name: u.display_name, full_name: u.full_name || '', role: u.role, is_active: u.is_active })
    setEditError(null)
  }

  async function handleEdit(e) {
    e.preventDefault()
    setEditing(true); setEditError(null)
    try {
      const updated = await updateUser(editUser.id, editForm)
      setUsers(prev => prev.map(u => u.id === updated.id ? updated : u))
      setEditUser(null)
    } catch (err) { setEditError(err.response?.data?.detail || t('users.error_load')) }
    finally { setEditing(false) }
  }

  async function handleReset(userId, email) {
    if (!window.confirm(t('users.reset_confirm', { email }))) return
    try {
      const res = await resetUserPassword(userId)
      setResetMsg(prev => ({ ...prev, [userId]: t('users.reset_success', { password: res.dev_password }) }))
      setTimeout(() => setResetMsg(prev => { const n = {...prev}; delete n[userId]; return n }), 15000)
    } catch { setResetMsg(prev => ({ ...prev, [userId]: t('users.reset_error') })) }
  }

  async function handleAnonymize(userId, displayName) {
    if (!window.confirm(t('users.anonymize_confirm', { name: displayName }))) return
    try {
      await axios.post(`/api/admin/users/${userId}/anonymize`)
      setUsers(prev => prev.map(u => u.id === userId
        ? { ...u, display_name: 'Gelöschter Nutzer', email: 'deleted@deleted.invalid', is_active: false }
        : u
      ))
    } catch (err) {
      alert(err.response?.data?.detail || t('users.anonymize_error'))
    }
  }

  const isSuperadmin = currentUser?.role === 'superadmin'

  return (
    <div className="users-page">
      {!embedded && <NavBar />}
      <main className="users-main">
        <div className="users-toolbar">
          <div>
            <h1 className="users-title">{t('users.title')}</h1>
            <p className="users-subtitle">{t('users.subtitle', { count: total })}</p>
          </div>
          <button className="users-btn-new" onClick={() => { setShowCreate(true); setCreateError(null); setCreatedInfo(null) }}>
            {t('users.new_user')}
          </button>
        </div>

        {createdInfo && (
          <div className="users-success-banner">
            ✅ {t('users.success_created', { email: createdInfo.email })} {t('users.success_hint')}
            <button className="users-success-close" onClick={() => setCreatedInfo(null)}>×</button>
          </div>
        )}

        {error && <div className="users-error">{error}</div>}

        <div className="users-table-wrap glass">
          {loading ? (
            <div className="users-loading"><div className="users-spinner" /><span>{t('users.loading')}</span></div>
          ) : (
            <table className="users-table">
              <thead>
                <tr>
                  <th>{t('users.col_name')}</th><th>{t('users.col_email')}</th>
                  <th>{t('users.col_role')}</th><th>{t('users.col_status')}</th>
                  <th>{t('users.col_created')}</th><th>{t('users.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <>
                    <tr key={u.id} className={`users-row ${!u.is_active ? 'users-row--inactive' : ''}`}>
                      <td>
                        <div className="users-name">
                          <span className="users-display-name">{u.display_name}</span>
                          {u.full_name && <span className="users-full-name">{u.full_name}</span>}
                        </div>
                      </td>
                      <td className="users-email">{u.email}</td>
                      <td>
                        <span className={`users-role-badge ${ROLE_CLASS[u.role]}`}>
                          {ROLE_OPTIONS.find(r => r.value === u.role)?.label}
                        </span>
                      </td>
                      <td>
                        {u.is_active
                          ? u.is_onboarding
                            ? <span className="users-status users-status--onboarding">{t('users.status_onboarding')}</span>
                            : <span className="users-status users-status--active">{t('users.status_active')}</span>
                          : <span className="users-status users-status--inactive">{t('users.status_inactive')}</span>
                        }
                      </td>
                      <td className="users-date">{formatDate(u.created_at)}</td>
                      <td>
                        <div className="users-actions">
                          <button className="users-action-btn" onClick={() => openEdit(u)} title={t('users.action_edit')}>✏️</button>
                          <button className="users-action-btn users-action-btn--warn" onClick={() => handleReset(u.id, u.email)} title={t('users.action_reset')}>🔑</button>
                          {u.id !== currentUser?.id && (
                            <button
                              className={`users-action-btn ${u.is_active ? 'users-action-btn--danger' : 'users-action-btn--success'}`}
                              onClick={() => updateUser(u.id, { is_active: !u.is_active }).then(updated => setUsers(prev => prev.map(x => x.id === updated.id ? updated : x)))}
                              title={u.is_active ? t('users.action_deactivate') : t('users.action_activate')}
                            >
                              {u.is_active ? '🚫' : '✅'}
                            </button>
                          )}
                          {u.id !== currentUser?.id && u.display_name !== 'Gelöschter Nutzer' && (
                            <button
                              className="users-action-btn users-action-btn--delete"
                              onClick={() => handleAnonymize(u.id, u.display_name)}
                              title={t('users.anonymize')}
                            >🗑️</button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {resetMsg[u.id] && (
                      <tr key={`${u.id}-msg`} className="users-reset-row">
                        <td colSpan={6}><span className="users-reset-msg">🔑 {resetMsg[u.id]}</span></td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {showCreate && (
        <div className="users-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="users-modal glass" onClick={e => e.stopPropagation()}>
            <div className="users-modal__header">
              <h2 className="users-modal__title">{t('users.modal_new_title')}</h2>
              <button className="users-modal__close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              {createError && <div className="users-modal-error">{createError}</div>}
              <div className="users-field">
                <label className="users-label">{t('users.field_email')} <span className="users-required">*</span></label>
                <input type="email" className="users-input" value={createForm.email}
                  onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))}
                  placeholder={t('users.placeholder_email')} autoFocus />
              </div>
              <div className="users-field">
                <label className="users-label">{t('users.field_display_name')} <span className="users-required">*</span></label>
                <input type="text" className="users-input" value={createForm.display_name}
                  onChange={e => setCreateForm(p => ({ ...p, display_name: e.target.value }))}
                  placeholder={t('users.placeholder_display_name')} />
              </div>
              <div className="users-field">
                <label className="users-label">{t('users.field_full_name')} <span className="users-optional">{t('users.field_full_name_hint')}</span></label>
                <input type="text" className="users-input" value={createForm.full_name}
                  onChange={e => setCreateForm(p => ({ ...p, full_name: e.target.value }))}
                  placeholder={t('users.placeholder_full_name')} />
              </div>
              <div className="users-field">
                <label className="users-label">{t('users.field_role')}</label>
                <div className="users-role-group">
                  {ROLE_OPTIONS.filter(r => isSuperadmin || r.value !== 'superadmin').map(opt => (
                    <button key={opt.value} type="button"
                      className={`users-role-btn ${createForm.role === opt.value ? 'users-role-btn--active' : ''}`}
                      onClick={() => setCreateForm(p => ({ ...p, role: opt.value }))}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="users-modal__footer">
                <button type="button" className="users-cancel-btn" onClick={() => setShowCreate(false)}>{t('common.cancel')}</button>
                <button type="submit" className="users-submit-btn" disabled={creating}>
                  {creating ? t('users.creating_btn') : t('users.create_btn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editUser && (
        <div className="users-modal-overlay" onClick={() => setEditUser(null)}>
          <div className="users-modal glass" onClick={e => e.stopPropagation()}>
            <div className="users-modal__header">
              <h2 className="users-modal__title">{t('users.modal_edit_title')}</h2>
              <button className="users-modal__close" onClick={() => setEditUser(null)}>×</button>
            </div>
            <form onSubmit={handleEdit}>
              {editError && <div className="users-modal-error">{editError}</div>}
              <div className="users-field">
                <label className="users-label">{t('users.field_display_name')}</label>
                <input type="text" className="users-input" value={editForm.display_name}
                  onChange={e => setEditForm(p => ({ ...p, display_name: e.target.value }))} />
              </div>
              <div className="users-field">
                <label className="users-label">{t('users.field_full_name')}</label>
                <input type="text" className="users-input" value={editForm.full_name}
                  onChange={e => setEditForm(p => ({ ...p, full_name: e.target.value }))} />
              </div>
              <div className="users-field">
                <label className="users-label">{t('users.field_role')}</label>
                <div className="users-role-group">
                  {ROLE_OPTIONS.filter(r => isSuperadmin || r.value !== 'superadmin').map(opt => (
                    <button key={opt.value} type="button"
                      className={`users-role-btn ${editForm.role === opt.value ? 'users-role-btn--active' : ''}`}
                      onClick={() => setEditForm(p => ({ ...p, role: opt.value }))}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="users-modal__footer">
                <button type="button" className="users-cancel-btn" onClick={() => setEditUser(null)}>{t('common.cancel')}</button>
                <button type="submit" className="users-submit-btn" disabled={editing}>
                  {editing ? t('users.saving_btn') : t('users.save_btn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
