import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { useAuth } from '../context/AuthContext';
import { useAccountAbstraction } from '../context/AccountAbstractionContext';
import toast from 'react-hot-toast';

const LoanApplication = () => {
  const { account, isConnected, contracts, initializeWallet, walletType } = useWeb3();
  const { user } = useAuth();
  const { userRole, getCurrentWalletPolicy } = useAccountAbstraction();
  const [loanAmount, setLoanAmount] = useState('');
  const [loanDuration, setLoanDuration] = useState('');
  const [loanPurpose, setLoanPurpose] = useState('');
  const [eligibility, setEligibility] = useState(null);
  const [creditScore, setCreditScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize wallet based on user role
  useEffect(() => {
    if (user?.role && !isConnected) {
      initializeWallet(user.role);
    }
  }, [user?.role, isConnected, initializeWallet]);

  const fetchEligibility = async () => {
    if (!isConnected || !account) return;
    try {
      setLoading(true);
      setError(null);
      
      // Use unified backend AI score so it matches Credit Scoring page
      const resp = await fetch('http://localhost:3001/api/ai/credit-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAddress: account })
      });
      
      if (!resp.ok) {
        throw new Error(`HTTP error! status: ${resp.status}`);
      }
      
      const data = await resp.json();
      if (data && data.score) {
        setCreditScore({ score: data.score, source: data.source || 'AI', lastUpdated: Math.floor((data.timestamp || Date.now())/1000) });
      }

      // Try to fetch eligibility from smart contract with fallback
      if (contracts.loanContract) {
        try {
          console.log('🔍 Fetching loan eligibility from contract...');
          const eligibilityData = await contracts.loanContract.getLoanEligibility(account);
          console.log('✅ Contract eligibility data:', eligibilityData);
          setEligibility(eligibilityData);
        } catch (contractError) {
          console.warn('⚠️ Contract eligibility failed, using fallback:', contractError.message);
          // Fallback: Calculate eligibility based on credit score
          const score = data?.score || 0;
          const fallbackEligibility = {
            eligible: score >= 500,
            maxAmount: score >= 750 ? '10000000000000' : score >= 650 ? '8000000000000' : score >= 550 ? '6000000000000' : score >= 500 ? '4000000000000' : '0',
            recommendedRate: score >= 750 ? 800 : score >= 650 ? 1000 : score >= 550 ? 1200 : score >= 500 ? 1500 : 2000,
            reason: score >= 500 ? 'Eligible for loan' : 'Credit score too low'
          };
          console.log('🔄 Using fallback eligibility:', fallbackEligibility);
          setEligibility(fallbackEligibility);
        }
      } else {
        console.warn('⚠️ No loan contract available, using fallback eligibility');
        // Fallback: Calculate eligibility based on credit score
        const score = data?.score || 0;
        const fallbackEligibility = {
          eligible: score >= 500,
          maxAmount: score >= 750 ? '10000000000000' : score >= 650 ? '8000000000000' : score >= 550 ? '6000000000000' : score >= 500 ? '4000000000000' : '0',
          recommendedRate: score >= 750 ? 800 : score >= 650 ? 1000 : score >= 550 ? 1200 : score >= 500 ? 1500 : 2000,
          reason: score >= 500 ? 'Eligible for loan' : 'Credit score too low'
        };
        console.log('🔄 Using fallback eligibility:', fallbackEligibility);
        setEligibility(fallbackEligibility);
      }
    } catch (err) {
      console.error("❌ Error fetching eligibility:", err);
      setError("Failed to fetch loan eligibility: " + err.message);
      
      // Ultimate fallback: Use default values
      const fallbackEligibility = {
        eligible: false,
        maxAmount: '0',
        recommendedRate: 2000,
        reason: 'Unable to fetch eligibility data'
      };
      setEligibility(fallbackEligibility);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLoan = async () => {
    if (!isConnected || !account || !contracts.loanContract) {
      setError("Please connect your wallet");
      return;
    }

    if (!loanAmount || !loanDuration || !loanPurpose) {
      setError("Please fill in all fields");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const amount = ethers.parseUnits(loanAmount, 6); // Assuming 6 decimals
      const duration = parseInt(loanDuration) * 24 * 60 * 60; // Convert days to seconds

      const tx = await contracts.loanContract.createLoan(amount, duration, loanPurpose);
      await tx.wait();

      toast.success("Loan application submitted successfully!");
      
      // Reset form
      setLoanAmount('');
      setLoanDuration('');
      setLoanPurpose('');
      
      // Refresh eligibility
      await fetchEligibility();
    } catch (err) {
      console.error("Error creating loan:", err);
      setError(err.message || "Failed to create loan");
    } finally {
      setLoading(false);
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

  const formatAmount = (amount) => {
    return ethers.formatUnits(amount, 6);
  };

  const formatRate = (rate) => {
    return (rate / 100).toFixed(2) + '%';
  };

  useEffect(() => {
    fetchEligibility();
  }, [isConnected, account]);

  if (!isConnected) {
    const walletPolicy = getCurrentWalletPolicy(user?.role);
    
    // For farmers, show a different message since they use in-app wallet
    if (user?.role === 'farmer') {
      return (
        <div className="p-4 bg-gray-800 rounded-lg text-white">
          <h2 className="text-2xl font-bold mb-4">Loan Application</h2>
          <p className="mb-4">Farmers use in-app wallet only.</p>
          <p className="text-sm text-gray-400 mb-4">
            Your AgriFinance wallet is being initialized. Please wait...
          </p>
          <button
            onClick={() => initializeWallet(user?.role)}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition-colors duration-200"
          >
            Initialize AgriFinance Wallet
          </button>
        </div>
      );
    }
    
    return (
      <div className="p-4 bg-gray-800 rounded-lg text-white">
        <h2 className="text-2xl font-bold mb-4">Loan Application</h2>
        <p className="mb-4">Please connect your wallet to apply for a loan.</p>
        <p className="text-sm text-gray-400 mb-4">
          {walletPolicy?.description || 'Connect your wallet to access loan application'}
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
      <h2 className="text-3xl font-bold mb-6">Smart Loan Application</h2>

      {error && <div className="bg-red-500 p-3 rounded mb-4">{error}</div>}

      {loading && (
        <div className="bg-blue-500 p-3 rounded mb-4 flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
          Loading loan eligibility...
        </div>
      )}

      {/* Credit Score Display */}
      {creditScore && (
        <div className="bg-gray-700 p-6 rounded-lg mb-6">
          <h3 className="text-xl font-semibold mb-4">Your Credit Profile</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400">Credit Score</p>
              <p className={`text-3xl font-bold ${getScoreColor(Number(creditScore.score))}`}>
                {creditScore.score.toString()}
              </p>
              <p className="text-sm text-gray-300">({getScoreLabel(Number(creditScore.score))})</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Score Source</p>
              <p className="text-lg font-medium">{creditScore.source}</p>
              <p className="text-sm text-gray-400">
                Last Updated: {new Date(Number(creditScore.lastUpdated) * 1000).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Loan Eligibility */}
      {eligibility && (
        <div className="bg-gray-700 p-6 rounded-lg mb-6">
          <h3 className="text-xl font-semibold mb-4">Loan Eligibility</h3>
          {eligibility.eligible ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-sm text-gray-400">Maximum Amount</p>
                <p className="text-2xl font-bold text-green-400">
                  {formatAmount(eligibility.maxAmount)} KRISHI
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-400">Recommended Rate</p>
                <p className="text-2xl font-bold text-blue-400">
                  {formatRate(eligibility.recommendedRate)}
                </p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-400">Status</p>
                <p className="text-lg font-medium text-green-400">Eligible</p>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-lg font-medium text-red-400">Not Eligible</p>
              <p className="text-sm text-gray-400">{eligibility.reason}</p>
            </div>
          )}
        </div>
      )}

      {/* Loan Application Form */}
      {eligibility?.eligible && (
        <div className="bg-gray-700 p-6 rounded-lg mb-6">
          <h3 className="text-xl font-semibold mb-4">Apply for Loan</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Loan Amount (KRISHI)</label>
              <input
                type="number"
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
                placeholder="Enter amount"
                className="w-full p-3 bg-gray-600 border border-gray-500 rounded-lg text-white"
                max={formatAmount(eligibility.maxAmount)}
                min="100"
              />
              <p className="text-sm text-gray-400 mt-1">
                Maximum: {formatAmount(eligibility.maxAmount)} KRISHI
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Duration (Days)</label>
              <input
                type="number"
                value={loanDuration}
                onChange={(e) => setLoanDuration(e.target.value)}
                placeholder="Enter duration in days"
                className="w-full p-3 bg-gray-600 border border-gray-500 rounded-lg text-white"
                min="1"
                max="365"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Purpose</label>
              <select
                value={loanPurpose}
                onChange={(e) => setLoanPurpose(e.target.value)}
                className="w-full p-3 bg-gray-600 border border-gray-500 rounded-lg text-white"
              >
                <option value="">Select purpose</option>
                <option value="Farm Equipment">Farm Equipment</option>
                <option value="Seeds and Fertilizers">Seeds and Fertilizers</option>
                <option value="Land Purchase">Land Purchase</option>
                <option value="Infrastructure">Infrastructure</option>
                <option value="Working Capital">Working Capital</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <button
              onClick={handleCreateLoan}
              disabled={loading || !loanAmount || !loanDuration || !loanPurpose}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50"
            >
              {loading ? 'Creating Loan...' : 'Submit Loan Application'}
            </button>
          </div>
        </div>
      )}

      {/* Loan Terms Information */}
      <div className="bg-gray-700 p-6 rounded-lg">
        <h3 className="text-xl font-semibold mb-4">Credit-Based Loan Terms</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h4 className="font-medium text-green-400 mb-2">Excellent Credit (750+)</h4>
            <p>• Interest Rate: 8%</p>
            <p>• Maximum Amount: 10,000 KRISHI</p>
            <p>• Best terms available</p>
          </div>
          <div>
            <h4 className="font-medium text-yellow-400 mb-2">Good Credit (650-749)</h4>
            <p>• Interest Rate: 10%</p>
            <p>• Maximum Amount: 8,000 KRISHI</p>
            <p>• Competitive rates</p>
          </div>
          <div>
            <h4 className="font-medium text-orange-400 mb-2">Fair Credit (550-649)</h4>
            <p>• Interest Rate: 12%</p>
            <p>• Maximum Amount: 6,000 KRISHI</p>
            <p>• Standard terms</p>
          </div>
          <div>
            <h4 className="font-medium text-red-400 mb-2">Poor Credit (500-549)</h4>
            <p>• Interest Rate: 15%</p>
            <p>• Maximum Amount: 4,000 KRISHI</p>
            <p>• Higher rates</p>
          </div>
        </div>
      </div>

      <div className="text-sm text-gray-500 mt-4">
        <p>Your loan terms are automatically calculated based on your credit score.</p>
        <p>Interest rates and maximum amounts are determined by your creditworthiness.</p>
      </div>
    </div>
  );
};

export default LoanApplication;