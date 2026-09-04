import axios from 'axios'

const api = axios.create({
  // baseURL: 'http://localhost:4000/api',
  baseURL: 'http://192.168.1.40:4000/api',
  timeout: 30000,
})

export async function fetchEmails() {
  const res = await api.get('/emails')
  return res.data
}

export async function fetchEmailDetail(id) {
  const res = await api.get(`/email/${id}`)
  return res.data
}

export async function fetchAttachments(id) {
  const res = await api.get(`/email/${id}/attachments`)
  return res.data
}

export async function notifyN8n(id) {
  const res = await api.post(`/email/${id}/notify-n8n`)
  return res.data
}

export default api