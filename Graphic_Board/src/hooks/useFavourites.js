import { useState, useEffect } from 'react'

export function useFavourites(config, updateConfig) {
  const [favourites, setFavourites] = useState(() => new Set())

  // Hydrate from config once it's loaded
  useEffect(() => {
    if (!config) return
    setFavourites(new Set(config.imageFavs ?? []))
  }, [config])

  const toggle = (imageId) => {
    setFavourites(prev => {
      const next = new Set(prev)
      if (next.has(imageId)) next.delete(imageId)
      else next.add(imageId)
      updateConfig({ imageFavs: [...next] })
      return next
    })
  }

  const isFavourited = (imageId) => favourites.has(imageId)

  return { favourites, toggle, isFavourited }
}
