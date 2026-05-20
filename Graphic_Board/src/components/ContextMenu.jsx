import React, { useEffect, useRef, useState } from 'react'
import { PRESET_COLORS } from '../utils/color.js'

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef()

  useEffect(() => {
    function onMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const menuW = 210
  const estH  = items.reduce((h, it) => h + (it.separator ? 9 : it.colorRow ? 36 : it.tagRow ? 60 : 30), 8)
  const left  = Math.min(x, window.innerWidth  - menuW - 8)
  const top   = Math.min(y, window.innerHeight - estH  - 8)

  return (
    <div
      ref={ref}
      style={{ ...s.menu, left, top }}
      onContextMenu={e => e.preventDefault()}
    >
      {items.map((item, i) => {
        if (item.separator) return <div key={i} style={s.sep} />
        if (item.colorRow)  return <ColorRow key={i} value={item.value} onChange={item.onChange} onClose={onClose} />
        if (item.tagRow)    return <TagRow key={i} tags={item.tags} onChange={item.onChange} allTags={item.allTags} getTagColor={item.getTagColor} />
        return (
          <MenuItem key={i} item={item} onClose={onClose} />
        )
      })}
    </div>
  )
}

function MenuItem({ item, onClose }) {
  const [feedback, setFeedback] = useState(null)

  function handleClick() {
    if (item.disabled) return
    const result = item.onClick()
    if (item.feedback) {
      setFeedback(item.feedback)
      setTimeout(() => { setFeedback(null); onClose() }, 900)
    } else if (item.stayOpen) {
      // don't close
    } else {
      onClose()
    }
    return result
  }

  return (
    <button
      style={{
        ...s.item,
        ...(item.disabled ? s.itemDisabled : {}),
        ...(item.danger    ? s.itemDanger   : {}),
      }}
      onClick={handleClick}
    >
      {item.icon != null && <span style={s.icon}>{item.icon}</span>}
      <span style={{ flex: 1 }}>{feedback ?? item.label}</span>
      {item.badge && <span style={s.badge}>{item.badge}</span>}
    </button>
  )
}

function ColorRow({ value, onChange, onClose }) {
  const [hexDraft, setHexDraft] = useState(value || '')
  const colorInputRef = useRef()

  // Sync hex field when a swatch is clicked
  useEffect(() => { setHexDraft(value || '') }, [value])

  function applyHex(raw) {
    const v = raw.trim()
    if (!v) { onChange(null); return }
    const h = v.startsWith('#') ? v : '#' + v
    if (/^#[0-9a-f]{6}$/i.test(h)) onChange(h)
  }

  return (
    // stopPropagation prevents outside-click from closing menu while picking
    <div style={s.colorSection} onMouseDown={e => e.stopPropagation()}>
      <div style={s.colorHeader}>
        <span style={s.colorLabel}>color tag</span>
        {value && (
          <button style={s.colorClear} onClick={() => { onChange(null); onClose() }}>
            clear
          </button>
        )}
      </div>

      {/* Preset swatches */}
      <div style={s.swatchGrid}>
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            title={c}
            style={{
              ...s.swatch,
              background: c,
              outline: value === c ? `2px solid var(--text-primary)` : '2px solid transparent',
              outlineOffset: 1,
            }}
            onClick={() => onChange(c)}
          />
        ))}
      </div>

      {/* Custom color picker + hex input */}
      <div style={s.customRow}>
        <label style={s.pickerLabel} title="custom color picker">
          <input
            ref={colorInputRef}
            type="color"
            value={value || '#e8b84b'}
            style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
            onChange={e => { onChange(e.target.value); setHexDraft(e.target.value) }}
          />
          ⬤
        </label>
        <input
          type="text"
          value={hexDraft}
          placeholder="#rrggbb"
          maxLength={7}
          spellCheck={false}
          onChange={e => setHexDraft(e.target.value)}
          onBlur={() => applyHex(hexDraft)}
          onKeyDown={e => { if (e.key === 'Enter') { applyHex(hexDraft); onClose() } }}
          style={s.hexInput}
        />
      </div>
    </div>
  )
}

