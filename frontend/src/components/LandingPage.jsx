import { useState } from 'react';
import './LandingPage.css';

function LandingPage({ onConnect }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="landing-page">
      <div className="animated-bg">
        <div className="orb orb-1"></div>
        <div className="orb orb-2"></div>
      </div>

      <nav className="landing-nav">
        <div className="nav-logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 2L6 8V16L16 22L26 16V8L16 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M16 12L11 9.5V14.5L16 17L21 14.5V9.5L16 12Z" fill="currentColor"/>
          </svg>
          <span>RevBot</span>
        </div>
        <div className="nav-links">
          <a href="https://github.com/sudhanshu-raj/AI-Code-Review" target="_blank" rel="noopener noreferrer">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 0C4.477 0 0 4.477 0 10c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0110 4.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C17.137 18.163 20 14.418 20 10c0-5.523-4.477-10-10-10z"/>
            </svg>
            GitHub
          </a>
        </div>
      </nav>

      <main className="landing-main">
        <div className="hero-section">
          <div className="hero-badge">
            <span className="badge-dot"></span>
            AI-Powered Code Reviews
          </div>
          
          <h1 className="hero-title">
            Ship Better Code
            <span className="title-highlight"> Faster</span>
          </h1>
          
          <p className="hero-subtitle">
            Automated code reviews powered by AI. Get instant feedback on pull requests,
            catch bugs early, and maintain code quality effortlessly.
          </p>

          <div className="hero-cta">
            <button 
              className="cta-primary"
              onClick={onConnect}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
            >
              <span>Connect GitHub Repository</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            
            <a href="#demo" className="cta-secondary">
              <span>Watch Demo</span>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </div>
        </div>

        <div className="features-grid" id="features">
          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3>Instant Analysis</h3>
            <p>Get AI-powered code reviews in seconds, not hours. Analyze PRs automatically on every push.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 6V12L16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h3>Quality Scoring</h3>
            <p>Comprehensive quality metrics with risk assessment and actionable recommendations.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M20 7L12 3L4 7M20 7L12 11M20 7V17L12 21M12 11L4 7M12 11V21M4 7V17L12 21" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3>Inline Comments</h3>
            <p>Get precise feedback directly on code lines with file paths and line numbers.</p>
          </div>
        </div>
      </main>

      <footer className="landing-footer">
        <p>RevBot, Review smarter, ship faster.</p>
      </footer>
    </div>
  );
}

export default LandingPage;
