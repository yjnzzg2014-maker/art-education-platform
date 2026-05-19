import client from './client'

export const gradesApi = {
  list: (params) => client.get('/grades', { params }),
  get: (id) => client.get(`/grades/${id}`),
  create: (data) => client.post('/grades', data),
  update: (id, data) => client.put(`/grades/${id}`, data),
  remove: (id) => client.delete(`/grades/${id}`),
}
