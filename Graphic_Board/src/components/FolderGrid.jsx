import React, { useState, useEffect, useRef } from 'react'
import { createThumbnail } from '../utils/thumbnail.js'
import ContextMenu from './ContextMenu.jsx'
import { FOLDER_YELLOW, darkenHex, getContrastColor } from '../utils/color.js'
import { writeFilesToDir, getImageFiles } from '../utils/fileImport.js'

const IMAGE_RE = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?|svg)$/i
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
    default: // alpha
      return arr.sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
  }
}

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
    }
    if (!groups[key]) groups[key] = []
    groups[key].push(f)
  })

  return Object.entries(groups)
    .sort(([a], [b]) => {
      if (a === '__fav__') return -1
      if (b === '__fav__') return 1
      if (a === '__none__') return 1
      if (b === '__none__') return -1
      return a.localeCompare(b)
    })
    .map(([key, folders]) => ({
      label: key === '__none__' ? (groupBy === 'favorite' ? 'not favorited' : 'untagged') : key,
      colorKey: groupBy === 'color' && key !== '__none__' ? key : null,
      isFav: groupBy === 'favorite' && key === '__fav__',
      folders,
    }))
}

export default function FolderGrid({
  folders, onSelectFolder, getImageUrl,
  folderMeta, parentPath,
  sortBy = 'alpha', iconSize = 'medium', groupBy = 'none',
  onNewFolder, onDeleteFolder,
}) {
  const [dragSrc,      setDragSrc]      = useState(null)
  const [dragOver,     setDragOver]     = useState(null) // { index, side: 'before'|'after' }
  const [fileDragOver, setFileDragOver] = useState(null) // folder.id being targeted by OS file drag
  const [emptyCtxMenu, setEmptyCtxMenu] = useState(null) // {x, y}
  const [newFolderPos, setNewFolderPos] = useState(null) // {x, y}
  const [newFolderName,setNewFolderName]= useState('')
  const newFolderRef = useRef()

  if (!folders || folders.length === 0) return null

  const sorted = sortFolders(
    folders, sortBy,
    folderMeta.getFolderColor, folderMeta.getFolderRecent,
    folderMeta.isFolderFav, parentPath, folderMeta.getFolderOrder,
    folderMeta.getSortName,
  )
  const minW    = MIN_W[iconSize] || 160
  const canDrag = sortBy === 'custom' && groupBy === 'none'
  const groups  = groupFolders(sorted, groupBy, folderMeta, parentPath)

  async function handleFileDrop(folder, files) {
    await writeFilesToDir(folder.handle, files)
  }

  function handleDrop(srcIdx, overIdx, side) {
    if (srcIdx === null || overIdx === null || srcIdx === overIdx) {
      setDragSrc(null); setDragOver(null); return
    }
    const names = sorted.map(f => f.name)
    const [moved] = names.splice(srcIdx, 1)
    const adjTarget = srcIdx < overIdx ? overIdx - 1 : overIdx
    const insertAt  = side === 'after' ? adjTarget + 1 : adjTarget
    names.splice(Math.max(0, Math.min(insertAt, names.length)), 0, moved)
    folderMeta.setFolderOrder(parentPath, names)
    setDragSrc(null)
    setDragOver(null)
  }

  return (
    <div
      onContextMenu={e => {
        e.preventDefault()
        setEmptyCtxMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.label && (
            <div style={styles.groupHeader}>
              {group.colorKey && <span style={{ ...styles.groupDot, background: group.colorKey }} />}
              {group.isFav && <span style={styles.groupStar}>★</span>}
              <span style={styles.groupLabel}>{group.label}</span>
              <span style={styles.groupCount}>{group.folders.length}</span>
            </div>
          )}
          <div style={{ ...styles.grid, gridTemplateColumns: `repeat(auto-fill, minmax(${minW}px, 1fr))` }}>
            {group.folders.map((folder, fi) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                pathKey={`${parentPath}/${folder.name}`}
                onSelect={() => onSelectFolder(folder)}
                getImageUrl={getImageUrl}
                folderMeta={folderMeta}
                canDrag={canDrag}
                isDragging={canDrag && dragSrc === fi}
                isDragOver={canDrag && dragOver?.index === fi ? dragOver.side : null}
                isFileDragOver={fileDragOver === folder.id}
                onDeleteFolder={onDeleteFolder ? () => onDeleteFolder(folder.name) : null}
                onDragStart={e => { setDragSrc(fi); e.dataTransfer.effectAllowed = 'move' }}
                onDragOver={e => {
                  e.preventDefault()
                  if (e.dataTransfer.types.includes('Files')) {
                    e.dataTransfer.dropEffect = 'copy'
                    setFileDragOver(folder.id)
                    return
                  }
                  const rect = e.currentTarget.getBoundingClientRect()
                  const side = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
                  if (dragOver?.index !== fi || dragOver?.side !== side) setDragOver({ index: fi, side })
                }}
                onDragLeave={() => { setDragOver(null); setFileDragOver(null) }}
                onDrop={e => {
                  e.preventDefault()
                  if (e.dataTransfer.types.includes('Files')) {
                    const files = getImageFiles(e)
                    if (files.length > 0) handleFileDrop(folder, files)
                    setFileDragOver(null)
                    return
                  }
                  handleDrop(dragSrc, fi, dragOver?.side ?? 'before')
                }}
                onDragEnd={() => { setDragSrc(null); setDragOver(null) }}
              />
            ))}
          </div>
        </div>
      ))}

      {emptyCtxMenu && onNewFolder && (
        <ContextMenu
          x={emptyCtxMenu.x}
          y={emptyCtxMenu.y}
          items={[{ label: 'new folder', icon: '+', onClick: () => {
            setNewFolderPos({ x: emptyCtxMenu.x, y: emptyCtxMenu.y })
            setNewFolderName('')
            setTimeout(() => newFolderRef.current?.focus(), 0)
          }}]}
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
            setNewFolderPos(null)
            setNewFolderName('')
          }}
          onCancel={() => { setNewFolderPos(null); setNewFolderName('') }}
        />
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
          fontSize: 11, fontFamily: 'var(--font-mono)',
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
      <button onClick={onSubmit} style={{ fontSize: 11, color: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>✓</button>
      <button onClick={onCancel} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>✕</button>
    </div>
  )
}

