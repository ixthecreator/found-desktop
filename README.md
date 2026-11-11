# Found Desktop

An archive you rearrange by tidying up a stranger's computer.

## Concept

A secondhand computer from 2009 was never wiped. Its desktop is still full of
someone else's life between 2003 and 2007: 16 photos with camera names like
`DSC00612.JPG` instead of real titles, six short notes, one folder someone
started and gave up on, and a Recycle Bin.

The interface copies an early-2000s desktop, because the desktop was the first
place most people kept a personal archive, and it was usually a mess. The
visitor can't know what these pictures meant to the person who took them. By
renaming, grouping, filing and throwing things away, they decide what the
pictures mean now. **Rearranging is a way of writing the story.**

## How to use

- Drag files into folders, onto the Recycle Bin, or anywhere on the desktop.
- Double-click to open. Right-click for more, including **Arrange Icons By →
  Date (timeline)**, which lays the desktop out one column per year.
- Start → Search finds files by name, a word inside a note, type, year or
  location.
- Drop your own pictures onto the screen to leave something behind.
- Everything is saved in the visitor's own browser (localStorage). Start →
  Reset Desktop puts it all back the way it was found.

## Development

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
```

Every push to `main` is built and deployed to GitHub Pages by
`.github/workflows/deploy.yml`. The site is served from `/found-desktop/`
(see `base` in `vite.config.js`).

Photos are loaded from [Lorem Picsum](https://picsum.photos), which serves
images from Unsplash. Each photo's details show its photographer and links to
the original.
