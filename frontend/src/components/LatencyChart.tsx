import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

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
 * Format timestamp for chart display
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Formatted time string
 */
const formatTime = (timestamp: number) => {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

/**
 * Custom tooltip for latency chart
 * @param {Object} props - Tooltip props
 * @returns {JSX.Element | null}
 */
interface TooltipPayload {
  payload: LatencyDataPoint
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) => {
  if (!active || !payload || !payload.length) return null

  const data = payload[0].payload

  if (data.isGap) {
    return (
      <div className="bg-slate-900 border border-slate-600 rounded-lg p-3 shadow-lg">
        <p className="text-red-400 font-semibold">Disconnected</p>
        <p className="text-slate-400 text-xs">No data</p>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg p-3 shadow-lg">
      <p className="text-slate-300 text-sm">{formatTime(data.timestamp)}</p>
      <p className="text-blue-400 font-semibold">{data.latency.toFixed(2)} ms</p>
    </div>
  )
}

/**
 * Calculate average latency (excluding gaps)
 * @param {LatencyDataPoint[]} data - Array of latency data points
 * @returns {number} Average latency in milliseconds
 */
const calculateAverage = (data: LatencyDataPoint[]) => {
  const validData = data.filter(point => !point.isGap)
  if (validData.length === 0) return 0
  const sum = validData.reduce((acc: number, point: LatencyDataPoint) => acc + point.latency, 0)
  return sum / validData.length
}

interface LatencyChartProps {
  data: LatencyDataPoint[]
  terminationMarkers: TerminationMarker[]
}

/**
 * Latency chart component displaying real-time WebSocket latency
 * @param {Object} props
 * @param {LatencyDataPoint[]} props.data - Array of latency measurements
 * @param {TerminationMarker[]} props.terminationMarkers - Array of pod termination events
 * @returns {JSX.Element}
 */
function LatencyChart({ data, terminationMarkers }: LatencyChartProps) {
  // Use state for stable Y-axis domain
  const [yDomain, setYDomain] = useState<[number, number]>([0, 100])

  // Update current time only when new data arrives (not on interval)
  const [currentTime, setCurrentTime] = useState(Date.now())

  // Update time when data changes - use last data point timestamp
  useEffect(() => {
    if (data.length > 0) {
      const lastPoint = data[data.length - 1]
      setCurrentTime(lastPoint.timestamp)
    }
  }, [data])

  const avgLatency = calculateAverage(data)
  const validData = data.filter(point => !point.isGap)
  const currentLatency = validData.length > 0 ? validData[validData.length - 1].latency : 0

  // Transform data to show gaps as null values (breaks in the line)
  const chartData = data.map(point => ({
    ...point,
    latency: point.isGap ? null : point.latency
  }))

  // Calculate domain for smooth scrolling
  const timeWindow = 60000 // 60 seconds window
  const xDomain: [number, number] = [currentTime - timeWindow, currentTime]

  // Filter data to only show points within the visible window
  const visibleData = chartData.filter(point =>
    point.timestamp >= xDomain[0] && point.timestamp <= xDomain[1]
  )

  // Calculate Y domain with stable padding - only update if significantly different
  useEffect(() => {
    const visibleValidData = visibleData.filter(point => !point.isGap && point.latency !== null)
    const latencies = visibleValidData.map(d => d.latency as number)
    const maxLatency = latencies.length > 0 ? Math.max(...latencies) : 100
    const newMax = Math.max(Math.ceil(maxLatency * 1.3 / 50) * 50, 50) // Round to nearest 50ms

    // Only update if change is significant (>20%) to prevent jitter
    if (Math.abs(newMax - yDomain[1]) / yDomain[1] > 0.2) {
      setYDomain([0, newMax])
    }
  }, [visibleData.length])

  // Filter termination markers to only show visible ones
  const visibleMarkers = terminationMarkers.filter(marker =>
    marker.timestamp >= xDomain[0] && marker.timestamp <= xDomain[1]
  )

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Real-Time Latency
        </h2>
        <div className="flex gap-4">
          <div className="text-center px-6 py-3 bg-gradient-to-br from-blue-900/40 to-blue-800/40 border border-blue-500/30 rounded-lg shadow-lg backdrop-blur-sm">
            <p className="text-slate-400 text-xs uppercase tracking-wide font-semibold mb-1">Current</p>
            <p className="text-2xl font-bold text-blue-300">{currentLatency.toFixed(2)} <span className="text-sm text-blue-400">ms</span></p>
          </div>
          <div className="text-center px-6 py-3 bg-gradient-to-br from-purple-900/40 to-purple-800/40 border border-purple-500/30 rounded-lg shadow-lg backdrop-blur-sm">
            <p className="text-slate-400 text-xs uppercase tracking-wide font-semibold mb-1">Average</p>
            <p className="text-2xl font-bold text-purple-300">{avgLatency.toFixed(2)} <span className="text-sm text-purple-400">ms</span></p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-slate-900/70 to-slate-800/70 rounded-lg p-6 border border-slate-700/30 shadow-inner">
        {data.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500">
            <svg className="w-16 h-16 mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-lg font-medium">No data yet</p>
            <p className="text-sm text-slate-600">Connect to start monitoring</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={visibleData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <defs>
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="50%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis
                dataKey="timestamp"
                domain={xDomain}
                type="number"
                tickFormatter={formatTime}
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                scale="time"
              />
              <YAxis
                domain={yDomain}
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft', fill: '#94a3b8' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="latency"
                stroke="url(#lineGradient)"
                strokeWidth={3}
                dot={false}
                connectNulls={false}
                isAnimationActive={false}
              />

              {/* Add termination markers as vertical lines */}
              {visibleMarkers.map((marker, index) => (
                <ReferenceLine
                  key={`termination-${index}`}
                  x={marker.timestamp}
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  label={{
                    value: `Pod Terminated`,
                    position: 'top',
                    fill: '#ef4444',
                    fontSize: 11,
                    fontWeight: 'bold'
                  }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

export default LatencyChart
