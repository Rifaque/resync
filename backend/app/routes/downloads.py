from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.deps import get_db
from db.models.download import Download
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/downloads", tags=["downloads"])


class DownloadRequest(BaseModel):
    url: str
    title: Optional[str] = None
    artist: Optional[str] = None


class DownloadResponse(BaseModel):
    id: int
    url: str
    title: str
    artist: Optional[str]
    status: str
    progress: int
    file_path: Optional[str]
    created_at: Optional[datetime]
    updated_at: Optional[datetime]
    downloaded_at: Optional[datetime]
    error_message: Optional[str] = None

    class Config:
        orm_mode = True

        from_attributes = True


@router.post("", response_model=DownloadResponse)
def add_download(request: DownloadRequest, db: Session = Depends(get_db)):
    """Add a URL to the download queue"""
    
    # Check if URL already exists
    existing = db.query(Download).filter(Download.url == request.url).first()
    if existing:
        if existing.status in ["queued", "downloading"]:
            raise HTTPException(status_code=400, detail="URL already in queue or downloading")
        existing.status = "queued"
        existing.progress = 0
        existing.file_path = None
        existing.error_message = None
        existing.title = request.title or existing.title or "Pending..."
        existing.artist = request.artist or existing.artist
        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return existing
    
    download = Download(
        url=request.url,
        title=request.title or "Pending...",
        artist=request.artist,
        status="queued"
    )
    db.add(download)
    db.commit()
    db.refresh(download)

    return download


@router.get("", response_model=list[DownloadResponse])
def get_downloads(status: Optional[str] = None, db: Session = Depends(get_db)):
    """Get all downloads, optionally filtered by status"""
    query = db.query(Download)
    
    if status:
        query = query.filter(Download.status == status)
    
    return query.order_by(Download.created_at.desc()).all()


@router.get("/{download_id}", response_model=DownloadResponse)
def get_download(download_id: int, db: Session = Depends(get_db)):
    """Get a specific download by ID"""
    download = db.query(Download).filter(Download.id == download_id).first()
    
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")
    
    return download


@router.delete("/{download_id}")
def delete_download(download_id: int, db: Session = Depends(get_db)):
    """Delete or cancel a download from the queue."""
    download = db.query(Download).filter(Download.id == download_id).first()
    
    if not download:
        raise HTTPException(status_code=404, detail="Download not found")

    if download.status == "downloading":
        download.status = "failed"
        download.error_message = "Cancelled by user"
        download.progress = 0
        download.updated_at = datetime.utcnow()
        db.commit()
        return {"message": "Download cancelled"}

    if download.status in ["queued", "failed"]:
        db.delete(download)
        db.commit()
        return {"message": "Download deleted"}

    raise HTTPException(status_code=400, detail="Can only cancel queued, downloading, or failed downloads")