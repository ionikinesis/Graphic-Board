const FILE_NAME     = 'graphic_board.json'
const FILE_NAME_OLD = 'refboard.json'

const DEFAULTS = {
  version:     1,
  folderModes: {},
  folderColors:{},
  folderFavs:  [],
  imageFavs:   [],
  itemTags:    {},
  tagColors:   {},
  itemLinks:   {},
  folderOrder: {},
  imageOrder:  {},
  sortNames:   {},
  recent:      {},
}

function loadLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

export function migrateFromLocalStorage() {
  return {
    ...DEFAULTS,
    folderColors: loadLS('refboard_folder_colors', {}),
    folderFavs:   loadLS('refboard_folder_favs',   []),
    imageFavs:    loadLS('refboard_favs',           []),
    itemTags:     loadLS('refboard_item_tags',      {}),
    tagColors:    loadLS('refboard_tag_colors',     {}),
    itemLinks:    loadLS('refboard_item_links',     {}),
    folderOrder:  loadLS('refboard_folder_order',   {}),
    imageOrder:   loadLS('refboard_image_order',    {}),
    sortNames:    loadLS('refboard_sort_names',     {}),
    recent:       loadLS('refboard_recent',         {}),
  }
}

export async function readConfig(rootHandle) {
  // Try new filename first
  try {
    const fh   = await rootHandle.getFileHandle(FILE_NAME)
    const file = await fh.getFile()
    return { ...DEFAULTS, ...JSON.parse(await file.text()) }
  } catch {}

  // Fall back to old filename and migrate on write
  try {
    const fh   = await rootHandle.getFileHandle(FILE_NAME_OLD)
    const file = await fh.getFile()
    const data = { ...DEFAULTS, ...JSON.parse(await file.text()) }
    writeConfig(rootHandle, data)
    return data
  } catch {}

  return null
}

export async function writeConfig(rootHandle, data) {
  try {
    const fh       = await rootHandle.getFileHandle(FILE_NAME, { create: true })
    const writable = await fh.createWritable()
    await writable.write(JSON.stringify(data, null, 2))
    await writable.close()
  } catch (err) {
    console.warn('Graphic Board: failed to write config file', err)
  }
}
