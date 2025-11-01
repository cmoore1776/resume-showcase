/**
 * @typedef {'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'} ConnectionState
 */
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

/**
 * Get status display configuration
 * @param {ConnectionState} status - Current connection status
 * @returns {Object} Status configuration with color and text
 */
const getStatusConfig = (status: ConnectionState) => {
  const configs = {
    disconnected: {
      color: 'bg-slate-600',
      text: 'Disconnected',
      icon: '○'
    },
    connecting: {
      color: 'bg-yellow-500 animate-pulse',
      text: 'Connecting...',
      icon: '◐'
    },
    reconnecting: {
      color: 'bg-orange-500 animate-pulse',
      text: 'Reconnecting...',
      icon: '◑'
    },
    connected: {
      color: 'bg-green-500',
      text: 'Connected',
      icon: '●'
    },
    error: {
      color: 'bg-red-500',
      text: 'Error',
      icon: '✕'
    }
  }

  return configs[status] || configs.disconnected
}

interface ConnectionStatusProps {
  status: ConnectionState
  podName: string | null
  error: string | null
}

/**
 * Connection status component showing WebSocket state and pod information
 * @param {Object} props
 * @param {ConnectionState} props.status - Current connection status
 * @param {string | null} props.podName - Name of the connected pod
 * @param {string | null} props.error - Error message if any
 * @returns {JSX.Element}
 */
function ConnectionStatus({ status, podName, error }: ConnectionStatusProps) {
  const config = getStatusConfig(status)

  return (
    <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-6 shadow-2xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div className={`w-3 h-3 rounded-full ${config.color} shadow-lg`}></div>
            <span className="text-lg font-semibold">{config.text}</span>
          </div>

          {podName && (
            <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-blue-900/30 to-cyan-900/30 border border-blue-500/30 rounded-lg animate-glow">
              <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
              <span className="text-slate-400 font-medium">Pod:</span>
              <code className="text-blue-300 font-mono text-sm font-semibold">{podName}</code>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 px-4 py-2 bg-red-900/30 border border-red-500/50 rounded-lg shadow-lg shadow-red-900/20 animate-pulse">
            <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-red-300 font-medium">{error}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConnectionStatus
