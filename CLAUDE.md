# Graphic Board — Project Context for Claude

## What this is

A locally-run reference image manager for digital artists. Built with React + Vite. No backend, no uploads — everything stays on the user's machine. The project is a **design school project** where the focus is UX/form/function, not engineering purity. Runs at `localhost:5173` via `npm run dev`.

The source lives in `Graphic_Board/` inside the repo root.

## Design intent

Meant to be a better version of Windows File Explorer for browsing reference images. Inspired by PureRef. The user opens a root folder once (via browser File System Access API permission prompt), and the app remembers it across sessions via IndexedDB. Nothing is ever uploaded.

## Tech stack

- React 18 + Vite
- File System Access API — reads folders directly from disk
- IndexedDB (`utils/db.js`) — stores the root directory handle and custom thumbnails
- `refboard.json` in the root folder — primary persistence for all preferences (replaces localStorage as source of truth)
- localStorage — cache only (for instant first-paint before the JSON file loads)
- No router library — navigation state is all in `App.jsx` + `useNavigator`

## File structure

```
Graphic_Board/
  src/
    App.jsx                  ← all top-level state + layout shell
    main.jsx
    index.css                ← CSS variables only; theming done via JS in useAppSettings
    components/
      Topbar.jsx             ← top bar with logo and settings button
      Sidebar.jsx            ← shows root folder's top-level subfolders
      ViewHeader.jsx         ← breadcrumb + back/forward + sort/size/group controls
      FolderGrid.jsx         ← card grid of subfolders (with thumbnails, colours, tags, drag-to-reorder)
      ImageGrid.jsx          ← image thumbnails + lightbox
      SetupScreen.jsx        ← shown when no root is chosen or permission is needed
      SettingsModal.jsx      ← theme, scale, custom theme, root folder, tag manager
      EmptyState.jsx
      ContextMenu.jsx        ← right-click menu (colour, tags, link, sort name, rename)
    hooks/
      useNavigator.js        ← core navigation: stack, forward-stack, scanDir, breadcrumb
      useRootDirectory.js    ← IDB persistence of the root FileSystemDirectoryHandle
      useFolderMeta.js       ← folder colours, recents, folder-favs, custom thumbs, tags, links, order
      useFavourites.js       ← image-level favourites, backed by config file
      useAppSettings.js      ← theme + UI scale + custom colours, backed by config file
      useConfigFile.js       ← reads/writes refboard.json; all other hooks receive config+updateConfig
      useFileSystem.js       ← legacy hook (predates useNavigator, kept for reference)
      useLibrary.js          ← (exists, purpose TBD)
    utils/
      db.js                  ← shared IndexedDB wrapper (stores: 'handles', 'custom_thumbs')
      themes.js              ← 8 themes: charcoal, graphite, sunset, retro (dark); paper, latte, flashbang, girlypop (light)
      color.js               ← colour utilities + PRESET_COLORS
      thumbnail.js           ← thumbnail helpers
      configFile.js          ← read/write refboard.json, migrateFromLocalStorage()
```

## Navigation model

The app is a single-window drill-down navigator:

1. Root folder chosen → shown in sidebar, top-level subfolders appear in main area as a card grid (`FolderGrid`)
2. Click a subfolder → navigate into it (stack push), shows its subfolders or images
3. Leaf folder (no subfolders, has images) → shows `ImageGrid`
4. Mixed folder (subfolders AND images) → shows both
5. Breadcrumb and back/forward buttons (including mouse buttons 3/4) for navigation

`useNavigator` owns `stack`, `forwardStack`, and `currentHandle`. `navigateInto`, `navigateToPath`, `goBack`, `goForward` are its public API.

## Persistence architecture

All preferences are stored in `refboard.json` in the user's chosen root folder. This file travels with the folder, so preferences transfer automatically when moving the folder between machines or via cloud sync.

`useConfigFile(rootHandle)` is the single source of truth:
- Reads `refboard.json` on mount (or migrates from localStorage if no file exists yet)
- Returns `{ config, configReady, updateConfig }`
- All other hooks receive `config` and `updateConfig` as props — they hydrate from config and call `updateConfig(patch)` to save changes
- Writes are debounced (600ms) and also flushed synchronously on `beforeunload`

