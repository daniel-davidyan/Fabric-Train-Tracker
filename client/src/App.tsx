import { useState } from 'react';
import { checkPRDeploymentStatus } from './services/adoService';
import { PRDeploymentResult, InclusionStatus, FE_ENVIRONMENTS, EnvironmentDeploymentStatus } from './types';
import './App.css';

function App() {
  const [prUrl, setPrUrl] = useState('');
  const [pat, setPat] = useState(() => {
    return localStorage.getItem('ado_pat') || '';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PRDeploymentResult | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prUrl.trim() || !pat.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    // Save PAT for convenience
    localStorage.setItem('ado_pat', pat);

    try {
      const data = await checkPRDeploymentStatus(prUrl.trim(), pat.trim());
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: InclusionStatus): string => {
    switch (status) {
      case 'included': return 'status-included';
      case 'not-included': return 'status-not-included';
      case 'in-progress': return 'status-in-progress';
      case 'no-builds': return 'status-no-builds';
      case 'error': return 'status-error';
      default: return '';
    }
  };

  const getStatusIcon = (status: InclusionStatus): string => {
    switch (status) {
      case 'included': return '✓';
      case 'not-included': return '○';
      case 'in-progress': return '◐';
      case 'no-builds': return '?';
      case 'error': return '✗';
      default: return '';
    }
  };

  // Get environment status from result or return null for pending state
  const getEnvironmentData = (envId: number): EnvironmentDeploymentStatus | null => {
    if (!result || !result.supportedRepo || !result.prInfo.mergeCommitId) return null;
    return result.environments.find(e => e.environment.id === envId) || null;
  };

  return (
    <div className="app">
      <header className="header">
        <h1>
          FE Train Tracker
          <span className="train-icon">🚂</span>
        </h1>
        <p className="subtitle">
          Track your PR inclusion status across environments
        </p>
      </header>

      <div className="main-container">
        <form onSubmit={handleSubmit} className="input-form">
          <div className="input-group">
            <label htmlFor="prUrl">PR URL</label>
            <input
              id="prUrl"
              type="text"
              value={prUrl}
              onChange={(e) => setPrUrl(e.target.value)}
              placeholder="https://dev.azure.com/powerbi/PowerBIClients/_git/PowerBIClients/pullrequest/123456"
              disabled={loading}
            />
          </div>
          <div className="input-group">
            <label htmlFor="pat">PAT Token</label>
            <input
              id="pat"
              type="password"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="Your Azure DevOps Personal Access Token"
              disabled={loading}
            />
          </div>
          <button type="submit" disabled={loading || !prUrl.trim() || !pat.trim()}>
            {loading ? 'Checking...' : 'Check Status'}
          </button>
        </form>

        {error && (
          <div className="error-box">
            <span>⚠️</span> {error}
          </div>
        )}

        {result && (
          <>
          {/* PR Info */}
          <div className="pr-info">
            <h2>{result.prInfo.title}</h2>
            <div className="pr-meta">
              <span>PR #{result.prInfo.id}</span>
              <span>•</span>
              <span>{result.prInfo.repository.name}</span>
              <span>•</span>
              <span className={`pr-status pr-status-${result.prInfo.status}`}>
                {result.prInfo.status}
              </span>
            </div>
            {result.prInfo.mergeCommitId && (
              <div className="merge-commit">
                Merge commit: <code>{result.prInfo.mergeCommitId.substring(0, 8)}</code>
              </div>
            )}
          </div>

          {/* BE Not Supported Warning */}
          {!result.supportedRepo && (
            <div className="warning-box">
              <span className="warning-icon">🚧</span>
              <div>
                <strong>BE Repository Not Supported</strong>
                <p>{result.unsupportedMessage}</p>
              </div>
            </div>
          )}

          {/* PR Not Merged Warning */}
          {result.supportedRepo && result.unsupportedMessage && (
            <div className="info-box">
              <span>ℹ️</span>
              <p>{result.unsupportedMessage}</p>
            </div>
          )}
        </>
      )}

        {/* Environment Status - Always visible */}
        <div className="environments">
          <h3>Environment Status</h3>
          
          {/* Train Animation during loading */}
          {loading && (
            <div className="train-loading">
              <div className="train-track-line"></div>
              <div className="train-moving">🚂</div>
            </div>
          )}
          
          <div className={`env-pipeline ${loading ? 'loading' : ''}`}>
            {FE_ENVIRONMENTS.map((env) => {
              const envData = getEnvironmentData(env.id);
              const hasData = envData !== null;
              
              return (
                <div key={env.id} className="env-stage">
                  <div className={`env-node ${hasData ? getStatusColor(envData.status) : 'status-pending'}`}>
                    <span className="env-icon">
                      {hasData ? getStatusIcon(envData.status) : '○'}
                    </span>
                  </div>
                  <div className="env-info">
                    <div className="env-name">{env.displayName}</div>
                    <div className="env-date">
                      {hasData && envData.status === 'not-included' && envData.expectedDate && (
                        <span className="env-expected">ETA: {new Date(envData.expectedDate).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="legend">
            <div className="legend-item">
              <span className="legend-dot included"></span>
              <span>Included</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot not-included"></span>
              <span>Not yet</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot in-progress"></span>
              <span>In progress</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot pending"></span>
              <span>Pending</span>
            </div>
          </div>
        </div>
      </div>

      <footer className="footer">
        <p>FE Train Tracker - Fabric PowerBIClients Deployment Status</p>
        <p>
          <a
            href="https://aka.ms/pbitrains"
            target="_blank"
            rel="noopener noreferrer"
          >
            View Train Schedule Status →
          </a>
        </p>
      </footer>
    </div>
  );
}

export default App;