function TagRow({ tags, onChange, allTags, getTagColor }) {
  const [input, setInput] = useState('')

  function addTag(raw) {
    const t = raw.trim().toLowerCase()
    if (!t || tags.includes(t)) { setInput(''); return }
    onChange([...tags, t])
    setInput('')
  }

  function removeTag(t) {
    onChange(tags.filter(x => x !== t))
  }

  const suggestions = allTags.filter(t => !tags.includes(t) && t.startsWith(input.toLowerCase()) && input.length > 0)

  return (
    <div style={s.tagSection} onMouseDown={e => e.stopPropagation()}>
      <div style={s.tagHeader}>
        <span style={s.tagLabel}>tags</span>
      </div>
      <div style={s.tagChips}>
        {tags.map(t => {
          const col = getTagColor ? getTagColor(t) : null
          return (
            <span key={t} style={{ ...s.chip, ...(col ? { borderColor: col + '80', color: col } : {}) }}>
              {col && <span style={{ ...s.chipDot, background: col }} />}
              {t}
              <button style={s.chipX} onClick={() => removeTag(t)}>×</button>
            </span>
          )
        })}
      </div>
      <input
        type="text"
        value={input}
        placeholder="add tag…"
        style={s.tagInput}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input) }
          if (e.key === 'Backspace' && input === '' && tags.length > 0) {
            onChange(tags.slice(0, -1))
          }
        }}
      />
      {suggestions.length > 0 && (
        <div style={s.suggestions}>
          {suggestions.slice(0, 5).map(t => (
            <button key={t} style={s.suggestionBtn} onMouseDown={e => { e.preventDefault(); onChange([...tags, t]); setInput('') }}>
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const s = {
  menu: {
    position: 'fixed',
    zIndex: 9999,
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--border-mid)',
    borderRadius: 'var(--radius-md)',
    boxShadow: '0 8px 28px rgba(0,0,0,0.75)',
    padding: '4px 0',
    minWidth: 210,
    userSelect: 'none',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    width: '100%',
    padding: '7px 13px',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: 12,
    letterSpacing: '0.04em',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background 0.07s',
    fontFamily: 'var(--font-mono)',
  },
  itemDisabled: { opacity: 0.3, cursor: 'default', pointerEvents: 'none' },
  itemDanger:   { color: '#e05050' },
  icon: { fontSize: 13, color: 'var(--text-muted)', width: 16, textAlign: 'center', flexShrink: 0 },
  badge: { fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em' },
  sep: { height: '0.5px', background: 'var(--border-subtle)', margin: '3px 8px' },
  colorSection: { padding: '6px 12px 8px' },
  colorHeader: { display: 'flex', alignItems: 'center', marginBottom: 7 },
  colorLabel: { fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', flex: 1, fontWeight: 700 },
  colorClear: {
    fontSize: 9, color: 'var(--text-muted)',
    background: 'transparent', border: '0.5px solid var(--border-mid)',
    borderRadius: 2, padding: '2px 6px', cursor: 'pointer', letterSpacing: '0.04em',
  },
  swatchGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: 4,
    marginBottom: 7,
  },
  swatch: {
    aspectRatio: '1',
    border: 'none',
    borderRadius: 3,
    cursor: 'pointer',
    padding: 0,
    transition: 'transform 0.08s',
  },
  customRow: { display: 'flex', gap: 6, alignItems: 'center' },
  pickerLabel: {
    width: 26, height: 26, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16,
    background: 'var(--bg-raised)',
    border: '0.5px solid var(--border-mid)',
    borderRadius: 3,
    cursor: 'pointer',
    position: 'relative',
    color: 'var(--text-muted)',
    userSelect: 'none',
  },
  hexInput: {
    flex: 1,
    fontSize: 12,
    color: 'var(--text-secondary)',
    background: 'var(--bg-raised)',
    border: '0.5px solid var(--border-mid)',
    borderRadius: 3,
    padding: '5px 8px',
    letterSpacing: '0.06em',
    fontFamily: 'var(--font-mono)',
    outline: 'none',
  },
  tagSection: { padding: '6px 12px 8px' },
  tagHeader: { display: 'flex', alignItems: 'center', marginBottom: 6 },
  tagLabel: { fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 },
  tagChips: { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6, minHeight: 0 },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 3,
    fontSize: 10, color: 'var(--text-secondary)',
    background: 'var(--bg-raised)', border: '0.5px solid var(--border-mid)',
    borderRadius: 3, padding: '2px 6px',
    letterSpacing: '0.04em', fontFamily: 'var(--font-mono)',
  },
  chipDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
  chipX: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', fontSize: 12, lineHeight: 1,
    padding: '0 0 0 2px',
  },
  tagInput: {
    width: '100%', boxSizing: 'border-box',
    fontSize: 11, color: 'var(--text-secondary)',
    background: 'var(--bg-raised)', border: '0.5px solid var(--border-mid)',
    borderRadius: 3, padding: '4px 7px',
    fontFamily: 'var(--font-mono)', outline: 'none',
    letterSpacing: '0.04em',
  },
  suggestions: {
    display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4,
  },
  suggestionBtn: {
    fontSize: 10, color: 'var(--text-muted)',
    background: 'var(--bg-base)', border: '0.5px solid var(--border-subtle)',
    borderRadius: 3, padding: '2px 6px', cursor: 'pointer',
    fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
  },
}
