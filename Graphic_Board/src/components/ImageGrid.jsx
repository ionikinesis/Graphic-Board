import React, { useState, useEffect } from 'react'
import ContextMenu from './ContextMenu.jsx'
import { writeFilesToDir, getImageFiles } from '../utils/fileImport.js'

const COL_W = { small: 100, medium: 140, large: 200 }

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
        const sa = sizes[a.id] ?? -1
        const sb = sizes[b.id] ?? -1
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
    default: // alpha
      return arr.sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
  }
}

export default function ImageGrid({
  loadImages, folderHandle, getImageUrl,
  isFavourited, onToggleFavourite,
  iconSize = 'medium', hideWhenEmpty, sortBy = 'alpha',
  parentPath = '', folderMeta = null,
}) {
  const [loaded,       setLoaded]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [lightbox,     setLightbox]     = useState(null)
  const [sizes,        setSizes]        = useState({})
  const [dragSrc,      setDragSrc]      = useState(null)
  const [dragOver,     setDragOver]     = useState(null) // { index, side: 'before'|'after' }
  const [fileDragging, setFileDragging] = useState(false)

  useEffect(() => {
    setLoaded([])
    setLoading(true)
    setSizes({})
    loadImages(folderHandle).then(imgs => {
      setLoaded(imgs)
      setLoading(false)
    })
  }, [folderHandle])

  // Ctrl+V paste: write clipboard image into this folder then reload
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

  // Load file sizes lazily when sortBy === 'size'
  useEffect(() => {
    if (sortBy !== 'size' || loaded.length === 0) return
    loaded.forEach(async img => {
      if (sizes[img.id] !== undefined) return
      try {
        const file = await img.handle.getFile()
        setSizes(prev => ({ ...prev, [img.id]: file.size }))
      } catch {}
    })
  }, [sortBy, loaded])

  // Keyboard nav for lightbox
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
    const index = loaded.indexOf(image)
    const url   = await getImageUrl(image.handle)
    setLightbox({ index, url, image })
  }

  if (loading) {
    return (
      <div style={styles.loadingState}>
        <div style={styles.loadingText}>loading images...</div>
      </div>
    )
  }

  if (loaded.length === 0) {
    if (hideWhenEmpty) return null
    return (
      <div style={styles.emptyState}>
        <div style={styles.emptyTitle}>no images here</div>
        <div style={styles.emptyMeta}>this folder contains only subfolders</div>
      </div>
    )
  }

  const sorted  = sortImages(loaded, sortBy, isFavourited, sizes, folderMeta, parentPath)
  const colSize = COL_W[iconSize] || 140
  const canDrag = sortBy === 'custom'

  function handleImageRename(oldName, newName) {
    setLoaded(prev => prev.map(img =>
      img.name === oldName ? { ...img, id: newName, name: newName } : img
    ))
  }

  function handleDeleteFromFolder(img) {
    setLoaded(prev => prev.filter(i => i.id !== img.id))
    folderHandle.removeEntry(img.name).catch(err => console.warn('delete failed:', err))
  }

  function handleDrop(srcIdx, overIdx, side) {
    if (srcIdx === null || overIdx === null || srcIdx === overIdx) {
      setDragSrc(null); setDragOver(null); return
    }
    const names = sorted.map(img => img.name)
    const [moved] = names.splice(srcIdx, 1)
    const adjTarget = srcIdx < overIdx ? overIdx - 1 : overIdx
    const insertAt  = side === 'after' ? adjTarget + 1 : adjTarget
    names.splice(Math.max(0, Math.min(insertAt, names.length)), 0, moved)
    if (folderMeta) folderMeta.setImageOrder(parentPath, names)
    setDragSrc(null)
    setDragOver(null)
  }

  async function handleFileDrop(e) {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    setFileDragging(false)
    const files = getImageFiles(e)
    if (files.length === 0 || !folderHandle) return
    await writeFilesToDir(folderHandle, files)
    loadImages(folderHandle).then(setLoaded)
  }

  return (
    <div
      style={{ position: 'relative' }}
      onDragOver={e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setFileDragging(true) } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setFileDragging(false) }}
      onDrop={handleFileDrop}
    >
      {fileDragging && (
        <div style={styles.dropOverlay}>
          <span style={styles.dropHint}>drop images here to add to folder</span>
        </div>
      )}
      <div style={{ ...styles.grid, gridTemplateColumns: `repeat(auto-fill, minmax(${colSize}px, 1fr))` }}>
        {sorted.map((img, fi) => (
          <ImageCard
            key={img.id}
            image={img}
            getImageUrl={getImageUrl}
            favourited={isFavourited(img.id)}
            onToggleFavourite={() => onToggleFavourite(img.id)}
            onOpen={() => openLightbox(img)}
            pathKey={parentPath ? `${parentPath}/${img.name}` : img.name}
            folderMeta={folderMeta}
            onRenameImage={handleImageRename}
            onDeleteFromFolder={() => handleDeleteFromFolder(img)}
            canDrag={canDrag}
            isDragging={canDrag && dragSrc === fi}
            isDragOver={canDrag && dragOver?.index === fi ? dragOver.side : null}
            onDragStart={e => { setDragSrc(fi); e.dataTransfer.effectAllowed = 'move' }}
            onDragOver={e => {
              e.preventDefault()
              const rect = e.currentTarget.getBoundingClientRect()
              const side = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
              if (dragOver?.index !== fi || dragOver?.side !== side) setDragOver({ index: fi, side })
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={e => { e.preventDefault(); handleDrop(dragSrc, fi, dragOver?.side ?? 'before') }}
            onDragEnd={() => { setDragSrc(null); setDragOver(null) }}
          />
        ))}
      </div>

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
    </div>
  )
}

