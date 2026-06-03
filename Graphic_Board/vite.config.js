import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn } from 'child_process'

function openExplorerPlugin() {
  return {
    name: 'open-explorer',
    configureServer(server) {
      server.middlewares.use('/api/open-explorer', (req, res) => {
        const qs = req.url.split('?')[1] || ''
        const p = new URLSearchParams(qs).get('path')
        if (p && process.platform === 'win32') {
          spawn('explorer.exe', [p], { detached: true, stdio: 'ignore' }).unref()
        }
        res.writeHead(200)
        res.end()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), openExplorerPlugin()],
})
