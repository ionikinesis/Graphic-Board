import React, { useState } from 'react'

export default function FolderPicker({ roots, mode, onSelect, onClose }) {
  const [expanded, setExpanded] = useState({})   // pathKey → bool
  const [children, setChildren] = useState({})   // pathKey → [{name, handle}]
  const [busy,     setBusy]     = useState({})   // pathKey → bool
  const [selected, setSelected] = useState(null) // { handle, name }
  const [hovered,  setHovered]  = useState(null) // pathKey

  async function toggle(pathKey, handle) {
    if (expanded[pathKey]) {
      setExpanded(p => ({ ...p, [pathKey]: false }))
      return
    }
    if (!children[pathKey]) {
      setBusy(p => ({ ...p, [pathKey]: true }))
      const subs = []
      for await (const [name, h] of handle.entries()) {
        if (h.kind === 'directory') subs.push({ name, handle: h })
      }
      subs.sort((a, b) => a.name.localeCompare(b.name))
      setChildren(p => ({ ...p, [pathKey]: subs }))
      setBusy(p => ({ ...p, [pathKey]: false }))
    }
    setExpanded(p => ({ ...p, [pathKey]: true }))
  }

  function renderNode(name, handle, pathKey, depth) {
    const isExp  = !!expanded[pathKey]
    const isBusy = !!busy[pathKey]
    const subs   = children[pathKey] || []
    const isSel  = selected?.handle === handle
    const isHov  = hovered === pathKey

    return (
      <div key={pathKey}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: `5px 14px 5px ${12 + depth * 16}px`,
            cursor: 'pointer',
            background: isSel ? 'var(--accent-faint)' : isHov ? 'var(--bg-hover)' : 'transparent',
            borderLeft: `2px solid ${isSel ? 'var(--accent)' : 'transparent'}`,
          }}
          onClick={() => setSelected({ handle, name })}
          onMouseEnter={() => setHovered(pathKey)}
          onMouseLeave={() => setHovered(null)}
        >
          <span
            style={{ fontSize: 'var(--fs-9)', color: 'var(--text-muted)', width: 10, textAlign: 'center', flexShrink: 0, lineHeight: 1 }}
            onClick={e => { e.stopPropagation(); toggle(pathKey, handle) }}
          >
            {isBusy ? '…' : isExp ? '▾' : '▸'}
          </span>
          <span style={{
            fontSize: 'var(--fs-12)', fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
            color: isSel ? 'var(--accent)' : 'var(--text-secondary)',
            flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {depth === 0 && <span style={{ marginRight: 5, opacity: 0.5 }}>⌂</span>}
            {name}
          </span>
        </div>
        {isExp && subs.length === 0 && !isBusy && (
          <div style={{ paddingLeft: 12 + (depth + 1) * 16 + 17, paddingTop: 2, paddingBottom: 4, fontSize: 'var(--fs-10)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
            no subfolders
          </div>
        )}
        {isExp && subs.map(sub => renderNode(sub.name, sub.handle, `${pathKey}/${sub.name}`, depth + 1))}
      </div>
    )
  }

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.panel} onClick={e => e.stopPropagation()}>
        <div style={s.header}>
          <span style={s.title}>{mode === 'move' ? 'send to' : 'copy to'}</span>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div style={s.body}>
          {roots.filter(r => r.handle && r.status !== 'missing').map(root =>
            renderNode(root.name, root.handle, root.id, 0)
          )}
        </div>

        <div style={s.footer}>
          <button style={s.cancelBtn} onClick={onClose}>cancel</button>
          <button
            style={{ ...s.confirmBtn, ...(selected ? {} : s.confirmDisabled) }}
            disabled={!selected}
            onClick={() => selected && onSelect(selected.handle)}
          >
            {mode === 'move' ? 'move here' : 'copy here'}
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
    zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  panel: {
    width: 340, maxHeight: '72vh',
    background: 'var(--bg-surface)', border: '0.5px solid var(--border-mid)',
    borderRadius: 'var(--radius-lg)', overflow: 'hidden',
    boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
    display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '13px 18px', borderBottom: '0.5px solid var(--border-subtle)',
    background: 'var(--bg-deep)', flexShrink: 0,
  },
  title:    { fontSize: 'var(--fs-13)', color: 'var(--text-secondary)', letterSpacing: '0.06em', fontWeight: 700, fontFamily: 'var(--font-mono)' },
  closeBtn: { fontSize: 'var(--fs-12)', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 7px', borderRadius: 3 },
  body:     { flex: 1, overflowY: 'auto', padding: '5px 0' },
  footer: {
    display: 'flex', gap: 8, padding: '11px 14px',
    borderTop: '0.5px solid var(--border-subtle)',
    background: 'var(--bg-deep)', flexShrink: 0,
  },
  cancelBtn: {
    flex: 1, fontSize: 'var(--fs-11)', color: 'var(--text-muted)',
    background: 'transparent', border: '0.5px solid var(--border-mid)',
    borderRadius: 3, padding: '6px 10px', cursor: 'pointer',
    fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
  },
  confirmBtn: {
    flex: 1, fontSize: 'var(--fs-11)', color: 'var(--accent)',
    background: 'var(--accent-faint)', border: '0.5px solid var(--accent-dim)',
    borderRadius: 3, padding: '6px 10px', cursor: 'pointer',
    fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
  },
  confirmDisabled: { opacity: 0.35, cursor: 'default' },
}
