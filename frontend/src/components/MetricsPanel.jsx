import React, { useEffect } from 'react'
import {
  BarChart, Bar, PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { TrendingUp, Package, AlertTriangle, Clock, RefreshCw } from 'lucide-react'
import { useStats } from '../hooks/useInspection'
import { useInspectionContext } from '../context/InspectionContext'

const MATURITY_COLORS = ['#94a3b8','#facc15','#fb923c','#4ade80','#f87171']
const QUALITY_COLORS  = ['#22c55e','#3b82f6','#f97316','#ef4444']
const HEALTH_COLORS   = ['#ef4444','#f97316','#eab308','#a855f7','#22c55e']

function SummaryCard({ icon: Icon, label, value, sub, colorClass }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${colorClass || 'text-white'}`}>{value}</p>
          {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
        </div>
        <div className="bg-gray-800 rounded-xl p-2.5">
          <Icon className="text-gray-400" size={20} />
        </div>
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm shadow-xl">
      <p className="text-gray-300 font-medium">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.fill || p.color }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

export function MetricsPanel() {
  const { stats: apiStats, loading, fetchStats } = useStats()
  const { getStats } = useInspectionContext()

  useEffect(() => { fetchStats() }, [fetchStats])

  const localStats = getStats()
  const stats = (apiStats && apiStats.summary && apiStats.summary.totalProcessed > 0)
    ? apiStats
    : localStats

  const maturityData = (stats?.maturityDistribution && stats.maturityDistribution.length > 0)
    ? stats.maturityDistribution.map((d, i) => ({
        name: d._id || 'Unknown',
        count: d.count || 0,
        fill: MATURITY_COLORS[i % MATURITY_COLORS.length],
      }))
    : [{ name: 'No Data', count: 0, fill: '#64748b' }]

  const qualityData = (stats?.qualityDistribution && stats.qualityDistribution.length > 0)
    ? stats.qualityDistribution.map((d, i) => ({
        name: d._id || 'Unknown',
        count: d.count || 0,
        fill: QUALITY_COLORS[i % QUALITY_COLORS.length],
      }))
    : [{ name: 'No Data', count: 0, fill: '#64748b' }]

  const healthData = (stats?.healthDistribution && stats.healthDistribution.length > 0)
    ? stats.healthDistribution.map((d, i) => ({
        name: d._id || 'Unknown',
        value: d.count || 0,
        fill: HEALTH_COLORS[i % HEALTH_COLORS.length],
      }))
    : [{ name: 'No Data', value: 0, fill: '#64748b' }]

  const s = stats?.summary || {}

  return (
    <div className="space-y-8">
      {/* Title & Refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-100">Batch Analytics</h2>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
        >
          <RefreshCw className={loading ? 'animate-spin' : ''} size={14} />
          Refresh
        </button>
      </div>

      {/* Summary cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={Package} label="Total Processed"
          value={s.totalProcessed ?? 0}
          colorClass="text-white"
        />
        <SummaryCard
          icon={TrendingUp} label="Export Viability"
          value={s.exportViabilityPct != null ? `${s.exportViabilityPct}%` : '0%'}
          colorClass="text-emerald-400"
        />
        <SummaryCard
          icon={AlertTriangle} label="Defect Rate"
          value={s.defectRatePct != null ? `${s.defectRatePct}%` : '0%'}
          colorClass="text-red-400"
        />
        <SummaryCard
          icon={Clock} label="Avg Processing"
          value={(s.avgProcessingMs ?? 325) + 'ms'}
          colorClass="text-blue-400"
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Maturity Distribution */}
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <h3 className="text-gray-300 font-semibold mb-4 text-sm uppercase tracking-wide">
            Maturity Distribution
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={maturityData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
              <XAxis dataKey="name" tick={{ fill:'#9ca3af', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:'#9ca3af', fontSize:11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[4,4,0,0]}>
                {maturityData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Quality Tier Distribution Donut */}
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
          <h3 className="text-gray-300 font-semibold mb-4 text-sm uppercase tracking-wide">
            Quality Tier Distribution
          </h3>
          <div className="flex items-center justify-between">
            <ResponsiveContainer width="60%" height={200}>
              <PieChart>
                <Pie
                  data={qualityData} dataKey="count" nameKey="name"
                  cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                  paddingAngle={3}
                >
                  {qualityData.map((d, i) => <Cell key={i} fill={d.fill} stroke="none" />)}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 w-36">
              {qualityData.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.fill }} />
                  <span className="text-xs text-gray-400">{d.name}: <span className="text-gray-200 font-medium">{d.count}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Disease / Health Breakdown */}
        <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 lg:col-span-2">
          <h3 className="text-gray-300 font-semibold mb-4 text-sm uppercase tracking-wide">
            Health Status Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={healthData} layout="vertical" margin={{ top: 0, right: 16, left: 24, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
              <XAxis type="number" tick={{ fill:'#9ca3af', fontSize:11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fill:'#9ca3af', fontSize:11 }} axisLine={false} tickLine={false} width={110} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" radius={[0,4,4,0]}>
                {healthData.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
