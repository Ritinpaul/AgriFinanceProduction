import React, { useState, useEffect, useRef } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { useAuth } from '../context/AuthContext';
import apiClient from '../lib/api';
import toast from 'react-hot-toast';

const LenderDashboard = () => {
  const { account, isConnected, contracts, inAppWallet } = useWeb3();
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loans, setLoans] = useState([]);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const dashboardFetchedRef = useRef(false);

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    // Prevent multiple simultaneous calls
    if (dashboardFetchedRef.current) return;
    dashboardFetchedRef.current = true;
    
    setLoading(true);
    try {
      // Ensure API client has the current token
      const token = localStorage.getItem('auth_token');
      if (token) {
        apiClient.setToken(token);
      }

      // Fetch dashboard data
      const dashboardResult = await apiClient.request('/lender/dashboard');
      if (dashboardResult.success) {
        setDashboardData(dashboardResult.data);
      }

      // Fetch loans data
      const loansResult = await apiClient.request('/lender/loans');
      if (loansResult.success) {
        setLoans(loansResult.loans);
      }
    } catch (error) {
      console.error('Error fetching lender dashboard data:', error);
      toast.error('Failed to load lender dashboard data');
    } finally {
      setLoading(false);
      // Reset the ref after 5 seconds to allow future calls
      setTimeout(() => {
        dashboardFetchedRef.current = false;
      }, 5000);
    }
  };

  const handleDeposit = async () => {
    const hasWallet = isConnected || (inAppWallet && inAppWallet.address);
    if (!hasWallet) {
      alert('Please connect your wallet first');
      return;
    }

    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      alert('Please enter a valid deposit amount');
      return;
    }

    try {
      setLoading(true);
      // In production, this would call the LoanVault contract
      alert(`Deposit functionality would be implemented here for ${depositAmount} tokens`);
      setDepositAmount('');
      fetchPoolStats();
      fetchLenderInfo();
    } catch (error) {
      console.error('Deposit error:', error);
      alert('Failed to deposit');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const hasWallet = isConnected || (inAppWallet && inAppWallet.address);
    if (!hasWallet) {
      alert('Please connect your wallet first');
      return;
    }

    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      alert('Please enter a valid withdrawal amount');
      return;
    }

    try {
      setLoading(true);
      // In production, this would call the LoanVault contract
      alert(`Withdrawal functionality would be implemented here for ${withdrawAmount} tokens`);
      setWithdrawAmount('');
      fetchPoolStats();
      fetchLenderInfo();
    } catch (error) {
      console.error('Withdrawal error:', error);
      alert('Failed to withdraw');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(num);
  };

  const formatCurrency = (amount) => {
    return `$${formatNumber(amount)}`;
  };

  const formatPercentage = (rate) => {
    return `${rate.toFixed(2)}%`;
  };

  if (!isConnected && !(inAppWallet && inAppWallet.address)) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Lender Dashboard</h1>
            <p className="text-gray-600 mb-8">Please connect your wallet to access the lending pool</p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-yellow-800">Connect your wallet to start lending and earning</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Lender Dashboard</h1>
          <p className="text-gray-600">Manage your lending pool participation and earnings</p>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', name: 'Overview' },
              { id: 'deposit', name: 'Deposit' },
              { id: 'withdraw', name: 'Withdraw' },
              { id: 'loans', name: 'Active Loans' },
              { id: 'analytics', name: 'Analytics' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Pool Stats */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Pool Statistics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {dashboardData?.poolStats ? formatCurrency(dashboardData.poolStats.total_active_amount + dashboardData.poolStats.total_repaid_amount) : 'Loading...'}
                  </div>
                  <div className="text-sm text-gray-600">Total Liquidity</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {dashboardData?.poolStats ? formatPercentage(dashboardData.poolStats.utilization_rate) : 'Loading...'}
                  </div>
                  <div className="text-sm text-gray-600">Utilization Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {dashboardData?.poolStats ? formatPercentage(dashboardData.poolStats.average_interest_rate) : 'Loading...'}
                  </div>
                  <div className="text-sm text-gray-600">Average Interest Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {dashboardData?.poolStats ? dashboardData.poolStats.active_loans : 'Loading...'}
                  </div>
                  <div className="text-sm text-gray-600">Active Loans</div>
                </div>
              </div>
            </div>

            {/* Lender Stats */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Lending Stats</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {dashboardData?.lenderStats ? formatCurrency(dashboardData.lenderStats.my_active_amount + dashboardData.lenderStats.my_repaid_amount) : 'Loading...'}
                  </div>
                  <div className="text-sm text-gray-600">Total Lent</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {dashboardData?.lenderStats ? dashboardData.lenderStats.my_active_loans : 'Loading...'}
                  </div>
                  <div className="text-sm text-gray-600">Active Loans</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {dashboardData?.lenderStats ? formatCurrency(dashboardData.lenderStats.my_total_earnings) : 'Loading...'}
                  </div>
                  <div className="text-sm text-gray-600">Total Earnings</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {dashboardData?.stakingData ? formatCurrency(dashboardData.stakingData.total_staked) : 'Loading...'}
                  </div>
                  <div className="text-sm text-gray-600">Staked Amount</div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setActiveTab('deposit')}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Deposit Liquidity
                </button>
                <button
                  onClick={() => setActiveTab('withdraw')}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                  Withdraw Liquidity
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Deposit Tab */}
        {activeTab === 'deposit' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Deposit Liquidity</h3>
            <div className="max-w-md">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Deposit Amount (KRISHI)
                </label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter amount to deposit"
                />
              </div>
              <div className="mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <h4 className="font-medium text-blue-900 mb-1">Current Pool Interest Rate: {dashboardData?.poolStats ? formatPercentage(dashboardData.poolStats.average_interest_rate) : 'Loading...'}</h4>
                  <p className="text-sm text-blue-700">
                    Earn competitive returns by providing liquidity to the lending pool
                  </p>
                </div>
              </div>
              <button
                onClick={handleDeposit}
                disabled={loading}
                className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Processing...' : 'Deposit Liquidity'}
              </button>
            </div>
          </div>
        )}

        {/* Withdraw Tab */}
        {activeTab === 'withdraw' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Withdraw Liquidity</h3>
            <div className="max-w-md">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Withdrawal Amount (LP Shares)
                </label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter amount to withdraw"
                />
              </div>
              <div className="mb-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <h4 className="font-medium text-yellow-900 mb-1">Available Staked Amount: {dashboardData?.stakingData ? formatNumber(dashboardData.stakingData.total_staked) : 'Loading...'}</h4>
                  <p className="text-sm text-yellow-700">
                    Withdrawal may be limited if it would affect active loans
                  </p>
                </div>
              </div>
              <button
                onClick={handleWithdraw}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Processing...' : 'Withdraw Liquidity'}
              </button>
            </div>
          </div>
        )}

        {/* Active Loans Tab */}
        {activeTab === 'loans' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Loans</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Loan ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Borrower
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Interest Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loans.length > 0 ? (
                    loans.map((loan) => (
                      <tr key={loan.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          #{loan.id.slice(-8)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {loan.first_name && loan.last_name 
                            ? `${loan.first_name} ${loan.last_name}` 
                            : loan.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatCurrency(loan.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatPercentage(loan.interest_rate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {loan.due_date ? new Date(loan.due_date).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            loan.status === 'active' 
                              ? 'bg-green-100 text-green-800'
                              : loan.status === 'repaid'
                              ? 'bg-blue-100 text-blue-800'
                              : loan.status === 'defaulted'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {loan.status?.toUpperCase() || 'UNKNOWN'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                        {loading ? 'Loading loans...' : 'No loans found. Start lending to see your loans here.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Earnings History</h3>
              <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                <p className="text-gray-500">Earnings chart would be displayed here</p>
              </div>
            </div>
            
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Metrics</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {dashboardData?.poolStats ? formatPercentage((dashboardData.poolStats.defaulted_loans / Math.max(dashboardData.poolStats.total_loans, 1)) * 100) : '0%'}
                  </div>
                  <div className="text-sm text-gray-600">Default Rate</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {dashboardData?.poolStats ? formatPercentage(dashboardData.poolStats.utilization_rate) : '0%'}
                  </div>
                  <div className="text-sm text-gray-600">Pool Utilization</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {dashboardData?.poolStats ? formatPercentage(dashboardData.poolStats.average_interest_rate) : '0%'}
                  </div>
                  <div className="text-sm text-gray-600">Average Interest Rate</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LenderDashboard;