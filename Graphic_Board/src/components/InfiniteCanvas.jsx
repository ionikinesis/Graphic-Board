import React, { useState, useEffect, useRef, useCallback } from 'react'
import { writeFilesToDir, getImageFiles, readClipboardImages } from '../utils/fileImport.js'

const GAP     = 14
const MIN_W   = 60
const ROW_H   = 240
const MAX_ROW = 1300
const VIDEO_RE = /\.(mp4|webm|mov|m4v|ogg|ogv|avi|mkv)$/i

// ── auto-layout ──────────────────────────────────────────────────────────────
function autoLayout(images, aspects, startY = GAP) {
  if (images.length === 0) return []
  const items = []
  let x = GAP, y = startY, rowW = 0

  images.forEach((img) => {
    const aspect = aspects[img.name] || 1
    const w = Math.round(ROW_H * aspect)
    const h = ROW_H

    if (rowW > 0 && rowW + w + GAP > MAX_ROW) {
      x = GAP; y += h + GAP; rowW = 0
    }

    items.push({ id: img.id, type: img.mediaType === 'video' ? 'video' : 'image', x, y, w, h, name: img.name })
    x += w + GAP; rowW += w + GAP
  })
  return items
}

// ── main component ────────────────────────────────────────────────────────────
export default function InfiniteCanvas({ images, dirHandle, savedItems, savedViewport, onSave }) {
  const [pan,         setPan]         = useState(savedViewport ? { x: savedViewport.x, y: savedViewport.y } : { x: 40, y: 40 })
  const [zoom,        setZoom]        = useState(savedViewport?.zoom ?? 1)
  const [items,       setItems]       = useState(null)
  const [imageUrls,   setImageUrls]   = useState({})
  const [selected,    setSelected]    = useState(() => new Set())
  const [editingText, setEditingText] = useState(null)
  const [marquee,     setMarquee]     = useState(null)
  const [ctxMenu,     setCtxMenu]     = useState(null)
  const [undoCount,   setUndoCount]   = useState(0)
  const [canvasCxMenu, setCanvasCxMenu] = useState(null)
  const [volume,      setVolume]      = useState(1)
  const [pauseAllTick, setPauseAllTick] = useState(0)

  const panRef       = useRef(pan)
  const zoomRef      = useRef(zoom)
  const itemsRef     = useRef(items)
  const selectedRef  = useRef(new Set())
  const dragRef      = useRef(null)
  const urlMapRef    = useRef({})
  const aspectsRef   = useRef({})         // aspect ratios of all loaded images
  const undoStackRef = useRef([])         // items snapshots for undo
  const containerRef = useRef()
  const ctxMenuRef   = useRef()
  const saveTimerRef = useRef()
  const worldRef     = useRef()
  const prevViewRef  = useRef(null)   // { pan, zoom } saved before a zoom-to-item

  useEffect(() => { panRef.current      = pan      }, [pan])
  useEffect(() => { zoomRef.current     = zoom     }, [zoom])
  useEffect(() => { itemsRef.current    = items    }, [items])
  useEffect(() => { selectedRef.current = selected }, [selected])

  // ── zoom-to-item ──────────────────────────────────────────────────────────
  // Set a CSS transition directly on the DOM element so the animation fires
  // reliably before React re-renders the transform.
  const animateTo = useCallback((newPan, newZoom) => {
    const el = worldRef.current
    if (el) el.style.transition = 'transform 0.32s cubic-bezier(0.4,0,0.2,1)'
    panRef.current  = newPan
    zoomRef.current = newZoom
    setPan(newPan)
    setZoom(newZoom)
    setTimeout(() => { if (worldRef.current) worldRef.current.style.transition = '' }, 350)
  }, [])

  const zoomOut = useCallback(() => {
    if (!prevViewRef.current) return
    const { pan, zoom } = prevViewRef.current
    prevViewRef.current = null
    animateTo(pan, zoom)
  }, [animateTo])

  function zoomToItem(item) {
    if (!containerRef.current) return
    if (!prevViewRef.current) {
      prevViewRef.current = { pan: { ...panRef.current }, zoom: zoomRef.current }
    }
    const cW  = containerRef.current.clientWidth
    const cH  = containerRef.current.clientHeight
    const pad = 24
    const newZoom = Math.min((cW - pad * 2) / item.w, (cH - pad * 2) / item.h, 8)
    const newPan  = {
      x: cW / 2 - (item.x + item.w / 2) * newZoom,
      y: cH / 2 - (item.y + item.h / 2) * newZoom,
    }
    animateTo(newPan, newZoom)
  }

  // ── undo helpers ──────────────────────────────────────────────────────────
  const pushUndo = useCallback(() => {
    if (!itemsRef.current) return
    undoStackRef.current = [...undoStackRef.current.slice(-49), itemsRef.current]
    setUndoCount(undoStackRef.current.length)
  }, [])

  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return
    const snapshot = undoStackRef.current[undoStackRef.current.length - 1]
    undoStackRef.current = undoStackRef.current.slice(0, -1)
    setUndoCount(undoStackRef.current.length)
    setItems(snapshot)
    setSelected(new Set())
  }, [])

  // ── load images & build aspect map ────────────────────────────────────────
  useEffect(() => {
    let mounted = true

    async function run() {
      const loaded = await Promise.allSettled(images.map(async img => {
        const file = await img.handle.getFile()
        const url  = URL.createObjectURL(file)
        urlMapRef.current[img.name] = url
        return { img, url }
      }))

      if (!mounted) return
      setImageUrls({ ...urlMapRef.current })

      // Always resolve aspects — needed for restore/reset even when savedItems exists
      const aspects = {}
      await Promise.allSettled(loaded.map(r => {
        if (r.status !== 'fulfilled') return Promise.resolve()
        const { img, url } = r.value
        return new Promise(resolve => {
          if (img.mediaType === 'video') {
            const v = document.createElement('video')
            v.onloadedmetadata = () => { aspects[img.name] = v.videoWidth / v.videoHeight || 16/9; resolve() }
            v.onerror = () => { aspects[img.name] = 16/9; resolve() }
            v.src = url
          } else {
            const el = new Image()
            el.onload  = () => { aspects[img.name] = el.naturalWidth / el.naturalHeight; resolve() }
            el.onerror = () => { aspects[img.name] = 1; resolve() }
            el.src = url
          }
        })
      }))

      if (!mounted) return
      aspectsRef.current = aspects
      const currentItems = savedItems ?? autoLayout(images, aspects)
      setItems(currentItems)

      // Fit all items into view on open so nothing is off-screen, regardless of
      // any saved viewport (which may have been set at a different window size or
      // while content was positioned far from the visible area).
      if (currentItems.length > 0 && containerRef.current) {
        const pad  = 60
        const minX = Math.min(...currentItems.map(it => it.x))
        const minY = Math.min(...currentItems.map(it => it.y))
        const maxX = Math.max(...currentItems.map(it => it.x + (it.w || 200)))
        const maxY = Math.max(...currentItems.map(it => it.y + (it.h || it.w || 200)))
        const cW   = containerRef.current.clientWidth  - pad * 2
        const cH   = containerRef.current.clientHeight - pad * 2
        if (cW > 0 && cH > 0 && maxX > minX && maxY > minY) {
          const newZ = Math.min(cW / (maxX - minX), cH / (maxY - minY), 2)
          const newP = {
            x: pad + (cW - (maxX - minX) * newZ) / 2 - minX * newZ,
            y: pad + (cH - (maxY - minY) * newZ) / 2 - minY * newZ,
          }
          panRef.current  = newP
          zoomRef.current = newZ
          setPan(newP)
          setZoom(newZ)
        }
      }
    }

    run()

    return () => {
      mounted = false
      Object.values(urlMapRef.current).forEach(u => URL.revokeObjectURL(u))
      urlMapRef.current = {}
    }
  }, [images]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── scheduled save ────────────────────────────────────────────────────────
  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (!itemsRef.current) return
      onSave(itemsRef.current, { x: panRef.current.x, y: panRef.current.y, zoom: zoomRef.current })
    }, 700)
  }, [onSave])

  // ── world ↔ screen ────────────────────────────────────────────────────────
  function screenToWorld(clientX, clientY) {
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: (clientX - rect.left - panRef.current.x) / zoomRef.current,
      y: (clientY - rect.top  - panRef.current.y) / zoomRef.current,
    }
  }

  // ── close context menu on outside click ───────────────────────────────────
  useEffect(() => {
    if (!ctxMenu) return
    function onDown(e) {
      if (ctxMenuRef.current && !ctxMenuRef.current.contains(e.target)) setCtxMenu(null)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [ctxMenu])

  // ── wheel: trackpad=pan, mouse-wheel=zoom, pinch/ctrl=zoom ─────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function onWheel(e) {
      e.preventDefault()

      // Detect trackpad vs mouse wheel:
      // - deltaMode !== 0 (LINE/PAGE) → definitely a mouse wheel → zoom
      // - ctrlKey → pinch gesture (OS synthesises ctrlKey for pinch) → zoom
      // - deltaMode === 0 AND has horizontal component → trackpad 2D scroll → pan
      // - deltaMode === 0, no ctrlKey, small delta (< 40) → trackpad fine scroll → pan
      // - deltaMode === 0, no ctrlKey, large delta (≥ 40) → smooth-scroll mouse → zoom
      const isTrackpadPan = e.deltaMode === 0 && !e.ctrlKey &&
        (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) < 40)

      if (isTrackpadPan) {
        const newPan = {
          x: panRef.current.x - e.deltaX,
          y: panRef.current.y - e.deltaY,
        }
        panRef.current = newPan
        setPan(newPan)
        scheduleSave()
        return
      }

      // Mouse wheel (deltaMode≠0) or smooth-scroll mouse (large pixel delta) or pinch → zoom
      const mult    = e.deltaMode === 1 ? 30 : e.deltaMode === 2 ? 300 : 1
      const dy      = e.deltaY * mult
      const factor  = dy < 0 ? 1.08 : 0.93
      const newZoom = Math.max(0.05, Math.min(10, zoomRef.current * factor))
      const rect    = el.getBoundingClientRect()
      const mx      = e.clientX - rect.left
      const my      = e.clientY - rect.top
      const newPan  = {
        x: mx - (mx - panRef.current.x) * (newZoom / zoomRef.current),
        y: my - (my - panRef.current.y) * (newZoom / zoomRef.current),
      }
      panRef.current  = newPan
      zoomRef.current = newZoom
      setPan(newPan)
      setZoom(newZoom)
      scheduleSave()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [scheduleSave])

  // ── window-level mousemove/mouseup ────────────────────────────────────────
  useEffect(() => {
    function onMove(e) {
      const dr = dragRef.current
      if (!dr) return

      if (dr.type === 'pan') {
        const newPan = {
          x: dr.startPanX + (e.clientX - dr.startX),
          y: dr.startPanY + (e.clientY - dr.startY),
        }
        panRef.current = newPan
        setPan(newPan)
        return
      }

      if (dr.type === 'marquee') {
        const rect = containerRef.current.getBoundingClientRect()
        const x1 = dr.startClientX - rect.left
        const y1 = dr.startClientY - rect.top
        const x2 = e.clientX - rect.left
        const y2 = e.clientY - rect.top
        setMarquee({ x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) })
        return
      }

      if (dr.type === 'move') {
        const dx = (e.clientX - dr.startMouseX) / zoomRef.current
        const dy = (e.clientY - dr.startMouseY) / zoomRef.current
        setItems(prev => prev.map(it => {
          const start = dr.starts[it.id]
          if (!start) return it
          return { ...it, x: start.x + dx, y: start.y + dy }
        }))
        return
      }

      if (dr.type === 'resize') {
        const dxW   = (e.clientX - dr.startMouseX) / zoomRef.current
        const newW  = Math.max(MIN_W, dr.startW + dxW)
        const ratio = newW / dr.startW
        const multi = dr.groupX !== null
        setItems(prev => prev.map(it => {
          const start = dr.allStarts[it.id]
          if (!start) return it
          const scaledW = Math.max(MIN_W, start.w * ratio)
          const scaledH = start.aspect ? Math.round(scaledW / start.aspect) : Math.round(start.h * ratio)
          const base = (it.type === 'image' || it.type === 'video')
            ? { ...it, w: scaledW, h: scaledH }
            : { ...it, w: scaledW }
          if (multi) {
            return {
              ...base,
              x: dr.groupX + (start.x - dr.groupX) * ratio,
              y: dr.groupY + (start.y - dr.groupY) * ratio,
            }
          }
          return base
        }))
      }
    }

    function onUp(e) {
      const dr = dragRef.current
      if (!dr) return

      if (dr.type === 'marquee') {
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect && itemsRef.current) {
          const x1 = dr.startClientX - rect.left
          const y1 = dr.startClientY - rect.top
          const x2 = e.clientX - rect.left
          const y2 = e.clientY - rect.top

          if (Math.abs(x2 - x1) > 4 || Math.abs(y2 - y1) > 4) {
            const wMinX = (Math.min(x1, x2) - panRef.current.x) / zoomRef.current
            const wMinY = (Math.min(y1, y2) - panRef.current.y) / zoomRef.current
            const wMaxX = (Math.max(x1, x2) - panRef.current.x) / zoomRef.current
            const wMaxY = (Math.max(y1, y2) - panRef.current.y) / zoomRef.current

            const ids = new Set()
            itemsRef.current.forEach(it => {
              const iw = it.w || 200
              const ih = it.h || 40
              if (it.x < wMaxX && it.x + iw > wMinX && it.y < wMaxY && it.y + ih > wMinY) ids.add(it.id)
            })
            setSelected(ids)
          }
        }
        setMarquee(null)
      } else if (dr.type === 'move' || dr.type === 'resize') {
        scheduleSave()
      }

      dragRef.current = null
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [scheduleSave])

  // ── keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      // Ctrl/Cmd+Z — undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        undo()
        return
      }
      if (editingText) return
      if (selectedRef.current.size === 0) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        pushUndo()
        setItems(prev => prev.filter(it => !selectedRef.current.has(it.id)))
        setSelected(new Set())
        scheduleSave()
      }
      if (e.key === 'Escape') {
        if (prevViewRef.current) { zoomOut(); return }
        setSelected(new Set())
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editingText, scheduleSave, undo, pushUndo, zoomOut])

  // ── container mouse handlers ──────────────────────────────────────────────
  function onContainerMouseDown(e) {
    if (e.button === 1) {
      e.preventDefault()
      dragRef.current = { type: 'pan', startX: e.clientX, startY: e.clientY, startPanX: panRef.current.x, startPanY: panRef.current.y }
      return
    }
    if (e.button === 0 && (e.target === containerRef.current || e.target.classList?.contains('canvas-world'))) {
      setCtxMenu(null)
      setCanvasCxMenu(null)
      if (!e.shiftKey) setSelected(new Set())
      dragRef.current = { type: 'marquee', startClientX: e.clientX, startClientY: e.clientY }
    }
  }

  function onContainerDragOver(e) {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  async function onContainerDrop(e) {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    const files = getImageFiles(e)
    if (files.length === 0) return
    const wp = screenToWorld(e.clientX, e.clientY)
    await importToCanvas(files, wp.x, wp.y)
  }

  function onContainerContextMenu(e) {
    e.preventDefault()
    // Right-click on blank canvas (not on an item) → show paste option
    if (e.target === containerRef.current || e.target.classList?.contains('canvas-world')) {
      setCtxMenu(null)
      setCanvasCxMenu({ x: e.clientX, y: e.clientY })
    }
  }

  function onContainerDoubleClick(e) {
    if (e.target !== containerRef.current && !e.target.classList?.contains('canvas-world')) return
    if (prevViewRef.current) { zoomOut(); return }
    const wp = screenToWorld(e.clientX, e.clientY)
    const id  = `text-${Date.now()}`
    const box = { id, type: 'text', x: wp.x - 100, y: wp.y - 16, w: 200, text: '', fontSize: 14 }
    pushUndo()
    setItems(prev => [...(prev ?? []), box])
    setSelected(new Set([id]))
    setEditingText(id)
  }

  // ── item drag/select ──────────────────────────────────────────────────────
  function startItemMove(e, item) {
    if (e.button !== 0) return
    e.stopPropagation()
    setCtxMenu(null)

    if (e.shiftKey) {
      const next = new Set(selectedRef.current)
      if (next.has(item.id)) next.delete(item.id)
      else next.add(item.id)
      setSelected(next)
      return
    }

    let sel = selectedRef.current
    if (!sel.has(item.id)) {
      sel = new Set([item.id])
      setSelected(sel)
    }

    pushUndo()

    const starts = {}
    ;(itemsRef.current ?? []).forEach(it => {
      if (sel.has(it.id)) starts[it.id] = { x: it.x, y: it.y }
    })

    dragRef.current = { type: 'move', starts, startMouseX: e.clientX, startMouseY: e.clientY }
  }

  function startGroupResize(e) {
    e.stopPropagation()
    e.preventDefault()
    const si = (itemsRef.current ?? []).filter(it => selectedRef.current.has(it.id))
    if (si.length < 2) return
    const gX     = Math.min(...si.map(it => it.x))
    const gY     = Math.min(...si.map(it => it.y))
    const startW = Math.max(...si.map(it => it.x + (it.w || 200))) - gX
    pushUndo()
    const allStarts = {}
    si.forEach(it => {
      allStarts[it.id] = { x: it.x, y: it.y, w: it.w, h: it.h, aspect: (it.type === 'image' || it.type === 'video') && it.h ? it.w / it.h : null }
    })
    dragRef.current = { type: 'resize', id: null, startMouseX: e.clientX, startW, allStarts, groupX: gX, groupY: gY }
  }

  function startResize(e, item) {
    e.stopPropagation()
    e.preventDefault()
    setCtxMenu(null)

    const sel          = selectedRef.current.has(item.id) ? selectedRef.current : new Set([item.id])
    const selItems     = (itemsRef.current ?? []).filter(it => sel.has(it.id))
    const multi        = selItems.length > 1
    const groupX       = multi ? Math.min(...selItems.map(it => it.x)) : null
    const groupY       = multi ? Math.min(...selItems.map(it => it.y)) : null

    pushUndo()

    const allStarts = {}
    selItems.forEach(it => {
      allStarts[it.id] = {
        x: it.x, y: it.y, w: it.w, h: it.h,
        aspect: (it.type === 'image' || it.type === 'video') && it.h ? it.w / it.h : null,
      }
    })

    dragRef.current = { type: 'resize', id: item.id, startMouseX: e.clientX, startW: item.w, allStarts, groupX, groupY }
  }

  // ── fit all ───────────────────────────────────────────────────────────────
  function fitAll() {
    if (!items || items.length === 0) return
    const pad = 60
    const minX = Math.min(...items.map(it => it.x))
    const minY = Math.min(...items.map(it => it.y))
    const maxX = Math.max(...items.map(it => it.x + (it.w || 200)))
    const maxY = Math.max(...items.map(it => it.y + (it.h || it.w || 200)))
    const cW   = containerRef.current.clientWidth  - pad * 2
    const cH   = containerRef.current.clientHeight - pad * 2
    const newZ = Math.min(cW / (maxX - minX), cH / (maxY - minY), 2)
    const newP = {
      x: pad + (cW - (maxX - minX) * newZ) / 2 - minX * newZ,
      y: pad + (cH - (maxY - minY) * newZ) / 2 - minY * newZ,
    }
    panRef.current  = newP
    zoomRef.current = newZ
    setPan(newP); setZoom(newZ)
    scheduleSave()
  }

  // ── reset: pan/zoom to default + restore any deleted images ──────────────
  function resetView() {
    pushUndo()
    const existingIds = new Set((items || []).filter(it => it.type === 'image' || it.type === 'video').map(it => it.id))
    const missing = images.filter(img => !existingIds.has(img.id))
    if (missing.length > 0) {
      const maxY = (items || []).length > 0
        ? Math.max(...(items || []).map(it => it.y + (it.h || 100))) + GAP * 2
        : GAP
      const restored = autoLayout(missing, aspectsRef.current, maxY)
      setItems(prev => [...(prev || []), ...restored])
    }
    const p = { x: 40, y: 40 }
    panRef.current  = p
    zoomRef.current = 1
    setPan(p); setZoom(1)
    scheduleSave()
  }

  // ── import files into canvas (drop or paste) ─────────────────────────────
  const importToCanvas = useCallback(async (files, worldX, worldY) => {
    if (!dirHandle || files.length === 0) return
    pushUndo()
    const written = await writeFilesToDir(dirHandle, files)
    if (written.length === 0) return

    const newItems = []
    const newUrls  = {}
    let layoutX = worldX ?? ((containerRef.current?.clientWidth  ?? 800)  / 2 - panRef.current.x) / zoomRef.current
    let layoutY = worldY ?? ((containerRef.current?.clientHeight ?? 600) / 2 - panRef.current.y) / zoomRef.current
    let rowW = 0

    for (const { name, handle } of written) {
      const file = await handle.getFile()
      const url  = URL.createObjectURL(file)
      urlMapRef.current[name] = url
      newUrls[name] = url

      const isVideo = file.type.startsWith('video/') || VIDEO_RE.test(name)
      const aspect = await new Promise(resolve => {
        if (isVideo) {
          const v = document.createElement('video')
          v.onloadedmetadata = () => resolve(v.videoWidth / v.videoHeight || 16/9)
          v.onerror = () => resolve(16/9)
          v.src = url
        } else {
          const el = new Image()
          el.onload  = () => resolve(el.naturalWidth / el.naturalHeight)
          el.onerror = () => resolve(1)
          el.src = url
        }
      })
      aspectsRef.current[name] = aspect

      const w = Math.round(ROW_H * aspect)
      const h = ROW_H
      if (rowW > 0 && rowW + w + GAP > MAX_ROW) {
        layoutX = worldX ?? layoutX - rowW
        layoutY += h + GAP
        rowW = 0
      }
      newItems.push({ id: name, type: isVideo ? 'video' : 'image', x: layoutX + rowW, y: layoutY, w, h, name })
      rowW += w + GAP
    }

    setImageUrls(prev => ({ ...prev, ...newUrls }))
    setItems(prev => [...(prev ?? []), ...newItems])
    scheduleSave()
  }, [dirHandle, pushUndo, scheduleSave])

  // ── paste event (Ctrl+V) ──────────────────────────────────────────────────
  useEffect(() => {
    async function onPaste(e) {
      if (e.target.tagName === 'TEXTAREA') return
      const files = getImageFiles(e)
      if (files.length === 0 || !dirHandle) return
      e.preventDefault()
      await importToCanvas(files)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [dirHandle, importToCanvas])

  // ── restore deleted: add missing images below existing content ────────────
  function restoreDeleted() {
    if (!items) return
    const existingIds = new Set(items.filter(it => it.type === 'image' || it.type === 'video').map(it => it.id))
    const missing = images.filter(img => !existingIds.has(img.id))
    if (missing.length === 0) return
    pushUndo()
    const maxY = items.length > 0
      ? Math.max(...items.map(it => it.y + (it.h || 100))) + GAP * 2
      : GAP
    const restored = autoLayout(missing, aspectsRef.current, maxY)
    setItems(prev => [...prev, ...restored])
    scheduleSave()
  }

  // ── delete via context menu ───────────────────────────────────────────────
  function deleteById(id) {
    pushUndo()
    setItems(prev => prev.filter(it => it.id !== id))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    setCtxMenu(null)
    scheduleSave()
  }

  function deleteFromFolder(id, name) {
    pushUndo()
    setItems(prev => prev.filter(it => it.id !== id))
    setSelected(prev => { const n = new Set(prev); n.delete(id); return n })
    setCtxMenu(null)
    dirHandle?.removeEntry(name).catch(err => console.warn('delete from folder failed:', err))
    scheduleSave()
  }

  // ── group selection frame bounds ──────────────────────────────────────────
  const selItems       = items ? items.filter(it => selected.has(it.id)) : []
  const showGroupFrame = selItems.length > 1
  const groupBounds    = showGroupFrame ? (() => {
    const pad  = 8
    const minX = Math.min(...selItems.map(it => it.x))
    const minY = Math.min(...selItems.map(it => it.y))
    const maxX = Math.max(...selItems.map(it => it.x + (it.w || 200)))
    const maxY = Math.max(...selItems.map(it => it.y + (it.h || 40)))
    return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }
  })() : null

  // ── render ────────────────────────────────────────────────────────────────
  const deletedCount = items
    ? images.filter(img => !items.some(it => (it.type === 'image' || it.type === 'video') && it.id === img.id)).length
    : 0

  return (
    <div
      ref={containerRef}
      style={s.container}
      tabIndex={0}
      onMouseDown={onContainerMouseDown}
      onDoubleClick={onContainerDoubleClick}
      onDragOver={onContainerDragOver}
      onDrop={onContainerDrop}
      onContextMenu={onContainerContextMenu}
    >
      {!items ? (
        <div style={s.loadingOverlay}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>loading images…</span>
        </div>
      ) : (
        <>
          {/* World */}
          <div
            ref={worldRef}
            className="canvas-world"
            style={{ ...s.world, transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}
          >
            {items.map(item => item.type === 'image'
              ? <ImageItem
                  key={item.id}
                  item={item}
                  url={imageUrls[item.name]}
                  isSelected={selected.has(item.id)}
                  canResize={selected.size <= 1}
                  onMouseDown={startItemMove}
                  onResizeStart={startResize}
                  onDoubleClick={zoomToItem}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, id: item.id, type: 'image', name: item.name }) }}
                />
              : item.type === 'video'
              ? <VideoItem
                  key={item.id}
                  item={item}
                  url={imageUrls[item.name]}
                  isSelected={selected.has(item.id)}
                  canResize={selected.size <= 1}
                  volume={volume}
                  pauseAllTick={pauseAllTick}
                  onMouseDown={startItemMove}
                  onResizeStart={startResize}
                  onDoubleClick={zoomToItem}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, id: item.id, type: 'image', name: item.name }) }}
                />
              : <TextItem
                  key={item.id}
                  item={item}
                  isSelected={selected.has(item.id)}
                  canResize={selected.size <= 1}
                  isEditing={editingText === item.id}
                  onMouseDown={startItemMove}
                  onResizeStart={startResize}
                  onStartEdit={() => { pushUndo(); setEditingText(item.id); setSelected(new Set([item.id])) }}
                  onStopEdit={() => { setEditingText(null); scheduleSave() }}
                  onChange={text => setItems(prev => prev.map(it => it.id === item.id ? { ...it, text } : it))}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setCtxMenu({ x: e.clientX, y: e.clientY, id: item.id, type: 'text' }) }}
                />
            )}

            {/* Group selection frame — shown when 2+ items selected */}
            {showGroupFrame && groupBounds && (
              <div style={{
                position: 'absolute',
                left: groupBounds.x, top: groupBounds.y,
                width: groupBounds.w, height: groupBounds.h,
                border: '1.5px solid var(--accent)',
                borderRadius: 4,
                pointerEvents: 'none',
                boxSizing: 'border-box',
              }}>
                <div style={s.groupResizeHandle} onMouseDown={startGroupResize} />
              </div>
            )}
          </div>

          {/* Marquee selection rect */}
          {marquee && marquee.w > 2 && marquee.h > 2 && (
            <div style={{ ...s.marquee, left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }} />
          )}

          {/* Item right-click context menu */}
          {ctxMenu && (
            <div ref={ctxMenuRef} style={{ ...s.ctxMenu, left: ctxMenu.x, top: ctxMenu.y }}>
              <button style={s.ctxItem} onClick={() => deleteById(ctxMenu.id)}>
                {ctxMenu.type === 'image' ? 'remove from board' : 'delete'}
              </button>
              {ctxMenu.type === 'image' && dirHandle && (
                <button
                  style={{ ...s.ctxItem, color: 'var(--text-muted)' }}
                  onClick={() => deleteFromFolder(ctxMenu.id, ctxMenu.name)}
                >delete from folder</button>
              )}
            </div>
          )}

          {/* Canvas background right-click menu */}
          {canvasCxMenu && (
            <div
              style={{ ...s.ctxMenu, left: canvasCxMenu.x, top: canvasCxMenu.y }}
              onMouseDown={e => e.stopPropagation()}
            >
              <button style={s.ctxItem} onClick={async () => {
                const pos = { ...canvasCxMenu }
                setCanvasCxMenu(null)
                const files = await readClipboardImages()
                if (files.length > 0) {
                  const wp = screenToWorld(pos.x, pos.y)
                  await importToCanvas(files, wp.x, wp.y)
                }
              }}>paste image</button>
            </div>
          )}

          {/* HUD */}
          <div style={s.hud}>
            <button
              style={{ ...s.hudBtn, opacity: undoCount > 0 ? 1 : 0.3, cursor: undoCount > 0 ? 'pointer' : 'default' }}
              onClick={undo}
            >undo</button>
            <span style={s.hudDot}>·</span>
            <span style={s.hudZoom}>{Math.round(zoom * 100)}%</span>
            <span style={s.hudDot}>·</span>
            <button style={s.hudBtn} onClick={fitAll}>fit</button>
            <button style={s.hudBtn} onClick={resetView}>reset</button>
            {deletedCount > 0 && (
              <button style={{ ...s.hudBtn, color: 'var(--text-secondary)' }} onClick={restoreDeleted}>
                restore ({deletedCount})
              </button>
            )}
            <span style={s.hudDot}>·</span>
            <span style={{ ...s.hudZoom, minWidth: 'unset', cursor: 'pointer' }} onClick={() => setVolume(v => v > 0 ? 0 : 1)} title="mute/unmute">
              {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
            </span>
            <input
              type="range" min="0" max="1" step="0.02"
              value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              style={s.volSlider}
              title={`volume: ${Math.round(volume * 100)}%`}
            />
            <span style={s.hudDot}>·</span>
            <button style={s.hudBtn} onClick={() => setPauseAllTick(t => t + 1)} title="pause all playing videos">
              stop all videos
            </button>
          </div>

          {images.length === 0 && (
            <div style={s.emptyHint}>this folder has no images</div>
          )}
        </>
      )}
    </div>
  )
}

