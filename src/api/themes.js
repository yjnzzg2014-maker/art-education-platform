import client from './client'

export const themesApi = {
  list: () => client.get('/themes'),
  get: (id) => client.get(`/themes/${id}`),
  create: (data) => client.post('/themes', data),
  update: (id, data) => client.put(`/themes/${id}`, data),
  remove: (id) => client.delete(`/themes/${id}`)
}
