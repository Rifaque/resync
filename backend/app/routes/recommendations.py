"""
Recommendations routes for getting and managing recommendations.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.deps import get_db
from app.services.recommender import RecommendationEngine
from db.models.recommendation import Recommendation
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter(prefix="/recommendations", tags=["recommendations"])


class RecommendationAddRequest(BaseModel):
    """Add a new recommendation."""
    title: str
    artist: str
    reason: str
    score: float
    url: Optional[str] = None


class RecommendationItem(BaseModel):
    id: int
    title: str
    artist: Optional[str]
    reason: str
    score: float
    auto_download: str
    url: Optional[str]

    class Config:
        from_attributes = True


class AutoDownloadRequest(BaseModel):
    recommendation_ids: List[int]


@router.post("/add")
def add_recommendation(
    request: RecommendationAddRequest, db: Session = Depends(get_db)
):
    """
    Manually add a recommendation.
    Used for seeding recommendations based on user preferences or external data.
    """

    engine = RecommendationEngine(db)
    rec = engine.add_recommendation(
        title=request.title,
        artist=request.artist,
        reason=request.reason,
        score=request.score,
        url=request.url,
    )

    return {
        "id": rec.id,
        "title": rec.title,
        "artist": rec.artist,
        "message": "Recommendation added",
    }


@router.get("", response_model=List[RecommendationItem])
def get_recommendations(limit: int = 10, db: Session = Depends(get_db)):
    """Get current recommendations pending download."""

    engine = RecommendationEngine(db)
    return engine.get_recommendations(limit=limit)


@router.post("/queue-auto-download")
def queue_for_auto_download(
    request: AutoDownloadRequest, db: Session = Depends(get_db)
):
    """
    Queue selected recommendations for auto-download.
    Only marks them as 'queued' - the worker will pick them up.
    """

    engine = RecommendationEngine(db)
    count = engine.queue_for_auto_download(request.recommendation_ids)

    return {
        "queued": count,
        "message": f"Queued {count} recommendations for auto-download",
    }


@router.post("/{recommendation_id}/skip")
def skip_recommendation(recommendation_id: int, db: Session = Depends(get_db)):
    """Skip a recommendation (don't auto-download)."""

    rec = db.query(Recommendation).filter(
        Recommendation.id == recommendation_id
    ).first()

    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    rec.auto_download = "skipped"
    db.commit()

    return {"message": "Recommendation skipped"}


@router.post("/{recommendation_id}/auto-download")
def auto_download_one(recommendation_id: int, db: Session = Depends(get_db)):
    """Immediately queue a single recommendation for auto-download (if it has a URL)."""

    rec = db.query(Recommendation).filter(
        Recommendation.id == recommendation_id
    ).first()

    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    if not rec.url:
        raise HTTPException(status_code=400, detail="Recommendation has no URL")

    if rec.auto_download != "pending":
        return {
            "status": rec.auto_download,
            "message": f"Already {rec.auto_download}",
        }

    rec.auto_download = "queued"
    db.commit()

    return {"message": "Queued for auto-download", "recommendation_id": recommendation_id}


@router.get("/stats")
def get_recommendation_stats(db: Session = Depends(get_db)):
    """Get recommendation queue statistics."""

    pending = db.query(Recommendation).filter(
        Recommendation.auto_download == "pending"
    ).count()
    queued = db.query(Recommendation).filter(
        Recommendation.auto_download == "queued"
    ).count()
    completed = db.query(Recommendation).filter(
        Recommendation.auto_download == "completed"
    ).count()
    skipped = db.query(Recommendation).filter(
        Recommendation.auto_download == "skipped"
    ).count()

    return {
        "pending": pending,
        "queued": queued,
        "completed": completed,
        "skipped": skipped,
        "total": pending + queued + completed + skipped,
    }


@router.post("/batch-generate")
def batch_generate_recommendations(db: Session = Depends(get_db)):
    """
    Generate batch recommendations based on listening history.
    Analyzes top artists and creates new recommendations.
    """
    engine = RecommendationEngine(db)
    result = engine.generate_batch_recommendations(limit=20)
    return result
