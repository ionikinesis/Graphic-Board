import React, { useState, useEffect, useRef } from 'react'
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
import { copyFile, moveFile, copyFolder, moveFolder } from './utils/fileOps.js'
import { writeFilesToDir, getImageFiles } from './utils/fileImport.js'
import FolderPicker from './components/FolderPicker.jsx'
import HelpModal from './components/HelpModal.jsx'

export default function App() {
  const {
    rootHandle, rootName, rootAbsPath, status: rootStatus,
    chooseRoot, grantPermission,
    roots, activeRootId, addRoot, removeRoot, switchRoot, setRootColor, setRootAbsPath,
  } = useRootDirectory()
  const {
    stack, folders, hasImages, loading, breadcrumb, currentHandle,
    canGoBack, canGoForward, navigateInto, navigateToPath, goBack, goForward,
    loadImages, getImageUrl, refreshCurrent, addFolderOptimistic,
  } = useNavigator(rootHandle)
  const { config, configReady, updateConfig } = useConfigFile(rootHandle)
  const { favourites, toggle: toggleFav, isFavourited } = useFavourites(config, updateConfig)
  const folderMeta = useFolderMeta(config, updateConfig)
  const { settings, update: updateSettings, customColors, updateCustomColors } = useAppSettings()

  const [settingsOpen,      setSettingsOpen]      = useState(false)
  const [helpOpen,          setHelpOpen]          = useState(false)
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0)
  const [reorderMode,       setReorderMode]       = useState(false)
  const [movePending,       setMovePending]       = useState(0)
  const [pendingFolderName,   setPendingFolderName]   = useState(null)
  const [contentAreaDragging, setContentAreaDragging] = useState(false)
  const [imageRefreshKey,     setImageRefreshKey]     = useState(0)
  const [showUndoToast,       setShowUndoToast]       = useState(false)
  const prevMovePendingRef  = useRef(0)
  const undoTimerRef        = useRef(null)
  const dragoverTimerRef    = useRef(null)
  const clipboardPasteRef   = useRef(null)
  // { items: [{name,handle,parentHandle,kind}], mode: 'move'|'copy' }
  const [sendToState, setSendToState] = useState(null)

  function adjustMovePending(delta) { setMovePending(c => c + delta) }
  // { mode:'copy'|'cut', kind:'file'|'directory', items:[{name,handle,parentHandle}] }
  const [clipboard, setClipboard] = useState(null)

  // Move undo stack — stored in a ref so handlers always see latest without re-binding
  // Each entry: { kind, name, destHandle, srcParentHandle }
  const moveUndoRef  = useRef([])
  const [moveUndoCount, setMoveUndoCount] = useState(0)

  // entry is either a single { kind, name, destHandle, srcParentHandle }
  // or an array of those (batch move) — stored as one undo slot
  function pushMoveUndo(entryOrBatch) {
    moveUndoRef.current = [...moveUndoRef.current.slice(-19), entryOrBatch]
    setMoveUndoCount(c => c + 1)
  }

  function refreshAll() { refreshCurrent(); setSidebarRefreshKey(k => k + 1) }

  async function handleNewFolder(name) {
    if (!currentHandle) return
    const handle = await currentHandle.getDirectoryHandle(name, { create: true }).catch(() => null)
    if (!handle) return
    addFolderOptimistic(name, handle)
    setPendingFolderName(name)
    setTimeout(() => {
      refreshAll()
      setPendingFolderName(null)
    }, 750)
  }

  async function undoLastMove() {
    const stack = moveUndoRef.current
    if (stack.length === 0) return
    const entryOrBatch = stack[stack.length - 1]
    const items = Array.isArray(entryOrBatch) ? entryOrBatch : [entryOrBatch]
    async function undoOne(entry) {
      const handle = entry.kind === 'file'
        ? await entry.destHandle.getFileHandle(entry.name).catch(() => null)
        : await entry.destHandle.getDirectoryHandle(entry.name).catch(() => null)
      if (handle) {
        if (entry.kind === 'file') await moveFile(handle, entry.destHandle, entry.srcParentHandle)
        else                       await moveFolder(handle, entry.destHandle, entry.srcParentHandle)
      }
    }
    try { await Promise.all(items.map(undoOne)) } catch (err) { console.warn('undo failed:', err) }
    moveUndoRef.current = stack.slice(0, -1)
    setMoveUndoCount(c => c - 1)
    refreshAll()
  }

  // Ctrl+Z — undo last move (only when not in a text input)
  useEffect(() => {
    function onKeyDown(e) {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'z' || e.shiftKey) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      e.preventDefault()
      undoLastMove()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })  // intentionally no deps — always sees latest undoLastMove

  async function handlePasteInto(destHandle) {
    if (!clipboard || !destHandle) return
    const { items, mode } = clipboard
    adjustMovePending(items.length)
    const completed = []
    await Promise.all(items.map(async item => {
      try {
        if (item.kind === 'file') {
          if (mode === 'cut') {
            const name = await moveFile(item.handle, item.parentHandle, destHandle)
            completed.push({ kind: 'file', name: name || item.name, destHandle, srcParentHandle: item.parentHandle })
          } else {
            await copyFile(item.handle, destHandle)
          }
        } else {
          if (mode === 'cut') {
            const name = await moveFolder(item.handle, item.parentHandle, destHandle)
            completed.push({ kind: 'directory', name: name || item.name, destHandle, srcParentHandle: item.parentHandle })
          } else {
            await copyFolder(item.handle, destHandle)
          }
        }
      } catch (err) { console.warn('paste failed:', err) }
      finally { adjustMovePending(-1) }
    }))
    if (completed.length > 0) pushMoveUndo(completed.length === 1 ? completed[0] : completed)
    if (mode === 'cut') setClipboard(null)
    refreshAll()
  }

  async function handlePickDestination(destHandle) {
    const state = sendToState
    setSendToState(null)
    if (!state || !destHandle) return
    const { items, mode } = state
    if (items.length > 5 && !window.confirm(`${mode === 'move' ? 'Move' : 'Copy'} ${items.length} items to "${destHandle.name}"?`)) return
    adjustMovePending(items.length)
    const completed = []
    await Promise.all(items.map(async item => {
      try {
        if (item.kind === 'file') {
          if (mode === 'move') {
            const name = await moveFile(item.handle, item.parentHandle, destHandle)
            completed.push({ kind: 'file', name: name || item.name, destHandle, srcParentHandle: item.parentHandle })
          } else {
            await copyFile(item.handle, destHandle)
          }
        } else {
          if (mode === 'move') {
            const name = await moveFolder(item.handle, item.parentHandle, destHandle)
            completed.push({ kind: 'directory', name: name || item.name, destHandle, srcParentHandle: item.parentHandle })
          } else {
            await copyFolder(item.handle, destHandle)
          }
        }
      } catch (err) { console.warn('send-to failed:', err) }
      finally { adjustMovePending(-1) }
    }))
    if (completed.length > 0) pushMoveUndo(completed.length === 1 ? completed[0] : completed)
    refreshAll()
  }

  async function handleSidebarDrop(destHandle) {
    const { getDragPayload, clearDragPayload } = await import('./utils/dragState.js')
    const payload = getDragPayload()
    if (!payload || !destHandle) return
    clearDragPayload()

    const items = payload.kind === 'multi'
      ? payload.items.filter(it => it.handle !== destHandle)
      : (payload.handle !== destHandle ? [payload] : [])

    if (items.length === 0) return
    if (items.length > 5 && !window.confirm(`Move ${items.length} items into "${destHandle.name}"?`)) return
    adjustMovePending(items.length)
    const completed = []
    await Promise.all(items.map(async it => {
      try {
        const name = it.kind === 'file'
          ? await moveFile(it.handle, it.parentHandle, destHandle)
          : await moveFolder(it.handle, it.parentHandle, destHandle)
        completed.push({ kind: it.kind, name: name || it.name, destHandle, srcParentHandle: it.parentHandle })
      } catch (err) { console.warn('sidebar drop failed:', err) }
      finally { adjustMovePending(-1) }
    }))
    if (completed.length > 0) pushMoveUndo(completed.length === 1 ? completed[0] : completed)
    refreshAll()
  }

  const iconSize = settings.iconSize ?? 'medium'

  // Derive path keys first — needed by hooks below
  const isLeaf    = !loading && folders.length === 0
  const pathKey   = stack.map(s => s.name).join('/')
  const parentPath = [rootHandle?.name, ...stack.map(s => s.name)].filter(Boolean).join('/')

  // Per-folder sort/group — stored in graphic_board.json so they travel with the folder
  const folderView  = config?.folderView ?? {}
  const currentView = folderView[parentPath] ?? {}
  const sortBy      = currentView.sortBy  ?? 'alpha'
  const groupBy     = currentView.groupBy ?? 'none'

  // Mouse back/forward buttons (button 3 = back, button 4 = forward)
  useEffect(() => {
    function onMouseUp(e) {
      if (e.button === 3) { e.preventDefault(); goBack() }
      if (e.button === 4) { e.preventDefault(); goForward() }
    }
    window.addEventListener('mouseup', onMouseUp)
    return () => window.removeEventListener('mouseup', onMouseUp)
  }, [goBack, goForward])

  // Fast-path clear when a drop lands on a child element (which calls stopPropagation)
  useEffect(() => {
    const clear = () => { clearTimeout(dragoverTimerRef.current); setContentAreaDragging(false) }
    window.addEventListener('drop', clear)
    return () => window.removeEventListener('drop', clear)
  }, [])

  // Ctrl+V — paste app clipboard into current folder
  useEffect(() => {
    function onKeyDown(e) {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 'v') return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (!clipboardPasteRef.current) return
      e.preventDefault()
      clipboardPasteRef.current()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  // When a move finishes, show an undo toast for 6 seconds
  useEffect(() => {
    if (prevMovePendingRef.current > 0 && movePending === 0 && moveUndoCount > 0) {
      setShowUndoToast(true)
      clearTimeout(undoTimerRef.current)
      undoTimerRef.current = setTimeout(() => setShowUndoToast(false), 6000)
    }
    prevMovePendingRef.current = movePending
  }, [movePending, moveUndoCount])

  // Reset reorder mode whenever the viewed folder changes
  useEffect(() => { setReorderMode(false) }, [parentPath])

  function handleSetSortBy(val) {
    const fv = config?.folderView ?? {}
    updateConfig({ folderView: { ...fv, [parentPath]: { ...(fv[parentPath] ?? {}), sortBy: val } } })
    if (val !== 'custom') setReorderMode(false)
  }
  function handleSetGroupBy(val) {
    const fv = config?.folderView ?? {}
    updateConfig({ folderView: { ...fv, [parentPath]: { ...(fv[parentPath] ?? {}), groupBy: val } } })
  }
  function handleSetIconSize(val) { updateSettings({ iconSize: val }) }

  // Record recently-opened when navigating into a folder
  function handleNavigateInto(folder) {
    const pk = [...(rootHandle ? [rootHandle.name] : []), ...stack.map(s => s.name), folder.name].join('/')
    if (folderMeta.getFolderMode(pk) === 'board') {
      const winName = 'board_' + encodeURIComponent(pk)
      window.open(`/?board&path=${encodeURIComponent(pk)}`, winName)
      return
    }
    folderMeta.touchFolder(pk)
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

  clipboardPasteRef.current = clipboard && currentHandle ? () => handlePasteInto(currentHandle) : null

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
        <SetupScreen status={rootStatus} rootName={rootName} onChoose={chooseRoot} onGrant={grantPermission} onOpenHelp={() => setHelpOpen(true)} />
        {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      </div>
    )
  }

  return (
    <div style={styles.app}>
      <Topbar
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
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
          getFolderColor={folderMeta.getFolderColor}
          refreshKey={sidebarRefreshKey}
          onDropItem={handleSidebarDrop}
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
                reorderMode={reorderMode}
                onToggleReorderMode={() => setReorderMode(r => !r)}
                onNewFolder={currentHandle ? handleNewFolder : null}
              />

              <div
                style={{ ...styles.contentArea, background: reorderMode ? 'rgba(0,0,0,0.18)' : undefined, transition: 'background 0.25s' }}
                onDragOver={e => {
                  if (!e.dataTransfer.types.includes('Files')) return
                  const overCard = e.target.closest('[data-card]')
                  clearTimeout(dragoverTimerRef.current)
                  if (overCard) { setContentAreaDragging(false); return }
                  e.preventDefault()
                  e.dataTransfer.dropEffect = 'copy'
                  setContentAreaDragging(true)
                  // dragover fires continuously while dragging; if it stops, the drag ended
                  dragoverTimerRef.current = setTimeout(() => setContentAreaDragging(false), 150)
                }}
                onDrop={async e => {
                  clearTimeout(dragoverTimerRef.current)
                  setContentAreaDragging(false)
                  if (e.target.closest('[data-card]')) return
                  if (!e.dataTransfer.types.includes('Files') || !currentHandle) return
                  e.preventDefault()
                  const files = getImageFiles(e)
                  if (files.length === 0) return
                  await writeFilesToDir(currentHandle, files)
                  refreshAll()
                  setImageRefreshKey(k => k + 1)
                }}
              >
                {contentAreaDragging && (
                  <div style={styles.dropOverlay} onDrop={e => e.stopPropagation()}>
                    <span style={styles.dropHint}>
                      drop to add to <strong>{currentHandle?.name}</strong>
                    </span>
                  </div>
                )}
                {loading && folders.length === 0 && (
                  <div style={styles.folderLoading}>
                    <span style={styles.folderLoadingText}>loading...</span>
                  </div>
                )}
                {folders.length > 0 && (
                  <FolderGrid
                    folders={folders}
                    onSelectFolder={handleNavigateInto}
                    getImageUrl={getImageUrl}
                    folderMeta={folderMeta}
                    parentPath={parentPath}
                    rootAbsPath={rootAbsPath || ''}
                    fillHeight={!hasImages}
                    sortBy={sortBy}
                    iconSize={iconSize}
                    groupBy={groupBy}
                    reorderMode={reorderMode}
                    currentHandle={currentHandle}
                    onNewFolder={currentHandle ? handleNewFolder : null}
                    pendingFolderName={pendingFolderName}
                    onDeleteFolder={currentHandle ? async name => {
                      await currentHandle.removeEntry(name, { recursive: true }).catch(() => {})
                      refreshAll()
                    } : null}
                    onRefresh={refreshAll}
                    onMoveCompleted={pushMoveUndo}
                    onMovePending={adjustMovePending}
                    clipboard={clipboard}
                    onClipboardCut={item  => setClipboard({ mode: 'cut',  kind: item.kind ?? 'directory', items: item.items ?? [item] })}
                    onClipboardCopy={item => setClipboard({ mode: 'copy', kind: item.kind ?? 'directory', items: item.items ?? [item] })}
                    onClipboardPaste={() => handlePasteInto(currentHandle)}
                    onSendTo={items => setSendToState({ items, mode: 'move' })}
                    onCopyTo={items => setSendToState({ items, mode: 'copy' })}
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
                    groupBy={groupBy}
                    reorderMode={reorderMode}
                    hideWhenEmpty={!isLeaf}
                    fillHeight={isLeaf}
                    parentPath={parentPath}
                    folderMeta={folderMeta}
                    clipboard={clipboard}
                    onClipboardCut={item  => setClipboard({ mode: 'cut',  kind: 'file', items: [item] })}
                    onClipboardCopy={item => setClipboard({ mode: 'copy', kind: 'file', items: [item] })}
                    onClipboardPaste={() => handlePasteInto(currentHandle)}
                    onSendTo={items => setSendToState({ items, mode: 'move' })}
                    onCopyTo={items => setSendToState({ items, mode: 'copy' })}
                    imageRefreshKey={imageRefreshKey}
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

      {(movePending > 0 || showUndoToast) && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          zIndex: 1200,
          background: 'var(--bg-surface)', border: '0.5px solid var(--border-mid)',
          borderRadius: 'var(--radius-lg)', boxShadow: '0 12px 40px rgba(0,0,0,0.75)',
          padding: '16px 22px 14px', minWidth: 280,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {movePending > 0 ? (<>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{
                display: 'inline-block', width: 14, height: 14, flexShrink: 0,
                borderRadius: '50%', border: '2px solid var(--accent)', borderTopColor: 'transparent',
                animation: 'mv-spin 0.7s linear infinite',
              }} />
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>
                Moving {movePending} item{movePending !== 1 ? 's' : ''}…
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--bg-deep)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: '35%', background: 'var(--accent)', borderRadius: 2,
                animation: 'mv-bar 1.4s ease-in-out infinite',
              }} />
            </div>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
              this may take a moment for large folders
            </span>
          </>) : (<>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>✓</span>
              <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700, flex: 1 }}>move complete</span>
              <button
                onClick={() => setShowUndoToast(false)}
                style={{ fontSize: 11, color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
              >✕</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => { undoLastMove(); setShowUndoToast(false) }}
                style={{
                  flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  padding: '8px 14px', background: 'var(--accent)', color: 'var(--accent-text)',
                  border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', letterSpacing: '0.04em',
                }}
              >↩ undo move</button>
              <button
                onClick={() => setShowUndoToast(false)}
                style={{
                  fontSize: 12, fontFamily: 'var(--font-mono)',
                  padding: '8px 14px', background: 'var(--bg-raised)', color: 'var(--text-muted)',
                  border: '0.5px solid var(--border-mid)', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                }}
              >keep</button>
            </div>
          </>)}
          <style>{`@keyframes mv-spin{to{transform:rotate(360deg)}}@keyframes mv-bar{0%{transform:translateX(-100%)}100%{transform:translateX(390%)}}`}</style>
        </div>
      )}

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      {sendToState && (
        <FolderPicker
          roots={roots}
          mode={sendToState.mode}
          onSelect={handlePickDestination}
          onClose={() => setSendToState(null)}
        />
      )}

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
          textScale={settings.textScale ?? 1.0}
          onSetTextScale={textScale => updateSettings({ textScale })}
          currentTheme={settings.theme}
          onSetTheme={theme => updateSettings({ theme })}
          customColors={customColors}
          onSetCustomColors={updateCustomColors}
          onSetRootAbsPath={setRootAbsPath}
          tagManager={folderMeta}
          highContrast={settings.highContrast ?? false}
          onSetHighContrast={v => updateSettings({ highContrast: v })}
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
  contentArea: { flex: 1, overflowY: 'auto', minHeight: 0, position: 'relative' },
  folderLoading: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' },
  folderLoadingText: { fontSize: 13, color: 'var(--text-muted)', letterSpacing: '0.08em' },
  dropOverlay: {
    position: 'absolute', inset: 0, zIndex: 50, pointerEvents: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(var(--accent-rgb, 74,159,212), 0.08)',
    border: '2px dashed var(--accent)', borderRadius: 6, margin: 8,
  },
  dropHint: {
    fontSize: 'var(--fs-11)', color: 'var(--accent)', letterSpacing: '0.08em',
    background: 'var(--bg-surface)', padding: '6px 14px', borderRadius: 20,
    border: '0.5px solid var(--border-mid)',
  },
  statusbar: {
    padding: '5px 14px',
    borderTop: '0.5px solid var(--border-subtle)',
    fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.07em',
    display: 'flex', justifyContent: 'space-between', flexShrink: 0,
  },
}
