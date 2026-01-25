import React, { useEffect, useState } from 'react';

const AdminAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/analytics/dashboard', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load analytics');
      setData(json.analytics || {});
    } catch (e) {
      setError(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const Card = ({ title, value, subtitle }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5">
      <div className="text-sm text-gray-500 dark:text-gray-400">{title}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{value}</div>
      {subtitle && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</div>}
    </div>
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-40 text-gray-600 dark:text-gray-300">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200">
          {error}
        </div>
      </div>
    );
  }

  const users = data?.users || {};
  const loans = data?.loans || {};
  const nfts = data?.nfts || {};
  const tx = data?.transactions || {};
  const recent = data?.recentActivity || [];

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Analytics</h1>
        <p className="text-gray-600 dark:text-gray-400">KPIs and recent platform activity</p>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Total Users" value={Number(users.total_users || 0).toLocaleString()} subtitle={`${users.new_users_30d || 0} new (30d)`} />
        <Card title="Active Loans" value={Number(loans.active_loans || 0)} subtitle={`${loans.pending_loans || 0} pending`} />
        <Card title="Total NFTs" value={Number(nfts.total_nfts || 0)} subtitle={`${nfts.sold_nfts || 0} sold`} />
        <Card title="Net Flow (KRSI)" value={(((Number(tx.total_inflow||0)-Number(tx.total_outflow||0))/1e6)||0).toLocaleString(undefined,{maximumFractionDigits:2})} subtitle={`In: ${(Number(tx.total_inflow||0)/1e6).toFixed(2)} • Out: ${(Number(tx.total_outflow||0)/1e6).toFixed(2)}`} />
      </div>

      {/* Daily/summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Pending Loans" value={Number(loans.pending_loans || 0)} />
        <Card title="Repaid Loans" value={Number(loans.repaid_loans || 0)} />
        <Card title="Verified Batches" value={Number((data?.supplyChain||{}).verified_batches || 0)} />
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {recent.length === 0 ? (
            <div className="p-5 text-gray-600 dark:text-gray-400">No recent activity</div>
          ) : recent.map((a, i) => (
            <div key={i} className="p-5 flex items-start justify-between">
              <div className="pr-4">
                <div className="text-sm text-gray-900 dark:text-white font-medium">{a.user_name || a.email || 'User'}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{a.description}</div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(a.timestamp).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;


