import axios from 'axios'

export const TOKEN_KEY = 'pracsync_token'
export const USER_KEY = 'pracsync_user'

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '', timeout: 20000 })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isLogin = err.config?.url?.includes('/api/auth/login')
    if (err.response?.status === 401 && !isLogin) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      if (!window.location.pathname.startsWith('/login')) window.location.assign('/login?expired=1')
    }
    return Promise.reject(err)
  },
)

/** Turn any axios error into a short, user-friendly sentence (never a stack trace). */
export function getErrorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback
  if (err.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.'
  if (!err.response) return 'Cannot reach the PracSync server. Check that the backend is running and your connection is working.'
  const detail = err.response.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join('; ')
  if (err.response.status >= 500) return 'The server ran into a problem. Please try again.'
  return fallback
}

export default api
