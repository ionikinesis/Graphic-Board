import React from 'react'

export default function Topbar({ onOpenSettings, onNavigateHome, loading }) {
  return (
    <header style={s.topbar}>
      <div style={s.logoWrap} onClick={onNavigateHome} title="home">
        <img src="/images/logo.png" alt="refboard" style={s.logoImg} />
        <span style={s.byline}>by Riku Yuki Darroch</span>
      </div>
      <div style={s.right}>
        {loading && <span style={s.loadingLabel}>loading...</span>}
        <button style={s.gearBtn} onClick={onOpenSettings} title="settings">
          ⚙
        </button>
      </div>
    </header>
  )
}

const s = {
  topbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 16px',
    borderBottom: '0.5px solid var(--border-subtle)',
    background: 'var(--bg-deep)',
    flexShrink: 0,
    height: 72,
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    opacity: 0.9,
    transition: 'opacity 0.1s',
  },
  logoImg: {
    height: 78,
    display: 'block',
    userSelect: 'none',
    filter: 'var(--logo-filter)',
    transition: 'filter 0.2s',
  },
  byline: {
    fontSize: 9,
    color: 'var(--text-muted)',
    letterSpacing: '0.08em',
    fontFamily: 'var(--font-mono)',
    whiteSpace: 'nowrap',
    opacity: 0.55,
    userSelect: 'none',
    marginLeft: 4,
  },
  right: { display: 'flex', gap: 8, alignItems: 'center' },
  loadingLabel: {
    fontSize: 9,
    color: 'var(--text-muted)',
    letterSpacing: '0.1em',
    fontFamily: 'var(--font-mono)',
  },
  gearBtn: {
    fontSize: 14,
    color: 'var(--text-muted)',
    background: 'transparent',
    border: '0.5px solid var(--border-mid)',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 7px',
    cursor: 'pointer',
    transition: 'color 0.1s, border-color 0.1s',
    lineHeight: 1,
  },
}
