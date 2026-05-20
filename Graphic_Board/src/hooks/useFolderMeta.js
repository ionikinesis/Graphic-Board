import { useState, useCallback } from 'react'
import { dbGet, dbSet, dbDelete } from '../utils/db.js'

const COLORS_KEY   = 'refboard_folder_colors'
const RECENT_KEY   = 'refboard_recent'
const FAVS_KEY     = 'refboard_folder_favs'
const TAGS_KEY     = 'refboard_item_tags'
const TAG_COLS_KEY = 'refboard_tag_colors'

function loadLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

export function useFolderMeta() {
  const [colors,    setColors]    = useState(() => loadLS(COLORS_KEY, {}))
  const [recent,    setRecent]    = useState(() => loadLS(RECENT_KEY, {}))
  const [favs,      setFavs]      = useState(() => new Set(loadLS(FAVS_KEY, [])))
  const [tags,      setTags]      = useState(() => loadLS(TAGS_KEY, {}))
  const [tagColors, setTagColors] = useState(() => loadLS(TAG_COLS_KEY, {}))

  // ── folder color ─────────────────────────────────────────────────────────
  const setFolderColor = useCallback((pathKey, hex) => {
    setColors(prev => {
      const next = { ...prev }
      if (hex) next[pathKey] = hex
      else delete next[pathKey]
      localStorage.setItem(COLORS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const getFolderColor = useCallback((pathKey) => colors[pathKey] ?? null, [colors])

  // ── recently opened ───────────────────────────────────────────────────────
  const touchFolder = useCallback((pathKey) => {
    setRecent(prev => {
      const next = { ...prev, [pathKey]: Date.now() }
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const getFolderRecent = useCallback((pathKey) => recent[pathKey] ?? 0, [recent])

  // ── folder favorites ──────────────────────────────────────────────────────
  const toggleFolderFav = useCallback((pathKey) => {
    setFavs(prev => {
      const next = new Set(prev)
      if (next.has(pathKey)) next.delete(pathKey)
      else next.add(pathKey)
      localStorage.setItem(FAVS_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])

  const isFolderFav = useCallback((pathKey) => favs.has(pathKey), [favs])

  // ── custom thumbnails (IDB) ───────────────────────────────────────────────
  const setCustomThumb = useCallback(async (pathKey, fileHandle) => {
    if (fileHandle) await dbSet('custom_thumbs', pathKey, fileHandle)
    else await dbDelete('custom_thumbs', pathKey)
  }, [])

  const getCustomThumb = useCallback(async (pathKey) => {
    return dbGet('custom_thumbs', pathKey)
  }, [])

  // ── item tags ─────────────────────────────────────────────────────────────
  const setItemTags = useCallback((pathKey, tagList) => {
    setTags(prev => {
      const next = { ...prev }
      if (tagList && tagList.length > 0) next[pathKey] = tagList
      else delete next[pathKey]
      localStorage.setItem(TAGS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const getItemTags = useCallback((pathKey) => tags[pathKey] ?? [], [tags])

  const getAllTags = useCallback(() => {
    const all = new Set()
    Object.values(tags).forEach(list => list.forEach(t => all.add(t)))
    Object.keys(tagColors).forEach(t => all.add(t))
    return [...all].sort()
  }, [tags, tagColors])

  const getTagStats = useCallback(() => {
    const counts = {}
    Object.values(tags).forEach(list => list.forEach(t => {
      counts[t] = (counts[t] || 0) + 1
    }))
    return counts
  }, [tags])

  // ── tag colors ────────────────────────────────────────────────────────────
  const setTagColor = useCallback((tagName, hex) => {
    setTagColors(prev => {
      const next = { ...prev }
      if (hex) next[tagName] = hex
      else delete next[tagName]
      localStorage.setItem(TAG_COLS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const getTagColor = useCallback((tagName) => tagColors[tagName] ?? null, [tagColors])

  // registers a tag with an optional color without assigning it to any item
  const createTag = useCallback((name, color) => {
    const trimmed = name.trim().toLowerCase()
    if (!trimmed || !color) return
    setTagColors(prev => {
      const next = { ...prev, [trimmed]: color }
      localStorage.setItem(TAG_COLS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  // ── tag operations ────────────────────────────────────────────────────────
  const renameTag = useCallback((oldName, newName) => {
    const trimmed = newName.trim().toLowerCase()
    if (!trimmed || trimmed === oldName) return
    setTags(prev => {
      const next = {}
      Object.entries(prev).forEach(([pk, list]) => {
        next[pk] = [...new Set(list.map(t => t === oldName ? trimmed : t))]
      })
      localStorage.setItem(TAGS_KEY, JSON.stringify(next))
      return next
    })
    setTagColors(prev => {
      if (prev[oldName] === undefined) return prev
      const next = { ...prev }
      next[trimmed] = next[oldName]
      delete next[oldName]
      localStorage.setItem(TAG_COLS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const mergeTag = useCallback((fromName, intoName) => {
    setTags(prev => {
      const next = {}
      Object.entries(prev).forEach(([pk, list]) => {
        next[pk] = [...new Set(list.map(t => t === fromName ? intoName : t))]
      })
      localStorage.setItem(TAGS_KEY, JSON.stringify(next))
      return next
    })
    setTagColors(prev => {
      const next = { ...prev }
      delete next[fromName]
      localStorage.setItem(TAG_COLS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const deleteTag = useCallback((tagName) => {
    setTags(prev => {
      const next = {}
      Object.entries(prev).forEach(([pk, list]) => {
        const updated = list.filter(t => t !== tagName)
        if (updated.length > 0) next[pk] = updated
      })
      localStorage.setItem(TAGS_KEY, JSON.stringify(next))
      return next
    })
    setTagColors(prev => {
      const next = { ...prev }
      delete next[tagName]
      localStorage.setItem(TAG_COLS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return {
    getFolderColor, setFolderColor,
    touchFolder, getFolderRecent,
    toggleFolderFav, isFolderFav,
    setCustomThumb, getCustomThumb,
    setItemTags, getItemTags, getAllTags, getTagStats,
    setTagColor, getTagColor, createTag,
    renameTag, mergeTag, deleteTag,
  }
}
