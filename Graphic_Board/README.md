# refboard

A local reference image manager for digital artists. Browse your existing image folders with a visual grid interface — better thumbnails, favouriting, and cleaner navigation than Windows File Explorer.

## Setup

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in Chrome or Edge.

## How it works

refboard uses the **File System Access API** to read folders directly from your computer. Nothing is uploaded anywhere. Your files stay on your machine.

- Import any folder — its subfolders become collections
- Click a collection to see subfolders as a visual grid
- Click a subfolder to see images as a full grid
- Star images to add them to Favourites (persists between sessions)
- Toggle between grid and large view

## Browser support

Requires Chrome or Edge. The File System Access API is not supported in Firefox or Safari.

## Structure

```
src/
  components/
    Topbar.jsx        — top bar with logo and import button
    Sidebar.jsx       — collection list
    FolderGrid.jsx    — subfolder cards view
    ImageGrid.jsx     — image grid view
    ViewHeader.jsx    — breadcrumb and view toggle
    EmptyState.jsx    — welcome screen
  hooks/
    useFileSystem.js  — File System Access API wrapper
    useFavourites.js  — localStorage-backed favourites
  App.jsx             — main state and navigation
  main.jsx            — entry point
  index.css           — CSS variables and base styles
```

## Roadmap / stretch goals

- [ ] Search across all images by filename
- [ ] Sort by date, name, file size
- [ ] Custom folder thumbnails (right-click → set as thumbnail)
- [ ] Drag images out to desktop or PureRef
- [ ] Full-screen image preview with keyboard navigation
- [ ] Tagging and mood labels
- [ ] Browser extension for capturing images from the web
