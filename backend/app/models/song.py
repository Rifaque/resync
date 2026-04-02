from sqlalchemy import Column, Integer, String, Float
from db.database import Base

class Song(Base):
    __tablename__ = "songs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    artist = Column(String)
    path = Column(String)   # file path on server
    year = Column(Integer, nullable=True)
    duration = Column(Float, nullable=True)
    artwork_path = Column(String, nullable=True)
