"""
preprocess.py  —  v2
Improvements over v1:
  1. Weighted genre boost  — genre tokens are repeated N times so they pull
     more weight without a separate one-hot matrix.
  2. Better TF-IDF params — sublinear_tf, ngram_range=(1,2), higher max_features.
  3. Chunked cosine similarity — avoids OOM on large datasets.
  4. TruncatedSVD (LSA)    — optional dimensionality reduction for faster
     similarity on very large datasets (toggle APPLY_SVD below).
  5. Graceful column handling — works whether the CSV has 'keywords' or not.
  6. Normalised text cleaning — smarter than a single regex.
"""

import joblib
import logging
import re

import nltk
import numpy as np
import pandas as pd
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import normalize
import scipy.sparse as sp

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DATASET_PATH = "movies.csv"
GENRE_REPEAT = 3  # how many times to repeat genre tokens for extra weight
MAX_FEATURES = 10_000  # TF-IDF vocabulary size
APPLY_SVD = False  # set True for datasets > 20 k rows
SVD_COMPONENTS = 300  # only used when APPLY_SVD = True
CHUNK_SIZE = 2_000  # rows processed per cosine-similarity chunk

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("preprocess.log", encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# NLTK downloads
# ---------------------------------------------------------------------------
for resource in ("punkt", "punkt_tab", "stopwords", "wordnet", "omw-1.4"):
    nltk.download(resource, quiet=True)

STOP_WORDS = set(stopwords.words("english"))
lemmatizer = WordNetLemmatizer()


# ---------------------------------------------------------------------------
# Text cleaning
# ---------------------------------------------------------------------------
def clean_text(text: str) -> str:
    """
    Lower-case, strip noise, tokenise, remove stop words, lemmatise.
    Lemmatisation (ran→run, movies→movie) is more accurate than stemming and
    doesn't create non-words — this is the main quality upgrade over v1.
    """
    text = str(text)
    text = re.sub(r"http\S+", " ", text)  # strip URLs
    text = re.sub(r"[^a-zA-Z\s]", " ", text)  # keep only letters
    text = text.lower()
    tokens = word_tokenize(text)
    tokens = [
        lemmatizer.lemmatize(tok)
        for tok in tokens
        if tok not in STOP_WORDS and len(tok) > 2
    ]
    return " ".join(tokens)


# ---------------------------------------------------------------------------
# Genre helpers
# ---------------------------------------------------------------------------
def extract_genre_string(raw: str) -> str:
    """
    Handles both JSON-style ("[{'name': 'Action'}]") and plain ("Action|Crime")
    genre columns. Returns a space-separated string of genre names.
    """
    raw = str(raw)
    names = re.findall(r"'name':\s*'([^']+)'", raw)  # JSON-style
    if not names:
        names = [g.strip() for g in re.split(r"[,|]", raw) if g.strip()]
    return " ".join(names)


# ---------------------------------------------------------------------------
# Load dataset
# ---------------------------------------------------------------------------
log.info("Loading dataset from %s …", DATASET_PATH)
try:
    df = pd.read_csv(DATASET_PATH)
    log.info("Loaded %d rows, columns: %s", len(df), list(df.columns))
except Exception as exc:
    log.critical("Cannot load dataset: %s", exc)
    raise

REQUIRED = {"title", "overview"}
missing = REQUIRED - set(df.columns)
if missing:
    raise ValueError(f"Dataset is missing required columns: {missing}")

# Optional columns
HAS_KEYWORDS = "keywords" in df.columns
HAS_GENRES = "genres" in df.columns

df = df.dropna(subset=["title", "overview"]).reset_index(drop=True)
log.info("After dropping nulls: %d rows.", len(df))

# ---------------------------------------------------------------------------
# Build combined text
# ---------------------------------------------------------------------------
log.info("Building combined feature text …")

genre_series = (
    df["genres"].apply(extract_genre_string)
    if HAS_GENRES
    else pd.Series([""] * len(df))
)


def build_combined(row, genre_str):
    parts = [str(row.overview)]
    if HAS_KEYWORDS:
        kw = re.sub(r"[^a-zA-Z\s]", " ", str(getattr(row, "keywords", "")))
        parts.append(kw)
    if genre_str:
        parts.extend([genre_str] * GENRE_REPEAT)
    return " ".join(parts)


df["combined"] = [
    build_combined(row, gs) for row, gs in zip(df.itertuples(), genre_series)
]

# Store cleaned genre string for the API response
df["genres"] = genre_series

log.info("Cleaning text (lemmatisation) — this may take a minute …")
df["cleaned_text"] = df["combined"].apply(clean_text)
log.info("Text cleaning done.")

# ---------------------------------------------------------------------------
# TF-IDF vectorisation
# ---------------------------------------------------------------------------
log.info("Fitting TF-IDF (max_features=%d, bigrams) …", MAX_FEATURES)
tfidf = TfidfVectorizer(
    max_features=MAX_FEATURES,
    ngram_range=(1, 2),  # unigrams + bigrams capture phrases like "serial killer"
    sublinear_tf=True,  # log(1+tf) — prevents high-frequency terms dominating
    min_df=2,  # ignore terms that appear in only one movie
    strip_accents="unicode",
)
tfidf_matrix = tfidf.fit_transform(df["cleaned_text"])
log.info("TF-IDF matrix shape: %s", tfidf_matrix.shape)

# ---------------------------------------------------------------------------
# Optional SVD (Latent Semantic Analysis)
# ---------------------------------------------------------------------------
if APPLY_SVD:
    log.info("Applying TruncatedSVD → %d components …", SVD_COMPONENTS)
    svd = TruncatedSVD(n_components=SVD_COMPONENTS, random_state=42)
    feature_matrix = normalize(svd.fit_transform(tfidf_matrix))
    log.info("Explained variance: %.1f%%", svd.explained_variance_ratio_.sum() * 100)
else:
    feature_matrix = tfidf_matrix  # keep sparse

# ---------------------------------------------------------------------------
# Cosine similarity (chunked to avoid RAM spikes on large datasets)
# ---------------------------------------------------------------------------
n = feature_matrix.shape[0]
log.info("Computing cosine similarity for %d movies (chunk=%d) …", n, CHUNK_SIZE)

cosine_sim = np.zeros((n, n), dtype=np.float32)

for start in range(0, n, CHUNK_SIZE):
    end = min(start + CHUNK_SIZE, n)
    chunk = feature_matrix[start:end]
    if sp.issparse(chunk):
        chunk = chunk  # cosine_similarity handles sparse input natively
    sims = cosine_similarity(chunk, feature_matrix)
    cosine_sim[start:end] = sims
    log.info("  Chunk %d–%d done.", start, end - 1)

log.info("Cosine similarity matrix shape: %s", cosine_sim.shape)

# ---------------------------------------------------------------------------
# Persist
# ---------------------------------------------------------------------------
log.info("Saving artefacts …")
joblib.dump(df, "df_cleaned.pkl")
joblib.dump(tfidf_matrix, "tfidf_matrix.pkl")
joblib.dump(tfidf, "tfidf_vectorizer.pkl")
joblib.dump(cosine_sim, "cosine_sim.pkl")

log.info("All artefacts saved. Preprocessing complete.")
