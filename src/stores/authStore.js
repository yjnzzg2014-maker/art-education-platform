import { create } from 'zustand'
import { persist } from 'zustand/middleware'

function isTokenExpired(token) {
  try {
    // JWT uses base64url encoding, convert to base64 for atob
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const padding = base64.length % 4 === 0 ? '' : '='.repeat(4 - (base64.length % 4))
    const payload = JSON.parse(atob(base64 + padding))
    return payload.exp * 1000 < Date.now()
  } catch {
    return false
  }
}

export const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      login: (token, refreshToken, user) => set({ token, refreshToken, user, isAuthenticated: true }),
      logout: () => set({ token: null, refreshToken: null, user: null, isAuthenticated: false })
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        if (state?.token && isTokenExpired(state.token)) {
          state.token = null
          state.user = null
          state.isAuthenticated = false
        }
      }
    }
  )
)
