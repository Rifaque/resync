"""
Smart recommendations engine based on play history analysis.

Analyzes listening patterns and generates recommendations for:
- Frequently listened artists → related artists
- Popular songs in library → similar genre/style
- Discovery → new music to explore
"""

from sqlalchemy.orm import Session
from db.models.play_history import PlayHistory
from db.models.recommendation import Recommendation
from app.models.song import Song
from typing import List, Tuple
from collections import Counter


class RecommendationEngine:
    """Generate smart recommendations based on play patterns."""

    def __init__(self, db: Session):
        self.db = db

    def analyze_listening_patterns(self) -> dict:
        """Analyze play history to understand user preferences."""
        # Get all play history records
        history = self.db.query(PlayHistory).order_by(
            PlayHistory.last_played.desc()
        ).all()

        if not history:
            return {
                "top_artists": [],
                "total_plays": 0,
                "favorite_artists": [],
            }

        # Count plays by artist
        artist_plays = {}
        total_plays = 0

        for record in history:
            song = self.db.query(Song).filter(Song.id == record.song_id).first()
            if song:
                artist = song.artist or "Unknown"
                artist_plays[artist] = artist_plays.get(artist, 0) + record.play_count
                total_plays += record.play_count

        # Sort by play count
        top_artists = sorted(artist_plays.items(), key=lambda x: x[1], reverse=True)[
            :5
        ]

        return {
            "top_artists": [a[0] for a in top_artists],
            "artist_play_counts": dict(top_artists),
            "total_plays": total_plays,
        }

    def suggest_artist_recommendations(self, limit: int = 10) -> List[Tuple[str, str, float]]:
        """
        Suggest artists and songs based on listening patterns.
        Returns: [(title, artist, score), ...]
        
        This generates suggestion text - actual URLs should be managed separately
        or found via external APIs.
        """
        patterns = self.analyze_listening_patterns()
        top_artists = patterns.get("top_artists", [])

        if not top_artists:
            return []

        suggestions = []

        # For each top artist, suggest related content
        for artist in top_artists:
            score = 80
            reason = f"Similar to {artist}, who you listen to often"
            title = f"New music from {artist}"
            suggestions.append((title, artist, score, reason))

        return suggestions[:limit]

    def get_recommendations(self, limit: int = 10) -> List[dict]:
        """Get current recommendations from database."""
        recommendations = (
            self.db.query(Recommendation)
            .filter(Recommendation.auto_download != "skipped")
            .order_by(Recommendation.score.desc())
            .limit(limit)
            .all()
        )

        result = []
        for rec in recommendations:
            result.append(
                {
                    "id": rec.id,
                    "title": rec.title,
                    "artist": rec.artist,
                    "reason": rec.reason,
                    "score": rec.score,
                    "auto_download": rec.auto_download,
                    "url": rec.url,
                }
            )

        return result

    def add_recommendation(
        self, title: str, artist: str, reason: str, score: float, url: str = None
    ) -> Recommendation:
        """Add a new recommendation manually."""
        rec = Recommendation(
            title=title,
            artist=artist,
            reason=reason,
            score=score,
            url=url,
            auto_download="pending",
        )
        self.db.add(rec)
        self.db.commit()
        self.db.refresh(rec)
        return rec

    def queue_for_auto_download(self, recommendation_ids: List[int]) -> int:
        """
        Mark recommendations for auto-download.
        Returns: number queued
        """
        count = 0
        for rec_id in recommendation_ids:
            rec = self.db.query(Recommendation).filter(
                Recommendation.id == rec_id
            ).first()
            if rec and rec.auto_download == "pending" and rec.url:
                rec.auto_download = "queued"
                count += 1

        self.db.commit()
        return count

    def generate_batch_recommendations(self, limit: int = 20) -> dict:
        """
        Generate batch recommendations based on listening patterns.
        This analyzes top artists and creates new recommendations.
        Returns count of newly created recommendations.
        """
        patterns = self.analyze_listening_patterns()
        top_artists = patterns.get("top_artists", [])

        if not top_artists:
            return {"generated": 0, "message": "No listening history to analyze"}

        # Check for already recommended artists
        existing = self.db.query(Recommendation).filter(
            Recommendation.auto_download != "skipped"
        ).all()
        existing_artists = {r.artist for r in existing}

        generated_count = 0
        recommendations = []

        # Generate recommendations for top artists
        for i, artist in enumerate(top_artists[:5]):
            if artist not in existing_artists:
                score = 85 - (i * 5)  # Decrease score by artist ranking
                reason = f"Top of your listening history"
                
                # Create recommendation without requiring URL (can be added later)
                rec = Recommendation(
                    title=f"Explore {artist}",
                    artist=artist,
                    reason=reason,
                    score=score,
                    url=None,  # URL will be set when searching
                    auto_download="pending",
                )
                self.db.add(rec)
                recommendations.append(rec)
                generated_count += 1

        self.db.commit()

        return {
            "generated": generated_count,
            "top_artists": top_artists[:5],
            "recommendations": [r.id for r in recommendations],
        }

