import { DeploymentStatus, ALL_TRACKED_ENVIRONMENTS, ServiceEnvironment } from '../types'
import StatusBadge from './StatusBadge'

interface DeploymentTableProps {
  deployments: DeploymentStatus[]
}

function DeploymentTable({ deployments }: DeploymentTableProps) {
  // Merge deployments with environments
  const getDeploymentForEnv = (env: ServiceEnvironment): DeploymentStatus | undefined => {
    return deployments.find(
      (d) => d.environmentId === env.adoEnvId
    )
  }

  const getProgressPercentage = (product: string): number => {
    const productEnvs = ALL_TRACKED_ENVIRONMENTS.filter(e => e.product === product);
    if (productEnvs.length === 0) return 0;
    const succeeded = deployments.filter((d) => 
      productEnvs.some(e => e.adoEnvId === d.environmentId) && d.status === 'deployed'
    ).length
    return Math.round((succeeded / productEnvs.length) * 100)
  }

  const products = ['PLG', 'RDL', 'VIZ'] as const;

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-white flex items-center gap-2">
          <span>🚂</span>
          Deployment Progress
        </h3>
      </div>

      {products.map(product => {
        const envs = ALL_TRACKED_ENVIRONMENTS.filter(e => e.product === product).sort((a,b) => a.order - b.order);
        if (envs.length === 0) return null;

        const progress = getProgressPercentage(product);

        return (
          <div key={product} className="space-y-4">
             {/* Product Header */}
             <div className="flex items-center justify-between border-b border-slate-600 pb-2">
                <h4 className="text-lg font-medium text-blue-400">{product} Pipeline</h4>
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 text-sm">{progress}% deployed</span>
                  <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${progress}%` }}></div>
                  </div>
                </div>
             </div>

             {/* Table */}
             <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-700 text-left">
                      <th className="py-2 px-4 text-slate-400 font-medium text-sm">Environment</th>
                      <th className="py-2 px-4 text-slate-400 font-medium text-sm">Status</th>
                      <th className="py-2 px-4 text-slate-400 font-medium text-sm">Time</th>
                      <th className="py-2 px-4 text-right text-slate-400 font-medium text-sm">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {envs.map(env => {
                      const deployment = getDeploymentForEnv(env);
                      const isDeployed = deployment?.status === 'deployed';
                      
                      return (
                        <tr key={env.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                          <td className="py-3 px-4">
                             <div className="flex items-center gap-2">
                               <span>{isDeployed ? '🟢' : deployment?.status === 'inProgress' ? '🔵' : '⚪'}</span>
                               <span className="text-white">{env.displayName}</span>
                             </div>
                          </td>
                          <td className="py-3 px-4">
                             <StatusBadge status={deployment?.status || 'notDeployed'} size="sm" />
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-sm">
                             {deployment?.timestamp ? new Date(deployment.timestamp).toLocaleString() : '-'}
                          </td>
                          <td className="py-3 px-4 text-right">
                             {deployment?.url && (
                               <a href={deployment.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm">
                                 View Build
                               </a>
                             )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
             </div>
          </div>
        )
      })}
    </div>
  )
}

export default DeploymentTable