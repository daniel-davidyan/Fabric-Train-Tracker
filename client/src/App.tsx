import { useState, useCallback } from 'react'
import PRInput from './components/PRInput'
import PRInfo from './components/PRInfo'
import DeploymentPipeline from './components/DeploymentPipeline'
import { LogStream, LogEntry } from './components/LogStream'
import { PRStatusResponse } from './types'
import { parsePRUrl } from './services/urlParser'
import { createADOService } from './services/adoService'

function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prStatus, setPrStatus] = useState<PRStatusResponse | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])

  // Helper to add log entries
  const addLog = useCallback((type: LogEntry['type'], message: string, details?: string) => {
    setLogs(prev => [...prev, {
      id: Date.now() + Math.random(),
      timestamp: new Date(),
      type,
      message,
      details,
    }])
  }, [])

  const handleSubmit = async (prUrl: string, pat: string) => {
    setLoading(true)
    setError(null)
    setPrStatus(null)
    setLogs([])

    try {
      // Parse the PR URL
      addLog('info', 'Parsing PR URL...', prUrl)
      const parsedUrl = parsePRUrl(prUrl)
      addLog('success', 'URL parsed successfully', `PR #${parsedUrl.pullRequestId}`)

      // Create ADO service instance
      addLog('info', 'Connecting to Azure DevOps...')
      const adoService = createADOService(pat, parsedUrl)

      // Fetch PR details
      addLog('check', 'Fetching PR details...', `${parsedUrl.organization}/${parsedUrl.project}`)
      const prInfo = await adoService.getPullRequest()
      addLog('success', `PR: ${prInfo.title}`)
      addLog('info', `Status: ${prInfo.status}`)
      
      if (prInfo.closedDate) {
        addLog('info', `Merged: ${new Date(prInfo.closedDate).toLocaleString()}`)
      }
      
      if (prInfo.mergeCommitId) {
        addLog('info', `Merge commit: ${prInfo.mergeCommitId.substring(0, 7)}`)
      }

      // Fetch commits
      addLog('check', 'Fetching PR commits...')
      const commits = await adoService.getPRCommits()
      const commitIds = commits.map(c => c.commitId)
      addLog('success', `Found ${commits.length} commits`)
      commits.slice(0, 3).forEach(c => {
        addLog('info', `  ${c.commitId.substring(0, 7)}`, c.comment?.substring(0, 50))
      })

      // Fetch builds for the source branch
      addLog('check', `Fetching builds for branch...`, prInfo.sourceRefName.replace('refs/heads/', ''))
      const builds = await adoService.getBuildsForBranch(prInfo.sourceRefName)
      addLog('success', `Found ${builds.length} related builds`)

      // Fetch deployments
      addLog('check', 'Starting deployment verification...')
      addLog('info', '🚂 Checking PLG environments (train-based deployment)...')
      
      const deployments = await adoService.getAllDeployments(
        prInfo.sourceRefName,
        prInfo.title,
        commitIds,
        prInfo.creationDate,
        prInfo.closedDate,
        prInfo.mergeCommitId,
        prInfo.targetRefName,
        prInfo.repository.id
      )

      // Log deployment results
      deployments.forEach(dep => {
        if (dep.status === 'deployed') {
          addLog('success', `✅ ${dep.environment}: DEPLOYED`, dep.timestamp ? new Date(dep.timestamp).toLocaleString() : '')
        } else if (dep.status === 'waitingForTrain') {
          addLog('warning', `⏳ ${dep.environment}: Waiting for train`)
        } else if (dep.status === 'notDeployed') {
          addLog('info', `⬜ ${dep.environment}: Not deployed`)
        } else {
          addLog('info', `❓ ${dep.environment}: ${dep.status}`)
        }
      })

      // Build response
      const response: PRStatusResponse = {
        prInfo,
        commits,
        builds,
        deployments,
        parsedUrl,
      }

      setPrStatus(response)
      addLog('success', '🏁 Deployment check complete!')

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred'
      addLog('error', 'Error occurred', errorMessage)
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-3">
            <span className="text-4xl">🚂</span>
            Train Tracker
          </h1>
          <p className="text-slate-400 text-lg">
            Track your PR deployment status across Fabric environments
          </p>
        </div>

        {/* Input Form */}
        <div className="mb-6">
          <PRInput onSubmit={handleSubmit} loading={loading} />
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-6 py-4 rounded-lg mb-6">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <span className="font-semibold">Error:</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Log Stream - Show when loading or has logs */}
        {(loading || logs.length > 0) && (
          <div className="mb-6">
            <LogStream logs={logs} isRunning={loading} />
          </div>
        )}

        {/* Results */}
        {prStatus && !loading && (
          <div className="space-y-6">
            {/* PR Info Card */}
            <PRInfo prStatus={prStatus} />

            {/* Deployment Pipeline */}
            <DeploymentPipeline 
              deployments={prStatus.deployments} 
              prMergeDate={prStatus.prInfo.closedDate}
            />

            {/* Builds Info */}
            {prStatus.builds.length > 0 && (
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <span>🔨</span>
                  Related Builds
                </h3>
                <div className="space-y-3">
                  {prStatus.builds.slice(0, 5).map((build) => (
                    <div
                      key={build.id}
                      className="flex items-center justify-between bg-slate-700/50 rounded-lg px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-3 h-3 rounded-full ${
                            build.result === 'succeeded'
                              ? 'bg-green-500'
                              : build.result === 'failed'
                              ? 'bg-red-500'
                              : build.status === 'inProgress'
                              ? 'bg-yellow-500 animate-pulse'
                              : 'bg-slate-500'
                          }`}
                        ></span>
                        <span className="text-white font-medium">
                          {build.definition.name}
                        </span>
                        <span className="text-slate-400">#{build.buildNumber}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-slate-400 text-sm">
                          {new Date(build.finishTime || build.startTime).toLocaleString()}
                        </span>
                        {build._links?.web?.href && (
                          <a
                            href={build._links.web.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-sm"
                          >
                            View →
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 text-center text-slate-500 text-sm">
          <p>
            Train Tracker - Fabric Deployment Status Viewer
          </p>
          <p className="mt-1">
            <a
              href="https://aka.ms/pbitrains"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300"
            >
              View Train Schedule Status →
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}

export default App