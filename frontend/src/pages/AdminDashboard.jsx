import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';
import { useAdminApproval } from '../utils/adminApproval';

const AdminDashboard = () => {
  const { user } = useAuth();
  const web3 = useWeb3();
  const adminApproval = useAdminApproval(web3);
  
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  const [notes, setNotes] = useState({});
  const [scanLoading, setScanLoading] = useState(false);
  const [loanVaultScanLoading, setLoanVaultScanLoading] = useState(false);
  const [indexer, setIndexer] = useState({ escrow: { lastBlock: null }, loanVault: { lastBlock: null }, events: [] });
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [borrowingStatus, setBorrowingStatus] = useState(null);
  const [pauseLoading, setPauseLoading] = useState(false);

  useEffect(() => {
    if (user?.role === 'admin') {
      loadPendingApprovals();
      loadIndexerStatus();
      loadAnalytics();
      loadBorrowingStatus();
      const interval = setInterval(loadBorrowingStatus, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    }
  }, [user]);

  const loadPendingApprovals = async () => {
    setLoading(true);
    try {
      const approvals = await adminApproval.getPendingApprovals();
      const arr = Array.isArray(approvals) ? approvals : (Array.isArray(approvals?.data) ? approvals.data : []);
      setPendingApprovals(arr);
    } catch (error) {
      console.error('Error loading pending approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const res = await fetch('/api/admin/analytics/dashboard', { headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }});
      const json = await res.json();
      if (res.ok) setAnalytics(json.analytics);
    } catch {}
    setAnalyticsLoading(false);
  };

  const loadIndexerStatus = async () => {
    try {
      const res = await fetch('/api/indexer/status', { headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }});
      if (!res.ok) return;
      const json = await res.json();
      setIndexer(json);
    } catch {}
  };

  const loadBorrowingStatus = async () => {
    try {
      const res = await fetch('/api/admin/borrowing-status', { headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }});
      if (!res.ok) return;
      const json = await res.json();
      setBorrowingStatus(json);
    } catch {}
  };

  const handlePauseToggle = async (isPaused, reason) => {
    setPauseLoading(true);
    try {
      const res = await fetch('/api/admin/pause-borrowing', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isPaused, reason })
      });
      if (!res.ok) {
        const e = await res.json().catch(()=>({error:'failed'}));
        alert(e.error || 'Failed to update borrowing status');
      } else {
        await loadBorrowingStatus();
        alert(isPaused ? 'Borrowing paused' : 'Borrowing resumed');
      }
    } catch (e) {
      alert('Failed to update borrowing status');
    } finally {
      setPauseLoading(false);
    }
  };

  const handleScanEscrow = async () => {
    setScanLoading(true);
    try {
      const res = await fetch('/api/indexer/scan', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        const e = await res.json().catch(()=>({error:'scan failed'}));
        alert(e.error || 'Scan failed');
      } else {
        const result = await res.json();
        await loadIndexerStatus();
        alert(`Escrow scan completed: ${result.inserted || 0} events indexed`);
      }
    } catch (e) {
      console.error(e);
      alert('Scan failed: ' + e.message);
    } finally {
      setScanLoading(false);
    }
  };

  const handleScanLoanVault = async () => {
    setLoanVaultScanLoading(true);
    try {
      const res = await fetch('/api/indexer/scan-loanvault', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        const e = await res.json().catch(()=>({error:'scan failed'}));
        alert(e.error || 'LoanVault scan failed');
      } else {
        const result = await res.json();
        await loadIndexerStatus();
        alert(`LoanVault scan completed: ${result.inserted || 0} events indexed, ${result.synced || 0} synced to database`);
      }
    } catch (e) {
      console.error(e);
      alert('LoanVault scan failed: ' + e.message);
    } finally {
      setLoanVaultScanLoading(false);
    }
  };

  const handleApprove = async (approvalId) => {
    setProcessing(prev => ({ ...prev, [approvalId]: 'approving' }));
    try {
      await adminApproval.approveTransaction(approvalId, user.id, notes[approvalId] || '');
      alert('Transaction approved and executed successfully!');
      await loadPendingApprovals();
      setNotes(prev => ({ ...prev, [approvalId]: '' }));
    } catch (error) {
      console.error('Error approving transaction:', error);
      alert(`Approval failed: ${error.message}`);
    } finally {
      setProcessing(prev => ({ ...prev, [approvalId]: null }));
    }
  };

  const handleReject = async (approvalId) => {
    setProcessing(prev => ({ ...prev, [approvalId]: 'rejecting' }));
    try {
      await adminApproval.rejectTransaction(approvalId, user.id, notes[approvalId] || 'Rejected by admin');
      alert('Transaction rejected successfully!');
      await loadPendingApprovals();
      setNotes(prev => ({ ...prev, [approvalId]: '' }));
    } catch (error) {
      console.error('Error rejecting transaction:', error);
      alert(`Rejection failed: ${error.message}`);
    } finally {
      setProcessing(prev => ({ ...prev, [approvalId]: null }));
    }
  };

  const formatRequestData = (requestData, type) => {
    switch (type) {
      case 'nft_purchase':
        return {
          'NFT ID': requestData.nftId,
          'Token ID': requestData.tokenId,
          'Seller': requestData.sellerAddress,
          'Buyer': requestData.buyerAddress,
          'Price': `${requestData.price} ETH`,
          'Location': requestData.nftData?.location,
          'Area': `${requestData.nftData?.area} acres`
        };
      case 'nft_mint':
        return {
          'Location': requestData.location,
          'Land Size': `${requestData.landSize} acres`,
          'Farmer': requestData.farmerAddress,
          'Soil Type': requestData.metadata?.soilType,
          'Crop History': requestData.metadata?.cropHistory
        };
      case 'withdrawal':
        return {
          'Amount': `${requestData.amount} ${requestData.tokenSymbol}`,
          'From': requestData.fromAddress,
          'To': requestData.toAddress
        };
      default:
        return requestData;
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-red-800 dark:text-red-200 mb-2">Access Denied</h2>
          <p className="text-red-700 dark:text-red-300">You need admin privileges to access this dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* KPI Row */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Platform KPIs</h2>
        {analyticsLoading ? (
          <div className="text-gray-600 dark:text-gray-400">Loading analytics…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Total Users" value={Number(analytics?.users?.total_users||0).toLocaleString()} subtitle={`${analytics?.users?.new_users_30d||0} new (30d)`} />
            <KpiCard title="Active Loans" value={Number(analytics?.loans?.active_loans||0)} subtitle={`${analytics?.loans?.pending_loans||0} pending`} />
            <KpiCard title="Total NFTs" value={Number(analytics?.nfts?.total_nfts||0)} subtitle={`${analytics?.nfts?.sold_nfts||0} sold`} />
            <KpiCard title="Net Flow (KRSI)" value={(((Number(analytics?.transactions?.total_inflow||0)-Number(analytics?.transactions?.total_outflow||0))/1e6)||0).toLocaleString(undefined,{maximumFractionDigits:2})} subtitle={`In: ${(Number(analytics?.transactions?.total_inflow||0)/1e6).toFixed(2)} • Out: ${(Number(analytics?.transactions?.total_outflow||0)/1e6).toFixed(2)}`} />
          </div>
        )}
      </div>

      {/* Platform Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Platform Breakdown</h2>
        {analyticsLoading ? (
          <div className="text-gray-600 dark:text-gray-400">Loading…</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Minted NFTs" value={Number(analytics?.nfts?.minted_nfts||0)} />
            <KpiCard title="Sold NFTs" value={Number(analytics?.nfts?.sold_nfts||0)} />
            <KpiCard title="Total Sales (KRSI)" value={((Number(analytics?.nfts?.total_sales_value||0)/1e6)||0).toLocaleString(undefined,{maximumFractionDigits:2})} />
            <KpiCard title="Total Txns" value={Number(analytics?.transactions?.total_transactions||0)} />
          </div>
        )}
      </div>

      {/* Phase 8: Oracle & Price Guard Rails */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Price Monitoring & Borrowing Controls</h2>
          <button
            onClick={loadBorrowingStatus}
            className="text-sm text-blue-600 hover:underline"
          >
            Refresh
          </button>
        </div>
        
        {borrowingStatus ? (
          <div className="space-y-4">
            {/* Price Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">KRSI Price (USD)</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${(borrowingStatus.prices?.krsi?.price || 0).toFixed(6)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Volatility: {(borrowingStatus.prices?.krsi?.volatility || 0).toFixed(2)}%
                  {borrowingStatus.prices?.krsi?.isValid ? (
                    <span className="ml-2 text-green-600">✓ Live</span>
                  ) : (
                    <span className="ml-2 text-yellow-600">⚠ Stale</span>
                  )}
                </div>
              </div>
              
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">ETH Price (USD)</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${(borrowingStatus.prices?.eth?.price || 0).toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {borrowingStatus.prices?.eth?.isValid ? (
                    <span className="text-green-600">✓ Live</span>
                  ) : (
                    <span className="text-yellow-600">⚠ Stale</span>
                  )}
                </div>
              </div>
            </div>

            {/* Borrowing Status */}
            <div className={`border-2 rounded-lg p-4 ${
              borrowingStatus.borrowing?.isPaused 
                ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20'
                : borrowingStatus.borrowing?.shouldPause
                ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20'
                : 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white mb-1">
                    Borrowing Status: {borrowingStatus.borrowing?.isPaused ? '⏸ PAUSED' : '▶ ACTIVE'}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Current Volatility: {(borrowingStatus.borrowing?.currentVolatility || 0).toFixed(2)}% | 
                    Threshold: {(borrowingStatus.borrowing?.volatilityThreshold || 50).toFixed(2)}%
                  </div>
                  {borrowingStatus.borrowing?.isPaused && borrowingStatus.borrowing?.reason && (
                    <div className="text-sm text-red-700 dark:text-red-300 mt-1">
                      Reason: {borrowingStatus.borrowing.reason}
                    </div>
                  )}
                  {borrowingStatus.borrowing?.shouldPause && !borrowingStatus.borrowing?.isPaused && (
                    <div className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      ⚠ Warning: Volatility exceeds threshold. Consider pausing borrowing.
                    </div>
                  )}
                </div>
                <div className="flex space-x-2">
                  {borrowingStatus.borrowing?.isPaused ? (
                    <button
                      onClick={() => handlePauseToggle(false, null)}
                      disabled={pauseLoading}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      {pauseLoading ? 'Resuming...' : 'Resume Borrowing'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const reason = prompt('Enter reason for pausing (optional):');
                        handlePauseToggle(true, reason || 'Paused by admin due to volatility');
                      }}
                      disabled={pauseLoading}
                      className="bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white px-4 py-2 rounded-lg text-sm font-medium"
                    >
                      {pauseLoading ? 'Pausing...' : 'Pause Borrowing'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-gray-600 dark:text-gray-400">Loading price data...</div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Recent Activity</h2>
          <button onClick={loadAnalytics} className="text-sm text-blue-600 hover:underline">Refresh</button>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {(!analytics?.recentActivity || analytics.recentActivity.length===0) ? (
            <div className="text-gray-600 dark:text-gray-400">No recent activity</div>
          ) : analytics.recentActivity.map((a,i)=> (
            <div key={i} className="py-3 flex items-start justify-between">
              <div className="pr-4">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{a.user_name || a.email || 'User'}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{a.description}</div>
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(a.timestamp).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
          🔧 Admin Dashboard
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Review and approve pending transactions for regulatory compliance
        </p>
      </div>

      {/* Blockchain Indexers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Escrow Indexer Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Escrow Indexer</h2>
            <button
              onClick={handleScanEscrow}
              disabled={scanLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {scanLoading ? 'Scanning…' : 'Scan Escrow'}
            </button>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Last scanned block: {indexer.escrow?.lastBlock ?? '—'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Scans EscrowLoan contract events (LoanCreated, LoanRepaid, LoanClosed)
          </div>
        </div>

        {/* LoanVault Indexer Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white">LoanVault Indexer</h2>
            <button
              onClick={handleScanLoanVault}
              disabled={loanVaultScanLoading}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded-lg text-sm font-medium"
            >
              {loanVaultScanLoading ? 'Scanning…' : 'Scan LoanVault'}
            </button>
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Last scanned block: {indexer.loanVault?.lastBlock ?? '—'}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Scans LoanVault events (LiquidityDeposited, LiquidityWithdrawn, LoanCreated, LoanRepaid) and syncs to database
          </div>
        </div>
      </div>

      {/* Recent Blockchain Events */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Recent Blockchain Events</h2>
          <button
            onClick={loadIndexerStatus}
            className="text-sm text-blue-600 hover:underline"
          >
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Contract</th>
                <th className="py-2 pr-4">Event</th>
                <th className="py-2 pr-4">Block</th>
                <th className="py-2 pr-4">Tx</th>
                <th className="py-2 pr-4">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {indexer.events?.map(ev => (
                <tr key={ev.id}>
                  <td className="py-2 pr-4">{ev.id}</td>
                  <td className="py-2 pr-4 text-xs">
                    <span className={`px-2 py-1 rounded ${
                      ev.contract_address?.toLowerCase().includes('escrow') 
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                        : 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                    }`}>
                      {ev.contract_address?.toLowerCase().includes('escrow') ? 'Escrow' : 'LoanVault'}
                    </span>
                  </td>
                  <td className="py-2 pr-4 font-medium">{ev.event_name}</td>
                  <td className="py-2 pr-4">{ev.block_number}</td>
                  <td className="py-2 pr-4 truncate max-w-[140px]">
                    <a 
                      className="text-blue-600 hover:underline" 
                      href={`https://sepolia.etherscan.io/tx/${ev.tx_hash}`} 
                      target="_blank" 
                      rel="noreferrer"
                    >
                      {ev.tx_hash?.substring(0, 10)}...
                    </a>
                  </td>
                  <td className="py-2 pr-4">
                    <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {JSON.stringify(ev.event_data)}
                    </code>
                  </td>
                </tr>
              ))}
              {(!indexer.events || indexer.events.length === 0) && (
                <tr><td className="py-2 text-gray-500" colSpan="6">No events yet. Run a scan to index blockchain events.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
            Pending Approvals ({pendingApprovals.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-6 text-center text-gray-600 dark:text-gray-400">
            Loading pending approvals...
          </div>
        ) : pendingApprovals.length === 0 ? (
          <div className="p-6 text-center text-gray-600 dark:text-gray-400">
            No pending approvals
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {pendingApprovals.map((approval) => (
              <div key={approval.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                      {approval.transaction_type.replace('_', ' ').toUpperCase()}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Request ID: {approval.id} • User: {approval.users?.email}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      Requested: {new Date(approval.created_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full text-xs font-medium">
                    PENDING
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {Object.entries(formatRequestData(approval.request_data, approval.transaction_type)).map(([key, value]) => (
                    <div key={key}>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{key}</div>
                      <div className="font-medium text-gray-900 dark:text-white">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Admin Notes
                  </label>
                  <textarea
                    className="w-full form-input"
                    rows="2"
                    placeholder="Add notes for this approval..."
                    value={notes[approval.id] || ''}
                    onChange={(e) => setNotes(prev => ({ ...prev, [approval.id]: e.target.value }))}
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => handleApprove(approval.id)}
                    disabled={processing[approval.id]}
                    className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    {processing[approval.id] === 'approving' ? 'Approving...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleReject(approval.id)}
                    disabled={processing[approval.id]}
                    className="bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white px-4 py-2 rounded-lg text-sm font-medium"
                  >
                    {processing[approval.id] === 'rejecting' ? 'Rejecting...' : 'Reject'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;

// Local KPI card
const KpiCard = ({ title, value, subtitle }) => (
  <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</div>
    <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">{value}</div>
    {subtitle && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</div>}
  </div>
);
