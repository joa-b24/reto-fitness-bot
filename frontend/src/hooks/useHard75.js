import { useMemo } from 'react'
import useSWR from 'swr'
import { fetcher } from '../lib/api'
import { computeHard75 } from '../lib/hard75'
import USER_PROFILES from '../config/userProfiles.json'

export const HARD75_KEY_PREFIX = '/api/hard75'

// Returns { active: false } for users who are not doing the sub-challenge.
export function useHard75(user = '') {
  const profile = USER_PROFILES[user]
  const h       = profile?.hard75
  const active  = !!h?.activo

  const cfg = useMemo(() => active ? {
    inicio:     h.inicio,
    aguaMin:    h.aguaMin ?? 3.8,
    lecturaMin: h.lecturaMin ?? 20,
    graciaHora: h.graciaHora ?? 12,
    calorias:   profile.macroTargets.calorias,
    proteina:   profile.macroTargets.proteina,
  } : null, [active, h, profile])

  const { data, error } = useSWR(
    active ? `${HARD75_KEY_PREFIX}?user=${encodeURIComponent(user)}&start=${h.inicio}` : null,
    fetcher,
    { refreshInterval: 60_000, keepPreviousData: true }
  )

  const state = useMemo(
    () => (active && data?.days ? computeHard75({ days: data.days, today: data.today, hour: data.hour, cfg }) : null),
    [active, data, cfg]
  )

  return { active, cfg, days: data?.days || {}, state, error: active && !state ? error : null }
}
