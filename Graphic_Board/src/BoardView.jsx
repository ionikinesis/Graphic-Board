import React, { useState, useEffect, useRef, useCallback } from 'react'
import { dbGet } from './utils/db.js'
import { readBoardFile, writeBoardFile } from './utils/boardFile.js'
import { themes, DEFAULT_THEME, generateCustomTheme } from './utils/themes.js'
import InfiniteCanvas from './components/InfiniteCanvas.jsx'

const IMAGE_RE = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?|svg)$/i
const VIDEO_RE = /\.(mp4|webm|mov|m4v|ogg|ogv|avi|mkv)$/i
const params    = new URLSearchParams(window.location.search)
const FOLDER_PATH = decodeURIComponent(params.get('path') || '')

function applyTheme(key, customColors) {
  const vars = key === 'custom'
    ? generateCustomTheme(customColors?.bg || '#282828', customColors?.accent || '#4a9fd4', customColors?.text || '#e8e8e8')
    : (themes[key] || themes[DEFAULT_THEME]).vars
  Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v))
}

export default function BoardView() {
  const [status, setStatus]           = useState('loading')
  const [rootHandle, setRootHandle]   = useState(null)
  const [dirHandle, setDirHandle]     = useState(null)
  const [images, setImages]           = useState([])
  const [boardData, setBoardData]     = useState(null)
  const pendingHandleRef              = useRef(null)
  const saveTimerRef                  = useRef(null)
  const rootHandleRef                 = useRef(null)
  const boardDataRef                  = useRef(null)

  useEffect(() => { rootHandleRef.current = rootHandle }, [rootHandle])
  useEffect(() => { boardDataRef.current  = boardData  }, [boardData])

  useEffect(() => {
    async function init() {
      const activeId = localStorage.getItem('graphic_board_active_root')
      const idbKey   = activeId ? `root_${activeId}` : null
      const h        = idbKey ? await dbGet('handles', idbKey).catch(() => null) : null
      if (!h) { setStatus('no-root'); return }

      const perm = await h.queryPermission({ mode: 'readwrite' })
      if (perm !== 'granted') {
        pendingHandleRef.current = h
        setStatus('needs-permission')
        return
      }
      await setup(h)
    }
    init()
  }, [])

  async function grantPermission() {
    const h = pendingHandleRef.current
    if (!h) return
    const perm = await h.requestPermission({ mode: 'readwrite' })
    if (perm === 'granted') await setup(h)
  }

  async function setup(h) {
    // Apply theme from localStorage — same source as the main window (useAppSettings)
    try {
      const settings     = JSON.parse(localStorage.getItem('graphic_board_settings')     || '{}')
      const customColors = JSON.parse(localStorage.getItem('graphic_board_custom_colors') || '{}')
      applyTheme(settings.theme || DEFAULT_THEME, customColors)
    } catch {
      applyTheme(DEFAULT_THEME, {})
    }

    // Resolve folder handle by walking the path
    const parts = FOLDER_PATH.split('/').filter(Boolean)
    let dir = h
    for (const part of parts.slice(1)) {
      dir = await dir.getDirectoryHandle(part).catch(() => null)
      if (!dir) { setStatus('not-found'); return }
    }

    // Load image and video handles
    const imgs = []
    for await (const [name, fh] of dir.entries()) {
      if (fh.kind === 'file' && IMAGE_RE.test(name)) {
        imgs.push({ id: name, name, handle: fh, mediaType: 'image' })
      } else if (fh.kind === 'file' && VIDEO_RE.test(name)) {
        imgs.push({ id: name, name, handle: fh, mediaType: 'video' })
      }
    }
    imgs.sort((a, b) => a.name.localeCompare(b.name))

    const bd = await readBoardFile(h)
    document.title = parts[parts.length - 1] || 'board'

    setRootHandle(h)
    setDirHandle(dir)
    setImages(imgs)
    setBoardData(bd)
    setStatus('ready')
  }

  const handleSave = useCallback((items, viewport) => {
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const rh = rootHandleRef.current
      const bd = boardDataRef.current
      if (!rh || !bd) return
      const next = { ...bd, boards: { ...bd.boards, [FOLDER_PATH]: { items, viewport } } }
      boardDataRef.current = next
      setBoardData(next)
      writeBoardFile(rh, next)
    }, 600)
  }, [])

  // Flush on close
  useEffect(() => {
    return () => clearTimeout(saveTimerRef.current)
  }, [])

  if (status === 'loading') return <Screen text="loading…" />
  if (status === 'no-root')  return <Screen text="no root folder — open the main window first" />
  if (status === 'not-found') return <Screen text="folder not found" />
  if (status === 'needs-permission') {
    return (
      <Screen>
        <div style={s.permText}>grant access to your files to open this board</div>
        <button style={s.permBtn} onClick={grantPermission}>grant access</button>
      </Screen>
    )
  }

  const saved = boardData?.boards?.[FOLDER_PATH] ?? null

  return (
    <InfiniteCanvas
      images={images}
      dirHandle={dirHandle}
      savedItems={saved?.items ?? null}
      savedViewport={saved?.viewport ?? null}
      onSave={handleSave}
    />
  )
}

function Screen({ text, children }) {
  return (
    <div style={s.screen}>
      {text && <span style={s.screenText}>{text}</span>}
      {children}
    </div>
  )
}

const s = {
  screen: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    height: '100vh', width: '100vw',
    background: 'var(--bg-base)', gap: 16,
  },
  screenText: { fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.1em' },
  permText:   { fontSize: 13, color: 'var(--text-secondary)', letterSpacing: '0.04em' },
  permBtn: {
    fontSize: 12, padding: '8px 22px',
    background: 'var(--accent)', color: 'var(--accent-text)',
    border: 'none', borderRadius: 4, cursor: 'pointer',
    fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', fontWeight: 700,
  },
}
