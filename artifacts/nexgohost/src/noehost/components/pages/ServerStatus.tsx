import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, RefreshCw, Activity, Server, Globe, Shield } from 'lucide-react';

interface ServerNode {
  id: string;
  name: string;
  type: string;
  sortOrder: number;
  status: 'online' | 'offline';
}

interface StatusSummary {
  total: number;
  online: number;
  offline: number;
  allOperational: boolean;
}

interface StatusData {
  nodes: ServerNode[];
  summary: StatusSummary;
  updatedAt: number;
}

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function getTypeIcon(type: string) {
  switch (type) {
    case 'hosting': return <Server className="w-4 h-4" />;
    case 'dns': return <Globe className="w-4 h-4" />;
    case 'ssl': return <Shield className="w-4 h-4" />;
    default: return <Activity className="w-4 h-4" />;
  }
}

const ServerStatus: React.FC = () => {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('—');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/status/nodes');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      if (json.updatedAt) setLastUpdated(timeAgo(json.updatedAt));
    } catch {
      // silent fail — keep showing cached data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    if (!data?.updatedAt) return;
    const interval = setInterval(() => {
      setLastUpdated(timeAgo(data.updatedAt));
    }, 10_000);
    return () => clearInterval(interval);
  }, [data?.updatedAt]);

  const sorted = data?.nodes ? [...data.nodes].sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const allOk = data?.summary?.allOperational;

  return (
    <div className="min-h-screen bg-dark">
      <div className="max-w-4xl mx-auto px-4 py-16">

        {/* Header */}
        <div className="text-center mb-12">
          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-6 ${
            loading
              ? 'bg-slate-800 text-slate-400'
              : allOk
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : allOk ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            {loading ? 'Loading status...' : allOk ? 'All Systems Operational' : 'Some Systems Degraded'}
          </div>

          <h1 className="text-4xl font-black text-white mb-3">System Status</h1>
          <p className="text-slate-400 font-medium">
            Real-time status of all NoeHost infrastructure services
          </p>
        </div>

        {/* Summary Cards */}
        {data?.summary && (
          <div className="grid grid-cols-3 gap-4 mb-10">
            <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-5 text-center">
              <div className="text-3xl font-black text-white mb-1">{data.summary.total}</div>
              <div className="text-slate-500 text-sm font-medium">Total Services</div>
            </div>
            <div className="bg-green-500/5 border border-green-500/20 rounded-2xl p-5 text-center">
              <div className="text-3xl font-black text-green-400 mb-1">{data.summary.online}</div>
              <div className="text-slate-500 text-sm font-medium">Online</div>
            </div>
            <div className={`rounded-2xl p-5 text-center ${
              data.summary.offline > 0
                ? 'bg-red-500/5 border border-red-500/20'
                : 'bg-slate-900/60 border border-white/5'
            }`}>
              <div className={`text-3xl font-black mb-1 ${data.summary.offline > 0 ? 'text-red-400' : 'text-slate-500'}`}>
                {data.summary.offline}
              </div>
              <div className="text-slate-500 text-sm font-medium">Offline</div>
            </div>
          </div>
        )}

        {/* Node List */}
        <div className="bg-slate-900/60 border border-white/5 rounded-2xl overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-white/5">
            <h2 className="text-white font-black text-lg">Services</h2>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin mb-4" />
              <p className="font-medium">Fetching live status...</p>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Server className="w-8 h-8 mb-4 opacity-40" />
              <p className="font-medium">No services configured yet.</p>
              <p className="text-sm mt-1">Admin can add server nodes from the dashboard.</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {sorted.map((node) => (
                <div key={node.id} className="flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      node.status === 'online' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {getTypeIcon(node.type)}
                    </div>
                    <div>
                      <div className="text-white font-bold text-sm">{node.name}</div>
                      <div className="text-slate-500 text-xs capitalize">{node.type}</div>
                    </div>
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
                    node.status === 'online'
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-red-500/10 text-red-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      node.status === 'online' ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                    }`} />
                    {node.status === 'online' ? 'Operational' : 'Offline'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Last Updated */}
        <div className="flex items-center justify-center gap-2 text-slate-600 text-sm">
          <Clock className="w-4 h-4" />
          <span>Last updated: {lastUpdated}</span>
          <span className="mx-1">·</span>
          <span>Live via Backend API</span>
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse ml-1" />
        </div>
      </div>
    </div>
  );
};

export default ServerStatus;
