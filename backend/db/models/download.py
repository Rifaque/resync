from sqlalchemy import Column, Integer, String, DateTime, Float, Boolean, ForeignKey
from db.database import Base
from datetime import datetime

class Download(Base):
    __tablename__ = "downloads"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, unique=True, index=True)
    title = Column(String)
    artist = Column(String, nullable=True)
    status = Column(String, default="queued", index=True)  # queued, downloading, completed, failed
    progress = Column(Integer, default=0)
    file_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    downloaded_at = Column(DateTime, nullable=True)
    error_message = Column(String, nullable=True)
    is_recommendation = Column(Boolean, default=False)  # True if auto-downloaded from recommendations