import React, { useState, useEffect, useLayoutEffect, useRef } from 'react'
import ContextMenu from './ContextMenu.jsx'
import { writeFilesToDir, getImageFiles } from '../utils/fileImport.js'
import { setDragPayload, clearDragPayload } from '../utils/dragState.js'

const COL_W = { small: 100, medium: 140, large: 200 }
const EXT_MAP = { jpg: 'jpeg', jpeg: 'jpeg', tif: 'tiff', tiff: 'tiff' }

function sortImages(images, sortBy, isFavourited, sizes, folderMeta, parentPath) {
  const arr     = [...images]
  const getKey  = img => parentPath ? `${parentPath}/${img.name}` : img.name
  const sortKey = img => (folderMeta?.getSortName ? folderMeta.getSortName(getKey(img)) : null) || img.name
  switch (sortBy) {
    case 'favfirst':
      return arr.sort((a, b) => {
        const d = (isFavourited(b.id) ? 1 : 0) - (isFavourited(a.id) ? 1 : 0)
        return d !== 0 ? d : a.name.localeCompare(b.name)
      })
    case 'size':
      return arr.sort((a, b) => {
        const sa = sizes[a.id] ?? -1, sb = sizes[b.id] ?? -1
        return sa !== sb ? sb - sa : a.name.localeCompare(b.name)
      })
    case 'custom': {
      const order = folderMeta ? folderMeta.getImageOrder(parentPath) : []
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

function groupImages(sorted, groupBy, isFavourited, folderMeta, parentPath) {
  if (!groupBy || groupBy === 'none') return [{ label: null, images: sorted }]

  const groups = {}
  sorted.forEach(img => {
    const pk = parentPath ? `${parentPath}/${img.name}` : img.name
    let key
    if (groupBy === 'favorite') {
      key = isFavourited(img.id) ? '__fav__' : '__none__'
    } else if (groupBy === 'tag') {
      const ts = folderMeta ? folderMeta.getItemTags(pk) : []
      key = ts.length > 0 ? ts[0] : '__none__'
    } else if (groupBy === 'type') {
      if (img.mediaType === 'video') {
        key = 'video'
      } else {
        const ext = img.name.split('.').pop()?.toLowerCase() || 'other'
        key = EXT_MAP[ext] || ext
      }
    } else {
      key = '__none__'
    }
    if (!groups[key]) groups[key] = []
    groups[key].push(img)
  })

  return Object.entries(groups)
    .sort(([a], [b]) => {
      if (a === '__fav__') return -1
      if (b === '__fav__') return 1
      if (a === '__none__') return 1
      if (b === '__none__') return -1
      return a.localeCompare(b)
    })
    .map(([key, images]) => ({
      label: key === '__none__'
        ? (groupBy === 'favorite' ? 'not favorited' : groupBy === 'tag' ? 'untagged' : 'other')
        : key === '__fav__' ? 'favorited' : key,
      isFav: key === '__fav__',
      images,
    }))
}

function rectsOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

export default function ImageGrid({
  loadImages, folderHandle, getImageUrl,
  isFavourited, onToggleFavourite,
  iconSize = 'medium', hideWhenEmpty, sortBy = 'alpha',
  groupBy = 'none',
  parentPath = '', folderMeta = null,
  clipboard, onClipboardCut, onClipboardCopy, onClipboardPaste,
  onSendTo, onCopyTo,
  reorderMode = false,
  imageRefreshKey = 0,
  fillHeight = false,
}) {
  const [loaded,   setLoaded]   = useState([])
  const [loading,  setLoading]  = useState(true)
  const [lightbox, setLightbox] = useState(null)
  const [sizes,    setSizes]    = useState({})

  // Multi-selection
  const [selectedIds,     setSelectedIds]     = useState(new Set())
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())

  // Marquee
  const [marquee,   setMarquee]   = useState(null)
  const marqueeRef         = useRef(null)
  const marqueeWasDrawnRef = useRef(false)
  const containerRef = useRef(null)
  const cardElemsRef = useRef(new Map()) // img.id → DOM element

  // ── REORDER MODE drag state ──────────────────────────────────────────────
  const [reorderSrc,  setReorderSrc]  = useState(null)
  const [reorderOver, setReorderOver] = useState(null)
  const reorderSrcRef  = useRef(null)
  const reorderOverRef = useRef(null)
  const sortedRef      = useRef([])

  // OS file drop
  const [fileDragging, setFileDragging] = useState(false)

  const [multiDeletePending, setMultiDeletePending] = useState(null)
  const deleteSelectedRef = useRef(null)
  const clipboardCopyRef  = useRef(null)
  const clipboardCutRef   = useRef(null)

  const canReorder = reorderMode && sortBy === 'custom' && groupBy === 'none'

  useEffect(() => {
    setLoaded([])
    setLoading(true)
    setSizes({})
    loadImages(folderHandle).then(imgs => { setLoaded(imgs); setLoading(false) })
  }, [folderHandle])

  useEffect(() => {
    if (imageRefreshKey === 0) return
    loadImages(folderHandle).then(imgs => setLoaded(imgs))
  }, [imageRefreshKey])

  useEffect(() => {
    if (reorderMode) setSelectedIds(new Set())
  }, [reorderMode])

  // loading is in deps so the effect re-runs once the main div actually mounts
  // (during loading the component returns a different element, containerRef.current is null)
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
  }, [fillHeight, loading])

  useEffect(() => {
    function onKeyDown(e) {
      if (!(e.ctrlKey || e.metaKey) || (e.key !== 'a' && e.key !== 'd')) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      e.preventDefault()
      if (e.key === 'a') setSelectedIds(new Set(sortedRef.current.map(img => img.id)))
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

  useEffect(() => {
    async function onPaste(e) {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const files = getImageFiles(e)
      if (files.length === 0 || !folderHandle) return
      e.preventDefault()
      await writeFilesToDir(folderHandle, files)
      loadImages(folderHandle).then(setLoaded)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [folderHandle, loadImages])

  useEffect(() => {
    if (sortBy !== 'size' || loaded.length === 0) return
    loaded.forEach(async img => {
      if (sizes[img.id] !== undefined) return
      try { const file = await img.handle.getFile(); setSizes(prev => ({ ...prev, [img.id]: file.size })) } catch {}
    })
  }, [sortBy, loaded])

  useEffect(() => {
    if (!lightbox) return
    const handler = e => {
      if (e.key === 'Escape')     setLightbox(null)
      if (e.key === 'ArrowRight') navigateLightbox(1)
      if (e.key === 'ArrowLeft')  navigateLightbox(-1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightbox, loaded])

  function navigateLightbox(dir) {
    setLightbox(prev => {
      if (!prev) return null
      const next = (prev.index + dir + loaded.length) % loaded.length
      return { index: next, url: null, image: loaded[next] }
    })
  }

  async function openLightbox(image) {
    const url = await getImageUrl(image.handle)
    setLightbox({ index: loaded.indexOf(image), url, image })
  }

  function toggleGroup(label) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  // ── Marquee mouse handlers ───────────────────────────────────────────────
  function onContainerMouseDown(e) {
    if (canReorder) return
    if (e.button !== 0) return
    if (e.target.closest('[data-card]')) return
    if (e.target.closest('[data-contextmenu]')) return

    const cr0 = containerRef.current?.getBoundingClientRect()
    if (!cr0) return

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

  if (loading) {
    deleteSelectedRef.current = null; clipboardCopyRef.current = null; clipboardCutRef.current = null
    return <div style={styles.loadingState}><div style={styles.loadingText}>loading images...</div></div>
  }

  if (loaded.length === 0) {
    deleteSelectedRef.current = null; clipboardCopyRef.current = null; clipboardCutRef.current = null
    if (hideWhenEmpty) return null
    return <div style={styles.emptyState}><div style={styles.emptyTitle}>no images here</div><div style={styles.emptyMeta}>this folder contains only subfolders</div></div>
  }

  const sorted  = sortImages(loaded, sortBy, isFavourited, sizes, folderMeta, parentPath)
  sortedRef.current = sorted
  const colSize = COL_W[iconSize] || 140
  const groups  = groupImages(sorted, groupBy, isFavourited, folderMeta, parentPath)

  function handleImageRename(oldName, newName) {
    setLoaded(prev => prev.map(img => img.name === oldName ? { ...img, id: newName, name: newName } : img))
  }

  function handleDeleteFromFolder(img) {
    setLoaded(prev => prev.filter(i => i.id !== img.id))
    folderHandle.removeEntry(img.name).catch(err => console.warn('delete failed:', err))
  }

  async function handleMultiDeleteConfirm() {
    const toDelete = multiDeletePending
    setMultiDeletePending(null)
    setSelectedIds(new Set())
    if (!toDelete || !folderHandle) return
    for (const img of toDelete) {
      await folderHandle.removeEntry(img.name).catch(() => {})
    }
    setLoaded(prev => {
      const ids = new Set(toDelete.map(d => d.id))
      return prev.filter(i => !ids.has(i.id))
    })
  }

  // Keep these refs current so stable keydown listeners can call them
  deleteSelectedRef.current = selectedIds.size > 0 ? () => {
    const toDelete = sorted.filter(img => selectedIds.has(img.id))
    if (toDelete.length > 0) setMultiDeletePending(toDelete)
  } : null

  clipboardCopyRef.current = selectedIds.size > 0 && onClipboardCopy ? () => {
    const items = sorted.filter(img => selectedIds.has(img.id))
      .map(img => ({ name: img.name, handle: img.handle, parentHandle: folderHandle, kind: 'file' }))
    onClipboardCopy({ items })
  } : null

  clipboardCutRef.current = selectedIds.size > 0 && onClipboardCut ? () => {
    const items = sorted.filter(img => selectedIds.has(img.id))
      .map(img => ({ name: img.name, handle: img.handle, parentHandle: folderHandle, kind: 'file' }))
    onClipboardCut({ items })
    setSelectedIds(new Set())
  } : null

  function applyReorder(srcIdx, overIdx, side) {
    if (srcIdx === null || overIdx === null || srcIdx === overIdx) return
    const names = sorted.map(img => img.name)
    const [moved] = names.splice(srcIdx, 1)
    const adjTarget = srcIdx < overIdx ? overIdx - 1 : overIdx
    const insertAt  = side === 'after' ? adjTarget + 1 : adjTarget
    names.splice(Math.max(0, Math.min(insertAt, names.length)), 0, moved)
    if (folderMeta) folderMeta.setImageOrder(parentPath, names)
  }

  async function handleAreaFileDrop(e) {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.stopPropagation()
    setFileDragging(false)
    const files = getImageFiles(e)
    if (files.length === 0 || !folderHandle) return
    await writeFilesToDir(folderHandle, files)
    loadImages(folderHandle).then(setLoaded)
  }

  return (
    <div
      ref={containerRef}
      data-gridbg="1"
      style={{ position: 'relative', userSelect: 'none' }}
      onMouseDown={onContainerMouseDown}
      onClick={e => {
        if (marqueeWasDrawnRef.current) { marqueeWasDrawnRef.current = false; return }
        if (!e.target.closest('[data-card]')) setSelectedIds(new Set())
      }}
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setFileDragging(true) } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFileDragging(false) }}
      onDrop={handleAreaFileDrop}
    >
      {fileDragging && (
        <div style={styles.dropOverlay}>
          <span style={styles.dropHint}>drop images here to add to folder</span>
        </div>
      )}

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
              {group.isFav && <span style={styles.groupStar}>★</span>}
              <span style={styles.groupLabel}>{group.label}</span>
              <span style={styles.groupCount}>{group.images.length}</span>
            </div>
          )}
          {(!group.label || !collapsedGroups.has(group.label)) && (
            <div data-gridbg="1" style={{ ...styles.grid, gridTemplateColumns: `repeat(auto-fill, minmax(${colSize}px, 1fr))` }}>
              {group.images.map((img, fi) => {
                const isSelected = selectedIds.has(img.id)

                // ── Reorder mode handlers ────────────────────────────────
                const reorderHandlers = canReorder ? {
                  onDragStart: e => {
                    reorderSrcRef.current = fi; setReorderSrc(fi)
                    e.dataTransfer.effectAllowed = 'move'
                  },
                  onDragOver: e => {
                    e.preventDefault()
                    const rect = e.currentTarget.getBoundingClientRect()
                    const side = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
                    if (reorderOverRef.current?.index !== fi || reorderOverRef.current?.side !== side) {
                      reorderOverRef.current = { index: fi, side }
                      setReorderOver({ index: fi, side })
                    }
                  },
                  onDragLeave: e => {
                    if (e.currentTarget.contains(e.relatedTarget)) return
                    if (reorderOverRef.current?.index === fi) {
                      reorderOverRef.current = null; setReorderOver(null)
                    }
                  },
                  onDrop: e => {
                    e.preventDefault()
                    const src  = reorderSrcRef.current
                    const side = reorderOverRef.current?.side ?? 'before'
                    reorderSrcRef.current = null; reorderOverRef.current = null
                    setReorderSrc(null); setReorderOver(null)
                    applyReorder(src, fi, side)
                  },
                  onDragEnd: () => {
                    reorderSrcRef.current = null; reorderOverRef.current = null
                    setReorderSrc(null); setReorderOver(null)
                  },
                } : {}

                // ── Normal mode handlers ─────────────────────────────────
                const moveHandlers = !canReorder ? {
                  onDragStart: isSelected ? e => {
                    e.dataTransfer.effectAllowed = 'move'
                    e.dataTransfer.setData('application/x-graphic-board', 'file')
                    const count = selectedIds.size
                    if (count > 1) {
                      setDragPayload({
                        kind: 'multi',
                        items: sorted
                          .filter(i => selectedIds.has(i.id))
                          .map(i => ({ kind: 'file', name: i.name, handle: i.handle, parentHandle: folderHandle })),
                      })
                    } else {
                      setDragPayload({ kind: 'file', name: img.name, handle: img.handle, parentHandle: folderHandle })
                    }
                    const ghost = document.createElement('div')
                    ghost.style.cssText = 'position:fixed;top:-999px;left:-999px;padding:5px 11px;background:var(--bg-raised);border:1px solid var(--accent);border-radius:6px;color:var(--accent);font-size:12px;font-family:monospace;box-shadow:0 4px 12px rgba(0,0,0,0.5);white-space:nowrap;pointer-events:none'
                    ghost.textContent = count > 1 ? `${count} images` : img.name
                    document.body.appendChild(ghost)
                    e.dataTransfer.setDragImage(ghost, 14, 14)
                    requestAnimationFrame(() => { if (ghost.parentNode) ghost.parentNode.removeChild(ghost) })
                  } : undefined,
                  onDragOver: e => e.preventDefault(),
                  onDragLeave: undefined,
                  onDrop: e => e.preventDefault(),
                  onDragEnd: () => clearDragPayload(),
                } : {}

                const handlers = canReorder ? reorderHandlers : moveHandlers

                return (
                  <ImageCard
                    key={img.id}
                    image={img}
                    getImageUrl={getImageUrl}
                    favourited={isFavourited(img.id)}
                    onToggleFavourite={() => onToggleFavourite(img.id)}
                    onOpen={() => openLightbox(img)}
                    onSelect={e => {
                      if (e.shiftKey) {
                        setSelectedIds(prev => {
                          const next = new Set(prev)
                          if (next.has(img.id)) next.delete(img.id)
                          else next.add(img.id)
                          return next
                        })
                      } else {
                        setSelectedIds(new Set([img.id]))
                      }
                    }}
                    isSelected={isSelected}
                    canReorder={canReorder}
                    pathKey={parentPath ? `${parentPath}/${img.name}` : img.name}
                    folderMeta={folderMeta}
                    onRenameImage={handleImageRename}
                    onDeleteFromFolder={() => handleDeleteFromFolder(img)}
                    onClipboardCut={onClipboardCut ? () => onClipboardCut({ name: img.name, handle: img.handle, parentHandle: folderHandle, kind: 'file' }) : null}
                    onClipboardCopy={onClipboardCopy ? () => onClipboardCopy({ name: img.name, handle: img.handle, parentHandle: folderHandle, kind: 'file' }) : null}
                    onSendTo={onSendTo ? () => onSendTo([{ name: img.name, handle: img.handle, parentHandle: folderHandle, kind: 'file' }]) : null}
                    onCopyTo={onCopyTo ? () => onCopyTo([{ name: img.name, handle: img.handle, parentHandle: folderHandle, kind: 'file' }]) : null}
                    clipboard={clipboard}
                    onClipboardPaste={onClipboardPaste}
                    isDragging={canReorder ? reorderSrc === fi : false}
                    isDragOver={canReorder && reorderOver?.index === fi ? reorderOver.side : null}
                    isCut={clipboard?.mode === 'cut' && clipboard.items.some(it => it.handle === img.handle)}
                    cardRef={el => {
                      if (el) cardElemsRef.current.set(img.id, el)
                      else cardElemsRef.current.delete(img.id)
                    }}
                    {...handlers}
                  />
                )
              })}
            </div>
          )}
        </div>
      ))}

      {lightbox && (
        <Lightbox
          image={lightbox.image}
          url={lightbox.url}
          index={lightbox.index}
          total={loaded.length}
          getImageUrl={getImageUrl}
          favourited={isFavourited(lightbox.image.id)}
          onToggleFavourite={() => onToggleFavourite(lightbox.image.id)}
          onClose={() => setLightbox(null)}
          onPrev={() => navigateLightbox(-1)}
          onNext={() => navigateLightbox(1)}
        />
      )}

      {multiDeletePending && (
        <div style={styles.confirmOverlay} onMouseDown={e => e.stopPropagation()}>
          <div style={styles.confirmBox}>
            <div style={styles.confirmTitle}>Delete {multiDeletePending.length} File{multiDeletePending.length !== 1 ? 's' : ''}?</div>
            <div style={styles.confirmMsg}>
              {multiDeletePending.slice(0, 5).map(img => (
                <div key={img.name}><strong>"{img.name}"</strong></div>
              ))}
              {multiDeletePending.length > 5 && <div style={{ marginTop: 4 }}>…and {multiDeletePending.length - 5} more</div>}
              <div style={{ marginTop: 8 }}>Files will be permanently deleted from disk.</div>
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

function Lightbox({ image, url, getImageUrl, favourited, onToggleFavourite, onClose, onPrev, onNext, index, total }) {
  const [resolvedUrl, setResolvedUrl] = useState(url)

  useEffect(() => {
    if (url) { setResolvedUrl(url); return }
    let cancelled = false
    let objectUrl = null
    getImageUrl(image.handle).then(u => {
      objectUrl = u
      if (!cancelled) setResolvedUrl(u)
      else URL.revokeObjectURL(u)
    })
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [image, url])

  return (
    <div style={styles.lightboxBackdrop} onClick={onClose}>
      <div style={styles.lightboxInner} onClick={e => e.stopPropagation()}>
        {resolvedUrl ? (
          image.mediaType === 'video'
            ? <video src={resolvedUrl} controls autoPlay style={styles.lightboxVideo} />
            : <img src={resolvedUrl} alt={image.name} style={styles.lightboxImg} />
        ) : (
          <div style={styles.lightboxLoading}>loading...</div>
        )}
      </div>
      <div style={styles.lightboxBar} onClick={e => e.stopPropagation()}>
        <button style={styles.lbNavBtn} onClick={onPrev}>←</button>
        <div style={styles.lightboxMeta}>
          <span style={styles.lightboxName}>{image.name}</span>
          <span style={styles.lightboxCount}>{index + 1} / {total}</span>
        </div>
        <button
          style={{ ...styles.lbIconBtn, color: favourited ? 'var(--accent)' : 'var(--text-muted)' }}
          onClick={onToggleFavourite}
          title={favourited ? 'unfavourite' : 'favourite'}
        >{favourited ? '★' : '☆'}</button>
        <button style={styles.lbNavBtn} onClick={onNext}>→</button>
        <button style={styles.lbCloseBtn} onClick={onClose} title="close (Esc)">✕</button>
      </div>
      <div style={styles.lightboxHint}>click outside or press Esc to close</div>
    </div>
  )
}

function ImageCard({
  image, getImageUrl, favourited, onToggleFavourite, onOpen, onSelect, isSelected, canReorder,
  pathKey, folderMeta,
  isDragging, isDragOver,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  onRenameImage, onDeleteFromFolder,
  onClipboardCut, onClipboardCopy, clipboard, onClipboardPaste,
  onSendTo, onCopyTo,
  cardRef,
  isCut = false,
}) {
  const [url,         setUrl]         = useState(null)
  const [hovered,     setHovered]     = useState(false)
  const [contextMenu, setContextMenu] = useState(null)

  useEffect(() => {
    let cancelled = false
    let objectUrl = null
    getImageUrl(image.handle).then(u => {
      objectUrl = u
      if (!cancelled) setUrl(u)
      else URL.revokeObjectURL(u)
    })
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [image.handle])

  const itemTags = folderMeta ? folderMeta.getItemTags(pathKey) : []
  const allTags  = folderMeta ? folderMeta.getAllTags() : []
  const sortName = folderMeta?.getSortName ? folderMeta.getSortName(pathKey) : null

  async function handleRename(newName) {
    await image.handle.move(newName)
    if (onRenameImage) onRenameImage(image.name, newName)
  }

  const contextItems = [
    ...(folderMeta ? [
      { sortNameRow: true, name: image.name, sortName, onSet: name => folderMeta.setSortName(pathKey, name) },
      { separator: true },
    ] : []),
    { label: favourited ? 'remove from favorites' : 'add to favorites', icon: favourited ? '★' : '☆', onClick: onToggleFavourite },
    { separator: true },
    ...(folderMeta ? [
      { tagRow: true, tags: itemTags, onChange: ts => folderMeta.setItemTags(pathKey, ts), allTags, getTagColor: folderMeta.getTagColor },
      { separator: true },
      { linkRow: true, link: folderMeta.getItemLink(pathKey), onChange: link => folderMeta.setItemLink(pathKey, link) },
      { separator: true },
    ] : []),
    { renameRow: true, name: image.name, onRename: handleRename },
    { separator: true },
    ...(onClipboardCopy ? [{ label: 'copy file', icon: '⎘', onClick: onClipboardCopy }] : []),
    ...(onClipboardCut  ? [{ label: 'cut file',  icon: '✂', onClick: onClipboardCut  }] : []),
    ...(onSendTo ? [{ label: 'send to…', icon: '→', onClick: onSendTo }] : []),
    ...(onCopyTo ? [{ label: 'copy to…', icon: '⎘', onClick: onCopyTo }] : []),
    ...(clipboard ? [{ label: `paste "${clipboard.items[0]?.name}"`, icon: clipboard.mode === 'cut' ? '✂' : '⎘', onClick: onClipboardPaste }] : []),
    { separator: true },
    { label: 'copy filename', icon: '⎘', feedback: 'copied!', onClick: () => navigator.clipboard.writeText(image.name).catch(() => {}) },
    ...(onDeleteFromFolder ? [{ separator: true }, { label: 'delete from folder', icon: '✕', onClick: onDeleteFromFolder }] : []),
  ]

  return (
    <>
      <div
        ref={cardRef}
        data-card="1"
        draggable={canReorder || isSelected}
        style={{
          ...styles.card,
          borderColor: favourited ? 'rgba(200,169,126,0.35)' : hovered ? 'var(--border-strong)' : 'var(--border-subtle)',
          transform: hovered && !isDragging ? 'scale(1.015)' : 'scale(1)',
          opacity: isDragging ? 0.35 : isCut ? 0.4 : 1,
          cursor: canReorder ? (isDragging ? 'grabbing' : 'grab') : isSelected ? 'grab' : 'pointer',
          boxShadow: isDragOver === 'before' ? '-3px 0 0 0 var(--accent)' :
                     isDragOver === 'after'  ? '3px 0 0 0 var(--accent)'  : undefined,
          outline: isSelected ? '1.5px solid var(--accent)' : undefined,
          outlineOffset: isSelected ? '3px' : undefined,
          transition: 'border-color 0.12s, transform 0.12s, box-shadow 0.07s, opacity 0.1s',
        }}
        onClick={e => { e.stopPropagation(); if (!canReorder) onSelect?.(e) }}
        onDoubleClick={() => { if (!canReorder) onOpen?.() }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }) }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
      >
        {url ? (
          image.mediaType === 'video'
            ? <video src={url} style={styles.img} preload="metadata" muted playsInline />
            : <img src={url} alt={image.name} style={styles.img} />
        ) : (
          <div style={styles.placeholder} />
        )}
        {image.mediaType === 'video' && <div style={styles.videoBadge}>▶</div>}
        {favourited && <div style={styles.favPip} />}
        {hovered && (
          <div style={styles.overlay}>
            <div style={styles.actions}>
              <button
                style={{ ...styles.iconBtn, color: favourited ? 'var(--accent)' : 'var(--text-primary)' }}
                onClick={e => { e.stopPropagation(); onToggleFavourite() }}
                title={favourited ? 'unfavourite' : 'favourite'}
              >{favourited ? '★' : '☆'}</button>
              {!canReorder && isSelected && (
                <button
                  style={styles.iconBtn}
                  onClick={e => { e.stopPropagation(); onOpen() }}
                  title="open preview"
                >⤢</button>
              )}
            </div>
            <div style={styles.imageName}>{image.name}</div>
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={contextItems}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}

const styles = {
  dropOverlay: {
    position: 'absolute', inset: 0, zIndex: 50,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(var(--accent-rgb, 74,159,212), 0.08)',
    border: '2px dashed var(--accent)', borderRadius: 6, pointerEvents: 'none',
  },
  dropHint: { fontSize: 'var(--fs-11)', color: 'var(--accent)', letterSpacing: '0.08em', background: 'var(--bg-surface)', padding: '6px 14px', borderRadius: 20, border: '0.5px solid var(--border-mid)' },
  lightboxBackdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' },
  lightboxInner: { maxWidth: '90vw', maxHeight: '80vh', cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  lightboxImg:     { maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 4, display: 'block' },
  lightboxVideo:   { maxWidth: '90vw', maxHeight: '80vh', borderRadius: 4, display: 'block', outline: 'none' },
  lightboxLoading: { fontSize: 'var(--fs-13)', color: 'var(--text-muted)', letterSpacing: '0.08em' },
  lightboxBar: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, padding: '8px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '0.5px solid var(--border-subtle)', cursor: 'default' },
  lightboxMeta:  { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 180 },
  lightboxName:  { fontSize: 'var(--fs-13)', color: 'var(--text-secondary)', letterSpacing: '0.03em', fontWeight: 700 },
  lightboxCount: { fontSize: 'var(--fs-11)', color: 'var(--text-muted)', letterSpacing: '0.08em' },
  lbNavBtn:   { fontSize: 'var(--fs-16)', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 9px', borderRadius: 4, transition: 'color 0.1s' },
  lbIconBtn:  { fontSize: 'var(--fs-16)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 7px', borderRadius: 4, transition: 'color 0.1s' },
  lbCloseBtn: { fontSize: 'var(--fs-13)', color: 'var(--text-muted)', background: 'transparent', border: '0.5px solid var(--border-mid)', cursor: 'pointer', padding: '4px 10px', borderRadius: 4, letterSpacing: '0.04em', transition: 'all 0.1s', fontFamily: 'var(--font-mono)' },
  lightboxHint: { marginTop: 10, fontSize: 'var(--fs-11)', color: 'var(--text-muted)', letterSpacing: '0.08em', opacity: 0.5 },
  grid: { display: 'grid', gap: 6, padding: 16 },
  card: { position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: 'var(--bg-raised)', border: '0.5px solid var(--border-subtle)', aspectRatio: '1', transition: 'border-color 0.12s, transform 0.12s', userSelect: 'none' },
  img:         { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  placeholder: { width: '100%', height: '100%', background: 'var(--bg-raised)' },
  favPip:     { position: 'absolute', top: 5, right: 5, width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', pointerEvents: 'none' },
  videoBadge: { position: 'absolute', top: 5, left: 5, fontSize: 'var(--fs-9)', color: 'rgba(255,255,255,0.85)', background: 'rgba(0,0,0,0.55)', borderRadius: 3, padding: '2px 5px', letterSpacing: '0.04em', pointerEvents: 'none' },
  overlay: { position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 55%)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 7 },
  actions: { display: 'flex', gap: 3, justifyContent: 'flex-end', marginBottom: 4 },
  iconBtn: { width: 22, height: 22, borderRadius: 3, background: 'rgba(0,0,0,0.55)', border: '0.5px solid rgba(255,255,255,0.08)', color: 'var(--text-primary)', fontSize: 'var(--fs-9)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s', cursor: 'pointer' },
  imageName: { fontSize: 'var(--fs-11)', color: 'rgba(232,228,220,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.03em', fontWeight: 700 },
  loadingState: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText:  { fontSize: 'var(--fs-13)', color: 'var(--text-muted)', letterSpacing: '0.08em' },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 40 },
  emptyTitle: { fontSize: 'var(--fs-14)', color: 'var(--text-muted)', fontWeight: 700 },
  emptyMeta:  { fontSize: 12, color: 'var(--border-strong)', textAlign: 'center', lineHeight: 1.8, maxWidth: 260 },
  groupHeader: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px 4px', borderBottom: '0.5px solid var(--border-subtle)' },
  groupChevron: { fontSize: 'var(--fs-9)', color: 'var(--text-muted)', flexShrink: 0, width: 10 },
  groupStar:    { fontSize: 'var(--fs-10)', color: 'var(--accent)', flexShrink: 0 },
  groupLabel:   { fontSize: 'var(--fs-10)', color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, flex: 1 },
  groupCount:   { fontSize: 'var(--fs-10)', color: 'var(--border-strong)', letterSpacing: '0.05em' },
  confirmOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  confirmBox:   { background: 'var(--bg-surface)', border: '0.5px solid var(--border-mid)', borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.7)', padding: '22px 26px 18px', maxWidth: 340, width: '90vw' },
  confirmTitle: { fontSize: 'var(--fs-14)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 },
  confirmMsg:   { fontSize: 'var(--fs-12)', color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 18 },
  confirmBtns:  { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  confirmNo:  { fontSize: 'var(--fs-11)', color: 'var(--text-muted)', background: 'var(--bg-raised)', border: '0.5px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--font-mono)' },
  confirmYes: { fontSize: 'var(--fs-11)', color: '#fff', background: '#c0392b', border: 'none', borderRadius: 'var(--radius-sm)', padding: '6px 14px', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700 },
}
