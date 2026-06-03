import { useState, useEffect } from 'react'
import { dbGet, dbSet, dbDelete } from '../utils/db.js'

const STORE      = 'handles'
const OLD_KEY    = 'root'
const META_KEY   = 'graphic_board_roots'
const ACTIVE_KEY = 'graphic_board_active_root'

function migrateOldKeys() {
  if (localStorage.getItem(META_KEY) !== null) return
  const oldMeta   = localStorage.getItem('refboard_roots')
  const oldActive = localStorage.getItem('refboard_active_root')
  if (oldMeta)   localStorage.setItem(META_KEY, oldMeta)
  if (oldActive) localStorage.setItem(ACTIVE_KEY, oldActive)
}

function loadMeta() {
  migrateOldKeys()
  try { return JSON.parse(localStorage.getItem(META_KEY)) ?? [] } catch { return [] }
}

function saveMeta(list) {
  localStorage.setItem(META_KEY, JSON.stringify(list))
}

export function useRootDirectory() {
  const [roots,        setRoots]        = useState([])
  // each root: { id, name, absPath, handle, status: 'ready'|'needs-permission'|'missing' }
  const [activeRootId, setActiveRootId] = useState(null)
  const [booting,      setBooting]      = useState(true)

  useEffect(() => {
    async function init() {
      let meta = loadMeta()

      // Migrate old single-root IDB entry to new multi-root format
      if (meta.length === 0) {
        const oldHandle = await dbGet(STORE, OLD_KEY).catch(() => null)
        if (oldHandle) {
          const id = Date.now().toString()
          meta = [{ id, name: oldHandle.name }]
          saveMeta(meta)
          await dbSet(STORE, `root_${id}`, oldHandle)
          await dbDelete(STORE, OLD_KEY).catch(() => {})
          localStorage.setItem(ACTIVE_KEY, id)
        }
      }

      if (meta.length === 0) {
        setBooting(false)
        return
      }

      const savedActive = localStorage.getItem(ACTIVE_KEY)
      const loaded = await Promise.all(meta.map(async ({ id, name, color, absPath }) => {
        try {
          const handle = await dbGet(STORE, `root_${id}`)
          if (!handle) return { id, name, color, absPath: absPath ?? null, handle: null, status: 'missing' }
          const perm = await handle.queryPermission({ mode: 'readwrite' })
          return { id, name, color, absPath: absPath ?? null, handle, status: perm === 'granted' ? 'ready' : 'needs-permission' }
        } catch {
          return { id, name, color, absPath: absPath ?? null, handle: null, status: 'missing' }
        }
      }))

      setRoots(loaded)

      const validActive = loaded.find(r => r.id === savedActive && r.status !== 'missing')
      const firstValid  = loaded.find(r => r.status !== 'missing')
      const active      = validActive ?? firstValid ?? null
      const activeId    = active?.id ?? null
      setActiveRootId(activeId)
      if (activeId) localStorage.setItem(ACTIVE_KEY, activeId)

      setBooting(false)
    }

    init()
  }, [])

  async function addRoot() {
    if (!window.showDirectoryPicker) return false

    // In Tauri: capture the absolute path via the native dialog first.
    // This is a two-dialog flow until the app is fully ported to Tauri FS.
    let absPath = null
    if (window.__TAURI__) {
      try {
        const p = await window.__TAURI__.dialog?.open?.({ directory: true, multiple: false })
        if (typeof p === 'string') absPath = p
        else return false // user cancelled Tauri dialog
      } catch {}
    }

    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
      const id     = Date.now().toString()
      const name   = handle.name
      await dbSet(STORE, `root_${id}`, handle)
      const meta = loadMeta()
      meta.push({ id, name, ...(absPath && { absPath }) })
      saveMeta(meta)
      const newRoot = { id, name, absPath, handle, status: 'ready' }
      setRoots(prev => [...prev, newRoot])
      setActiveRootId(id)
      localStorage.setItem(ACTIVE_KEY, id)
      return true
    } catch (err) {
      if (err.name !== 'AbortError') throw err
      return false
    }
  }

  function setRootAbsPath(id, path) {
    const trimmed = path?.trim() || null
    const meta = loadMeta().map(m => m.id === id ? { ...m, ...(trimmed ? { absPath: trimmed } : { absPath: undefined }) } : m)
    saveMeta(meta)
    setRoots(prev => prev.map(r => r.id === id ? { ...r, absPath: trimmed } : r))
  }

  function switchRoot(id) {
    setActiveRootId(id)
    localStorage.setItem(ACTIVE_KEY, id)
  }

  async function removeRoot(id) {
    await dbDelete(STORE, `root_${id}`).catch(() => {})
    const meta = loadMeta().filter(m => m.id !== id)
    saveMeta(meta)
    setRoots(prev => {
      const next = prev.filter(r => r.id !== id)
      // If removing active root, auto-switch to another available one
      if (id === activeRootId) {
        const newActive = next.find(r => r.status !== 'missing')?.id ?? null
        setActiveRootId(newActive)
        localStorage.setItem(ACTIVE_KEY, newActive ?? '')
      }
      return next
    })
  }

  function setRootColor(id, hex) {
    const meta = loadMeta().map(m => m.id === id ? { ...m, color: hex || undefined } : m)
    saveMeta(meta)
    setRoots(prev => prev.map(r => r.id === id ? { ...r, color: hex || undefined } : r))
  }

  async function grantPermission() {
    const active = roots.find(r => r.id === activeRootId)
    if (!active?.handle) return false
    const perm = await active.handle.requestPermission({ mode: 'readwrite' })
    if (perm === 'granted') {
      setRoots(prev => prev.map(r => r.id === activeRootId ? { ...r, status: 'ready' } : r))
      return true
    }
    return false
  }

  // ── derived values ────────────────────────────────────────────────────────
  const activeRoot = roots.find(r => r.id === activeRootId) ?? null

  let status
  if (booting) {
    status = 'loading'
  } else if (!activeRoot || activeRoot.status === 'missing') {
    status = roots.some(r => r.status !== 'missing') ? 'none' : 'none'
  } else if (activeRoot.status === 'needs-permission') {
    status = 'needs-permission'
  } else {
    status = 'ready'
  }

  const rootHandle = status === 'ready' ? activeRoot.handle : null
  const rootName   = activeRoot?.name ?? null

  return {
    // Legacy single-root API (backwards compat — used by App, SetupScreen)
    rootHandle,
    rootName,
    rootAbsPath: activeRoot?.absPath ?? null,
    status,
    chooseRoot:      addRoot,
    grantPermission,
    clearRoot:       () => activeRootId && removeRoot(activeRootId),
    // Multi-root API (used by SettingsModal)
    roots,
    activeRootId,
    addRoot,
    removeRoot,
    switchRoot,
    setRootColor,
    setRootAbsPath,
  }
}
