import { useEffect, useRef, useState } from "react";
import {
  IoPlayOutline,
  IoPauseOutline,
  IoPlaySkipBackOutline,
  IoPlaySkipForwardOutline,
  IoVolumeHighOutline,
  IoMusicalNotesOutline,
  IoDownloadOutline,
  IoCheckmarkCircleOutline,
  IoStar,
  IoAddOutline,
  IoTrashOutline,
  IoChevronDownOutline,
  IoArrowBackOutline,
  IoSearchOutline,
  IoLibraryOutline,
  IoSwapVerticalOutline,
  IoMicOutline,
  IoCodeDownloadOutline,
  IoSettingsOutline,
  IoListOutline,
  IoGridOutline,
  IoRefreshOutline,
} from "react-icons/io5";

type View = "library" | "downloads" | "recommendations" | "statistics" | "playlists" | "now-playing" | "settings" | "metadata";

interface Song {
  id: number;
  title: string;
  artist: string;
  path: string;
  year?: number | null;
  duration?: number;
  artwork_path?: string | null;
}

interface Download {
  id: number;
  url: string;
  title: string;
  artist?: string;
  status: string;
  progress: number;
  file_path?: string;
  created_at?: string;
  updated_at?: string;
  downloaded_at?: string;
  error_message?: string;
}

interface Recommendation {
  id: number;
  title: string;
  artist?: string;
  reason: string;
  score: number;
  auto_download: string;
  url?: string;
}

interface Playlist {
  id: number;
  name: string;
  song_count: number;
  description?: string;
  songs?: Song[];
}

const spotifyColors = {
  bg: "#121212",
  bgLight: "#181818",
  bgLighter: "#282828",
  text: "#ffffff",
  textSecondary: "#b3b3b3",
  primary: "#1db954",
  accent: "#191414",
  hover: "#1ed760",
};

