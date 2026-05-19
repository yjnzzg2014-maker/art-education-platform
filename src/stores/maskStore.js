import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useMaskStore = create(
  persist(
    (set) => ({
      masked: false,
      toggle: () => set(s => ({ masked: !s.masked }))
    }),
    { name: 'mask-storage' }
  )
)
