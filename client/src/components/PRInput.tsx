import { useState } from 'react'

interface PRInputProps {
  onSubmit: (prUrl: string, pat: string) => void
  loading: boolean
}

function PRInput({ onSubmit, loading }: PRInputProps) {
  const [prUrl, setPrUrl] = useState('')
  const [pat, setPat] = useState('')
  const [showPat, setShowPat] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (prUrl.trim() && pat.trim()) {
      onSubmit(prUrl.trim(), pat.trim())
    }
  }

  const isValidUrl = (url: string): boolean => {
    // Basic validation for ADO PR URL
    const patterns = [
      /https:\/\/dev\.azure\.com\/[^/]+\/[^/]+\/_git\/[^/]+\/pullrequest\/\d+/,
      /https:\/\/[^.]+\.visualstudio\.com\/[^/]+\/_git\/[^/]+\/pullrequest\/\d+/,
    ]
    return patterns.some(pattern => pattern.test(url))
  }

  const urlValid = prUrl === '' || isValidUrl(prUrl)

  return (
    <form onSubmit={handleSubmit} className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <div className="space-y-4">
        {/* PR URL Input */}
        <div>
          <label htmlFor="prUrl" className="block text-sm font-medium text-slate-300 mb-2">
            Pull Request URL
          </label>
          <input
            type="url"
            id="prUrl"
            value={prUrl}
            onChange={(e) => setPrUrl(e.target.value)}
            placeholder="https://dev.azure.com/org/project/_git/repo/pullrequest/123"
            className={`w-full px-4 py-3 bg-slate-700 border rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
              urlValid ? 'border-slate-600' : 'border-red-500'
            }`}
            disabled={loading}
          />
          {!urlValid && (
            <p className="mt-1 text-sm text-red-400">
              Please enter a valid Azure DevOps PR URL
            </p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            Example: https://dev.azure.com/organization/project/_git/repository/pullrequest/123
          </p>
        </div>

        {/* PAT Input */}
        <div>
          <label htmlFor="pat" className="block text-sm font-medium text-slate-300 mb-2">
            Personal Access Token (PAT)
          </label>
          <div className="relative">
            <input
              type={showPat ? 'text' : 'password'}
              id="pat"
              value={pat}
              onChange={(e) => setPat(e.target.value)}
              placeholder="Enter your Azure DevOps PAT"
              className="w-full px-4 py-3 pr-12 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPat(!showPat)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300"
            >
              {showPat ? '🙈' : '👁️'}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Required scopes: <code className="bg-slate-700 px-1 rounded">vso.code</code>,{' '}
            <code className="bg-slate-700 px-1 rounded">vso.build</code>,{' '}
            <code className="bg-slate-700 px-1 rounded">vso.release</code>
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !prUrl.trim() || !pat.trim() || !urlValid}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="animate-spin">⏳</span>
              Checking Status...
            </>
          ) : (
            <>
              <span>🔍</span>
              Check Deployment Status
            </>
          )}
        </button>
      </div>

      {/* Security Notice */}
      <div className="mt-4 p-3 bg-slate-700/50 rounded-lg border border-slate-600">
        <p className="text-xs text-slate-400 flex items-start gap-2">
          <span className="text-yellow-500">🔒</span>
          <span>
            Your PAT is sent securely to our backend server and is never stored. 
            It's only used to make API calls to Azure DevOps on your behalf.
          </span>
        </p>
      </div>
    </form>
  )
}

export default PRInput