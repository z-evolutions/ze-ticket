import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { fetchGroups, createGroup, updateGroup, updateGroupMember } from '../api/groups'
import { fetchAgents } from '../api/users'
import NavBar from '../components/NavBar'
import './GroupsPage.css'

const EMPTY_FORM = { name: '', description: '', email: '' }

export default function GroupsPage({ embedded = false } = {}) {
  const { t } = useTranslation()
  const { user } = useAuth()

  const [groups,      setGroups]      = useState([])
  const [total,       setTotal]       = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [agents,      setAgents]      = useState([])

  const [showCreate,  setShowCreate]  = useState(false)
  const [createForm,  setCreateForm]  = useState(EMPTY_FORM)
  const [createError, setCreateError] = useState(null)
  const [creating,    setCreating]    = useState(false)

  const [editGroup,   setEditGroup]   = useState(null)
  const [editForm,    setEditForm]    = useState(EMPTY_FORM)
  const [editError,   setEditError]   = useState(null)
  const [editing,     setEditing]     = useState(false)

  const [membersGroup, setMembersGroup] = useState(null)
  const [memberSaving, setMemberSaving] = useState(null)

  useEffect(() => { loadGroups(); loadAgents() }, [])

  async function loadGroups() {
    setLoading(true); setError(null)
    try {
      const data = await fetchGroups()
      setGroups(data.groups); setTotal(data.total)
    } catch { setError(t('groups.error_load')) }
    finally { setLoading(false) }
  }

  async function loadAgents() {
    try { setAgents(await fetchAgents()) } catch {}
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true); setCreateError(null)
    try {
      const newGroup = await createGroup(createForm)
      setGroups(prev => [...prev, newGroup].sort((a, b) => a.name.localeCompare(b.name)))
      setTotal(prev => prev + 1)
      setCreateForm(EMPTY_FORM); setShowCreate(false)
    } catch (err) {
      setCreateError(err.response?.data?.detail || t('groups.error_load'))
    } finally { setCreating(false) }
  }

  function openEdit(g) {
    setEditGroup(g)
    setEditForm({ name: g.name, description: g.description || '', email: g.email || '' })
    setEditError(null)
  }

  async function handleEdit(e) {
    e.preventDefault()
    setEditing(true); setEditError(null)
    try {
      const updated = await updateGroup(editGroup.id, editForm)
      setGroups(prev => prev.map(g => g.id === updated.id ? updated : g))
      setEditGroup(null)
    } catch (err) {
      setEditError(err.response?.data?.detail || t('groups.error_load'))
    } finally { setEditing(false) }
  }

  async function handleToggleActive(group) {
    try {
      const updated = await updateGroup(group.id, { is_active: !group.is_active })
      setGroups(prev => prev.map(g => g.id === updated.id ? updated : g))
    } catch {}
  }

  async function handleMember(groupId, userId, action) {
    setMemberSaving(userId)
    try {
      const updated = await updateGroupMember(groupId, userId, action)
      setGroups(prev => prev.map(g => g.id === updated.id ? updated : g))
      setMembersGroup(updated)
    } catch {}
    finally { setMemberSaving(null) }
  }

  function availableAgents(group) {
    const memberIds = group.members.map(m => m.id.toString())
    return agents.filter(a => !memberIds.includes(a.id.toString()))
  }

  return (
    <div className="groups-page">
      {!embedded && <NavBar />}
      <main className="groups-main">

        <div className="groups-toolbar">
          <div>
            <h1 className="groups-title">{t('groups.title')}</h1>
            <p className="groups-subtitle">{t('groups.subtitle', { count: total })}</p>
          </div>
          <button className="groups-btn-new" onClick={() => { setShowCreate(true); setCreateError(null) }}>
            {t('groups.new_group')}
          </button>
        </div>

        {error && <div className="groups-error">{error}</div>}

        <div className="groups-table-wrap glass">
          {loading ? (
            <div className="groups-loading"><div className="groups-spinner" /><span>{t('groups.loading')}</span></div>
          ) : groups.length === 0 ? (
            <div className="groups-empty"><span>📂</span><p>{t('groups.empty')}</p></div>
          ) : (
            <table className="groups-table">
              <thead>
                <tr>
                  <th>{t('groups.col_name')}</th>
                  <th>{t('groups.col_description')}</th>
                  <th>{t('groups.col_email')}</th>
                  <th>{t('groups.col_members')}</th>
                  <th>{t('groups.col_status')}</th>
                  <th>{t('groups.col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.id} className={`groups-row ${!g.is_active ? 'groups-row--inactive' : ''}`}>
                    <td><span className="groups-name">{g.name}</span></td>
                    <td className="groups-desc">{g.description || <span className="groups-muted">{t('groups.no_description')}</span>}</td>
                    <td className="groups-email">{g.email || <span className="groups-muted">{t('groups.no_email')}</span>}</td>
                    <td>
                      <button className="groups-members-btn" onClick={() => setMembersGroup(g)}>
                        👥 {t('groups.members_count', { count: g.members.length })}
                      </button>
                    </td>
                    <td>
                      <span className={`groups-status ${g.is_active ? 'groups-status--active' : 'groups-status--inactive'}`}>
                        {g.is_active ? t('groups.status_active') : t('groups.status_inactive')}
                      </span>
                    </td>
                    <td>
                      <div className="groups-actions">
                        <button className="groups-action-btn" onClick={() => openEdit(g)} title={t('groups.action_edit')}>✏️</button>
                        <button
                          className={`groups-action-btn ${g.is_active ? 'groups-action-btn--danger' : 'groups-action-btn--success'}`}
                          onClick={() => handleToggleActive(g)}
                          title={g.is_active ? t('groups.action_deactivate') : t('groups.action_activate')}
                        >
                          {g.is_active ? '🚫' : '✅'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* ── Modal: Neue Gruppe ── */}
      {showCreate && (
        <div className="groups-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="groups-modal glass" onClick={e => e.stopPropagation()}>
            <div className="groups-modal__header">
              <h2 className="groups-modal__title">{t('groups.modal_new_title')}</h2>
              <button className="groups-modal__close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              {createError && <div className="groups-modal-error">{createError}</div>}
              <div className="groups-field">
                <label className="groups-label">{t('groups.field_name')} <span className="groups-required">*</span></label>
                <input type="text" className="groups-input" value={createForm.name}
                  onChange={e => setCreateForm(p => ({ ...p, name: e.target.value }))}
                  placeholder={t('groups.placeholder_name')} autoFocus required />
              </div>
              <div className="groups-field">
                <label className="groups-label">{t('groups.field_description')} <span className="groups-optional">{t('groups.field_description_optional')}</span></label>
                <input type="text" className="groups-input" value={createForm.description}
                  onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                  placeholder={t('groups.placeholder_description')} />
              </div>
              <div className="groups-field">
                <label className="groups-label">{t('groups.field_email')} <span className="groups-optional">{t('groups.field_email_optional')}</span></label>
                <input type="email" className="groups-input" value={createForm.email}
                  onChange={e => setCreateForm(p => ({ ...p, email: e.target.value }))}
                  placeholder={t('groups.placeholder_email')} />
              </div>
              <div className="groups-modal__footer">
                <button type="button" className="groups-cancel-btn" onClick={() => setShowCreate(false)}>{t('common.cancel')}</button>
                <button type="submit" className="groups-submit-btn" disabled={creating || !createForm.name}>
                  {creating ? t('groups.creating_btn') : t('groups.create_btn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Gruppe bearbeiten ── */}
      {editGroup && (
        <div className="groups-modal-overlay" onClick={() => setEditGroup(null)}>
          <div className="groups-modal glass" onClick={e => e.stopPropagation()}>
            <div className="groups-modal__header">
              <h2 className="groups-modal__title">{t('groups.modal_edit_title')}</h2>
              <button className="groups-modal__close" onClick={() => setEditGroup(null)}>×</button>
            </div>
            <form onSubmit={handleEdit}>
              {editError && <div className="groups-modal-error">{editError}</div>}
              <div className="groups-field">
                <label className="groups-label">{t('groups.field_name')}</label>
                <input type="text" className="groups-input" value={editForm.name}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="groups-field">
                <label className="groups-label">{t('groups.field_description')}</label>
                <input type="text" className="groups-input" value={editForm.description}
                  onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="groups-field">
                <label className="groups-label">{t('groups.field_email')}</label>
                <input type="email" className="groups-input" value={editForm.email}
                  onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="groups-modal__footer">
                <button type="button" className="groups-cancel-btn" onClick={() => setEditGroup(null)}>{t('common.cancel')}</button>
                <button type="submit" className="groups-submit-btn" disabled={editing}>
                  {editing ? t('groups.saving_btn') : t('groups.save_btn')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Mitglieder ── */}
      {membersGroup && (
        <div className="groups-modal-overlay" onClick={() => setMembersGroup(null)}>
          <div className="groups-modal groups-modal--wide glass" onClick={e => e.stopPropagation()}>
            <div className="groups-modal__header">
              <h2 className="groups-modal__title">{t('groups.modal_members_title')} — {membersGroup.name}</h2>
              <button className="groups-modal__close" onClick={() => setMembersGroup(null)}>×</button>
            </div>

            <div className="groups-members-section">
              <h3 className="groups-members-title">{t('groups.members_current', { count: membersGroup.members.length })}</h3>
              {membersGroup.members.length === 0 ? (
                <p className="groups-members-empty">{t('groups.members_empty')}</p>
              ) : (
                <div className="groups-members-list">
                  {membersGroup.members.map(m => (
                    <div key={m.id} className="groups-member-row">
                      <span className="groups-member-name">{m.display_name}</span>
                      <span className="groups-member-role">{m.role}</span>
                      <button
                        className="groups-member-btn groups-member-btn--remove"
                        onClick={() => handleMember(membersGroup.id, m.id, 'remove')}
                        disabled={memberSaving === m.id}
                      >
                        {memberSaving === m.id ? '…' : t('groups.member_remove')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="groups-members-section">
              <h3 className="groups-members-title">{t('groups.members_add_title')}</h3>
              {availableAgents(membersGroup).length === 0 ? (
                <p className="groups-members-empty">{t('groups.no_agents')}</p>
              ) : (
                <div className="groups-members-list">
                  {availableAgents(membersGroup).map(a => (
                    <div key={a.id} className="groups-member-row">
                      <span className="groups-member-name">{a.display_name}</span>
                      <span className="groups-member-role">{a.role}</span>
                      <button
                        className="groups-member-btn groups-member-btn--add"
                        onClick={() => handleMember(membersGroup.id, a.id, 'add')}
                        disabled={memberSaving === a.id}
                      >
                        {memberSaving === a.id ? '…' : t('groups.member_add')}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