| Data | Storage |
|------|---------|
| Root directory handle | IndexedDB `handles` store (via `useRootDirectory`) |
| Custom folder thumbnails | IndexedDB `custom_thumbs` store (binary — cannot go in JSON) |
| App settings (theme, scale) | `refboard.json` → `settings` key |
| Custom theme colours | `refboard.json` → `customColors` key |
| View settings (sort, group, icon size) | `refboard.json` → `viewSettings` key |
| Image favourites | `refboard.json` → `imageFavs` key |
| Folder colours | `refboard.json` → `folderColors` key |
| Folder favourites | `refboard.json` → `folderFavs` key |
| Recently opened timestamps | `refboard.json` → `recent` key |
| Item tags + tag colours | `refboard.json` → `itemTags`, `tagColors` keys |
| Item links (URL per folder/image) | `refboard.json` → `itemLinks` key |
| Custom drag sort order | `refboard.json` → `folderOrder`, `imageOrder` keys |
| Sort name aliases | `refboard.json` → `sortNames` key |

localStorage is a write-through cache only (prevents theme flash on load). The JSON file is authoritative.

## Theming

8 themes defined in `utils/themes.js`. Applied by writing CSS custom properties onto `document.documentElement`. All colours in components reference CSS variables (e.g. `var(--bg-base)`, `var(--accent)`). Default theme is `charcoal` (dark). A ninth "custom" theme lets the user pick bg/accent/text hex colours; `generateCustomTheme()` in `themes.js` derives the full variable set from those three values.

## Features already built

- Root folder picker with permission re-grant on revisit
- Infinite drill-down folder navigation with back/forward history
- Folder card grid with thumbnail, image count, subfolder count
- Folder colour labels (custom hex, shown as coloured border/info bar)
- Folder favouriting
- Recently opened tracking
- Custom folder thumbnails (user picks an image, stored in IDB)
- Item tags with per-tag colours; tag manager in settings (rename, merge, delete)
- Image grid with lightbox
- Image favouriting
- Sort by: alpha, recent, favourites-first, colour, size, custom (drag-to-reorder)
- Group by: none, favourites, colour, tag
- Custom drag-to-reorder for both folders and images (only active when sort = custom)
- Sort name aliases (rename a folder for sort purposes without renaming on disk)
- Icon size selector (small / medium / large)
- Right-click context menu with: colour picker, tag editor, link editor, sort name, thumbnail controls, copy path
- Links per folder/image (URL + title, opens in new tab; shows favicon)
- 8 themes switchable at runtime + fully custom theme (bg/accent/text)
- UI zoom/scale setting
- Mouse back/forward button support
- All preferences stored in `refboard.json` inside the root folder (portable)

## What still needs building

- **Infinite canvas board** — opens in a new window when a folder's images are viewed; images freely positioned and resized on the canvas; positions/sizes persisted locally (like PureRef). This is the main remaining feature.
- **Search** — by filename across all images in the current root
- **Settings portability** — manual export/import of `refboard.json` (automatic via cloud sync already works)
- **Packaging** — wrap in Electron or Tauri so it installs like a normal desktop app (stretch goal)

## Key constraints / things to know

- File System Access API only works in Chromium-based browsers (Chrome, Edge). Firefox/Safari not supported — this is acceptable for the project scope.
- `URL.createObjectURL` is used for image URLs; these are ephemeral and not stored.
- The app never destructively writes to the file system — `refboard.json` is the only file created/modified.
- Folder rename was removed — `FileSystemDirectoryHandle.move()` is not reliably available for user-chosen directories. Tell users to rename in Explorer.
- Inline styles (JS style objects) are used throughout — there is no CSS module system or Tailwind. This is intentional and consistent; keep it this way.
- No TypeScript. Plain JSX throughout.
- No test suite. This is a design project, not a production codebase.
- The user is a design student. Prioritise visual clarity and UX decisions over engineering abstractions.

## Running the app

```powershell
cd Graphic_Board
npm run dev
```

Opens at `http://localhost:5173`.
