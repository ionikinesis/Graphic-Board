import { useState, useEffect, useCallback } from 'react'
import { themes, DEFAULT_THEME, DEFAULT_CUSTOM_COLORS, generateCustomTheme } from '../utils/themes.js'

const KEY        = 'graphic_board_settings'
const CUSTOM_KEY = 'graphic_board_custom_colors'
const DEFAULTS   = { scale: 1.0, theme: DEFAULT_THEME, iconSize: 'medium', sortBy: 'alpha', groupBy: 'none' }

function migrateOldKeys() {
  if (localStorage.getItem(KEY) !== null) return
  const old = localStorage.getItem('refboard_settings')
  if (old) localStorage.setItem(KEY, old)
  const oldCC = localStorage.getItem('refboard_custom_colors')
  if (oldCC) localStorage.setItem(CUSTOM_KEY, oldCC)
}

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

export function useAppSettings() {
  const [settings, setSettings] = useState(() => {
    migrateOldKeys()
    const s  = loadLS(KEY, DEFAULTS)
    const cc = loadLS(CUSTOM_KEY, DEFAULT_CUSTOM_COLORS)
    applyScale(s.scale)
    applyTheme(s.theme || DEFAULT_THEME, cc)
    return s
  })

  const [customColors, setCustomColors] = useState(() => loadLS(CUSTOM_KEY, DEFAULT_CUSTOM_COLORS))

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings))
    applyScale(settings.scale)
    applyTheme(settings.theme || DEFAULT_THEME, customColors)
  }, [settings, customColors])

  const update = useCallback((patch) => {
    setSettings(prev => ({ ...prev, ...patch }))
  }, [])

  const updateCustomColors = useCallback((patch) => {
    setCustomColors(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { settings, update, customColors, updateCustomColors }
}
