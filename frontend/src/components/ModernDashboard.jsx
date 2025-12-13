import { useState, useEffect } from 'react';
import './ModernDashboard.css';

function ModernDashboard({ repositories, installationId, API_URL }) {
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [pullRequests, setPullRequests] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedRepo) {
      fetchPullRequests(selectedRepo);
    }
  }, [selectedRepo]);

  const fetchPullRequests = async (repo) => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/github/installations/${installationId}/repositories/${repo.owner.login}/${repo.name}/pulls`
      );
      const data = await response.json();
      setPullRequests(data.pullRequests || []);
    } catch (error) {
      console.error('Failed to fetch PRs:', error);
      setPullRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const getStateColor = (state) => {
    return state === 'open' ? '#10b981' : '#6b7280';
  };

  const handleAddRepository = () => {
    window.location.href = `${API_URL}/github/install`;
  };

  return (
    <div className="modern-dashboard">
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="header-left">
            <div className="logo">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <path d="M16 2L6 8V16L16 22L26 16V8L16 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                <path d="M16 12L11 9.5V14.5L16 17L21 14.5V9.5L16 12Z" fill="currentColor"/>
              </svg>
              <span>RevBot Dashboard</span>
            </div>
            <p>Monitor your code reviews and repository health</p>
          </div>
          <button className="add-repo-button" onClick={handleAddRepository}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 5V15M5 10H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>Add Repository</span>
          </button>
        </header>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon" style={{background: 'rgba(16, 185, 129, 0.1)', color: '#10b981'}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M4 7V17H20V7M2 7L12 2L22 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-label">Connected Repositories</div>
              <div className="stat-value">{repositories.length}</div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6'}}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="stat-content">
              <div className="stat-label">Pull Requests</div>
              <div className="stat-value">{pullRequests.length}</div>
            </div>
          </div>
        </div>

        <div className="content-grid">
          <div className="repositories-section">
            <div className="section-header">
              <h2>Your Repositories</h2>
              <span className="badge">{repositories.length}</span>
            </div>
            <div className="repo-list">
              {repositories.slice(0, 5).map((repo, idx) => (
                <div 
                  key={idx} 
                  className={`repo-card ${selectedRepo?.name === repo.name ? 'active' : ''}`}
                  onClick={() => setSelectedRepo(repo)}
                >
                  <div className="repo-info">
                    <div className="repo-name">{repo.name}</div>
                    <div className="repo-meta">
                      <span className="repo-visibility">{repo.private ? 'Private' : 'Public'}</span>
                      <span>•</span>
                      <span>{repo.language || 'JavaScript'}</span>
                    </div>
                  </div>
                  <div className="repo-arrow">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pr-section">
            <div className="section-header">
              <h2>Pull Requests{selectedRepo && ` - ${selectedRepo.name}`}</h2>
            </div>

            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading pull requests...</p>
              </div>
            ) : pullRequests.length > 0 ? (
              <div className="pr-list">
                {pullRequests.map((pr) => {
                  return (
                    <div key={pr.number} className="pr-card">
                      <div className="pr-header">
                        <div className="pr-title-section">
                          <a 
                            href={pr.html_url} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="pr-title"
                          >
                            #{pr.number} {pr.title}
                          </a>
                          <div className="pr-meta">
                            <img src={pr.user.avatar_url} alt={pr.user.login} className="pr-avatar" />
                            <span>{pr.user.login}</span>
                            <span>•</span>
                            <span>{new Date(pr.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="pr-state" style={{color: getStateColor(pr.state)}}>
                          {pr.state === 'open' ? '● Open' : '○ Closed'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <path d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z" stroke="currentColor" strokeWidth="2"/>
                  <path d="M20 28L24 32L28 28M24 16V32" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <h3>No Pull Requests</h3>
                <p>Select a repository to see its pull requests</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default ModernDashboard;
