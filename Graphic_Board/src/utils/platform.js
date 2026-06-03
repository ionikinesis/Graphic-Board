export async function openInExplorer(fullPath) {
  if (!fullPath) return

  if (window.__TAURI__) {
    // Tauri v2 (plugin-opener)
    if (window.__TAURI__.core?.invoke) {
      await window.__TAURI__.core.invoke('plugin:opener|open_path', { path: fullPath }).catch(console.error)
    // Tauri v1 (shell.open)
    } else if (window.__TAURI__.shell?.open) {
      await window.__TAURI__.shell.open(fullPath).catch(console.error)
    }
  } else {
    // Dev mode — Vite server calls explorer.exe on the host
    fetch(`/api/open-explorer?path=${encodeURIComponent(fullPath)}`).catch(() => {})
  }
}
