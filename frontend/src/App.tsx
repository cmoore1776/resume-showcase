import { useState, useEffect, useRef, useCallback } from 'react'
import LatencyChart from './components/LatencyChart'
import ConnectionStatus from './components/ConnectionStatus'

/**
 * @typedef {Object} LatencyDataPoint
 * @property {number} timestamp - Timestamp in milliseconds
 * @property {number} latency - Latency in milliseconds
 * @property {boolean} [isGap] - Whether this point represents a gap in data
 */
interface LatencyDataPoint {
  timestamp: number
  latency: number
  isGap?: boolean
}

/**
 * @typedef {Object} TerminationMarker
 * @property {number} timestamp - Timestamp when pod was terminated
 * @property {string} podName - Name of the terminated pod
 */
interface TerminationMarker {
  timestamp: number
  podName: string
}

/**
 * @typedef {'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'} ConnectionState
 */
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error'

// Use environment variable for API URLs, fallback to localhost for development
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8081'
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080'
const PING_INTERVAL = 1000 // Send ping every second

function App() {
  /** @type {[ConnectionState, Function]} */
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>('disconnected')

  /** @type {[LatencyDataPoint[], Function]} */
  const [latencyData, setLatencyData] = useState<LatencyDataPoint[]>([])

  /** @type {[TerminationMarker[], Function]} */
  const [terminationMarkers, setTerminationMarkers] = useState<TerminationMarker[]>([])

  /** @type {[string | null, Function]} */
  const [podName, setPodName] = useState<string | null>(null)

  /** @type {[string | null, Function]} */
  const [region, setRegion] = useState<string | null>(null)

  /** @type {[string | null, Function]} */
  const [error, setError] = useState<string | null>(null)

  /** @type {React.MutableRefObject<WebSocket | null>} */
  const wsRef = useRef<WebSocket | null>(null)

  /** @type {React.MutableRefObject<number | null>} */
  const pingIntervalRef = useRef<number | null>(null)

  /** @type {React.MutableRefObject<Map<string, number>>} */
  const pendingPingsRef = useRef<Map<string, number>>(new Map())

  /** @type {React.MutableRefObject<number | null>} */
  const lastSuccessfulPingRef = useRef<number | null>(null)

  /**
   * Calculate latency from ping/pong
   * @param {string} clientTimestamp - ISO timestamp from ping
   * @returns {number} Latency in milliseconds
   */
  const calculateLatency = useCallback((clientTimestamp: string) => {
    const sentTime = pendingPingsRef.current.get(clientTimestamp)
    if (!sentTime) return 0

    const now = Date.now()
    const latency = now - sentTime

    // Clean up old pending pings
    pendingPingsRef.current.delete(clientTimestamp)

    return latency
  }, [])

  /**
   * Send ping to server
   */
  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const timestamp = new Date().toISOString()
      const sentTime = Date.now()

      pendingPingsRef.current.set(timestamp, sentTime)

      wsRef.current.send(JSON.stringify({
        type: 'ping',
        timestamp
      }))
    }
  }, [])

  /**
   * Handle WebSocket messages
   * @param {MessageEvent} event - WebSocket message event
   */
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)

      if (data.type === 'pong') {
        const latency = calculateLatency(data.client_timestamp)
        const now = Date.now()

        setPodName(data.pod_name)
        setRegion(data.region)

        setLatencyData(prev => {
          const newData = [...prev]

          // If this is the first pong after reconnection (there's a gap at the end)
          // Add a reconnection gap marker
          const lastPoint = newData[newData.length - 1]
          if (lastPoint && lastPoint.isGap && lastSuccessfulPingRef.current) {
            // Add another gap point just before reconnection to create visual gap
            newData.push({
              timestamp: now - 500,
              latency: 0,
              isGap: true
            })
          }

          // Add the current data point
          newData.push({
            timestamp: now,
            latency,
            isGap: false
          })

          // Keep only last 60 data points (1 minute at 1 ping/sec)
          return newData.slice(-60)
        })

        lastSuccessfulPingRef.current = now
      } else if (data.type === 'terminating') {
        // Marker was already added when terminate button was clicked
        setConnectionStatus('reconnecting')
        setError('Pod terminating, reconnecting...')
      } else if (data.type === 'error') {
        setError(data.message)
      }
    } catch (err) {
      console.error('Error parsing message:', err)
    }
  }, [calculateLatency, podName])

  /**
   * Create a new session and get WebSocket URL
   */
  const createSession = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Session creation failed: ${response.statusText}`)
      }

      const data = await response.json()
      console.log('Session created:', data.session_id)
      return data.websocket_url || `${WS_BASE_URL}`
    } catch (err) {
      console.error('Failed to create session:', err)
      throw err
    }
  }, [])

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    // Keep reconnecting status if we're already reconnecting
    setConnectionStatus(prev => prev === 'reconnecting' ? 'reconnecting' : 'connecting')
    // Only clear error if not reconnecting
    setError(prev => connectionStatus === 'reconnecting' ? prev : null)

    try {
      // Try to create session first, fall back to direct connection if unavailable
      let wsUrl = WS_BASE_URL
      try {
        if (API_BASE_URL !== 'http://localhost:8081') {
          wsUrl = await createSession()
        }
      } catch (sessionError) {
        console.warn('Session provisioning unavailable, using direct connection:', sessionError)
        // Fall back to direct WebSocket connection
        wsUrl = WS_BASE_URL
      }

      const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      setConnectionStatus('connected')
      setError(null)

      // Start sending pings
      pingIntervalRef.current = setInterval(sendPing, PING_INTERVAL)
    }

    ws.onmessage = handleMessage

    ws.onerror = () => {
      setConnectionStatus('error')
      setError('WebSocket connection error')
    }

    ws.onclose = () => {
      // Only change to disconnected if not already in reconnecting state
      setConnectionStatus(prev => prev === 'reconnecting' ? 'reconnecting' : 'disconnected')

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = null
      }

      // Add a gap point to mark disconnection on the chart
      if (lastSuccessfulPingRef.current) {
        setLatencyData(prev => {
          const disconnectTime = Date.now()
          // Only add gap if there was data before
          if (prev.length > 0) {
            return [...prev, {
              timestamp: disconnectTime,
              latency: 0,
              isGap: true
            }]
          }
          return prev
        })
      }

      // Auto-reconnect after 2 seconds
      setTimeout(() => {
        if (wsRef.current === ws) {
          connect()
        }
      }, 2000)
    }

    wsRef.current = ws
    } catch (err) {
      console.error('Connection error:', err)
      setConnectionStatus('error')
      setError(err instanceof Error ? err.message : 'Failed to connect')
    }
  }, [handleMessage, sendPing, connectionStatus, createSession])

  /**
   * Terminate the pod
   */
  const terminatePod = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Add termination marker BEFORE sending terminate command
      const currentPodName = podName || 'Unknown Pod'
      const terminationTime = Date.now()

      setTerminationMarkers(prev => [...prev, {
        timestamp: terminationTime,
        podName: currentPodName
      }])

      // Send terminate command
      wsRef.current.send(JSON.stringify({
        type: 'terminate'
      }))
    }
  }, [podName])

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setConnectionStatus('disconnected')
    setLatencyData([])
    setTerminationMarkers([])
    setPodName(null)
    setRegion(null)
    lastSuccessfulPingRef.current = null
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white relative overflow-hidden">
      {/* Animated background gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }}></div>
      </div>

      <div className="container mx-auto px-4 py-8 relative z-10">
        <header className="text-center mb-12 animate-float">
          <h1 className="text-6xl font-bold mb-4 bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-500 bg-clip-text text-transparent drop-shadow-lg">
            Auto-Recovering Latency Test
          </h1>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed">
            Real-time WebSocket latency monitoring demonstrating Kubernetes self-healing and cloud infrastructure automation
          </p>
          <div className="mt-6 flex justify-center gap-2 flex-wrap max-w-3xl mx-auto">
            <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-300 text-sm font-medium">AWS</span>
            <span className="px-3 py-1 bg-purple-500/10 border border-purple-500/30 rounded-full text-purple-300 text-sm font-medium">EKS</span>
            <span className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-300 text-sm font-medium">Terraform</span>
            <span className="px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full text-green-300 text-sm font-medium">Kubernetes</span>
            <span className="px-3 py-1 bg-orange-500/10 border border-orange-500/30 rounded-full text-orange-300 text-sm font-medium">Docker</span>
            <span className="px-3 py-1 bg-pink-500/10 border border-pink-500/30 rounded-full text-pink-300 text-sm font-medium">Python</span>
            <span className="px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-yellow-300 text-sm font-medium">React</span>
            <span className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/30 rounded-full text-indigo-300 text-sm font-medium">GitHub Actions</span>
          </div>
        </header>

        <div className="max-w-6xl mx-auto space-y-6">
          <ConnectionStatus
            status={connectionStatus}
            podName={podName}
            region={region}
            error={error}
          />

          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-8 shadow-2xl shadow-blue-900/20 hover:shadow-blue-900/30 transition-all duration-300">
            <div className="flex gap-4 justify-center mb-8 flex-wrap">
              <button
                onClick={connectionStatus === 'connected' ? disconnect : connect}
                disabled={connectionStatus === 'connecting' || connectionStatus === 'reconnecting'}
                className={`group relative px-8 py-3 rounded-lg font-semibold transition-all duration-300 shadow-lg transform hover:scale-105 disabled:scale-100 disabled:cursor-not-allowed ${
                  connectionStatus === 'connected'
                    ? 'bg-slate-700 hover:bg-slate-600 hover:shadow-slate-500/30'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 hover:shadow-blue-500/50 disabled:from-slate-700 disabled:to-slate-700 disabled:shadow-none'
                }`}
              >
                <span className="relative z-10">
                  {connectionStatus === 'connecting' ? 'Connecting...' :
                   connectionStatus === 'reconnecting' ? 'Reconnecting...' :
                   connectionStatus === 'connected' ? 'Disconnect' : 'Connect'}
                </span>
                {connectionStatus !== 'connected' && connectionStatus !== 'connecting' && connectionStatus !== 'reconnecting' && (
                  <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-blue-400 to-cyan-400 opacity-0 group-hover:opacity-20 blur transition-opacity"></span>
                )}
              </button>

              <button
                onClick={terminatePod}
                disabled={connectionStatus !== 'connected'}
                className="group relative px-8 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-all duration-300 shadow-lg hover:shadow-red-500/50 disabled:shadow-none transform hover:scale-105 disabled:scale-100"
              >
                <span className="relative z-10">Terminate Pod</span>
                {connectionStatus === 'connected' && (
                  <span className="absolute inset-0 rounded-lg bg-gradient-to-r from-red-400 to-orange-400 opacity-0 group-hover:opacity-20 blur transition-opacity"></span>
                )}
              </button>
            </div>

            <LatencyChart
              data={latencyData}
              terminationMarkers={terminationMarkers}
            />
          </div>

          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-xl p-8 shadow-2xl shadow-purple-900/10">
            <h3 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Technical Architecture
            </h3>

            <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/20">
              <h4 className="text-lg font-semibold text-blue-300 mb-3">Cloud Infrastructure & DevOps</h4>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <p className="text-slate-300 text-sm"><strong className="text-blue-200">AWS EKS</strong> - Managed Kubernetes cluster with auto-scaling node groups</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <p className="text-slate-300 text-sm"><strong className="text-blue-200">Terraform</strong> - Infrastructure as Code for VPC, EKS, ALB, ACM, ECR, and IAM</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <p className="text-slate-300 text-sm"><strong className="text-blue-200">Application Load Balancer</strong> - HTTPS/WSS termination with path-based routing</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <p className="text-slate-300 text-sm"><strong className="text-blue-200">AWS Certificate Manager</strong> - TLS/SSL certificate management</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <p className="text-slate-300 text-sm"><strong className="text-blue-200">VPC Networking</strong> - Multi-AZ setup with public/private subnets and NAT gateways</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <p className="text-slate-300 text-sm"><strong className="text-blue-200">Security Groups</strong> - Network-level security with least-privilege access</p>
                </div>
              </div>
            </div>

            <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-500/20">
              <h4 className="text-lg font-semibold text-purple-300 mb-3">Container Orchestration</h4>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <span className="text-purple-400 mt-1">•</span>
                  <p className="text-slate-300 text-sm"><strong className="text-purple-200">Kubernetes Deployments</strong> - Declarative pod management with self-healing</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-400 mt-1">•</span>
                  <p className="text-slate-300 text-sm"><strong className="text-purple-200">Docker Containerization</strong> - Multi-stage builds with ECR registry</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-400 mt-1">•</span>
                  <p className="text-slate-300 text-sm"><strong className="text-purple-200">Service Mesh</strong> - NodePort services with health checks and load balancing</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-purple-400 mt-1">•</span>
                  <p className="text-slate-300 text-sm"><strong className="text-purple-200">Resource Management</strong> - CPU/memory limits and requests for optimal scheduling</p>
                </div>
              </div>
            </div>

            <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-cyan-900/20 to-green-900/20 border border-cyan-500/20">
              <h4 className="text-lg font-semibold text-cyan-300 mb-3">CI/CD & Automation</h4>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  <p className="text-slate-300 text-sm"><strong className="text-cyan-200">GitHub Actions</strong> - Automated build, test, and deployment pipelines</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  <p className="text-slate-300 text-sm"><strong className="text-cyan-200">OIDC Authentication</strong> - Secure, keyless deployments using IAM roles</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  <p className="text-slate-300 text-sm"><strong className="text-cyan-200">GitOps Workflow</strong> - Infrastructure and application changes via Git</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-cyan-400 mt-1">•</span>
                  <p className="text-slate-300 text-sm"><strong className="text-cyan-200">Automated Testing</strong> - Pre-deployment validation and health checks</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-gradient-to-r from-orange-900/20 to-yellow-900/20 border border-orange-500/20">
              <h4 className="text-lg font-semibold text-orange-300 mb-3">Application Stack</h4>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">•</span>
                  <p className="text-slate-300 text-sm"><strong className="text-orange-200">Python Backend</strong> - Async WebSocket server with graceful shutdown</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">•</span>
                  <p className="text-slate-300 text-sm"><strong className="text-orange-200">React Frontend</strong> - TypeScript SPA with real-time data visualization</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">•</span>
                  <p className="text-slate-300 text-sm"><strong className="text-orange-200">WebSocket Protocol</strong> - Bi-directional, low-latency communication</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-orange-400 mt-1">•</span>
                  <p className="text-slate-300 text-sm"><strong className="text-orange-200">Vite Build System</strong> - Modern, fast frontend tooling with HMR</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
