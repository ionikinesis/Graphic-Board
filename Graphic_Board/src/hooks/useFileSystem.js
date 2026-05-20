import { useState, useCallback } from 'react'

export function useFileSystem() {
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const loadFromRoot = useCallback(async (rootHandle) => {
    if (!rootHandle) { setCollections([]); return }
    setLoading(true)
    setError(null)
    try {
      const cols = []
      for await (const [colName, colHandle] of rootHandle.entries()) {
        if (colHandle.kind !== 'directory') continue

        const collection = { id: crypto.randomUUID(), name: colName, handle: colHandle, folders: [] }
        let topCount = 0, topThumb = null

        // Single pass over collection entries
        for await (const [entryName, entryHandle] of colHandle.entries()) {
          if (entryHandle.kind === 'file' && isImageFile(entryName)) {
            // Loose image directly in collection folder
            topCount++
            if (!topThumb) topThumb = entryHandle
          } else if (entryHandle.kind === 'directory') {
            // Level-2 folder: scan its contents
            let imgCount = 0, imgThumb = null
            const subfolders = []

            for await (const [fn, fh] of entryHandle.entries()) {
              if (fh.kind === 'file' && isImageFile(fn)) {
                imgCount++
                if (!imgThumb) imgThumb = fh
              } else if (fh.kind === 'directory') {
                // Level-3 subfolder: count its images
                let sfCount = 0, sfThumb = null
                for await (const [fn2, fh2] of fh.entries()) {
                  if (fh2.kind === 'file' && isImageFile(fn2)) {
                    sfCount++
                    if (!sfThumb) sfThumb = fh2
                  }
                }
                subfolders.push({
                  id: crypto.randomUUID(),
                  name: fn,
                  handle: fh,
                  imageCount: sfCount,
                  thumbnailHandle: sfThumb,
                })
              }
            }

            subfolders.sort((a, b) => a.name.localeCompare(b.name))
            collection.folders.push({
              id: crypto.randomUUID(),
              name: entryName,
              handle: entryHandle,
              imageCount: imgCount,
              thumbnailHandle: imgThumb,
              subfolders,
            })
          }
        }

        if (topCount > 0) {
          collection.folders.unshift({
            id: crypto.randomUUID(),
            name: '— top level —',
            handle: colHandle,
            imageCount: topCount,
            thumbnailHandle: topThumb,
            isTopLevel: true,
            subfolders: [],
          })
        }

        collection.folders.sort((a, b) => {
          if (a.isTopLevel) return -1
          if (b.isTopLevel) return 1
          return a.name.localeCompare(b.name)
        })

        cols.push(collection)
      }
      cols.sort((a, b) => a.name.localeCompare(b.name))
      setCollections(cols)
    } catch (err) {
      setError('Could not read library: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadImages = useCallback(async (folderHandle) => {
    const images = []
    for await (const [name, handle] of folderHandle.entries()) {
      if (handle.kind === 'file' && isImageFile(name)) {
        images.push({ id: crypto.randomUUID(), name, handle })
      }
    }
    images.sort((a, b) => a.name.localeCompare(b.name))
    return images
  }, [])

  const getImageUrl = useCallback(async (fileHandle) => {
    const file = await fileHandle.getFile()
    return URL.createObjectURL(file)
  }, [])

  return { collections, loading, error, loadFromRoot, loadImages, getImageUrl }
}

function isImageFile(name) {
  return /\.(jpe?g|png|gif|webp|avif|bmp|tiff?|svg)$/i.test(name)
}
