const FILE_NAME = 'refboard-boards.json'

export async function readBoardFile(rootHandle) {
  try {
    const fh   = await rootHandle.getFileHandle(FILE_NAME)
    const file = await fh.getFile()
    const parsed = JSON.parse(await file.text())
    return parsed && typeof parsed === 'object' ? parsed : { boards: {} }
  } catch {
    return { boards: {} }
  }
}

export async function writeBoardFile(rootHandle, data) {
  try {
    const fh       = await rootHandle.getFileHandle(FILE_NAME, { create: true })
    const writable = await fh.createWritable()
    await writable.write(JSON.stringify(data, null, 2))
    await writable.close()
  } catch (err) {
    console.warn('refboard: failed to write boards file', err)
  }
}
