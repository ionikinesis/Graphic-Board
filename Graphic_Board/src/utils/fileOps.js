// Copy a file into a destination directory, auto-renaming on conflict.
export async function copyFile(fileHandle, destDirHandle) {
  const name = await uniqueName(destDirHandle, fileHandle.name)
  const file  = await fileHandle.getFile()
  const fh    = await destDirHandle.getFileHandle(name, { create: true })
  const w     = await fh.createWritable()
  await w.write(await file.arrayBuffer())
  await w.close()
  return { name, handle: fh }
}

// Move a file — tries native move() first, falls back to copy+delete.
export async function moveFile(fileHandle, srcParentHandle, destDirHandle) {
  try {
    await fileHandle.move(destDirHandle)
    return fileHandle.name
  } catch {}
  const { name } = await copyFile(fileHandle, destDirHandle)
  await srcParentHandle.removeEntry(fileHandle.name)
  return name
}

// Copy a folder recursively into a destination directory.
export async function copyFolder(srcHandle, destDirHandle) {
  const name = await uniqueName(destDirHandle, srcHandle.name)
  const dest = await destDirHandle.getDirectoryHandle(name, { create: true })
  await copyContents(srcHandle, dest)
  return { name, handle: dest }
}

async function copyContents(src, dest) {
  for await (const [n, h] of src.entries()) {
    if (h.kind === 'file') {
      const file = await h.getFile()
      const fh   = await dest.getFileHandle(n, { create: true })
      const w    = await fh.createWritable()
      await w.write(await file.arrayBuffer())
      await w.close()
    } else {
      const sub = await dest.getDirectoryHandle(n, { create: true })
      await copyContents(h, sub)
    }
  }
}

// Move a folder — tries native move() first, falls back to copy+delete.
export async function moveFolder(srcHandle, srcParentHandle, destDirHandle) {
  try {
    await srcHandle.move(destDirHandle)
    return srcHandle.name
  } catch {}
  const { name } = await copyFolder(srcHandle, destDirHandle)
  await srcParentHandle.removeEntry(srcHandle.name, { recursive: true })
  return name
}

// Returns a name that doesn't already exist in dirHandle.
async function uniqueName(dirHandle, name) {
  let candidate = name, i = 1
  while (true) {
    let exists = false
    try { await dirHandle.getFileHandle(candidate);      exists = true } catch {}
    if (!exists) try { await dirHandle.getDirectoryHandle(candidate); exists = true } catch {}
    if (!exists) return candidate
    const dot  = name.lastIndexOf('.')
    const base = dot >= 0 ? name.slice(0, dot) : name
    const ext  = dot >= 0 ? name.slice(dot)    : ''
    candidate  = `${base} (${i++})${ext}`
  }
}
