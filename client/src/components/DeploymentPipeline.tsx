import { DeploymentStatus, PLG_ENVIRONMENTS, PLGEnvironment } from '../types'

interface DeploymentPipelineProps {
  deployments: DeploymentStatus[]
  prMergeDate?: string
}

function DeploymentPipeline({ deployments, prMergeDate: _prMergeDate }: DeploymentPipelineProps) {
  // Map deployment status to PLG environments
  const getDeploymentForEnv = (env: PLGEnvironment): DeploymentStatus | undefined => {
    return deployments.find(
      (d) => d.environment.toLowerCase() === env.adoEnvName.toLowerCase() ||
             d.environment.toLowerCase().includes(env.name.toLowerCase())
    )
  }

  const getDeployedCount = (): number => {
    return PLG_ENVIRONMENTS.filter(env => {
      const deployment = getDeploymentForEnv(env)
      return deployment?.status === 'deployed'
    }).length
  }

  const getProgressPercentage = (): number => {
    return Math.round((getDeployedCount() / PLG_ENVIRONMENTS.length) * 100)
  }

  const getStatusIcon = (status?: DeploymentStatus['status']): string => {
    switch (status) {
      case 'deployed': return '✅'
      case 'inProgress': return '🔄'
      case 'pending': return '⏳'
      case 'notDeployed': return '⬜'
      case 'unknown': return '❓'
      default: return '⬜'
    }
  }

  const getStatusColor = (status?: DeploymentStatus['status']): string => {
    switch (status) {
      case 'deployed': return 'bg-green-500'
      case 'inProgress': return 'bg-blue-500 animate-pulse'
      case 'pending': return 'bg-yellow-500'
      case 'unknown': return 'bg-gray-400'
      default: return 'bg-slate-600'
    }
  }

  const getStatusBorderColor = (status?: DeploymentStatus['status']): string => {
    switch (status) {
      case 'deployed': return 'border-green-500'
      case 'inProgress': return 'border-blue-500'
      case 'pending': return 'border-yellow-500'
      case 'unknown': return 'border-gray-400'
      default: return 'border-slate-600'
    }
  }

  const getStatusText = (status?: DeploymentStatus['status']): string => {
    switch (status) {
      case 'deployed': return 'Deployed'
      case 'inProgress': return 'In Progress'
      case 'pending': return 'Pending'
      case 'unknown': return 'Unknown'
      default: return 'Not Deployed'
    }
  }

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const deployedCount = getDeployedCount()
  const isFullyDeployed = deployedCount === PLG_ENVIRONMENTS.length

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🚂</span>
          <div>
            <h3 className="text-xl font-bold text-white">PLG Deployment Pipeline</h3>
            <p className="text-slate-400 text-sm">Track your code through environments</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-2xl font-bold text-white">{deployedCount}/{PLG_ENVIRONMENTS.length}</div>
            <div className="text-xs text-slate-400">Environments</div>
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
                className={isFullyDeployed ? 'text-green-500' : 'text-blue-500'}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-white">{getProgressPercentage()}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      {isFullyDeployed && (
        <div className="mb-6 p-4 bg-green-900/30 border border-green-500/50 rounded-lg flex items-center gap-3">
          <span className="text-2xl">🎉</span>
          <div>
            <p className="text-green-400 font-semibold">Fully Deployed!</p>
            <p className="text-green-300/70 text-sm">Your code is live in all PLG environments</p>
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
            {PLG_ENVIRONMENTS.map((env, index) => {
              const deployment = getDeploymentForEnv(env)
              const isDeployed = deployment?.status === 'deployed'
              const isInProgress = deployment?.status === 'inProgress'
              
              return (
                <div key={env.id} className="flex flex-col items-center group">
                  {/* Node */}
                  <div 
                    className={`
                      relative w-12 h-12 rounded-full flex items-center justify-center 
                      border-4 ${getStatusBorderColor(deployment?.status)}
                      ${isDeployed ? 'bg-green-500/20' : isInProgress ? 'bg-blue-500/20' : 'bg-slate-800'}
                      transition-all duration-300 cursor-pointer
                      hover:scale-110 hover:shadow-lg hover:shadow-${isDeployed ? 'green' : 'blue'}-500/25
                    `}
                    title={`${env.displayName}: ${getStatusText(deployment?.status)}`}
                  >
                    <span className="text-xl">{getStatusIcon(deployment?.status)}</span>
                    
                    {/* Pulse animation for in-progress */}
                    {isInProgress && (
                      <div className="absolute inset-0 rounded-full border-4 border-blue-500 animate-ping opacity-20"></div>
                    )}
                  </div>

                  {/* Environment Label */}
                  <div className="mt-3 text-center">
                    <div className={`
                      font-semibold text-sm
                      ${isDeployed ? 'text-green-400' : isInProgress ? 'text-blue-400' : 'text-slate-400'}
                    `}>
                      {env.displayName}
                    </div>
                    <div className={`
                      text-xs px-2 py-0.5 rounded-full mt-1
                      ${env.type === 'prod' ? 'bg-red-500/20 text-red-300' : 'bg-slate-700 text-slate-400'}
                    `}>
                      {env.type === 'prod' ? 'PROD' : 'Pre-Prod'}
                    </div>
                  </div>

                  {/* Tooltip with details */}
                  {deployment?.timestamp && (
                    <div className="
                      absolute -bottom-16 left-1/2 -translate-x-1/2
                      bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 
                      opacity-0 group-hover:opacity-100 transition-opacity
                      whitespace-nowrap text-xs z-20 shadow-xl
                    ">
                      <div className="text-slate-300">{formatDate(deployment.timestamp)}</div>
                      {deployment.buildNumber && (
                        <div className="text-slate-500">Build: {deployment.buildNumber}</div>
                      )}
                    </div>
                  )}

                  {/* Connector line */}
                  {index < PLG_ENVIRONMENTS.length - 1 && (
                    <div className="hidden lg:block absolute top-6 left-12 w-full h-0.5 bg-transparent pointer-events-none"></div>
                  )}
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
              <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm uppercase tracking-wider">Status</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm uppercase tracking-wider">Deployed At</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm uppercase tracking-wider">Build</th>
              <th className="text-right py-3 px-4 text-slate-400 font-medium text-sm uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {PLG_ENVIRONMENTS.map((env) => {
              const deployment = getDeploymentForEnv(env)
              const isDeployed = deployment?.status === 'deployed'
              
              return (
                <tr 
                  key={env.id}
                  className={`
                    border-b border-slate-700/30 
                    hover:bg-slate-700/30 transition-colors
                    ${isDeployed ? 'bg-green-500/5' : ''}
                  `}
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(deployment?.status)}`}></div>
                      <div>
                        <div className="text-white font-medium">{env.displayName}</div>
                        <div className="text-slate-500 text-xs">{env.adoEnvName}</div>
                      </div>
                      {env.type === 'prod' && (
                        <span className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded-full">PROD</span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className={`
                      inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium
                      ${isDeployed ? 'bg-green-500/20 text-green-400' : 
                        deployment?.status === 'inProgress' ? 'bg-blue-500/20 text-blue-400' :
                        deployment?.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-slate-600/20 text-slate-400'}
                    `}>
                      {getStatusIcon(deployment?.status)}
                      {getStatusText(deployment?.status)}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-slate-400 text-sm">
                    {deployment?.timestamp ? formatDate(deployment.timestamp) : '-'}
                  </td>
                  <td className="py-4 px-4 text-slate-400 text-sm font-mono">
                    {deployment?.buildNumber || '-'}
                  </td>
                  <td className="py-4 px-4 text-right">
                    {deployment?.url ? (
                      <a
                        href={deployment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                      >
                        View
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
          <span>Deployed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
          <span>In Progress</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span>Pending</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-slate-600"></div>
          <span>Not Deployed</span>
        </div>
      </div>
    </div>
  )
}

export default DeploymentPipeline
