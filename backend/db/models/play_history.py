from sqlalchemy import Column, Integer, String, DateTime, Float, ForeignKey
from db.database import Base
from datetime import datetime


class PlayHistory(Base):
    __tablename__ = "play_history"

    id = Column(Integer, primary_key=True, index=True)
    song_id = Column(Integer, ForeignKey("songs.id"), index=True)
    play_count = Column(Integer, default=1)  # Total plays of this song
    total_listen_time = Column(Integer, default=0)  # In seconds
    last_played = Column(DateTime, default=datetime.utcnow, index=True)
    skip_count = Column(Integer, default=0)  # Skipped before finishing
    completion_rate = Column(Float, default=0.0)  # 0-1, how much usually played

    __table_args__ = (
        {"sqlite_autoincrement": True},
    )
