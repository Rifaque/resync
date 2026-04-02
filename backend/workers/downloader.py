"""
Download worker that processes queued downloads and recommendation auto-downloads.

Run with: python -m workers.downloader (from backend directory)
"""

import sys
import os
import time
import logging
from pathlib import Path
from datetime import datetime

# Ensure the backend directory is in the path for imports
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from db.database import SessionLocal
from db.models.download import Download
from db.models.recommendation import Recommendation
from app.models.song import Song
from core.config import MUSIC_DIR
import yt_dlp

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
PREFERRED_AUDIO_EXTENSIONS = [".m4a", ".mp3", ".flac", ".wav", ".aac", ".ogg", ".opus", ".webm"]


def ensure_music_dir():
    """Ensure MUSIC_DIR exists"""
    if not MUSIC_DIR:
        logger.error("MUSIC_DIR environment variable not set!")
        return False
    
    Path(MUSIC_DIR).mkdir(parents=True, exist_ok=True)
    return True


def resolve_downloaded_filepath(info: dict, prepared_filename: str) -> str:
    """
    Resolve the actual output file path after yt-dlp postprocessing.

    yt-dlp may download as one extension (e.g. .webm) and then convert to another
    extension (e.g. .m4a), so we must detect the real file that exists on disk.
    """
    candidate_paths: list[str] = []

    requested_downloads = info.get("requested_downloads")
    if isinstance(requested_downloads, list):
        for entry in requested_downloads:
            if isinstance(entry, dict):
                filepath = entry.get("filepath")
                if filepath:
                    candidate_paths.append(filepath)

    maybe_filename = info.get("_filename")
    if maybe_filename:
        candidate_paths.append(maybe_filename)

    candidate_paths.append(prepared_filename)

    for candidate in candidate_paths:
        if candidate and os.path.exists(candidate):
            return candidate

    prepared_path = Path(prepared_filename)
    parent_dir = prepared_path.parent
    stem = prepared_path.stem

    if parent_dir.exists():
        same_stem_files = list(parent_dir.glob(f"{stem}.*"))
        for ext in PREFERRED_AUDIO_EXTENSIONS:
            match = next((p for p in same_stem_files if p.suffix.lower() == ext), None)
            if match and match.exists():
                return str(match)

        if same_stem_files:
            return str(same_stem_files[0])

    return prepared_filename


def download_song(download: Download) -> tuple[bool, str, str]:
    """
    Download a song using yt-dlp.
    
    Returns: (success, file_path, error_message)
    """
    try:
        if not ensure_music_dir():
            return False, "", "MUSIC_DIR not configured"
        
        # Configure yt-dlp to download audio only
        ydl_opts = {
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'm4a',
                'preferredquality': '192',
            }],
            'outtmpl': os.path.join(MUSIC_DIR, '%(title)s.%(ext)s'),
            'quiet': False,
            'no_warnings': False,
            'progress_hooks': [progress_hook],
        }
        
        # Store current download for progress tracking
        download_song.current_download = download
        
        logger.info(f"Starting download: {download.url}")
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(download.url, download=True)
            prepared_filename = ydl.prepare_filename(info)
            
            # Get the artist from info if available
            artist = info.get('uploader', 'Unknown Artist')
            
            final_filename = resolve_downloaded_filepath(info, prepared_filename)
            
            # Return relative path from MUSIC_DIR
            relative_path = os.path.relpath(final_filename, MUSIC_DIR)
            
            logger.info(f"Download completed: {final_filename}")
            return True, relative_path, artist
        
    except Exception as e:
        logger.error(f"Download error: {str(e)}")
        return False, "", str(e)


def progress_hook(d):
    """Update download progress in database"""
    if d['status'] == 'downloading':
        try:
            download = download_song.current_download
            if download:
                total = d.get('total_bytes') or d.get('total_bytes_estimate', 1)
                downloaded = d.get('downloaded_bytes', 0)

                if total > 0:
                    progress = int((downloaded / total) * 100)
                    progress = min(progress, 99)  # Cap at 99% until done
                    download.progress = progress

                    # Persist to DB immediately so UI can show progress in near-real-time
                    session = SessionLocal()
                    try:
                        session.query(Download).filter(Download.id == download.id).update(
                            {"progress": progress, "updated_at": datetime.utcnow()},
                            synchronize_session=False,
                        )
                        session.commit()
                    except Exception as inner_exc:
                        logger.debug(f"Progress DB update error: {inner_exc}")
                        session.rollback()
                    finally:
                        session.close()
            
        except Exception as e:
            logger.debug(f"Progress update error: {e}")


