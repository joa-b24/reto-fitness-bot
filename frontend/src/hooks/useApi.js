import useSWR from 'swr'
import { fetcher } from '../lib/api'

function buildQuery(params) {
  const q = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
  )
  return q.toString() ? `?${q}` : ''
}

export function useUsers() {
  return useSWR('/api/users', fetcher)
}

export function useRanking(type = 'semanal', top = 10) {
  return useSWR(`/api/ranking?type=${type}&top=${top}`, fetcher, { refreshInterval: 30_000 })
}

export function useLatest(limit = 50, user = '') {
  const q = buildQuery({ limit, user: user || undefined })
  return useSWR(`/api/latest${q}`, fetcher, { refreshInterval: 15_000 })
}

export function usePoints(user = '', start = '', end = '') {
  const q = buildQuery({ user: user || undefined, start: start || undefined, end: end || undefined })
  return useSWR(`/api/points${q}`, fetcher)
}

export function useHabits() {
  return useSWR('/api/habits', fetcher, { revalidateOnFocus: false })
}

export function useRetos() {
  return useSWR('/api/retos', fetcher, { refreshInterval: 60_000 })
}

export function useHeatmap(user = '', start = '', end = '') {
  const q = buildQuery({ user: user || undefined, start: start || undefined, end: end || undefined })
  return useSWR(user ? `/api/heatmap${q}` : null, fetcher)
}

export function useKpi(user = '') {
  return useSWR(user ? `/api/kpi?user=${encodeURIComponent(user)}` : null, fetcher, { refreshInterval: 60_000 })
}

export function useCheckpoints() {
  return useSWR('/api/checkpoints', fetcher, { revalidateOnFocus: false })
}

export function useVision(user = '') {
  return useSWR(
    user ? `/api/vision?user=${encodeURIComponent(user)}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )
}

export function usePlan() {
  return useSWR('/api/plan', fetcher, { revalidateOnFocus: false })
}

export function useMetas(user = '') {
  return useSWR(
    user ? `/api/metas?user=${encodeURIComponent(user)}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )
}

export function useLogros(user = '') {
  return useSWR(
    user ? `/api/logros?user=${encodeURIComponent(user)}` : null,
    fetcher,
    { revalidateOnFocus: false }
  )
}
