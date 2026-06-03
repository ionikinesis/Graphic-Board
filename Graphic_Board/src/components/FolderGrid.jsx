import React, { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { createThumbnail } from '../utils/thumbnail.js'
import ContextMenu from './ContextMenu.jsx'
import { FOLDER_YELLOW, darkenHex, getContrastColor } from '../utils/color.js'
import { writeFilesToDir, getImageFiles } from '../utils/fileImport.js'
import { openInExplorer } from '../utils/platform.js'
import { moveFile, moveFolder } from '../utils/fileOps.js'
import { getDragPayload, clearDragPayload, setDragPayload } from '../utils/dragState.js'

const IMAGE_RE = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?|svg)$/i
const VIDEO_RE = /\.(mp4|webm|mov|m4v|ogg|ogv|avi|mkv)$/i
const MIN_W = { small: 110, medium: 160, large: 230 }

function sortFolders(folders, sortBy, getFolderColor, getFolderRecent, isFolderFav, parentPath, getFolderOrder, getSortName) {
  const arr = [...folders]
  const key     = f => `${parentPath}/${f.name}`
  const sortKey = f => (getSortName ? getSortName(key(f)) : null) || f.name
  switch (sortBy) {
    case 'recent':
      return arr.sort((a, b) => {
        const d = getFolderRecent(key(b)) - getFolderRecent(key(a))
        return d !== 0 ? d : a.name.localeCompare(b.name)
      })
    case 'favfirst':
      return arr.sort((a, b) => {
        const d = (isFolderFav(key(b)) ? 1 : 0) - (isFolderFav(key(a)) ? 1 : 0)
        return d !== 0 ? d : a.name.localeCompare(b.name)
      })
    case 'color':
      return arr.sort((a, b) => {
        const ca = getFolderColor(key(a)) || 'zzz'
        const cb = getFolderColor(key(b)) || 'zzz'
        return ca !== cb ? ca.localeCompare(cb) : a.name.localeCompare(b.name)
      })
    case 'size':
      return arr.sort((a, b) => {
        const sa = a.subfolderCount || a.imageCount
        const sb = b.subfolderCount || b.imageCount
        return sa !== sb ? sb - sa : a.name.localeCompare(b.name)
      })
    case 'custom': {
      const order = getFolderOrder ? getFolderOrder(parentPath) : []
      const orderMap = {}
      ;(order || []).forEach((name, i) => { orderMap[name] = i })
      return arr.sort((a, b) => {
        const ia = orderMap[a.name] ?? Number.MAX_SAFE_INTEGER
        const ib = orderMap[b.name] ?? Number.MAX_SAFE_INTEGER
        if (ia !== ib) return ia - ib
        return a.name.localeCompare(b.name)
      })
    }
    default:
      return arr.sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
  }
}

const TYPE_ORDER = ['subfolders', 'images', 'mixed', 'empty']

function groupFolders(sorted, groupBy, folderMeta, parentPath) {
  if (groupBy === 'none') return [{ label: null, folders: sorted }]

  const groups = {}
  sorted.forEach(f => {
    const pk = `${parentPath}/${f.name}`
    let key
    if (groupBy === 'color') {
      key = folderMeta.getFolderColor(pk) || '__none__'
    } else if (groupBy === 'favorite') {
      key = folderMeta.isFolderFav(pk) ? '__fav__' : '__none__'
    } else if (groupBy === 'tag') {
      const ts = folderMeta.getItemTags(pk)
      key = ts.length > 0 ? ts[0] : '__none__'
    } else if (groupBy === 'type') {
      const hasSubs = f.subfolderCount > 0
      const hasImgs = f.imageCount > 0
      if (hasSubs && hasImgs) key = 'mixed'
      else if (hasSubs) key = 'subfolders'
      else if (hasImgs) key = 'images'
      else key = 'empty'
    } else {
      key = '__none__'
    }
    if (!groups[key]) groups[key] = []
    groups[key].push(f)
  })

  return Object.entries(groups)
    .sort(([a], [b]) => {
      if (groupBy === 'type') {
        const ia = TYPE_ORDER.indexOf(a), ib = TYPE_ORDER.indexOf(b)
        if (ia !== -1 && ib !== -1) return ia - ib
      }
      if (a === '__fav__') return -1
      if (b === '__fav__') return 1
      if (a === '__none__') return 1
      if (b === '__none__') return -1
      return a.localeCompare(b)
    })
    .map(([key, folders]) => ({
      label: key === '__none__' ? (groupBy === 'favorite' ? 'not favorited' : 'untagged')
           : key === '__fav__'  ? 'favorited'
           : key,
      colorKey: groupBy === 'color' && key !== '__none__' ? key : null,
      isFav: groupBy === 'favorite' && key === '__fav__',
      folders,
    }))
}

function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

