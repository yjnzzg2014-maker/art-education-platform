import { create } from 'zustand'

export const useToastStore = create((set, get) => ({
  message: null,
  type: 'info',
  _timerId: null,
  show: (message, type = 'info') => {
    if (get()._timerId) clearTimeout(get()._timerId)
    const timerId = setTimeout(() => set({ message: null, _timerId: null }), 3000)
    set({ message, type, _timerId: timerId })
  },
  dismiss: () => {
    if (get()._timerId) clearTimeout(get()._timerId)
    set({ message: null, _timerId: null })
  }
}))
