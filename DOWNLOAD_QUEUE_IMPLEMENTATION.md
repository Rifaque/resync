# Download Queue System - Implementation Complete ✅

## Summary

A complete end-to-end download queue system has been implemented for the Resync music platform. The system allows queuing downloads from YouTube and other services supported by yt-dlp, processes them in a background worker, and automatically adds completed songs to the library.

---

## What Was Implemented

### 1. **Enhanced Download Model** (`backend/db/models/download.py`)
Added comprehensive fields for tracking downloads:
- `url` - Source URL (unique constraint)
- `title` - Song title
- `artist` - Artist/uploader name
- `status` - Download state: `queued` → `downloading` → `completed` or `failed`
- `progress` - Percentage complete (0-100)
- `file_path` - Relative path in music directory after completion
- `created_at` / `updated_at` - Timestamps (auto-managed)
- `error_message` - Error details if download fails

### 2. **Comprehensive Download Routes** (`backend/app/routes/downloads.py`)
Full REST API for queue management:

**POST /downloads** - Add a new download
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "title": "Song Name",
  "artist": "Artist Name"
}
```
Returns: Download object with ID and status

**GET /downloads** - List all downloads (optional `status` filter)
```bash
# All downloads
curl http://localhost:8000/downloads

# Only completed
curl http://localhost:8000/downloads?status=completed

# Only failed
curl http://localhost:8000/downloads?status=failed
```

**GET /downloads/{id}** - Get a specific download
```bash
curl http://localhost:8000/downloads/1
```

**DELETE /downloads/{id}** - Remove a queued or failed download
```bash
curl -X DELETE http://localhost:8000/downloads/1
```

### 3. **Fixed Worker Import Issue** (`backend/workers/downloader.py`)
**Problem:** Worker had `ModuleNotFoundError` when running as a module.

**Solution:** 
- Added proper path setup to ensure backend directory is in sys.path
- Uses absolute imports reliably
- Includes comprehensive logging for debugging
- Proper error handling and database transactions

**How to run:**
```bash
cd /home/rifaque/resync/backend
source venv/bin/activate
python -m workers.downloader
```

### 4. **Actual Download Implementation**
The worker now:
- ✅ Uses **yt-dlp** to download from YouTube and other sources
- ✅ Extracts audio and converts to **m4a format** (high quality, ~192kbps)
- ✅ Uses **FFmpeg** for audio processing (already available on system)
- ✅ Saves files to `/home/rifaque/resync-storage/music`
- ✅ Updates Song metadata in database
- ✅ Tracks progress (0-100%) during download
- ✅ Captures uploader name as artist metadata
- ✅ Handles errors gracefully with error messages
- ✅ Processes queue sequentially and safely

### 5. **Backend Integration**
- Added downloads router to main FastAPI app (`backend/main.py`)
- Database migrations applied automatically (new Download table)
- Pydantic response models for clean API contracts

---

## Architecture

```
Frontend (React)
    ↓ POST /downloads (add URL)
    ↓ GET /downloads (poll for progress)
    ↓
Backend API (FastAPI)
    ↓
Database (SQLite)
    ↓
Worker (background process)
    ↓
yt-dlp + FFmpeg
    ↓
Music Storage: /home/rifaque/resync-storage/music
```

---

## How to Use

### Starting the System

1. **Start the backend server:**
```bash
cd /home/rifaque/resync/backend
source venv/bin/activate
python main.py
```
Server runs on `http://localhost:8000`

2. **Start the download worker (in another terminal):**
```bash
cd /home/rifaque/resync/backend
source venv/bin/activate
python -m workers.downloader
```

### API Examples

**Add a YouTube video to download:**
```bash
curl -X POST http://localhost:8000/downloads \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=9bZkp7q19f0",
    "title": "Song Title",
    "artist": "Artist Name"
  }'
```

**Check download status:**
```bash
curl http://localhost:8000/downloads/1
```

**Get all downloads:**
```bash
curl http://localhost:8000/downloads
```

**Get only completed downloads:**
```bash
curl "http://localhost:8000/downloads?status=completed"
```

### Frontend Integration (Next Steps)

The frontend can:
1. Add downloads via `POST /downloads`
2. Poll `GET /downloads` periodically to show queue status
3. Display progress bars using the `progress` field
4. Auto-refresh song list after downloads complete
5. Show error messages for failed downloads

