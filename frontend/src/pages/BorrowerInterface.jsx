import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';

const BorrowerInterface = () => {
  const { account, isConnected } = useWeb3();
  const [loanAmount, setLoanAmount] = useState('');
  const [loanTerm, setLoanTerm] = useState('30');
  const [collateralValue, setCollateralValue] = useState('');
  const [creditScore, setCreditScore] = useState(0);
  const [loanPreview, setLoanPreview] = useState(null);
  const [userLoans, setUserLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('apply');

  useEffect(() => {
    if (isConnected && account) {
      fetchCreditScore();
      fetchUserLoans();
    }
  }, [isConnected, account]);

  const fetchCreditScore = async () => {
    try {
      // Mock credit score - in production, this would call the CreditProtocol
      const mockScore = 650;
      setCreditScore(mockScore);
    } catch (error) {
      console.error('Error fetching credit score:', error);
    }
  };

  const fetchUserLoans = async () => {
    try {
      // Mock user loans data
      const mockLoans = [
        {
          id: 1,
          amount: 5000,
          interestRate: 8.5,
          termDays: 30,
          createdAt: '2024-10-15',
          dueDate: '2024-11-14',
          status: 'active',
          repaidAmount: 0,
          remainingAmount: 5000
        },
        {
          id: 2,
          amount: 3000,
          interestRate: 12.0,
          termDays: 60,
          createdAt: '2024-09-20',
          dueDate: '2024-11-19',
          status: 'active',
          repaidAmount: 1500,
          remainingAmount: 1500
        }
      ];
      setUserLoans(mockLoans);
    } catch (error) {
      console.error('Error fetching user loans:', error);
    }
  };

  const calculateLoanTerms = () => {
    if (!loanAmount || !loanTerm || !collateralValue) return;

    const amount = parseFloat(loanAmount);
    const term = parseInt(loanTerm);
    const collateral = parseFloat(collateralValue);

    // Calculate interest rate based on credit score and loan-to-value ratio
    let baseRate = 8.0; // 8% base rate
    
    // Credit score adjustments
    if (creditScore >= 800) baseRate -= 2.0;
    else if (creditScore >= 700) baseRate -= 1.0;
    else if (creditScore >= 600) baseRate += 0.0;
    else baseRate += 3.0;

    // Loan-to-value ratio adjustments
    const ltv = (amount / collateral) * 100;
    if (ltv > 80) baseRate += 2.0;
    else if (ltv > 60) baseRate += 1.0;

    const interestRate = Math.max(2.0, Math.min(25.0, baseRate));
    const totalInterest = (amount * interestRate * term) / (365 * 100);
    const totalRepayment = amount + totalInterest;
    const monthlyPayment = totalRepayment / (term / 30);

    setLoanPreview({
      amount,
      term,
      collateral,
      interestRate,
      totalInterest,
      totalRepayment,
      monthlyPayment,
      ltv
    });
  };

  useEffect(() => {
    calculateLoanTerms();
  }, [loanAmount, loanTerm, collateralValue, creditScore]);

  const handleLoanApplication = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    if (!loanAmount || !loanTerm || !collateralValue) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      // In production, this would call the LoanVault contract
      alert(`Loan application would be submitted for ${loanAmount} tokens`);
      setLoanAmount('');
      setLoanTerm('30');
      setCollateralValue('');
      setLoanPreview(null);
      fetchUserLoans();
    } catch (error) {
      console.error('Loan application error:', error);
      alert('Failed to submit loan application');
    } finally {
      setLoading(false);
    }
  };

  const handleLoanRepayment = async (loanId, amount) => {
    try {
      setLoading(true);
      // In production, this would call the LoanVault contract
      alert(`Repayment of ${amount} tokens would be processed for loan ${loanId}`);
      fetchUserLoans();
    } catch (error) {
      console.error('Repayment error:', error);
      alert('Failed to process repayment');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return `$${amount.toLocaleString()}`;
  };

  const formatPercentage = (rate) => {
    return `${rate.toFixed(2)}%`;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'repaid':
        return 'bg-blue-100 text-blue-800';
      case 'defaulted':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getCreditScoreColor = (score) => {
    if (score >= 750) return 'text-green-600';
    if (score >= 650) return 'text-blue-600';
    if (score >= 550) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCreditScoreLabel = (score) => {
    if (score >= 750) return 'Excellent';
    if (score >= 650) return 'Good';
    if (score >= 550) return 'Fair';
    return 'Poor';
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Borrower Interface</h1>
            <p className="text-gray-600 mb-8">Please connect your wallet to apply for loans</p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 max-w-md mx-auto">
              <p className="text-yellow-800">Connect your wallet to access loan services</p>
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Borrower Interface</h1>
          <p className="text-gray-600">Apply for loans and manage your borrowing</p>
        </div>

        {/* Credit Score Display */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Your Credit Score</h3>
              <p className="text-gray-600">Based on your on-chain activity and repayment history</p>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${getCreditScoreColor(creditScore)}`}>
                {creditScore}
              </div>
              <div className="text-sm text-gray-600">
                {getCreditScoreLabel(creditScore)}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <nav className="flex space-x-8">
            {[
              { id: 'apply', name: 'Apply for Loan' },
              { id: 'loans', name: 'My Loans' },
              { id: 'repayment', name: 'Repayment Schedule' }
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

        {/* Apply for Loan Tab */}
        {activeTab === 'apply' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Loan Application Form */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Loan Application</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Loan Amount (KRISHI)
                  </label>
                  <input
                    type="number"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter loan amount"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Loan Term (Days)
                  </label>
                  <select
                    value={loanTerm}
                    onChange={(e) => setLoanTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="30">30 days</option>
                    <option value="60">60 days</option>
                    <option value="90">90 days</option>
                    <option value="180">180 days</option>
                    <option value="365">365 days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Collateral Value (KRISHI)
                  </label>
                  <input
                    type="number"
                    value={collateralValue}
                    onChange={(e) => setCollateralValue(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Enter collateral value"
                  />
                </div>
                <button
                  onClick={handleLoanApplication}
                  disabled={loading || !loanPreview}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Processing...' : 'Apply for Loan'}
                </button>
              </div>
            </div>

            {/* Loan Preview */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Loan Terms Preview</h3>
              {loanPreview ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-gray-600">Loan Amount</div>
                      <div className="text-lg font-semibold">{formatCurrency(loanPreview.amount)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Interest Rate</div>
                      <div className="text-lg font-semibold">{formatPercentage(loanPreview.interestRate)}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">Term</div>
                      <div className="text-lg font-semibold">{loanPreview.term} days</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-600">LTV Ratio</div>
                      <div className="text-lg font-semibold">{formatPercentage(loanPreview.ltv)}</div>
                    </div>
                  </div>
                  <div className="border-t pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-600">Total Interest</div>
                        <div className="text-lg font-semibold text-blue-600">
                          {formatCurrency(loanPreview.totalInterest)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">Total Repayment</div>
                        <div className="text-lg font-semibold text-green-600">
                          {formatCurrency(loanPreview.totalRepayment)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="text-sm text-blue-800">
                      <strong>Monthly Payment:</strong> {formatCurrency(loanPreview.monthlyPayment)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  Fill in the loan details to see terms preview
                </div>
              )}
            </div>
          </div>
        )}

        {/* My Loans Tab */}
        {activeTab === 'loans' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Active Loans</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Loan ID
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
                      Remaining
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {userLoans.map((loan) => (
                    <tr key={loan.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{loan.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(loan.amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatPercentage(loan.interestRate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {loan.dueDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(loan.remainingAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(loan.status)}`}>
                          {loan.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <button
                          onClick={() => handleLoanRepayment(loan.id, loan.remainingAmount)}
                          className="text-green-600 hover:text-green-700 font-medium"
                        >
                          Repay
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Repayment Schedule Tab */}
        {activeTab === 'repayment' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Repayment Schedule</h3>
            <div className="space-y-4">
              {userLoans.map((loan) => (
                <div key={loan.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">Loan #{loan.id}</h4>
                    <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(loan.status)}`}>
                      {loan.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-gray-600">Original Amount</div>
                      <div className="font-medium">{formatCurrency(loan.amount)}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Interest Rate</div>
                      <div className="font-medium">{formatPercentage(loan.interestRate)}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Due Date</div>
                      <div className="font-medium">{loan.dueDate}</div>
                    </div>
                    <div>
                      <div className="text-gray-600">Remaining</div>
                      <div className="font-medium text-red-600">{formatCurrency(loan.remainingAmount)}</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <button
                      onClick={() => handleLoanRepayment(loan.id, loan.remainingAmount)}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Make Payment
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BorrowerInterface;
