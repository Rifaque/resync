"""
Play history routes for tracking listening activity.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.deps import get_db
from db.models.play_history import PlayHistory
from app.models.song import Song
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/history", tags=["history"])


class PlayEvent(BaseModel):
    """Event when a song is played/completed/skipped."""

    song_id: int
    listen_duration: int  # seconds actually listened to
    total_duration: int  # total song duration in seconds
    skipped: bool = False


class PlayHistoryResponse(BaseModel):
    id: int
    song_id: int
    play_count: int
    total_listen_time: int
    last_played: datetime
    completion_rate: float

    class Config:
        from_attributes = True


@router.post("/track")
def track_play(event: PlayEvent, db: Session = Depends(get_db)):
    """
    Track a play/listen event.
    Called when song finishes or is skipped.
    """

    song = db.query(Song).filter(Song.id == event.song_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    # Get or create history record
    history = db.query(PlayHistory).filter(
        PlayHistory.song_id == event.song_id
    ).first()

    if not history:
        history = PlayHistory(song_id=event.song_id)
        db.add(history)

    # Update stats
    history.play_count += 1
    history.total_listen_time += event.listen_duration
    history.last_played = datetime.utcnow()

    if event.skipped:
        history.skip_count += 1

    # Calculate completion rate (how much of song was typically played)
    if event.total_duration > 0:
        completion_rate = event.listen_duration / event.total_duration
        # Exponential moving average to smooth out variations
        history.completion_rate = (history.completion_rate * 0.7) + (
            completion_rate * 0.3
        )

    db.commit()
    db.refresh(history)

    return {"status": "tracked", "history": history}


@router.get("/song/{song_id}", response_model=PlayHistoryResponse)
def get_song_history(song_id: int, db: Session = Depends(get_db)):
    """Get play history for a specific song."""

    history = db.query(PlayHistory).filter(
        PlayHistory.song_id == song_id
    ).first()

    if not history:
        raise HTTPException(status_code=404, detail="No history for this song")

    return history


@router.get("/stats")
def get_listening_stats(db: Session = Depends(get_db)):
    """Get overall listening statistics."""

    history_records = db.query(PlayHistory).all()

    if not history_records:
        return {
            "total_plays": 0,
            "total_listen_time": 0,
            "unique_songs": 0,
            "top_songs": [],
            "top_artists": [],
        }

    # Calculate stats
    total_plays = sum(h.play_count for h in history_records)
    total_listen_time = sum(h.total_listen_time for h in history_records)
    unique_songs = len(history_records)

    # Top songs
    top_songs = sorted(
        history_records, key=lambda x: x.play_count, reverse=True
    )[:5]

    top_songs_data = []
    for h in top_songs:
        song = db.query(Song).filter(Song.id == h.song_id).first()
        if song:
            top_songs_data.append(
                {
                    "id": song.id,
                    "title": song.title,
                    "artist": song.artist,
                    "play_count": h.play_count,
                }
            )

    # Top artists
    artist_plays = {}
    for h in history_records:
        song = db.query(Song).filter(Song.id == h.song_id).first()
        if song and song.artist:
            artist_plays[song.artist] = artist_plays.get(song.artist, 0) + h.play_count

    top_artists_data = sorted(
        artist_plays.items(), key=lambda x: x[1], reverse=True
    )[:5]

    return {
        "total_plays": total_plays,
        "total_listen_time": total_listen_time,
        "total_listen_time_hours": round(total_listen_time / 3600, 2),
        "unique_songs": unique_songs,
        "top_songs": top_songs_data,
        "top_artists": [{"name": name, "plays": plays} for name, plays in top_artists_data],
    }


@router.delete("/song/{song_id}")
def reset_song_history(song_id: int, db: Session = Depends(get_db)):
    """Reset play history for a song (for cleanup)."""

    history = db.query(PlayHistory).filter(
        PlayHistory.song_id == song_id
    ).first()

    if not history:
        raise HTTPException(status_code=404, detail="No history for this song")

    db.delete(history)
    db.commit()

    return {"message": "History reset"}
