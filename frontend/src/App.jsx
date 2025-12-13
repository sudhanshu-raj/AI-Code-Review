import { useState, useEffect } from 'react';
import './App.css';
import LandingPage from './components/LandingPage';
import ModernDashboard from './components/ModernDashboard';

function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [installationId, setInstallationId] = useState(null);
  const [repositories, setRepositories] = useState([]);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const installation = urlParams.get('installation');
    const refresh = urlParams.get('refresh'); 
    
    if (installation) {
      const apiUrl = `${API_URL}/github/installation/${installation}?refresh=true`;
      
      fetch(apiUrl)
        .then(res => res.json())
        .then(data => {
          setIsConnected(true);
          setInstallationId(data.installationId);
          setRepositories(data.repositories || []);
          // Clean up URL by removing refresh parameter
          window.history.replaceState({}, '', `/dashboard?installation=${installation}`);
        })
        .catch(err => {
          console.error('Failed to fetch installation:', err);
        });
    }
    
    const savedInstallation = localStorage.getItem('github_installation_id');
    if (savedInstallation && !installation) {
      fetch(`${API_URL}/github/installation/${savedInstallation}?refresh=true`)
        .then(res => res.json())
        .then(data => {
          setIsConnected(true);
          setInstallationId(data.installationId);
          setRepositories(data.repositories || []);
        })
        .catch(err => {
          localStorage.removeItem('github_installation_id');
        });
    }
  }, []);

  useEffect(() => {
    if (installationId) {
      localStorage.setItem('github_installation_id', installationId);
    }
  }, [installationId]);

  if (!isConnected) {
    return (
      <LandingPage 
        onConnect={() => {
          window.location.href = `${API_URL}/github/install`;
        }}
      />
    );
  }

  return (
    <ModernDashboard 
      repositories={repositories}
      installationId={installationId}
      API_URL={API_URL}
    />
  );
}

export default App;
