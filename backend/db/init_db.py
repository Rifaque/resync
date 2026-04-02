from db.database import engine, Base
from app.models.song import Song
from db.models.download import Download
from db.models.play_history import PlayHistory
from db.models.recommendation import Recommendation
from db.models.playlist import Playlist

def init_db():
    Base.metadata.create_all(bind=engine)

    # Ensure downloaded_at exists in downloads table for older databases
    from sqlalchemy import text
    with engine.connect() as conn:
        existing_cols = conn.execute(
            text("PRAGMA table_info(downloads);")
        ).fetchall()
        if existing_cols and "downloaded_at" not in [c[1] for c in existing_cols]:
            try:
                conn.execute(text("ALTER TABLE downloads ADD COLUMN downloaded_at DATETIME;"))
                conn.commit()
                print("Added downloads.downloaded_at column")
            except Exception as e:
                print("Could not add downloaded_at column (it may already exist):", e)

    # Ensure metadata columns exist on songs table for older databases
    with engine.connect() as conn:
        existing_cols = conn.execute(
            text("PRAGMA table_info(songs);")
        ).fetchall()
        existing_col_names = [c[1] for c in existing_cols] if existing_cols else []

        if "year" not in existing_col_names:
            try:
                conn.execute(text("ALTER TABLE songs ADD COLUMN year INTEGER;"))
                conn.commit()
                print("Added songs.year column")
            except Exception as e:
                print("Could not add songs.year column (it may already exist):", e)

        if "duration" not in existing_col_names:
            try:
                conn.execute(text("ALTER TABLE songs ADD COLUMN duration FLOAT;"))
                conn.commit()
                print("Added songs.duration column")
            except Exception as e:
                print("Could not add songs.duration column (it may already exist):", e)

        if "artwork_path" not in existing_col_names:
            try:
                conn.execute(text("ALTER TABLE songs ADD COLUMN artwork_path VARCHAR;"))
                conn.commit()
                print("Added songs.artwork_path column")
            except Exception as e:
                print("Could not add songs.artwork_path column (it may already exist):", e)

if __name__ == "__main__":
    init_db()
