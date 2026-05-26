import React, { useState, useEffect, useRef } from 'react'

const SORT_OPTIONS = [
  { value: 'alpha',    label: 'A – Z'           },
  { value: 'recent',   label: 'recently opened' },
  { value: 'favfirst', label: 'favorites first' },
  { value: 'color',    label: 'by color'         },
  { value: 'size',     label: 'by size'          },
  { value: 'custom',   label: 'custom order'     },
]

const GROUP_OPTIONS = [
  { value: 'none',     label: 'no groups'   },
  { value: 'color',    label: 'by color'    },
  { value: 'favorite', label: 'by favorite' },
  { value: 'tag',      label: 'by tag'      },
]

function LabelSelect({ label, value, onChange, options }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button style={styles.lsBtn} onClick={() => setOpen(o => !o)}>
        <span style={styles.lsLabel}>{label}</span>
        <span style={styles.lsArrow}>▾</span>
      </button>
      {open && (
        <div style={styles.lsMenu}>
          {options.map(o => (
            <button
              key={o.value}
              style={{ ...styles.lsItem, ...(value === o.value ? styles.lsItemActive : {}) }}
              onClick={() => { onChange(o.value); setOpen(false) }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ViewHeader({
  breadcrumb,
  canGoBack, canGoForward, onGoBack, onGoForward,
  iconSize, onSetIconSize,
  sortBy, onSetSortBy,
  groupBy, onSetGroupBy,
}) {
  return (
    <div style={styles.header}>
      {/* Back / Forward */}
      <button
        style={{ ...styles.navBtn, opacity: canGoBack ? 1 : 0.25 }}
        onClick={onGoBack}
        disabled={!canGoBack}
        title="back"
      >←</button>
      <button
        style={{ ...styles.navBtn, opacity: canGoForward ? 1 : 0.25 }}
        onClick={onGoForward}
        disabled={!canGoForward}
        title="forward"
      >→</button>

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

      {/* Group By */}
      {onSetGroupBy && (
        <LabelSelect label="Group By" value={groupBy} onChange={onSetGroupBy} options={GROUP_OPTIONS} />
      )}

      {/* Sort By */}
      <LabelSelect label="Sort By" value={sortBy} onChange={onSetSortBy} options={SORT_OPTIONS} />

      {/* Icon size: S M L */}
      <div style={styles.sizeToggle}>
        {['S','M','L'].map((label, i) => {
          const size = ['small','medium','large'][i]
          return (
            <button
              key={size}
              style={{ ...styles.szBtn, ...(iconSize === size ? styles.szActive : {}) }}
              onClick={() => onSetIconSize(size)}
              title={size}
            >{label}</button>
          )
        })}
      </div>
    </div>
  )
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '0 10px',
    borderBottom: '0.5px solid var(--border-subtle)',
    background: 'var(--bg-deep)',
    flexShrink: 0,
    height: 38,
  },
  navBtn: {
    fontSize: 15,
    color: 'var(--text-muted)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 'var(--radius-sm)',
    lineHeight: 1,
    flexShrink: 0,
    transition: 'opacity 0.1s',
  },
  breadcrumb: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 12,
    minWidth: 0,
    overflow: 'hidden',
  },
  seg:     { color: 'var(--text-muted)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 0.1s' },
  sep:     { color: 'var(--border-mid)', fontSize: 10 },
  current: { color: 'var(--text-secondary)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  lsBtn: {
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: 11, color: 'var(--text-muted)',
    background: 'var(--bg-raised)', border: '0.5px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)', padding: '3px 8px',
    cursor: 'pointer', letterSpacing: '0.03em',
    fontFamily: 'var(--font-mono)', width: 94, justifyContent: 'space-between',
    whiteSpace: 'nowrap', overflow: 'hidden',
  },
  lsLabel: { flex: 1, textAlign: 'left', whiteSpace: 'nowrap' },
  lsArrow: { fontSize: 8, opacity: 0.6 },
  lsMenu: {
    position: 'absolute', top: 'calc(100% + 3px)', right: 0,
    background: 'var(--bg-surface)', border: '0.5px solid var(--border-mid)',
    borderRadius: 'var(--radius-sm)', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    zIndex: 200, minWidth: 130, padding: '3px 0',
  },
  lsItem: {
    display: 'block', width: '100%', textAlign: 'left',
    fontSize: 11, color: 'var(--text-muted)',
    background: 'transparent', border: 'none',
    padding: '6px 12px', cursor: 'pointer',
    letterSpacing: '0.03em', fontFamily: 'var(--font-mono)',
    transition: 'background 0.07s',
  },
  lsItemActive: { color: 'var(--accent)', fontWeight: 700 },
  sizeToggle: {
    display: 'flex', gap: 1,
    border: '0.5px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)', padding: 2, flexShrink: 0,
  },
  szBtn: {
    fontSize: 10, padding: '3px 7px', borderRadius: 2,
    cursor: 'pointer', color: 'var(--border-strong)',
    background: 'transparent', border: 'none',
    letterSpacing: '0.04em', transition: 'all 0.1s',
  },
  szActive: { background: 'var(--bg-raised)', color: 'var(--accent)', fontWeight: 700 },
}
