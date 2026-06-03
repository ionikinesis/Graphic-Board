const FILE_NAME     = 'graphic_board-boards.json'
const FILE_NAME_OLD = 'refboard-boards.json'

export async function readBoardFile(rootHandle) {
  try {
    const fh   = await rootHandle.getFileHandle(FILE_NAME)
    const file = await fh.getFile()
    const parsed = JSON.parse(await file.text())
    return parsed && typeof parsed === 'object' ? parsed : { boards: {} }
  } catch {}

  // Fall back to old filename and migrate on write
  try {
    const fh   = await rootHandle.getFileHandle(FILE_NAME_OLD)
    const file = await fh.getFile()
    const parsed = JSON.parse(await file.text())
    const data = parsed && typeof parsed === 'object' ? parsed : { boards: {} }
    writeBoardFile(rootHandle, data)
    return data
  } catch {}

  return { boards: {} }
}

export async function writeBoardFile(rootHandle, data) {
  try {
    const fh       = await rootHandle.getFileHandle(FILE_NAME, { create: true })
    const writable = await fh.createWritable()
    await writable.write(JSON.stringify(data, null, 2))
    await writable.close()
  } catch (err) {
    console.warn('Graphic Board: failed to write boards file', err)
  }
}