export default function FolderGrid({
  folders, onSelectFolder, getImageUrl,
  folderMeta, parentPath,
  sortBy = 'alpha', iconSize = 'medium', groupBy = 'none',
  currentHandle, rootAbsPath = '', fillHeight = true,
  onNewFolder, onDeleteFolder, onRefresh, onMoveCompleted, onMovePending,
  clipboard, onClipboardCut, onClipboardCopy, onClipboardPaste,
  onSendTo, onCopyTo,
  reorderMode = false,
  pendingFolderName = null,
}) {
  // Multi-selection
  const [selectedIds,     setSelectedIds]     = useState(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())

  // Marquee drag state
  const [marquee,   setMarquee]   = useState(null) // { x, y, w, h } container-relative
  const marqueeRef         = useRef(null)
  const marqueeWasDrawnRef = useRef(false) // prevents onClick clearing selection after a marquee
  const containerRef = useRef(null)
  // Map of folder.id → card DOM element (populated by ref callbacks)
  const cardElemsRef = useRef(new Map())

  // ── REORDER MODE drag state ──────────────────────────────────────────────
  const [reorderSrc,  setReorderSrc]  = useState(null)
  const [reorderOver, setReorderOver] = useState(null)
  const [insertLine,  setInsertLine]  = useState(null)
  const reorderSrcRef  = useRef(null)
  const reorderOverRef = useRef(null)
  const gridRef        = useRef(null)
  const sortedRef      = useRef([])

  // ── NORMAL MODE drag state ───────────────────────────────────────────────
  const [moveTarget,   setMoveTarget]   = useState(null)
  const [fileDragOver, setFileDragOver] = useState(null)
  const [movingSrcId,  setMovingSrcId]  = useState(null)

  const [emptyCtxMenu,      setEmptyCtxMenu]      = useState(null)
  const [newFolderPos,      setNewFolderPos]      = useState(null)
  const [newFolderName,     setNewFolderName]     = useState('')
  const [multiDeletePending, setMultiDeletePending] = useState(null)
  const newFolderRef      = useRef()
  const deleteSelectedRef = useRef(null)
  const clipboardCopyRef  = useRef(null)
  const clipboardCutRef   = useRef(null)

  const canReorder = reorderMode && sortBy === 'custom' && groupBy === 'none'

  useEffect(() => {
    setSelectedIds(new Set())
    setCollapsedGroups(new Set())
    cardElemsRef.current.clear()
  }, [parentPath])

  useEffect(() => {
    if (reorderMode) setSelectedIds(new Set())
  }, [reorderMode])

  useEffect(() => {
    if (pendingFolderName) setSelectedIds(new Set([pendingFolderName]))
  }, [pendingFolderName])

  // Keep container filling the full content area so marquee can start anywhere.
  // min-height: 100% is unreliable inside overflow:auto flex containers — use explicit px.
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el?.parentElement) return
    const parent = el.parentElement
    if (!fillHeight) { el.style.minHeight = ''; return }
    const sync = () => { el.style.minHeight = parent.clientHeight + 'px' }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(parent)
    return () => { el.style.minHeight = ''; ro.disconnect() }
  }, [fillHeight])

  useEffect(() => {
    function onKeyDown(e) {
      if (!(e.ctrlKey || e.metaKey) || (e.key !== 'a' && e.key !== 'd')) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      e.preventDefault()
      if (e.key === 'a') setSelectedIds(new Set(sortedRef.current.map(f => f.id)))
      else setSelectedIds(new Set())
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== 'Delete') return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (!deleteSelectedRef.current) return
      e.preventDefault()
      deleteSelectedRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    if (!multiDeletePending) return
    function onKeyDown(e) {
      if (e.key === 'Enter') { e.preventDefault(); handleMultiDeleteConfirm() }
      if (e.key === 'Escape') { e.preventDefault(); setMultiDeletePending(null) }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [multiDeletePending])

  useEffect(() => {
    function onKeyDown(e) {
      if (!(e.ctrlKey || e.metaKey)) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'c' && clipboardCopyRef.current) { e.preventDefault(); clipboardCopyRef.current() }
      if (e.key === 'x' && clipboardCutRef.current)  { e.preventDefault(); clipboardCutRef.current()  }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // ── Marquee mouse handlers ───────────────────────────────────────────────
  function onContainerMouseDown(e) {
    if (canReorder) return
    if (e.button !== 0) return
    if (e.target.closest('[data-card]')) return
    if (e.target.closest('[data-contextmenu]')) return

    const cr0 = containerRef.current?.getBoundingClientRect()
    if (!cr0) return

    // Snapshot card positions in container-local space once — no getBoundingClientRect during drag
    const cachedRects = new Map()
    cardElemsRef.current.forEach((el, id) => {
      const r = el.getBoundingClientRect()
      cachedRects.set(id, { left: r.left - cr0.left, top: r.top - cr0.top, right: r.right - cr0.left, bottom: r.bottom - cr0.top })
    })

    const startContX = e.clientX - cr0.left
    const startContY = e.clientY - cr0.top
    const baseSelection = e.shiftKey ? new Set(selectedIds) : new Set()
    marqueeRef.current = {
      startClientX: e.clientX, startClientY: e.clientY,
      startContX, startContY,
      baseSelection, cumulativeHit: new Set(), cachedRects,
    }
    setMarquee(null)
    setSelectedIds(baseSelection)

    let pendingRaf = null
    let latestEv = null

    function processMove() {
      pendingRaf = null
      const ev = latestEv
      if (!ev || !marqueeRef.current) return
      const cr = containerRef.current?.getBoundingClientRect()
      if (!cr) return
      const mq = marqueeRef.current

      const curContX = ev.clientX - cr.left
      const curContY = ev.clientY - cr.top

      setMarquee({ x: Math.min(mq.startContX, curContX), y: Math.min(mq.startContY, curContY), w: Math.abs(curContX - mq.startContX), h: Math.abs(curContY - mq.startContY) })

      const mqLocal = { left: Math.min(mq.startContX, curContX), top: Math.min(mq.startContY, curContY), right: Math.max(mq.startContX, curContX), bottom: Math.max(mq.startContY, curContY) }
      const vpTop    = -cr.top
      const vpBottom = window.innerHeight - cr.top

      mq.cachedRects.forEach((r, id) => {
        if (rectsOverlap(mqLocal, r)) {
          mq.cumulativeHit.add(id)
        } else if (r.top < vpBottom && r.bottom > vpTop) {
          mq.cumulativeHit.delete(id)
        }
      })
      setSelectedIds(new Set([...mq.baseSelection, ...mq.cumulativeHit]))
    }

    function onMove(ev) {
      latestEv = ev
      if (pendingRaf !== null) return
      pendingRaf = requestAnimationFrame(processMove)
    }

    function onUp(ev) {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      if (pendingRaf !== null) { cancelAnimationFrame(pendingRaf); pendingRaf = null }
      const mq = marqueeRef.current
      marqueeRef.current = null
      setMarquee(null)
      if (mq) {
        const dx = Math.abs(ev.clientX - mq.startClientX)
        const dy = Math.abs(ev.clientY - mq.startClientY)
        if (dx > 4 || dy > 4) marqueeWasDrawnRef.current = true
      }
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function toggleGroup(label) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  if (!folders || folders.length === 0) {
    deleteSelectedRef.current = null
    clipboardCopyRef.current  = null
    clipboardCutRef.current   = null
    return null
  }

  const sorted = sortFolders(
    folders, sortBy,
    folderMeta.getFolderColor, folderMeta.getFolderRecent,
    folderMeta.isFolderFav, parentPath, folderMeta.getFolderOrder,
    folderMeta.getSortName,
  )
  // While a folder is freshly created, pin it at the bottom so the user sees it immediately
  if (pendingFolderName) {
    const pidx = sorted.findIndex(f => f.name === pendingFolderName)
    if (pidx !== -1 && pidx !== sorted.length - 1) {
      const [pending] = sorted.splice(pidx, 1)
      sorted.push(pending)
    }
  }
  sortedRef.current = sorted
  const minW   = MIN_W[iconSize] || 160
  const groups = groupFolders(sorted, groupBy, folderMeta, parentPath)

  // ── Multi-select bulk operations ─────────────────────────────────────────
  const isMulti         = selectedIds.size > 1
  const selectedFolders = isMulti ? sorted.filter(f => selectedIds.has(f.id)) : []

  let multiAllFav = false, multiCommonTags = []
  if (selectedFolders.length > 1) {
    multiAllFav     = selectedFolders.every(f => folderMeta.isFolderFav(`${parentPath}/${f.name}`))
    const tagSets   = selectedFolders.map(f => new Set(folderMeta.getItemTags(`${parentPath}/${f.name}`)))
    multiCommonTags = tagSets.length > 0 ? [...tagSets[0]].filter(t => tagSets.every(s => s.has(t))) : []
  }

  function handleMultiDelete() {
    if (selectedFolders.length === 0) return
    setMultiDeletePending([...selectedFolders])
  }

  async function handleMultiDeleteConfirm() {
    const toDelete = multiDeletePending
    setMultiDeletePending(null)
    setSelectedIds(new Set())
    if (!toDelete || !currentHandle) return
    for (const f of toDelete) {
      await currentHandle.removeEntry(f.name, { recursive: true }).catch(() => {})
    }
    onRefresh?.()
  }
  function handleMultiSetColor(hex) {
    selectedFolders.forEach(f => folderMeta.setFolderColor(`${parentPath}/${f.name}`, hex))
  }
  function handleMultiToggleFav() {
    selectedFolders.forEach(f => {
      const pk = `${parentPath}/${f.name}`
      if (multiAllFav) { if (folderMeta.isFolderFav(pk)) folderMeta.toggleFolderFav(pk) }
      else { if (!folderMeta.isFolderFav(pk)) folderMeta.toggleFolderFav(pk) }
    })
  }
  function handleMultiSetTags(tags) {
    selectedFolders.forEach(f => folderMeta.setItemTags(`${parentPath}/${f.name}`, tags))
  }
  function handleMultiCut() {
    onClipboardCut?.({ items: selectedFolders.map(f => ({ name: f.name, handle: f.handle, parentHandle: currentHandle, kind: 'directory' })) })
    setSelectedIds(new Set())
  }
  function handleMultiCopy() {
    onClipboardCopy?.({ items: selectedFolders.map(f => ({ name: f.name, handle: f.handle, parentHandle: currentHandle, kind: 'directory' })) })
  }
  function handleMultiSendTo() {
    onSendTo?.(selectedFolders.map(f => ({ name: f.name, handle: f.handle, parentHandle: currentHandle, kind: 'directory' })))
  }
  function handleMultiCopyTo() {
    onCopyTo?.(selectedFolders.map(f => ({ name: f.name, handle: f.handle, parentHandle: currentHandle, kind: 'directory' })))
  }

  function applyReorder(srcIdx, overIdx, side) {
    if (srcIdx === null || overIdx === null || srcIdx === overIdx) return
    const names = sorted.map(f => f.name)
    const [moved] = names.splice(srcIdx, 1)
    const adjTarget = srcIdx < overIdx ? overIdx - 1 : overIdx
    const insertAt  = side === 'after' ? adjTarget + 1 : adjTarget
    names.splice(Math.max(0, Math.min(insertAt, names.length)), 0, moved)
    folderMeta.setFolderOrder(parentPath, names)
  }

  // Always keep these refs current so stable keydown listeners can call them
  deleteSelectedRef.current = selectedIds.size > 0 && onDeleteFolder ? () => {
    const toDelete = sorted.filter(f => selectedIds.has(f.id))
    if (toDelete.length > 0) setMultiDeletePending(toDelete)
  } : null

  clipboardCopyRef.current = selectedIds.size > 0 && onClipboardCopy ? () => {
    const items = sorted.filter(f => selectedIds.has(f.id))
      .map(f => ({ name: f.name, handle: f.handle, parentHandle: currentHandle, kind: 'directory' }))
    onClipboardCopy({ items })
  } : null

  clipboardCutRef.current = selectedIds.size > 0 && onClipboardCut ? () => {
    const items = sorted.filter(f => selectedIds.has(f.id))
      .map(f => ({ name: f.name, handle: f.handle, parentHandle: currentHandle, kind: 'directory' }))
    onClipboardCut({ items })
    setSelectedIds(new Set())
  } : null

  return (
    <div
      ref={containerRef}
      data-gridbg="1"
      style={{ background: canReorder ? 'rgba(0,0,0,0.18)' : undefined, transition: 'background 0.25s', position: 'relative', userSelect: 'none' }}
      onMouseDown={onContainerMouseDown}
      onClick={e => {
        // After a marquee drag, onClick fires on background — ignore it once
        if (marqueeWasDrawnRef.current) { marqueeWasDrawnRef.current = false; return }
        if (!e.target.closest('[data-card]')) setSelectedIds(new Set())
      }}
      onContextMenu={e => { e.preventDefault(); setEmptyCtxMenu({ x: e.clientX, y: e.clientY }) }}
    >
      {/* Marquee selection box */}
      {marquee && marquee.w > 4 && marquee.h > 4 && (
        <div style={{
          position: 'absolute',
          left: marquee.x, top: marquee.y,
          width: marquee.w, height: marquee.h,
          border: '1.5px solid var(--accent)',
          background: 'rgba(100,160,220,0.08)',
          borderRadius: 3,
          pointerEvents: 'none',
          zIndex: 20,
        }} />
      )}

      {groups.map((group, gi) => (
        <div key={gi} data-gridbg="1">
          {group.label && (
            <div
              style={{ ...styles.groupHeader, cursor: 'pointer', userSelect: 'none' }}
              onClick={e => { e.stopPropagation(); toggleGroup(group.label) }}
            >
              <span style={styles.groupChevron}>{collapsedGroups.has(group.label) ? '▸' : '▾'}</span>
              {group.colorKey && <span style={{ ...styles.groupDot, background: group.colorKey }} />}
              {group.isFav && <span style={styles.groupStar}>★</span>}
              <span style={styles.groupLabel}>{group.label}</span>
              <span style={styles.groupCount}>{group.folders.length}</span>
            </div>
          )}
          {(!group.label || !collapsedGroups.has(group.label)) && (
            <div ref={gridRef} data-gridbg="1" style={{ ...styles.grid, gridTemplateColumns: `repeat(auto-fill, minmax(${minW}px, 1fr))`, position: 'relative' }}>
              {canReorder && insertLine && (
                <div style={{
                  position: 'absolute',
                  left: insertLine.x - 1, top: insertLine.top,
                  width: 2, height: insertLine.height,
                  background: 'var(--accent)', borderRadius: 1,
                  pointerEvents: 'none', zIndex: 10,
                }} />
              )}
              {group.folders.map((folder, fi) => {
                const isSelected = selectedIds.has(folder.id)

                // ── Reorder mode handlers ────────────────────────────────
                const reorderHandlers = canReorder ? {
                  onDragStart: e => {
                    reorderSrcRef.current = fi
                    setReorderSrc(fi)
                    e.dataTransfer.effectAllowed = 'move'
                  },
                  onDragOver: e => {
                    e.preventDefault()
                    const cardRect = e.currentTarget.getBoundingClientRect()
                    const gridRect = gridRef.current?.getBoundingClientRect() ?? { left: 0, top: 0 }
                    const side = e.clientX < cardRect.left + cardRect.width / 2 ? 'before' : 'after'
                    const lineX = side === 'before' ? cardRect.left - gridRect.left : cardRect.right - gridRect.left
                    setInsertLine({ x: lineX, top: cardRect.top - gridRect.top, height: cardRect.height })
                    if (reorderOverRef.current?.index !== fi || reorderOverRef.current?.side !== side) {
                      reorderOverRef.current = { index: fi, side }
                      setReorderOver({ index: fi, side })
                    }
                  },
                  onDragLeave: e => {
                    if (e.currentTarget.contains(e.relatedTarget)) return
                    if (reorderOverRef.current?.index === fi) {
                      reorderOverRef.current = null; setReorderOver(null); setInsertLine(null)
                    }
                  },
                  onDrop: e => {
                    e.preventDefault()
                    const src  = reorderSrcRef.current
                    const side = reorderOverRef.current?.side ?? 'before'
                    reorderSrcRef.current = null; reorderOverRef.current = null
                    setReorderSrc(null); setReorderOver(null); setInsertLine(null)
                    applyReorder(src, fi, side)
                  },
                  onDragEnd: () => {
                    reorderSrcRef.current = null; reorderOverRef.current = null
                    setReorderSrc(null); setReorderOver(null); setInsertLine(null)
                  },
                } : {}

                // ── Normal mode handlers ─────────────────────────────────
                const moveHandlers = !canReorder ? {
                  onDragStart: isSelected ? e => {
                    setMovingSrcId(folder.id)
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('application/x-graphic-board', 'folder')
                    const count = selectedIds.size
                    if (count > 1) {
                      setDragPayload({
                        kind: 'multi',
                        items: sorted
                          .filter(f => selectedIds.has(f.id))
                          .map(f => ({ kind: 'directory', name: f.name, handle: f.handle, parentHandle: currentHandle })),
                      })
                    } else {
                      setDragPayload({ kind: 'directory', name: folder.name, handle: folder.handle, parentHandle: currentHandle })
                    }
                    // Custom drag ghost showing count
                    const ghost = document.createElement('div')
                    ghost.style.cssText = 'position:fixed;top:-999px;left:-999px;padding:5px 11px;background:var(--bg-raised);border:1px solid var(--accent);border-radius:6px;color:var(--accent);font-size:12px;font-family:monospace;box-shadow:0 4px 12px rgba(0,0,0,0.5);white-space:nowrap;pointer-events:none'
                    ghost.textContent = count > 1 ? `${count} folders` : `📁 ${folder.name}`
                    document.body.appendChild(ghost)
                    e.dataTransfer.setDragImage(ghost, 14, 14)
                    requestAnimationFrame(() => { if (ghost.parentNode) ghost.parentNode.removeChild(ghost) })
                  } : undefined,
                  onDragOver: e => {
                    e.preventDefault()
                    if (e.dataTransfer.types.includes('Files')) {
                      setFileDragOver(folder.id); setMoveTarget(null)
                    } else {
                      if (movingSrcId && selectedIds.has(folder.id)) return
                      setMoveTarget(folder.id); setFileDragOver(null)
                    }
                  },
                  onDragLeave: e => {
                    if (e.currentTarget.contains(e.relatedTarget)) return
                    setMoveTarget(null); setFileDragOver(null)
                  },
                  onDrop: e => {
                    e.preventDefault()
                    setMoveTarget(null)
                    if (e.dataTransfer.types.includes('Files')) {
                      e.stopPropagation()
                      setFileDragOver(null)
                      const files = getImageFiles(e)
                      if (files.length > 0) writeFilesToDir(folder.handle, files).then(() => onRefresh?.()).catch(err => console.warn(err))
                      return
                    }
                    const payload = getDragPayload()
                    clearDragPayload()
                    if (!payload) return
                    const dest = folder.handle
                    if (payload.kind === 'multi' && payload.items.some(it => it.handle === dest)) return
                    const itemsToMove = payload.kind === 'multi'
                      ? payload.items.filter(it => it.handle !== dest)
                      : (payload.handle !== dest ? [payload] : [])
                    if (itemsToMove.length === 0) return
                    if (itemsToMove.length > 5 && !window.confirm(`Move ${itemsToMove.length} items into "${folder.name}"?`)) return
                    onMovePending?.(itemsToMove.length)
                    const completed = []
                    Promise.all(itemsToMove.map(it => {
                      const op = it.kind === 'file'
                        ? moveFile(it.handle, it.parentHandle, dest)
                        : moveFolder(it.handle, it.parentHandle, dest)
                      return op
                        .then(name => { completed.push({ kind: it.kind, name: name || it.name, destHandle: dest, srcParentHandle: it.parentHandle }) })
                        .catch(err => console.warn('move failed:', err))
                        .finally(() => onMovePending?.(-1))
                    })).then(() => {
                      if (completed.length > 0) onMoveCompleted?.(completed.length === 1 ? completed[0] : completed)
                    }).finally(() => onRefresh?.())
                  },
                  onDragEnd: () => {
                    setMovingSrcId(null); setMoveTarget(null); clearDragPayload()
                  },
                } : {}

                const handlers = canReorder ? reorderHandlers : moveHandlers

                return (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    pathKey={`${parentPath}/${folder.name}`}
                    onOpen={() => onSelectFolder(folder)}
                    onSelect={e => {
                      if (e.shiftKey) {
                        setSelectedIds(prev => {
                          const next = new Set(prev)
                          if (next.has(folder.id)) next.delete(folder.id)
                          else next.add(folder.id)
                          return next
                        })
                      } else {
                        setSelectedIds(new Set([folder.id]))
                      }
                    }}
                    isSelected={isSelected}
                    canReorder={canReorder}
                    getImageUrl={getImageUrl}
                    folderMeta={folderMeta}
                    isDragging={canReorder ? reorderSrc === fi : movingSrcId === folder.id}
                    isDragInto={!canReorder && (moveTarget === folder.id || fileDragOver === folder.id)}
                    isFileDragOver={!canReorder && fileDragOver === folder.id}
                    rootAbsPath={rootAbsPath}
                    onDeleteFolder={onDeleteFolder ? () => onDeleteFolder(folder.name) : null}
                    onRefresh={onRefresh}
                    onClipboardCut={onClipboardCut ? () => onClipboardCut({ name: folder.name, handle: folder.handle, parentHandle: currentHandle, kind: 'directory' }) : null}
                    onClipboardCopy={onClipboardCopy ? () => onClipboardCopy({ name: folder.name, handle: folder.handle, parentHandle: currentHandle, kind: 'directory' }) : null}
                    onSendTo={onSendTo ? () => onSendTo([{ name: folder.name, handle: folder.handle, parentHandle: currentHandle, kind: 'directory' }]) : null}
                    onCopyTo={onCopyTo ? () => onCopyTo([{ name: folder.name, handle: folder.handle, parentHandle: currentHandle, kind: 'directory' }]) : null}
                    clipboard={clipboard}
                    onClipboardPaste={onClipboardPaste}
                    isInMultiSelect={isMulti && selectedIds.has(folder.id)}
                    multiSelectCount={selectedIds.size}
                    multiAllFav={multiAllFav}
                    multiCommonTags={multiCommonTags}
                    onMultiDelete={onDeleteFolder ? handleMultiDelete : null}
                    onMultiSetColor={handleMultiSetColor}
                    onMultiToggleFav={handleMultiToggleFav}
                    onMultiSetTags={handleMultiSetTags}
                    onMultiClipboardCut={onClipboardCut ? handleMultiCut : null}
                    onMultiClipboardCopy={onClipboardCopy ? handleMultiCopy : null}
                    onMultiSendTo={onSendTo ? handleMultiSendTo : null}
                    onMultiCopyTo={onCopyTo ? handleMultiCopyTo : null}
                    isCut={clipboard?.mode === 'cut' && clipboard.items.some(it => it.handle === folder.handle)}
                    cardRef={el => {
                      if (el) cardElemsRef.current.set(folder.id, el)
                      else cardElemsRef.current.delete(folder.id)
                    }}
                    {...handlers}
                  />
                )
              })}
            </div>
          )}
        </div>
      ))}

      {emptyCtxMenu && (
        <ContextMenu
          x={emptyCtxMenu.x}
          y={emptyCtxMenu.y}
          items={[
            ...(clipboard ? [{
              label: `paste "${clipboard.items[0]?.name}"`,
              icon: clipboard.mode === 'cut' ? '✂' : '⎘',
              onClick: () => onClipboardPaste?.(),
            }, { separator: true }] : []),
            ...(onNewFolder ? [{ label: 'new folder', icon: '+', onClick: () => {
              setNewFolderPos({ x: emptyCtxMenu.x, y: emptyCtxMenu.y })
              setNewFolderName('')
              setTimeout(() => newFolderRef.current?.focus(), 0)
            }}] : []),
          ]}
          onClose={() => setEmptyCtxMenu(null)}
        />
      )}

      {newFolderPos && onNewFolder && (
        <NewFolderFloating
          inputRef={newFolderRef}
          x={newFolderPos.x}
          y={newFolderPos.y}
          value={newFolderName}
          onChange={setNewFolderName}
          onSubmit={() => {
            const n = newFolderName.trim()
            if (n) onNewFolder(n)
            setNewFolderPos(null); setNewFolderName('')
          }}
          onCancel={() => { setNewFolderPos(null); setNewFolderName('') }}
        />
      )}

      {multiDeletePending && (
        <div style={styles.confirmOverlay} onMouseDown={e => e.stopPropagation()}>
          <div style={styles.confirmBox}>
            <div style={styles.confirmTitle}>Delete {multiDeletePending.length} Folder{multiDeletePending.length !== 1 ? 's' : ''}?</div>
            <div style={styles.confirmMsg}>
              {multiDeletePending.slice(0, 5).map(f => (
                <div key={f.name}><strong>"{f.name}"</strong></div>
              ))}
              {multiDeletePending.length > 5 && <div style={{ marginTop: 4 }}>…and {multiDeletePending.length - 5} more</div>}
              <div style={{ marginTop: 8 }}>All contents will be permanently deleted from disk.</div>
            </div>
            <div style={styles.confirmBtns}>
              <button style={styles.confirmNo}  onClick={() => setMultiDeletePending(null)}>no, cancel</button>
              <button style={styles.confirmYes} onClick={handleMultiDeleteConfirm}>yes, delete all</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

function NewFolderFloating({ inputRef, x, y, value, onChange, onSubmit, onCancel }) {
  useEffect(() => {
    function onDown(e) {
      if (!e.target.closest('[data-newfolder]')) onCancel()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  return (
    <div
      data-newfolder="1"
      style={{
        position: 'fixed', left: x, top: y, zIndex: 300,
        display: 'flex', alignItems: 'center', gap: 4,
        background: 'var(--bg-surface)', border: '0.5px solid var(--border-mid)',
        borderRadius: 'var(--radius-sm)', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        padding: '6px 8px',
      }}
    >
      <input
        ref={inputRef}
        autoFocus
        value={value}
        placeholder="folder name"
        style={{
          fontSize: 'var(--fs-11)', fontFamily: 'var(--font-mono)',
          background: 'var(--bg-deep)', color: 'var(--text-primary)',
          border: '0.5px solid var(--accent)', borderRadius: 'var(--radius-sm)',
          padding: '3px 7px', outline: 'none', width: 140,
        }}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter')  { e.stopPropagation(); onSubmit() }
          if (e.key === 'Escape') { e.stopPropagation(); onCancel() }
        }}
      />
      <button onClick={onSubmit} style={{ fontSize: 'var(--fs-11)', color: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>✓</button>
      <button onClick={onCancel} style={{ fontSize: 'var(--fs-11)', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>✕</button>
    </div>
  )
}

function FolderCard({
  folder, pathKey, onOpen, onSelect, isSelected, canReorder,
  getImageUrl, folderMeta, rootAbsPath = '',
  isDragging, isDragInto, isFileDragOver,
  onDeleteFolder, onRefresh,
  onClipboardCut, onClipboardCopy, clipboard, onClipboardPaste,
  onSendTo, onCopyTo,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  cardRef,
  isInMultiSelect, multiSelectCount,
  multiAllFav, multiCommonTags,
  onMultiDelete, onMultiSetColor, onMultiToggleFav, onMultiSetTags,
  onMultiClipboardCut, onMultiClipboardCopy,
  onMultiSendTo, onMultiCopyTo,
  isCut = false,
}) {
  const [thumbUrl,      setThumbUrl]      = useState(null)
  const [thumbVersion,  setThumbVersion]  = useState(0)
  const [hovered,       setHovered]       = useState(false)
  const [contextMenu,   setContextMenu]   = useState(null)
  const [preview,       setPreview]       = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [renaming,      setRenaming]      = useState(false)
  const [renameError,   setRenameError]   = useState(null)
  const renameInputRef = useRef()
  const previewTimer     = useRef(null)
  const previewUrlsRef   = useRef([])
  const previewCancelRef = useRef(0)
  const innerCardRef   = useRef()

  const color = folderMeta.getFolderColor(pathKey)
  const isFav = folderMeta.isFolderFav(pathKey)
  const mode  = folderMeta.getFolderMode(pathKey)

  useEffect(() => {
    let url = null
    let cancelled = false
    async function load() {
      const customHandle = await folderMeta.getCustomThumb(pathKey)
      const src = customHandle || folder.thumbnailHandle
      if (!src) return
      try { url = await createThumbnail(src, 300) }
      catch { url = await getImageUrl(src).catch(() => null) }
      if (!cancelled && url) setThumbUrl(url)
      else if (cancelled && url) URL.revokeObjectURL(url)
    }
    load()
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [pathKey, folder.thumbnailHandle, thumbVersion])

  useEffect(() => {
    function onScroll() { stopPreview(); setHovered(false) }
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      clearTimeout(previewTimer.current)
      previewUrlsRef.current.forEach(item => URL.revokeObjectURL(item.url ?? item))
    }
  }, [])

  function startPreview() {
    if (folder.imageCount === 0) return
    const token = ++previewCancelRef.current
    previewTimer.current = setTimeout(async () => {
      const urls = []
      try {
        for await (const [name, h] of folder.handle.entries()) {
          if (previewCancelRef.current !== token) {
            urls.forEach(item => URL.revokeObjectURL(item.url ?? item))
            return
          }
          if (h.kind === 'file' && (IMAGE_RE.test(name) || VIDEO_RE.test(name))) {
            try {
              const isVideo = VIDEO_RE.test(name)
              const u = isVideo
                ? URL.createObjectURL(await h.getFile())
                : await createThumbnail(h, 120).catch(() => getImageUrl(h))
              urls.push({ url: u, isVideo })
              if (urls.length >= 6) break
            } catch {}
          }
        }
      } catch {}
      if (previewCancelRef.current !== token) {
        urls.forEach(item => URL.revokeObjectURL(item.url ?? item))
        return
      }
      previewUrlsRef.current = urls
      setPreview(urls)
    }, 420)
  }

  function stopPreview() {
    previewCancelRef.current++
    clearTimeout(previewTimer.current)
    previewUrlsRef.current.forEach(item => URL.revokeObjectURL(item.url ?? item))
    previewUrlsRef.current = []
    setPreview(null)
  }

  async function handleChangeThumbnail() {
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [{ description: 'Images', accept: { 'image/*': ['.jpg','.jpeg','.png','.gif','.webp','.avif'] } }],
        multiple: false,
      })
      await folderMeta.setCustomThumb(pathKey, fileHandle)
      setThumbVersion(v => v + 1)
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err)
    }
  }

  async function handleResetThumbnail() {
    await folderMeta.setCustomThumb(pathKey, null)
    setThumbUrl(null)
    setThumbVersion(v => v + 1)
  }

  async function doRename(newName) {
    newName = newName.trim()
    setRenaming(false)
    if (!newName || newName === folder.name) return
    try {
      await folder.handle.move(newName)
      const pp = pathKey.slice(0, pathKey.lastIndexOf('/'))
      folderMeta.renameFolderPath(pathKey, pp + '/' + newName, pp, folder.name, newName)
      onRefresh?.()
    } catch (err) {
      console.warn('Rename failed:', err)
      setRenameError('rename failed — try again')
      setTimeout(() => setRenameError(null), 3000)
    }
  }

  const itemTags = folderMeta.getItemTags(pathKey)
  const allTags  = folderMeta.getAllTags()
  const sortName = folderMeta.getSortName ? folderMeta.getSortName(pathKey) : null

  const contextItems = isInMultiSelect ? [
    { label: `${multiSelectCount} folders selected`, disabled: true },
    { separator: true },
    { label: multiAllFav ? 'remove from favorites' : 'add to favorites', icon: multiAllFav ? '★' : '☆', onClick: onMultiToggleFav },
    { separator: true },
    { colorRow: true, value: null, onChange: onMultiSetColor },
    { separator: true },
    { tagRow: true, tags: multiCommonTags, onChange: onMultiSetTags, allTags, getTagColor: folderMeta.getTagColor },
    { separator: true },
    ...(onMultiClipboardCopy ? [{ label: `copy ${multiSelectCount} folders`, icon: '⎘', onClick: onMultiClipboardCopy }] : []),
    ...(onMultiClipboardCut  ? [{ label: `cut ${multiSelectCount} folders`,  icon: '✂', onClick: onMultiClipboardCut  }] : []),
    ...(onMultiSendTo ? [{ label: `send ${multiSelectCount} folders to…`, icon: '→', onClick: onMultiSendTo }] : []),
    ...(onMultiCopyTo ? [{ label: `copy ${multiSelectCount} folders to…`, icon: '⎘', onClick: onMultiCopyTo }] : []),
    ...(clipboard ? [{ label: `paste "${clipboard.items[0]?.name}"`, icon: clipboard.mode === 'cut' ? '✂' : '⎘', onClick: onClipboardPaste }] : []),
    ...(onMultiDelete ? [{ separator: true }, { label: `delete ${multiSelectCount} folders`, icon: '✕', danger: true, onClick: onMultiDelete }] : []),
  ] : [
    { sortNameRow: true, name: folder.name, sortName, onSet: name => folderMeta.setSortName(pathKey, name) },
    { separator: true },
    { label: 'rename', icon: '✎', onClick: () => { setRenaming(true); setTimeout(() => renameInputRef.current?.focus(), 0) } },
    { separator: true },
    { label: mode === 'board' ? 'board mode  ✓' : 'board mode', icon: '⊞', onClick: () => folderMeta.setFolderMode(pathKey, mode === 'board' ? 'grid' : 'board') },
    { separator: true },
    { label: isFav ? 'remove from favorites' : 'add to favorites', icon: isFav ? '★' : '☆', onClick: () => folderMeta.toggleFolderFav(pathKey) },
    { separator: true },
    { colorRow: true, value: color, onChange: hex => folderMeta.setFolderColor(pathKey, hex) },
    { separator: true },
    { tagRow: true, tags: itemTags, onChange: ts => folderMeta.setItemTags(pathKey, ts), allTags, getTagColor: folderMeta.getTagColor },
    { separator: true },
    { linkRow: true, link: folderMeta.getItemLink(pathKey), onChange: link => folderMeta.setItemLink(pathKey, link) },
    { separator: true },
    { label: 'change thumbnail', icon: '⬚', onClick: handleChangeThumbnail },
    { label: 'reset thumbnail',  icon: '↺',  onClick: handleResetThumbnail, disabled: !folder.thumbnailHandle },
    { separator: true },
    { label: 'show in explorer', icon: '↗', disabled: !rootAbsPath, badge: !rootAbsPath ? 'set path in settings' : undefined, onClick: () => {
        const segs = pathKey.split('/').slice(1)
        const base = rootAbsPath.replace(/[/\\]+$/, '')
        const fullPath = segs.length > 0 ? base + '\\' + segs.join('\\') : base
        openInExplorer(fullPath)
      }
    },
    { separator: true },
    ...(onClipboardCopy ? [{ label: 'copy folder', icon: '⎘', onClick: onClipboardCopy }] : []),
    ...(onClipboardCut  ? [{ label: 'cut folder',  icon: '✂', onClick: onClipboardCut  }] : []),
    ...(onSendTo ? [{ label: 'send to…', icon: '→', onClick: onSendTo }] : []),
    ...(onCopyTo ? [{ label: 'copy to…', icon: '⎘', onClick: onCopyTo }] : []),
    ...(clipboard ? [{ label: `paste "${clipboard.items[0]?.name}"`, icon: clipboard.mode === 'cut' ? '✂' : '⎘', onClick: onClipboardPaste }] : []),
    ...(onDeleteFolder  ? [{ separator: true }, { label: 'delete folder', icon: '✕', danger: true, onClick: () => setConfirmDelete(true) }] : []),
  ]

  const metaParts = []
  if (folder.subfolderCount > 0) metaParts.push(`${folder.subfolderCount} folder${folder.subfolderCount !== 1 ? 's' : ''}`)
  if (folder.imageCount     > 0) metaParts.push(`${folder.imageCount} file${folder.imageCount !== 1 ? 's' : ''}`)
  const meta = metaParts.join(' · ')

  let previewPos = null
  if (preview && preview.length > 0 && innerCardRef.current) {
    const r = innerCardRef.current.getBoundingClientRect()
    const pw = 300, ph = 220
    const left = window.innerWidth - r.right >= pw + 8 ? r.right + 6 : r.left - pw - 6
    const top  = Math.max(8, Math.min(r.top, window.innerHeight - ph - 8))
    previewPos = { left, top }
  }

  return (
    <>
      <div
        ref={el => { innerCardRef.current = el; cardRef?.(el) }}
        data-card="1"
        draggable={canReorder || isSelected}
        style={{
          ...styles.card,
          borderColor: color || (hovered ? 'var(--border-strong)' : 'var(--border-subtle)'),
          borderWidth: color ? 1.5 : 0.5,
          transform: hovered && !isDragging ? 'scale(1.02)' : 'scale(1)',
          opacity: isDragging ? 0.35 : isCut ? 0.4 : 1,
          cursor: canReorder ? (isDragging ? 'grabbing' : 'grab') : isSelected ? 'grab' : 'pointer',
          outline: (isDragInto || isFileDragOver) ? '2px solid var(--accent)' :
                   isSelected ? '1.5px solid var(--accent)' : undefined,
          outlineOffset: (isDragInto || isFileDragOver || isSelected) ? '3px' : undefined,
          transition: 'border-color 0.12s, transform 0.12s, opacity 0.1s, outline 0.07s',
        }}
        onClick={e => { e.stopPropagation(); if (!canReorder) { stopPreview(); onSelect?.(e) } }}
        onDoubleClick={() => { if (!canReorder) onOpen?.() }}
        onMouseEnter={() => { setHovered(true); if (!canReorder && !isDragging) startPreview() }}
        onMouseLeave={() => { setHovered(false); stopPreview() }}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY }) }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
      >
        <div style={styles.thumb}>
          {thumbUrl
            ? <img src={thumbUrl} alt={folder.name} style={styles.thumbImg} />
            : <PlaceholderThumb color={color} />}
          {hovered && (
            <div style={styles.thumbOverlay}>
              {canReorder
                ? <span style={styles.openHint}>drag to reorder</span>
                : !isSelected
                  ? <span style={styles.openHint}>select</span>
                  : null}
            </div>
          )}
        </div>
        {(() => {
          const contrast = color ? getContrastColor(color) : null
          return (
            <div style={{ ...styles.info, background: color || undefined }}>
              <div style={styles.nameRow}>
                {mode === 'board' && <span style={{ ...styles.favStar, color: contrast || 'var(--accent)', fontSize: 11 }}>⊞</span>}
                {isFav && <span style={{ ...styles.favStar, color: contrast || 'var(--accent)' }}>★</span>}
                {renaming ? (
                  <input
                    ref={renameInputRef}
                    autoFocus
                    defaultValue={folder.name}
                    style={{ ...styles.renameInput, color: contrast || undefined, borderColor: contrast ? contrast + '80' : undefined }}
                    onKeyDown={e => {
                      e.stopPropagation()
                      if (e.key === 'Enter')  doRename(e.target.value)
                      if (e.key === 'Escape') setRenaming(false)
                    }}
                    onBlur={e => doRename(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onMouseDown={e => e.stopPropagation()}
                  />
                ) : (
                  <div style={{ ...styles.name, color: contrast || undefined }}>{folder.name}</div>
                )}
              </div>
              {renameError && <div style={styles.renameError}>{renameError}</div>}
              <div style={{ ...styles.meta, color: contrast ? contrast + 'a0' : undefined }}>{meta}</div>
              {itemTags.length > 0 && (
                <div style={styles.tagChips}>
                  {itemTags.map(t => {
                    const tc = folderMeta.getTagColor(t)
                    return (
                      <span key={t} style={{ ...styles.tagChip, color: tc || contrast || undefined, borderColor: tc ? tc + '60' : contrast ? contrast + '60' : undefined }}>
                        {tc && <span style={{ width: 5, height: 5, borderRadius: '50%', background: tc, display: 'inline-block', marginRight: 2, verticalAlign: 'middle' }} />}
                        {t}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })()}
      </div>

      {previewPos && (
        <div style={{ ...styles.previewPanel, left: previewPos.left, top: previewPos.top }}>
          {preview.map((item, i) => (
            item.isVideo
              ? <video key={i} src={item.url} style={styles.previewImg} muted autoPlay loop playsInline />
              : <img key={i} src={item.url} alt="" style={styles.previewImg} />
          ))}
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {confirmDelete && (
        <div style={styles.confirmOverlay} onMouseDown={e => e.stopPropagation()}>
          <div style={styles.confirmBox}>
            <div style={styles.confirmTitle}>Delete Folder?</div>
            <div style={styles.confirmMsg}>
              <strong>"{folder.name}"</strong> and all its contents will be permanently deleted from disk.
            </div>
            <div style={styles.confirmBtns}>
              <button style={styles.confirmNo}  onClick={() => setConfirmDelete(false)}>no, cancel</button>
              <button style={styles.confirmYes} onClick={() => { setConfirmDelete(false); onDeleteFolder() }}>yes, delete</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function PlaceholderThumb({ color }) {
  const bodyColor = color || FOLDER_YELLOW
  const tabColor  = darkenHex(bodyColor, 0.18)
  return (
    <svg width="100%" height="100%" viewBox="0 0 160 120" style={{ display: 'block' }}>
      <path d="M10,52 L10,40 Q10,36 14,36 L60,36 Q64,36 66,40 L72,52 Z" fill={tabColor} />
      <rect x="10" y="52" width="140" height="60" rx="6" fill={bodyColor} />
    </svg>
  )
}

const styles = {
  grid: { display: 'grid', gap: 10, padding: 16 },
  card: {
    borderRadius: 'var(--radius-lg)', overflow: 'hidden',
    border: '0.5px solid var(--border-subtle)',
    background: 'var(--bg-surface)',
    transition: 'border-color 0.12s, transform 0.12s',
    userSelect: 'none',
  },
  thumb: { width: '100%', aspectRatio: '4 / 3', overflow: 'hidden', position: 'relative', background: 'var(--bg-base)' },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  thumbOverlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  openHint: { fontSize: 'var(--fs-11)', color: 'var(--text-primary)', letterSpacing: '0.12em', opacity: 0.9 },
  info:    { padding: '8px 11px 10px' },
  nameRow: { display: 'flex', alignItems: 'center', gap: 5 },
  favStar: { fontSize: 'var(--fs-10)', flexShrink: 0 },
  name: { fontSize: 'var(--fs-14)', color: 'var(--text-secondary)', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 },
  meta: { fontSize: 'var(--fs-11)', color: 'var(--text-muted)', marginTop: 3 },
  renameInput: {
    flex: 1, fontSize: 'var(--fs-14)', fontWeight: 700, background: 'transparent',
    border: '0.5px solid var(--border-mid)', borderRadius: 3, outline: 'none',
    color: 'var(--text-secondary)', padding: '1px 4px', width: '100%', fontFamily: 'inherit',
  },
  renameError: { fontSize: 'var(--fs-9)', color: '#e05050', letterSpacing: '0.04em', marginTop: 2 },
  previewPanel: {
    position: 'fixed', zIndex: 500, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 3, padding: 6, background: 'var(--bg-raised)', border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)', boxShadow: '0 8px 28px rgba(0,0,0,0.65)', width: 300, pointerEvents: 'none',
  },
  previewImg: { width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 2, display: 'block' },
  groupHeader: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px 4px', borderBottom: '0.5px solid var(--border-subtle)' },
  groupChevron: { fontSize: 'var(--fs-9)', color: 'var(--text-muted)', flexShrink: 0, width: 10 },
  groupDot:     { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  groupStar:    { fontSize: 'var(--fs-10)', color: 'var(--accent)', flexShrink: 0 },
  groupLabel:   { fontSize: 'var(--fs-10)', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, flex: 1 },
  groupCount:   { fontSize: 'var(--fs-10)', color: 'var(--border-strong)', letterSpacing: '0.05em' },
  tagChips: { display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 },
  tagChip: { fontSize: 'var(--fs-9)', color: 'var(--text-muted)', border: '0.5px solid var(--border-subtle)', borderRadius: 2, padding: '1px 5px', letterSpacing: '0.04em', fontFamily: 'var(--font-mono)' },
  confirmOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  confirmBox: { background: 'var(--bg-surface)', border: '0.5px solid var(--border-mid)', borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.7)', padding: '22px 26px 18px', maxWidth: 340, width: '90vw' },
  confirmTitle: { fontSize: 'var(--fs-14)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 },
  confirmMsg:   { fontSize: 'var(--fs-12)', color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 18 },
  confirmBtns:  { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  confirmNo:  { fontSize: 'var(--fs-11)', color: 'var(--text-muted)', background: 'var(--bg-raised)', border: '0.5px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--font-mono)' },
  confirmYes: { fontSize: 'var(--fs-11)', color: '#fff', background: '#c0392b', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 },
}
