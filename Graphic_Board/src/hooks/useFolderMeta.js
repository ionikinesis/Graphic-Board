import { useState, useEffect, useCallback } from 'react'
import { dbGet, dbSet, dbDelete } from '../utils/db.js'

export function useFolderMeta(config, updateConfig) {
  const [colors,    setColors]    = useState({})
  const [recent,    setRecent]    = useState({})
  const [favs,      setFavs]      = useState(() => new Set())
  const [tags,      setTags]      = useState({})
  const [tagColors, setTagColors] = useState({})
  const [links,     setLinks]     = useState({})
  const [folderOrd,  setFolderOrd]  = useState({})
  const [imageOrd,   setImageOrd]   = useState({})
  const [sortNames,  setSortNames]  = useState({})

  // Hydrate all state from config once loaded
  useEffect(() => {
    if (!config) return
    setColors(config.folderColors ?? {})
    setRecent(config.recent       ?? {})
    setFavs(new Set(config.folderFavs ?? []))
    setTags(config.itemTags       ?? {})
    setTagColors(config.tagColors ?? {})
    setLinks(config.itemLinks     ?? {})
    setFolderOrd(config.folderOrder   ?? {})
    setImageOrd(config.imageOrder     ?? {})
    setSortNames(config.sortNames     ?? {})
  }, [config])

  // ── folder color ─────────────────────────────────────────────────────────
  const setFolderColor = useCallback((pathKey, hex) => {
    setColors(prev => {
      const next = { ...prev }
      if (hex) next[pathKey] = hex
      else delete next[pathKey]
      updateConfig({ folderColors: next })
      return next
    })
  }, [updateConfig])

  const getFolderColor = useCallback((pathKey) => colors[pathKey] ?? null, [colors])

  // ── recently opened ───────────────────────────────────────────────────────
  const touchFolder = useCallback((pathKey) => {
    setRecent(prev => {
      const next = { ...prev, [pathKey]: Date.now() }
      updateConfig({ recent: next })
      return next
    })
  }, [updateConfig])

  const getFolderRecent = useCallback((pathKey) => recent[pathKey] ?? 0, [recent])

  // ── folder favorites ──────────────────────────────────────────────────────
  const toggleFolderFav = useCallback((pathKey) => {
    setFavs(prev => {
      const next = new Set(prev)
      if (next.has(pathKey)) next.delete(pathKey)
      else next.add(pathKey)
      updateConfig({ folderFavs: [...next] })
      return next
    })
  }, [updateConfig])

  const isFolderFav = useCallback((pathKey) => favs.has(pathKey), [favs])

  // ── custom thumbnails (IDB — stays out of JSON) ───────────────────────────
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
      updateConfig({ itemTags: next })
      return next
    })
  }, [updateConfig])

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
      updateConfig({ tagColors: next })
      return next
    })
  }, [updateConfig])

  const getTagColor = useCallback((tagName) => tagColors[tagName] ?? null, [tagColors])

  const createTag = useCallback((name, color) => {
    const trimmed = name.trim().toLowerCase()
    if (!trimmed || !color) return
    setTagColors(prev => {
      const next = { ...prev, [trimmed]: color }
      updateConfig({ tagColors: next })
      return next
    })
  }, [updateConfig])

  // ── item links ────────────────────────────────────────────────────────────
  const setItemLink = useCallback((pathKey, linkData) => {
    setLinks(prev => {
      const next = { ...prev }
      if (linkData) next[pathKey] = linkData
      else delete next[pathKey]
      updateConfig({ itemLinks: next })
      return next
    })
  }, [updateConfig])

  const getItemLink = useCallback((pathKey) => links[pathKey] ?? null, [links])

  // ── custom sort order ─────────────────────────────────────────────────────
  const setFolderOrder = useCallback((parentPath, names) => {
    setFolderOrd(prev => {
      const next = { ...prev, [parentPath]: names }
      updateConfig({ folderOrder: next })
      return next
    })
  }, [updateConfig])

  const getFolderOrder = useCallback((parentPath) => folderOrd[parentPath] ?? [], [folderOrd])

  const setImageOrder = useCallback((folderPath, names) => {
    setImageOrd(prev => {
      const next = { ...prev, [folderPath]: names }
      updateConfig({ imageOrder: next })
      return next
    })
  }, [updateConfig])

  const getImageOrder = useCallback((folderPath) => imageOrd[folderPath] ?? [], [imageOrd])

  // ── sort name alias ───────────────────────────────────────────────────────
  const getSortName = useCallback((pathKey) => sortNames[pathKey] ?? null, [sortNames])

  const setSortName = useCallback((pathKey, name) => {
    setSortNames(prev => {
      const next = { ...prev }
      if (name) next[pathKey] = name
      else delete next[pathKey]
      updateConfig({ sortNames: next })
      return next
    })
  }, [updateConfig])

  // ── tag operations ────────────────────────────────────────────────────────
  const renameTag = useCallback((oldName, newName) => {
    const trimmed = newName.trim().toLowerCase()
    if (!trimmed || trimmed === oldName) return
    setTags(prev => {
      const next = {}
      Object.entries(prev).forEach(([pk, list]) => {
        next[pk] = [...new Set(list.map(t => t === oldName ? trimmed : t))]
      })
      updateConfig({ itemTags: next })
      return next
    })
    setTagColors(prev => {
      if (prev[oldName] === undefined) return prev
      const next = { ...prev }
      next[trimmed] = next[oldName]
      delete next[oldName]
      updateConfig({ tagColors: next })
      return next
    })
  }, [updateConfig])

  const mergeTag = useCallback((fromName, intoName) => {
    setTags(prev => {
      const next = {}
      Object.entries(prev).forEach(([pk, list]) => {
        next[pk] = [...new Set(list.map(t => t === fromName ? intoName : t))]
      })
      updateConfig({ itemTags: next })
      return next
    })
    setTagColors(prev => {
      const next = { ...prev }
      delete next[fromName]
      updateConfig({ tagColors: next })
      return next
    })
  }, [updateConfig])

  const deleteTag = useCallback((tagName) => {
    setTags(prev => {
      const next = {}
      Object.entries(prev).forEach(([pk, list]) => {
        const updated = list.filter(t => t !== tagName)
        if (updated.length > 0) next[pk] = updated
      })
      updateConfig({ itemTags: next })
      return next
    })
    setTagColors(prev => {
      const next = { ...prev }
      delete next[tagName]
      updateConfig({ tagColors: next })
      return next
    })
  }, [updateConfig])

  return {
    getFolderColor, setFolderColor,
    touchFolder, getFolderRecent,
    toggleFolderFav, isFolderFav,
    setCustomThumb, getCustomThumb,
    setItemTags, getItemTags, getAllTags, getTagStats,
    setTagColor, getTagColor, createTag,
    renameTag, mergeTag, deleteTag,
    setItemLink, getItemLink,
    setFolderOrder, getFolderOrder,
    setImageOrder, getImageOrder,
    getSortName, setSortName,
  }
}
