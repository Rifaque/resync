from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey
from db.database import Base
from datetime import datetime


class Recommendation(Base):
    __tablename__ = "recommendations"

    id = Column(Integer, primary_key=True, index=True)
    song_id = Column(Integer, ForeignKey("songs.id"), nullable=True, index=True)
    title = Column(String)  # Recommended song title
    artist = Column(String, nullable=True)  # Recommended artist
    url = Column(String, nullable=True)  # Source URL for download (YouTube, etc)
    reason = Column(String)  # e.g., "similar_artist", "frequent_listener"
    score = Column(Float)  # 0-100, confidence/relevance score
    auto_download = Column(String, default="pending")  # pending, queued, completed, skipped
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    downloaded_at = Column(DateTime, nullable=True)

    __table_args__ = (
        {"sqlite_autoincrement": True},
    )

