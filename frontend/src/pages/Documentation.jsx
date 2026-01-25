import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  MdDashboard,
  MdAccountBalance,
  MdAttachMoney,
  MdShoppingCart,
  MdAccountBalanceWallet,
  MdLock,
  MdHowToVote,
  MdSearch,
  MdVerifiedUser
} from 'react-icons/md';

const Documentation = () => {
  const { user } = useAuth();
  const [activeSection, setActiveSection] = useState('overview');

  const sections = [
    { id: 'overview', title: 'Overview', icon: '📖' },
    { id: 'getting-started', title: 'Getting Started', icon: '🚀' },
    { id: 'services', title: 'Services', icon: '💼' },
    { id: 'finance', title: 'Finance', icon: '💰' },
    { id: 'smart-tools', title: 'Smart Tools', icon: '🔧' },
    { id: 'supply-chain', title: 'Supply Chain', icon: '🔗' },
    { id: 'marketplaces', title: 'Marketplaces', icon: '🛒' },
    { id: 'digital-assets', title: 'Digital Assets', icon: '💳' },
    { id: 'faq', title: 'FAQ', icon: '❓' }
  ];

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          🌾 AgriFinance: Blockchain-Powered Agricultural DeFi Platform
        </h2>
        <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-4">
          AgriFinance is a blockchain-powered platform that revolutionizes agricultural finance with 
          zero-collateral loans, transparent supply chains, AI-powered credit scoring, and advanced Web3 features 
          including Zero-Knowledge verification and gasless transactions.
        </p>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">🚀 Platform Highlights</h3>
          <div className="grid md:grid-cols-2 gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Zero-collateral loans with AI credit scoring</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Liquidity pools and lending protocol</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Zero-Knowledge proof verification</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Complete supply chain traceability</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span className="text-gray-600 dark:text-gray-400">NFT marketplace for agricultural assets</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-green-500">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Decentralized governance system</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-lg p-4 shadow-sm border border-green-200 dark:border-green-800">
          <div className="text-2xl mb-2">👨‍🌾</div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">For Farmers</h3>
          <p className="text-gray-600 dark:text-gray-400 text-xs mb-2">
            Access instant loans without collateral, track your crops, and sell directly to verified buyers.
          </p>
          <div className="text-xs text-green-600 dark:text-green-400 font-medium">
            🚀 Zero-collateral loans • 💰 AI credit scoring • 📱 Mobile-friendly
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4 shadow-sm border border-blue-200 dark:border-blue-800">
          <div className="text-2xl mb-2">💰</div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">For Lenders</h3>
          <p className="text-gray-600 dark:text-gray-400 text-xs mb-2">
            Provide liquidity with AI-powered risk assessment and earn competitive returns.
          </p>
          <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
            🤖 AI risk analysis • 📊 Portfolio tracking • 🌱 Impact investing
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg p-4 shadow-sm border border-purple-200 dark:border-purple-800">
          <div className="text-2xl mb-2">🛒</div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">For Buyers</h3>
          <p className="text-gray-600 dark:text-gray-400 text-xs mb-2">
            Purchase verified agricultural products with complete traceability from farm to table.
          </p>
          <div className="text-xs text-purple-600 dark:text-purple-400 font-medium">
            🔍 QR code verification • 📦 Traceability • 🌾 Direct farmer connection
          </div>
        </div>
      </div>
    </div>
  );

  const renderGettingStarted = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        🚀 Getting Started
      </h2>
      
      <div className="space-y-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            Step 1: Create an Account
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Sign up for a free account to access all platform features including financial services, smart tools, and marketplaces.
          </p>
          <Link to="/signup" className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors">
            Create Account
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            Step 2: Choose Your Role
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Select whether you're a farmer, lender, or buyer to access relevant features and dashboards.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link to="/farmer" className="bg-green-600 text-white px-3 py-2 rounded-lg text-xs hover:bg-green-700">
              👨‍🌾 Farmer Dashboard
            </Link>
            <Link to="/lender" className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs hover:bg-blue-700">
              💰 Lender Dashboard
            </Link>
            <Link to="/buyer" className="bg-purple-600 text-white px-3 py-2 rounded-lg text-xs hover:bg-purple-700">
              🛒 Buyer Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );

  const renderServices = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        💼 Services
      </h2>
      
      <div className="space-y-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            👨‍🌾 Farmer Services
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Access zero-collateral loans, track your crops, manage inventory, and connect with buyers.
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex items-start space-x-2">
              <span className="text-green-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Apply for agricultural loans with AI credit scoring</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-green-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Track crop production and inventory</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-green-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Connect with verified buyers</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            💰 Lender Services
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Provide liquidity to farmers, review loan applications, and manage your portfolio.
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex items-start space-x-2">
              <span className="text-blue-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Provide liquidity to the lending pool</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-blue-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Review and approve loan applications</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-blue-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Track portfolio performance</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            🛒 Buyer Services
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Purchase verified agricultural products with complete supply chain traceability.
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex items-start space-x-2">
              <span className="text-purple-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Browse verified products</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-purple-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Track complete supply chain</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-purple-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Verify product authenticity</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFinance = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        💰 Finance Features
      </h2>
      
      <div className="space-y-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            💧 Liquidity Pool
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Provide KRSI liquidity to the lending pool and earn APY from borrower repayments.
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex items-start space-x-2">
              <span className="text-green-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Deposit KRSI tokens to the pool</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-green-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Earn returns from borrower interest</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-green-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Withdraw liquidity when needed</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            💳 Loans
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Create and manage loans using the LoanVault smart contract with fixed 8% APR.
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex items-start space-x-2">
              <span className="text-blue-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Create loans on-chain with LoanVault</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-blue-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Fixed 8% APR (DAO-controlled)</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-blue-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Repay loans directly on blockchain</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-blue-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">View active and repaid loans</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            📋 Loan Requests
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Submit unsecured loan requests for committee review and approval.
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex items-start space-x-2">
              <span className="text-purple-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Submit loan applications</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-purple-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Track application status</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            👥 Committee
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Lenders can stake tokens and vote on loan requests for decentralized approval.
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex items-start space-x-2">
              <span className="text-orange-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Stake tokens to join committee</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-orange-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Vote on loan applications</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            📊 Credit Scoring
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Check your credit score based on AI-powered risk assessment and blockchain data.
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex items-start space-x-2">
              <span className="text-indigo-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">AI-powered credit assessment</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-indigo-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Multi-factor risk analysis</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            📈 Staking
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Stake KRSI tokens to earn rewards and participate in platform governance.
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex items-start space-x-2">
              <span className="text-teal-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Earn passive income from staking</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-teal-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Governance participation</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            📜 Transaction History
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            View your complete transaction history including deposits, withdrawals, loans, and repayments.
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex items-start space-x-2">
              <span className="text-gray-600 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Categorized transaction view</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-gray-600 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Filter by transaction type</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-gray-600 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Etherscan links for on-chain transactions</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSmartTools = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        🔧 Smart Tools
      </h2>
      
      <div className="space-y-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            🔐 ZK Verification
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Zero-Knowledge proof verification for privacy-preserving transactions and credential verification.
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex items-start space-x-2">
              <span className="text-purple-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Privacy-preserving verification</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-purple-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Document verification without revealing data</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            🏛️ DAO Governance
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Participate in decentralized governance and community-driven decision making for platform development.
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex items-start space-x-2">
              <span className="text-orange-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Vote on platform proposals</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-orange-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Submit governance proposals</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-orange-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Community-driven platform evolution</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSupplyChain = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        🔗 Supply Chain
      </h2>
      
      <div className="space-y-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            🔍 Supply Chain Overview
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Complete supply chain management from farm to consumer with blockchain verification.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            📱 Track Product
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Track products from farm to consumer with complete transparency and real-time updates.
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex items-start space-x-2">
              <span className="text-blue-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Farm origin tracking</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-blue-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Transportation monitoring</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            ✅ Verify Batch
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Verify product authenticity and traceability using blockchain verification.
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex items-start space-x-2">
              <span className="text-green-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">QR code scanning</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-green-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Complete product history</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMarketplaces = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        🛒 Marketplaces
      </h2>
      
      <div className="space-y-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            🎨 NFT Marketplace
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Trade agricultural NFTs and digital assets in our decentralized marketplace.
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex items-start space-x-2">
              <span className="text-green-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Agricultural land NFTs</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-green-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Secure trading platform</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            🛍️ Product Marketplace
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Buy and sell verified agricultural products with blockchain verification.
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex items-start space-x-2">
              <span className="text-blue-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Verified agricultural products</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-blue-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Complete product traceability</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDigitalAssets = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        💳 Digital Assets
      </h2>
      
      <div className="space-y-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            💼 Hybrid Wallet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
            Manage your mobile and blockchain wallets in one place with seamless integration.
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex items-start space-x-2">
              <span className="text-blue-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">In-app wallet support</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-blue-500 mt-1">✓</span>
              <span className="text-gray-600 dark:text-gray-400">Seamless wallet switching</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFAQ = () => (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        ❓ Frequently Asked Questions
      </h2>
      
      <div className="space-y-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            What is AgriFinance?
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            AgriFinance is a blockchain-powered platform that helps farmers get loans without traditional collateral, 
            tracks agricultural products from farm to market, and connects farmers with lenders and buyers using 
            AI-powered credit scoring, Zero-Knowledge verification, and NFT land ownership validation.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            How do I get a loan as a farmer?
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Farmers can create loans directly through the Loans page. Our AI-powered credit scoring system analyzes your 
            farming data, land ownership NFTs, and blockchain verification. Loans are created on-chain using the LoanVault 
            smart contract with a fixed 8% APR.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            How does the liquidity pool work?
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Lenders can deposit KRSI tokens into the liquidity pool. These tokens are then available for farmers to borrow. 
            Lenders earn returns from the interest paid by borrowers. You can withdraw your liquidity at any time.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            What is Zero-Knowledge verification?
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Zero-Knowledge verification allows you to prove you have certain credentials or data without revealing the actual data. 
            This is useful for privacy-preserving verification of land ownership, farming certifications, and other sensitive information.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            How does product verification work?
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Each batch of agricultural products gets a unique QR code linked to blockchain records. Buyers can scan this code to see the complete 
            history of the product, including farm details, harvest date, transportation, and storage information.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            What is the interest rate for loans?
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            All loans have a fixed 8% APR. This rate is controlled by DAO governance and can only be changed through a community vote.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
            How does AI credit scoring work?
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Our AI system analyzes multiple factors including farm size, crop type, historical performance, weather data, 
            market conditions, and blockchain verification data to provide fair and accurate credit scores for loan applications.
          </p>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'overview': return renderOverview();
      case 'getting-started': return renderGettingStarted();
      case 'services': return renderServices();
      case 'finance': return renderFinance();
      case 'smart-tools': return renderSmartTools();
      case 'supply-chain': return renderSupplyChain();
      case 'marketplaces': return renderMarketplaces();
      case 'digital-assets': return renderDigitalAssets();
      case 'faq': return renderFAQ();
      default: return renderOverview();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar */}
          <div className="lg:w-1/4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 sticky top-8">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
                📖 Documentation
              </h2>
              <nav className="space-y-1">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium transition-colors duration-200 ${
                      activeSection === section.id
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span className="mr-2">{section.icon}</span>
                    {section.title}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:w-3/4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Documentation;
