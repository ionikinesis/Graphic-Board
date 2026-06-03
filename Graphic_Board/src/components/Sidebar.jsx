import React, { useState, useEffect, useRef } from 'react'

function hexToRgba(hex, alpha) {
  if (!hex || hex.length < 7) return `rgba(0,0,0,${alpha})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

async function loadSubdirs(handle) {
  const dirs = []
  for await (const [name, h] of handle.entries()) {
    if (h.kind === 'directory') dirs.push({ name, handle: h })
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name))
  return dirs
}

export default function Sidebar({ rootHandle, stack, onNavigateTo, onNavigateHome, roots, activeRootId, onSwitchRoot, onSetRootColor, getFolderColor, refreshKey, onDropItem }) {
  return (
    <aside style={s.sidebar}>
      <div style={s.scroll}>
        {roots && roots.map(root => (
          <RootTree
            key={root.id}
            root={root}
            isActive={root.id === activeRootId}
            stack={root.id === activeRootId ? stack : []}
            onNavigateTo={root.id === activeRootId ? onNavigateTo : () => onSwitchRoot(root.id)}
            onNavigateHome={root.id === activeRootId ? onNavigateHome : () => onSwitchRoot(root.id)}
            onSetColor={onSetRootColor ? hex => onSetRootColor(root.id, hex) : null}
            getFolderColor={getFolderColor}
            refreshKey={refreshKey}
            onDropItem={onDropItem}
          />
        ))}
      </div>
    </aside>
  )
}

function RootTree({ root, isActive, stack, onNavigateTo, onNavigateHome, onSetColor, getFolderColor, refreshKey, onDropItem }) {
  const [expanded,  setExpanded]  = useState(isActive)
  const [children,  setChildren]  = useState(null)
  const [ctxMenu,   setCtxMenu]   = useState(null)
  const [dropHover, setDropHover] = useState(false)
  const colorRef = useRef()

  // Auto-expand when this root becomes active
  useEffect(() => { if (isActive) setExpanded(true) }, [isActive])

  // Lazy-load subdirs when first expanded
  useEffect(() => {
    if (!expanded || children !== null || !root.handle) return
    loadSubdirs(root.handle).then(setChildren)
  }, [expanded, root.handle, children])

  // Reset children when refreshKey changes so they reload
  useEffect(() => { setChildren(null) }, [refreshKey])

  // Close context menu on outside click
  useEffect(() => {
    if (!ctxMenu) return
    function onDown(e) { if (!e.target.closest('[data-rootctx]')) setCtxMenu(null) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [ctxMenu])

  const hasHandle = root.handle && root.status !== 'missing'
  const isAtRoot  = isActive && stack.length === 0
  const color     = root.color ?? null
  const bgAlpha   = isAtRoot ? 0.28 : isActive ? 0.18 : 0.12
  const rowBg     = color ? hexToRgba(color, bgAlpha) : isAtRoot ? 'var(--accent-faint)' : 'transparent'
  const rowBorder = color
    ? `2px solid ${hexToRgba(color, isAtRoot ? 0.9 : 0.45)}`
    : isAtRoot ? '2px solid var(--accent)' : '2px solid transparent'

  return (
    <div style={{ opacity: root.status === 'missing' ? 0.4 : 1 }}>
      {/* Hidden color input — triggered by context menu */}
      {onSetColor && (
        <input
          ref={colorRef}
          type="color"
          value={root.color || '#888888'}
          style={{ position: 'fixed', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
          onChange={e => onSetColor(e.target.value)}
        />
      )}

      <div
        style={{
          ...s.row, paddingLeft: 6, borderLeft: rowBorder,
          background: dropHover ? 'var(--accent-faint)' : rowBg,
          outline: dropHover ? '1px solid var(--accent)' : 'none',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = color ? hexToRgba(color, bgAlpha + 0.08) : isAtRoot ? 'var(--accent-faint)' : '#0f0f0f' }}
        onMouseLeave={e => { e.currentTarget.style.background = dropHover ? 'var(--accent-faint)' : rowBg }}
        onContextMenu={e => { e.preventDefault(); if (onSetColor) setCtxMenu({ x: e.clientX, y: e.clientY }) }}
        onDragOver={e => { if (e.dataTransfer.types.includes('application/x-graphic-board')) { e.preventDefault(); setDropHover(true) } }}
        onDragLeave={() => setDropHover(false)}
        onDrop={e => { e.preventDefault(); setDropHover(false); if (root.handle) onDropItem?.(root.handle) }}
      >
        {/* Expand / collapse */}
        <span
          style={{
            ...s.chevron,
            opacity: hasHandle ? 1 : 0.25,
            pointerEvents: hasHandle ? 'auto' : 'none',
            transform: expanded ? 'rotate(90deg)' : 'none',
          }}
          onClick={() => hasHandle && setExpanded(e => !e)}
        >›</span>

        {/* ⌂ icon */}
        <span style={{ ...s.homeIcon, color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}>⌂</span>

        {/* Root name */}
        <span
          style={{
            ...s.nodeName,
            fontWeight: isActive ? 700 : 400,
            color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
            cursor: 'pointer',
          }}
          onClick={onNavigateHome}
        >
          {root.name}
        </span>

        {root.status === 'needs-permission' && (
          <span style={s.permDot} title="needs access" />
        )}
      </div>

      {/* Right-click color menu */}
      {ctxMenu && (
        <div
          data-rootctx="1"
          style={{ ...s.ctxMenu, left: ctxMenu.x, top: ctxMenu.y }}
        >
          <button style={s.ctxItem} onClick={() => { setCtxMenu(null); setTimeout(() => colorRef.current?.click(), 0) }}>
            <span style={{ ...s.ctxSwatch, background: color ?? 'var(--border-mid)' }} />
            set color
          </button>
          <button
            style={{ ...s.ctxItem, opacity: color ? 1 : 0.35 }}
            disabled={!color}
            onClick={() => { onSetColor(null); setCtxMenu(null) }}
          >
            <span style={{ ...s.ctxSwatch, background: 'transparent', border: '1px solid var(--border-mid)' }} />
            clear color
          </button>
        </div>
      )}

      {/* Subdirectory tree */}
      {expanded && children && children.map(dir => (
        <SidebarNode
          key={dir.name}
          name={dir.name}
          handle={dir.handle}
          path={[{ name: dir.name, handle: dir.handle }]}
          stack={stack}
          onNavigateTo={onNavigateTo}
          baseDepth={1}
          rootName={root.name}
          getFolderColor={getFolderColor}
          refreshKey={refreshKey}
          onDropItem={onDropItem}
        />
      ))}
    </div>
  )
}

function SidebarNode({ name, handle, path, stack, onNavigateTo, baseDepth = 0, rootName, getFolderColor, refreshKey, onDropItem }) {
  const [expanded,  setExpanded]  = useState(false)
  const [children,  setChildren]  = useState(null)
  const [hasSubdirs, setHasSubdirs] = useState(true)
  const [dropHover, setDropHover] = useState(false)

  const depth = path.length - 1 + baseDepth

  // Reset children on external refresh so they reload when expanded
  useEffect(() => { setChildren(null) }, [refreshKey])

  const isInPath = path.length <= stack.length &&
    path.every((p, i) => stack[i]?.name === p.name)
  const isActiveLeaf = isInPath && path.length === stack.length

  const pathKey = rootName ? `${rootName}/${path.map(p => p.name).join('/')}` : null
  const color   = (getFolderColor && pathKey) ? getFolderColor(pathKey) : null
  const bgAlpha = isActiveLeaf ? 0.28 : isInPath ? 0.18 : 0.12

  async function doExpand() {
    if (!children) {
      const kids = await loadSubdirs(handle)
      setChildren(kids)
      setHasSubdirs(kids.length > 0)
    }
    setExpanded(true)
  }

  function handleToggle(e) {
    e.stopPropagation()
    if (expanded) setExpanded(false)
    else doExpand()
  }

  function handleSelect(e) {
    e.stopPropagation()
    onNavigateTo(path)
  }

  const rowBg     = color ? hexToRgba(color, bgAlpha) : isActiveLeaf ? 'var(--accent-faint)' : isInPath ? '#0d0d0d' : 'transparent'
  const rowBorder = color
    ? `2px solid ${hexToRgba(color, isActiveLeaf ? 0.9 : 0.45)}`
    : isActiveLeaf ? '2px solid var(--accent)' : '2px solid transparent'

  return (
    <div>
      <div
        style={{
          ...s.row, paddingLeft: 14 + depth * 12, borderLeft: rowBorder,
          background: dropHover ? 'var(--accent-faint)' : rowBg,
          outline: dropHover ? '1px solid var(--accent)' : 'none',
        }}
        onMouseEnter={e => { if (!dropHover) e.currentTarget.style.background = color ? hexToRgba(color, bgAlpha + 0.08) : isActiveLeaf ? 'var(--accent-faint)' : '#0f0f0f' }}
        onMouseLeave={e => { if (!dropHover) e.currentTarget.style.background = rowBg }}
        onDragOver={e => { if (e.dataTransfer.types.includes('application/x-graphic-board')) { e.preventDefault(); setDropHover(true) } }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDropHover(false) }}
        onDrop={e => { e.preventDefault(); setDropHover(false); onDropItem?.(handle) }}
      >
        <span
          style={{
            ...s.chevron,
            opacity: hasSubdirs ? 1 : 0,
            pointerEvents: hasSubdirs ? 'auto' : 'none',
            transform: expanded ? 'rotate(90deg)' : 'none',
          }}
          onClick={handleToggle}
        >›</span>
        <span
          style={{
            ...s.nodeName,
            fontWeight: isActiveLeaf ? 700 : 400,
            color: isActiveLeaf
              ? 'var(--text-primary)'
              : isInPath ? 'var(--text-secondary)' : 'var(--text-muted)',
          }}
          onClick={handleSelect}
        >
          {name}
        </span>
      </div>

      {expanded && children && children.map(child => (
        <SidebarNode
          key={child.name}
          name={child.name}
          handle={child.handle}
          path={[...path, { name: child.name, handle: child.handle }]}
          stack={stack}
          onNavigateTo={onNavigateTo}
          baseDepth={baseDepth}
          rootName={rootName}
          getFolderColor={getFolderColor}
          refreshKey={refreshKey}
          onDropItem={onDropItem}
        />
      ))}
    </div>
  )
}

const s = {
  sidebar: {
    width: 210,
    borderRight: '0.5px solid var(--border-subtle)',
    background: 'var(--bg-deep)',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px 0',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    paddingRight: 10,
    paddingTop: 5,
    paddingBottom: 5,
    transition: 'background 0.08s',
  },
  chevron: {
    fontSize: 'var(--fs-10)',
    width: 16,
    textAlign: 'center',
    flexShrink: 0,
    color: 'var(--border-strong)',
    transition: 'transform 0.15s, opacity 0.1s',
    cursor: 'pointer',
    userSelect: 'none',
  },
  homeIcon: {
    fontSize: 'var(--fs-11)',
    width: 14,
    textAlign: 'center',
    flexShrink: 0,
    userSelect: 'none',
  },
  nodeName: {
    flex: 1,
    fontSize: 'var(--fs-12)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
    transition: 'color 0.1s',
    userSelect: 'none',
  },
  permDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: '#e08050',
    flexShrink: 0,
  },
  ctxMenu: {
    position: 'fixed',
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--border-mid)',
    borderRadius: 'var(--radius-sm)',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    zIndex: 500,
    padding: '3px 0',
    minWidth: 130,
  },
  ctxItem: {
    display: 'flex', alignItems: 'center', gap: 7,
    width: '100%', background: 'transparent', border: 'none',
    padding: '6px 12px', cursor: 'pointer',
    fontSize: 'var(--fs-11)', color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)', letterSpacing: '0.03em',
    textAlign: 'left',
  },
  ctxSwatch: {
    width: 10, height: 10,
    borderRadius: 2, flexShrink: 0,
  },
}
