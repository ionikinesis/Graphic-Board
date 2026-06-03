# refboard

A local reference image manager for digital artists. Browse your existing image folders with a visual grid interface — better thumbnails, favouriting, and cleaner navigation than Windows File Explorer.

## Setup

```bash
cd Graphic_Board
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

May 26th
today was a big day for working on this project because I had 3 hours to kill on campus. Last week Phoebe asked me where the preference information is stored. I didn't even think about it but considering that the preferences dont carry over devices, it must've been stored in the browser's cache. Then I was like, it would be cool if all that cool sorting information is instead stored locally inside the root folder so that if the folder that the program links to is on a usb drive or portable hard drive then the preferences can be transferred between devices which would be very useful for my very specific use case as I have 2 computers. I'm pretty sure it works haha. Ill test it tomorrow properly. I changed the theme presets because I wasnt a big fan of the ones that claude generated. I pointed it at some of the themes in VS code and monkeytype as inspiration and tweaked it to look a bit better. And if the user has better taste than me then they can just set it themself which is super cool. I also added a custom sorting option where the user can drag and sort the folders the way they want. I also added the feature where the user can link a website to any given file or folder in the right click menu and then access it by right clicking and clicking it. This feature is entirely tailored to me where in my collection of reference images and art and stuff I have the art of a lot of artists in folders titled by their twitter handle. In class today Phoebe asked whether the ability to change the names of files and folders in the program will work, and while I did try implementing the feature it didnt work, and when I asked it why claude said it was a browser limitation. 
okay update I gave it one prompt that carefully described the whole concept of the infinite canvas moodboard thing and it gave me a blank tab and I was like damn I guess it wouldnt work after one prompt, but then i told it what the problem i ran to is and it fixed it and it basically works perfectly as far as I can see which is such a surprise this tool is crazy powerful. 

May 29th
I was sitting in a class which had a terrible awkward energy as the teacher was trying to get a shy class of second years to critique other classmates' works and noone wanted to be rude. In order to escape this energy I fixed the laptop mousepad controls in the moodboard window.

May 31st
I added the feature of multiple root folders, thats just helpful stuff man. I also changed my mind about where the customization settings are stored, it was originally in the json files in the root folders so that the settings would be consistent between multiple machines, however it broke when introducing multiple root folders, so I changed it back, with the caveot that the user has to change the theme manually. 

June 1st
Pinch and a punch!, today I decided that if I am going to package this into an installable application for windows then I will need a more aesthetically pleasing icon and logo. I created one out of the diamond star shape and a blocky letter G I was inspired by online. I did this while adding some more features to the program such as a drag and drop system to move folders which then conflicted with the custom ordering system so fixing that took all of my claude tokens and half of my day. I readded the renaming folders and files system which doesnt due to browser limitations but it should work when packaging the app up. And I tweaked the preview system as well. I removed all instances of tutorial in the app because I am going to design a help screen tomorrow that is better than what the LLM haphasardly left around the app randomly. 

June 2nd
okay I ran into that claude problem again. Annoying little bug I think whats going on is that claude is using more tokens than I have allowance for just to read what has already been said previously in the chat, because it tells me I am out of tokens for the day and then when seeing how many tokens I have spent it says only about 20 percent. Annoying! anyways I decided Ill get claude to regularly update the Claude.md folder just to keep getting it back up to date as to what it is meant to do. Today I finished adding the selection and moving folders feature in the file manager part of the app. Also I tweaked some settings added a help screen fixed some of the buggy settings and wrestled with all of the bugs that I kept coming across. Some of which was so tough to overcome but we managed to lock in. most of the other things were polishing small details and adding customization options now that the app functions the way it is meant to for the most part. 