import { darkenHex, lightenHex, hexLuminance } from './color.js'

// Eight themes: 4 dark, 4 light

export const themes = {
  // ── dark ──────────────────────────────────────────────────────────────────

  charcoal: {
    label: 'charcoal',
    mode: 'dark',
    vars: {
      '--bg-base':       '#282828',
      '--bg-deep':       '#1e1e1e',
      '--bg-surface':    '#303030',
      '--bg-raised':     '#3a3a3a',
      '--bg-hover':      '#2c2c2c',
      '--border-subtle': '#404040',
      '--border-mid':    '#505050',
      '--border-strong': '#646464',
      '--text-primary':  '#e8e8e8',
      '--text-secondary':'#9e9e9e',
      '--text-muted':    '#5e5e5e',
      '--text-ghost':    '#363636',
      '--accent':        '#4a9fd4',
      '--accent-dim':    'rgba(74,159,212,0.15)',
      '--accent-faint':  'rgba(74,159,212,0.06)',
      '--accent-text':   '#ffffff',
      '--logo-filter':   'none',
    },
  },

  graphite: {
    label: 'graphite',
    mode: 'dark',
    vars: {
      '--bg-base':       '#28241e',
      '--bg-deep':       '#1e1c16',
      '--bg-surface':    '#302c26',
      '--bg-raised':     '#3a362e',
      '--bg-hover':      '#2c2820',
      '--border-subtle': '#423e36',
      '--border-mid':    '#524e44',
      '--border-strong': '#686056',
      '--text-primary':  '#ede8e0',
      '--text-secondary':'#a09080',
      '--text-muted':    '#686058',
      '--text-ghost':    '#383028',
      '--accent':        '#c87e3a',
      '--accent-dim':    'rgba(200,126,58,0.15)',
      '--accent-faint':  'rgba(200,126,58,0.06)',
      '--accent-text':   '#ffffff',
      '--logo-filter':   'none',
    },
  },

  sunset: {
    label: 'sunset',
    mode: 'dark',
    vars: {
      '--bg-base':       '#1c1b28',
      '--bg-deep':       '#141320',
      '--bg-surface':    '#23212e',
      '--bg-raised':     '#2c2a3c',
      '--bg-hover':      '#1f1d2a',
      '--border-subtle': '#2e2c42',
      '--border-mid':    '#3c3a54',
      '--border-strong': '#504e6c',
      '--text-primary':  '#eadcc8',
      '--text-secondary':'#8a8090',
      '--text-muted':    '#504858',
      '--text-ghost':    '#2a2830',
      '--accent':        '#e87a3a',
      '--accent-dim':    'rgba(232,122,58,0.15)',
      '--accent-faint':  'rgba(232,122,58,0.06)',
      '--accent-text':   '#1c1b28',
      '--logo-filter':   'none',
    },
  },

  retro: {
    label: 'retro',
    mode: 'dark',
    vars: {
      '--bg-base':       '#0e1a30',
      '--bg-deep':       '#081220',
      '--bg-surface':    '#142238',
      '--bg-raised':     '#1a2c48',
      '--bg-hover':      '#101e34',
      '--border-subtle': '#1c3050',
      '--border-mid':    '#284060',
      '--border-strong': '#345278',
      '--text-primary':  '#c8e0f4',
      '--text-secondary':'#6090c0',
      '--text-muted':    '#304860',
      '--text-ghost':    '#142030',
      '--accent':        '#e040c0',
      '--accent-dim':    'rgba(224,64,192,0.15)',
      '--accent-faint':  'rgba(224,64,192,0.07)',
      '--accent-text':   '#0e1a30',
      '--logo-filter':   'none',
    },
  },

  // ── light ─────────────────────────────────────────────────────────────────

  paper: {
    label: 'paper',
    mode: 'light',
    vars: {
      '--bg-base':       '#f5f5f0',
      '--bg-deep':       '#ebebea',
      '--bg-surface':    '#fafaf8',
      '--bg-raised':     '#ffffff',
      '--bg-hover':      '#f0f0ec',
      '--border-subtle': '#e0e0db',
      '--border-mid':    '#d0d0ca',
      '--border-strong': '#b0b0aa',
      '--text-primary':  '#1a1a18',
      '--text-secondary':'#525250',
      '--text-muted':    '#909090',
      '--text-ghost':    '#d4d4d0',
      '--accent':        '#c8201a',
      '--accent-dim':    'rgba(200,32,26,0.12)',
      '--accent-faint':  'rgba(200,32,26,0.05)',
      '--accent-text':   '#ffffff',
      '--logo-filter':   'invert(1)',
    },
  },

  latte: {
    label: 'latte',
    mode: 'light',
    vars: {
      '--bg-base':       '#f5f0e8',
      '--bg-deep':       '#ede8de',
      '--bg-surface':    '#faf7f2',
      '--bg-raised':     '#ffffff',
      '--bg-hover':      '#ede8e0',
      '--border-subtle': '#e4ddd0',
      '--border-mid':    '#d0c8b8',
      '--border-strong': '#b8a890',
      '--text-primary':  '#2a2418',
      '--text-secondary':'#6a5e50',
      '--text-muted':    '#9a8e80',
      '--text-ghost':    '#d4cec4',
      '--accent':        '#c8601a',
      '--accent-dim':    'rgba(200,96,26,0.12)',
      '--accent-faint':  'rgba(200,96,26,0.05)',
      '--accent-text':   '#faf7f2',
      '--logo-filter':   'invert(1) sepia(0.4) brightness(0.5)',
    },
  },

  flashbang: {
    label: 'flashbang',
    mode: 'light',
    vars: {
      '--bg-base':       '#f8f8f6',
      '--bg-deep':       '#f0f0ee',
      '--bg-surface':    '#ffffff',
      '--bg-raised':     '#ffffff',
      '--bg-hover':      '#f2f2f0',
      '--border-subtle': '#e8e8e4',
      '--border-mid':    '#d4d4d0',
      '--border-strong': '#b8b8b4',
      '--text-primary':  '#141414',
      '--text-secondary':'#484848',
      '--text-muted':    '#909090',
      '--text-ghost':    '#d0d0d0',
      '--accent':        '#e8c000',
      '--accent-dim':    'rgba(232,192,0,0.18)',
      '--accent-faint':  'rgba(232,192,0,0.07)',
      '--accent-text':   '#141414',
      '--logo-filter':   'invert(1)',
    },
  },

  girlypop: {
    label: 'girlypop',
    mode: 'light',
    vars: {
      '--bg-base':       '#fce8f0',
      '--bg-deep':       '#f5dce8',
      '--bg-surface':    '#fef4f8',
      '--bg-raised':     '#ffffff',
      '--bg-hover':      '#f5e5f0',
      '--border-subtle': '#eac8d8',
      '--border-mid':    '#d8b0c4',
      '--border-strong': '#c090b0',
      '--text-primary':  '#3c1828',
      '--text-secondary':'#7a4860',
      '--text-muted':    '#b07898',
      '--text-ghost':    '#e8c8d8',
      '--accent':        '#5aace8',
      '--accent-dim':    'rgba(90,172,232,0.18)',
      '--accent-faint':  'rgba(90,172,232,0.07)',
      '--accent-text':   '#ffffff',
      '--logo-filter':   'invert(1) sepia(0.3) hue-rotate(300deg) brightness(0.5)',
    },
  },
}

