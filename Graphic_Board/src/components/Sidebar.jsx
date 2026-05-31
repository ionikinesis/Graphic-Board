import React, { useState, useEffect, useRef } from 'react'

async function loadSubdirs(handle) {
  const dirs = []
  for await (const [name, h] of handle.entries()) {
    if (h.kind === 'directory') dirs.push({ name, handle: h })
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name))
  return dirs
}

export default function Sidebar({ rootHandle, stack, onNavigateTo, onNavigateHome, roots, activeRootId, onSwitchRoot, onSetRootColor }) {
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
          />
        ))}
      </div>
    </aside>
  )
}

function RootTree({ root, isActive, stack, onNavigateTo, onNavigateHome, onSetColor }) {
  const [expanded, setExpanded]   = useState(isActive)
  const [children, setChildren]   = useState(null)
  const [hovered,  setHovered]    = useState(false)
  const colorRef = useRef()

  // Auto-expand when this root becomes active
  useEffect(() => { if (isActive) setExpanded(true) }, [isActive])

  // Lazy-load subdirs when first expanded
  useEffect(() => {
    if (!expanded || children !== null || !root.handle) return
    loadSubdirs(root.handle).then(setChildren)
  }, [expanded, root.handle, children])

  const hasHandle  = root.handle && root.status !== 'missing'
  const isAtRoot   = isActive && stack.length === 0
  const borderColor = isAtRoot ? 'var(--accent)' : (root.color ?? 'transparent')

  return (
    <div style={{ opacity: root.status === 'missing' ? 0.4 : 1 }}>
      <div
        style={{
          ...s.row,
          paddingLeft: 6,
          borderLeft: `2px solid ${borderColor}`,
          background: isAtRoot ? 'var(--accent-faint)' : 'transparent',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
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

        {/* Color dot — left-click opens picker, right-click clears color */}
        {onSetColor && (
          <label
            style={s.colorLabel}
            title="left-click to set color · right-click to clear"
            onContextMenu={e => { e.preventDefault(); onSetColor(null) }}
          >
            <input
              ref={colorRef}
              type="color"
              value={root.color || '#888888'}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
              onChange={e => onSetColor(e.target.value)}
            />
            <span style={{
              ...s.colorDot,
              background: root.color ?? 'var(--border-mid)',
              opacity: root.color ? 1 : (hovered ? 0.55 : 0.2),
              outline: root.color && isActive ? `2px solid ${root.color}44` : 'none',
              outlineOffset: 1,
            }} />
          </label>
        )}

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
        />
      ))}
    </div>
  )
}

function SidebarNode({ name, handle, path, stack, onNavigateTo, baseDepth = 0 }) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState(null)
  const [hasSubdirs, setHasSubdirs] = useState(true)

  const depth = path.length - 1 + baseDepth

  const isInPath = path.length <= stack.length &&
    path.every((p, i) => stack[i]?.name === p.name)
  const isActiveLeaf = isInPath && path.length === stack.length

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

  return (
    <div>
      <div
        style={{
          ...s.row,
          paddingLeft: 14 + depth * 12,
          borderLeft: isActiveLeaf ? '2px solid var(--accent)' : '2px solid transparent',
          background: isActiveLeaf ? 'var(--accent-faint)' : isInPath ? '#0d0d0d' : 'transparent',
        }}
        onMouseEnter={e => { if (!isActiveLeaf) e.currentTarget.style.background = '#0f0f0f' }}
        onMouseLeave={e => {
          e.currentTarget.style.background = isActiveLeaf
            ? 'var(--accent-faint)'
            : isInPath ? '#0d0d0d' : 'transparent'
        }}
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
    fontSize: 10,
    width: 16,
    textAlign: 'center',
    flexShrink: 0,
    color: 'var(--border-strong)',
    transition: 'transform 0.15s, opacity 0.1s',
    cursor: 'pointer',
    userSelect: 'none',
  },
  colorLabel: {
    cursor: 'pointer',
    flexShrink: 0,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    display: 'block',
    transition: 'opacity 0.15s',
    flexShrink: 0,
  },
  homeIcon: {
    fontSize: 11,
    width: 14,
    textAlign: 'center',
    flexShrink: 0,
    userSelect: 'none',
  },
  nodeName: {
    flex: 1,
    fontSize: 12,
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
}
