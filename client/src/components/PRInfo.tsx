import { PRStatusResponse } from '../types'

interface PRInfoProps {
  prStatus: PRStatusResponse
}

function PRInfo({ prStatus }: PRInfoProps) {
  const { prInfo, commits, parsedUrl } = prStatus

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-blue-500'
      case 'completed':
        return 'bg-green-500'
      case 'abandoned':
        return 'bg-red-500'
      default:
        return 'bg-slate-500'
    }
  }

  const getStatusEmoji = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return '🔄'
      case 'completed':
        return '✅'
      case 'abandoned':
        return '❌'
      default:
        return '❓'
    }
  }

  return (
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      {/* PR Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">📋</span>
            <h2 className="text-xl font-bold text-white">
              PR #{prInfo.id}: {prInfo.title}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-full text-xs font-medium text-white ${getStatusColor(prInfo.status)}`}>
              {getStatusEmoji(prInfo.status)} {prInfo.status}
            </span>
            <span className="text-slate-400 text-sm">
              by {prInfo.createdBy.displayName}
            </span>
            <span className="text-slate-500 text-sm">
              • {new Date(prInfo.creationDate).toLocaleDateString()}
            </span>
          </div>
        </div>
        <a
          href={prInfo.url}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          View PR →
        </a>
      </div>

      {/* PR Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Organization</p>
          <p className="text-white font-medium">{parsedUrl.organization}</p>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Project</p>
          <p className="text-white font-medium">{parsedUrl.project}</p>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Repository</p>
          <p className="text-white font-medium">{parsedUrl.repository}</p>
        </div>
        <div className="bg-slate-700/50 rounded-lg p-3">
          <p className="text-xs text-slate-400 mb-1">Branch</p>
          <p className="text-white font-medium text-sm truncate" title={prInfo.sourceRefName}>
            {prInfo.sourceRefName.replace('refs/heads/', '')}
          </p>
        </div>
      </div>

      {/* Commits Section */}
      {commits.length > 0 && (
        <div className="border-t border-slate-700 pt-4">
          <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <span>📝</span>
            Commits ({commits.length})
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {commits.slice(0, 5).map((commit) => (
              <div
                key={commit.commitId}
                className="flex items-center gap-3 bg-slate-700/30 rounded-lg px-3 py-2"
              >
                <code className="text-xs text-blue-400 font-mono">
                  {commit.commitId.substring(0, 7)}
                </code>
                <p className="text-sm text-slate-300 truncate flex-1" title={commit.comment}>
                  {commit.comment.split('\n')[0]}
                </p>
                <span className="text-xs text-slate-500">
                  {commit.author.name}
                </span>
              </div>
            ))}
            {commits.length > 5 && (
              <p className="text-xs text-slate-500 text-center py-2">
                +{commits.length - 5} more commits
              </p>
            )}
          </div>
        </div>
      )}

      {/* Target Branch Info */}
      <div className="border-t border-slate-700 pt-4 mt-4">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span>🎯</span>
          <span>Target:</span>
          <code className="bg-slate-700 px-2 py-0.5 rounded text-slate-300">
            {prInfo.targetRefName.replace('refs/heads/', '')}
          </code>
          <span className="mx-2">←</span>
          <span>Source:</span>
          <code className="bg-slate-700 px-2 py-0.5 rounded text-slate-300">
            {prInfo.sourceRefName.replace('refs/heads/', '')}
          </code>
        </div>
      </div>
    </div>
  )
}

export default PRInfo