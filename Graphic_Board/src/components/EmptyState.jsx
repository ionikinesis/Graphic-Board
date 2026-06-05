import React from 'react'
import logo from '../../images/logo.png'

export default function EmptyState({ onImport }) {
  return (
    <div style={styles.wrap}>
      <div style={styles.inner}>
        <img src={logo} alt="Graphic Board" style={styles.logo} />
        <p style={styles.sub}>a reference image manager for digital artists</p>
        <div style={styles.divider} />
        <p style={styles.body}>
          import a folder from your file system to get started.<br />
          your existing folder structure is used as-is — no copying or moving.
        </p>
        <button style={styles.btn} onClick={onImport}>
          + import folder
        </button>
        <p style={styles.hint}>works with chrome and edge · uses the file system access api · nothing is uploaded</p>
      </div>
    </div>
  )
}

const styles = {
  wrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-base)',
  },
  inner: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    maxWidth: 340,
    textAlign: 'center',
  },
  logo: {
    height: 52,
    display: 'block',
    userSelect: 'none',
  },
  sub: {
    fontSize: 11,
    color: 'var(--text-muted)',
    letterSpacing: '0.06em',
  },
  divider: {
    width: 40,
    height: '0.5px',
    background: 'var(--border-mid)',
    margin: '4px 0',
  },
  body: {
    fontSize: 11,
    color: 'var(--text-muted)',
    lineHeight: 1.9,
    letterSpacing: '0.03em',
  },
  btn: {
    marginTop: 8,
    fontSize: 11,
    padding: '8px 20px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: 'var(--accent)',
    color: '#0e0e0e',
    fontWeight: 500,
    letterSpacing: '0.05em',
    cursor: 'pointer',
    transition: 'opacity 0.12s',
  },
  hint: {
    fontSize: 9,
    color: 'var(--border-strong)',
    letterSpacing: '0.06em',
    lineHeight: 1.7,
  },
}
