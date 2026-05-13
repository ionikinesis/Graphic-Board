import { useState, useEffect } from 'react'

const STORAGE_KEY = 'refboard_favourites'

export function useFavourites() {
  const [favourites, setFavourites] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...favourites]))
    } catch {
      // localStorage not available
    }
  }, [favourites])

  const toggle = (imageId) => {
    setFavourites(prev => {
      const next = new Set(prev)
      if (next.has(imageId)) next.delete(imageId)
      else next.add(imageId)
      return next
    })
  }

  const isFavourited = (imageId) => favourites.has(imageId)

  return { favourites, toggle, isFavourited }
}
