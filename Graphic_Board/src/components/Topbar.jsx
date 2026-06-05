import React, { useState } from 'react'
import logo from '../../images/logo.png'

async function tauriCmd(method) {
  if (!window.__TAURI__) return
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow()[method]()
  } catch (e) {
    console.error('[tauriCmd]', method, e)
  }
}

async function tauriToggleMaximize() {
  if (!window.__TAURI__) return
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const win = getCurrentWindow()
    const maximized = await win.isMaximized()
    if (maximized) await win.unmaximize()
    else           await win.maximize()
  } catch (e) {
    console.error('[tauriToggleMaximize]', e)
  }
}

export default function Topbar({ onOpenSettings, onOpenHelp, onNavigateHome, loading }) {
  return (
    <header style={s.topbar}>
      <div style={s.logoWrap} onClick={onNavigateHome} title="home">
        <img src={logo} alt="Graphic Board" style={s.logoImg} />
        <span style={s.byline}>by Riku Yuki Darroch</span>
      </div>
      <div style={s.right}>
        {loading && <span style={s.loadingLabel}>loading...</span>}
        {onOpenHelp     && <button style={s.helpBtn} onClick={onOpenHelp}     title="help">?</button>}
        {onOpenSettings && <button style={s.gearBtn} onClick={onOpenSettings} title="settings">⚙</button>}
        <div style={s.winControls}>
          <WinBtn title="minimize" onClick={() => tauriCmd('minimize')}>─</WinBtn>
          <WinBtn title="maximize" onClick={tauriToggleMaximize}>□</WinBtn>
          <WinBtn title="close"    onClick={() => tauriCmd('close')} close>✕</WinBtn>
        </div>
      </div>
    </header>
  )
}

function WinBtn({ children, onClick, title, close }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      title={title}
      style={{
        ...s.winBtn,
        ...(hovered && !close && { background: 'var(--bg-raised)', color: 'var(--text-primary)' }),
        ...(hovered &&  close && { background: 'rgba(180,40,40,0.22)', color: '#e05050', borderColor: 'rgba(180,40,40,0.35)' }),
      }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </button>
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
    height: 46,
    WebkitAppRegion: 'drag',
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    opacity: 0.9,
    transition: 'opacity 0.1s',
    WebkitAppRegion: 'no-drag',
  },
  logoImg: {
    height: 39,
    display: 'block',
    userSelect: 'none',
    filter: 'var(--logo-filter)',
    transition: 'filter 0.2s',
  },
  byline: {
    fontSize: 'var(--fs-9)',
    color: 'var(--text-muted)',
    letterSpacing: '0.08em',
    fontFamily: 'var(--font-mono)',
    whiteSpace: 'nowrap',
    opacity: 0.55,
    userSelect: 'none',
    marginLeft: 4,
  },
  right: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    WebkitAppRegion: 'no-drag',
  },
  loadingLabel: {
    fontSize: 'var(--fs-9)',
    color: 'var(--text-muted)',
    letterSpacing: '0.1em',
    fontFamily: 'var(--font-mono)',
  },
  helpBtn: {
    width: 26,
    height: 26,
    borderRadius: '50%',
    background: 'transparent',
    border: '1.5px solid var(--accent)',
    color: 'var(--accent)',
    fontSize: 'var(--fs-13)',
    fontWeight: 700,
    fontFamily: 'var(--font-mono)',
    cursor: 'pointer',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.12s, color 0.12s',
    letterSpacing: 0,
  },
  gearBtn: {
    fontSize: 'var(--fs-14)',
    color: 'var(--text-muted)',
    background: 'transparent',
    border: '0.5px solid var(--border-mid)',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 7px',
    cursor: 'pointer',
    transition: 'color 0.1s, border-color 0.1s',
    lineHeight: 1,
  },
  winControls: {
    display: 'flex',
    gap: 2,
    marginLeft: 6,
    paddingLeft: 10,
    borderLeft: '0.5px solid var(--border-subtle)',
  },
  winBtn: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'transparent',
    border: '0.5px solid transparent',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)',
    fontSize: 'var(--fs-11)',
    cursor: 'pointer',
    transition: 'background 0.1s, color 0.1s, border-color 0.1s',
    lineHeight: 1,
    fontFamily: 'var(--font-mono)',
    flexShrink: 0,
    WebkitAppRegion: 'no-drag',
  },
}
