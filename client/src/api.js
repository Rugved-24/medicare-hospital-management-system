const TOKEN_KEY = 'hms_token'
const USER_KEY = 'hms_user'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY)) } catch { return null }
}
export const storeSession = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}
export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

function buildUrl(url, params) {
  if (!params) return url
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null)).toString()
  return qs ? `${url}?${qs}` : url
}

async function request(url, { method = 'GET', body, params } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let res
  try {
    res = await fetch(buildUrl(url, params), { method, headers, body: body ? JSON.stringify(body) : undefined })
  } catch {
    throw new Error('Cannot reach the server. Is the API running on port 4000?')
  }
  if (res.status === 401 && !url.includes('/auth/login')) {
    clearSession()
    window.dispatchEvent(new Event('hms:unauthorized'))
    throw new Error('Your session has expired. Please sign in again.')
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const err = new Error(data.error || `Request failed (${res.status})`)
    err.status = res.status
    err.data = data
    throw err
  }
  return res.status === 204 ? null : res.json()
}

export const api = {
  get: (url, params) => request(url, { params }),
  post: (url, body) => request(url, { method: 'POST', body }),
  put: (url, body) => request(url, { method: 'PUT', body }),
  patch: (url, body) => request(url, { method: 'PATCH', body }),
  del: (url) => request(url, { method: 'DELETE' })
}
