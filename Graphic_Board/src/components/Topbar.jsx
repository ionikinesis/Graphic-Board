import React from 'react'

const s = {
  topbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    borderBottom: '0.5px solid var(--border-subtle)',
    background: 'var(--bg-deep)',
    flexShrink: 0,
    height: 44,
  },
  logo: {
    fontFamily: 'var(--font-serif)',
    fontSize: 15,
    fontWeight: 400,
    color: 'var(--text-primary)',
    letterSpacing: '0.02em',
  },
  accent: { color: 'var(--accent)' },
  right: { display: 'flex', gap: 8, alignItems: 'center' },
  importBtn: {
    fontSize: 10,
    padding: '5px 12px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: 'var(--accent)',
    color: '#0e0e0e',
    fontWeight: 500,
    letterSpacing: '0.04em',
    transition: 'opacity 0.12s',
  },
}

export default function Topbar({ onImport, loading }) {
  return (
    <header style={s.topbar}>
      <div style={s.logo}>
        ref<span style={s.accent}>board</span>
      </div>
      <div style={s.right}>
        <button
          style={{ ...s.importBtn, opacity: loading ? 0.5 : 1 }}
          onClick={onImport}
          disabled={loading}
        >
          {loading ? 'importing...' : '+ import folder'}
        </button>
      </div>
    </header>
  )
}
