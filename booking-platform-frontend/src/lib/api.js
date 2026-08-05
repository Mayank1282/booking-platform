import axios from 'axios'

const TOKEN_KEY = 'slotwise-token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (token) => localStorage.setItem(TOKEN_KEY, token)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000'}/api`,
  headers: { Accept: 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/**
 * A 401 means the token is gone or expired. Clear it and bounce to login,
 * but never from the login screen itself — that would swallow the "wrong
 * password" message the user needs to see.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const isAuthRoute = error.config?.url?.includes('/auth/login')

    if (status === 401 && !isAuthRoute) {
      clearToken()
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?expired=1'
      }
    }

    return Promise.reject(error)
  },
)

/**
 * Pulls the most useful message out of a Laravel error response —
 * the first field-level validation error if there is one, else the
 * top-level message.
 */
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const data = error?.response?.data

  if (data?.errors && typeof data.errors === 'object') {
    const first = Object.values(data.errors)[0]
    if (Array.isArray(first) && first[0]) return first[0]
  }

  return data?.message ?? error?.message ?? fallback
}

/** Field-level validation errors, keyed by input name. */
export function fieldErrors(error) {
  const errors = error?.response?.data?.errors
  if (!errors) return {}

  return Object.fromEntries(
    Object.entries(errors).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
  )
}

export default api
