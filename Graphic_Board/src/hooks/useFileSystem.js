import { useState, useCallback } from 'react'

/**
 * useFileSystem
 * Wraps the File System Access API.
 * Returns collections (parent folders with subfolders) and helpers.
 */
export function useFileSystem() {
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Import a top-level folder as a collection.
  // Each subfolder inside becomes a "folder" within the collection.
  const importCollection = useCallback(async () => {
    if (!window.showDirectoryPicker) {
      setError('Your browser does not support the File System Access API. Please use Chrome or Edge.')
      return
    }
    try {
      setLoading(true)
      setError(null)

      const dirHandle = await window.showDirectoryPicker({ mode: 'read' })

      const collection = {
        id: crypto.randomUUID(),
        name: dirHandle.name,
        handle: dirHandle,
        folders: [],
        thumbnail: null,
      }

      // Scan for subfolders
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === 'directory') {
          const folder = {
            id: crypto.randomUUID(),
            name,
            handle,
            imageCount: 0,
            thumbnail: null,
          }
          // Count images inside
          let count = 0
          let firstImageHandle = null
          for await (const [fname, fhandle] of handle.entries()) {
            if (fhandle.kind === 'file' && isImageFile(fname)) {
              count++
              if (!firstImageHandle) firstImageHandle = fhandle
            }
          }
          folder.imageCount = count
          folder.thumbnailHandle = firstImageHandle
          collection.folders.push(folder)
        }
      }

      // Also count loose images at the top level of the collection
      let topLevelCount = 0
      let topLevelThumb = null
      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === 'file' && isImageFile(name)) {
          topLevelCount++
          if (!topLevelThumb) topLevelThumb = handle
        }
      }

      // If there are top-level images, create a default folder for them
      if (topLevelCount > 0) {
        collection.folders.unshift({
          id: crypto.randomUUID(),
          name: '— top level —',
          handle: dirHandle,
          imageCount: topLevelCount,
          thumbnailHandle: topLevelThumb,
          isTopLevel: true,
        })
      }

      setCollections(prev => [...prev, collection])
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError('Could not open folder: ' + err.message)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Load all image file handles from a folder handle
  const loadImages = useCallback(async (folderHandle, isTopLevel = false) => {
    const images = []
    for await (const [name, handle] of folderHandle.entries()) {
      if (handle.kind === 'file' && isImageFile(name)) {
        images.push({ id: crypto.randomUUID(), name, handle })
      }
    }
    // Sort by name
    images.sort((a, b) => a.name.localeCompare(b.name))
    return images
  }, [])

  // Get a blob URL for a file handle (call URL.revokeObjectURL when done)
  const getImageUrl = useCallback(async (fileHandle) => {
    const file = await fileHandle.getFile()
    return URL.createObjectURL(file)
  }, [])

  const removeCollection = useCallback((collectionId) => {
    setCollections(prev => prev.filter(c => c.id !== collectionId))
  }, [])

  return {
    collections,
    loading,
    error,
    importCollection,
    loadImages,
    getImageUrl,
    removeCollection,
  }
}

function isImageFile(name) {
  return /\.(jpe?g|png|gif|webp|avif|bmp|tiff?|svg)$/i.test(name)
}
