import { useState, useEffect, useRef, useCallback } from "react";

const API_BASE = "http://localhost:8000";

const GENRE_COLORS = {
  Action: { bg: "#3b1a08", text: "#f97316" },
  Adventure: { bg: "#1a2e08", text: "#84cc16" },
  Animation: { bg: "#1a1240", text: "#818cf8" },
  Comedy: { bg: "#2d1a08", text: "#fb923c" },
  Crime: { bg: "#1a0808", text: "#f87171" },
  Documentary: { bg: "#082d2d", text: "#2dd4bf" },
  Drama: { bg: "#0d1a2e", text: "#60a5fa" },
  Fantasy: { bg: "#1e0d2e", text: "#c084fc" },
  Horror: { bg: "#1a0808", text: "#f87171" },
  Mystery: { bg: "#0d1428", text: "#7dd3fc" },
  Romance: { bg: "#2e0d1a", text: "#f472b6" },
  "Sci-Fi": { bg: "#082028", text: "#67e8f9" },
  Thriller: { bg: "#1a1408", text: "#fbbf24" },
  Western: { bg: "#2d1a00", text: "#d97706" },
};

const getGenreStyle = (genre) =>
  GENRE_COLORS[genre] || { bg: "#1a1a2e", text: "#94a3b8" };

