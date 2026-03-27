import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import AuthModal from './AuthModal';
import ServicesDropdown from './ServicesDropdown';
import DigitalAssetsDropdown from './DigitalAssetsDropdown';
import SmartToolsDropdown from './SmartToolsDropdown';
import FinanceDropdown from './FinanceDropdown';
import MarketplacesDropdown from './MarketplacesDropdown';
import SupplyChainDropdown from './SupplyChainDropdown';
import toast from 'react-hot-toast';

const Navbar = () => {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, signOut, loading } = useAuth();
  
  // Web3 is optional - handle gracefully if not available
  let web3Data = { account: null, isConnected: false, connectWallet: () => {}, disconnectWallet: () => {}, isLoading: false, error: null, inAppWallet: null };
  try {
    const web3 = useWeb3();
    web3Data = web3;
  } catch (error) {
  }
  
  const { account, isConnected, connectWallet, disconnectWallet, isLoading, error, inAppWallet } = web3Data;
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [openUserMenu, setOpenUserMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [forceRefresh, setForceRefresh] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  
  // Track scroll for navbar styling
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Force refresh when user state changes
  useEffect(() => {
    setForceRefresh(prev => prev + 1);
  }, [user, loading]);
  
  // Drive auth UI strictly from `user`, which we clear aggressively on signOut
  const isAuthenticated = Boolean(user?.id);

  const isActive = (path) => location.pathname === path;

  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Check if user has any wallet connected (MetaMask or in-app)
  const hasWallet = isConnected || (inAppWallet && inAppWallet.address);
  const walletAddress = isConnected ? account : (inAppWallet ? inAppWallet.address : null);

  return (
    <nav className={`sticky top-0 z-40 transition-all duration-500 ${
      scrolled 
        ? 'py-2' 
        : 'py-3'
    }`}>
      <div className="px-3 sm:px-4 lg:px-6 transition-all duration-500">
        <div className={`glass-navbar rounded-2xl px-3 sm:px-5 transition-all duration-500 ${
          scrolled ? 'shadow-glass-lg' : ''
        }`}>
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2.5 shrink-0 group">
              <div className="w-9 h-9 bg-gradient-to-br from-agri-forest to-agri-leaf rounded-xl flex items-center justify-center shadow-md group-hover:shadow-glow-green transition-all duration-300 group-hover:scale-105">
                <span className="text-white text-sm">🌾</span>
              </div>
              <div className="hidden sm:block">
                <span className="text-base font-bold bg-gradient-to-r from-agri-forest to-agri-leaf bg-clip-text text-transparent dark:from-agri-mint dark:to-agri-light">
                  AgriFinance
                </span>
              </div>
              <div className="sm:hidden">
                <div className="text-sm font-bold bg-gradient-to-r from-agri-forest to-agri-leaf bg-clip-text text-transparent dark:from-agri-mint dark:to-agri-light leading-tight">
                  <div>Agri</div>
                  <div>Finance</div>
                </div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center flex-1 space-x-1 ml-8">
              <Link 
                to="/" 
                className={`nav-link transition-all duration-200 ${
                  isActive('/') 
                    ? 'text-agri-forest dark:text-agri-leaf bg-agri-leaf/15 dark:bg-agri-leaf/10 font-semibold' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8 dark:hover:bg-agri-leaf/5'
                }`}
              >
                Home
              </Link>
              <ServicesDropdown />
              <SmartToolsDropdown />
              <SupplyChainDropdown />
              <MarketplacesDropdown />
              <FinanceDropdown />
                     <DigitalAssetsDropdown />
                     {user?.role === 'admin' && (
                       <Link 
                         to="/admin" 
                         className={`nav-link transition-all duration-200 ${
                           isActive('/admin') 
                             ? 'text-agri-forest dark:text-agri-leaf bg-agri-leaf/15 dark:bg-agri-leaf/10 font-semibold' 
                             : 'text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8'
                         }`}
                       >
                         Admin
                       </Link>
                     )}
                     <Link 
                       to="/docs" 
                       className={`nav-link transition-all duration-200 ${
                         isActive('/docs') 
                           ? 'text-agri-forest dark:text-agri-leaf bg-agri-leaf/15 dark:bg-agri-leaf/10 font-semibold' 
                           : 'text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8'
                       }`}
                     >
                       Docs
                     </Link>
            </div>

            {/* Right side actions - Desktop */}
            <div className="hidden lg:flex items-center space-x-2 shrink-0 ml-4">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2.5 rounded-xl text-gray-500 dark:text-gray-400 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/10 dark:hover:bg-agri-leaf/5 transition-all duration-200"
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
              </button>

              {/* Authentication */}
              {isAuthenticated ? (
                <div className="relative">
                  <button
                    onClick={() => setOpenUserMenu((v) => !v)}
                    className="flex items-center space-x-2 glass-card px-3 py-2 rounded-xl hover:shadow-md transition-all duration-200 border border-agri-leaf/15 dark:border-agri-leaf/10"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-agri-forest to-agri-leaf text-white flex items-center justify-center text-sm font-semibold shadow-md">
                      {(user?.first_name || user?.email || 'U').charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {user?.first_name || 'User'}
                    </span>
                    <svg className={`w-4 h-4 text-gray-500 dark:text-gray-300 transform transition-transform ${openUserMenu ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {openUserMenu && (
                    <div className="absolute right-0 mt-2 w-52 glass-card rounded-xl shadow-glass-lg py-2 z-50 animate-scale-in border border-agri-leaf/10">
                      <div className="px-4 py-3 border-b border-agri-leaf/10 dark:border-agri-leaf/5">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user?.first_name || 'User'}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{user?.email}</p>
                      </div>
                      <Link 
                        to="/profile" 
                        onClick={() => setOpenUserMenu(false)} 
                        className="block px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-agri-leaf/10 dark:hover:bg-agri-leaf/5 transition-colors"
                      >
                        Profile
                      </Link>
                      <button
                        onClick={async () => {
                          try {
                            setOpenUserMenu(false);
                            toast.success('Signing out...');
                            const { error } = await signOut();
                            if (error) {
                              toast.error(error || 'Failed to sign out');
                              return;
                            }
                            setTimeout(() => {
                              window.location.href = '/signin';
                            }, 500);
                          } catch (error) {
                            toast.error('Failed to sign out');
                            console.error('Sign out error:', error);
                            setTimeout(() => {
                              window.location.href = '/signin';
                            }, 500);
                          }
                        }}
                        className="block w-full text-left px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Link 
                    to="/signin" 
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf transition-colors rounded-xl hover:bg-agri-leaf/8"
                  >
                    Sign In
                  </Link>
                  <Link 
                    to="/signup" 
                    className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-agri-forest to-agri-green hover:from-agri-deep hover:to-agri-forest rounded-xl transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                  >
                    Sign Up
                  </Link>
                </div>
              )}
              {/* Wallet - only when authenticated */}
              {isAuthenticated && (
                hasWallet ? (
                  <div className="flex items-center space-x-2 ml-1">
                    <div className="hidden xl:flex items-center glass-card px-3 py-2 rounded-xl border border-agri-leaf/15">
                      <div className="w-2 h-2 bg-agri-leaf rounded-full mr-2 animate-pulse"></div>
                      <span className="text-xs font-medium text-agri-forest dark:text-agri-mint">{formatAddress(walletAddress)}</span>
                    </div>
                    <button
                      onClick={disconnectWallet}
                      className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-agri-leaf/10 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 transition-all duration-200"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={connectWallet}
                    disabled={isLoading}
                    className="px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ml-1"
                  >
                    {isLoading ? 'Connecting...' : 'Connect Wallet'}
                  </button>
                )
              )}
            </div>

            {/* Mobile menu button */}
            <div className="lg:hidden flex items-center space-x-2">
              {/* Theme Toggle - Mobile */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/10 transition-colors"
              >
                {theme === 'light' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
              </button>

              {/* Mobile Auth/Wallet */}
              {isAuthenticated ? (
                <div className="flex items-center space-x-1">
                  <Link to="/profile" className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/10 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </Link>
                  <button
                    onClick={async () => {
                      try {
                        toast.success('Signing out...');
                        const { error } = await signOut();
                        if (error) {
                          toast.error(error || 'Failed to sign out');
                          return;
                        }
                        setTimeout(() => {
                          window.location.href = '/signin';
                        }, 500);
                      } catch (error) {
                        toast.error('Failed to sign out');
                        setTimeout(() => {
                          window.location.href = '/signin';
                        }, 500);
                      }
                    }}
                    className="p-2 rounded-xl text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-1">
                  <Link to="/signin" className="px-2 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-agri-forest rounded-lg transition-colors">
                    Sign In
                  </Link>
                  <Link to="/signup" className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-agri-forest to-agri-green rounded-lg shadow-sm">
                    Sign Up
                  </Link>
                </div>
              )}
              {/* Mobile Wallet - only when authenticated */}
              {isAuthenticated && (
                hasWallet ? (
                  <button
                    onClick={disconnectWallet}
                    className="p-2 rounded-xl text-agri-forest dark:text-agri-leaf hover:bg-agri-leaf/10 transition-colors"
                    title="Disconnect Wallet"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </button>
                ) : (
                  <button
                    onClick={connectWallet}
                    disabled={isLoading}
                    className="p-2 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 disabled:opacity-50 transition-colors"
                    title="Connect Wallet"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </button>
                )
              )}

              {/* Hamburger Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/10 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t border-agri-leaf/10 dark:border-agri-leaf/5 py-4 animate-slide-down">
              <div className="space-y-1">
                <Link 
                  to="/" 
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive('/') 
                      ? 'bg-agri-leaf/15 dark:bg-agri-leaf/10 text-agri-forest dark:text-agri-leaf' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8'
                  }`}
                >
                  Home
                </Link>
                
                {/* Services Dropdown for Mobile */}
                <div className="px-3 py-2">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 px-1">Services</div>
                  <div className="ml-2 space-y-0.5">
                    <Link 
                      to="/farmer" 
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8 transition-colors"
                    >
                      Farmer Dashboard
                    </Link>
                    <Link 
                      to="/lender" 
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8 transition-colors"
                    >
                      Lender Dashboard
                    </Link>
                    <Link 
                      to="/buyer" 
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8 transition-colors"
                    >
                      Buyer Dashboard
                    </Link>
                  </div>
                </div>

                {/* Supply Chain Section */}
                <div className="px-3 py-2">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 px-1">Supply Chain</div>
                  <div className="ml-2 space-y-0.5">
                    <Link 
                      to="/supply-chain" 
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3 py-2 rounded-xl text-sm transition-colors ${
                        isActive('/supply-chain') 
                          ? 'bg-agri-leaf/15 text-agri-forest dark:text-agri-leaf' 
                          : 'text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8'
                      }`}
                    >
                      Overview
                    </Link>
                    <Link 
                      to="/track-product" 
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3 py-2 rounded-xl text-sm transition-colors ${
                        isActive('/track-product') 
                          ? 'bg-agri-leaf/15 text-agri-forest dark:text-agri-leaf' 
                          : 'text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8'
                      }`}
                    >
                      Track Product
                    </Link>
                    <Link 
                      to="/verify-batch" 
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3 py-2 rounded-xl text-sm transition-colors ${
                        isActive('/verify-batch') 
                          ? 'bg-agri-leaf/15 text-agri-forest dark:text-agri-leaf' 
                          : 'text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8'
                      }`}
                    >
                      Batch Verification
                    </Link>
                  </div>
                </div>
                {/* Marketplaces Section */}
                <div className="px-3 py-2">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 px-1">Marketplaces</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-1">All marketplace and trading platforms</div>
                  <div className="ml-2 space-y-0.5">
                    <Link 
                      to="/nft-marketplace" 
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3 py-2 rounded-xl text-sm transition-colors ${
                        isActive('/nft-marketplace') 
                          ? 'bg-agri-leaf/15 text-agri-forest dark:text-agri-leaf' 
                          : 'text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8'
                      }`}
                    >
                      NFT Marketplace
                    </Link>
                    <Link 
                      to="/marketplace" 
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3 py-2 rounded-xl text-sm transition-colors ${
                        isActive('/marketplace') 
                          ? 'bg-agri-leaf/15 text-agri-forest dark:text-agri-leaf' 
                          : 'text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8'
                      }`}
                    >
                      Product Marketplace
                    </Link>
                  </div>
                </div>
                {/* Finance Section */}
                <div className="px-3 py-2">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 px-1">Finance</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-1">Group all financial-related tools</div>
                  <div className="ml-2 space-y-0.5">
                    <Link 
                      to="/loan-application" 
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3 py-2 rounded-xl text-sm transition-colors ${
                        isActive('/loan-application') 
                          ? 'bg-agri-leaf/15 text-agri-forest dark:text-agri-leaf' 
                          : 'text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8'
                      }`}
                    >
                      Apply for Loan
                    </Link>
                    <Link 
                      to="/credit-scoring" 
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3 py-2 rounded-xl text-sm transition-colors ${
                        isActive('/credit-scoring') 
                          ? 'bg-agri-leaf/15 text-agri-forest dark:text-agri-leaf' 
                          : 'text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8'
                      }`}
                    >
                      Credit Scoring
                    </Link>
                    <Link 
                      to="/token-faucet" 
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3 py-2 rounded-xl text-sm transition-colors ${
                        isActive('/token-faucet') 
                          ? 'bg-agri-leaf/15 text-agri-forest dark:text-agri-leaf' 
                          : 'text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8'
                      }`}
                    >
                      Token Faucet
                    </Link>
                    <Link 
                      to="/staking" 
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3 py-2 rounded-xl text-sm transition-colors ${
                        isActive('/staking') 
                          ? 'bg-agri-leaf/15 text-agri-forest dark:text-agri-leaf' 
                          : 'text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8'
                      }`}
                    >
                      Staking
                    </Link>
                    <Link 
                      to="/transactions" 
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3 py-2 rounded-xl text-sm transition-colors ${
                        isActive('/transactions') 
                          ? 'bg-agri-leaf/15 text-agri-forest dark:text-agri-leaf' 
                          : 'text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8'
                      }`}
                    >
                      Transaction History
                    </Link>
                  </div>
                </div>
                {/* Digital Assets Section */}
                <div className="px-3 py-2">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 px-1">Digital Assets</div>
                  <div className="ml-2 space-y-0.5">
                    <Link 
                      to="/hybrid-wallet" 
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-2 rounded-xl text-sm text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8 transition-colors"
                    >
                      <span className="inline-flex items-center gap-2"><svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12.75V8.25A2.25 2.25 0 0018.75 6h-13.5A2.25 2.25 0 003 8.25v7.5A2.25 2.25 0 005.25 18h13.5A2.25 2.25 0 0021 15.75V15M21 12h-3.375a1.125 1.125 0 100 2.25H21" /></svg> Wallet</span>
                    </Link>
                  </div>
                </div>
                {/* Smart Tools Section */}
                <div className="px-3 py-2">
                  <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2 px-1">Smart Tools</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-1">All your blockchain / tech-powered modules</div>
                  <div className="ml-2 space-y-0.5">
                    {/* Smart Account - Hidden for farmers */}
                    {user?.role !== 'farmer' && (
                      <Link 
                        to="/smart-account" 
                        onClick={() => setMobileMenuOpen(false)}
                        className={`block px-3 py-2 rounded-xl text-sm transition-colors ${
                          isActive('/smart-account') 
                            ? 'bg-agri-leaf/15 text-agri-forest dark:text-agri-leaf' 
                            : 'text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8'
                        }`}
                      >
                        Smart Account
                      </Link>
                    )}
                    {/* Gasless Onboarding - Hidden for farmers */}
                    {user?.role !== 'farmer' && (
                      <Link 
                        to="/onboarding" 
                        onClick={() => setMobileMenuOpen(false)}
                        className={`block px-3 py-2 rounded-xl text-sm transition-colors ${
                          isActive('/onboarding') 
                            ? 'bg-agri-leaf/15 text-agri-forest dark:text-agri-leaf' 
                            : 'text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8'
                        }`}
                      >
                        Gasless Onboarding
                      </Link>
                    )}
                    <Link 
                      to="/zk-verification" 
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3 py-2 rounded-xl text-sm transition-colors ${
                        isActive('/zk-verification') 
                          ? 'bg-agri-leaf/15 text-agri-forest dark:text-agri-leaf' 
                          : 'text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8'
                      }`}
                    >
                      ZK Verification
                    </Link>
                    <Link 
                      to="/dao" 
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-3 py-2 rounded-xl text-sm transition-colors ${
                        isActive('/dao') 
                          ? 'bg-agri-leaf/15 text-agri-forest dark:text-agri-leaf' 
                          : 'text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8'
                      }`}
                    >
                      DAO Governance
                    </Link>
                  </div>
                </div>
                {user?.role === 'admin' && (
                  <Link 
                    to="/admin" 
                    onClick={() => setMobileMenuOpen(false)}
                    className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive('/admin') 
                        ? 'bg-agri-leaf/15 text-agri-forest dark:text-agri-leaf' 
                        : 'text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8'
                    }`}
                  >
                    Admin
                  </Link>
                )}
                <Link 
                  to="/docs" 
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive('/docs') 
                      ? 'bg-agri-leaf/15 text-agri-forest dark:text-agri-leaf' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-agri-forest dark:hover:text-agri-leaf hover:bg-agri-leaf/8'
                  }`}
                >
                  Docs
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;