// ── image item ────────────────────────────────────────────────────────────────
function ImageItem({ item, url, isSelected, canResize, onMouseDown, onResizeStart, onDoubleClick, onContextMenu }) {
  return (
    <div
      style={{
        ...s.item,
        left: item.x, top: item.y, width: item.w, height: item.h,
        outline: isSelected ? '1.5px solid var(--accent)' : '1px solid rgba(255,255,255,0.07)',
        cursor: 'grab',
      }}
      onMouseDown={e => onMouseDown(e, item)}
      onDoubleClick={e => { e.stopPropagation(); onDoubleClick?.(item) }}
      onContextMenu={onContextMenu}
    >
      {url
        ? <img src={url} alt={item.name} style={s.img} draggable={false} />
        : <div style={s.imgPlaceholder} />
      }
      {isSelected && canResize && (
        <div style={s.resizeHandle} onMouseDown={e => onResizeStart(e, item)} />
      )}
    </div>
  )
}

// ── video item ────────────────────────────────────────────────────────────────
function VideoItem({ item, url, isSelected, canResize, volume, pauseAllTick, onMouseDown, onResizeStart, onDoubleClick, onContextMenu }) {
  const videoRef              = useRef()
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (videoRef.current) videoRef.current.volume = volume ?? 1
  }, [volume])

  useEffect(() => {
    if (!pauseAllTick) return
    videoRef.current?.pause()
    setPlaying(false)
  }, [pauseAllTick])

  function togglePlay(e) {
    e.stopPropagation()
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play(); setPlaying(true) }
    else          { v.pause(); setPlaying(false) }
  }

  return (
    <div
      style={{
        ...s.item,
        left: item.x, top: item.y, width: item.w, height: item.h,
        outline: isSelected ? '1.5px solid var(--accent)' : '1px solid rgba(255,255,255,0.07)',
        cursor: 'grab',
        background: '#000',
      }}
      onMouseDown={e => onMouseDown(e, item)}
      onDoubleClick={e => { e.stopPropagation(); onDoubleClick?.(item) }}
      onContextMenu={onContextMenu}
    >
      {url ? (
        <>
          <video
            ref={videoRef}
            src={url}
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
            loop
            playsInline
          />
          {/* Non-interactive overlay — only the button itself is clickable */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', background: playing ? 'transparent' : 'rgba(0,0,0,0.28)', transition: 'background 0.18s' }}>
            <div
              style={{ ...s.videoPlayBtn, pointerEvents: 'auto', cursor: 'pointer' }}
              onMouseDown={e => { e.stopPropagation(); e.preventDefault() }}
              onDoubleClick={e => e.stopPropagation()}
              onClick={togglePlay}
            >
              {playing ? '▌▌' : '▶'}
            </div>
          </div>
        </>
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: 'rgba(255,255,255,0.2)' }}>▶</div>
      )}
      {isSelected && canResize && (
        <div style={s.resizeHandle} onMouseDown={e => onResizeStart(e, item)} />
      )}
    </div>
  )
}

