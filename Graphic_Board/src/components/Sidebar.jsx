import React from 'react'

export default function Sidebar({ collections, activeCollectionId, onSelectCollection, onRemoveCollection, favouriteCount }) {
  return (
    <aside style={styles.sidebar}>
      <div style={styles.scroll}>
        {collections.length > 0 && (
          <>
            <div style={styles.label}>collections</div>
            {collections.map(col => (
              <CollectionRow
                key={col.id}
                collection={col}
                active={col.id === activeCollectionId}
                onSelect={() => onSelectCollection(col.id)}
                onRemove={() => onRemoveCollection(col.id)}
              />
            ))}
          </>
        )}

        <div style={{ ...styles.label, marginTop: collections.length > 0 ? 12 : 8 }}>smart</div>

        <div style={{ ...styles.smartRow }}>
          <span style={{ ...styles.smartIcon, background: '#1a1610', color: 'var(--accent)' }}>★</span>
          <span style={styles.smartName}>Favourites</span>
          <span style={styles.smartCount}>{favouriteCount}</span>
        </div>

        <div style={styles.smartRow}>
          <span style={{ ...styles.smartIcon, background: '#0e1418', color: '#7ab3d4' }}>◷</span>
          <span style={styles.smartName}>Recent</span>
          <span style={styles.smartCount}>7d</span>
        </div>

        {collections.length === 0 && (
          <div style={styles.emptyHint}>
            import a folder to get started
          </div>
        )}
      </div>
    </aside>
  )
}

function CollectionRow({ collection, active, onSelect, onRemove }) {
  const [hovered, setHovered] = React.useState(false)
  const totalImages = collection.folders.reduce((sum, f) => sum + f.imageCount, 0)

  return (
    <div
      style={{
        ...styles.parRow,
        background: active ? 'var(--bg-hover)' : hovered ? '#0f0f0f' : 'transparent',
        borderLeftColor: active ? 'var(--accent)' : 'transparent',
      }}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span style={{ ...styles.chevron, transform: active ? 'rotate(90deg)' : 'none', color: active ? 'var(--text-muted)' : 'var(--border-mid)' }}>›</span>
      <div style={styles.parThumb}>
        <FolderThumb name={collection.name} />
      </div>
      <div style={styles.parInfo}>
        <div style={{ ...styles.parName, color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          {collection.name}
        </div>
        <div style={styles.parMeta}>{collection.folders.length} folders · {totalImages} images</div>
      </div>
    </div>
  )
}

function FolderThumb({ name }) {
  // Generate a colour based on folder name
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" style={{ borderRadius: 3, display: 'block' }}>
      <rect width="24" height="24" fill={`hsl(${hue},25%,10%)`} />
      <rect x="2" y="8" width="20" height="14" rx="2" fill={`hsl(${hue},30%,20%)`} opacity="0.8" />
      <rect x="2" y="6" width="10" height="4" rx="1" fill={`hsl(${hue},35%,25%)`} />
    </svg>
  )
}

const styles = {
  sidebar: {
    width: 200,
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
    fontSize: 8,
    letterSpacing: '0.18em',
    color: 'var(--border-strong)',
    padding: '0 14px 6px',
    textTransform: 'uppercase',
  },
  parRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 0',
    cursor: 'pointer',
    borderLeft: '2px solid transparent',
    transition: 'all 0.1s',
  },
  chevron: {
    fontSize: 8,
    width: 22,
    textAlign: 'center',
    flexShrink: 0,
    transition: 'transform 0.15s, color 0.15s',
  },
  parThumb: {
    width: 24,
    height: 24,
    borderRadius: 3,
    flexShrink: 0,
    overflow: 'hidden',
    marginRight: 8,
  },
  parInfo: { flex: 1, minWidth: 0, paddingRight: 8 },
  parName: {
    fontSize: 11,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    transition: 'color 0.1s',
  },
  parMeta: { fontSize: 9, color: 'var(--border-strong)', marginTop: 1 },
  smartRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 14px',
    cursor: 'pointer',
  },
  smartIcon: {
    width: 18,
    height: 18,
    borderRadius: 3,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 9,
    flexShrink: 0,
  },
  smartName: { fontSize: 10, color: 'var(--text-muted)' },
  smartCount: { fontSize: 9, color: 'var(--border-strong)', marginLeft: 'auto' },
  emptyHint: {
    fontSize: 9,
    color: 'var(--border-strong)',
    padding: '20px 14px',
    lineHeight: 1.8,
    letterSpacing: '0.05em',
  },
}
