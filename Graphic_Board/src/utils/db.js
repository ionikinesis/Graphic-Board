// Shared IndexedDB for Graphic Board
// v1: 'handles' store (root directory handle)
// v2: 'custom_thumbs' store (custom thumbnail FileSystemFileHandles keyed by path)

const DB_NAME = 'refboard'  // keep stable — renaming would wipe stored handles
const DB_VERSION = 2

let _db = null

function openDB() {
  if (_db) return Promise.resolve(_db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = e => {
      const db = e.target.result
      if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles')
      if (!db.objectStoreNames.contains('custom_thumbs')) db.createObjectStore('custom_thumbs')
    }
    req.onsuccess = e => { _db = e.target.result; resolve(_db) }
    req.onerror = () => reject(req.error)
  })
}

export async function dbGet(store, key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = db.transaction(store, 'readonly').objectStore(store).get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => reject(req.error)
  })
}

export async function dbSet(store, key, value) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).put(value, key)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}

export async function dbDelete(store, key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite')
    tx.objectStore(store).delete(key)
    tx.oncomplete = resolve
    tx.onerror = () => reject(tx.error)
  })
}
