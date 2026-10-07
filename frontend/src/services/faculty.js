import api from './api'

const d = (r) => r.data
const q = (examId) => (examId ? { params: { exam_id: examId } } : undefined)

export const listExams = () => api.get('/api/exams').then(d)
export const createExam = (body) => api.post('/api/exams', body).then(d)
export const updateExam = (id, body) => api.put(`/api/exams/${id}`, body).then(d)
export const deleteExam = (id) => api.delete(`/api/exams/${id}`).then(d)
export const startExam = (id) => api.post(`/api/exams/${id}/start`).then(d)
export const endExam = (id) => api.post(`/api/exams/${id}/end`).then(d)

export const listExperiments = () => api.get('/api/experiments').then(d)
export const createExperiment = (body) => api.post('/api/experiments', body).then(d)
export const updateExperiment = (id, body) => api.put(`/api/experiments/${id}`, body).then(d)
export const deleteExperiment = (id) => api.delete(`/api/experiments/${id}`).then(d)

export const getOverview = (examId) => api.get('/api/faculty/overview', q(examId)).then(d)
export const getStudentDetail = (examId, studentId, includeHeartbeats = false) =>
  api.get(`/api/faculty/exams/${examId}/students/${studentId}`, { params: { include_heartbeats: includeHeartbeats } }).then(d)
export const reviewStudent = (examId, studentId, note) =>
  api.post(`/api/faculty/exams/${examId}/students/${studentId}/review`, { note: note || null }).then(d)
export const reassignStudent = (examId, studentId, experimentId) =>
  api.post(`/api/faculty/exams/${examId}/students/${studentId}/reassign`, { experiment_id: experimentId ?? null }).then(d)
export const getAnomalies = (examId) => api.get('/api/faculty/anomalies', q(examId)).then(d)
export const getSubmissions = (examId) => api.get('/api/faculty/submissions', q(examId)).then(d)
