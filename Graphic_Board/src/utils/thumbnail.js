/**
 * Loads a file handle, draws it to an offscreen canvas at reduced size,
 * and returns a small compressed JPEG blob URL.
 *
 * createImageBitmap decodes without a DOM element and frees memory faster
 * than new Image(). bitmap.close() explicitly releases the decoded pixels
 * after the canvas draw, so only the small JPEG blob stays in memory.
 */
export async function createThumbnail(fileHandle, maxWidth = 220, quality = 0.65) {
  const file = await fileHandle.getFile()
  const bitmap = await createImageBitmap(file)

  const scale = Math.min(1, maxWidth / bitmap.width)
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  bitmap.close() // free the full-res decoded pixels immediately

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(URL.createObjectURL(blob)) : reject(new Error('toBlob failed')),
      'image/jpeg',
      quality
    )
  })
}