function FolderCard({
  folder, pathKey, onSelect, getImageUrl, folderMeta,
  canDrag, isDragging, isDragOver, isFileDragOver,
  onDeleteFolder,
  onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd,
}) {
  const [thumbUrl,     setThumbUrl]     = useState(null)
  const [thumbVersion, setThumbVersion] = useState(0)
  const [hovered,      setHovered]      = useState(false)
  const [contextMenu,  setContextMenu]  = useState(null)
  const [preview,      setPreview]      = useState(null) // [url, ...]
  const [confirmDelete,setConfirmDelete]= useState(false)
  const previewTimer   = useRef(null)
  const previewUrlsRef = useRef([])
  const cardRef        = useRef()

  const color  = folderMeta.getFolderColor(pathKey)
  const isFav  = folderMeta.isFolderFav(pathKey)
  const mode   = folderMeta.getFolderMode(pathKey)

  // Thumbnail: custom override → folder's first image
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
    }
    load()
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [pathKey, folder.thumbnailHandle, thumbVersion])

  // Unmount + scroll cleanup
  useEffect(() => {
    function onScroll() { stopPreview(); setHovered(false) }
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      clearTimeout(previewTimer.current)
      previewUrlsRef.current.forEach(u => URL.revokeObjectURL(u))
    }
  }, [])

  function startPreview() {
    if (folder.imageCount === 0) return
    previewTimer.current = setTimeout(async () => {
      const urls = []
      try {
        for await (const [name, h] of folder.handle.entries()) {
          if (h.kind === 'file' && IMAGE_RE.test(name)) {
            try {
              const u = await createThumbnail(h, 120).catch(() => getImageUrl(h))
              urls.push(u)
              if (urls.length >= 6) break
            } catch {}
          }
        }
      } catch {}
      previewUrlsRef.current = urls
      setPreview(urls)
    }, 420)
  }

  function stopPreview() {
    clearTimeout(previewTimer.current)
    previewUrlsRef.current.forEach(u => URL.revokeObjectURL(u))
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

  const itemTags = folderMeta.getItemTags(pathKey)
  const allTags  = folderMeta.getAllTags()
  const sortName = folderMeta.getSortName ? folderMeta.getSortName(pathKey) : null

  const contextItems = [
    { sortNameRow: true, name: folder.name, sortName, onSet: name => folderMeta.setSortName(pathKey, name) },
    { separator: true },
    {
      label: mode === 'board' ? 'board mode  ✓' : 'board mode',
      icon: '⊞',
      onClick: () => folderMeta.setFolderMode(pathKey, mode === 'board' ? 'grid' : 'board'),
    },
    { separator: true },
    {
      label: isFav ? 'remove from favorites' : 'add to favorites',
      icon: isFav ? '★' : '☆',
      onClick: () => folderMeta.toggleFolderFav(pathKey),
    },
    { separator: true },
    { colorRow: true, value: color, onChange: hex => folderMeta.setFolderColor(pathKey, hex) },
    { separator: true },
    { tagRow: true, tags: itemTags, onChange: ts => folderMeta.setItemTags(pathKey, ts), allTags, getTagColor: folderMeta.getTagColor },
    { separator: true },
    { linkRow: true, link: folderMeta.getItemLink(pathKey), onChange: link => folderMeta.setItemLink(pathKey, link) },
    { separator: true },
    {
      label: 'change thumbnail',
      icon: '⬚',
      onClick: handleChangeThumbnail,
    },
    {
      label: 'reset thumbnail',
      icon: '↺',
      onClick: handleResetThumbnail,
      disabled: !folder.thumbnailHandle,
    },
    { separator: true },
    {
      label: 'copy path to clipboard',
      icon: '⎘',
      feedback: 'copied!',
      onClick: () => navigator.clipboard.writeText(pathKey).catch(() => {}),
    },
    ...(onDeleteFolder ? [
      { separator: true },
      {
        label: 'delete folder',
        icon: '✕',
        danger: true,
        onClick: () => setConfirmDelete(true),
      },
    ] : []),
  ]

  const meta = folder.subfolderCount > 0
    ? `${folder.subfolderCount} folder${folder.subfolderCount !== 1 ? 's' : ''}`
    : `${folder.imageCount} image${folder.imageCount !== 1 ? 's' : ''}`

  // Position hover preview panel relative to card bounds
  let previewPos = null
  if (preview && preview.length > 0 && cardRef.current) {
    const r = cardRef.current.getBoundingClientRect()
    const pw = 300, ph = 220
    const spaceRight = window.innerWidth - r.right
    const left = spaceRight >= pw + 8 ? r.right + 6 : r.left - pw - 6
    const top  = Math.max(8, Math.min(r.top, window.innerHeight - ph - 8))
    previewPos = { left, top }
  }

  return (
    <>
      <div
        ref={cardRef}
        draggable={canDrag}
        style={{
          ...styles.card,
          borderColor: color || (hovered ? 'var(--border-strong)' : 'var(--border-subtle)'),
          borderWidth: color ? 1.5 : 0.5,
          transform: hovered && !isDragging ? 'scale(1.02)' : 'scale(1)',
          opacity: isDragging ? 0.35 : 1,
          cursor: canDrag ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
          boxShadow: isDragOver === 'before' ? '-3px 0 0 0 var(--accent)' :
                     isDragOver === 'after'  ? '3px 0 0 0 var(--accent)'  : undefined,
          outline: isFileDragOver ? '2px solid var(--accent)' : undefined,
          outlineOffset: isFileDragOver ? '3px' : undefined,
          transition: 'border-color 0.12s, transform 0.12s, box-shadow 0.07s, opacity 0.1s, outline 0.07s',
        }}
        onClick={onSelect}
        onMouseEnter={() => { setHovered(true); if (!canDrag) startPreview() }}
        onMouseLeave={() => { setHovered(false); stopPreview() }}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY }) }}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
      >
        <div style={styles.thumb}>
          {thumbUrl ? (
            <img src={thumbUrl} alt={folder.name} style={styles.thumbImg} />
          ) : (
            <PlaceholderThumb color={color} />
          )}
          {hovered && (
            <div style={styles.thumbOverlay}>
              <span style={styles.openHint}>open</span>
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
                <div style={{ ...styles.name, color: contrast || undefined }}>{folder.name}</div>
              </div>
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

      {/* Hover preview — position: fixed, escapes overflow clipping */}
      {previewPos && (
        <div style={{ ...styles.previewPanel, left: previewPos.left, top: previewPos.top }}>
          {preview.map((url, i) => (
            <img key={i} src={url} alt="" style={styles.previewImg} />
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
              <button
                style={styles.confirmNo}
                onClick={() => setConfirmDelete(false)}
              >no, cancel</button>
              <button
                style={styles.confirmYes}
                onClick={() => { setConfirmDelete(false); onDeleteFolder() }}
              >yes, delete</button>
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
      {/* folder tab — top-left bump */}
      <path d="M10,52 L10,40 Q10,36 14,36 L60,36 Q64,36 66,40 L72,52 Z" fill={tabColor} />
      {/* folder body */}
      <rect x="10" y="52" width="140" height="60" rx="6" fill={bodyColor} />
    </svg>
  )
}

const styles = {
  grid: {
    display: 'grid',
    gap: 10,
    padding: 16,
  },
  card: {
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    cursor: 'pointer',
    border: '0.5px solid var(--border-subtle)',
    background: 'var(--bg-surface)',
    transition: 'border-color 0.12s, transform 0.12s',
  },
  thumb: {
    width: '100%',
    aspectRatio: '4 / 3',
    overflow: 'hidden',
    position: 'relative',
    background: 'var(--bg-base)',
  },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  thumbOverlay: {
    position: 'absolute', inset: 0,
    background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  openHint: { fontSize: 11, color: 'var(--text-primary)', letterSpacing: '0.12em', opacity: 0.9 },
  info:     { padding: '8px 11px 10px' },
  nameRow:  { display: 'flex', alignItems: 'center', gap: 5 },
  favStar:  { fontSize: 10, flexShrink: 0 },
  name: {
    fontSize: 14, color: 'var(--text-secondary)', fontWeight: 700,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
  },
  meta: { fontSize: 11, color: 'var(--text-muted)', marginTop: 3 },
  previewPanel: {
    position: 'fixed',
    zIndex: 500,
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 3,
    padding: 6,
    background: 'var(--bg-raised)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    boxShadow: '0 8px 28px rgba(0,0,0,0.65)',
    width: 300,
    pointerEvents: 'none',
  },
  previewImg: { width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 2, display: 'block' },
  groupHeader: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '10px 16px 4px',
    borderBottom: '0.5px solid var(--border-subtle)',
  },
  groupDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  groupStar: { fontSize: 10, color: 'var(--accent)', flexShrink: 0 },
  groupLabel: { fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, flex: 1 },
  groupCount: { fontSize: 10, color: 'var(--border-strong)', letterSpacing: '0.05em' },
  tagChips: { display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 },
  tagChip: {
    fontSize: 9, color: 'var(--text-muted)',
    border: '0.5px solid var(--border-subtle)',
    borderRadius: 2, padding: '1px 5px',
    letterSpacing: '0.04em', fontFamily: 'var(--font-mono)',
  },
  confirmOverlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.55)',
    zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  confirmBox: {
    background: 'var(--bg-surface)',
    border: '0.5px solid var(--border-mid)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
    padding: '22px 26px 18px',
    maxWidth: 340, width: '90vw',
  },
  confirmTitle: {
    fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
    marginBottom: 10,
  },
  confirmMsg: {
    fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55,
    marginBottom: 18,
  },
  confirmBtns: {
    display: 'flex', gap: 8, justifyContent: 'flex-end',
  },
  confirmNo: {
    fontSize: 11, color: 'var(--text-muted)',
    background: 'var(--bg-raised)', border: '0.5px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)', padding: '6px 14px',
    cursor: 'pointer', fontFamily: 'var(--font-mono)',
  },
  confirmYes: {
    fontSize: 11, color: '#fff',
    background: '#c0392b', border: 'none',
    borderRadius: 'var(--radius-sm)', padding: '6px 14px',
    cursor: 'pointer', fontFamily: 'var(--font-mono)', fontWeight: 700,
  },
}
