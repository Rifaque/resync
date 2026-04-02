# Resync

Resync is a self-hosted music library app with:
- local playback and queue controls
- YouTube/audio download queue processing
- play-history tracking and recommendation flows
- metadata editing and custom artwork upload
- web UI (React + Vite) and backend API (FastAPI)

## Monorepo Structure

- `backend/` FastAPI server, DB models/routes, downloader worker
- `apps/web/` React web app
- `apps/mobile/` Expo starter app (not yet integrated with backend features)
- `QUICK_START.md` detailed walk-through
- `DOWNLOAD_QUEUE_IMPLEMENTATION.md` queue system notes
- `SMART_RECOMMENDATION_SYSTEM.md` recommendation-system notes

## Core Features

- Library browsing in list/grid views
- Full playback controls with draggable seek bar and hover timestamp preview
- Download queue (`queued`, `downloading`, `completed`, `failed`)
- Background worker using `yt-dlp` + FFmpeg for audio extraction
- Recommendation and history routes
- Server-side metadata editing (`year`, `duration`)
- Custom artwork upload per song

## Tech Stack

- Frontend: React 19, TypeScript, Vite, react-icons
- Backend: FastAPI, SQLAlchemy, SQLite
- Worker: Python module in `backend/workers/downloader.py`
- Media tooling: `yt-dlp`, FFmpeg, mutagen, Pillow

## Prerequisites

- Node.js 20+
- Python 3.11+
- FFmpeg available on PATH
- `yt-dlp` available in backend environment

## Configuration

Backend reads `MUSIC_DIR` from `backend/.env`.

Example:

```env
MUSIC_DIR=/home/your-user/resync-storage/music
```

Create the directory if it does not exist.

## Run (Development)

Open **3 terminals**.

### 1) Backend API

```bash
cd backend
source venv/bin/activate
python main.py
```

Backend starts on `http://localhost:8000`.

### 2) Download Worker

```bash
cd backend
source venv/bin/activate
python -m workers.downloader
```

### 3) Web App

```bash
cd apps/web
npm install
npm run dev
```

Web UI runs on `http://localhost:5173`.

## Useful Commands

### Web

```bash
cd apps/web
npm run build
npm run lint
```

### Backend DB Init/Migration

`main.py` calls `init_db()` on startup. You can also run manually:

```bash
cd backend
source venv/bin/activate
python -m db.init_db
```

## API Overview

Base URL: `http://localhost:8000`

- `GET /songs` list songs
- `PATCH /songs/{song_id}/metadata` update year/duration
- `POST /songs/{song_id}/artwork` upload custom artwork
- `GET /stream/{song_id}` audio stream endpoint
- `POST /scan` scan `MUSIC_DIR` for audio files
- `GET /downloads` list download jobs
- `POST /downloads` queue download
- `DELETE /downloads/{download_id}` cancel/remove job
- `GET /recommendations` list recommendations
- `POST /history/track` record listening event

## Troubleshooting

### Backend won’t start

- Ensure `backend/.env` has valid `MUSIC_DIR`
- Ensure `backend/venv` is activated
- Ensure SQLite DB is writable: `backend/resync.db`

### Downloads fail

- Verify FFmpeg is installed
- Verify `yt-dlp` is installed in backend environment
- Check worker logs in terminal and `backend/downloader.log`

### Songs not appearing

- Use `Scan Library` in the web app
- Confirm files exist under `MUSIC_DIR`
- Check `GET /songs` response

## License

This project includes a `LICENSE` file at repo root.
