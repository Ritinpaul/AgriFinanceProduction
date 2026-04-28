import React from 'react';
import { Link } from 'react-router-dom';
import { useWeb3 } from '../context/Web3Context';
import { useAuth } from '../context/AuthContext';
import {
  MdAttachMoney,
  MdInventory,
  MdSmartToy,
  MdDescription,
  MdAgriculture,
  MdAccountBalance,
  MdShoppingCart,
  MdWarning,
  MdInfo
} from 'react-icons/md';

const Home = () => {
  // Web3 is optional - handle gracefully if not available
  let web3Data = { address: null, connectWallet: () => {} };
  try {
    const web3 = useWeb3();
    web3Data = web3;
  } catch (error) {
  }
  
  const { address, connectWallet } = web3Data;
  const { user } = useAuth();

  const features = [
    {
      title: 'Zero Collateral DeFi Lending',
      description: 'Access instant blockchain loans without traditional collateral requirements',
      icon: MdAttachMoney,
      link: '/farmer',
      color: 'from-agri-forest to-agri-leaf',
      iconBg: 'bg-gradient-to-br from-agri-forest to-agri-leaf'
    },
    {
      title: 'Blockchain Supply Chain',
      description: 'Track produce from farm to market with complete transparency',
      icon: MdInventory,
      link: '/supply-chain',
      color: 'from-blue-500 to-blue-600',
      iconBg: 'bg-gradient-to-br from-blue-500 to-blue-600'
    },
    {
      title: 'AI Credit Scoring',
      description: 'Get fair credit assessments based on yield, sales, and weather data',
      icon: MdSmartToy,
      link: '/farmer',
      color: 'from-purple-500 to-purple-600',
      iconBg: 'bg-gradient-to-br from-purple-500 to-purple-600'
    },
    {
      title: 'NFT Land Ownership',
      description: 'Verify land ownership and improve creditworthiness with NFTs',
      icon: MdDescription,
      link: '/nft-marketplace',
      color: 'from-agri-warm to-agri-amber',
      iconBg: 'bg-gradient-to-br from-agri-warm to-agri-amber'
    }
  ];

  const userTypes = [
    {
      title: 'Farmer',
      description: 'Apply for loans, track your produce, and manage your land NFTs',
      features: ['Loan Applications', 'Supply Chain Tracking', 'Land NFT Management', 'Credit Score Monitoring'],
      link: '/farmer',
      color: 'from-agri-forest to-agri-leaf',
      icon: MdAgriculture
    },
    {
      title: 'Lender',
      description: 'Provide liquidity and earn yields through agricultural lending',
      features: ['Loan Pool Management', 'Risk Assessment', 'Yield Generation', 'Portfolio Analytics'],
      link: '/lender',
      color: 'from-blue-500 to-blue-600',
      icon: MdAccountBalance
    },
    {
      title: 'Buyer',
      description: 'Purchase verified produce with complete traceability',
      features: ['Product Verification', 'Supply Chain Transparency', 'Quality Assurance', 'Direct Farmer Connection'],
      link: '/buyer',
      color: 'from-purple-500 to-purple-600',
      icon: MdShoppingCart
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden hero-section">
        {/* Decorative background elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-agri-leaf/10 dark:bg-agri-leaf/5 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-agri-forest/8 dark:bg-agri-forest/5 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-agri-mint/5 dark:bg-agri-mint/3 rounded-full blur-3xl"></div>
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-12 sm:pb-16">
          <div className="text-center animate-fade-in">
            <div className="flex justify-center mb-6 sm:mb-8">
              <div className="glass-card p-4 sm:p-5 shadow-glow-green animate-float">
                <span className="text-4xl sm:text-5xl">🌾</span>
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-gray-100 mb-4 sm:mb-5 px-4 tracking-tight">
              Welcome to{' '}
              <span className="bg-gradient-to-r from-agri-forest via-agri-green to-agri-leaf bg-clip-text text-transparent">
                AgriFinance
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 dark:text-gray-400 mb-3 sm:mb-4 max-w-3xl mx-auto font-medium px-4">
              Blockchain-Powered Agricultural Supply Chain & DeFi Lending Platform
            </p>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-500 mb-6 sm:mb-8 max-w-4xl mx-auto leading-relaxed px-4">
              Empowering farmers with zero-collateral loans, transparent supply chains, 
              AI-based credit scoring, and NFT land ownership verification.
            </p>
            
            {!user && (
              <div className="glass-card p-4 mb-8 max-w-2xl mx-auto border-l-4 border-agri-warm">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <MdWarning className="text-agri-warm text-xl" />
                  </div>
                  <div className="ml-3">
                    <p className="text-agri-warm dark:text-agri-warm font-medium text-sm">
                      Please sign in to access all features
                    </p>
                  </div>
                </div>
              </div>
            )}

            {user && !address && (
              <div className="glass-card p-4 mb-8 max-w-2xl mx-auto border-l-4 border-blue-500">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <MdInfo className="text-blue-500 text-xl" />
                  </div>
                  <div className="ml-3">
                    <p className="text-blue-700 dark:text-blue-300 font-medium text-sm">
                      {user?.role === 'farmer' 
                        ? 'Farmers use in-app wallet only for blockchain features'
                        : 'Connect your wallet or use in-app wallet for blockchain features'
                      }
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
              <Link 
                to="/farmer" 
                className="group bg-gradient-to-r from-agri-forest to-agri-green hover:from-agri-deep hover:to-agri-forest text-white font-semibold py-3 sm:py-3.5 px-6 sm:px-8 rounded-xl text-sm shadow-lg hover:shadow-xl transition-all duration-300 text-center flex items-center justify-center gap-2 hover:-translate-y-1"
              >
                <MdAgriculture className="text-lg group-hover:scale-110 transition-transform" />
                <span>Farmer Dashboard</span>
              </Link>
              <Link 
                to="/lender" 
                className="group bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold py-3 sm:py-3.5 px-6 sm:px-8 rounded-xl text-sm shadow-lg hover:shadow-xl transition-all duration-300 text-center flex items-center justify-center gap-2 hover:-translate-y-1"
              >
                <MdAccountBalance className="text-lg group-hover:scale-110 transition-transform" />
                <span>Lender Dashboard</span>
              </Link>
              <Link 
                to="/buyer" 
                className="group bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-semibold py-3 sm:py-3.5 px-6 sm:px-8 rounded-xl text-sm shadow-lg hover:shadow-xl transition-all duration-300 text-center flex items-center justify-center gap-2 hover:-translate-y-1"
              >
                <MdShoppingCart className="text-lg group-hover:scale-110 transition-transform" />
                <span>Buyer Dashboard</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Section */}
      <section className="py-16 sm:py-20 relative">
        <div className="absolute inset-0 bg-white/50 dark:bg-agri-deep/30 backdrop-blur-sm"></div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-14 animate-fade-in">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">Core Features</h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Revolutionizing agriculture through blockchain technology and AI-powered solutions
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {features.map((feature, index) => (
              <Link
                key={index}
                to={feature.link}
                className="group glass-card p-6 hover:shadow-glass-lg hover:-translate-y-2 transition-all duration-300"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="text-center">
                  <div className={`${feature.iconBg} rounded-2xl p-4 w-16 h-16 mx-auto mb-5 flex items-center justify-center group-hover:scale-110 group-hover:shadow-lg transition-all duration-300`}>
                    <feature.icon className="text-white text-2xl" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-agri-forest dark:group-hover:text-agri-leaf transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* User Types Section */}
      <section className="py-16 sm:py-20 hero-section relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 right-20 w-64 h-64 bg-agri-leaf/8 dark:bg-agri-leaf/3 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 left-20 w-48 h-48 bg-agri-forest/6 dark:bg-agri-forest/3 rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">Choose Your Role</h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Join the agricultural revolution with role-specific tools and features
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {userTypes.map((userType, index) => (
              <Link
                key={index}
                to={userType.link}
                className="group glass-card p-6 hover:shadow-glass-lg hover:-translate-y-2 transition-all duration-300"
              >
                <div className={`bg-gradient-to-br ${userType.color} rounded-2xl p-4 w-16 h-16 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:shadow-lg transition-all duration-300`}>
                  <userType.icon className="text-white text-2xl" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2 group-hover:text-agri-forest dark:group-hover:text-agri-leaf transition-colors">
                  {userType.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 leading-relaxed">
                  {userType.description}
                </p>
                <ul className="space-y-2.5 mb-6">
                  {userType.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center text-gray-600 dark:text-gray-400">
                      <span className="w-5 h-5 rounded-full bg-agri-leaf/20 dark:bg-agri-leaf/10 flex items-center justify-center mr-2.5 flex-shrink-0">
                        <span className="text-agri-forest dark:text-agri-leaf text-xs">✓</span>
                      </span>
                      <span className="text-sm font-medium">{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center text-agri-forest dark:text-agri-leaf font-semibold text-sm group-hover:translate-x-1 transition-transform">
                  Get Started 
                  <svg className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 sm:py-20 relative">
        <div className="absolute inset-0 bg-white/50 dark:bg-agri-deep/30 backdrop-blur-sm"></div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">Platform Statistics</h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Trusted by thousands of farmers, lenders, and buyers worldwide
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            <div className="glass-card p-5 sm:p-6 text-center hover:shadow-glass-lg hover:-translate-y-1 transition-all duration-300 border-t-2 border-agri-leaf">
              <div className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-agri-forest to-agri-leaf bg-clip-text text-transparent mb-1.5">$2.5M</div>
              <div className="text-gray-600 dark:text-gray-400 font-medium text-xs sm:text-sm uppercase tracking-wider">Total Loans Disbursed</div>
            </div>
            <div className="glass-card p-5 sm:p-6 text-center hover:shadow-glass-lg hover:-translate-y-1 transition-all duration-300 border-t-2 border-blue-500">
              <div className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-blue-500 to-blue-600 bg-clip-text text-transparent mb-1.5">1,250</div>
              <div className="text-gray-600 dark:text-gray-400 font-medium text-xs sm:text-sm uppercase tracking-wider">Active Farmers</div>
            </div>
            <div className="glass-card p-5 sm:p-6 text-center hover:shadow-glass-lg hover:-translate-y-1 transition-all duration-300 border-t-2 border-purple-500">
              <div className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-purple-500 to-purple-600 bg-clip-text text-transparent mb-1.5">850</div>
              <div className="text-gray-600 dark:text-gray-400 font-medium text-xs sm:text-sm uppercase tracking-wider">Verified Batches</div>
            </div>
            <div className="glass-card p-5 sm:p-6 text-center hover:shadow-glass-lg hover:-translate-y-1 transition-all duration-300 border-t-2 border-agri-warm">
              <div className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-agri-warm to-agri-amber bg-clip-text text-transparent mb-1.5">95%</div>
              <div className="text-gray-600 dark:text-gray-400 font-medium text-xs sm:text-sm uppercase tracking-wider">Loan Repayment Rate</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-20 relative overflow-hidden">
        <div className="absolute inset-0 premium-gradient"></div>
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-agri-leaf/15 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-agri-mint/10 rounded-full blur-3xl"></div>
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Ready to Transform Agriculture?
          </h2>
          <p className="text-sm sm:text-base text-agri-light/80 mb-8 max-w-3xl mx-auto leading-relaxed">
            Join thousands of farmers, lenders, and buyers already using AgriFinance
            to build a more transparent and inclusive agricultural ecosystem.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/farmer"
              className="group bg-white text-agri-forest px-8 py-3 rounded-xl font-semibold text-sm hover:bg-agri-cream transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              <MdAgriculture className="text-lg group-hover:scale-110 transition-transform" />
              Start as Farmer
            </Link>
            <Link
              to="/lender"
              className="group bg-agri-leaf/20 text-white border border-agri-leaf/40 px-8 py-3 rounded-xl font-semibold text-sm hover:bg-agri-leaf/30 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-1 backdrop-blur-sm flex items-center justify-center gap-2"
            >
              <MdAccountBalance className="text-lg group-hover:scale-110 transition-transform" />
              Become a Lender
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-agri-dark dark:bg-black/50 text-white py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            {/* Brand Column */}
            <div className="md:col-span-1">
              <div className="flex items-center space-x-2.5 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-agri-forest to-agri-leaf rounded-xl flex items-center justify-center shadow-md">
                  <span className="text-white text-lg">🌾</span>
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-agri-mint to-agri-light bg-clip-text text-transparent">
                  AgriFinance
                </span>
              </div>
              <p className="text-agri-light/50 text-sm leading-relaxed">
                Transforming Agriculture Through Blockchain Technology & DeFi Innovation
              </p>
            </div>

            {/* Platform Links */}
            <div>
              <h4 className="text-sm font-semibold text-agri-mint mb-4 uppercase tracking-wider">Platform</h4>
              <div className="space-y-2.5">
                <Link to="/farmer" className="block text-agri-light/50 hover:text-agri-leaf transition-colors text-sm">Farmer Dashboard</Link>
                <Link to="/lender" className="block text-agri-light/50 hover:text-agri-leaf transition-colors text-sm">Lender Dashboard</Link>
                <Link to="/buyer" className="block text-agri-light/50 hover:text-agri-leaf transition-colors text-sm">Buyer Dashboard</Link>
                <Link to="/services" className="block text-agri-light/50 hover:text-agri-leaf transition-colors text-sm">Services</Link>
              </div>
            </div>

            {/* Features Links */}
            <div>
              <h4 className="text-sm font-semibold text-agri-mint mb-4 uppercase tracking-wider">Features</h4>
              <div className="space-y-2.5">
                <Link to="/supply-chain" className="block text-agri-light/50 hover:text-agri-leaf transition-colors text-sm">Supply Chain</Link>
                <Link to="/nft-marketplace" className="block text-agri-light/50 hover:text-agri-leaf transition-colors text-sm">NFT Marketplace</Link>
                <Link to="/marketplace" className="block text-agri-light/50 hover:text-agri-leaf transition-colors text-sm">Marketplace</Link>
                <Link to="/dao" className="block text-agri-light/50 hover:text-agri-leaf transition-colors text-sm">DAO Governance</Link>
              </div>
            </div>

            {/* Resources Links */}
            <div>
              <h4 className="text-sm font-semibold text-agri-mint mb-4 uppercase tracking-wider">Resources</h4>
              <div className="space-y-2.5">
                <Link to="/docs" className="block text-agri-light/50 hover:text-agri-leaf transition-colors text-sm">Documentation</Link>
                <Link to="/smart-tools" className="block text-agri-light/50 hover:text-agri-leaf transition-colors text-sm">Smart Tools</Link>
                <Link to="/credit-scoring" className="block text-agri-light/50 hover:text-agri-leaf transition-colors text-sm">Credit Scoring</Link>
                <Link to="/track-product" className="block text-agri-light/50 hover:text-agri-leaf transition-colors text-sm">Track Products</Link>
              </div>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="border-t border-agri-forest/30 pt-8 flex flex-col sm:flex-row justify-between items-center">
            <p className="text-agri-light/40 text-xs mb-4 sm:mb-0">
              © 2024 AgriFinance. Built on blockchain for a sustainable future.
            </p>
            <div className="flex items-center space-x-4">
              <span className="text-agri-light/40 text-xs">Powered by</span>
              <span className="text-agri-leaf text-xs font-semibold">Ethereum</span>
              <span className="text-agri-light/20">•</span>
              <span className="text-agri-leaf text-xs font-semibold">DeFi</span>
              <span className="text-agri-light/20">•</span>
              <span className="text-agri-leaf text-xs font-semibold">AI</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;