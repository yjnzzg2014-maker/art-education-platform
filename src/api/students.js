import client from './client'

export const studentsApi = {
  list: (params) => client.get('/students', { params }),
  get: (id) => client.get(`/students/${id}`),
  create: (data) => client.post('/students', data),
  batchCreate: (students, class_id) => client.post('/students/batch', { students, class_id }),
  update: (id, data) => client.put(`/students/${id}`, data),
  remove: (id) => client.delete(`/students/${id}`),
}
