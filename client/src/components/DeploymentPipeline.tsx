import { DeploymentStatus, TrainSchedule } from '../types'

interface DeploymentPipelineProps {
  deployments: DeploymentStatus[]
  trainInfo?: TrainSchedule
  prMergeDate?: string
}

// Standard environment order
const ENVIRONMENT_ORDER = ['EDOG', 'Daily', 'DXT', 'MSIT', 'Canary1', 'Canary2', 'PROD'];

function DeploymentPipeline({ deployments, trainInfo, prMergeDate }: DeploymentPipelineProps) {
  
  // Sort deployments by environment order
  const sortedDeployments = [...deployments].sort((a, b) => {
    const getOrder = (env: string) => {
      const name = env.replace(/^(FE|BE)\s+/i, '').replace(/\s+/g, '');
      return ENVIRONMENT_ORDER.findIndex(e => 
        name.toLowerCase().includes(e.toLowerCase())
      );
    };
    return getOrder(a.environment) - getOrder(b.environment);
  });

  const getObservedCount = (): number => {
    return deployments.filter(d => d.observedStatus === 'observed').length;
  };

  const getProgressPercentage = (): number => {
    return deployments.length > 0 ? Math.round((getObservedCount() / deployments.length) * 100) : 0;
  };

  const getStatusIcon = (dep: DeploymentStatus): string => {
    if (dep.observedStatus === 'observed') return '✅';
    if (dep.observedStatus === 'in-progress') return '🔄';
    if (dep.expectedStatus === 'arrived') return '🕐'; // Expected to have arrived but not observed
    return '⏳'; // Expected in future
  };

  const getStatusColor = (dep: DeploymentStatus): string => {
    if (dep.observedStatus === 'observed') return 'bg-green-500';
    if (dep.observedStatus === 'in-progress') return 'bg-blue-500 animate-pulse';
    if (dep.expectedStatus === 'arrived') return 'bg-yellow-500';
    return 'bg-slate-600';
  };

  const getStatusBorderColor = (dep: DeploymentStatus): string => {
    if (dep.observedStatus === 'observed') return 'border-green-500';
    if (dep.observedStatus === 'in-progress') return 'border-blue-500';
    if (dep.expectedStatus === 'arrived') return 'border-yellow-500';
    return 'border-slate-600';
  };

  const getStatusText = (dep: DeploymentStatus): string => {
    if (dep.observedStatus === 'observed') return 'Observed ✓';
    if (dep.observedStatus === 'in-progress') return 'In Progress';
    if (dep.expectedStatus === 'arrived') return 'Expected (Not Observed)';
    return 'Expected';
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatExpectedDate = (dateString?: string): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const now = new Date();
    const isPast = date < now;
    
    const formatted = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
    
    return isPast ? `~${formatted}` : formatted;
  };

  const observedCount = getObservedCount();
  const isFullyObserved = observedCount === deployments.length;
  const repoType = deployments[0]?.environment.startsWith('FE') ? 'Frontend' : 
                   deployments[0]?.environment.startsWith('BE') ? 'Backend' : 'Unknown';

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🚂</span>
          <div>
            <h3 className="text-xl font-bold text-white">Train Deployment Tracker</h3>
            <p className="text-slate-400 text-sm">
              {repoType} • {trainInfo ? `Train ${trainInfo.trainId}` : 'Calculating train...'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{observedCount}/{deployments.length}</div>
            <div className="text-xs text-slate-400">Observed</div>
          </div>
          <div className="relative w-16 h-16">
            <svg className="w-16 h-16 transform -rotate-90">
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                className="text-slate-700"
              />
              <circle
                cx="32"
                cy="32"
                r="28"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
                strokeDasharray={`${getProgressPercentage() * 1.76} 176`}
                className={isFullyObserved ? 'text-green-500' : 'text-blue-500'}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-white">{getProgressPercentage()}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Train Info Banner */}
      {trainInfo && (
        <div className="mb-6 p-4 bg-slate-900/50 border border-slate-700/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">📅</span>
            <span className="text-white font-semibold">Train Schedule</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div>
              <span className="text-slate-400">Merged:</span>
              <span className="text-white ml-2">{prMergeDate ? formatDate(prMergeDate) : '-'}</span>
            </div>
            <div>
              <span className="text-slate-400">Train Fork:</span>
              <span className="text-white ml-2">{trainInfo.forkDate.toLocaleDateString()}</span>
            </div>
            <div>
              <span className="text-slate-400">Train ID:</span>
              <span className="text-blue-400 ml-2 font-mono">{trainInfo.trainId}</span>
            </div>
            <div>
              <span className="text-slate-400">Status:</span>
              <span className={`ml-2 ${trainInfo.prIncluded ? 'text-green-400' : 'text-yellow-400'}`}>
                {trainInfo.prIncluded ? '✓ In Train' : '⏳ Next Train'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Status Banner */}
      {isFullyObserved && (
        <div className="mb-6 p-4 bg-green-900/30 border border-green-500/50 rounded-lg flex items-center gap-3">
          <span className="text-2xl">🎉</span>
          <div>
            <p className="text-green-400 font-semibold">Fully Observed!</p>
            <p className="text-green-300/70 text-sm">Your code has been observed in all tracked environments</p>
          </div>
        </div>
      )}

      {/* Pipeline Visualization */}
      <div className="mb-6">
        <div className="relative">
          {/* Pipeline Track */}
          <div className="absolute top-1/2 left-0 right-0 h-2 bg-slate-700 rounded-full -translate-y-1/2 z-0"></div>
          
          {/* Progress Fill */}
          <div 
            className="absolute top-1/2 left-0 h-2 bg-gradient-to-r from-green-500 to-blue-500 rounded-full -translate-y-1/2 z-0 transition-all duration-700"
            style={{ width: `${getProgressPercentage()}%` }}
          ></div>

          {/* Environment Nodes */}
          <div className="relative z-10 flex justify-between items-center py-4">
            {sortedDeployments.map((dep) => {
              const isObserved = dep.observedStatus === 'observed';
              const isInProgress = dep.observedStatus === 'in-progress';
              const isExpectedArrived = dep.expectedStatus === 'arrived' && !isObserved;
              
              return (
                <div key={dep.environment} className="flex flex-col items-center group">
                  {/* Node */}
                  <div 
                    className={`
                      relative w-12 h-12 rounded-full flex items-center justify-center 
                      border-4 ${getStatusBorderColor(dep)}
                      ${isObserved ? 'bg-green-500/20' : isInProgress ? 'bg-blue-500/20' : isExpectedArrived ? 'bg-yellow-500/20' : 'bg-slate-800'}
                      transition-all duration-300 cursor-pointer
                      hover:scale-110 hover:shadow-lg
                    `}
                    title={`${dep.environment}: ${getStatusText(dep)}`}
                  >
                    <span className="text-xl">{getStatusIcon(dep)}</span>
                    
                    {/* Pulse animation for in-progress */}
                    {isInProgress && (
                      <div className="absolute inset-0 rounded-full border-4 border-blue-500 animate-ping opacity-20"></div>
                    )}
                  </div>

                  {/* Environment Label */}
                  <div className="mt-3 text-center">
                    <div className={`
                      font-semibold text-sm
                      ${isObserved ? 'text-green-400' : isInProgress ? 'text-blue-400' : isExpectedArrived ? 'text-yellow-400' : 'text-slate-400'}
                    `}>
                      {dep.environment.replace(/^(FE|BE)\s+/i, '')}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {dep.expectedDate ? formatExpectedDate(dep.expectedDate) : ''}
                    </div>
                  </div>

                  {/* Tooltip with details */}
                  <div className="
                    absolute -bottom-20 left-1/2 -translate-x-1/2
                    bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 
                    opacity-0 group-hover:opacity-100 transition-opacity
                    whitespace-nowrap text-xs z-20 shadow-xl pointer-events-none
                  ">
                    <div className="text-slate-300">{getStatusText(dep)}</div>
                    {dep.observedTimestamp && (
                      <div className="text-slate-500">Observed: {formatDate(dep.observedTimestamp)}</div>
                    )}
                    {dep.observedBuildNumber && (
                      <div className="text-slate-500">Build: {dep.observedBuildNumber}</div>
                    )}
                    {!dep.observedTimestamp && dep.expectedDate && (
                      <div className="text-slate-500">Expected: {formatExpectedDate(dep.expectedDate)}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-slate-900/50 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm uppercase tracking-wider">Environment</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm uppercase tracking-wider">Observed</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm uppercase tracking-wider">Expected</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm uppercase tracking-wider">Build</th>
              <th className="text-right py-3 px-4 text-slate-400 font-medium text-sm uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedDeployments.map((dep) => {
              const isObserved = dep.observedStatus === 'observed';
              const isExpectedArrived = dep.expectedStatus === 'arrived';
              
              return (
                <tr 
                  key={dep.environment}
                  className={`
                    border-b border-slate-700/30 
                    hover:bg-slate-700/30 transition-colors
                    ${isObserved ? 'bg-green-500/5' : ''}
                  `}
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(dep)}`}></div>
                      <div>
                        <div className="text-white font-medium">{dep.environment}</div>
                        <div className="text-slate-500 text-xs">
                          {dep.deploymentType === 'continuous' ? 'Continuous' : 'Train-based'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    {isObserved ? (
                      <div>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-400">
                          ✅ Observed
                        </span>
                        <div className="text-slate-500 text-xs mt-1">
                          {dep.observedTimestamp ? formatDate(dep.observedTimestamp) : ''}
                        </div>
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-slate-600/20 text-slate-400">
                        Not Observed
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-4 text-sm">
                    {dep.expectedDate && (
                      <div className={isExpectedArrived && !isObserved ? 'text-yellow-400' : 'text-slate-400'}>
                        {formatExpectedDate(dep.expectedDate)}
                        {isExpectedArrived && !isObserved && (
                          <span className="ml-2 text-xs">(should have arrived)</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4 text-slate-400 text-sm font-mono">
                    {dep.observedBuildNumber || '-'}
                  </td>
                  <td className="py-4 px-4 text-right">
                    {dep.buildUrl ? (
                      <a
                        href={dep.buildUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                      >
                        View Build
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>Observed in build</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span>Expected (not observed)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-slate-600"></div>
          <span>Expected in future</span>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-4 p-3 bg-slate-900/30 rounded-lg text-xs text-slate-500">
        <strong>Note:</strong> "Observed" means we found your code in a deployment build. 
        "Expected" dates are estimates based on the train schedule. 
        For authoritative deployment status, check the official deployment dashboards.
      </div>
    </div>
  )
}

export default DeploymentPipeline
