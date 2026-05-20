import React, { useState, useEffect } from 'react'

async function loadSubdirs(handle) {
  const dirs = []
  for await (const [name, h] of handle.entries()) {
    if (h.kind === 'directory') dirs.push({ name, handle: h })
  }
  dirs.sort((a, b) => a.name.localeCompare(b.name))
  return dirs
}

export default function Sidebar({ rootHandle, stack, onNavigateTo, onNavigateHome }) {
  const [rootDirs, setRootDirs] = useState([])

  useEffect(() => {
    if (!rootHandle) { setRootDirs([]); return }
    loadSubdirs(rootHandle).then(setRootDirs)
  }, [rootHandle])

  const isAtRoot = stack.length === 0

  return (
    <aside style={s.sidebar}>
      <div style={s.scroll}>
        {rootHandle && (
          <>
            <div style={s.label}>library</div>
            {/* Root folder entry */}
            <div
              style={{
                ...s.row,
                paddingLeft: 14,
                borderLeft: isAtRoot ? '2px solid var(--accent)' : '2px solid transparent',
                background: isAtRoot ? 'var(--accent-faint)' : 'transparent',
              }}
              onClick={onNavigateHome}
              onMouseEnter={e => { if (!isAtRoot) e.currentTarget.style.background = '#0f0f0f' }}
              onMouseLeave={e => { e.currentTarget.style.background = isAtRoot ? 'var(--accent-faint)' : 'transparent' }}
            >
              <span style={s.rootIcon}>⌂</span>
              <span style={{
                ...s.nodeName,
                fontWeight: isAtRoot ? 700 : 400,
                color: isAtRoot ? 'var(--text-primary)' : 'var(--text-muted)',
              }}>
                {rootHandle.name}
              </span>
              <span style={s.rootBadge}>root</span>
            </div>

            {rootDirs.map(dir => (
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
          </>
        )}

      </div>
    </aside>
  )
}

// Recursive tree node — manages its own expand/collapse and lazy child loading
function SidebarNode({ name, handle, path, stack, onNavigateTo, baseDepth = 0 }) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState(null) // null = not yet loaded
  const [hasSubdirs, setHasSubdirs] = useState(true) // optimistic until first load

  const depth = path.length - 1 + baseDepth

  // A node is "in path" if its path is a prefix of the current stack
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
          background: isActiveLeaf
            ? 'var(--accent-faint)'
            : isInPath
            ? '#0d0d0d'
            : 'transparent',
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
              : isInPath
              ? 'var(--text-secondary)'
              : 'var(--text-muted)',
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
  label: {
    fontSize: 10,
    letterSpacing: '0.18em',
    color: 'var(--border-strong)',
    padding: '0 14px 7px',
    textTransform: 'uppercase',
    fontWeight: 700,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    paddingRight: 10,
    paddingTop: 5,
    paddingBottom: 5,
    cursor: 'pointer',
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
  nodeName: {
    flex: 1,
    fontSize: 12,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
    transition: 'color 0.1s',
  },
  rootIcon: { fontSize: 13, color: 'var(--accent)', width: 16, textAlign: 'center', flexShrink: 0 },
  rootBadge: {
    fontSize: 8, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase',
    border: '0.5px solid var(--accent)', borderRadius: 2, padding: '1px 4px', flexShrink: 0,
    opacity: 0.7,
  },
}
