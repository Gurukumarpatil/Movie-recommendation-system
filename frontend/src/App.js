import { useState, useRef, useEffect } from "react";
import axios from "axios";
import "./App.css";

function App() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const searchTimeout = useRef(null);

  // 🌍 Search API
  const searchMovies = (text) => {
    setQuery(text);
    setIsDropdownOpen(true);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (text.length < 2) {
      setSuggestions([]);
      return;
    }

    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await axios.get("http://127.0.0.1:8000/search", { params: { q: text } });
        setSuggestions(res.data);
      } catch (err) {
        console.error(err);
      }
    }, 300);
  };

  // 🎬 Fetch full metadata
  const fetchMovieDetails = async (title) => {
    try {
      const res = await axios.get("http://127.0.0.1:8000/poster", { params: { title } });
      return res.data;
    } catch {
      return { poster: null, backdrop: null, rating: 0, year: "", overview: "" };
    }
  };

  // 🎯 Select a movie
  const selectMovie = async (movieTitle) => {
    setSelectedMovie(null); // trigger flash
    setRecommendations([]); // clear old recommendations to prevent React null errors
    setQuery(movieTitle);
    setIsDropdownOpen(false);
    setSuggestions([]);

    // We can fetch concurrently
    const [details] = await Promise.all([
      fetchMovieDetails(movieTitle),
      fetchRecommendations(movieTitle)
    ]);
    
    setSelectedMovie({ title: movieTitle, ...details });
  };

  // 🚀 Get Recommendations
  const fetchRecommendations = async (movieTitle) => {
    setLoading(true);
    try {
      const res = await axios.get("http://127.0.0.1:8000/recommend", {
        params: { movie: movieTitle, top_n: 12 },
      });

      const recs = res.data.recommendations;
      const withDetails = await Promise.all(
        recs.map(async (title) => {
          const details = await fetchMovieDetails(title);
          return { title, ...details };
        })
      );
      setRecommendations(withDetails);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      {/* 🚀 GLASMORPHIC NAVBAR */}
      <nav className="navbar">
        <div className="logo">CineFlow</div>
        <div className="search-container">
          <input
            className="search-input"
            value={query}
            onChange={(e) => searchMovies(e.target.value)}
            onFocus={() => setIsDropdownOpen(true)}
            placeholder="Search for a movie..."
          />
          {isDropdownOpen && suggestions.length > 0 && (
            <div className="suggestions-dropdown">
              {suggestions.map((s, i) => (
                <div key={i} className="suggestion-item" onClick={() => selectMovie(s)}>
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* 🌟 HERO SECTION */}
      <div 
        className="hero-section"
        style={{
          backgroundImage: selectedMovie && selectedMovie.backdrop 
            ? `url(${selectedMovie.backdrop})` 
            : `url(https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=2070&auto=format&fit=crop)`
        }}
      >
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <h1 className="hero-title">{selectedMovie ? selectedMovie.title : "Discover Your Next Favorite Film"}</h1>
          {selectedMovie && (
            <>
              <div className="hero-meta">
                <span className="hero-rating">★ {selectedMovie.rating.toFixed(1)}</span>
                <span>{selectedMovie.year}</span>
              </div>
              <p className="hero-desc">{selectedMovie.overview || "Select a movie to explore customized recommendations."}</p>
            </>
          )}
          {!selectedMovie && <p className="hero-desc">Start by searching a movie in the top right to generate customized recommendations powered by advanced collaborative filtering.</p>}
        </div>
      </div>

      {/* 🎬 MOVIE GRID */}
      <div className="content-section">
        {loading ? (
          <div className="loading-spinner">Loading recommendations...</div>
        ) : recommendations.length > 0 ? (
          <>
            <h2 className="section-title">Because you watched {selectedMovie?.title}</h2>
            <div className="movie-grid">
              {recommendations.map((m, i) => (
                <div key={i} className="movie-card" onClick={() => selectMovie(m.title)}>
                  <div className="movie-poster-wrapper">
                    <img 
                      className="movie-poster" 
                      src={m.poster || "https://via.placeholder.com/300x450?text=No+Poster"} 
                      alt={m.title} 
                    />
                  </div>
                  <div className="movie-info">
                    <h3 className="movie-title" title={m.title}>{m.title}</h3>
                    <div className="movie-meta-small">
                      <span>{m.year}</span>
                      <span style={{ color: "var(--red-primary)" }}>★ {m.rating ? m.rating.toFixed(1) : "N/A"}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          selectedMovie && <p>No exact recommendations found. Try a different movie.</p>
        )}
      </div>
    </div>
  );
}

export default App;