function App() {
  const [view, setView] = useState<View>("library");
  const [songs, setSongs] = useState<Song[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<Song[]>([]);
  const [downloads, setDownloads] = useState<Download[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [allRecommendations, setAllRecommendations] = useState<Recommendation[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistSongs, setPlaylistSongs] = useState<Song[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [hoverSeekPercent, setHoverSeekPercent] = useState<number | null>(null);
  const [seekStartProgress, setSeekStartProgress] = useState<number | null>(null);
  const [volume, setVolume] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const [playPreviewOnHover, setPlayPreviewOnHover] = useState(true);
  const [hoveredSongId, setHoveredSongId] = useState<number | null>(null);
  const [songMetadataDrafts, setSongMetadataDrafts] = useState<Record<number, { year: string; duration: string }>>({});

  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadTitle, setDownloadTitle] = useState("");
  const [downloadArtist, setDownloadArtist] = useState("");
  const [showNewPlaylistModal, setShowNewPlaylistModal] = useState(false);
  const [libraryViewMode, setLibraryViewMode] = useState<"list" | "grid">("list");
  const [librarySortKey, setLibrarySortKey] = useState<"default" | "title" | "artist" | "year" | "added" >("default");
  const [showAddToPlaylistModal, setShowAddToPlaylistModal] = useState(false);
  const [songToAdd, setSongToAdd] = useState<Song | null>(null);
  const [recommendationsToShow, setRecommendationsToShow] = useState(6);
  const [albumArtUrls, setAlbumArtUrls] = useState<Record<number, string>>({});
  const [showLyrics, setShowLyrics] = useState(false);
  const [downloadSortKey, setDownloadSortKey] = useState<"created_at" | "updated_at" | "status" | "title">("created_at");
  const [selectedDownload, setSelectedDownload] = useState<Download | null>(null);
  const [isScanningLibrary, setIsScanningLibrary] = useState(false);
  const [savingMetadataIds, setSavingMetadataIds] = useState<Record<number, boolean>>({});
  const [uploadingArtworkIds, setUploadingArtworkIds] = useState<Record<number, boolean>>({});
  const [metadataSearchQuery, setMetadataSearchQuery] = useState("");

  const audioRef = useRef<HTMLAudioElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const currentSong = songs[currentIndex];
  const cleanTitle = (title: string) => title.replace(/\.(m4a|mp3|flac|wav)$/i, "");

  const sortSongs = (songsList: Song[]) => {
    switch (librarySortKey) {
      case "title":
        return [...songsList].sort((a, b) => a.title.localeCompare(b.title));
      case "artist":
        return [...songsList].sort((a, b) => a.artist.localeCompare(b.artist));
      case "year":
        return [...songsList].sort((a, b) => {
          const ay = a.year ?? Number.MAX_SAFE_INTEGER;
          const by = b.year ?? Number.MAX_SAFE_INTEGER;
          return ay - by;
        });
      default:
        return songsList;
    }
  };

  const playingIndicator = (
    <IoMusicalNotesOutline
      size={16}
      style={{ color: spotifyColors.primary, animation: "pulse 1s infinite" }}
    />
  );

  const refreshSongs = async () => {
    const response = await fetch("http://localhost:8000/songs");
    const data = await response.json();
    setSongs(data);

    if (!searchQuery.trim()) {
      setFilteredSongs(data);
      return;
    }

    const q = searchQuery.toLowerCase();
    setFilteredSongs(
      data.filter(
        (s: Song) =>
          cleanTitle(s.title).toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q)
      )
    );
  };

  // Load last played song and timestamp from localStorage
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.75; } 100% { transform: scale(1); opacity: 1; } }
    `;
    document.head.appendChild(style);

    const lastPlayedData = localStorage.getItem("resync_playback_state");
    if (lastPlayedData) {
      try {
        const { songId, timestamp, isPlaying: savedIsPlaying } = JSON.parse(lastPlayedData);
        const songIndex = songs.findIndex((s) => s.id === songId);
        if (songIndex !== -1) {
          setCurrentIndex(songIndex);
          setCurrentTime(timestamp);

          // set initial playing state from saved state
          if (savedIsPlaying) {
            setIsPlaying(true);
            setTimeout(() => {
              if (audioRef.current) {
                audioRef.current.currentTime = timestamp;
                audioRef.current
                  .play()
                  .catch(() => setIsPlaying(false));
              }
            }, 500);
          } else {
            setIsPlaying(false);
            if (audioRef.current) {
              audioRef.current.currentTime = timestamp;
              audioRef.current.pause();
            }
          }
        }
      } catch (e) {
        console.error("Failed to restore playback state", e);
      }
    }
  }, [songs.length]);

  // Save playback state to localStorage
  useEffect(() => {
    if (currentSong) {
      const playbackState = {
        songId: currentSong.id,
        timestamp: currentTime,
        isPlaying,
      };
      localStorage.setItem("resync_playback_state", JSON.stringify(playbackState));
    }
  }, [currentTime, currentSong?.id, isPlaying]);

  // Fetch all data
  useEffect(() => {
    refreshSongs().catch(() => {});
  }, []);

  // Polling for dynamic data
  useEffect(() => {
    const poll = () => {
      Promise.all([
        fetch("http://localhost:8000/downloads").then((r) => r.json()).catch(() => []),
        fetch("http://localhost:8000/recommendations?limit=50").then((r) => r.json()).catch(() => []),
        fetch("http://localhost:8000/playlists").then((r) => r.json()).catch(() => []),
        fetch("http://localhost:8000/statistics/dashboard").then((r) => r.json()).catch(() => null),
      ]).then(([d, r, p, s]) => {
        setDownloads(d);
        setAllRecommendations(r);
        setRecommendations(r.slice(0, recommendationsToShow));
        setPlaylists(p);
        setStatistics(s);
      });
    };
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [recommendationsToShow]);

  // Load playlist details
  useEffect(() => {
    if (selectedPlaylist) {
      fetch(`http://localhost:8000/playlists/${selectedPlaylist.id}`)
        .then((r) => r.json())
        .then((d) => {
          setSelectedPlaylist(d);
          setPlaylistSongs(d.songs || []);
        })
        .catch(() => {});
    }
  }, [selectedPlaylist?.id]);

  const statusColors: Record<string, string> = {
    queued: "#f2952e",
    downloading: "#1db954",
    completed: "#3a9ccc",
    failed: "#e63946",
  };

  const cancelDownload = async (downloadId: number) => {
    try {
      await fetch(`http://localhost:8000/downloads/${downloadId}`, { method: "DELETE" });
      const res = await fetch("http://localhost:8000/downloads");
      const data = await res.json();
      setDownloads(data);
      if (selectedDownload?.id === downloadId) setSelectedDownload(null);
    } catch (e) {
      console.error("Failed to cancel download", e);
    }
  };

  const sortDownloads = (items: Download[]) => {
    return [...items].sort((a, b) => {
      if (downloadSortKey === "status") {
        const order: Record<string, number> = { queued: 1, downloading: 2, completed: 3, failed: 4 };
        return (order[a.status] || 99) - (order[b.status] || 99);
      }
      if (downloadSortKey === "created_at") {
        return (new Date(b.created_at || "").getTime() || 0) - (new Date(a.created_at || "").getTime() || 0);
      }
      if (downloadSortKey === "updated_at") {
        return (new Date(b.updated_at || "").getTime() || 0) - (new Date(a.updated_at || "").getTime() || 0);
      }
      if (downloadSortKey === "title") {
        return a.title.localeCompare(b.title);
      }
      return 0;
    });
  };

  // Load album art for songs
  useEffect(() => {
    songs.forEach(song => {
      if (!albumArtUrls[song.id]) {
        loadAlbumArt(song.id);
      }
    });
  }, [songs]);

  // Keep metadata editor draft values in sync with server-loaded songs.
  useEffect(() => {
    setSongMetadataDrafts((prev) => {
      const next = { ...prev };
      for (const song of songs) {
        if (!next[song.id]) {
          next[song.id] = {
            year: song.year != null ? String(song.year) : "",
            duration: song.duration != null ? String(song.duration) : "",
          };
        }
      }
      return next;
    });
  }, [songs]);

  // Audio playback handlers
  useEffect(() => {
    if (!audioRef.current || !currentSong) return;
    const audio = audioRef.current;
    const updateProgress = () => {
      if (isSeeking) return;
      setProgress((audio.currentTime / audio.duration) * 100);
      setCurrentTime(audio.currentTime);
    };
    const onEnded = () => {
      fetch("http://localhost:8000/history/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          song_id: currentSong.id,
          listen_duration: currentTime,
          skipped: false,
        }),
      }).catch(() => {});
      setCurrentIndex((i) => (i + 1) % songs.length);
    };
    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("ended", onEnded);
    };
  }, [currentSong, currentTime, songs.length, isSeeking]);

  // Handle audio source changes
  useEffect(() => {
    if (audioRef.current && currentSong) {
      audioRef.current.src = `http://localhost:8000/stream/${currentSong.id}`;
      audioRef.current.load();
      setIsSeeking(false);
      setSeekValue(0);
      if (isPlaying) {
        audioRef.current.play().catch(() => {});
      }
    }
  }, [currentSong?.id]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => {});
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!previewAudioRef.current) return;
    const audio = previewAudioRef.current;

    if (hoveredSongId !== null && playPreviewOnHover) {
      audio.src = `http://localhost:8000/stream/${hoveredSongId}`;
      audio.currentTime = 0;
      audio.volume = 0.45;
      audio
        .play()
        .catch(() => {
          // ignore preview playback errors
        });

      const stopTimer = window.setTimeout(() => {
        audio.pause();
      }, 8000);

      return () => {
        window.clearTimeout(stopTimer);
        audio.pause();
      };
    }

    if (hoveredSongId === null) {
      audio.pause();
    }
    return undefined;
  }, [hoveredSongId, playPreviewOnHover]);

  // Helper functions
  const formatTime = (sec: number) => {
    if (sec == null || isNaN(sec)) return "0:00";
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const updateMetadataDraft = (songId: number, field: "year" | "duration", value: string) => {
    setSongMetadataDrafts((prev) => ({
      ...prev,
      [songId]: {
        year: prev[songId]?.year ?? "",
        duration: prev[songId]?.duration ?? "",
        [field]: value,
      },
    }));
  };

  const saveSongMetadata = async (songId: number) => {
    const draft = songMetadataDrafts[songId] || { year: "", duration: "" };
    const trimmedYear = draft.year.trim();
    const trimmedDuration = draft.duration.trim();

    const payload = {
      year: trimmedYear ? parseInt(trimmedYear, 10) : null,
      duration: trimmedDuration ? parseFloat(trimmedDuration) : null,
    };

    if (payload.year !== null && Number.isNaN(payload.year)) {
      return;
    }
    if (payload.duration !== null && Number.isNaN(payload.duration)) {
      return;
    }

    setSavingMetadataIds((prev) => ({ ...prev, [songId]: true }));
    try {
      await fetch(`http://localhost:8000/songs/${songId}/metadata`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await refreshSongs();
    } catch (e) {
      console.error("Failed to save song metadata", e);
    } finally {
      setSavingMetadataIds((prev) => ({ ...prev, [songId]: false }));
    }
  };

  const uploadSongArtwork = async (songId: number, file: File) => {
    setUploadingArtworkIds((prev) => ({ ...prev, [songId]: true }));
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`http://localhost:8000/songs/${songId}/artwork`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const freshArtworkUrl = `http://localhost:8000/artwork/${songId}?t=${Date.now()}`;
      setAlbumArtUrls((prev) => ({ ...prev, [songId]: freshArtworkUrl }));
    } catch (e) {
      console.error("Failed to upload song artwork", e);
    } finally {
      setUploadingArtworkIds((prev) => ({ ...prev, [songId]: false }));
    }
  };

  const playSong = (index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
  };

  const seekToPercent = (percent: number) => {
    if (!audioRef.current || !duration || Number.isNaN(percent)) return;
    const clamped = Math.max(0, Math.min(100, percent));
    audioRef.current.currentTime = (clamped / 100) * duration;
    setProgress(clamped);
    setCurrentTime(audioRef.current.currentTime);
  };

  const getPercentFromPointer = (event: any) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(100, ratio * 100));
  };

  const getSeekBarBackground = () => {
    const isHoveringOrSeeking = hoverSeekPercent !== null || isSeeking;

    if (!isHoveringOrSeeking) {
      return `linear-gradient(to right, #ffffff 0%, #ffffff ${progress}%, #4d4d4d ${progress}%, #4d4d4d 100%)`;
    }

    const baseProgress = isSeeking ? (seekStartProgress ?? progress) : progress;
    const targetProgress = isSeeking ? seekValue : (hoverSeekPercent ?? progress);
    const lower = Math.min(baseProgress, targetProgress);
    const upper = Math.max(baseProgress, targetProgress);

    return `linear-gradient(to right, #1db954 0%, #1db954 ${lower}%, #ffffff ${lower}%, #ffffff ${upper}%, #4d4d4d ${upper}%, #4d4d4d 100%)`;
  };

  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      const response = await fetch("http://localhost:8000/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPlaylistName, description: "" }),
      });
      if (response.ok) {
        setNewPlaylistName("");
        setShowNewPlaylistModal(false);
        // Refresh playlists
        const res = await fetch("http://localhost:8000/playlists");
        const data = await res.json();
        setPlaylists(data);
      }
    } catch (e) {
      console.error("Failed to create playlist", e);
    }
  };

  const addSongToPlaylist = async (playlistId: number, songId: number) => {
    try {
      await fetch(`http://localhost:8000/playlists/${playlistId}/songs/${songId}`, {
        method: "POST",
      });
      // Refresh current playlist
      if (selectedPlaylist?.id === playlistId) {
        const res = await fetch(`http://localhost:8000/playlists/${playlistId}`);
        const data = await res.json();
        setSelectedPlaylist(data);
        setPlaylistSongs(data.songs || []);
      }
    } catch (e) {
      console.error("Failed to add song to playlist", e);
    }
  };

  const deletePlaylist = async (playlistId: number) => {
    try {
      await fetch(`http://localhost:8000/playlists/${playlistId}`, { method: "DELETE" });
      setSelectedPlaylist(null);
      const res = await fetch("http://localhost:8000/playlists");
      const data = await res.json();
      setPlaylists(data);
    } catch (e) {
      console.error("Failed to delete playlist", e);
    }
  };

  const queueDownload = async () => {
    if (!downloadUrl.trim()) return;
    try {
      const response = await fetch("http://localhost:8000/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: downloadUrl,
          title: downloadTitle || "Pending...",
          artist: downloadArtist || "Unknown",
        }),
      });
      if (response.ok) {
        setDownloadUrl("");
        setDownloadTitle("");
        setDownloadArtist("");
        // Refresh downloads
        const res = await fetch("http://localhost:8000/downloads");
        const data = await res.json();
        setDownloads(data);
      }
    } catch (e) {
      console.error("Failed to queue download", e);
    }
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredSongs(songs);
    } else {
      const q = query.toLowerCase();
      setFilteredSongs(
        songs.filter(
          (s) =>
            cleanTitle(s.title).toLowerCase().includes(q) ||
            s.artist.toLowerCase().includes(q)
        )
      );
    }
  };

  const scanLibrary = async () => {
    if (isScanningLibrary) return;
    setIsScanningLibrary(true);
    try {
      await fetch("http://localhost:8000/scan", { method: "POST" });
      await refreshSongs();
    } catch (e) {
      console.error("Failed to scan library", e);
    } finally {
      setIsScanningLibrary(false);
    }
  };

  const generateMockLyrics = (title: string) => {
    return `♪ Lyrics for "${title}" ♪\n\nLyrics are not available in the current version.\nSupport for lyrics will be added in the next update.\n\nPlay the song and enjoy the music! 🎵`;
  };

  const loadAlbumArt = async (songId: number) => {
    if (albumArtUrls[songId]) return albumArtUrls[songId];
    
    try {
      const response = await fetch(`http://localhost:8000/artwork/${songId}`);
      const contentType = response.headers.get("content-type") || "";
      if (response.ok && contentType.startsWith("image/")) {
        const url = `http://localhost:8000/artwork/${songId}`;
        setAlbumArtUrls(prev => ({ ...prev, [songId]: url }));
        return url;
      }
    } catch (e) {
      console.error("Failed to load album art", e);
    }
    
    // Fallback to placeholder
    const placeholderUrl = `data:image/svg+xml,${encodeURIComponent(`
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="#282828"/>
        <text x="100" y="110" text-anchor="middle" font-family="Arial" font-size="60" fill="#666">♪</text>
      </svg>
    `)}`;
    setAlbumArtUrls(prev => ({ ...prev, [songId]: placeholderUrl }));
    return placeholderUrl;
  };

  const renderLibraryView = () => {
    const items = sortSongs(filteredSongs.length ? filteredSongs : songs);

    return (
      <div style={{ padding: "2rem" }}>
        <h1 style={{ marginBottom: "1.5rem", color: spotifyColors.text }}>Your Library</h1>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                backgroundColor: spotifyColors.bgLight,
                borderRadius: "999px",
                padding: "0.2rem",
                border: `1px solid ${spotifyColors.bgLighter}`,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "0.2rem",
                  left: "0.2rem",
                  width: "42px",
                  height: "34px",
                  borderRadius: "999px",
                  backgroundColor: spotifyColors.primary,
                  transform: libraryViewMode === "list" ? "translateX(0)" : "translateX(42px)",
                  transition: "transform 320ms cubic-bezier(0.22, 1, 0.36, 1)",
                  willChange: "transform",
                }}
              />
              <button
                onClick={() => setLibraryViewMode("list")}
                aria-label="List View"
                title="List View"
                style={{
                  position: "relative",
                  width: "42px",
                  height: "34px",
                  borderRadius: "999px",
                  backgroundColor: "transparent",
                  color: libraryViewMode === "list" ? "#000" : spotifyColors.text,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1,
                  transition: "color 220ms ease",
                }}
              >
                <IoListOutline size={18} />
              </button>
              <button
                onClick={() => setLibraryViewMode("grid")}
                aria-label="Grid View"
                title="Grid View"
                style={{
                  position: "relative",
                  width: "42px",
                  height: "34px",
                  borderRadius: "999px",
                  backgroundColor: "transparent",
                  color: libraryViewMode === "grid" ? "#000" : spotifyColors.text,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1,
                  transition: "color 220ms ease",
                }}
              >
                <IoGridOutline size={18} />
              </button>
            </div>
            <button
              onClick={scanLibrary}
              disabled={isScanningLibrary}
              style={{
                padding: "0.5rem 0.85rem",
                borderRadius: "999px",
                backgroundColor: isScanningLibrary ? spotifyColors.bgLighter : spotifyColors.bgLight,
                color: spotifyColors.text,
                border: `1px solid ${spotifyColors.bgLighter}`,
                cursor: isScanningLibrary ? "not-allowed" : "pointer",
                opacity: isScanningLibrary ? 0.75 : 1,
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <IoRefreshOutline size={16} />
              {isScanningLibrary ? "Scanning..." : "Scan Library"}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label style={{ color: spotifyColors.textSecondary }}>Sort by:</label>
            <select
              value={librarySortKey}
              onChange={(e) => setLibrarySortKey(e.target.value as any)}
              style={{
                padding: "0.4rem 0.6rem",
                borderRadius: "0.4rem",
                border: `1px solid ${spotifyColors.bgLighter}`,
                backgroundColor: spotifyColors.bgLight,
                color: spotifyColors.text,
              }}
            >
              <option value="default">Default</option>
              <option value="title">Title</option>
              <option value="artist">Artist</option>
              <option value="year">Year</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              backgroundColor: spotifyColors.bgLight,
              borderRadius: "2rem",
              paddingLeft: "1rem",
              gap: "0.5rem",
            }}
          >
          <IoSearchOutline size={18} color={spotifyColors.textSecondary} />
          <input
            type="text"
            placeholder="Search songs or artists..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={{
              flex: 1,
              backgroundColor: "transparent",
              border: "none",
              padding: "0.75rem",
              color: spotifyColors.text,
              outline: "none",
            }}
          />
        </div>
      </div>

      <div
        style={
          libraryViewMode === "grid"
            ? { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem" }
            : { display: "flex", flexDirection: "column", gap: "0.5rem" }
        }
      >
        {items.map((song, idx) => {
          const songIndex = songs.findIndex((s) => s.id === song.id);
          const isCurrent = songIndex === currentIndex;
          const rowDuration = song.duration;

          if (libraryViewMode === "list") {
            return (
              <div
                key={song.id}
                onClick={() => playSong(songIndex)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 40px 2fr 1.4fr 1fr",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem",
                  backgroundColor: isCurrent ? "rgba(29,185,84,0.18)" : spotifyColors.bgLight,
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  if (playPreviewOnHover) setHoveredSongId(song.id);
                  (e.currentTarget as HTMLElement).style.backgroundColor = isCurrent
                    ? "rgba(29,185,84,0.24)"
                    : spotifyColors.bgLighter;
                }}
                onMouseLeave={(e) => {
                  setHoveredSongId(null);
                  (e.currentTarget as HTMLElement).style.backgroundColor = isCurrent
                    ? "rgba(29,185,84,0.18)"
                    : spotifyColors.bgLight;
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isCurrent ? playingIndicator : <span style={{ color: spotifyColors.textSecondary }}>{idx + 1}</span>}
                </div>

                <div style={{ position: "relative", width: "40px", height: "40px", borderRadius: "6px", overflow: "hidden" }}>
                  <img
                    src={albumArtUrls[song.id] || `data:image/svg+xml,${encodeURIComponent(`
                      <svg width="40" height="40" xmlns="http://www.w3.org/2000/svg">
                        <rect width="40" height="40" fill="#282828"/>
                        <text x="20" y="24" text-anchor="middle" font-family="Arial" font-size="20" fill="#666">♪</text>
                      </svg>
                    `)}`}
                    alt="cover"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>

                <div style={{ fontWeight: "bold", color: isCurrent ? spotifyColors.primary : spotifyColors.text, textAlign: "left" }}>
                  {cleanTitle(song.title)}
                </div>

                <div style={{ color: spotifyColors.textSecondary, fontSize: "0.9rem", textAlign: "left" }}>
                  {song.artist}
                </div>

                <div style={{ color: spotifyColors.textSecondary, fontSize: "0.8rem", textAlign: "left" }}>
                  {rowDuration != null ? formatTime(rowDuration) : "-"}
                </div>
              </div>
            );
          }

          // grid mode
          return (
            <div
              key={song.id}
              onClick={() => playSong(songIndex)}
              style={{
                position: "relative",
                backgroundColor: spotifyColors.bgLight,
                borderRadius: "0.75rem",
                overflow: "hidden",
                cursor: "pointer",
                boxShadow: isCurrent ? "0 0 0 2px rgba(29,185,84,0.6)" : "0 0 0 1px rgba(255,255,255,0.06)",
              }}
              onMouseEnter={(e) => {
                if (playPreviewOnHover) setHoveredSongId(song.id);
                (e.currentTarget as HTMLElement).style.filter = "brightness(1.02)";
              }}
              onMouseLeave={(e) => {
                setHoveredSongId(null);
                (e.currentTarget as HTMLElement).style.filter = "none";
              }}
            >
              <div style={{ position: "relative", width: "100%", aspectRatio: "1/1", backgroundColor: spotifyColors.accent }}>
                <img
                  src={albumArtUrls[song.id] || `data:image/svg+xml,${encodeURIComponent(`
                    <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
                      <rect width="200" height="200" fill="#282828"/>
                      <text x="100" y="110" text-anchor="middle" font-family="Arial" font-size="60" fill="#666">♪</text>
                    </svg>
                  `)}`}
                  alt="cover"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
                {isCurrent && (
                  <div
                    style={{
                      position: "absolute",
                      top: "8px",
                      right: "8px",
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(0,0,0,0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <IoMusicalNotesOutline size={16} style={{ color: spotifyColors.primary, animation: "pulse 1s infinite" }} />
                  </div>
                )}
              </div>

              <div style={{ padding: "0.75rem" }}>
                <div style={{ fontWeight: "bold", marginBottom: "0.25rem", color: isCurrent ? spotifyColors.primary : spotifyColors.text }}>
                  {cleanTitle(song.title)}
                </div>
                <div style={{ color: spotifyColors.textSecondary, fontSize: "0.82rem" }}>{song.artist}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

  const renderDownloadsView = () => (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ marginBottom: "1.5rem" }}>Download Queue</h1>

      <div
        style={{
          backgroundColor: spotifyColors.bgLight,
          padding: "1.5rem",
          borderRadius: "0.75rem",
          marginBottom: "2rem",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Add New Download</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <input
            type="text"
            placeholder="YouTube URL or search query..."
            value={downloadUrl}
            onChange={(e) => setDownloadUrl(e.target.value)}
            style={{
              padding: "0.75rem",
              backgroundColor: spotifyColors.accent,
              border: `1px solid ${spotifyColors.bgLighter}`,
              borderRadius: "0.25rem",
              color: spotifyColors.text,
            }}
          />
          <input
            type="text"
            placeholder="Song Title (optional)"
            value={downloadTitle}
            onChange={(e) => setDownloadTitle(e.target.value)}
            style={{
              padding: "0.75rem",
              backgroundColor: spotifyColors.accent,
              border: `1px solid ${spotifyColors.bgLighter}`,
              borderRadius: "0.25rem",
              color: spotifyColors.text,
            }}
          />
          <input
            type="text"
            placeholder="Artist (optional)"
            value={downloadArtist}
            onChange={(e) => setDownloadArtist(e.target.value)}
            style={{
              padding: "0.75rem",
              backgroundColor: spotifyColors.accent,
              border: `1px solid ${spotifyColors.bgLighter}`,
              borderRadius: "0.25rem",
              color: spotifyColors.text,
            }}
          />
          <button
            onClick={queueDownload}
            style={{
              padding: "0.75rem",
              backgroundColor: spotifyColors.primary,
              color: "white",
              border: "none",
              borderRadius: "2rem",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "0.9rem",
              transition: "all 0.3s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = spotifyColors.hover;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = spotifyColors.primary;
            }}
          >
            <IoCodeDownloadOutline size={16} style={{ marginRight: "0.5rem" }} />
            Queue Download
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.7rem", marginBottom: "1rem" }}>
        <h2 style={{ margin: 0 }}>Active Downloads ({downloads.length})</h2>
        <label style={{ color: spotifyColors.textSecondary, fontSize: "0.9rem" }}>
          Sort by:
          <select
            value={downloadSortKey}
            onChange={(e) => setDownloadSortKey(e.target.value as any)}
            style={{ marginLeft: "0.35rem", padding: "0.25rem 0.4rem", borderRadius: "0.25rem", border: `1px solid ${spotifyColors.bgLighter}`, backgroundColor: spotifyColors.bgLight, color: spotifyColors.text }}
          >
            <option value="created_at">Created (newest)</option>
            <option value="updated_at">Updated (newest)</option>
            <option value="status">Status</option>
            <option value="title">Title</option>
          </select>
        </label>
      </div>
      {downloads.length === 0 ? (
        <p style={{ color: spotifyColors.textSecondary }}>No downloads queued</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {sortDownloads(downloads).map((d) => (
            <div
              key={d.id}
              onClick={() => setSelectedDownload(d)}
              style={{
                padding: "1rem",
                backgroundColor: selectedDownload?.id === d.id ? "rgba(29,185,84,0.1)" : spotifyColors.bgLight,
                borderRadius: "0.5rem",
                borderLeft: `4px solid ${statusColors[d.status] || spotifyColors.textSecondary}`,
                cursor: "pointer",
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>{d.title}</div>
              <div style={{ fontSize: "0.85rem", color: spotifyColors.textSecondary, marginBottom: "0.5rem" }}>
                {d.artist || "Unknown Artist"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {d.status === "completed" && <IoCheckmarkCircleOutline color={statusColors.completed} />}
                {d.status === "downloading" && <IoDownloadOutline color={statusColors.downloading} />}
                <span style={{ fontWeight: 600, color: statusColors[d.status] || spotifyColors.textSecondary }}>{d.status.toUpperCase()}</span>
                {d.progress > 0 && d.progress < 100 && (
                  <span style={{ marginLeft: "auto", fontSize: "0.85rem" }}>{d.progress}%</span>
                )}
                {(d.status === "queued" || d.status === "downloading") && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      cancelDownload(d.id);
                    }}
                    style={{ marginLeft: "auto", padding: "0.25rem 0.6rem", border: "1px solid #ccc", borderRadius: "0.3rem", background: "transparent", color: "#fff", cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                )}
              </div>
              {d.progress > 0 && d.progress < 100 && (
                <div
                  style={{
                    marginTop: "0.5rem",
                    width: "100%",
                    height: "4px",
                    backgroundColor: spotifyColors.bgLighter,
                    borderRadius: "2px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      backgroundColor: spotifyColors.primary,
                      width: `${d.progress}%`,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {selectedDownload && (
        <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: spotifyColors.bgLight, borderRadius: "0.5rem" }}>
          <h3 style={{ margin: "0 0 0.75rem 0" }}>Download Details</h3>
          <p><strong>Name:</strong> {selectedDownload.title}</p>
          <p><strong>Artist:</strong> {selectedDownload.artist || "Unknown"}</p>
          <p><strong>Status:</strong> <span style={{ color: statusColors[selectedDownload.status] }}>{selectedDownload.status.toUpperCase()}</span></p>
          <p><strong>Progress:</strong> {selectedDownload.progress}%</p>
          <p><strong>URL:</strong> <a href={selectedDownload.url} target="_blank" rel="noreferrer">Open source</a></p>
          <p><strong>Created at:</strong> {selectedDownload.created_at ? new Date(selectedDownload.created_at).toLocaleString() : "–"}</p>
          <p><strong>Updated at:</strong> {selectedDownload.updated_at ? new Date(selectedDownload.updated_at).toLocaleString() : "–"}</p>
          <p><strong>Downloaded at:</strong> {selectedDownload.downloaded_at ? new Date(selectedDownload.downloaded_at).toLocaleString() : (selectedDownload.status === "completed" && selectedDownload.updated_at ? new Date(selectedDownload.updated_at).toLocaleString() : "-")}</p>
          <p><strong>File path:</strong> {selectedDownload.file_path || "Not ready"}</p>
          {selectedDownload.error_message && <p style={{ color: statusColors.failed }}><strong>Error:</strong> {selectedDownload.error_message}</p>}
        </div>
      )}
    </div>
  );

  const renderRecommendationsView = () => (
    <div style={{ padding: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h1>Recommendations</h1>
        <select
          value={recommendationsToShow}
          onChange={(e) => setRecommendationsToShow(parseInt(e.target.value))}
          style={{
            padding: "0.5rem",
            backgroundColor: spotifyColors.bgLight,
            color: spotifyColors.text,
            border: `1px solid ${spotifyColors.primary}`,
            borderRadius: "0.25rem",
          }}
        >
          <option value={6}>Show 6</option>
          <option value={10}>Show 10</option>
          <option value={20}>Show 20</option>
          <option value={50}>Show All ({allRecommendations.length})</option>
        </select>
      </div>

      {recommendations.length === 0 ? (
        <p style={{ color: spotifyColors.textSecondary }}>No recommendations yet. Play more songs to get personalized recommendations!</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
          {recommendations.map((rec) => (
            <div
              key={rec.id}
              style={{
                padding: "1rem",
                backgroundColor: spotifyColors.bgLight,
                borderRadius: "0.5rem",
                borderTop: `3px solid ${spotifyColors.primary}`,
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>{rec.title}</div>
              <div style={{ fontSize: "0.85rem", color: spotifyColors.textSecondary, marginBottom: "0.5rem" }}>
                {rec.artist || "Unknown"}
              </div>
              <div style={{ fontSize: "0.8rem", color: spotifyColors.textSecondary, marginBottom: "0.75rem", fontStyle: "italic" }}>
                "{rec.reason}"
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", marginBottom: "0.75rem", color: spotifyColors.hover }}>
                <IoStar size={14} fill={spotifyColors.primary} /> {rec.score}%
              </div>
              <button
                onClick={() => {
                  setDownloadUrl(rec.url || "");
                  setDownloadTitle(rec.title);
                  setDownloadArtist(rec.artist || "");
                  setView("downloads");
                }}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  backgroundColor: spotifyColors.primary,
                  color: "white",
                  border: "none",
                  borderRadius: "0.25rem",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                  fontWeight: "bold",
                }}
              >
                Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderStatisticsView = () => (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ marginBottom: "1.5rem" }}>Your Statistics</h1>

      {statistics ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
            {[
              { label: "Total Songs", value: statistics.overview?.total_songs || 0 },
              { label: "Artists", value: statistics.overview?.unique_artists || 0 },
              { label: "Total Plays", value: statistics.overview?.total_plays || 0 },
              { label: "Listen Time", value: `${statistics.overview?.total_listen_time_hours || 0}h` },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  padding: "1.5rem",
                  backgroundColor: spotifyColors.bgLight,
                  borderRadius: "0.5rem",
                  textAlign: "center",
                  borderTop: `3px solid ${spotifyColors.primary}`,
                }}
              >
                <div style={{ fontSize: "0.9rem", color: spotifyColors.textSecondary, marginBottom: "0.5rem" }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: "2rem", fontWeight: "bold", color: spotifyColors.primary }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {statistics.top_songs && statistics.top_songs.length > 0 && (
            <>
              <h2 style={{ marginTop: "2rem", marginBottom: "1rem" }}>Top Songs</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "1rem" }}>
                {statistics.top_songs.slice(0, 8).map((song: any, idx: number) => (
                  <div key={idx} style={{ padding: "1rem", backgroundColor: spotifyColors.bgLight, borderRadius: "0.5rem" }}>
                    <div style={{ fontSize: "2rem", fontWeight: "bold", color: spotifyColors.primary, marginBottom: "0.5rem" }}>
                      #{idx + 1}
                    </div>
                    <div style={{ fontWeight: "bold", fontSize: "0.85rem", marginBottom: "0.25rem" }}>
                      {cleanTitle(song.title)}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: spotifyColors.textSecondary }}>
                      {song.play_count} plays
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {statistics.top_artists && statistics.top_artists.length > 0 && (
            <>
              <h2 style={{ marginTop: "2rem", marginBottom: "1rem" }}>Top Artists</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "1rem" }}>
                {statistics.top_artists.slice(0, 4).map((artist: any, idx: number) => (
                  <div key={idx} style={{ padding: "1rem", backgroundColor: spotifyColors.bgLight, borderRadius: "0.5rem" }}>
                    <div style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>{artist.name}</div>
                    <div style={{ fontSize: "0.85rem", color: spotifyColors.textSecondary }}>
                      {artist.play_count} plays
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <p style={{ color: spotifyColors.textSecondary }}>Loading statistics...</p>
      )}
    </div>
  );

  const renderPlaylistsView = () => {
    if (selectedPlaylist) {
      return (
        <div style={{ padding: "2rem" }}>
          <button
            onClick={() => setSelectedPlaylist(null)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              backgroundColor: "transparent",
              color: spotifyColors.primary,
              border: "none",
              cursor: "pointer",
              marginBottom: "1rem",
              fontSize: "1rem",
            }}
          >
            <IoArrowBackOutline size={18} /> Back to Playlists
          </button>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <h1>{selectedPlaylist.name}</h1>
            <button
              onClick={() => deletePlaylist(selectedPlaylist.id)}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "transparent",
                color: "#ff4444",
                border: `1px solid #ff4444`,
                borderRadius: "0.25rem",
                cursor: "pointer",
              }}
            >
              <IoTrashOutline size={18} /> Delete
            </button>
          </div>

          {playlistSongs.length === 0 ? (
            <div
              style={{
                padding: "2rem",
                backgroundColor: spotifyColors.bgLight,
                borderRadius: "0.75rem",
                textAlign: "center",
              }}
            >
              <p style={{ color: spotifyColors.textSecondary, marginBottom: "1rem" }}>
                This playlist is empty. Add songs from your library!
              </p>
              <button
                onClick={() => setView("library")}
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: spotifyColors.primary,
                  color: "white",
                  border: "none",
                  borderRadius: "2rem",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                Go to Library
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {playlistSongs.map((song) => (
                <div
                  key={song.id}
                  onClick={() => {
                    const idx = songs.findIndex((s) => s.id === song.id);
                    if (idx !== -1) playSong(idx);
                  }}
                  style={{
                    padding: "1rem",
                    backgroundColor: spotifyColors.bgLight,
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                  }}
                >
                  <div
                    style={{
                      width: "50px",
                      height: "50px",
                      backgroundColor: spotifyColors.accent,
                      borderRadius: "0.25rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={albumArtUrls[song.id] || `data:image/svg+xml,${encodeURIComponent(`
                        <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
                          <rect width="200" height="200" fill="#282828"/>
                          <text x="100" y="110" text-anchor="middle" font-family="Arial" font-size="60" fill="#666">♪</text>
                        </svg>
                      `)}`}
                      alt={`${song.title} thumbnail`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = `data:image/svg+xml,${encodeURIComponent(`
                          <svg width="50" height="50" xmlns="http://www.w3.org/2000/svg">
                            <rect width="50" height="50" fill="#404040"/>
                            <text x="25" y="32" text-anchor="middle" font-family="Arial" font-size="20" fill="#666">♪</text>
                          </svg>
                        `)}`;
                      }}
                    />
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontWeight: "bold",
                      color: currentIndex === songs.findIndex((s) => s.id === song.id) ? spotifyColors.primary : spotifyColors.text
                    }}>
                      {cleanTitle(song.title)}
                    </div>
                    <div style={{ fontSize: "0.85rem", color: spotifyColors.textSecondary }}>{song.artist}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={{ padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h1>Your Playlists</h1>
          <button
            onClick={() => setShowNewPlaylistModal(true)}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: spotifyColors.primary,
              color: "white",
              border: "none",
              borderRadius: "2rem",
              cursor: "pointer",
              fontWeight: "bold",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <IoAddOutline size={18} /> New Playlist
          </button>
        </div>

        {showNewPlaylistModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowNewPlaylistModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: spotifyColors.bgLight,
                padding: "2rem",
                borderRadius: "0.75rem",
                minWidth: "300px",
              }}
            >
              <h2 style={{ marginTop: 0 }}>Create New Playlist</h2>
              <input
                type="text"
                placeholder="Playlist Name"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                autoFocus
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  backgroundColor: spotifyColors.accent,
                  border: `1px solid ${spotifyColors.bgLighter}`,
                  borderRadius: "0.25rem",
                  color: spotifyColors.text,
                  marginBottom: "1rem",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={createPlaylist}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    backgroundColor: spotifyColors.primary,
                    color: "white",
                    border: "none",
                    borderRadius: "0.25rem",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  Create
                </button>
                <button
                  onClick={() => setShowNewPlaylistModal(false)}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    backgroundColor: spotifyColors.bgLighter,
                    color: spotifyColors.text,
                    border: "none",
                    borderRadius: "0.25rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showAddToPlaylistModal && songToAdd && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={() => setShowAddToPlaylistModal(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: spotifyColors.bgLight,
                padding: "2rem",
                borderRadius: "0.75rem",
                minWidth: "400px",
                maxHeight: "80vh",
                overflowY: "auto",
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: "1rem" }}>
                Add "{cleanTitle(songToAdd.title)}" to Playlist
              </h2>
              
              {playlists.length === 0 ? (
                <p style={{ color: spotifyColors.textSecondary, marginBottom: "1rem" }}>
                  No playlists yet. Create one first!
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1rem" }}>
                  {playlists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => {
                        addSongToPlaylist(playlist.id, songToAdd.id);
                        setShowAddToPlaylistModal(false);
                        setSongToAdd(null);
                      }}
                      style={{
                        padding: "1rem",
                        backgroundColor: spotifyColors.accent,
                        border: `1px solid ${spotifyColors.bgLighter}`,
                        borderRadius: "0.5rem",
                        color: spotifyColors.text,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = spotifyColors.bgLighter;
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.backgroundColor = spotifyColors.accent;
                      }}
                    >
                      <div style={{ fontWeight: "bold", marginBottom: "0.25rem" }}>
                        {playlist.name}
                      </div>
                      <div style={{ fontSize: "0.85rem", color: spotifyColors.textSecondary }}>
                        {playlist.song_count} song{playlist.song_count !== 1 ? "s" : ""}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => setShowNewPlaylistModal(true)}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    backgroundColor: spotifyColors.primary,
                    color: "white",
                    border: "none",
                    borderRadius: "0.25rem",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  Create New Playlist
                </button>
                <button
                  onClick={() => {
                    setShowAddToPlaylistModal(false);
                    setSongToAdd(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "0.75rem",
                    backgroundColor: spotifyColors.bgLighter,
                    color: spotifyColors.text,
                    border: "none",
                    borderRadius: "0.25rem",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {playlists.length === 0 ? (
          <p style={{ color: spotifyColors.textSecondary }}>No playlists yet. Create one!</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
            {playlists.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedPlaylist(p)}
                style={{
                  padding: "1.5rem",
                  backgroundColor: spotifyColors.bgLight,
                  borderRadius: "0.75rem",
                  cursor: "pointer",
                  transition: "all 0.3s",
                  borderLeft: `3px solid ${spotifyColors.primary}`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = spotifyColors.bgLighter;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = spotifyColors.bgLight;
                }}
              >
                <div style={{ fontWeight: "bold", fontSize: "1.1rem", marginBottom: "0.5rem" }}>
                  {p.name}
                </div>
                <div style={{ fontSize: "0.85rem", color: spotifyColors.textSecondary }}>
                  {p.song_count} song{p.song_count !== 1 ? "s" : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSettingsView = () => (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ marginBottom: "1.5rem" }}>Settings</h1>
      <div style={{ display: "grid", gap: "0.8rem", maxWidth: "480px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem", backgroundColor: spotifyColors.bgLight, borderRadius: "0.65rem" }}>
          <span>Play Preview on Hover</span>
          <input
            type="checkbox"
            checked={playPreviewOnHover}
            onChange={(e) => setPlayPreviewOnHover(e.target.checked)}
          />
        </div>
      </div>
    </div>
  );

  const renderMetadataView = () => (
    <div style={{ padding: "2rem" }}>
      <h1 style={{ marginBottom: "1.5rem" }}>Metadata Editor</h1>
      <p style={{ marginBottom: "1rem", color: spotifyColors.textSecondary }}>
        Edit year and duration on the server, and upload custom album art per song.
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          backgroundColor: spotifyColors.bgLight,
          borderRadius: "2rem",
          paddingLeft: "1rem",
          gap: "0.5rem",
          marginBottom: "1rem",
          maxWidth: "420px",
        }}
      >
        <IoSearchOutline size={18} color={spotifyColors.textSecondary} />
        <input
          type="text"
          placeholder="Search songs in metadata..."
          value={metadataSearchQuery}
          onChange={(e) => setMetadataSearchQuery(e.target.value)}
          style={{
            flex: 1,
            backgroundColor: "transparent",
            border: "none",
            padding: "0.75rem",
            color: spotifyColors.text,
            outline: "none",
          }}
        />
      </div>
      <div style={{ display: "grid", gap: "0.65rem" }}>
        {songs
          .filter((song) => {
            const q = metadataSearchQuery.trim().toLowerCase();
            if (!q) return true;
            return (
              cleanTitle(song.title).toLowerCase().includes(q) ||
              song.artist.toLowerCase().includes(q)
            );
          })
          .map((song) => {
          const draft = songMetadataDrafts[song.id] || {
            year: song.year != null ? String(song.year) : "",
            duration: song.duration != null ? String(song.duration) : "",
          };
          return (
            <div
              key={song.id}
              style={{
                padding: "0.75rem",
                backgroundColor: spotifyColors.bgLight,
                borderRadius: "0.5rem",
                display: "grid",
                gridTemplateColumns: "64px 1fr 120px 120px 120px 160px",
                gap: "0.75rem",
                alignItems: "center",
              }}
            >
              <div style={{ textAlign: "left" }}>
                <img
                  src={albumArtUrls[song.id] || `data:image/svg+xml,${encodeURIComponent(`
                    <svg width="56" height="56" xmlns="http://www.w3.org/2000/svg">
                      <rect width="56" height="56" fill="#282828"/>
                      <text x="28" y="35" text-anchor="middle" font-family="Arial" font-size="24" fill="#666">♪</text>
                    </svg>
                  `)}`}
                  alt={`${song.title} artwork`}
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "6px",
                    objectFit: "cover",
                    border: `1px solid ${spotifyColors.bgLighter}`,
                    display: "block",
                    margin: "0 0 0.25rem 0",
                  }}
                />
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: "bold", color: spotifyColors.text, textAlign: "left" }}>{cleanTitle(song.title)}</div>
                <div style={{ fontSize: "0.85rem", color: spotifyColors.textSecondary, textAlign: "left" }}>{song.artist}</div>
              </div>
              <input
                type="text"
                value={draft.year}
                onChange={(e) => updateMetadataDraft(song.id, "year", e.target.value)}
                placeholder="Year"
                style={{ padding: "0.45rem", borderRadius: "0.35rem", border: `1px solid ${spotifyColors.bgLighter}`, backgroundColor: spotifyColors.accent, color: spotifyColors.text, textAlign: "left" }}
              />
              <input
                type="number"
                min={0}
                step="any"
                value={draft.duration}
                onChange={(e) => updateMetadataDraft(song.id, "duration", e.target.value)}
                placeholder="Duration (s)"
                style={{ padding: "0.45rem", borderRadius: "0.35rem", border: `1px solid ${spotifyColors.bgLighter}`, backgroundColor: spotifyColors.accent, color: spotifyColors.text, textAlign: "left" }}
              />
              <button
                onClick={() => saveSongMetadata(song.id)}
                disabled={!!savingMetadataIds[song.id]}
                style={{
                  padding: "0.45rem 0.7rem",
                  borderRadius: "0.35rem",
                  border: "none",
                  backgroundColor: spotifyColors.primary,
                  color: "#fff",
                  cursor: savingMetadataIds[song.id] ? "not-allowed" : "pointer",
                  opacity: savingMetadataIds[song.id] ? 0.75 : 1,
                }}
              >
                {savingMetadataIds[song.id] ? "Saving..." : "Save"}
              </button>
              <label
                style={{
                  padding: "0.45rem 0.7rem",
                  borderRadius: "0.35rem",
                  border: `1px solid ${spotifyColors.bgLighter}`,
                  backgroundColor: spotifyColors.accent,
                  color: spotifyColors.text,
                  cursor: uploadingArtworkIds[song.id] ? "not-allowed" : "pointer",
                  opacity: uploadingArtworkIds[song.id] ? 0.75 : 1,
                  textAlign: "left",
                  fontSize: "0.85rem",
                }}
              >
                {uploadingArtworkIds[song.id] ? "Uploading..." : "Upload Art"}
                <input
                  type="file"
                  accept="image/*"
                  disabled={!!uploadingArtworkIds[song.id]}
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      uploadSongArtwork(song.id, file);
                    }
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );


  const renderNowPlayingView = () => (
    <div
      style={{
        padding: "2rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100%",
      }}
    >
      {currentSong ? (
        <>
          <div
            style={{
              width: "300px",
              height: "300px",
              backgroundColor: spotifyColors.bgLight,
              borderRadius: "1rem",
              marginBottom: "2rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
            }}
          >
            <img
              src={albumArtUrls[currentSong.id] || `data:image/svg+xml,${encodeURIComponent(`
                <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
                  <rect width="300" height="300" fill="#282828"/>
                  <text x="150" y="170" text-anchor="middle" font-family="Arial" font-size="80" fill="#666">♪</text>
                </svg>
              `)}`}
              alt={`${currentSong.title} album art`}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
              onError={(e) => {
                // Fallback to placeholder if image fails to load
                const target = e.target as HTMLImageElement;
                target.src = `data:image/svg+xml,${encodeURIComponent(`
                  <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
                    <rect width="300" height="300" fill="#282828"/>
                    <text x="150" y="170" text-anchor="middle" font-family="Arial" font-size="80" fill="#666">♪</text>
                  </svg>
                `)}`;
              }}
            />
          </div>
          <h1 style={{ textAlign: "center", marginBottom: "0.5rem" }}>{cleanTitle(currentSong.title)}</h1>
          <p style={{ textAlign: "center", color: spotifyColors.textSecondary, marginBottom: "2rem", fontSize: "1.1rem" }}>
            {currentSong.artist}
          </p>

          <button
            onClick={() => setShowLyrics(!showLyrics)}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: spotifyColors.primary,
              color: "white",
              border: "none",
              borderRadius: "2rem",
              cursor: "pointer",
              marginBottom: "2rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <IoMicOutline size={18} /> {showLyrics ? "Hide" : "Show"} Lyrics
          </button>

          {showLyrics && (
            <div
              style={{
                width: "100%",
                maxWidth: "600px",
                padding: "1.5rem",
                backgroundColor: spotifyColors.bgLight,
                borderRadius: "0.75rem",
                maxHeight: "400px",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                lineHeight: "1.6",
                color: spotifyColors.textSecondary,
              }}
            >
              {generateMockLyrics(currentSong.title)}
            </div>
          )}
        </>
      ) : (
        <p>Select a song to play</p>
      )}
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        backgroundColor: spotifyColors.bg,
        color: spotifyColors.text,
        fontFamily: "System, -apple-system, sans-serif",
      }}
    >
      {/* SIDEBAR */}
      <div
        style={{
          width: "250px",
          backgroundColor: spotifyColors.accent,
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          borderRight: `1px solid ${spotifyColors.bgLight}`,
        }}
      >
        <div
          style={{
            fontSize: "1.8rem",
            fontWeight: "bold",
            marginBottom: "2rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            color: spotifyColors.primary,
          }}
        >
          <IoMusicalNotesOutline size={28} /> Resync
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
          {[
            { id: "library" as const, label: "Library", icon: IoLibraryOutline },
            { id: "now-playing" as const, label: "Now Playing", icon: IoPlayOutline },
            { id: "downloads" as const, label: "Downloads", icon: IoCodeDownloadOutline },
            { id: "recommendations" as const, label: "Recommendations", icon: IoStar },
            { id: "playlists" as const, label: "Playlists", icon: IoSwapVerticalOutline },
            { id: "statistics" as const, label: "Statistics", icon: IoChevronDownOutline },
            { id: "metadata" as const, label: "Metadata", icon: IoMicOutline },
            { id: "settings" as const, label: "Settings", icon: IoSettingsOutline },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              style={{
                padding: "0.75rem 1rem",
                backgroundColor: view === id ? spotifyColors.primary : "transparent",
                color: view === id ? "#000" : spotifyColors.text,
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                fontWeight: view === id ? "bold" : "normal",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                if (view !== id) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = spotifyColors.bgLight;
                }
              }}
              onMouseLeave={(e) => {
                if (view !== id) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                }
              }}
            >
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", paddingBottom: "120px" }}>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {view === "library" && renderLibraryView()}
          {view === "downloads" && renderDownloadsView()}
          {view === "recommendations" && renderRecommendationsView()}
          {view === "statistics" && renderStatisticsView()}
          {view === "playlists" && renderPlaylistsView()}
          {view === "now-playing" && renderNowPlayingView()}
          {view === "settings" && renderSettingsView()}
          {view === "metadata" && renderMetadataView()}
        </div>

        {/* PLAYER BAR */}
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            width: "100%",
            zIndex: 999,
            backgroundColor: spotifyColors.bgLight,
            borderTop: `1px solid ${spotifyColors.bgLighter}`,
            padding: "0.6rem 1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "nowrap",
            gap: "0.8rem",
            boxShadow: "0 -2px 12px rgba(0,0,0,0.2)",
            maxWidth: "100vw",
            overflow: "hidden",
            boxSizing: "border-box",
          }}
        >
          {currentSong ? (
            <>
              {/* Current Song Info */}
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", minWidth: "250px" }}>
            <div
              style={{
                width: "56px",
                height: "56px",
                backgroundColor: spotifyColors.accent,
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              <img
                src={albumArtUrls[currentSong.id] || `data:image/svg+xml,${encodeURIComponent(`
                  <svg width="56" height="56" xmlns="http://www.w3.org/2000/svg">
                    <rect width="56" height="56" fill="#282828"/>
                    <text x="28" y="35" text-anchor="middle" font-family="Arial" font-size="24" fill="#666">♪</text>
                  </svg>
                `)}`}
                alt={`${currentSong.title} thumbnail`}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = `data:image/svg+xml,${encodeURIComponent(`
                    <svg width="56" height="56" xmlns="http://www.w3.org/2000/svg">
                      <rect width="56" height="56" fill="#404040"/>
                      <text x="28" y="36" text-anchor="middle" font-family="Arial" font-size="24" fill="#666">♪</text>
                    </svg>
                  `)}`;
                }}
              />
            </div>
            
            <div style={{ minWidth: 0 }}>
              <div style={{ 
                fontWeight: "500", 
                fontSize: "0.9rem",
                color: spotifyColors.text,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}>
                {cleanTitle(currentSong.title)}
              </div>
              <div style={{ 
                fontSize: "0.8rem", 
                color: spotifyColors.textSecondary,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}>
                {currentSong.artist}
              </div>
            </div>
          </div>

          {/* Player Controls */}
          <div style={{ flex: "0 1 520px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.5rem", maxWidth: "520px", minWidth: "280px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", flexWrap: "nowrap", width: "100%", minWidth: 0 }}>
              <button
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                style={{
                  padding: "0.5rem",
                  backgroundColor: "transparent",
                  color: spotifyColors.text,
                  border: "none",
                  cursor: "pointer",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "32px",
                  height: "32px",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = spotifyColors.bgLighter;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                }}
              >
                <IoPlaySkipBackOutline size={16} />
              </button>

              <button
                onClick={() => setIsPlaying(!isPlaying)}
                style={{
                  padding: "0.75rem",
                  backgroundColor: "white",
                  color: "#000",
                  border: "none",
                  borderRadius: "50%",
                  cursor: "pointer",
                  fontWeight: "bold",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "48px",
                  height: "48px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "scale(1.05)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                }}
              >
                {isPlaying ? (
                  <IoPauseOutline size={20} />
                ) : (
                  <IoPlayOutline size={20} />
                )}
              </button>

              <button
                onClick={() => setCurrentIndex(Math.min(songs.length - 1, currentIndex + 1))}
                style={{
                  padding: "0.5rem",
                  backgroundColor: "transparent",
                  color: spotifyColors.text,
                  border: "none",
                  cursor: "pointer",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "32px",
                  height: "32px",
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = spotifyColors.bgLighter;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                }}
              >
                <IoPlaySkipForwardOutline size={16} />
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "1rem", width: "100%", maxWidth: "400px" }}>
              <span style={{ fontSize: "0.75rem", color: spotifyColors.textSecondary, minWidth: "35px" }}>
                {formatTime(currentTime)}
              </span>

              <div style={{ position: "relative", flex: 1 }}>
                {(hoverSeekPercent !== null || isSeeking) && duration > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      left: `${isSeeking ? seekValue : hoverSeekPercent ?? progress}%`,
                      top: "-34px",
                      transform: "translateX(-50%)",
                      backgroundColor: "#282828",
                      color: "#ffffff",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      padding: "0.25rem 0.5rem",
                      borderRadius: "0.3rem",
                      lineHeight: 1.1,
                      pointerEvents: "none",
                      whiteSpace: "nowrap",
                      zIndex: 3,
                    }}
                  >
                    {formatTime((((isSeeking ? seekValue : hoverSeekPercent ?? progress) / 100) * duration) || 0)}
                  </div>
                )}

                <input
                  className="player-seek"
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={isSeeking ? seekValue : progress}
                  onMouseEnter={(e) => setHoverSeekPercent(getPercentFromPointer(e))}
                  onMouseMove={(e) => setHoverSeekPercent(getPercentFromPointer(e))}
                  onMouseLeave={() => {
                    if (!isSeeking) setHoverSeekPercent(null);
                  }}
                  onMouseDown={(e) => {
                    const percent = getPercentFromPointer(e);
                    setSeekStartProgress(progress);
                    setHoverSeekPercent(percent);
                    setSeekValue(percent);
                    setIsSeeking(true);
                    seekToPercent(percent);
                  }}
                  onTouchStart={() => {
                    setSeekStartProgress(progress);
                    setIsSeeking(true);
                  }}
                  onChange={(e) => {
                    const percent = parseFloat(e.target.value);
                    setSeekValue(percent);
                    setHoverSeekPercent(percent);
                    seekToPercent(percent);
                  }}
                  onMouseUp={() => {
                    setIsSeeking(false);
                    setSeekStartProgress(null);
                  }}
                  onTouchEnd={() => {
                    setIsSeeking(false);
                    setSeekStartProgress(null);
                  }}
                  onKeyUp={() => {
                    setIsSeeking(false);
                    setSeekStartProgress(null);
                  }}
                  style={{
                    width: "100%",
                    cursor: "pointer",
                    height: "4px",
                    background: getSeekBarBackground(),
                  }}
                />
              </div>
              
              <span style={{ fontSize: "0.75rem", color: spotifyColors.textSecondary, minWidth: "35px" }}>
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Volume Control */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: "150px", justifyContent: "flex-end" }}>
            <IoVolumeHighOutline size={16} style={{ color: spotifyColors.textSecondary }} />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setVolume(v);
                if (audioRef.current) audioRef.current.volume = v;
              }}
              style={{ 
                width: "100px",
                accentColor: spotifyColors.primary,
              }}
            />
          </div>
            </>
          ) : (
            <p style={{ color: spotifyColors.textSecondary, margin: 0 }}>Select a song to play</p>
          )}
        </div>
      </div>

      <audio
        ref={audioRef}
        src={currentSong ? `http://localhost:8000/stream/${currentSong.id}` : undefined}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />
    </div>
  );
}

export default App;
