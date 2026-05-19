import axios from 'axios'
import { useAuthStore } from '../stores/authStore'
import { useToastStore } from '../stores/toastStore'

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
})

client.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
    } else {
      const msg = error.response?.data?.error || error.message || '请求失败'
      useToastStore.getState().show(msg, 'error')
    }
    return Promise.reject(error)
  }
)

export default client