// ── text item ─────────────────────────────────────────────────────────────────
function TextItem({ item, isSelected, canResize, isEditing, onMouseDown, onResizeStart, onStartEdit, onStopEdit, onChange, onContextMenu }) {
  return (
    <div
      style={{
        ...s.textItem,
        left: item.x, top: item.y, width: item.w,
        outline: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
        cursor: isEditing ? 'text' : 'grab',
      }}
      onMouseDown={e => { if (!isEditing) onMouseDown(e, item) }}
      onDoubleClick={e => { e.stopPropagation(); onStartEdit() }}
      onContextMenu={onContextMenu}
    >
      {isEditing
        ? <textarea
            autoFocus
            value={item.text}
            placeholder="type here…"
            style={{ ...s.textarea, fontSize: item.fontSize }}
            onChange={e => onChange(e.target.value)}
            onBlur={onStopEdit}
            onMouseDown={e => e.stopPropagation()}
            onKeyDown={e => {
              e.stopPropagation()
              if (e.key === 'Escape') onStopEdit()
            }}
          />
        : <div style={{ ...s.textDisplay, fontSize: item.fontSize }}>
            {item.text
              ? <span style={{ whiteSpace: 'pre-wrap' }}>{item.text}</span>
              : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>text box — double-click to edit</span>
            }
          </div>
      }
      {isSelected && !isEditing && canResize && (
        <div
          style={{ ...s.resizeHandle, cursor: 'ew-resize', bottom: '50%', transform: 'translateY(50%)' }}
          onMouseDown={e => onResizeStart(e, item)}
        />
      )}
    </div>
  )
}

