from fastapi import APIRouter, Depends, Request, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from core.deps import get_db
from app.models.song import Song
from pydantic import BaseModel
from app.services.scanner import scan_music_folder
from fastapi.responses import Response, FileResponse
from core.config import MUSIC_DIR
from mutagen.mp4 import MP4
from PIL import Image
import os
import io

ARTWORK_CACHE_DIR = "/home/rifaque/resync-storage/artwork"
CUSTOM_ARTWORK_DIR = "/home/rifaque/resync-storage/custom-artwork"

os.makedirs(ARTWORK_CACHE_DIR, exist_ok=True)
os.makedirs(CUSTOM_ARTWORK_DIR, exist_ok=True)
FALLBACK_AUDIO_EXTENSIONS = [".m4a", ".mp3", ".flac", ".wav", ".aac", ".ogg", ".opus", ".webm"]

class SongCreate(BaseModel):
    title: str
    artist: str
    path: str
    year: int | None = None
    duration: float | None = None
    artwork_path: str | None = None


class SongMetadataUpdate(BaseModel):
    year: int | None = None
    duration: float | None = None

router = APIRouter()

@router.get("/songs")
def get_songs(db: Session = Depends(get_db)):
    songs = db.query(Song).all()
    return songs

@router.post("/songs")
def add_song(song: SongCreate, db: Session = Depends(get_db)):
    new_song = Song(**song.dict())
    db.add(new_song)
    db.commit()
    db.refresh(new_song)
    return new_song


@router.patch("/songs/{song_id}/metadata")
def update_song_metadata(song_id: int, payload: SongMetadataUpdate, db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    song.year = payload.year
    song.duration = payload.duration
    db.commit()
    db.refresh(song)
    return song

@router.post("/scan")
def scan(db: Session = Depends(get_db)):
    return scan_music_folder(db)

@router.get("/stream/{song_id}")
def stream_song(song_id: int, request: Request, db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()

    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    if os.path.isabs(song.path):
        full_path = song.path
    else:
        relative_path = song.path.lstrip("/")
        full_path = os.path.join(MUSIC_DIR, relative_path)

    if not os.path.exists(full_path):
        base_without_ext, _ = os.path.splitext(full_path)
        fallback_path = None
        for ext in FALLBACK_AUDIO_EXTENSIONS:
            candidate = f"{base_without_ext}{ext}"
            if os.path.exists(candidate):
                fallback_path = candidate
                break

        if fallback_path:
            full_path = fallback_path

            # Self-heal stale DB paths (e.g. old .webm saved after conversion to .m4a)
            if os.path.isabs(song.path):
                song.path = fallback_path
            else:
                song.path = os.path.relpath(fallback_path, MUSIC_DIR)
            db.commit()
        else:
            raise HTTPException(status_code=404, detail=f"File missing: {full_path}")

    file_size = os.path.getsize(full_path)

    ext = os.path.splitext(full_path)[1].lower()
    media_type = "audio/mpeg"
    if ext in [".m4a", ".mp4", ".aac"]:
        media_type = "audio/mp4"
    elif ext in [".wav"]:
        media_type = "audio/wav"
    elif ext in [".ogg"]:
        media_type = "audio/ogg"

    range_header = request.headers.get("range")

    if range_header:
        try:
            range_value = range_header.split("=")[1]
            start_str, end_str = range_value.split("-")
            start = int(start_str)
            end = int(end_str) if end_str else file_size - 1

            if start > end or end >= file_size:
                raise HTTPException(status_code=416, detail="Requested Range Not Satisfiable")

            chunk_size = end - start + 1
            with open(full_path, "rb") as f:
                f.seek(start)
                data = f.read(chunk_size)

            headers = {
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(chunk_size),
            }

            return Response(data, status_code=206, headers=headers, media_type=media_type)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Range header")

    return FileResponse(full_path, media_type=media_type, headers={"Accept-Ranges": "bytes"})
    
@router.get("/artwork/{song_id}")
def get_artwork(song_id: int, db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()

    if not song:
        return {"error": "Song not found"}

    # Serve custom uploaded art first (if available)
    if song.artwork_path:
        custom_path = song.artwork_path if os.path.isabs(song.artwork_path) else os.path.join(CUSTOM_ARTWORK_DIR, song.artwork_path)
        if os.path.exists(custom_path):
            return FileResponse(custom_path, media_type="image/jpeg")

    relative_path = song.path.lstrip("/")
    full_path = os.path.join(MUSIC_DIR, relative_path)

    if not os.path.exists(full_path):
        return {"error": "File missing"}

    # 🧠 Cache path
    cache_path = os.path.join(ARTWORK_CACHE_DIR, f"{song_id}.jpg")

    # ✅ If already cached → serve instantly
    if os.path.exists(cache_path):
        return FileResponse(cache_path, media_type="image/jpeg")

    try:
        audio = MP4(full_path)
        covers = audio.tags.get("covr")

        if not covers:
            return {"error": "No artwork"}

        cover = covers[0]

        image = Image.open(io.BytesIO(cover))

        # 🔥 Resize (CRITICAL)
        image = image.convert("RGB")
        image.thumbnail((300, 300))

        # 💾 Save to cache
        image.save(cache_path, format="JPEG")

        return FileResponse(cache_path, media_type="image/jpeg")

    except Exception as e:
        return {"error": str(e)}


@router.post("/songs/{song_id}/artwork")
async def upload_song_artwork(song_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image uploads are supported")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file upload")

    try:
        image = Image.open(io.BytesIO(data))
        image = image.convert("RGB")
        image.thumbnail((600, 600))

        custom_filename = f"{song_id}.jpg"
        custom_path = os.path.join(CUSTOM_ARTWORK_DIR, custom_filename)
        image.save(custom_path, format="JPEG", quality=90)

        # Clear extracted-art cache so UI uses uploaded image consistently.
        cached_extracted_path = os.path.join(ARTWORK_CACHE_DIR, f"{song_id}.jpg")
        if os.path.exists(cached_extracted_path):
            os.remove(cached_extracted_path)

        song.artwork_path = custom_filename
        db.commit()
        db.refresh(song)
        return {"message": "Artwork uploaded", "song_id": song.id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image: {str(e)}")
