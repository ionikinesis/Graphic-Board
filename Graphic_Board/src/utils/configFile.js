const FILE_NAME = 'refboard.json'

const DEFAULTS = {
  version: 1,
  settings:     { scale: 1.0, theme: 'charcoal' },
  customColors: { bg: '#282828', accent: '#4a9fd4', text: '#e8e8e8' },
  viewSettings: { sortBy: 'alpha', groupBy: 'none', iconSize: 'medium' },
  folderModes:  {},
  folderColors: {},
  folderFavs:   [],
  imageFavs:    [],
  itemTags:     {},
  tagColors:    {},
  itemLinks:    {},
  folderOrder:  {},
  imageOrder:   {},
  sortNames:    {},
  recent:       {},
}

function loadLS(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

export function migrateFromLocalStorage() {
  return {
    version:      1,
    settings:     loadLS('refboard_settings',      DEFAULTS.settings),
    customColors: loadLS('refboard_custom_colors', DEFAULTS.customColors),
    viewSettings: DEFAULTS.viewSettings,
    folderModes:  {},
    folderColors: loadLS('refboard_folder_colors', {}),
    folderFavs:   loadLS('refboard_folder_favs',   []),
    imageFavs:    loadLS('refboard_favs',           []),
    itemTags:     loadLS('refboard_item_tags',     {}),
    tagColors:    loadLS('refboard_tag_colors',    {}),
    itemLinks:    loadLS('refboard_item_links',    {}),
    folderOrder:  loadLS('refboard_folder_order',  {}),
    imageOrder:   loadLS('refboard_image_order',   {}),
    sortNames:    loadLS('refboard_sort_names',    {}),
    recent:       loadLS('refboard_recent',        {}),
  }
}

export async function readConfig(rootHandle) {
  try {
    const fileHandle = await rootHandle.getFileHandle(FILE_NAME)
    const file = await fileHandle.getFile()
    const text = await file.text()
    const parsed = JSON.parse(text)
    return { ...DEFAULTS, ...parsed }
  } catch {
    return null
  }
}

export async function writeConfig(rootHandle, data) {
  try {
    const fileHandle = await rootHandle.getFileHandle(FILE_NAME, { create: true })
    const writable = await fileHandle.createWritable()
    await writable.write(JSON.stringify(data, null, 2))
    await writable.close()
  } catch (err) {
    console.warn('refboard: failed to write config file', err)
  }
}
