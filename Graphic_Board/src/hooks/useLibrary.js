// useLibrary.js
// Manages all file system state: collections, favourites, navigation
import { useState, useCallback } from 'react';

const FAVS_KEY = 'refboard_favourites';
const COLLECTIONS_KEY = 'refboard_collections';

function loadFavourites() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAVS_KEY) || '[]'));
  } catch { return new Set(); }
}

function saveFavourites(favs) {
  localStorage.setItem(FAVS_KEY, JSON.stringify([...favs]));
}

function loadCollectionMeta() {
  try {
    return JSON.parse(localStorage.getItem(COLLECTIONS_KEY) || '{}');
  } catch { return {}; }
}

function saveCollectionMeta(meta) {
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(meta));
}

export function useLibrary() {
  // collections: array of { name, handle, children: [{ name, handle, images: [File] }] }
  const [collections, setCollections] = useState([]);
  const [favourites, setFavourites] = useState(loadFavourites);
  const [collectionMeta, setCollectionMeta] = useState(loadCollectionMeta);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Import a top-level folder. Subfolders become children. Images in subfolders are loaded.
  const importFolder = useCallback(async () => {
    if (!window.showDirectoryPicker) {
      setError('File System Access API not supported in this browser. Please use Chrome or Edge.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const dirHandle = await window.showDirectoryPicker({ mode: 'read' });
      const collection = { name: dirHandle.name, handle: dirHandle, children: [] };

      for await (const [name, handle] of dirHandle.entries()) {
        if (handle.kind === 'directory') {
          const child = { name, handle, images: [] };
          for await (const [imgName, imgHandle] of handle.entries()) {
            if (imgHandle.kind === 'file' && isImage(imgName)) {
              const file = await imgHandle.getFile();
              child.images.push({ name: imgName, file, url: URL.createObjectURL(file), handle: imgHandle });
            }
          }
          child.images.sort((a, b) => a.name.localeCompare(b.name));
          collection.children.push(child);
        } else if (handle.kind === 'file' && isImage(name)) {
          // Images directly in the root folder go into an implicit child
          if (!collection._rootImages) collection._rootImages = [];
          const file = await handle.getFile();
          collection._rootImages.push({ name, file, url: URL.createObjectURL(file), handle });
        }
      }

      collection.children.sort((a, b) => a.name.localeCompare(b.name));

      // If there are root-level images, add them as a special child
      if (collection._rootImages?.length) {
        collection.children.unshift({ name: '— all images —', handle: null, images: collection._rootImages });
        delete collection._rootImages;
      }

      setCollections(prev => {
        // Replace if same name, otherwise append
        const exists = prev.findIndex(c => c.name === collection.name);
        if (exists >= 0) { const next = [...prev]; next[exists] = collection; return next; }
        return [...prev, collection];
      });
    } catch (e) {
      if (e.name !== 'AbortError') setError('Could not open folder: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const removeCollection = useCallback((collectionName) => {
    setCollections(prev => prev.filter(c => c.name !== collectionName));
  }, []);

  const toggleFavourite = useCallback((imageKey) => {
    setFavourites(prev => {
      const next = new Set(prev);
      if (next.has(imageKey)) next.delete(imageKey);
      else next.add(imageKey);
      saveFavourites(next);
      return next;
    });
  }, []);

  const isFavourite = useCallback((imageKey) => favourites.has(imageKey), [favourites]);

  const setFolderThumbnail = useCallback((collectionName, childName, imageUrl) => {
    setCollectionMeta(prev => {
      const key = `${collectionName}__${childName}`;
      const next = { ...prev, [key]: imageUrl };
      saveCollectionMeta(next);
      return next;
    });
  }, []);

  const getFolderThumbnail = useCallback((collectionName, childName) => {
    return collectionMeta[`${collectionName}__${childName}`] || null;
  }, [collectionMeta]);

  // Build imageKey from collection, child, image name
  const imageKey = (collectionName, childName, imageName) =>
    `${collectionName}::${childName}::${imageName}`;

  // Get all favourited images across all collections
  const getAllFavourites = useCallback(() => {
    const result = [];
    for (const col of collections) {
      for (const child of col.children) {
        for (const img of child.images) {
          const key = imageKey(col.name, child.name, img.name);
          if (favourites.has(key)) result.push({ ...img, collectionName: col.name, childName: child.name, key });
        }
      }
    }
    return result;
  }, [collections, favourites]);

  // Get all images across all collections sorted by file lastModified (recent)
  const getRecentImages = useCallback((days = 7) => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const result = [];
    for (const col of collections) {
      for (const child of col.children) {
        for (const img of child.images) {
          if (img.file.lastModified >= cutoff) {
            result.push({ ...img, collectionName: col.name, childName: child.name });
          }
        }
      }
    }
    return result.sort((a, b) => b.file.lastModified - a.file.lastModified);
  }, [collections]);

  return {
    collections,
    favourites,
    loading,
    error,
    importFolder,
    removeCollection,
    toggleFavourite,
    isFavourite,
    imageKey,
    setFolderThumbnail,
    getFolderThumbnail,
    getAllFavourites,
    getRecentImages,
  };
}

function isImage(name) {
  return /\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?)$/i.test(name);
}
