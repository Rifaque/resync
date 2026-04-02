from fastapi import FastAPI
from app.routes import songs, downloads, history, recommendations, playlists, statistics
from fastapi.middleware.cors import CORSMiddleware
from db.init_db import init_db

app = FastAPI()

init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(songs.router)
app.include_router(downloads.router)
app.include_router(history.router)
app.include_router(recommendations.router)
app.include_router(playlists.router)
app.include_router(statistics.router)

@app.get("/")
def root():
    return {"message": "Resync backend running"}
