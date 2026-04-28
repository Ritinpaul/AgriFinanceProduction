import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Web3Provider } from './context/Web3Context';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AccountAbstractionProvider } from './context/AccountAbstractionContext';
import Navbar from './components/Navbar';
import MobileTabBar from './components/MobileTabBar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import LandingPage from './pages/LandingPage';
import Services from './pages/Services';
import SmartTools from './pages/SmartTools';
import FarmerDashboard from './pages/FarmerDashboard';
import LenderDashboard from './pages/LenderDashboard';
import BuyerDashboard from './pages/BuyerDashboard';
import SupplyChain from './pages/SupplyChain';
import NFTMarketplace from './pages/NFTMarketplace';
import ProductVerification from './pages/ProductVerification';
import TokenFaucetPage from './pages/TokenFaucetPage';
import Wallet from './pages/Wallet';
import HybridWallet from './pages/HybridWallet';
import DAOGovernance from './pages/DAOGovernance';
import Staking from './pages/Staking';
import TransactionHistory from './pages/TransactionHistory';
import AdminDashboard from './pages/AdminDashboard';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Profile from './pages/Profile';
import Documentation from './pages/Documentation';
import CreditScoring from './components/CreditScoring';
import LoanApplication from './components/LoanApplication';
import BatchManagement from './components/BatchManagement';
import Traceability from './pages/Traceability';
import Marketplace from './pages/Marketplace';
import VerifyBatch from './pages/VerifyBatch';
import TrackProduct from './pages/TrackProduct';
import ZKVerificationDashboard from './components/ZKVerificationDashboard';
import SmartAccountSetup from './components/SmartAccountSetup';
import GaslessOnboarding from './components/GaslessOnboarding';
import OnRamp from './pages/OnRamp';
import Liquidity from './pages/Liquidity';
import Loans from './pages/Loans';
import Documents from './pages/Documents';
import Committee from './pages/Committee';
import LoanRequests from './pages/LoanRequests';
import AdminSignUp from './pages/AdminSignUp';
import AdminAnalytics from './pages/AdminAnalytics';
import './App.css';

// Main app content component
const AppContent = () => {
  const { user, loading } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-agri-sand dark:bg-agri-dark flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-agri-leaf mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Router>
        <div className="min-h-screen bg-agri-sand dark:bg-agri-dark transition-colors duration-300">
          <Navbar />
          <main className="container mx-auto px-4 py-6 pb-24 sm:pb-6">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/home" element={<Home />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/admin-signup" element={<AdminSignUp />} />
              <Route path="/admin/analytics" element={<ProtectedRoute roles={["admin"]}><AdminAnalytics /></ProtectedRoute>} />
              <Route path="/services" element={<Services />} />
              <Route path="/smart-tools" element={<SmartTools />} />
              <Route path="/farmer" element={<ProtectedRoute roles={["farmer", "admin"]}><FarmerDashboard /></ProtectedRoute>} />
              <Route path="/lender" element={<ProtectedRoute roles={["lender", "admin"]}><LenderDashboard /></ProtectedRoute>} />
              <Route path="/buyer" element={<ProtectedRoute roles={["buyer", "admin"]}><BuyerDashboard /></ProtectedRoute>} />
              <Route path="/supply-chain" element={<SupplyChain />} />
              <Route path="/nft-marketplace" element={<NFTMarketplace />} />
              <Route path="/token-faucet" element={<ProtectedRoute><TokenFaucetPage /></ProtectedRoute>} />
              <Route path="/onramp" element={<ProtectedRoute><OnRamp /></ProtectedRoute>} />
              <Route path="/liquidity" element={<ProtectedRoute roles={["farmer", "lender", "admin"]}><Liquidity /></ProtectedRoute>} />
              <Route path="/loans" element={<ProtectedRoute><Loans /></ProtectedRoute>} />
              <Route path="/committee" element={<ProtectedRoute roles={["lender", "admin"]}><Committee /></ProtectedRoute>} />
              <Route path="/loan-requests" element={<ProtectedRoute roles={["farmer", "admin"]}><LoanRequests /></ProtectedRoute>} />
              <Route path="/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
              <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
              <Route path="/hybrid-wallet" element={<ProtectedRoute><HybridWallet /></ProtectedRoute>} />
              <Route path="/dao" element={<ProtectedRoute><DAOGovernance /></ProtectedRoute>} />
              <Route path="/governance" element={<ProtectedRoute><DAOGovernance /></ProtectedRoute>} />
              <Route path="/staking" element={<ProtectedRoute><Staking /></ProtectedRoute>} />
              <Route path="/transactions" element={<ProtectedRoute><TransactionHistory /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><AdminDashboard /></ProtectedRoute>} />
              <Route path="/docs" element={<Documentation />} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/credit-scoring" element={<ProtectedRoute><CreditScoring /></ProtectedRoute>} />
              <Route path="/loan-application" element={<ProtectedRoute><LoanApplication /></ProtectedRoute>} />
              <Route path="/batch-management" element={<ProtectedRoute roles={["farmer", "admin"]}><BatchManagement /></ProtectedRoute>} />
              <Route path="/traceability/:hash" element={<Traceability />} />
              <Route path="/track-product" element={<TrackProduct />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/verify-batch" element={<ProtectedRoute><VerifyBatch /></ProtectedRoute>} />
              <Route path="/zk-verification" element={<ProtectedRoute><ZKVerificationDashboard /></ProtectedRoute>} />
              <Route path="/smart-account" element={<ProtectedRoute roles={["lender", "buyer", "admin"]}><SmartAccountSetup /></ProtectedRoute>} />
              <Route path="/onboarding" element={<ProtectedRoute roles={["lender", "buyer", "admin"]}><GaslessOnboarding /></ProtectedRoute>} />
            </Routes>
          </main>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'var(--toast-bg, #363636)',
                color: 'var(--toast-color, #fff)',
              },
            }}
          />
        </div>
        <MobileTabBar />
      </Router>
    </>
  );
};

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-100 flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-lg text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Context Error</h1>
            <p className="text-gray-700 mb-4">Error in {this.props.contextName || 'context provider'}</p>
            <p className="text-sm text-gray-500">Check the console for details.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {

  return (
    <ErrorBoundary contextName="ThemeProvider">
      <ThemeProvider>
        <ErrorBoundary contextName="AuthProvider">
          <AuthProvider>
            <ErrorBoundary contextName="AccountAbstractionProvider">
              <AccountAbstractionProvider>
                <ErrorBoundary contextName="Web3Provider">
                  <Web3Provider>
                    <AppContent />
                  </Web3Provider>
                </ErrorBoundary>
              </AccountAbstractionProvider>
            </ErrorBoundary>
          </AuthProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;