def process_regular_downloads(db):
    """Process regular user-queued downloads."""
    job = db.query(Download).filter(
        Download.status == "queued"
    ).order_by(Download.created_at).first()
    
    if not job:
        return False
    
    logger.info(f"Processing download {job.id}: {job.url}")
    
    job.status = "downloading"
    job.progress = 0
    db.commit()
    
    try:
        success, relative_path, artist_or_error = download_song(job)
        
        if success:
            # Add to songs library
            existing_song = db.query(Song).filter(
                Song.path == relative_path
            ).first()
            
            if not existing_song:
                song = Song(
                    title=job.title or Path(relative_path).stem,
                    artist=artist_or_error,
                    path=relative_path
                )
                db.add(song)
            
            job.status = "completed"
            job.file_path = relative_path
            job.progress = 100
            job.artist = artist_or_error
            job.downloaded_at = datetime.utcnow()
            
            logger.info(f"Download {job.id} completed successfully")
        else:
            job.status = "failed"
            job.error_message = artist_or_error
            logger.error(f"Download {job.id} failed: {artist_or_error}")
        
    except Exception as e:
        job.status = "failed"
        job.error_message = str(e)
        logger.error(f"Download {job.id} exception: {str(e)}")
    
    db.commit()
    return True


def process_recommendation_auto_downloads(db):
    """Process recommendations marked for auto-download."""
    # Find a recommendation queued for download
    rec = db.query(Recommendation).filter(
        Recommendation.auto_download == "queued"
    ).order_by(Recommendation.created_at).first()
    
    if not rec or not rec.url:
        return False
    
    logger.info(f"Auto-downloading recommendation {rec.id}: {rec.title} by {rec.artist}")
    
    # Check if download already exists for this URL
    existing_dl = db.query(Download).filter(Download.url == rec.url).first()
    if existing_dl:
        logger.info(f"Download already exists for URL: {rec.url}")
        rec.auto_download = "completed"
        db.commit()
        return True
    
    # Create a download entry for this recommendation
    download = Download(
        url=rec.url,
        title=rec.title,
        artist=rec.artist,
        status="downloading",
        progress=0,
        is_recommendation=True,
        recommendation_id=rec.id
    )
    db.add(download)
    db.commit()
    
    try:
        success, relative_path, artist_or_error = download_song(download)
        
        if success:
            # Add to songs library
            existing_song = db.query(Song).filter(
                Song.path == relative_path
            ).first()
            
            if not existing_song:
                song = Song(
                    title=rec.title or Path(relative_path).stem,
                    artist=artist_or_error,
                    path=relative_path
                )
                db.add(song)
            
            download.status = "completed"
            download.file_path = relative_path
            download.progress = 100
            
            rec.auto_download = "completed"
            rec.downloaded_at = datetime.utcnow()
            
            logger.info(f"Recommendation {rec.id} auto-downloaded successfully")
        else:
            download.status = "failed"
            download.error_message = artist_or_error
            
            rec.auto_download = "failed"
            logger.error(f"Recommendation {rec.id} failed: {artist_or_error}")
        
    except Exception as e:
        download.status = "failed"
        download.error_message = str(e)
        rec.auto_download = "failed"
        logger.error(f"Recommendation {rec.id} exception: {str(e)}")
    
    db.commit()
    return True


def worker():
    """Main worker loop that processes downloads and recommendation auto-downloads"""
    db = None
    
    try:
        db = SessionLocal()
        logger.info("Download worker started")

        # Recover any downloads left in downloading state (e.g. after crash)
        stale_count = db.query(Download).filter(Download.status == "downloading").update(
            {"status": "queued", "progress": 0, "updated_at": datetime.utcnow()},
            synchronize_session=False,
        )
        if stale_count > 0:
            logger.info(f"Recovered {stale_count} stale downloading downloads and re-queued them")
        db.commit()
        
        while True:
            try:
                # Prioritize regular downloads first
                if process_regular_downloads(db):
                    continue
                
                # Then process recommendation auto-downloads
                if process_recommendation_auto_downloads(db):
                    continue
                
                # No jobs, wait a bit before checking again
                time.sleep(2)
            
            except Exception as e:
                logger.error(f"Worker loop error: {str(e)}")
                # Clear the current download reference
                download_song.current_download = None
                db.rollback()
                time.sleep(5)
    
    finally:
        if db:
            db.close()
        logger.info("Download worker stopped")


if __name__ == "__main__":
    worker()
