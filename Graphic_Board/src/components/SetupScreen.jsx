import React from 'react'

export default function SetupScreen({ status, rootName, onChoose, onGrant }) {
  const needsPermission = status === 'needs-permission'

  return (
    <div style={s.wrap}>
      <div style={s.inner}>
        <img src="/images/logo.png" alt="refboard" style={s.logo} />

        {needsPermission ? (
          <>
            <p style={s.sub}>grant access to continue</p>
            <div style={s.divider} />
            <p style={s.body}>
              your library is set to{' '}
              <span style={s.folderName}>"{rootName}"</span>.<br />
              click below to allow access for this session.
            </p>
            <button style={s.primaryBtn} onClick={onGrant}>
              grant access
            </button>
            <button style={s.secondaryBtn} onClick={onChoose}>
              choose different folder
            </button>
          </>
        ) : (
          <>
            <p style={s.sub}>a reference image manager for digital artists</p>
            <div style={s.divider} />
            <p style={s.body}>
              choose your library folder to get started.<br />
              subfolders become collections — no copying or uploading.
            </p>
            <button style={s.primaryBtn} onClick={onChoose}>
              browse for folder
            </button>
            <p style={s.hint}>works with chrome and edge · uses the file system access api · nothing is uploaded</p>
          </>
        )}
      </div>
    </div>
  )
}

const s = {
  wrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-base)',
    height: '100%',
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
    height: 156,
    display: 'block',
    userSelect: 'none',
    filter: 'var(--logo-filter)',
    transition: 'filter 0.2s',
  },
  sub: {
    fontSize: 13,
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
    fontSize: 13,
    color: 'var(--text-muted)',
    lineHeight: 1.9,
    letterSpacing: '0.03em',
  },
  folderName: {
    color: 'var(--accent)',
  },
  primaryBtn: {
    marginTop: 8,
    fontSize: 13,
    padding: '9px 22px',
    borderRadius: 'var(--radius-md)',
    border: 'none',
    background: 'var(--accent)',
    color: 'var(--accent-text)',
    fontWeight: 700,
    letterSpacing: '0.05em',
    cursor: 'pointer',
    transition: 'opacity 0.12s',
    fontFamily: 'var(--font-mono)',
  },
  secondaryBtn: {
    fontSize: 12,
    padding: '7px 16px',
    borderRadius: 'var(--radius-md)',
    border: '0.5px solid var(--border-mid)',
    background: 'transparent',
    color: 'var(--text-muted)',
    letterSpacing: '0.04em',
    cursor: 'pointer',
    transition: 'all 0.12s',
    fontFamily: 'var(--font-mono)',
  },
  hint: {
    fontSize: 11,
    color: 'var(--border-strong)',
    letterSpacing: '0.06em',
    lineHeight: 1.7,
  },
}
