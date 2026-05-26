import { useState, useEffect, useCallback } from 'react'

const IMAGE_RE = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?|svg)$/i

async function scanDir(handle) {
  const folders = []
  let hasImages = false

  for await (const [name, h] of handle.entries()) {
    if (h.kind === 'directory') {
      let thumb = null, imgCount = 0, subCount = 0
      for await (const [fn, fh] of h.entries()) {
        if (fh.kind === 'file' && IMAGE_RE.test(fn)) {
          imgCount++
          if (!thumb) thumb = fh
        } else if (fh.kind === 'directory') {
          subCount++
        }
      }
      folders.push({
        id: name, // stable within directory — safe as React key
        name,
        handle: h,
        thumbnailHandle: thumb,
        imageCount: imgCount,
        subfolderCount: subCount,
      })
    } else if (h.kind === 'file' && IMAGE_RE.test(name)) {
      hasImages = true
    }
  }

  folders.sort((a, b) => a.name.localeCompare(b.name))
  return { folders, hasImages }
}

export function useNavigator(rootHandle) {
  const [stack,        setStack]        = useState([])
  const [forwardStack, setForwardStack] = useState([])
  const [currentHandle, setCurrentHandle] = useState(null)
  const [folders,     setFolders]    = useState([])
  const [hasImages,   setHasImages]  = useState(false)
  const [loading,     setLoading]    = useState(false)
  const [scanVersion, setScanVersion] = useState(0)

  useEffect(() => {
    if (!rootHandle) {
      setStack([]); setForwardStack([]); setCurrentHandle(null)
      setFolders([]); setHasImages(false)
      return
    }
    setStack([]); setForwardStack([])
    setCurrentHandle(rootHandle)
  }, [rootHandle])

  useEffect(() => {
    if (!currentHandle) { setFolders([]); setHasImages(false); return }
    let cancelled = false
    setLoading(true)
    setFolders([]); setHasImages(false)
    scanDir(currentHandle)
      .then(({ folders, hasImages }) => {
        if (!cancelled) { setFolders(folders); setHasImages(hasImages); setLoading(false) }
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [currentHandle, scanVersion])

  const navigateInto = useCallback((folder) => {
    setStack(prev => [...prev, { name: folder.name, handle: folder.handle }])
    setForwardStack([])
    setCurrentHandle(folder.handle)
  }, [])

  const navigateToPath = useCallback((path) => {
    setStack(path)
    setForwardStack([])
    setCurrentHandle(path.length > 0 ? path[path.length - 1].handle : rootHandle)
  }, [rootHandle])

  const goBack = useCallback(() => {
    setStack(prev => {
      if (prev.length === 0) return prev
      const removed = prev[prev.length - 1]
      const next = prev.slice(0, -1)
      setForwardStack(fwd => [removed, ...fwd])
      setCurrentHandle(next.length > 0 ? next[next.length - 1].handle : rootHandle)
      return next
    })
  }, [rootHandle])

  const goForward = useCallback(() => {
    setForwardStack(prev => {
      if (prev.length === 0) return prev
      const [item, ...rest] = prev
      setStack(s => [...s, item])
      setCurrentHandle(item.handle)
      return rest
    })
  }, [])

  const refreshCurrent = useCallback(() => setScanVersion(v => v + 1), [])

  const breadcrumb = (() => {
    const crumbs = []
    if (rootHandle) crumbs.push({ label: rootHandle.name, index: -1 })
    stack.forEach((item, i) => crumbs.push({ label: item.name, index: i }))
    return crumbs
  })()

  const loadImages = useCallback(async (folderHandle) => {
    const images = []
    for await (const [name, handle] of folderHandle.entries()) {
      if (handle.kind === 'file' && IMAGE_RE.test(name)) {
        images.push({ id: name, name, handle })
      }
    }
    images.sort((a, b) => a.name.localeCompare(b.name))
    return images
  }, [])

  const getImageUrl = useCallback(async (fileHandle) => {
    const file = await fileHandle.getFile()
    return URL.createObjectURL(file)
  }, [])

  return {
    stack, folders, hasImages, loading, breadcrumb, currentHandle,
    canGoBack:    stack.length > 0,
    canGoForward: forwardStack.length > 0,
    navigateInto, navigateToPath, goBack, goForward,
    loadImages, getImageUrl, refreshCurrent,
  }
}
