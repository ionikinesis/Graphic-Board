import React, { useState } from 'react'
import Topbar from './components/Topbar.jsx'
import Sidebar from './components/Sidebar.jsx'
import ViewHeader from './components/ViewHeader.jsx'
import FolderGrid from './components/FolderGrid.jsx'
import ImageGrid from './components/ImageGrid.jsx'
import EmptyState from './components/EmptyState.jsx'
import { useFileSystem } from './hooks/useFileSystem.js'
import { useFavourites } from './hooks/useFavourites.js'

// Navigation views
const VIEW = {
  EMPTY: 'empty',         // no collections imported yet
  COLLECTION: 'collection', // showing subfolders of a collection
  FOLDER: 'folder',        // showing images inside a folder
}

export default function App() {
  const { collections, loading, error, importCollection, loadImages, getImageUrl, removeCollection } = useFileSystem()
  const { favourites, toggle: toggleFav, isFavourited } = useFavourites()

  const [activeCollectionId, setActiveCollectionId] = useState(null)
  const [activeFolder, setActiveFolder] = useState(null) // { folder, collectionId }
  const [viewMode, setViewMode] = useState('normal')

  const view = collections.length === 0
    ? VIEW.EMPTY
    : activeFolder
      ? VIEW.FOLDER
      : VIEW.COLLECTION

  const activeCollection = collections.find(c => c.id === activeCollectionId) || collections[0]

  function handleSelectCollection(id) {
    setActiveCollectionId(id)
    setActiveFolder(null)
  }

  function handleSelectFolder(folder) {
    setActiveFolder({ folder, collectionId: activeCollectionId || activeCollection?.id })
  }

  function handleBreadcrumbCollection() {
    setActiveFolder(null)
  }

  function handleImport() {
    importCollection().then(() => {
      // Auto-select the newest collection
      // (collections state updates asynchronously; handled via useEffect below)
    })
  }

  // Auto-select newly imported collection
  React.useEffect(() => {
    if (collections.length > 0 && !activeCollectionId) {
      setActiveCollectionId(collections[collections.length - 1].id)
    }
  }, [collections])

  // Build breadcrumb
  const breadcrumb = (() => {
    if (view === VIEW.EMPTY) return []
    if (view === VIEW.COLLECTION) return [{ label: activeCollection?.name || '' }]
    if (view === VIEW.FOLDER) {
      const col = collections.find(c => c.id === activeFolder.collectionId) || activeCollection
      return [
        { label: col?.name || '', onClick: handleBreadcrumbCollection },
        { label: activeFolder.folder.name },
      ]
    }
    return []
  })()

  const itemCount = (() => {
    if (view === VIEW.COLLECTION) return activeCollection?.folders.length
    if (view === VIEW.FOLDER) return activeFolder?.folder.imageCount
    return null
  })()

  return (
    <div style={styles.app}>
      <Topbar onImport={handleImport} loading={loading} />

      {error && (
        <div style={styles.errorBanner}>{error}</div>
      )}

      <div style={styles.layout}>
        {view !== VIEW.EMPTY && (
          <Sidebar
            collections={collections}
            activeCollectionId={activeCollectionId || activeCollection?.id}
            onSelectCollection={handleSelectCollection}
            onRemoveCollection={removeCollection}
            favouriteCount={favourites.size}
          />
        )}

        <div style={styles.main}>
          {view === VIEW.EMPTY ? (
            <EmptyState onImport={handleImport} />
          ) : (
            <>
              <ViewHeader
                breadcrumb={breadcrumb}
                viewMode={viewMode}
                onSetViewMode={setViewMode}
                itemCount={itemCount}
              />

              <div style={styles.contentArea}>
                {view === VIEW.COLLECTION && activeCollection && (
                  <FolderGrid
                    collection={activeCollection}
                    onSelectFolder={handleSelectFolder}
                    getImageUrl={getImageUrl}
                  />
                )}

                {view === VIEW.FOLDER && activeFolder && (
                  <ImageGrid
                    folderHandle={activeFolder.folder.handle}
                    isTopLevel={activeFolder.folder.isTopLevel}
                    loadImages={loadImages}
                    getImageUrl={getImageUrl}
                    isFavourited={isFavourited}
                    onToggleFavourite={toggleFav}
                    viewMode={viewMode}
                  />
                )}
              </div>

              <div style={styles.statusbar}>
                <span>
                  {view === VIEW.COLLECTION
                    ? `${activeCollection?.folders.length} folders`
                    : `${activeFolder?.folder.imageCount} images · ${favourites.size} favourited`}
                </span>
                <span style={{ color: 'var(--border-strong)' }}>
                  {view === VIEW.FOLDER
                    ? `${activeCollection?.name?.toLowerCase()} / ${activeFolder?.folder.name?.toLowerCase()}`
                    : activeCollection?.name?.toLowerCase()}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    background: 'var(--bg-base)',
    overflow: 'hidden',
  },
  layout: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  contentArea: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
  },
  statusbar: {
    padding: '5px 14px',
    borderTop: '0.5px solid var(--border-subtle)',
    fontSize: 9,
    color: 'var(--text-muted)',
    letterSpacing: '0.07em',
    display: 'flex',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  errorBanner: {
    background: '#2a0a0a',
    borderBottom: '0.5px solid #4a1a1a',
    color: '#e88080',
    fontSize: 10,
    padding: '6px 16px',
    letterSpacing: '0.04em',
    flexShrink: 0,
  },
}
