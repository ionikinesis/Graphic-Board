import { useState, useEffect, useCallback } from 'react'
import { themes, DEFAULT_THEME, DEFAULT_CUSTOM_COLORS, generateCustomTheme } from '../utils/themes.js'

const KEY        = 'refboard_settings'
const CUSTOM_KEY = 'refboard_custom_colors'
const DEFAULTS   = { scale: 1.0, theme: DEFAULT_THEME }

function loadLS(key, fallback) {
  try { return { ...fallback, ...(JSON.parse(localStorage.getItem(key)) ?? {}) } } catch { return { ...fallback } }
}

function applyTheme(key, customColors) {
  const vars = key === 'custom'
    ? generateCustomTheme(customColors.bg, customColors.accent, customColors.text)
    : (themes[key] || themes[DEFAULT_THEME]).vars
  Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v))
}

function applyScale(scale) {
  document.documentElement.style.setProperty('--app-scale', scale)
  const root = document.getElementById('root')
  if (root) root.style.zoom = scale
}

export function useAppSettings(config, updateConfig) {
  // Init from localStorage for instant first paint (no theme flash)
  const [settings, setSettings] = useState(() => {
    const s  = loadLS(KEY, DEFAULTS)
    const cc = loadLS(CUSTOM_KEY, DEFAULT_CUSTOM_COLORS)
    applyScale(s.scale)
    applyTheme(s.theme || DEFAULT_THEME, cc)
    return s
  })

  const [customColors, setCustomColors] = useState(() => loadLS(CUSTOM_KEY, DEFAULT_CUSTOM_COLORS))

  // Sync from config file when it first loads
  useEffect(() => {
    if (!config) return
    if (config.settings)     setSettings(prev => ({ ...DEFAULTS, ...config.settings }))
    if (config.customColors) setCustomColors(prev => ({ ...DEFAULT_CUSTOM_COLORS, ...config.customColors }))
  }, [config])

  // Apply theme/scale and update localStorage cache whenever settings change
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings))
    applyScale(settings.scale)
    applyTheme(settings.theme || DEFAULT_THEME, customColors)
  }, [settings, customColors])

  const update = useCallback((patch) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      if (updateConfig) updateConfig({ settings: next })
      return next
    })
  }, [updateConfig])

  const updateCustomColors = useCallback((patch) => {
    setCustomColors(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(next))
      if (updateConfig) updateConfig({ customColors: next })
      return next
    })
  }, [updateConfig])

  return { settings, update, customColors, updateCustomColors }
}
