export const FOLDER_YELLOW = '#e8b84b'

export const PRESET_COLORS = [
  '#e8b84b', // folder yellow
  '#e0291e', // red
  '#e8832a', // orange
  '#f0d040', // bright yellow
  '#5cba6b', // green
  '#4a9eda', // blue
  '#9b6dd4', // purple
  '#d44d8a', // pink
  '#4dc8b0', // teal
  '#607d8b', // slate
  '#8d6e47', // brown
  '#b0b0b0', // grey
]

// Returns '#111111' (dark) or '#f2ede4' (light) for legible contrast against `hex`.
export function getContrastColor(hex) {
  if (!hex || hex.length < 7) return '#111111'
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.45 ? '#111111' : '#f2ede4'
}

// Darken a hex color by a 0–1 factor.
export function darkenHex(hex, factor = 0.2) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return hex
  const r = Math.round(Math.max(0, parseInt(hex.slice(1, 3), 16) * (1 - factor)))
  const g = Math.round(Math.max(0, parseInt(hex.slice(3, 5), 16) * (1 - factor)))
  const b = Math.round(Math.max(0, parseInt(hex.slice(5, 7), 16) * (1 - factor)))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// Lighten a hex color toward white by a 0–1 factor.
export function lightenHex(hex, factor = 0.2) {
  if (!hex || !hex.startsWith('#') || hex.length < 7) return hex
  const r = Math.round(Math.min(255, parseInt(hex.slice(1, 3), 16) + (255 - parseInt(hex.slice(1, 3), 16)) * factor))
  const g = Math.round(Math.min(255, parseInt(hex.slice(3, 5), 16) + (255 - parseInt(hex.slice(3, 5), 16)) * factor))
  const b = Math.round(Math.min(255, parseInt(hex.slice(5, 7), 16) + (255 - parseInt(hex.slice(5, 7), 16)) * factor))
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

// Perceived luminance of a hex color (0 = black, 1 = white).
export function hexLuminance(hex) {
  if (!hex || hex.length < 7) return 0
  return (0.299 * parseInt(hex.slice(1, 3), 16) +
          0.587 * parseInt(hex.slice(3, 5), 16) +
          0.114 * parseInt(hex.slice(5, 7), 16)) / 255
}
