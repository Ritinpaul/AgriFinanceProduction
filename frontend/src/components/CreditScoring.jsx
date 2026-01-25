import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { useAuth } from '../context/AuthContext';
import { useAccountAbstraction } from '../context/AccountAbstractionContext';
import toast from 'react-hot-toast';

const CreditScoring = () => {
  const { account, isConnected, getCreditScore, requestCreditScore, getOracleStatus, initializeWallet, walletType, inAppWallet } = useWeb3();
  const { user } = useAuth();
  const { userRole, getCurrentWalletPolicy } = useAccountAbstraction();
  const [score, setScore] = useState(null);
  const [scoreSource, setScoreSource] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [oracleStatus, setOracleStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [requestSent, setRequestSent] = useState(false);
  const [scoreDetails, setScoreDetails] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const testUserAddress = account || "0x1234567890123456789012345678901234567890";

  // Initialize wallet based on user role
  useEffect(() => {
    if (user?.role && !isConnected) {
      initializeWallet(user.role);
    }
  }, [user?.role, isConnected, initializeWallet]);

  const fetchCreditScore = async () => {
    if (!testUserAddress) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('auth_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // Use the verified working endpoint from Staking.jsx
      const resp = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/ai/credit-score`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ userAddress: testUserAddress })
      });

      const data = await resp.json();

      if (resp.ok && data.score) {
        setScore(Number(data.score));
        setScoreSource('Enhanced AI (v2)');
        setLastUpdated(Math.floor(Date.now() / 1000));
      } else {
        // Fallback to cached if POST fails or returns no score
        const cacheResp = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/credit/score/cached?t=${Date.now()}`, { headers });
        const cacheData = await cacheResp.json();
        if (cacheResp.ok && cacheData.score) {
          setScore(Number(cacheData.score));
          setScoreSource('cached_api');
        } else {
          throw new Error(data.error || 'Failed to fetch score');
        }
      }
    } catch (err) {
      console.error('Error fetching credit score:', err);
      setError('Failed to fetch credit score.');
      // Keep existing score if available, don't nullify immediately to avoid flicker
    } finally {
      setLoading(false);
    }
  };

  const fetchOracleStatus = async () => {
    if (!isConnected || !account) return;
    try {
      const status = await getOracleStatus();
      setOracleStatus(status);
    } catch (err) {
      console.error("Error fetching oracle status:", err);
      setOracleStatus(null);
    }
  };

  const fetchScoreDetails = async () => {
    if (!account) return;
    try {
      const token = localStorage.getItem('auth_token');
      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/ai/score-factors?userAddress=${testUserAddress}`, {
        headers
      });
      const data = await response.json();
      if (data.success) {
        setScoreDetails(data);
      }
    } catch (err) {
      console.error("Error fetching score details:", err);
    }
  };

  const handleRequestCreditScore = async () => {
    if (!account) {
      setError("Please connect your wallet.");
      return;
    }
    setLoading(true);
    setError(null);
    setRequestSent(false);
    try {
      const token = localStorage.getItem('auth_token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      // Explicit recompute and persist
      const resp = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/credit/score/recompute`, {
        method: 'POST',
        headers: {
          ...headers,
          'Cache-Control': 'no-cache'
        }
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed');
      setRequestSent(true);
      toast.success('Credit score recomputed');
      await fetchCreditScore();
    } catch (err) {
      console.error("Error requesting credit score:", err);
      setError("Failed to request credit score. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  const handlePredictScore = async (scenario) => {
    if (!isConnected || !account) return;
    try {
      const response = await fetch('/api/ai/predict-score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          userAddress: testUserAddress,
          scenario: scenario
        })
      });
      const data = await response.json();
      if (data.success) {
        setPrediction(data.prediction);
        toast.success(`Score prediction calculated for ${scenario}`);
      }
    } catch (err) {
      console.error("Error predicting score:", err);
      toast.error("Failed to predict credit score");
    }
  };

  const getScoreColor = (score) => {
    if (score >= 750) return 'text-green-400';
    if (score >= 650) return 'text-yellow-400';
    if (score >= 550) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreLabel = (score) => {
    if (score >= 750) return 'Excellent';
    if (score >= 650) return 'Good';
    if (score >= 550) return 'Fair';
    return 'Poor';
  };

  // Check if user has any wallet connected (MetaMask or in-app)
  const hasWallet = isConnected || (inAppWallet && inAppWallet.address);
  const walletAddress = isConnected ? account : (inAppWallet ? inAppWallet.address : null);

  useEffect(() => {
    fetchCreditScore();
    fetchOracleStatus();
    fetchScoreDetails();
    // Auto-refresh removed; refresh only via buttons now
  }, [hasWallet, walletAddress]);

  if (!hasWallet) {
    const walletPolicy = getCurrentWalletPolicy(user?.role);
    return (
      <div className="p-4 bg-gray-800 rounded-lg text-white">
        <h2 className="text-2xl font-bold mb-4">Credit Scoring</h2>
        <p className="mb-4">Please connect your wallet to view credit scoring.</p>
        <p className="text-sm text-gray-400 mb-4">
          {walletPolicy?.description || 'Connect your wallet to access credit scoring'}
        </p>
        <button
          onClick={() => initializeWallet(user?.role)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors duration-200"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-800 rounded-lg shadow-lg text-white">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold">Credit Scoring Dashboard</h2>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium"
        >
          {showAdvanced ? 'Hide' : 'Show'} Advanced Features
        </button>
      </div>

      {error && <div className="bg-red-500 p-3 rounded mb-4">{error}</div>}
      {requestSent && <div className="bg-green-500 p-3 rounded mb-4">Credit score request submitted! Check Chainlink Functions dashboard.</div>}

      {/* Main Score Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-gray-700 p-6 rounded-lg">
          <h3 className="text-xl font-semibold mb-4">Current Credit Score</h3>
          {loading && !score ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mr-3"></div>
              <p>Loading score...</p>
            </div>
          ) : score !== null ? (
            <>
              <div className="flex items-center mb-2">
                <p className={`text-5xl font-bold ${getScoreColor(score)}`}>{score}</p>
                <span className="ml-3 text-lg text-gray-300">({getScoreLabel(score)})</span>
              </div>
              <p className="text-sm text-gray-400">Source: {scoreSource || 'N/A'}</p>
              <p className="text-sm text-gray-400">Last Updated: {lastUpdated ? new Date(lastUpdated * 1000).toLocaleString() : 'N/A'}</p>
            </>
          ) : (
            <p>No score available. Request one below!</p>
          )}
        </div>

        <div className="bg-gray-700 p-6 rounded-lg">
          <h3 className="text-xl font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button
              onClick={handleRequestCreditScore}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Requesting...' : 'Request New Credit Score'}
            </button>
          </div>
        </div>
      </div>

      {/* Score Factors */}
      {scoreDetails && (
        <div className="bg-gray-700 p-6 rounded-lg mb-6">
          <h3 className="text-xl font-semibold mb-4">Score Breakdown</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(scoreDetails.factors || {}).map(([factor, value]) => (
              <div key={factor} className="bg-gray-600 p-4 rounded">
                <h4 className="font-medium capitalize">{factor.replace(/([A-Z])/g, ' $1')}</h4>
                <p className="text-2xl font-bold text-blue-400">{Math.round(value)}</p>
                <p className="text-sm text-gray-400">
                  Weight: {Math.round((scoreDetails.weights?.[factor] || 0) * 100)}%
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How to increase your score */}
      {scoreDetails && (
        <div className="bg-gray-700 p-6 rounded-lg mb-6">
          <h3 className="text-xl font-semibold mb-4">How to increase your credit score?</h3>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-300">
            <li>Upload verified documents (KYC, land records) — boosts the Documents factor.</li>
            <li>Repay existing loans on time — grows Repayments and reduces risk.</li>
            <li>Complete more supply chain transactions — improves Transaction Volume and Activity.</li>
            <li>Participate in community and get approvals — increases Social Proof/Approvals.</li>
            <li>Avoid delinquencies and high-risk behavior — lowers Risk Factors component.</li>
          </ul>
        </div>
      )}

      {/* Risk Assessment */}
      {scoreDetails?.riskAssessment && (
        <div className="bg-gray-700 p-6 rounded-lg mb-6">
          <h3 className="text-xl font-semibold mb-4">Risk Assessment</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-red-400 mb-2">Identified Risks</h4>
              <ul className="space-y-1">
                {scoreDetails.riskAssessment.risks.map((risk, index) => (
                  <li key={index} className="text-sm text-gray-300">• {risk}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-green-400 mb-2">Recommendations</h4>
              <ul className="space-y-1">
                {scoreDetails.riskAssessment.recommendations.map((rec, index) => (
                  <li key={index} className="text-sm text-gray-300">• {rec}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Advanced Features */}
      {showAdvanced && (
        <div className="bg-gray-700 p-6 rounded-lg mb-6">
          <h3 className="text-xl font-semibold mb-4">Advanced Features</h3>

          {/* Score Prediction */}
          <div className="mb-6">
            <h4 className="font-medium mb-3">Score Prediction</h4>
            <div className="flex flex-wrap gap-2 mb-3">
              {['new_loan', 'increased_activity', 'supply_chain_growth', 'community_engagement'].map(scenario => (
                <button
                  key={scenario}
                  onClick={() => handlePredictScore(scenario)}
                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm"
                >
                  {scenario.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            {prediction && (
              <div className="bg-gray-600 p-4 rounded">
                <p className="text-sm text-gray-300 mb-2">
                  Scenario: <span className="font-medium">{prediction.scenario}</span>
                </p>
                <div className="flex items-center space-x-4">
                  <div>
                    <p className="text-sm text-gray-400">Current Score</p>
                    <p className="text-xl font-bold text-blue-400">{prediction.currentScore}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Predicted Score</p>
                    <p className="text-xl font-bold text-green-400">{prediction.predictedScore}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400">Change</p>
                    <p className={`text-xl font-bold ${prediction.predictedScore >= prediction.currentScore ? 'text-green-400' : 'text-red-400'}`}>
                      {prediction.predictedScore >= prediction.currentScore ? '+' : ''}{prediction.predictedScore - prediction.currentScore}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Oracle Status */}
          <div>
            <h4 className="font-medium mb-3">Oracle Status</h4>
            {oracleStatus ? (
              <div className="bg-gray-600 p-4 rounded">
                <p className="text-sm text-gray-300 mb-1">
                  Last Request ID: {oracleStatus.lastRequestId === "0x0000000000000000000000000000000000000000000000000000000000000000" ? "N/A" : oracleStatus.lastRequestId.substring(0, 10) + '...'}
                </p>
                <p className="text-sm text-gray-300 mb-1">
                  Last Response: {oracleStatus.lastResponse.length > 2 ? oracleStatus.lastResponse : 'N/A'}
                </p>
                <p className="text-sm text-gray-300">
                  Last Error: {oracleStatus.lastError.length > 2 ? oracleStatus.lastError : 'N/A'}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Loading oracle status...</p>
            )}
          </div>
        </div>
      )}

      <div className="text-sm text-gray-500 mt-4">
        <p>Note: Credit score requests are processed via Chainlink Functions. It may take a few minutes for the score to update on-chain.</p>
        <p>Ensure your backend server and ngrok tunnel are running for real-time updates.</p>
      </div>
    </div>
  );
};

export default CreditScoring;