# 🎵 Resync - Smart Recommendation System: Quick Start

## What Was Built

A complete **smart music recommendation system** that:
- ✅ Tracks what you listen to (play history)
- ✅ Analyzes your listening patterns  
- ✅ Recommends new songs to download
- ✅ Auto-downloads recommended songs in background
- ✅ Shows everything in a clean 3-tab interface


---

## 🚀 Getting Started

### 1. **Initialize Database** (one-time)
```bash
cd /home/rifaque/resync/backend
source venv/bin/activate
python -m db.init_db
echo "✓ Database ready"
```

### 2. **Start Backend Server**
```bash
cd /home/rifaque/resync/backend
source venv/bin/activate
python main.py

# Output: INFO: Uvicorn running on http://127.0.0.1:8000
```

### 3. **Start Download Worker** (new terminal)
```bash
cd /home/rifaque/resync/backend
source venv/bin/activate
python -m workers.downloader

# Output: INFO - Download worker started
```

### 4. **Start Frontend** (new terminal)
```bash
cd /home/rifaque/resync/apps/web
npm run dev

# Output: VITE v... ready in ... ms
# Open http://localhost:5173
```

---

## 🎮 How to Use

### Tab 1: **Library** (Your Music)
- Shows all downloaded songs
- Click to play
- See metadata (artist, title)
- Album art if available
- Auto-refreshes when downloads complete

### Tab 2: **Downloads** (Queue Progress)
- Shows songs you've added to download
- Status indicators:
  - 🟡 **queued** - Waiting to start
  - 🔵 **downloading** - Progress bar (0-100%)
  - ✅ **completed** - Ready to play
  - ❌ **failed** - Error message shown
- Auto-updates every 3 seconds

### Tab 3: **Recommended** (AI Suggestions)
- Shows songs the system suggests
- Score: How confident the recommendation is (higher = better)
- Reason: Why it's recommended
- Download buttons to queue auto-download
- Skip buttons to dismiss

### Player (Bottom Bar)
- Play/pause/skip controls (with react-icons)
- Progress bar with seek
- Volume control
- Now playing info with artwork
- Persists state across refreshes

---

## 🧪 Testing Workflow

### **Step 1: Add Your First Download**

Open frontend at http://localhost:5173 → **Downloads** tab

(Or use curl):
```bash
curl -X POST http://localhost:8000/downloads \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=jNQXAC9IVRw",
    "title": "Me at the zoo",
    "artist": "Jawed Karim"
  }'
```

You should see:
- Download appears in Downloads tab with 🟡 **queued** status
- Worker starts processing (check Terminal 3 logs)
- Progress increases 0% → 100%
- Status changes to ✅ **completed**
- Song automatically appears in Library tab

### **Step 2: Listen to Build History**

In **Library** tab:
- Click a song to play
- Let it play for a bit (or skip to next)
- System tracks your listening

Check tracking worked:
```bash
curl http://localhost:8000/history/stats | json_pp
```

Output shows:
- total_plays, total_listen_time, top_songs, top_artists

### **Step 3: Get Recommendations**

After 3-5 listens, go to **Recommended** tab

You'll see suggestions based on:
- Artists you listen to frequently
- Similar content
- Relevance scores

To manually add recommendations (for testing):
```bash
curl -X POST http://localhost:8000/recommendations/add \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Another Song",
    "artist": "Jawed Karim",
    "reason": "Similar to artist you love",
    "score": 85,
    "url": "https://www.youtube.com/watch?v=..."
  }'
```

### **Step 4: Auto-Download**

In **Recommended** tab:
- Click "Download" on any recommendation
- Top button "Auto-download All" downloads all at once

Watch it happen:
- Status changes to 🟡 **queued**
- Moves to Downloads tab
- Worker processes it
- Song appears in Library when complete

---

## 📊 API Cheat Sheet

### History (Play Tracking)
```bash
# Get your listening stats
curl http://localhost:8000/history/stats | json_pp

# Get history for specific song
curl http://localhost:8000/history/song/1 | json_pp
```

### Recommendations
```bash
# List pending recommendations
curl http://localhost:8000/recommendations | json_pp

# Queue recommendations for auto-download
curl -X POST http://localhost:8000/recommendations/queue-auto-download \
  -H "Content-Type: application/json" \
  -d '{"recommendation_ids": [1, 2, 3]}'

# Skip a recommendation  
curl -X POST http://localhost:8000/recommendations/1/skip

# Queue stats
curl http://localhost:8000/recommendations/stats | json_pp
```

