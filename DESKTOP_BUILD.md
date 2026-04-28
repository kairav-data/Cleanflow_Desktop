# CleanFlow Desktop Build

This project now packages the existing React frontend and FastAPI backend into a Windows desktop app.

## Stack

- Renderer: Vite + React
- Desktop shell: Electron
- Local API sidecar: FastAPI bundled with PyInstaller
- Windows packaging: `electron-builder`

## Desktop behavior

- The Electron app starts a bundled local backend at `http://127.0.0.1:38123`.
- Runtime files are written to the app data directory instead of the install folder.
- The frontend is built in desktop mode so it can load from packaged local files.

## Build the `.exe`

Run this from the project root:

```powershell
npm install
npm run dist
```

The Windows artifacts are created in `dist-electron/`.

## Important note

The current desktop package includes the root `.env` file so the bundled backend can use the same configuration as the existing project. That is convenient for local builds, but it is not a safe long-term distribution model if the file contains private service credentials. Before sharing the installer publicly, move server-only secrets out of the desktop bundle.