function parseGenres(genreStr) {
  if (!genreStr) return [];
  try {
    return JSON.parse(
      genreStr
        .replace(/'/g, '"')
        .replace(/\bNone\b/g, "null")
    );
  } catch {
    return genreStr
      .split(/[,|]/)
      .map((g) => g.trim())
      .filter(Boolean);
  }
}

function StarRating({ score }) {
  const pct = Math.round(score * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: `2px solid ${pct > 60 ? "#f59e0b" : pct > 35 ? "#60a5fa" : "#475569"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          color: pct > 60 ? "#f59e0b" : pct > 35 ? "#60a5fa" : "#94a3b8",
          fontFamily: "var(--font-mono, monospace)",
          flexShrink: 0,
        }}
      >
        {pct}%
      </div>
    </div>
  );
}

function GenreBadge({ genre }) {
  const style = getGenreStyle(genre);
  return (
    <span
      style={{
        background: style.bg,
        color: style.text,
        fontSize: 11,
        fontWeight: 600,
        padding: "2px 8px",
        borderRadius: 999,
        letterSpacing: "0.04em",
        border: `1px solid ${style.text}22`,
        whiteSpace: "nowrap",
      }}
    >
      {genre}
    </span>
  );
}

function MovieCard({ movie, isSelected, onClick, animationDelay = 0 }) {
  const genres = parseGenres(movie.genres);
  const [imgError, setImgError] = useState(false);

  return (
    <div
      onClick={onClick}
      style={{
        background: isSelected ? "#1e293b" : "#0f172a",
        border: isSelected ? "1px solid #f59e0b44" : "1px solid #1e293b",
        borderRadius: 16,
        padding: 0,
        cursor: "pointer",
        transition: "all 0.25s ease",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        animationDelay: `${animationDelay}ms`,
        animation: "fadeSlideUp 0.4s ease both",
        boxShadow: isSelected ? "0 0 0 1px #f59e0b44, 0 8px 32px #00000066" : "0 2px 8px #00000044",
      }}
    >
      <div
        style={{
          position: "relative",
          paddingTop: "150%",
          background: "#1e293b",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {movie.poster && movie.poster !== "N/A" && !imgError ? (
          <img
            src={movie.poster}
            alt={movie.title}
            onError={() => setImgError(true)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform 0.4s ease",
            }}
          />
        ) : (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              color: "#334155",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="20" height="20" rx="2.18" />
              <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5" />
            </svg>
            <span style={{ fontSize: 11, color: "#475569" }}>No poster</span>
          </div>
        )}
        {isSelected && (
          <div
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              background: "#f59e0b",
              borderRadius: "50%",
              width: 22,
              height: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
        )}
      </div>
      <div style={{ padding: "12px 14px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 600,
            color: "#f1f5f9",
            lineHeight: 1.3,
            letterSpacing: "-0.01em",
          }}
        >
          {movie.title}
        </p>
        {genres.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {genres.slice(0, 2).map((g) => (
              <GenreBadge key={g} genre={g} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RecommendationCard({ movie, score, index }) {
  const genres = parseGenres(movie.genres);
  const [imgError, setImgError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const plot = movie.plot || movie.overview || "";

  return (
    <div
      style={{
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: 16,
        overflow: "hidden",
        animation: "fadeSlideUp 0.4s ease both",
        animationDelay: `${index * 80}ms`,
        transition: "border-color 0.2s",
      }}
    >
      <div style={{ display: "flex", gap: 0 }}>
        <div
          style={{
            width: 90,
            flexShrink: 0,
            background: "#1e293b",
            position: "relative",
            minHeight: 130,
          }}
        >
          {movie.poster && movie.poster !== "N/A" && !imgError ? (
            <img
              src={movie.poster}
              alt={movie.title}
              onError={() => setImgError(true)}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", minHeight: 130 }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                minHeight: 130,
                color: "#334155",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="2" width="20" height="20" rx="2.18" />
                <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5" />
              </svg>
            </div>
          )}
          <div
            style={{
              position: "absolute",
              top: 6,
              left: 6,
              background: "#0f172acc",
              borderRadius: 6,
              width: 22,
              height: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: "#64748b",
            }}
          >
            {index + 1}
          </div>
        </div>
        <div style={{ flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#f1f5f9", lineHeight: 1.3 }}>
              {movie.title}
            </p>
            {score !== undefined && <StarRating score={score} />}
          </div>
          {genres.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {genres.map((g) => (
                <GenreBadge key={g} genre={g} />
              ))}
            </div>
          )}
          {plot && (
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "#64748b",
                  lineHeight: 1.6,
                  display: "-webkit-box",
                  WebkitLineClamp: expanded ? "none" : 3,
                  WebkitBoxOrient: "vertical",
                  overflow: expanded ? "visible" : "hidden",
                }}
              >
                {plot}
              </p>
              {plot.length > 180 && (
                <button
                  onClick={() => setExpanded((e) => !e)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#f59e0b",
                    fontSize: 12,
                    cursor: "pointer",
                    padding: "4px 0 0",
                    fontWeight: 600,
                  }}
                >
                  {expanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchBar({ value, onChange, onClear, placeholder }) {
  const inputRef = useRef(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div
        style={{
          position: "absolute",
          left: 14,
          top: "50%",
          transform: "translateY(-50%)",
          color: "#475569",
          pointerEvents: "none",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "Search movies..."}
        style={{
          width: "100%",
          background: "#0f172a",
          border: "1px solid #334155",
          borderRadius: 12,
          padding: "12px 42px",
          color: "#f1f5f9",
          fontSize: 15,
          outline: "none",
          boxSizing: "border-box",
          caretColor: "#f59e0b",
          transition: "border-color 0.2s",
        }}
        onFocus={(e) => (e.target.style.borderColor = "#f59e0b66")}
        onBlur={(e) => (e.target.style.borderColor = "#334155")}
      />
      {value && (
        <button
          onClick={onClear}
          style={{
            position: "absolute",
            right: 12,
            top: "50%",
            transform: "translateY(-50%)",
            background: "#1e293b",
            border: "none",
            borderRadius: "50%",
            width: 22,
            height: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#64748b",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

export default function MovieRecommender() {
  const [query, setQuery] = useState("");
  const [allMovies, setAllMovies] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [error, setError] = useState(null);
  const [topN, setTopN] = useState(5);
  const debounceRef = useRef(null);

  useEffect(() => {
    fetch(`${API_BASE}/movies`)
      .then((r) => r.json())
      .then((data) => {
        setAllMovies(data.movies || []);
        setDataReady(true);
      })
      .catch(() => {
        setDataReady(true);
        setError("Could not connect to backend. Make sure the FastAPI server is running.");
      });
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setFiltered([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      const q = query.toLowerCase();
      setFiltered(allMovies.filter((m) => m.toLowerCase().includes(q)).slice(0, 40));
    }, 150);
  }, [query, allMovies]);

  const handleSelect = useCallback(
    async (title) => {
      setSelected(title);
      setQuery(title);
      setFiltered([]);
      setRecommendations([]);
      setError(null);
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/recommend?movie=${encodeURIComponent(title)}&top_n=${topN}`
        );
        if (!res.ok) throw new Error("Movie not found or server error");
        const data = await res.json();
        setRecommendations(data.recommendations || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [topN]
  );

  const handleClear = () => {
    setQuery("");
    setSelected(null);
    setRecommendations([]);
    setFiltered([]);
    setError(null);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { background: #020617; }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        ::placeholder { color: #475569; }
        input::selection { background: #f59e0b44; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
        .movie-grid-item:hover { transform: translateY(-2px); }
        .rec-card:hover { border-color: #334155 !important; }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "#020617",
          fontFamily: "'DM Sans', sans-serif",
          color: "#f1f5f9",
          padding: "0 0 80px",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 20px" }}>

          {/* Header */}
          <div style={{ textAlign: "center", padding: "52px 0 40px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#f59e0b12",
                border: "1px solid #f59e0b22",
                borderRadius: 999,
                padding: "4px 14px 4px 10px",
                marginBottom: 20,
              }}
            >
              <span style={{ fontSize: 14 }}>🎬</span>
              <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 600, letterSpacing: "0.08em" }}>
                POWERED BY TF-IDF + COSINE SIMILARITY
              </span>
            </div>
            <h1
              style={{
                margin: "0 0 12px",
                fontSize: 52,
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontWeight: 400,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                color: "#f8fafc",
              }}
            >
              Find your next
              <span style={{ color: "#f59e0b", fontStyle: "italic" }}> favourite</span> film
            </h1>
            <p style={{ margin: 0, fontSize: 16, color: "#64748b", lineHeight: 1.6 }}>
              Select a movie you love and discover similar ones based on plot and genre
            </p>
          </div>

          {/* Search */}
          <div style={{ maxWidth: 560, margin: "0 auto 40px", position: "relative" }}>
            <SearchBar
              value={query}
              onChange={setQuery}
              onClear={handleClear}
              placeholder="Search for a movie..."
            />
            {filtered.length > 0 && !selected && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  right: 0,
                  background: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: 12,
                  overflow: "auto",
                  maxHeight: 280,
                  zIndex: 50,
                  boxShadow: "0 16px 48px #000000aa",
                }}
              >
                {filtered.map((title, i) => (
                  <div
                    key={title}
                    onClick={() => handleSelect(title)}
                    style={{
                      padding: "10px 16px",
                      cursor: "pointer",
                      fontSize: 14,
                      color: "#cbd5e1",
                      borderBottom: i < filtered.length - 1 ? "1px solid #0f172a" : "none",
                      transition: "background 0.1s",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#1e293b")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2">
                      <rect x="2" y="2" width="20" height="20" rx="2.18" />
                      <path d="M7 2v20M17 2v20M2 12h20" />
                    </svg>
                    {title}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Controls */}
          {selected && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
                marginBottom: 32,
                animation: "fadeSlideUp 0.3s ease both",
              }}
            >
              <span style={{ fontSize: 13, color: "#64748b" }}>Recommendations:</span>
              {[3, 5, 8, 10].map((n) => (
                <button
                  key={n}
                  onClick={() => {
                    setTopN(n);
                    if (selected) handleSelect(selected);
                  }}
                  style={{
                    background: topN === n ? "#f59e0b" : "#1e293b",
                    color: topN === n ? "#000" : "#94a3b8",
                    border: "1px solid",
                    borderColor: topN === n ? "#f59e0b" : "#334155",
                    borderRadius: 8,
                    padding: "4px 14px",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 600,
                    transition: "all 0.15s",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              style={{
                maxWidth: 560,
                margin: "0 auto 32px",
                background: "#1a0a0a",
                border: "1px solid #7f1d1d44",
                borderRadius: 12,
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                animation: "fadeSlideUp 0.3s ease both",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <span style={{ fontSize: 14, color: "#fca5a5" }}>{error}</span>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: "center", padding: "48px 0" }}>
              <div
                style={{
                  display: "inline-block",
                  width: 36,
                  height: 36,
                  border: "2px solid #1e293b",
                  borderTopColor: "#f59e0b",
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                }}
              />
              <p style={{ color: "#475569", fontSize: 14, marginTop: 16 }}>
                Finding similar movies...
              </p>
            </div>
          )}

          {/* Recommendations */}
          {!loading && recommendations.length > 0 && (
            <div style={{ animation: "fadeSlideUp 0.4s ease both" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <div style={{ flex: 1, height: 1, background: "#1e293b" }} />
                <span style={{ fontSize: 13, color: "#475569", whiteSpace: "nowrap" }}>
                  {recommendations.length} similar to <strong style={{ color: "#94a3b8" }}>{selected}</strong>
                </span>
                <div style={{ flex: 1, height: 1, background: "#1e293b" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {recommendations.map((rec, i) => (
                  <RecommendationCard
                    key={rec.title}
                    movie={rec}
                    score={rec.score}
                    index={i}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !selected && !error && dataReady && (
            <div style={{ textAlign: "center", padding: "32px 0 0", color: "#334155" }}>
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1"
                style={{ margin: "0 auto 16px", display: "block", opacity: 0.4 }}
              >
                <rect x="2" y="2" width="20" height="20" rx="2.18" />
                <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5" />
              </svg>
              <p style={{ fontSize: 15, margin: 0 }}>
                Search for a movie above to get started
              </p>
              <p style={{ fontSize: 13, margin: "6px 0 0", color: "#1e293b" }}>
                {allMovies.length > 0
                  ? `${allMovies.length.toLocaleString()} movies loaded`
                  : "Loading movie list..."}
              </p>
            </div>
          )}

          {!loading && selected && recommendations.length === 0 && !error && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#475569" }}>
              <p style={{ fontSize: 15 }}>No recommendations found for this title.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
