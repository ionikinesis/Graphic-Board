export async function openBoard(pathKey, title) {
  if (window.__TAURI__) {
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      const label = 'board' + Date.now()
      const win = new WebviewWindow(label, {
        url: `/?board&path=${encodeURIComponent(pathKey)}`,
        title: title || 'board',
        decorations: false,
        width: 1280,
        height: 800,
        minWidth: 600,
        minHeight: 400,
      })
      win.once('tauri://error', err => console.error('board window error:', err))
    } catch (e) {
      console.error('[openBoard] failed to create WebviewWindow:', e)
    }
  } else {
    const winName = 'board_' + encodeURIComponent(pathKey)
    window.open(`/?board&path=${encodeURIComponent(pathKey)}`, winName)
  }
}

export async function openInExplorer(fullPath) {
  if (!fullPath) return

  if (window.__TAURI__) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('open_in_explorer', { path: fullPath })
    } catch (e) {
      console.error('[openInExplorer]', e)
    }
  } else {
    // Dev mode — Vite dev server spawns explorer.exe on the host machine
    fetch(`/api/open-explorer?path=${encodeURIComponent(fullPath)}`).catch(() => {})
  }
}
