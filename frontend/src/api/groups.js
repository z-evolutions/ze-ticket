import axios from 'axios'

export async function fetchGroups(isActive) {
  const params = isActive !== undefined ? `?is_active=${isActive}` : ''
  const res = await axios.get(`/api/groups/${params}`)
  return res.data
}

export async function createGroup(data) {
  const res = await axios.post('/api/groups/', data)
  return res.data
}

export async function updateGroup(id, data) {
  const res = await axios.patch(`/api/groups/${id}`, data)
  return res.data
}

export async function updateGroupMember(groupId, userId, action) {
  const res = await axios.post(`/api/groups/${groupId}/members`, { user_id: userId, action })
  return res.data
}
