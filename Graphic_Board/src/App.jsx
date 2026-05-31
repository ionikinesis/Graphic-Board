import React, { useState, useEffect } from 'react'
import Topbar from './components/Topbar.jsx'
import Sidebar from './components/Sidebar.jsx'
import ViewHeader from './components/ViewHeader.jsx'
import FolderGrid from './components/FolderGrid.jsx'
import ImageGrid from './components/ImageGrid.jsx'
import SetupScreen from './components/SetupScreen.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import { useNavigator } from './hooks/useNavigator.js'
import { useRootDirectory } from './hooks/useRootDirectory.js'
import { useFavourites } from './hooks/useFavourites.js'
import { useFolderMeta } from './hooks/useFolderMeta.js'
import { useAppSettings } from './hooks/useAppSettings.js'
import { useConfigFile } from './hooks/useConfigFile.js'

export default function App() {
  const {
    rootHandle, rootName, status: rootStatus,
    chooseRoot, grantPermission,
    roots, activeRootId, addRoot, removeRoot, switchRoot, setRootColor,
  } = useRootDirectory()
  const {
    stack, folders, hasImages, loading, breadcrumb, currentHandle,
    canGoBack, canGoForward, navigateInto, navigateToPath, goBack, goForward,
    loadImages, getImageUrl, refreshCurrent,
  } = useNavigator(rootHandle)
  const { config, configReady, updateConfig } = useConfigFile(rootHandle)
  const { favourites, toggle: toggleFav, isFavourited } = useFavourites(config, updateConfig)
  const folderMeta = useFolderMeta(config, updateConfig)
  const { settings, update: updateSettings, customColors, updateCustomColors } = useAppSettings()

  const [settingsOpen, setSettingsOpen] = useState(false)

  const iconSize = settings.iconSize ?? 'medium'
  const sortBy   = settings.sortBy   ?? 'alpha'
  const groupBy  = settings.groupBy  ?? 'none'

  // Mouse back/forward buttons (button 3 = back, button 4 = forward)
  useEffect(() => {
    function onMouseUp(e) {
      if (e.button === 3) { e.preventDefault(); goBack() }
      if (e.button === 4) { e.preventDefault(); goForward() }
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [goBack, goForward])

  function handleSetSortBy(val)   { updateSettings({ sortBy: val }) }
  function handleSetGroupBy(val)  { updateSettings({ groupBy: val }) }
  function handleSetIconSize(val) { updateSettings({ iconSize: val }) }

  // Record recently-opened when navigating into a folder
  function handleNavigateInto(folder) {
    const pathKey = [...(rootHandle ? [rootHandle.name] : []), ...stack.map(s => s.name), folder.name].join('/')
    if (folderMeta.getFolderMode(pathKey) === 'board') {
      const winName = 'board_' + encodeURIComponent(pathKey)
      window.open(`/?board&path=${encodeURIComponent(pathKey)}`, winName)
      return
    }
    folderMeta.touchFolder(pathKey)
    navigateInto(folder)
  }

  // Breadcrumb — all segments clickable except the last
  const breadcrumbWithNav = breadcrumb.map((seg, i) => ({
    label: seg.label,
    onClick: i < breadcrumb.length - 1
      ? () => {
          if (seg.index === -1) navigateToPath([])
          else navigateToPath(stack.slice(0, seg.index + 1))
        }
      : undefined,
  }))

  const isLeaf = !loading && folders.length === 0
  const pathKey = stack.map(s => s.name).join('/')

  // parentPath for FolderGrid metadata keying
  const parentPath = [rootHandle?.name, ...stack.map(s => s.name)].filter(Boolean).join('/')

  if (rootStatus === 'loading' || (rootStatus === 'ready' && !configReady)) {
    return (
      <div style={styles.app}>
        <div style={styles.bootScreen}><div style={styles.bootText}>loading...</div></div>
      </div>
    )
  }

  if (rootStatus === 'none' || rootStatus === 'needs-permission') {
    return (
      <div style={styles.app}>
        <SetupScreen status={rootStatus} rootName={rootName} onChoose={chooseRoot} onGrant={grantPermission} />
      </div>
    )
  }

  return (
    <div style={styles.app}>
      <Topbar
        onOpenSettings={() => setSettingsOpen(true)}
        onNavigateHome={() => navigateToPath([])}
        loading={loading}
      />

      <div style={styles.layout}>
        <Sidebar
          rootHandle={rootHandle}
          stack={stack}
          onNavigateTo={navigateToPath}
          onNavigateHome={() => navigateToPath([])}
          roots={roots}
          activeRootId={activeRootId}
          onSwitchRoot={id => { switchRoot(id); navigateToPath([]) }}
          onSetRootColor={setRootColor}
        />

        <div style={styles.main}>
          {currentHandle && (
            <>
              <ViewHeader
                breadcrumb={breadcrumbWithNav}
                canGoBack={canGoBack}
                canGoForward={canGoForward}
                onGoBack={goBack}
                onGoForward={goForward}
                iconSize={iconSize}
                onSetIconSize={handleSetIconSize}
                sortBy={sortBy}
                onSetSortBy={handleSetSortBy}
                groupBy={groupBy}
                onSetGroupBy={handleSetGroupBy}
                onNewFolder={currentHandle ? async name => {
                  await currentHandle.getDirectoryHandle(name, { create: true }).catch(() => {})
                  refreshCurrent()
                } : null}
              />

              <div style={styles.contentArea}>
                {folders.length > 0 && (
                  <FolderGrid
                    folders={folders}
                    onSelectFolder={handleNavigateInto}
                    getImageUrl={getImageUrl}
                    folderMeta={folderMeta}
                    parentPath={parentPath}
                    sortBy={sortBy}
                    iconSize={iconSize}
                    groupBy={groupBy}
                    onNewFolder={currentHandle ? async name => {
                      await currentHandle.getDirectoryHandle(name, { create: true }).catch(() => {})
                      refreshCurrent()
                    } : null}
                    onDeleteFolder={currentHandle ? async name => {
                      await currentHandle.removeEntry(name, { recursive: true }).catch(() => {})
                      refreshCurrent()
                    } : null}
                  />
                )}

                {(isLeaf || hasImages) && (
                  <ImageGrid
                    key={pathKey}
                    folderHandle={currentHandle}
                    loadImages={loadImages}
                    getImageUrl={getImageUrl}
                    isFavourited={isFavourited}
                    onToggleFavourite={toggleFav}
                    iconSize={iconSize}
                    sortBy={sortBy}
                    hideWhenEmpty={!isLeaf}
                    parentPath={parentPath}
                    folderMeta={folderMeta}
                  />
                )}
              </div>

              <div style={styles.statusbar}>
                <span>
                  {loading ? '…' : isLeaf
                    ? `${favourites.size} favourited`
                    : `${folders.length} folder${folders.length !== 1 ? 's' : ''}`}
                </span>
                <span style={{ color: 'var(--border-strong)' }}>
                  {breadcrumb.map(s => s.label).join(' / ').toLowerCase()}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {settingsOpen && (
        <SettingsModal
          roots={roots}
          activeRootId={activeRootId}
          onAddRoot={async () => { await addRoot() }}
          onRemoveRoot={removeRoot}
          onSwitchRoot={id => { switchRoot(id); setSettingsOpen(false) }}
          onClose={() => setSettingsOpen(false)}
          scale={settings.scale}
          onSetScale={scale => updateSettings({ scale })}
          currentTheme={settings.theme}
          onSetTheme={theme => updateSettings({ theme })}
          customColors={customColors}
          onSetCustomColors={updateCustomColors}
          tagManager={folderMeta}
        />
      )}
    </div>
  )
}

const styles = {
  app: {
    display: 'flex', flexDirection: 'column',
    height: 'calc(100vh / var(--app-scale, 1))',
    width: 'calc(100vw / var(--app-scale, 1))',
    background: 'var(--bg-base)', overflow: 'hidden',
  },
  bootScreen: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  bootText: { fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em' },
  layout:   { display: 'flex', flex: 1, minHeight: 0 },
  main:     { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  contentArea: { flex: 1, overflowY: 'auto', minHeight: 0 },
  statusbar: {
    padding: '5px 14px',
    borderTop: '0.5px solid var(--border-subtle)',
    fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.07em',
    display: 'flex', justifyContent: 'space-between', flexShrink: 0,
  },
}
