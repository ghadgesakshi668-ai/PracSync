import api from './api'

const d = (r) => r.data

export const getDashboard = () => api.get('/api/student/dashboard').then(d)
export const startExam = (examId) => api.post(`/api/student/exams/${examId}/start`).then(d)
export const getSession = (examId) => api.get(`/api/student/exams/${examId}/session`).then(d)
export const saveDraft = (examId, text) => api.put(`/api/student/exams/${examId}/draft`, { text }).then(d)
export const postActivity = (examId, event_type, event_data) =>
  api.post(`/api/student/exams/${examId}/activity`, { event_type, event_data }, { timeout: 8000 }).then(d)
export const submitExam = (examId, { file, answerText }) => {
  const form = new FormData()
  form.append('answer_text', answerText || '')
  if (file) form.append('file', file)
  return api.post(`/api/student/exams/${examId}/submit`, form, { timeout: 60000 }).then(d)
}
export const getMySubmissions = () => api.get('/api/student/submissions').then(d)
