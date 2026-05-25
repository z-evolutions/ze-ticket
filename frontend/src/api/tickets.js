import axios from 'axios'

export async function fetchTickets({ status, priority, assignedToMe, unassigned, unassignedForMe, page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams()
  if (status) params.append('status', status)
  if (priority) params.append('priority', priority)
  if (assignedToMe) params.append('assigned_to_me', 'true')
  if (unassigned) params.append('unassigned', 'true')
  if (unassignedForMe) params.append('unassigned_for_me', 'true')
  params.append('page', page)
  params.append('page_size', pageSize)

  const res = await axios.get(`/api/tickets/?${params}`)
  return res.data
}

export async function fetchTicketStats() {
  const res = await axios.get('/api/tickets/stats')
  return res.data
}

export async function fetchTicket(id) {
  const res = await axios.get(`/api/tickets/${id}`)
  return res.data
}

export async function createTicket(data) {
  const res = await axios.post('/api/tickets/', data)
  return res.data
}

export async function updateTicket(id, data) {
  const res = await axios.patch(`/api/tickets/${id}`, data)
  return res.data
}

export async function addComment(ticketId, data) {
  const res = await axios.post(`/api/tickets/${ticketId}/comments`, data)
  return res.data
}

export async function assignAgent(ticketId, agentId) {
  const res = await axios.patch(`/api/tickets/${ticketId}`, {
    assigned_agent_id: agentId || null
  })
  return res.data
}

export async function searchTickets(query, { status, priority } = {}) {
  const params = new URLSearchParams({ q: query })
  if (status)   params.append('status', status)
  if (priority) params.append('priority', priority)
  const res = await axios.get(`/api/tickets/search?${params}`)
  return res.data
}