function Lightbox({ image, url, getImageUrl, favourited, onToggleFavourite, onClose, onPrev, onNext, index, total }) {
  const [resolvedUrl, setResolvedUrl] = useState(url)

  useEffect(() => {
    if (url) { setResolvedUrl(url); return }
    let objectUrl = null
    getImageUrl(image.handle).then(u => { objectUrl = u; setResolvedUrl(u) })
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [image, url])

  return (
    <div style={styles.lightboxBackdrop} onClick={onClose}>
      <div style={styles.lightboxInner} onClick={e => e.stopPropagation()}>
        {resolvedUrl ? (
          <img src={resolvedUrl} alt={image.name} style={styles.lightboxImg} />
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
        >
          {favourited ? '★' : '☆'}
        </button>
        <button style={styles.lbNavBtn} onClick={onNext}>→</button>
        <button style={styles.lbCloseBtn} onClick={onClose} title="close (Esc)">✕</button>
      </div>
      <div style={styles.lightboxHint}>click outside or press Esc to close</div>
    </div>
  )
}

function ImageCard({
  image, getImageUrl, favourited, onToggleFavourite, onOpen, pathKey, folderMeta,
  canDrag, isDragging, isDragOver,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
  onRenameImage, onDeleteFromFolder,
}) {
  const [url,         setUrl]         = useState(null)
  const [hovered,     setHovered]     = useState(false)
  const [contextMenu, setContextMenu] = useState(null)

  useEffect(() => {
    let objectUrl = null
    getImageUrl(image.handle).then(u => { objectUrl = u; setUrl(u) })
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
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
    {
      label: favourited ? 'remove from favorites' : 'add to favorites',
      icon:  favourited ? '★' : '☆',
      onClick: onToggleFavourite,
    },
    { separator: true },
    ...(folderMeta ? [
      { tagRow: true, tags: itemTags, onChange: ts => folderMeta.setItemTags(pathKey, ts), allTags, getTagColor: folderMeta.getTagColor },
      { separator: true },
      { linkRow: true, link: folderMeta.getItemLink(pathKey), onChange: link => folderMeta.setItemLink(pathKey, link) },
      { separator: true },
    ] : []),
    { renameRow: true, name: image.name, onRename: handleRename },
    { separator: true },
    {
      label: 'copy filename',
      icon: '⎘',
      feedback: 'copied!',
      onClick: () => navigator.clipboard.writeText(image.name).catch(() => {}),
    },
    ...(onDeleteFromFolder ? [
      { separator: true },
      { label: 'delete from folder', icon: '✕', onClick: onDeleteFromFolder },
    ] : []),
  ]

  return (
    <>
      <div
        draggable={canDrag}
        style={{
          ...styles.card,
          borderColor: favourited ? 'rgba(200,169,126,0.35)' : hovered ? 'var(--border-strong)' : 'var(--border-subtle)',
          transform: hovered && !isDragging ? 'scale(1.015)' : 'scale(1)',
          opacity: isDragging ? 0.35 : 1,
          cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
          boxShadow: isDragOver === 'before' ? '-3px 0 0 0 var(--accent)' :
                     isDragOver === 'after'  ? '3px 0 0 0 var(--accent)'  : undefined,
          transition: 'border-color 0.12s, transform 0.12s, box-shadow 0.07s, opacity 0.1s',
        }}
        onClick={onOpen}
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
          <img src={url} alt={image.name} style={styles.img} />
        ) : (
          <div style={styles.placeholder} />
        )}
        {favourited && <div style={styles.favPip} />}
        {hovered && (
          <div style={styles.overlay}>
            <div style={styles.actions}>
              <button
                style={{ ...styles.iconBtn, color: favourited ? 'var(--accent)' : 'var(--text-primary)' }}
                onClick={e => { e.stopPropagation(); onToggleFavourite() }}
                title={favourited ? 'unfavourite' : 'favourite'}
              >{favourited ? '★' : '☆'}</button>
              <button
                style={styles.iconBtn}
                onClick={e => { e.stopPropagation(); onOpen() }}
                title="open preview"
              >⤢</button>
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
    border: '2px dashed var(--accent)',
    borderRadius: 6, pointerEvents: 'none',
  },
  dropHint: {
    fontSize: 11, color: 'var(--accent)', letterSpacing: '0.08em',
    background: 'var(--bg-surface)', padding: '6px 14px', borderRadius: 20,
    border: '0.5px solid var(--border-mid)',
  },
  lightboxBackdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.92)',
    zIndex: 1000,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    cursor: 'zoom-out',
  },
  lightboxInner: {
    maxWidth: '90vw', maxHeight: '80vh',
    cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  lightboxImg: { maxWidth: '90vw', maxHeight: '80vh', objectFit: 'contain', borderRadius: 4, display: 'block' },
  lightboxLoading: { fontSize: 13, color: 'var(--text-muted)', letterSpacing: '0.08em' },
  lightboxBar: {
    display: 'flex', alignItems: 'center', gap: 10,
    marginTop: 14, padding: '8px 14px',
    background: 'rgba(255,255,255,0.04)',
    borderRadius: 8, border: '0.5px solid var(--border-subtle)',
    cursor: 'default',
  },
  lightboxMeta: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 180 },
  lightboxName:  { fontSize: 13, color: 'var(--text-secondary)', letterSpacing: '0.03em', fontWeight: 700 },
  lightboxCount: { fontSize: 11, color: 'var(--text-muted)',     letterSpacing: '0.08em' },
  lbNavBtn:   { fontSize: 16, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 9px', borderRadius: 4, transition: 'color 0.1s' },
  lbIconBtn:  { fontSize: 16, background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 7px', borderRadius: 4, transition: 'color 0.1s' },
  lbCloseBtn: { fontSize: 13, color: 'var(--text-muted)', background: 'transparent', border: '0.5px solid var(--border-mid)', cursor: 'pointer', padding: '4px 10px', borderRadius: 4, letterSpacing: '0.04em', transition: 'all 0.1s', fontFamily: 'var(--font-mono)' },
  lightboxHint: { marginTop: 10, fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', opacity: 0.5 },
  grid: { display: 'grid', gap: 6, padding: 16 },
  card: {
    position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden',
    cursor: 'pointer', background: 'var(--bg-raised)',
    border: '0.5px solid var(--border-subtle)', aspectRatio: '1',
    transition: 'border-color 0.12s, transform 0.12s',
  },
  img:         { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  placeholder: { width: '100%', height: '100%', background: 'var(--bg-raised)' },
  favPip:      { position: 'absolute', top: 5, right: 5, width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', pointerEvents: 'none' },
  overlay: {
    position: 'absolute', inset: 0,
    background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 55%)',
    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: 7,
  },
  actions:   { display: 'flex', gap: 3, justifyContent: 'flex-end', marginBottom: 4 },
  iconBtn: {
    width: 22, height: 22, borderRadius: 3,
    background: 'rgba(0,0,0,0.55)', border: '0.5px solid rgba(255,255,255,0.08)',
    color: 'var(--text-primary)', fontSize: 9,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background 0.1s', cursor: 'pointer',
  },
  imageName: { fontSize: 11, color: 'rgba(232,228,220,0.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '0.03em', fontWeight: 700 },
  loadingState: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 },
  loadingText:  { fontSize: 13, color: 'var(--text-muted)', letterSpacing: '0.08em' },
  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 40 },
  emptyTitle: { fontSize: 14, color: 'var(--text-muted)', fontWeight: 700 },
  emptyMeta:  { fontSize: 12, color: 'var(--border-strong)', textAlign: 'center', lineHeight: 1.8, maxWidth: 260 },
}
