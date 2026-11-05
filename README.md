# Wisp Drone Designer

A browser-based 3D editor for designing indoor drone light shows. Designers build a show from formations, motion and light effects, and the designer exports one file per drone: polynomial trajectory pieces plus an LED track, ready to upload to each drone's ESP32 over Wi-Fi.

The whole app is one self-contained file, `index.html`. It needs no build step and no install.

## Run it

Open `index.html` in a recent Chrome, Edge, Firefox or Safari. It needs an internet connection the first time to load three.js and the fonts from public CDNs.

To serve it locally instead (useful on some browsers that restrict local files):

```bash
npm start            # serves the folder at http://localhost:8080
```

To publish it for the team, turn on GitHub Pages for this repository (Settings → Pages → deploy from the `main` branch, root folder).

## What it does

- **Formations:** 12 built-in shapes (grid, line, circle, square, triangle, star, heart, wave, sphere, helix, cube, cone) with size, rotation, position and orientation.
- **Hand placement:** drag any drone in the 3D view at any moment. At the start of a formation this reshapes it; later in a formation it adds a keyframe; outside any formation it saves a new pose.
- **Motion inside a formation:** spin, rise and fall, wave and pulse effects, plus keyframes joined by smooth curves or straight lines.
- **Transitions:** drones are matched to their next spots to keep travel short, fly smooth minimum-jerk paths, and leave at staggered times when paths would pass too close.
- **Light effects:** solid colour, gradient, rainbow, pulse, blink, chase, sparkle and lights off, each with timing, fades and drone targeting, on their own timeline lane.
- **Safety check:** every 0.05 s of the show is checked for minimum spacing, maximum speed and acceleration, and staying inside the flight area.
- **Show settings:** drone count, flight area size, limits, takeoff grid and total show length.
- **Saving:** every change is saved in the browser. Inside claude.ai it also syncs to the user's account. File → Download backup saves a `.show.json` you can open again later.
- **Export:** a `.zip` with `drone_NN.bin` and `drone_NN.txt` for every drone, `manifest.json`, `takeoff_layout.csv`, `FORMAT.md` and a backup of the show. Every `.bin` is read back and checked before download.

## Coordinates and drone numbers

Metres. x runs left to right as the audience sees it, y points away from the audience, z points up. The origin is the centre of the flight-area floor.

Drone N is `drone_NN.bin` and takes off from takeoff pad N. Pads are numbered left to right, starting with the row furthest from the audience. To keep the return flight short and safe, each drone lands on the nearest free pad, which may not be the one it took off from, so reset the drones onto their numbered pads before the next show. The **Numbers** button in the 3D view labels every drone and pad.

## File format

See [`docs/FORMAT.md`](docs/FORMAT.md) for the exact byte layout of the `.bin` files, written for the ESP32 parser. In short: a 32-byte header (magic `DSHW`, version, drone number, show ID, counts, length, CRC-32), then 132-byte trajectory pieces (duration plus 8 coefficients each for x, y, z and yaw), then 12-byte LED events.

## Code layout

`index.html` contains the page, its styles and one script. The show logic sits between the `// ===== CORE START` and `// ===== CORE END` markers and has no DOM access, so it can be tested in Node:

- shapes and formation placement
- drone-to-spot assignment (Hungarian algorithm) and staggered, minimum-jerk transitions
- motion effects and keyframe interpolation
- light effects
- the safety check
- polynomial fitting, `.bin`/`.txt` writing, CRC-32 and the zip writer

Everything after the core is the editor: the three.js stage, storyboard, inspector, timeline, autosave and export dialog.

## Tests

```bash
npm test
```

The tests check every shape, the safety check on a sample show, takeoff and landing positions, every light effect, and that exported `.bin` files round-trip with a valid CRC and follow the designed path within 5 mm.
