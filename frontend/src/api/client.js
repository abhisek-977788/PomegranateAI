import axios from 'axios'

let rawBase = import.meta.env.VITE_API_URL || '/api'
rawBase = rawBase.replace(/\/+$/, '')
const BASE = rawBase

const api = axios.create({ baseURL: BASE, timeout: 120000 })

// Request interceptor to attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pomegranate_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}, (error) => Promise.reject(error))

export const authApi = {
  login:    (credentials) => api.post('/auth/login', credentials),
  register: (userData)    => api.post('/auth/register', userData),
  getMe:    ()            => api.get('/auth/me'),
}

export const inspectionApi = {
  process: (formData, onUploadProgress) =>
    api.post('/inspections/process', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress,
    }),

  getStats:   () => api.get('/inspections/stats'),
  getBatches: () => api.get('/inspections/batches'),
  getHistory: (params) => api.get('/inspections/history', { params }),
}

export default api
