import { useState, useEffect, useCallback } from 'react'
import { themes, DEFAULT_THEME } from '../utils/themes.js'

const KEY = 'refboard_settings'
const DEFAULTS = { scale: 1.0, theme: DEFAULT_THEME }

function applyTheme(key) {
  const theme = themes[key] || themes[DEFAULT_THEME]
  Object.entries(theme.vars).forEach(([k, v]) =>
    document.documentElement.style.setProperty(k, v)
  )
}

function load() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') } }
  catch { return { ...DEFAULTS } }
}

export function useAppSettings() {
  const [settings, setSettings] = useState(() => {
    const s = load()
    applyTheme(s.theme || DEFAULT_THEME) // apply before first paint
    return s
  })

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings))
    const root = document.getElementById('root')
    if (root) root.style.zoom = settings.scale
    applyTheme(settings.theme || DEFAULT_THEME)
  }, [settings])

  const update = useCallback((patch) => setSettings(prev => ({ ...prev, ...patch })), [])

  return { settings, update }
}