export const DEFAULT_THEME = 'charcoal'

export const DEFAULT_CUSTOM_COLORS = { bg: '#282828', accent: '#4a9fd4', text: '#e8e8e8' }

function blend(from, to, t) {
  const f = (h, o) => parseInt(h.slice(o, o + 2), 16)
  const lerp = (a, b) => Math.round(a + (b - a) * t)
  const r = lerp(f(from, 1), f(to, 1))
  const g = lerp(f(from, 3), f(to, 3))
  const b = lerp(f(from, 5), f(to, 5))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

export function generateCustomTheme(bg, accent, text) {
  const isDark = hexLuminance(bg) < 0.45

  const bgDeep     = isDark ? darkenHex(bg, 0.20)  : darkenHex(bg, 0.06)
  const bgSurface  = isDark ? lightenHex(bg, 0.10)  : lightenHex(bg, 0.03)
  const bgRaised   = isDark ? lightenHex(bg, 0.22)  : lightenHex(bg, 0.07)
  const bgHover    = isDark ? lightenHex(bg, 0.06)  : darkenHex(bg, 0.04)
  const bordSubtle = isDark ? lightenHex(bg, 0.16)  : darkenHex(bg, 0.10)
  const bordMid    = isDark ? lightenHex(bg, 0.28)  : darkenHex(bg, 0.20)
  const bordStrong = isDark ? lightenHex(bg, 0.45)  : darkenHex(bg, 0.35)
  const textSec    = blend(text, bg, isDark ? 0.42 : 0.38)
  const textMuted  = blend(text, bg, isDark ? 0.65 : 0.60)
  const textGhost  = blend(text, bg, isDark ? 0.82 : 0.78)

  const ar = parseInt(accent.slice(1, 3), 16)
  const ag = parseInt(accent.slice(3, 5), 16)
  const ab = parseInt(accent.slice(5, 7), 16)

  return {
    '--bg-base':       bg,
    '--bg-deep':       bgDeep,
    '--bg-surface':    bgSurface,
    '--bg-raised':     bgRaised,
    '--bg-hover':      bgHover,
    '--border-subtle': bordSubtle,
    '--border-mid':    bordMid,
    '--border-strong': bordStrong,
    '--text-primary':  text,
    '--text-secondary':textSec,
    '--text-muted':    textMuted,
    '--text-ghost':    textGhost,
    '--accent':        accent,
    '--accent-dim':    `rgba(${ar},${ag},${ab},0.15)`,
    '--accent-faint':  `rgba(${ar},${ag},${ab},0.07)`,
    '--accent-text':   hexLuminance(accent) > 0.45 ? '#111111' : '#f8f8f8',
    '--logo-filter':   isDark ? 'none' : 'invert(1)',
  }
}
