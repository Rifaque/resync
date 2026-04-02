from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.deps import get_db
from db.models.playlist import Playlist
from app.models.song import Song
from pydantic import BaseModel
from datetime import datetime

router = APIRouter(prefix="/playlists", tags=["playlists"])

class PlaylistCreate(BaseModel):
    name: str
    description: str = None

class PlaylistUpdate(BaseModel):
    name: str = None
    description: str = None

@router.get("")
def list_playlists(db: Session = Depends(get_db)):
    """List all playlists"""
    playlists = db.query(Playlist).all()
    return [p.to_dict() for p in playlists]

@router.post("")
def create_playlist(playlist: PlaylistCreate, db: Session = Depends(get_db)):
    """Create a new playlist"""
    new_playlist = Playlist(
        name=playlist.name,
        description=playlist.description
    )
    db.add(new_playlist)
    db.commit()
    db.refresh(new_playlist)
    return new_playlist.to_dict()

@router.get("/{playlist_id}")
def get_playlist(playlist_id: int, db: Session = Depends(get_db)):
    """Get playlist details with songs"""
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        return {"error": "Playlist not found"}
    
    return {
        **playlist.to_dict(),
        "songs": [
            {
                "id": song.id,
                "title": song.title,
                "artist": song.artist,
                "path": song.path,
            }
            for song in playlist.songs
        ]
    }

@router.put("/{playlist_id}")
def update_playlist(playlist_id: int, playlist_data: PlaylistUpdate, db: Session = Depends(get_db)):
    """Update playlist name or description"""
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        return {"error": "Playlist not found"}
    
    if playlist_data.name:
        playlist.name = playlist_data.name
    if playlist_data.description is not None:
        playlist.description = playlist_data.description
    
    playlist.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(playlist)
    return playlist.to_dict()

@router.delete("/{playlist_id}")
def delete_playlist(playlist_id: int, db: Session = Depends(get_db)):
    """Delete a playlist"""
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        return {"error": "Playlist not found"}
    
    db.delete(playlist)
    db.commit()
    return {"message": "Playlist deleted"}

@router.post("/{playlist_id}/songs/{song_id}")
def add_song_to_playlist(playlist_id: int, song_id: int, db: Session = Depends(get_db)):
    """Add a song to a playlist"""
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        return {"error": "Playlist not found"}
    
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        return {"error": "Song not found"}
    
    if song not in playlist.songs:
        playlist.songs.append(song)
        db.commit()
    
    return {"message": "Song added to playlist"}

@router.delete("/{playlist_id}/songs/{song_id}")
def remove_song_from_playlist(playlist_id: int, song_id: int, db: Session = Depends(get_db)):
    """Remove a song from a playlist"""
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        return {"error": "Playlist not found"}
    
    song = db.query(Song).filter(Song.id == song_id).first()
    if not song:
        return {"error": "Song not found"}
    
    if song in playlist.songs:
        playlist.songs.remove(song)
        db.commit()
    
    return {"message": "Song removed from playlist"}