---

## Key Technical Decisions

### Why yt-dlp?
- Actively maintained (unlike youtube-dl)
- Supports 100+ video sites
- Handles age restrictions and changes to YouTube's API
- Excellent audio extraction

### Why m4a Format?
- Good quality at lower bitrate (192kbps vs 320kbps)
- Smaller file size
- Works with the existing album art extraction from `.m4a` files
- Consistent with existing infrastructure

### Why Process Sequentially?
- Avoids bandwidth saturation
- Prevents race conditions on database
- Keeps server-side resource usage stable
- Easier to debug and monitor

### Why Store Relative Paths?
- Allows moving music directory without breaking database
- Supports multiple storage backends in future
- Cleaner serialization to frontend

---

## File Changes

| File | Change |
|------|--------|
| `backend/db/models/download.py` | Enhanced with new fields and timestamps |
| `backend/app/routes/downloads.py` | Complete rewrite with full CRUD operations |
| `backend/workers/downloader.py` | Fixed imports, implemented real download logic |
| `backend/main.py` | Added downloads router include |
| `backend/db/init_db.py` | Added Download model import for schema creation |

---

## Database Schema

```sql
CREATE TABLE downloads (
    id INTEGER PRIMARY KEY,
    url VARCHAR UNIQUE NOT NULL,
    title VARCHAR NOT NULL,
    artist VARCHAR,
    status VARCHAR DEFAULT 'queued',
    progress INTEGER DEFAULT 0,
    file_path VARCHAR,
    created_at DATETIME DEFAULT NOW,
    updated_at DATETIME DEFAULT NOW,
    error_message VARCHAR
);

CREATE INDEX downloads_status ON downloads(status);
CREATE INDEX downloads_created_at ON downloads(created_at);
```

---

## Remaining Work (Future)

### Phase 1: Frontend Integration ✏️
- Add download form to web UI
- Show download queue with progress bars
- Display completed downloads in library
- Show error notifications

### Phase 2: Recommendations
- Analyze play history
- Suggest related songs/artists
- Preemptive download of recommended tracks

### Phase 3: Features
- Playlist support
- Batch downloads from URLs
- Download status webhooks for client notifications
- Download history and analytics

---

## Troubleshooting

### Worker not picking up downloads?
1. Check worker is running: `ps aux | grep downloader`
2. Check logs in terminal where worker started
3. Verify database: `sqlite3 backend/resync.db "SELECT * FROM downloads;"`

### Download fails with "No supported JavaScript runtime"?
- Not critical for most videos
- FFmpeg is available, so audio extraction works fine
- For heavily JavaScript-protected content, may need Node.js/Deno

### Songs not appearing in library after download?
- Check `/home/rifaque/resync-storage/music/` for files
- Verify database has Song entry: `sqlite3 backend/resync.db "SELECT * FROM songs;"`
- Run `/songs` endpoint to verify API returns new songs

### Import errors when running worker?
- Make sure you're in backend directory: `cd /home/rifaque/resync/backend`
- Activate venv: `source venv/bin/activate`
- Run with module syntax: `python -m workers.downloader`
- Don't try: `python workers/downloader.py` (won't work)

---

## Performance Notes

- Each download can take 15-120 seconds depending on source and file size
- Worker processes one download at a time (by design)
- Progress updates happen in real-time as data is consumed
- Music files typically 2-5 MB for 3-4 minute songs
- Storage can hold hundreds of songs without issues

---

## Security Notes

- ✅ URL uniqueness prevents duplicate downloads
- ✅ Input validation on all endpoints
- ✅ Relative paths prevent directory traversal
- ✅ CORS enabled for frontend access
- ⚠️ Consider rate limiting if exposed to internet
- ⚠️ Validate/sanitize URLs if accepting user input

---

## Monitoring

To monitor the worker in real-time:

```bash
# Watch worker logs
cd /home/rifaque/resync/backend && source venv/bin/activate && python -m workers.downloader

# In another terminal, monitor database activity
watch -n 1 "sqlite3 backend/resync.db 'SELECT id, title, status, progress FROM downloads ORDER BY created_at DESC LIMIT 5;'"
```

---

**System is now ready for testing and frontend integration!**
