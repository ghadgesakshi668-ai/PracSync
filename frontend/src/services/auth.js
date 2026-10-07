import api from './api'
export const login = (email, password) => api.post('/api/auth/login', { email, password }).then((r) => r.data)
export const me = () => api.get('/api/auth/me').then((r) => r.data)
