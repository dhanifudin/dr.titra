# Dr.titra

A lightweight desktop time tracking widget that integrates with your [Titra](https://github.com/kromitgmbh/titra) server.

## Features

- Start, pause, and resume timers with one click
- Organise work into tasks grouped by project
- Automatically syncs time entries to your Titra server
- Minimal bar mode — a tiny always-on-top strip that stays out of your way
- Persists timer state across restarts (resumes from where you left off)
- Dark theme

## Installation

Download the installer for your platform from the [Releases](../../releases) page:

| Platform | File |
|----------|------|
| Windows | `.exe` (NSIS installer) or `.msi` |
| macOS Apple Silicon | `_aarch64.dmg` |
| macOS Intel | `_x64.dmg` |
| Linux | `.AppImage` or `.deb` |

## Setup

1. Open **Settings** (gear icon in the title bar)
2. Enter your Titra server URL (e.g. `https://titra.example.com`)
3. Enter your API token (found in your Titra profile)
4. Save — your projects will load automatically

## Usage

- Click **▶** on a task to start timing
- Click **⏸** to pause; click **▶** again to resume
- Click the circle checkbox to mark a task done — the session is committed to Titra automatically
- Switch tasks while one is running — the current session commits before the new one starts
- Click the **⤢** button to enter minimal bar mode; click it again to return to full view

## Development

**Prerequisites:** [Node.js](https://nodejs.org) LTS, [Rust](https://rustup.rs), and [Tauri system dependencies](https://v2.tauri.app/start/prerequisites/) for your platform.

```bash
npm install
npm run tauri dev
```

Build a production binary:

```bash
npm run tauri build
```

## Tech Stack

- [Tauri 2](https://v2.tauri.app) — desktop shell (Rust)
- [Svelte 4](https://svelte.dev) — UI
- [Vite 5](https://vitejs.dev) — frontend build

## License

MIT
