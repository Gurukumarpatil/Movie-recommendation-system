from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
import requests
from functools import lru_cache

app = FastAPI()

# CORS (simple + working)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔐 PUT YOUR KEY HERE
TMDB_API_KEY = "22f5088c921181a963a37215b42a7751"

# Load data & Precompute (Fixes performance and quality issues)
movies = pd.read_csv("data/raw/movies.csv")
ratings = pd.read_csv("data/raw/ratings.csv")

# 1. Filter to popular movies (e.g. >= 20 ratings) to reduce noise and speed up calculation
movie_counts = ratings['movieId'].value_counts()
popular_movies = movie_counts[movie_counts >= 20].index
ratings_pop = ratings[ratings['movieId'].isin(popular_movies)]

# 2. Precompute the similarity matrix AT STARTUP instead of on-the-fly
movie_matrix = ratings_pop.pivot_table(index="userId", columns="movieId", values="rating")

# Dual-threshold correlation matrices for better quality!
# Strict: Requires 50 overlapping users (Perfect for blockbusters like Toy Story)
corr_matrix_strict = movie_matrix.corr(min_periods=50)
# Loose: Requires 15 overlapping users (Fallback for niche movies)
corr_matrix_loose = movie_matrix.corr(min_periods=15)

movie_titles = dict(zip(movies["title"], movies["movieId"]))
movie_ids = dict(zip(movies["movieId"], movies["title"]))


# 🔍 SEARCH
@app.get("/search")
async def search_movies(q: str):
    # async def avoids threadpool overhead for simple, non-IO bound operations
    return [t for t in movie_titles.keys() if q.lower() in t.lower()][:10]


# 🎬 RECOMMEND
@app.get("/recommend")
async def recommend(movie: str, user_id: int = 1, top_n: int = 5):
    if movie not in movie_titles:
        return {"recommendations": []}

    movie_id = movie_titles[movie]

    # If the movie doesn't have enough data (not in our precomputed popular matrix)
    if movie_id not in movie_matrix.columns:
        return {"recommendations": []}

    # First try the strict matrix (high quality, eliminates obscure matches)
    similarities = corr_matrix_strict[movie_id].dropna().sort_values(ascending=False)
    
    # If not enough matches from strict matrix, fallback to loose matrix
    # We check top_n + 1 because we will drop the movie itself
    if len(similarities) < top_n + 1:
        similarities = corr_matrix_loose[movie_id].dropna().sort_values(ascending=False)
    
    # Remove the movie itself from recommendations (correlation = 1.0)
    if movie_id in similarities:
        similarities = similarities.drop(movie_id)
        
    sim_df = similarities.head(top_n)
    recs = [movie_ids[mid] for mid in sim_df.index]

    return {"recommendations": recs}


# 🎥 ENHANCED DETAILS (For Premium UI)
@app.get("/poster")
@lru_cache(maxsize=1024)
def get_poster(title: str):
    clean_title = title.split("(")[0].strip()

    url = "https://api.themoviedb.org/3/search/movie"
    params = {
        "api_key": TMDB_API_KEY,
        "query": clean_title
    }

    try:
        # Use simple requests.get since this is a simple local app, but could be async httpx
        res = requests.get(url, params=params, timeout=5).json()

        if res.get("results"):
            m = res["results"][0]
            return {
                "poster": f"https://image.tmdb.org/t/p/w500{m.get('poster_path')}" if m.get('poster_path') else None,
                "backdrop": f"https://image.tmdb.org/t/p/w1280{m.get('backdrop_path')}" if m.get('backdrop_path') else None,
                "rating": m.get("vote_average", 0),
                "year": m.get("release_date", "")[:4] if m.get("release_date") else "N/A",
                "overview": m.get("overview", "")
            }
    except Exception:
        pass

    return {
        "poster": None,
        "backdrop": None,
        "rating": 0,
        "year": "N/A",
        "overview": "No synopsis available."
    }