// ── styles ────────────────────────────────────────────────────────────────────
const s = {
  container: {
    position: 'absolute', inset: 0,
    overflow: 'hidden',
    background: 'var(--bg-deep)',
    userSelect: 'none',
    outline: 'none',
  },
  loadingOverlay: {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  world: {
    position: 'absolute', top: 0, left: 0,
    transformOrigin: '0 0',
  },
  item: {
    position: 'absolute',
    borderRadius: 3,
    overflow: 'hidden',
    background: 'var(--bg-base)',
  },
  img: {
    display: 'block', width: '100%', height: '100%',
    objectFit: 'cover', pointerEvents: 'none',
  },
  imgPlaceholder: {
    width: '100%', height: '100%',
    background: 'var(--bg-surface)',
  },
  textItem: {
    position: 'absolute',
    minHeight: 32,
    padding: '6px 8px',
    borderRadius: 3,
  },
  textarea: {
    display: 'block', width: '100%', minHeight: 60,
    background: 'transparent', border: 'none', outline: 'none',
    resize: 'none', color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)', lineHeight: 1.55, padding: 0,
  },
  textDisplay: {
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-mono)',
    lineHeight: 1.55, wordBreak: 'break-word',
  },
  videoPlayBtn: {
    width: 48, height: 48, borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)',
    border: '1.5px solid rgba(255,255,255,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, color: 'rgba(255,255,255,0.9)',
    paddingLeft: 2,
    transition: 'background 0.15s, opacity 0.15s',
  },
  resizeHandle: {
    position: 'absolute', right: 3, bottom: 3,
    width: 10, height: 10,
    background: 'var(--accent)', borderRadius: 2,
    cursor: 'se-resize', zIndex: 10,
    boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
  },
  groupResizeHandle: {
    position: 'absolute', right: -5, bottom: -5,
    width: 10, height: 10,
    background: 'var(--accent)', borderRadius: 2,
    cursor: 'se-resize', pointerEvents: 'all', zIndex: 10,
    boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
  },
  marquee: {
    position: 'absolute',
    border: '1.5px solid var(--accent)',
    background: 'rgba(100,160,220,0.08)',
    pointerEvents: 'none',
    borderRadius: 2,
  },
  ctxMenu: {
    position: 'absolute',
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--border-mid)',
    borderRadius: 6,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
    padding: '4px 0',
    zIndex: 200,
    minWidth: 100,
  },
  ctxItem: {
    display: 'block', width: '100%',
    background: 'transparent', border: 'none',
    padding: '6px 14px', textAlign: 'left',
    fontSize: 11, color: 'var(--text-secondary)',
    fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
    cursor: 'pointer',
  },
  hud: {
    position: 'absolute', bottom: 16, left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--border-mid)',
    borderRadius: 20, padding: '6px 16px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    fontSize: 10, letterSpacing: '0.05em',
    zIndex: 100, pointerEvents: 'all',
    whiteSpace: 'nowrap',
  },
  hudZoom:  { color: 'var(--text-secondary)', fontWeight: 700, minWidth: 34, textAlign: 'right' },
  hudDot:   { color: 'var(--border-strong)' },
  hudBtn: {
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'var(--accent)', fontSize: 10, padding: '0 2px',
    letterSpacing: '0.05em', fontFamily: 'var(--font-mono)',
  },
  hudHint: { color: 'var(--text-muted)', fontSize: 9, letterSpacing: '0.05em' },
  volSlider: { width: 72, accentColor: 'var(--accent)', cursor: 'pointer', verticalAlign: 'middle' },
  emptyHint: {
    position: 'absolute', top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.08em',
    pointerEvents: 'none',
  },
}
