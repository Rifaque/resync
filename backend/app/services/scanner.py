import os
from mutagen import File
from sqlalchemy.orm import Session
from app.models.song import Song
from core.config import MUSIC_DIR

SUPPORTED_FORMATS = [".mp3", ".m4a", ".flac"]


def scan_music_folder(db: Session):
    added = 0

    for root, _, files in os.walk(MUSIC_DIR):
        for file in files:
            ext = os.path.splitext(file)[1].lower()

            if ext not in SUPPORTED_FORMATS:
                continue

            full_path = os.path.join(root, file)

            # relative path from MUSIC_DIR
            relative_path = os.path.relpath(full_path, MUSIC_DIR)

            # check duplicate
            exists = db.query(Song).filter(Song.path == relative_path).first()
            if exists:
                continue

            # metadata extraction
            try:
                audio = File(full_path, easy=True)
                title = audio.get("title", [file])[0]
                artist = audio.get("artist", ["Unknown"])[0]
                duration = float(getattr(getattr(audio, "info", None), "length", 0) or 0)
            except:
                title = file
                artist = "Unknown"
                duration = 0

            song = Song(
                title=title,
                artist=artist,
                path=relative_path,
                duration=duration if duration > 0 else None,
            )

            db.add(song)
            added += 1

    db.commit()
    return {"added": added}
