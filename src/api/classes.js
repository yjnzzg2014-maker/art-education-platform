import client from './client'

export const classesApi = {
  list: (params) => client.get('/classes', { params }),
  get: (id) => client.get(`/classes/${id}`),
  create: (data) => client.post('/classes', data),
  update: (id, data) => client.put(`/classes/${id}`, data),
  remove: (id) => client.delete(`/classes/${id}`),
  teachingSuggestion: (id, { refresh = false, windowSize } = {}) =>
    client.get(`/classes/${id}/teaching-suggestion`, { params: { refresh: refresh || undefined, windowSize } }),
}
