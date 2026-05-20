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


okay this bit here was written by Riku
May 6th
I spent the whole day ideating for this project. The open endedness of this project makes it by far the most challenging from this paper. The reason for that is because I feel like all issues that I could come up with were way out of scope and also not my areas of expertise. One idea I had was to make an app that automatically detects when steam remote play is running and implement a color profile system wide to my pc so that I dont have to change the color and brightness settings over and over again in the game settings every time I want to play a game on my TV. It wouldnt work though because setting that up will be a pain. I also thought about doing something like an AI helper for digital art, like for learning how to draw but it occured to me that that could just be done with any LLM. I finally landed on the idea of making a moodboard managing software that combines and improves on the functions of the windows file explorer, pureref, and pinterest and make it completely local. This is the only idea I could come up with that I feel like I could use and be passionate about creating. 
I then made a prototype quickly within claude Just in time for the check in on May 7th

May 11th
I made my success criteria and my timeline, along with actually starting the project on claude. Its being made on Node.js, not that I know anything about it, Claude just said that it is the best for this particular project. In retrospect, I could've been a little less vague with my success criteria because maybe im setting myself up with a gargantuan assignment, but oh well as Masaego says in his song "Sax Fifth Avenue" "If we not headed for the top where we goin'"

May 20th
I had the day off school yesterday I know I know Im sorry but hear me out, I was doing a game jam over the weekend for another course while also having to juggle work on saturday night and oil painting class on sunday morning. However because I am not a programmer and I am not confident in using Godot, I bought a claude pro subscription so that Claude can walk me through the progress of using godot to make a game. We ended up coming 9th which is actually really good. This is to say, today I set up claude code in Visual Studio Code and oh my god it is so much easier to make stuff in here now. Gone are the days of copying and pasting files into and out of claude into VSC and now the edits happen in here. You have no idea how much quicker coding is. Today I set the goal of doing everything i said Id do by tomorrow by tomorrow. Actually turned out easier than I thought. I changed the font, I added a bunch of features like color coding, favorites, sorting and grouping folders, a settings menu that has options like color themes, I made a logo that actually looks great, the app now remembers the folder you set as the root folder and I fixed some bugs surrounding the layout of the app as well. 

I think I have more to say about AI but its too late to do that today so Im writing this down here so that I remember to do that for my next entry. 