import { useState, useEffect } from 'react'
import { dbGet, dbSet, dbDelete } from '../utils/db.js'

const STORE   = 'handles'
const ROOT_KEY = 'root'

export function useRootDirectory() {
  const [handle, setHandle] = useState(null)
  const [status, setStatus] = useState('loading') // 'loading' | 'none' | 'needs-permission' | 'ready'

  useEffect(() => {
    dbGet(STORE, ROOT_KEY)
      .then(async h => {
        if (!h) { setStatus('none'); return }
        const perm = await h.queryPermission({ mode: 'read' })
        setHandle(h)
        setStatus(perm === 'granted' ? 'ready' : 'needs-permission')
      })
      .catch(() => setStatus('none'))
  }, [])

  async function chooseRoot() {
    if (!window.showDirectoryPicker) return false
    try {
      const h = await window.showDirectoryPicker({ mode: 'read' })
      await dbSet(STORE, ROOT_KEY, h)
      setHandle(h)
      setStatus('ready')
      return true
    } catch (err) {
      if (err.name !== 'AbortError') throw err
      return false
    }
  }

  async function grantPermission() {
    if (!handle) return false
    const perm = await handle.requestPermission({ mode: 'read' })
    if (perm === 'granted') { setStatus('ready'); return true }
    return false
  }

  async function clearRoot() {
    await dbDelete(STORE, ROOT_KEY)
    setHandle(null)
    setStatus('none')
  }

  return {
    rootHandle: status === 'ready' ? handle : null,
    rootName: handle?.name ?? null,
    status,
    chooseRoot,
    grantPermission,
    clearRoot,
  }
}
