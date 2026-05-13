import React, { useState, useEffect } from 'react'

export default function FolderGrid({ collection, onSelectFolder, getImageUrl }) {
  return (
    <div style={styles.grid}>
      {collection.folders.map(folder => (
        <FolderCard
          key={folder.id}
          folder={folder}
          onSelect={() => onSelectFolder(folder)}
          getImageUrl={getImageUrl}
        />
      ))}
    </div>
  )
}

function FolderCard({ folder, onSelect, getImageUrl }) {
  const [thumbUrl, setThumbUrl] = useState(null)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    let url = null
    if (folder.thumbnailHandle) {
      getImageUrl(folder.thumbnailHandle).then(u => {
        url = u
        setThumbUrl(u)
      })
    }
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [folder.thumbnailHandle])

  return (
    <div
      style={{
        ...styles.card,
        borderColor: hovered ? 'var(--border-strong)' : 'var(--border-subtle)',
        transform: hovered ? 'scale(1.02)' : 'scale(1)',
      }}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={styles.thumb}>
        {thumbUrl ? (
          <img src={thumbUrl} alt={folder.name} style={styles.thumbImg} />
        ) : (
          <PlaceholderThumb name={folder.name} />
        )}
        {hovered && (
          <div style={styles.thumbOverlay}>
            <span style={styles.openHint}>open</span>
          </div>
        )}
      </div>
      <div style={styles.info}>
        <div style={styles.name}>{folder.name}</div>
        <div style={styles.meta}>{folder.imageCount} images</div>
      </div>
    </div>
  )
}

function PlaceholderThumb({ name }) {
  const hue = [...name].reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return (
    <svg width="100%" height="100%" viewBox="0 0 160 120" style={{ display: 'block' }}>
      <rect width="160" height="120" fill={`hsl(${hue},20%,8%)`} />
      <rect x="20" y="25" width="120" height="70" rx="4" fill={`hsl(${hue},25%,14%)`} opacity="0.7" />
      <rect x="20" y="18" width="55" height="14" rx="2" fill={`hsl(${hue},28%,18%)`} />
    </svg>
  )
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
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
  thumbImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  thumbOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openHint: {
    fontSize: 9,
    color: 'var(--text-primary)',
    letterSpacing: '0.12em',
    opacity: 0.8,
  },
  info: { padding: '8px 10px' },
  name: { fontSize: 11, color: 'var(--text-secondary)' },
  meta: { fontSize: 9, color: 'var(--text-muted)', marginTop: 2 },
}
