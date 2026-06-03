import { useState, useEffect, useCallback } from 'react'
import { themes, DEFAULT_THEME, DEFAULT_CUSTOM_COLORS, generateCustomTheme } from '../utils/themes.js'
import { hexLuminance } from '../utils/color.js'

const KEY        = 'graphic_board_settings'
const CUSTOM_KEY = 'graphic_board_custom_colors'
const DEFAULTS   = { scale: 1.0, textScale: 1.0, theme: DEFAULT_THEME, iconSize: 'medium', highContrast: false }

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

function applyHighContrast(themeKey, customColors) {
  const isDark = themeKey === 'custom'
    ? hexLuminance(customColors?.bg || '#282828') < 0.45
    : (themes[themeKey] || themes[DEFAULT_THEME]).mode === 'dark'
  const vars = isDark ? {
    '--text-primary':  '#ffffff',
    '--text-secondary':'#cccccc',
    '--text-muted':    '#aaaaaa',
    '--border-subtle': '#545454',
    '--border-mid':    '#747474',
    '--border-strong': '#949494',
    '--accent':        '#f5e642',
    '--accent-dim':    'rgba(245,230,66,0.18)',
    '--accent-faint':  'rgba(245,230,66,0.07)',
    '--accent-text':   '#1a1800',
  } : {
    '--text-primary':  '#000000',
    '--text-secondary':'#1a1a1a',
    '--text-muted':    '#3a3a3a',
    '--border-subtle': '#aaaaaa',
    '--border-mid':    '#888888',
    '--border-strong': '#555555',
    '--accent':        '#0055cc',
    '--accent-dim':    'rgba(0,85,204,0.18)',
    '--accent-faint':  'rgba(0,85,204,0.07)',
    '--accent-text':   '#ffffff',
  }
  Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v))
}

function applyScale(scale) {
  document.documentElement.style.setProperty('--app-scale', scale)
  const root = document.getElementById('root')
  if (root) root.style.zoom = scale
}

function applyTextScale(textScale) {
  document.documentElement.style.setProperty('--text-scale', textScale)
}

export function useAppSettings() {
  const [settings, setSettings] = useState(() => {
    migrateOldKeys()
    const s  = loadLS(KEY, DEFAULTS)
    const cc = loadLS(CUSTOM_KEY, DEFAULT_CUSTOM_COLORS)
    applyScale(s.scale)
    applyTextScale(s.textScale ?? 1.0)
    applyTheme(s.theme || DEFAULT_THEME, cc)
    if (s.highContrast) applyHighContrast(s.theme || DEFAULT_THEME, cc)
    return s
  })

  const [customColors, setCustomColors] = useState(() => loadLS(CUSTOM_KEY, DEFAULT_CUSTOM_COLORS))

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(settings))
    applyScale(settings.scale)
    applyTextScale(settings.textScale ?? 1.0)
    applyTheme(settings.theme || DEFAULT_THEME, customColors)
    if (settings.highContrast) applyHighContrast(settings.theme || DEFAULT_THEME, customColors)
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
