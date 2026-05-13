import React from 'react'

export default function ViewHeader({ breadcrumb, viewMode, onSetViewMode, itemCount }) {
  return (
    <div style={styles.header}>
      {/* Breadcrumb */}
      <div style={styles.breadcrumb}>
        {breadcrumb.map((seg, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span style={styles.sep}>›</span>}
            {seg.onClick ? (
              <span style={styles.seg} onClick={seg.onClick}>{seg.label}</span>
            ) : (
              <span style={styles.current}>{seg.label}</span>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Count */}
      {itemCount != null && (
        <span style={styles.count}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
      )}

      {/* View toggle */}
      <div style={styles.viewToggle}>
        <button
          style={{ ...styles.vbtn, ...(viewMode === 'normal' ? styles.vbtnActive : {}) }}
          onClick={() => onSetViewMode('normal')}
        >
          grid
        </button>
        <button
          style={{ ...styles.vbtn, ...(viewMode === 'large' ? styles.vbtnActive : {}) }}
          onClick={() => onSetViewMode('large')}
        >
          large
        </button>
      </div>
    </div>
  )
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 14px',
    borderBottom: '0.5px solid var(--border-subtle)',
    background: 'var(--bg-deep)',
    flexShrink: 0,
    height: 38,
  },
  breadcrumb: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 10,
    minWidth: 0,
    overflow: 'hidden',
  },
  seg: {
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'color 0.1s',
    whiteSpace: 'nowrap',
  },
  sep: { color: 'var(--border-mid)', fontSize: 8 },
  current: {
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  count: {
    fontSize: 9,
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
    flexShrink: 0,
  },
  viewToggle: {
    display: 'flex',
    gap: 2,
    border: '0.5px solid var(--border-subtle)',
    borderRadius: 4,
    padding: 2,
    flexShrink: 0,
  },
  vbtn: {
    fontSize: 9,
    padding: '3px 7px',
    borderRadius: 3,
    cursor: 'pointer',
    color: 'var(--border-strong)',
    background: 'transparent',
    border: 'none',
    letterSpacing: '0.04em',
    transition: 'all 0.1s',
  },
  vbtnActive: {
    background: 'var(--bg-raised)',
    color: 'var(--accent)',
  },
}
