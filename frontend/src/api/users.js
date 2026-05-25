import axios from 'axios'

export async function fetchUsers({ role, isActive, page = 1, pageSize = 50 } = {}) {
  const params = new URLSearchParams()
  if (role) params.append('role', role)
  if (isActive !== undefined) params.append('is_active', isActive)
  params.append('page', page)
  params.append('page_size', pageSize)
  const res = await axios.get(`/api/users/?${params}`)
  return res.data
}

export async function fetchAgents() {
  const res = await axios.get('/api/users/agents')
  return res.data
}

export async function createUser(data) {
  const res = await axios.post('/api/users/', data)
  return res.data
}

export async function updateUser(id, data) {
  const res = await axios.patch(`/api/users/${id}`, data)
  return res.data
}

export async function resetUserPassword(id) {
  const res = await axios.post(`/api/users/${id}/reset-password`)
  return res.data
}
