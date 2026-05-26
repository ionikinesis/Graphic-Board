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
- localStorage — stores favourites, folder colours, recent timestamps, tags, app settings
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
      FolderGrid.jsx         ← card grid of subfolders (with thumbnails, colours, tags)
      ImageGrid.jsx          ← image thumbnails + lightbox
      SetupScreen.jsx        ← shown when no root is chosen or permission is needed
      SettingsModal.jsx      ← theme, scale, root folder, tag manager
      EmptyState.jsx
      ContextMenu.jsx        ← right-click menu
    hooks/
      useNavigator.js        ← core navigation: stack, forward-stack, scanDir, breadcrumb
      useRootDirectory.js    ← IDB persistence of the root FileSystemDirectoryHandle
      useFolderMeta.js       ← folder colours, recents, folder-favs, custom thumbs, tags
      useFavourites.js       ← image-level favourites in localStorage
      useAppSettings.js      ← theme + UI scale, persisted to localStorage
      useFileSystem.js       ← legacy hook (predates useNavigator, kept for reference)
      useLibrary.js          ← (exists, purpose TBD)
    utils/
      db.js                  ← shared IndexedDB wrapper (stores: 'handles', 'custom_thumbs')
      themes.js              ← 6 themes: void, graphite, inferno (dark); paper, latte, arctic (light)
      color.js               ← colour utilities
      thumbnail.js           ← thumbnail helpers
```

## Navigation model

The app is a single-window drill-down navigator:

1. Root folder chosen → shown in sidebar, top-level subfolders appear in main area as a card grid (`FolderGrid`)
2. Click a subfolder → navigate into it (stack push), shows its subfolders or images
3. Leaf folder (no subfolders, has images) → shows `ImageGrid`
4. Mixed folder (subfolders AND images) → shows both
5. Breadcrumb and back/forward buttons (including mouse buttons 3/4) for navigation

`useNavigator` owns `stack`, `forwardStack`, and `currentHandle`. `navigateInto`, `navigateToPath`, `goBack`, `goForward` are its public API.

## Persistence

| Data | Storage |
|------|---------|
| Root directory handle | IndexedDB `handles` store (via `useRootDirectory`) |
| Custom folder thumbnails | IndexedDB `custom_thumbs` store |
| Image favourites | localStorage `refboard_favs` |
| Folder colours | localStorage `refboard_folder_colors` |
| Folder favourites | localStorage `refboard_folder_favs` |
| Recently opened timestamps | localStorage `refboard_recent` |
| Item tags + tag colours | localStorage `refboard_item_tags`, `refboard_tag_colors` |
| App settings (theme, scale) | localStorage `refboard_settings` |

## Theming

6 themes defined in `utils/themes.js`. Applied by writing CSS custom properties onto `document.documentElement`. All colours in components reference CSS variables (e.g. `var(--bg-base)`, `var(--accent)`). Default theme is `void` (dark).

## Features already built

- Root folder picker with permission re-grant on revisit
- Infinite drill-down folder navigation with back/forward history
- Folder card grid with thumbnail, image count, subfolder count
- Folder colour labels (custom hex, shown as coloured border/dot)
- Folder favouriting
- Recently opened tracking
- Custom folder thumbnails (user picks an image, stored in IDB)
- Item tags with per-tag colours; tag manager in settings (rename, merge, delete)
- Image grid with lightbox
- Image favouriting
- Sort by: alpha, recent, favourites
- Group by: none, favourites
- Icon size selector (small / medium / large)
- Right-click context menu (`ContextMenu.jsx`)
- 6 themes switchable at runtime
- UI zoom/scale setting
- Mouse back/forward button support

## What still needs building

- **Infinite canvas board** — opens in a new window when a folder's images are viewed; images freely positioned and resized on the canvas; positions/sizes persisted locally (like PureRef). This is the main remaining feature.
- **Search** — by filename across all images in the current root
- **Custom sort order** — user-draggable ordering of folders/images that persists between sessions
- **Rename files** — rename image files on disk via File System Access API
- **Settings portability** — export/import settings JSON so preferences can be moved between devices
- **Packaging** — wrap in Electron or Tauri so it installs like a normal desktop app (stretch goal)

## Key constraints / things to know

- File System Access API only works in Chromium-based browsers (Chrome, Edge). Firefox/Safari not supported — this is acceptable for the project scope.
- `URL.createObjectURL` is used for image URLs; these are ephemeral and not stored.
- The app never writes to the file system except for the rename feature (not yet built).
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
