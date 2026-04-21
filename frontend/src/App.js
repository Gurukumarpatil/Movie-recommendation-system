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
  
  const [placeholder, setPlaceholder] = useState("Search for a movie...");
  const carouselRef = useRef(null);
  const searchTimeout = useRef(null);

  useEffect(() => {
    const movies = ["The Dark Knight", "Inception", "Interstellar", "Dune", "Parasite", "Everything Everywhere All at Once"];
    let i = 0;
    const interval = setInterval(() => {
      setPlaceholder(`Search for "${movies[i]}"...`);
      i = (i + 1) % movies.length;
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const scrollCarousel = (direction) => {
    if (carouselRef.current) {
      const scrollAmount = direction === "left" ? -800 : 800;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: "smooth" });
    }
  };

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
        <div className="logo">CineMatch</div>
        <div className="search-container">
          <input
            className="search-input"
            value={query}
            onChange={(e) => searchMovies(e.target.value)}
            onFocus={() => setIsDropdownOpen(true)}
            placeholder={placeholder}
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
        <div className="hero-content" style={!selectedMovie ? { maxWidth: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '40px' } : {}}>
          {selectedMovie ? (
            <>
              <h1 className="hero-title">{selectedMovie.title}</h1>
              <div className="hero-meta">
                <span className="hero-rating">★ {selectedMovie.rating.toFixed(1)}</span>
                <span>{selectedMovie.year}</span>
              </div>
              <p className="hero-desc">{selectedMovie.overview || "Select a movie to explore customized recommendations."}</p>
            </>
          ) : (
            <>
              <div className="landing-copy">
                <h1 className="landing-title">Find the films you were meant to watch.</h1>
                <p className="landing-desc">
                  Stop endlessly scrolling. CineMatch analyzes your taste to recommend hidden gems and blockbuster hits you'll actually love.
                </p>
                <div className="search-instruction">
                  <span>↑ Use the search bar above to start exploring</span>
                </div>
              </div>
              <div className="landing-collage">
                <img className="collage-img img-1" src="https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg" alt="Poster 1" />
                <img className="collage-img img-2" src="https://image.tmdb.org/t/p/w500/gEU2QlsEOVhVNcu6lxU4aD6N2fA.jpg" alt="Poster 2" />
                <img className="collage-img img-3" src="https://image.tmdb.org/t/p/w500/d5NXSklXo0qyIYkgV94XAgMIckC.jpg" alt="Poster 3" />
              </div>
            </>
          )}
        </div>
      </div>

      {/* 🎬 MOVIE GRID / CAROUSEL */}
      <div className="content-section">
        {loading ? (
          <div className="recommendations-container">
            <h2 className="section-title">Curating perfect matches...</h2>
            <div className="carousel-container">
              <div className="movie-carousel skeleton-carousel">
                {[...Array(6)].map((_, i) => (
                   <div key={i} className="skeleton-card"></div>
                ))}
              </div>
            </div>
          </div>
        ) : recommendations.length > 0 ? (
          <div className="recommendations-container">
            <h2 className="section-title">Because you watched <span className="title-highlight">{selectedMovie?.title}</span></h2>
            <div className="carousel-container">
              <button className="carousel-arrow left-arrow" onClick={() => scrollCarousel('left')}>‹</button>
              <div className="movie-carousel" ref={carouselRef}>
                {recommendations.map((m, i) => {
                  const fakeMatchScore = Math.max(98 - (i * 2), 65); // Descending Netflix-style match score
                  return (
                    <div key={i} className="movie-card premium-card" onClick={() => selectMovie(m.title)} style={{ animationDelay: `${i * 0.05}s` }}>
                      <div className="movie-poster-wrapper">
                        <img 
                          className="movie-poster" 
                          src={m.poster || "https://via.placeholder.com/300x450?text=No+Poster"} 
                          alt={m.title} 
                        />
                        <div className="card-overlay">
                            <div className="overlay-content">
                               <h3 className="movie-title">{m.title}</h3>
                               <div className="movie-stats">
                                 <span className="match-score">{fakeMatchScore}% Match</span>
                                 <span className="movie-year">{m.year}</span>
                               </div>
                               <div className="movie-rating">★ {m.rating ? m.rating.toFixed(1) : "N/A"}</div>
                            </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button className="carousel-arrow right-arrow" onClick={() => scrollCarousel('right')}>›</button>
            </div>
          </div>
        ) : (
          selectedMovie && <p className="no-recs">No exact recommendations found. Try a different film.</p>
        )}
      </div>
    </div>
  );
}

export default App;