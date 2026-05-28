"""
FastAPI backend for the Movie Recommender.
Replaces the Streamlit app. Run with:
    pip install fastapi uvicorn
    uvicorn api:app --reload --port 8000
"""
import joblib
import logging
from functools import lru_cache

import requests
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("api.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)

app = FastAPI(title="Movie Recommender API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to your frontend domain in production
    allow_methods=["GET"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Load pre-processed data once at startup
# ---------------------------------------------------------------------------
logging.info("Loading pre-processed data...")
try:
    df = joblib.load("df_cleaned.pkl")
    cosine_sim = joblib.load("cosine_sim.pkl")
    logging.info("Data loaded — %d movies in index.", len(df))
except Exception as e:
    logging.critical("Failed to load .pkl files: %s", e)
    raise


# ---------------------------------------------------------------------------
# OMDB helper (cached per title to avoid redundant HTTP calls)
# ---------------------------------------------------------------------------
def _load_api_key() -> str:
    import json, pathlib
    cfg_path = pathlib.Path("config.json")
    if cfg_path.exists():
        return json.loads(cfg_path.read_text()).get("OMDB_API_KEY", "")
    return ""


OMDB_KEY = _load_api_key()


@lru_cache(maxsize=512)
def fetch_omdb(title: str) -> dict:
    """Return {'plot': ..., 'poster': ...} for *title*. Cached in-process."""
    if not OMDB_KEY:
        return {"plot": "N/A", "poster": "N/A"}
    try:
        res = requests.get(
            "http://www.omdbapi.com/",
            params={"t": title, "plot": "full", "apikey": OMDB_KEY},
            timeout=4,
        ).json()
        if res.get("Response") == "True":
            return {
                "plot": res.get("Plot", "N/A"),
                "poster": res.get("Poster", "N/A"),
            }
    except Exception as exc:
        logging.warning("OMDB lookup failed for '%s': %s", title, exc)
    return {"plot": "N/A", "poster": "N/A"}


# ---------------------------------------------------------------------------
# Pydantic response models
# ---------------------------------------------------------------------------
class RecommendedMovie(BaseModel):
    title: str
    genres: str
    score: float
    plot: str
    poster: str


class RecommendResponse(BaseModel):
    query: str
    recommendations: list[RecommendedMovie]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/movies", summary="List all movie titles")
def list_movies():
    """Returns the full sorted list of movie titles for the search box."""
    titles = sorted(df["title"].dropna().unique().tolist())
    return {"movies": titles, "count": len(titles)}


@app.get("/recommend", response_model=RecommendResponse, summary="Get recommendations")
def recommend(
    movie: str = Query(..., description="Exact movie title (case-insensitive)"),
    top_n: int = Query(5, ge=1, le=20, description="Number of recommendations"),
):
    """
    Returns the top-N most similar movies for *movie*, enriched with
    OMDB plot summaries and poster URLs.
    """
    idx_series = df[df["title"].str.lower() == movie.strip().lower()].index
    if idx_series.empty:
        raise HTTPException(status_code=404, detail=f"Movie '{movie}' not found in dataset.")

    idx = idx_series[0]
    sim_scores = sorted(
        enumerate(cosine_sim[idx]),
        key=lambda x: x[1],
        reverse=True,
    )[1 : top_n + 1]

    results = []
    for rank_idx, score in sim_scores:
        row = df.iloc[rank_idx]
        title = row["title"]
        genres = str(row.get("genres", ""))
        omdb = fetch_omdb(title)

        # Use overview from dataset if OMDB plot not available
        plot = omdb["plot"]
        if plot == "N/A" and "overview" in df.columns:
            plot = str(row.get("overview", "N/A"))

        results.append(
            RecommendedMovie(
                title=title,
                genres=genres,
                score=round(float(score), 4),
                plot=plot,
                poster=omdb["poster"],
            )
        )

    logging.info("Served %d recommendations for '%s'.", len(results), movie)
    return RecommendResponse(query=movie, recommendations=results)


@app.get("/health")
def health():
    return {"status": "ok", "movies_loaded": len(df)}
