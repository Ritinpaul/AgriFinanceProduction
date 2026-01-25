import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../lib/api';
import toast from 'react-hot-toast';

const DAOGovernance = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [proposals, setProposals] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateProposal, setShowCreateProposal] = useState(false);
  const [newProposal, setNewProposal] = useState({
    title: '',
    description: '',
    detailed_proposal: '',
    proposal_type: 'PLATFORM_POLICY',
    tags: []
  });

  useEffect(() => {
    loadDAOData();
  }, []);

  const loadDAOData = async () => {
    try {
      setLoading(true);
      
      // Load proposals, metrics, and analytics in parallel
      const [proposalsRes, metricsRes, analyticsRes] = await Promise.all([
        apiClient.get('/dao/proposals'),
        apiClient.get('/dao/metrics'),
        apiClient.get('/dao/analytics')
      ]);

      setProposals(proposalsRes.data?.data || []);
      setMetrics(metricsRes.data?.data);
      setAnalytics(analyticsRes.data?.data);
    } catch (error) {
      console.error('Error loading DAO data:', error);
      toast.error('Failed to load DAO data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProposal = async (e) => {
    e.preventDefault();
    try {
      const response = await apiClient.post('/dao/proposals', newProposal);
      toast.success('Proposal created successfully!');
      setShowCreateProposal(false);
      setNewProposal({
        title: '',
        description: '',
        detailed_proposal: '',
        proposal_type: 'PLATFORM_POLICY',
        tags: []
      });
      loadDAOData();
    } catch (error) {
      console.error('Error creating proposal:', error);
      toast.error('Failed to create proposal');
    }
  };

  const handleVote = async (proposalId, voteType) => {
    try {
      await apiClient.post(`/dao/proposals/${proposalId}/vote`, {
        vote_type: voteType,
        reason: `Voted ${voteType.toLowerCase()} on ${new Date().toLocaleDateString()}`
      });
      toast.success(`Vote recorded successfully!`);
      loadDAOData();
    } catch (error) {
      console.error('Error voting:', error);
      toast.error('Failed to record vote');
    }
  };

  const getProposalTypeColor = (type) => {
    const colors = {
      'PLATFORM_POLICY': 'bg-blue-100 text-blue-800',
      'CROP_PRICING': 'bg-green-100 text-green-800',
      'LOAN_TERMS': 'bg-yellow-100 text-yellow-800',
      'FARMER_VERIFICATION': 'bg-purple-100 text-purple-800',
      'SUSTAINABILITY': 'bg-emerald-100 text-emerald-800',
      'TECHNOLOGY_UPGRADE': 'bg-indigo-100 text-indigo-800',
      'EMERGENCY_RESPONSE': 'bg-red-100 text-red-800',
      'TREASURY_MANAGEMENT': 'bg-orange-100 text-orange-800',
      'PARTNERSHIP': 'bg-pink-100 text-pink-800',
      'RESEARCH_FUNDING': 'bg-cyan-100 text-cyan-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status) => {
    const colors = {
      'ACTIVE': 'bg-green-100 text-green-800',
      'PASSED': 'bg-blue-100 text-blue-800',
      'REJECTED': 'bg-red-100 text-red-800',
      'EXECUTED': 'bg-purple-100 text-purple-800',
      'EXPIRED': 'bg-gray-100 text-gray-800',
      'DRAFT': 'bg-yellow-100 text-yellow-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading DAO Governance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                🏛️ AgriFinance DAO
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Decentralized Autonomous Organization - Community Governance & Voting
              </p>
            </div>
            <div className="flex space-x-4">
              <button
                onClick={() => setShowCreateProposal(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200"
              >
                📝 Create Proposal
              </button>
              <button
                onClick={loadDAOData}
                className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200"
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'overview', name: '📊 Overview', icon: '📊' },
              { id: 'proposals', name: '📋 Proposals', icon: '📋' },
              { id: 'analytics', name: '📈 Analytics', icon: '📈' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600 dark:text-green-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-md flex items-center justify-center">
                      <span className="text-blue-600 dark:text-blue-400 text-lg">📋</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Proposals</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {analytics?.overview?.total_proposals || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-md flex items-center justify-center">
                      <span className="text-green-600 dark:text-green-400 text-lg">✅</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Proposals</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {analytics?.overview?.active_proposals || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-md flex items-center justify-center">
                      <span className="text-purple-600 dark:text-purple-400 text-lg">🗳️</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Votes</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {analytics?.overview?.total_votes_cast || 0}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-md flex items-center justify-center">
                      <span className="text-orange-600 dark:text-orange-400 text-lg">👥</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Active Farmers</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {metrics?.total_farmers || 0}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Proposals */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Proposals</h3>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {proposals.slice(0, 5).map((proposal) => (
                  <div key={proposal.id} className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                          {proposal.title}
                        </h4>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                          {proposal.description}
                        </p>
                        <div className="mt-2 flex items-center space-x-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getProposalTypeColor(proposal.proposal_type)}`}>
                            {proposal.proposal_type.replace('_', ' ')}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(proposal.current_status)}`}>
                            {proposal.current_status}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            By {proposal.first_name} {proposal.last_name}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4 flex space-x-2">
                        <button
                          onClick={() => handleVote(proposal.proposal_id, 'FOR')}
                          className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
                        >
                          ✅ For
                        </button>
                        <button
                          onClick={() => handleVote(proposal.proposal_id, 'AGAINST')}
                          className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
                        >
                          ❌ Against
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'proposals' && (
          <div className="space-y-6">
            {proposals.map((proposal) => (
              <div key={proposal.id} className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                        {proposal.title}
                      </h3>
                      <p className="mt-2 text-gray-600 dark:text-gray-400">
                        {proposal.description}
                      </p>
                      <div className="mt-4 flex items-center space-x-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getProposalTypeColor(proposal.proposal_type)}`}>
                          {proposal.proposal_type.replace('_', ' ')}
                        </span>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(proposal.current_status)}`}>
                          {proposal.current_status}
                        </span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Ends: {new Date(proposal.end_time).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {proposal.votes_for || 0}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">For</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                            {proposal.votes_against || 0}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Against</p>
                        </div>
                        <div className="text-center">
                          <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                            {proposal.abstain_votes || 0}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">Abstain</p>
                        </div>
                      </div>
                    </div>
                    <div className="ml-6 flex flex-col space-y-2">
                      <button
                        onClick={() => handleVote(proposal.proposal_id, 'FOR')}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                      >
                        ✅ Vote For
                      </button>
                      <button
                        onClick={() => handleVote(proposal.proposal_id, 'AGAINST')}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                      >
                        ❌ Vote Against
                      </button>
                      <button
                        onClick={() => handleVote(proposal.proposal_id, 'ABSTAIN')}
                        className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                      >
                        ⚪ Abstain
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'analytics' && analytics && (
          <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                🌱 Agricultural Impact Metrics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="text-center p-4 bg-green-50 dark:bg-green-900 rounded-lg">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                    {metrics.total_farmers.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Active Farmers</div>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {metrics.total_land_area.toLocaleString()} acres
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Land Area</div>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-900 rounded-lg">
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                    {metrics.sustainability_score}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Sustainability Score</div>
                </div>
                <div className="text-center p-4 bg-orange-50 dark:bg-orange-900 rounded-lg">
                  <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                    {metrics.technology_adoption}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Technology Adoption</div>
                </div>
                <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-900 rounded-lg">
                  <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                    {metrics.organic_farming_percentage}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Organic Farming</div>
                </div>
                <div className="text-center p-4 bg-cyan-50 dark:bg-cyan-900 rounded-lg">
                  <div className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">
                    {metrics.water_usage_efficiency}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Water Efficiency</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Proposal Modal */}
      {showCreateProposal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  📝 Create New Proposal
                </h3>
                <button
                  onClick={() => setShowCreateProposal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
              
              <form onSubmit={handleCreateProposal} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Proposal Title
                  </label>
                  <input
                    type="text"
                    value={newProposal.title}
                    onChange={(e) => setNewProposal({ ...newProposal, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Enter proposal title..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Proposal Type
                  </label>
                  <select
                    value={newProposal.proposal_type}
                    onChange={(e) => setNewProposal({ ...newProposal, proposal_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                  >
                    <option value="PLATFORM_POLICY">Platform Policy</option>
                    <option value="CROP_PRICING">Crop Pricing</option>
                    <option value="LOAN_TERMS">Loan Terms</option>
                    <option value="FARMER_VERIFICATION">Farmer Verification</option>
                    <option value="SUSTAINABILITY">Sustainability</option>
                    <option value="TECHNOLOGY_UPGRADE">Technology Upgrade</option>
                    <option value="EMERGENCY_RESPONSE">Emergency Response</option>
                    <option value="TREASURY_MANAGEMENT">Treasury Management</option>
                    <option value="PARTNERSHIP">Partnership</option>
                    <option value="RESEARCH_FUNDING">Research Funding</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={newProposal.description}
                    onChange={(e) => setNewProposal({ ...newProposal, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Describe your proposal..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Detailed Proposal (Optional)
                  </label>
                  <textarea
                    value={newProposal.detailed_proposal}
                    onChange={(e) => setNewProposal({ ...newProposal, detailed_proposal: e.target.value })}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 dark:bg-gray-700 dark:text-white"
                    placeholder="Provide detailed information about your proposal..."
                  />
                </div>

                <div className="flex justify-end space-x-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateProposal(false)}
                    className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors duration-200"
                  >
                    Create Proposal
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DAOGovernance;