### Downloads
```bash
# List all downloads
curl http://localhost:8000/downloads | json_pp

# Add a download
curl -X POST http://localhost:8000/downloads \
  -H "Content-Type: application/json" \
  -d '{"url":"...","title":"...","artist":"..."}'

# Delete a download
curl -X DELETE http://localhost:8000/downloads/1
```

---

## 🔍 Monitoring

### Watch Worker Logs
```bash
# Terminal showing worker logs displays:
# 2026-04-02 HH:MM:SS - __main__ - INFO - Processing download 1: https://...
# 2026-04-02 HH:MM:SS - __main__ - INFO - Download completed: /path/to/file.m4a
# 2026-04-02 HH:MM:SS - __main__ - INFO - Auto-downloading recommendation 1: ...
```

### Check Database
```bash
sqlite3 /home/rifaque/resync/backend/resync.db

# See play history
SELECT h.song_id, s.title, h.play_count, h.skip_count, h.completion_rate
FROM play_history h
JOIN songs s ON h.song_id = s.id;

# See recommendations  
SELECT * FROM recommendations WHERE auto_download != 'skipped';

# See downloads
SELECT id, title, status, progress FROM downloads ORDER BY created_at DESC;
```

---

## 🎯 Key Features to Explore

### Frontend
- [ ] Play a song and watch it track in history/stats
- [ ] Get recommendations and download them
- [ ] Watch progress bars in Downloads tab
- [ ] Skip songs and see skip count increase
- [ ] Refresh browser and player resumes where it was
- [ ] Auto-download multiple recommendations at once

### Backend
- [ ] Check if play events are received
- [ ] Monitor recommendation scores
- [ ] Watch worker auto-download recommendations
- [ ] See errors handled gracefully
- [ ] Query listening statistics

---

## 🐛 Troubleshooting

### Frontend shows "No songs yet"
- Make sure Downloads tab shows items
- Check if downloads completed successfully
- Look at worker terminal for errors
- Refresh page (F5)

### Recommendations don't appear
- You need to listen to at least 5 songs first
- Play them, don't just skip
- Check `/history/stats` endpoint
- Manually add recommendations via API for testing

### Downloads not starting
- Check worker is running (see logs)
- Verify download URL is valid (YouTube, etc)
- Check internet connection
- Look for error message in Downloads tab

### Worker not processing
- Check it's running: `ps aux | grep downloader`
- Restart worker: Ctrl+C then rerun
- Check for import errors in logs
- Verify database is initialized

### Play tracking not working
- Check browser console (F12) for errors
- Verify backend is running
- Make sure `/history/track` endpoint responds
- Try: `curl -X POST http://localhost:8000/history/track -H "Content-Type: application/json" -d '{"song_id":1,"listen_duration":30,"total_duration":60,"skipped":false}'`

---

## 📁 File Structure Reference

```
resync/
├── backend/
│   ├── main.py                    → FastAPI app with all routes
│   ├── db/models/
│   │   ├── download.py            → (updated) with recommendation fields
│   │   ├── play_history.py        → (new) play tracking
│   │   └── recommendation.py      → (new) recommendations
│   ├── app/routes/
│   │   ├── songs.py               → Existing song endpoints
│   │   ├── downloads.py           → Download queue API
│   │   ├── history.py             → (new) Play history API
│   │   └── recommendations.py     → (new) Recommendations API
│   ├── app/services/
│   │   └── recommender.py         → (new) Recommendation engine
│   └── workers/
│       └── downloader.py          → (updated) with auto-download
├── apps/web/src/
│   └── App.tsx                    → (updated) Three-tab UI
└── SMART_RECOMMENDATION_SYSTEM.md → Full documentation
```

---

## 🎓 Learning Outcomes

This implementation demonstrates:
- ✅ Full-stack play history tracking
- ✅ Smart recommendation algorithm  
- ✅ Background job processing
- ✅ Real-time progress updates via polling
- ✅ Database transactions and relationships
- ✅ Frontend-backend synchronization
- ✅ Error handling and recovery
- ✅ State persistence across sessions

---

## 🚀 Next Steps (Ideas)

1. **Playlist Support** - Save favorite recommendations as playlists
2. **Statistics Dashboard** - Show top artists, listening patterns over time
3. **WebSocket Updates** - Real-time instead of polling
4. **External API Integration** - Spotify/Last.fm for recommendations
5. **Mobile App** - React Native version for phone
6. **Cloud Sync** - Back up recommendations to cloud
7. **Collaborative Features** - Share recommendations with friends

---

**Happy listening! 🎵**
