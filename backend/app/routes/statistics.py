from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.deps import get_db
from app.services.statistics import StatisticsService

router = APIRouter(prefix="/statistics", tags=["statistics"])

@router.get("/overview")
def get_overview(db: Session = Depends(get_db)):
    """Get overall statistics"""
    return StatisticsService.get_overview(db)

@router.get("/top-songs")
def get_top_songs(limit: int = 10, db: Session = Depends(get_db)):
    """Get top songs by play count"""
    return StatisticsService.get_top_songs(db, limit)

@router.get("/top-artists")
def get_top_artists(limit: int = 10, db: Session = Depends(get_db)):
    """Get top artists by play count"""
    return StatisticsService.get_top_artists(db, limit)

@router.get("/recent-plays")
def get_recent_plays(limit: int = 20, db: Session = Depends(get_db)):
    """Get recently played songs"""
    return StatisticsService.get_recent_plays(db, limit)

@router.get("/trends")
def get_trends(db: Session = Depends(get_db)):
    """Get listening trends"""
    return StatisticsService.get_listening_trends(db)

@router.get("/skip-analysis")
def get_skip_analysis(limit: int = 10, db: Session = Depends(get_db)):
    """Get songs with highest skip rates"""
    return StatisticsService.get_skip_analysis(db, limit)

@router.get("/dashboard")
def get_dashboard(db: Session = Depends(get_db)):
    """Get complete dashboard data"""
    return {
        "overview": StatisticsService.get_overview(db),
        "top_songs": StatisticsService.get_top_songs(db, 5),
        "top_artists": StatisticsService.get_top_artists(db, 5),
        "recent_plays": StatisticsService.get_recent_plays(db, 10),
        "trends": StatisticsService.get_listening_trends(db),
    }
