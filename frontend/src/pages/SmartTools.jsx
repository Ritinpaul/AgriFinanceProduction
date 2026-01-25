import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { HiLightningBolt, HiLockClosed, HiSparkles, HiCheckCircle, HiGlobeAlt, HiChartBar, HiShieldCheck, HiUserGroup, HiDocumentText, HiTicket, HiTrendingUp } from 'react-icons/hi';
import { FiZap, FiLock, FiShield, FiTarget, FiKey, FiSmartphone, FiLink } from 'react-icons/fi';

const SmartTools = () => {
  const { isDark } = useTheme();
  const { user } = useAuth();

  const tools = [
    {
      id: 'zk-verification',
      title: 'ZK Verification',
      description: 'Privacy-preserving verification using zero-knowledge proofs. Verify your identity and credentials without revealing sensitive information.',
      Icon: HiLockClosed,
      features: [
        {
          Icon: FiShield,
          text: 'Privacy First',
          description: 'Prove credentials without revealing data'
        },
        {
          Icon: HiCheckCircle,
          text: 'Instant Verification',
          description: 'Quick verification process'
        },
        {
          Icon: FiLock,
          text: 'Secure Credentials',
          description: 'Your data stays encrypted and private'
        },
        {
          Icon: HiGlobeAlt,
          text: 'Cross-Platform',
          description: 'Works across different networks'
        },
        {
          Icon: HiChartBar,
          text: 'Audit Trail',
          description: 'Cryptographic proof of verification'
        },
        {
          Icon: HiShieldCheck,
          text: 'Decentralized',
          description: 'No central authority required'
        }
      ],
      link: '/zk-verification',
      color: 'green',
      gradient: 'from-green-500 via-green-600 to-green-700',
      bgGradient: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20',
      availableFor: ['farmer', 'lender', 'buyer', 'admin'],
      badge: 'Privacy'
    },
    {
      id: 'dao-governance',
      title: 'DAO Governance',
      description: 'Participate in decentralized governance, create proposals, vote on platform decisions, and shape the future of AgriFinance.',
      Icon: HiTicket,
      features: [
        {
          Icon: HiDocumentText,
          text: 'Create Proposals',
          description: 'Submit governance proposals for platform changes'
        },
        {
          Icon: HiTicket,
          text: 'Vote on Decisions',
          description: 'Participate in community voting'
        },
        {
          Icon: HiChartBar,
          text: 'Track Proposals',
          description: 'Monitor proposal status and outcomes'
        },
        {
          Icon: HiSparkles,
          text: 'Token Weighted',
          description: 'Voting power based on token holdings'
        },
        {
          Icon: HiTrendingUp,
          text: 'Analytics Dashboard',
          description: 'Comprehensive governance metrics'
        },
        {
          Icon: HiUserGroup,
          text: 'Community Driven',
          description: 'Decisions made by the community, for the community'
        }
      ],
      link: '/dao',
      color: 'orange',
      gradient: 'from-orange-500 via-orange-600 to-orange-700',
      bgGradient: 'from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20',
      availableFor: ['farmer', 'lender', 'buyer', 'admin'],
      badge: 'Community'
    }
  ];

  const benefits = [
    {
      Icon: FiZap,
      title: 'Lightning Fast',
      description: 'Optimized for speed with instant transactions and real-time updates',
      color: 'yellow'
    },
    {
      Icon: HiShieldCheck,
      title: 'Enterprise Security',
      description: 'Bank-level security with multi-factor authentication and encryption',
      color: 'red'
    },
    {
      Icon: FiTarget,
      title: 'User Focused',
      description: 'Designed with user experience in mind for maximum usability',
      color: 'blue'
    },
    {
      Icon: HiGlobeAlt,
      title: 'Blockchain Native',
      description: 'Built on cutting-edge blockchain technology for transparency',
      color: 'green'
    }
  ];

  const canAccessTool = (tool) => {
    if (!tool.availableFor) return true;
    if (!user) return false;
    return tool.availableFor.includes(user.role) || user.role === 'admin';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-orange-600 dark:from-blue-800 dark:via-purple-800 dark:to-orange-800 text-white">
        <div className="container mx-auto px-4 py-12 sm:py-16">
          <div className="text-center max-w-4xl mx-auto">
            <div className="flex justify-center mb-4">
              <HiLightningBolt className="text-4xl sm:text-5xl" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">
              Smart Tools
            </h1>
            <p className="text-lg sm:text-xl text-white/90 mb-3">
              Advanced blockchain-powered tools and features
            </p>
            <p className="text-base sm:text-lg text-white/80">
              Harness the power of Web3 technology with our suite of smart tools for enhanced security, privacy, and governance
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 sm:py-16">
        {/* Tools Grid */}
        <div className="grid md:grid-cols-2 gap-8 mb-16 max-w-5xl mx-auto">
          {tools.map((tool) => {
            const hasAccess = canAccessTool(tool);
            const IconComponent = tool.Icon;
            
            return (
              <div
                key={tool.id}
                className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-200 dark:border-gray-700 ${tool.bgGradient} ${
                  !hasAccess ? 'opacity-75' : ''
                }`}
              >
                {/* Tool Header */}
                <div className={`bg-gradient-to-r ${tool.gradient} p-8 text-white relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                  <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="transform group-hover:scale-110 transition-transform duration-300">
                        <IconComponent className="text-5xl" />
                      </div>
                      {tool.badge && (
                        <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold uppercase tracking-wide">
                          {tool.badge}
                        </span>
                      )}
                    </div>
                    <h3 className="text-2xl font-bold mb-3">{tool.title}</h3>
                    <p className="text-white/90 leading-relaxed">{tool.description}</p>
                    {!hasAccess && (
                      <div className="mt-4 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg text-sm">
                        <span className="text-white/90">
                          Available for: {tool.availableFor.filter(r => r !== 'admin').map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Features List */}
                <div className="p-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                    <HiSparkles className="mr-2 text-yellow-500" />
                    Key Features
                  </h4>
                  <ul className="space-y-4 mb-6">
                    {tool.features.map((feature, index) => {
                      const FeatureIcon = feature.Icon;
                      return (
                        <li key={index} className="flex items-start group/item">
                          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center mr-3 group-hover/item:scale-110 transition-transform">
                            <FeatureIcon className="text-lg text-gray-700 dark:text-gray-300" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                              {feature.text}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {feature.description}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Action Button */}
                  {hasAccess ? (
                    <Link
                      to={tool.link}
                      className={`w-full bg-gradient-to-r ${tool.gradient} text-white font-semibold py-3 px-6 rounded-lg hover:shadow-lg transition-all duration-200 transform group-hover:scale-105 text-center block flex items-center justify-center space-x-2`}
                    >
                      <span>Access {tool.title}</span>
                      <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                    </Link>
                  ) : (
                    <div className="space-y-2">
                      <div className={`w-full bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 font-semibold py-3 px-6 rounded-lg text-center cursor-not-allowed`}>
                        Not Available for Your Role
                      </div>
                      {user && (
                        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                          This tool is available for {tool.availableFor.filter(r => r !== 'admin').map(r => r.charAt(0).toUpperCase() + r.slice(1)).join(', ')} users
                        </p>
                      )}
                      {!user && (
                        <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                          <Link to="/signin" className="text-blue-600 dark:text-blue-400 hover:underline">Sign in</Link> to check your access
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Benefits Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 sm:p-12 mb-12 border border-gray-200 dark:border-gray-700">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Why Our Smart Tools?
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Built with cutting-edge technology to provide the best user experience while maintaining the highest security standards
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => {
              const BenefitIcon = benefit.Icon;
              const colorClasses = {
                yellow: 'from-yellow-100 to-yellow-200 dark:from-yellow-900/30 dark:to-yellow-800/30',
                red: 'from-red-100 to-red-200 dark:from-red-900/30 dark:to-red-800/30',
                blue: 'from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30',
                green: 'from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30'
              };
              
              return (
                <div
                  key={index}
                  className="text-center p-6 rounded-xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-800/50 border border-gray-200 dark:border-gray-600 hover:shadow-lg transition-all duration-300 hover:scale-105"
                >
                  <div className={`w-16 h-16 bg-gradient-to-br ${colorClasses[benefit.color]} rounded-2xl flex items-center justify-center mx-auto mb-4 transform hover:rotate-12 transition-transform duration-300`}>
                    <BenefitIcon className="text-3xl text-gray-700 dark:text-gray-300" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-800 dark:to-purple-800 rounded-2xl shadow-xl p-8 sm:p-12 text-center text-white">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Ready to Explore?
          </h2>
          <p className="text-base sm:text-lg text-white/90 mb-6 max-w-2xl mx-auto">
            Unlock the full potential of blockchain technology with our smart tools. Experience the future of DeFi today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {!user ? (
              <>
                <Link
                  to="/signup"
                  className="bg-white text-blue-600 dark:text-blue-700 font-semibold py-3 px-8 rounded-lg hover:bg-gray-100 transition-all duration-200 transform hover:scale-105 shadow-lg"
                >
                  Create Account
                </Link>
                <Link
                  to="/signin"
                  className="bg-white/10 backdrop-blur-sm text-white border-2 border-white/30 font-semibold py-3 px-8 rounded-lg hover:bg-white/20 transition-all duration-200 transform hover:scale-105"
                >
                  Sign In
                </Link>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-white/80 text-sm mb-2">
                  You're logged in as {user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'User'}
                </p>
                <Link
                  to={user.role === 'farmer' ? '/farmer' : user.role === 'lender' ? '/lender' : user.role === 'buyer' ? '/buyer' : '/'}
                  className="inline-block bg-white text-blue-600 dark:text-blue-700 font-semibold py-3 px-8 rounded-lg hover:bg-gray-100 transition-all duration-200 transform hover:scale-105 shadow-lg"
                >
                  Go to Dashboard
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SmartTools;
