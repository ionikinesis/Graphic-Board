const IMAGE_RE = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?|svg)$/i
const VIDEO_RE = /\.(mp4|webm|mov|m4v|ogg|ogv|avi|mkv)$/i

function isMediaFile(file) {
  return file.type.startsWith('image/') || file.type.startsWith('video/')
    || IMAGE_RE.test(file.name) || VIDEO_RE.test(file.name)
}

// Write File objects into a directory handle, auto-renaming on conflicts.
// Returns [{ name, handle }] for each successfully written file.
export async function writeFilesToDir(dirHandle, files) {
  const results = []
  for (const file of files) {
    if (!isMediaFile(file)) continue
    try {
      const name = await uniqueName(dirHandle, file.name || `pasted-${Date.now()}.png`)
      const fh       = await dirHandle.getFileHandle(name, { create: true })
      const writable = await fh.createWritable()
      await writable.write(await file.arrayBuffer())
      await writable.close()
      results.push({ name, handle: fh })
    } catch (err) {
      console.warn('fileImport: failed to write', file.name, err)
    }
  }
  return results
}

// Extract image File objects from a drag or paste event.
export function getImageFiles(e) {
  const dt = e.dataTransfer ?? e.clipboardData
  if (!dt) return []

  // File list (drag from OS, or image file copied in explorer)
  const fromFiles = [...(dt.files ?? [])].filter(isMediaFile)
  if (fromFiles.length > 0) return fromFiles

  // Items fallback: raw image/video data (e.g. screenshot in clipboard)
  const fromItems = []
  for (const item of dt.items ?? []) {
    if (item.type.startsWith('image/') || item.type.startsWith('video/')) {
      const blob = item.getAsFile()
      if (blob) {
        const mainType = item.type.split('/')[0] // 'image' or 'video'
        const subType  = item.type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'bin'
        const ext = mainType === 'video' ? subType : subType
        fromItems.push(new File([blob], `pasted-${Date.now()}.${ext}`, { type: item.type }))
      }
    }
  }
  return fromItems
}

// Read images from the system clipboard (requires clipboard-read permission).
export async function readClipboardImages() {
  const files = []
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type)
          const ext  = type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png'
          files.push(new File([blob], `pasted-${Date.now()}.${ext}`, { type }))
          break
        }
      }
    }
  } catch (err) {
    if (err.name !== 'NotAllowedError') console.warn('clipboard read failed:', err)
  }
  return files
}

async function uniqueName(dirHandle, name) {
  let candidate = name
  let counter   = 1
  while (true) {
    try {
      await dirHandle.getFileHandle(candidate)
      // File exists — try a numbered variant
      const dot  = name.lastIndexOf('.')
      const base = dot >= 0 ? name.slice(0, dot) : name
      const ext  = dot >= 0 ? name.slice(dot)    : ''
      candidate  = `${base} (${counter++})${ext}`
    } catch {
      return candidate   // getFileHandle threw → file doesn't exist, safe to use
    }
  }
}
