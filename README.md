# Rivals Range

A browser-based first-person shooter prototype built with TypeScript, Vite, and Three.js. It includes a city-style training range, weapon swapping, targets, doors, simple scoring, chat, and local-tab multiplayer presence through `BroadcastChannel`.

## Requirements

- Node.js 18 or newer
- npm

## Getting Started

Install dependencies:

```sh
npm install
```

Start the development server:

```sh
npm run dev
```

Vite will print a local URL in the terminal, usually:

```txt
http://localhost:5173/
```

Open that URL in your browser, then click the deploy button to lock the pointer and start playing.

## Controls

- `W`, `A`, `S`, `D`: Move
- Mouse: Aim
- Left click: Fire
- `E`: Aim down sights
- `R`: Reload
- `O`: Open or close doors
- `1`-`5`: Swap weapons
- Chat box: Send messages to other open tabs

## Available Scripts

```sh
npm run dev
```

Runs the local development server.

```sh
npm run build
```

Type-checks the project with TypeScript and creates a production build.

```sh
npm run preview
```

Serves the production build locally so you can test it before deployment.

## Project Structure

```txt
index.html        HTML entry point
src/main.ts      Game setup, rendering, input, weapons, targets, and multiplayer logic
src/styles.css   HUD, overlay, chat, and game UI styles
```

## Notes

Multiplayer presence and chat use the browser's `BroadcastChannel` API, so they work between tabs or windows on the same device and browser profile. They are not networked across separate computers.
