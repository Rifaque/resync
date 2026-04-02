from sqlalchemy.orm import Session
from sqlalchemy import func
from db.models.play_history import PlayHistory
from db.models.recommendation import Recommendation
from db.models.download import Download
from app.models.song import Song

class StatisticsService:
    
    @staticmethod
    def get_overview(db: Session):
        """Get overall statistics overview"""
        total_songs = db.query(func.count(Song.id)).scalar() or 0
        unique_artists = db.query(func.count(func.distinct(Song.artist))).scalar() or 0
        
        total_plays = db.query(func.sum(PlayHistory.play_count)).scalar() or 0
        total_listen_time = db.query(func.sum(PlayHistory.total_listen_time)).scalar() or 0
        
        total_recommendations = db.query(func.count(Recommendation.id)).scalar() or 0
        completed_downloads = db.query(func.count(Download.id)).filter(Download.status == "completed").scalar() or 0
        
        return {
            "total_songs": total_songs,
            "unique_artists": unique_artists,
            "total_plays": total_plays,
            "total_listen_time_hours": round(total_listen_time / 3600, 2) if total_listen_time else 0,
            "total_recommendations": total_recommendations,
            "completed_downloads": completed_downloads,
        }
    
    @staticmethod
    def get_top_songs(db: Session, limit: int = 10):
        """Get top songs by play count"""
        top_songs = db.query(
            Song.id,
            Song.title,
            Song.artist,
            PlayHistory.play_count,
            PlayHistory.total_listen_time,
            PlayHistory.completion_rate
        ).join(PlayHistory, Song.id == PlayHistory.song_id)\
         .order_by(PlayHistory.play_count.desc())\
         .limit(limit)\
         .all()
        
        return [
            {
                "id": song[0],
                "title": song[1],
                "artist": song[2],
                "play_count": song[3],
                "total_listen_time": song[4],
                "completion_rate": song[5],
            }
            for song in top_songs
        ]
    
    @staticmethod
    def get_top_artists(db: Session, limit: int = 10):
        """Get top artists by total play count"""
        top_artists = db.query(
            Song.artist,
            func.count(PlayHistory.song_id).label("song_count"),
            func.sum(PlayHistory.play_count).label("total_plays"),
            func.sum(PlayHistory.total_listen_time).label("total_time"),
        ).join(PlayHistory, Song.id == PlayHistory.song_id)\
         .group_by(Song.artist)\
         .order_by(func.sum(PlayHistory.play_count).desc())\
         .limit(limit)\
         .all()
        
        return [
            {
                "artist": artist[0],
                "song_count": artist[1],
                "total_plays": artist[2],
                "total_listen_time": artist[3],
            }
            for artist in top_artists
        ]
    
    @staticmethod
    def get_recent_plays(db: Session, limit: int = 20):
        """Get recently played songs"""
        recent = db.query(
            Song.id,
            Song.title,
            Song.artist,
            PlayHistory.last_played,
            PlayHistory.play_count
        ).join(PlayHistory, Song.id == PlayHistory.song_id)\
         .order_by(PlayHistory.last_played.desc())\
         .limit(limit)\
         .all()
        
        return [
            {
                "id": song[0],
                "title": song[1],
                "artist": song[2],
                "last_played": song[3].isoformat() if song[3] else None,
                "play_count": song[4],
            }
            for song in recent
        ]
    
    @staticmethod
    def get_listening_trends(db: Session):
        """Get listening trends by date"""
        trends = db.query(
            func.date(PlayHistory.last_played).label("date"),
            func.count(PlayHistory.id).label("unique_songs"),
            func.sum(PlayHistory.play_count).label("total_plays"),
        ).group_by(func.date(PlayHistory.last_played))\
         .order_by(func.date(PlayHistory.last_played).desc())\
         .limit(30)\
         .all()
        
        return [
            {
                "date": str(trend[0]) if trend[0] else None,
                "unique_songs": trend[1],
                "total_plays": trend[2],
            }
            for trend in trends
        ]
    
    @staticmethod
    def get_skip_analysis(db: Session, limit: int = 10):
        """Get songs with highest skip rates"""
        skipped = db.query(
            Song.id,
            Song.title,
            Song.artist,
            PlayHistory.skip_count,
            PlayHistory.play_count,
        ).join(PlayHistory, Song.id == PlayHistory.song_id)\
         .filter(PlayHistory.play_count > 0)\
         .all()
        
        skip_rates = []
        for song in skipped:
            skip_rate = (song[3] / song[4] * 100) if song[4] > 0 else 0
            skip_rates.append({
                "id": song[0],
                "title": song[1],
                "artist": song[2],
                "skip_count": song[3],
                "play_count": song[4],
                "skip_rate": round(skip_rate, 2),
            })
        
        return sorted(skip_rates, key=lambda x: x["skip_rate"], reverse=True)[:limit]
