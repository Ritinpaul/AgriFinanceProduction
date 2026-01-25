import React from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const Services = () => {
  const { isDark } = useTheme();
  const { user } = useAuth();

  const services = [
    {
      id: 'farmer',
      title: 'Farmer Services',
      description: 'Access zero-collateral loans, track your crops, manage your inventory, and connect with buyers through our blockchain-powered platform.',
      icon: '🌾',
      features: [
        {
          icon: '💰',
          text: 'Apply for agricultural loans',
          description: 'Get approved quickly with AI-based credit scoring'
        },
        {
          icon: '📊',
          text: 'Track crop production',
          description: 'Monitor your farm inventory and harvests in real-time'
        },
        {
          icon: '🏪',
          text: 'Manage farm inventory',
          description: 'Keep track of supplies and resources efficiently'
        },
        {
          icon: '📚',
          text: 'Access farming resources',
          description: 'Educational content and best practices for modern farming'
        },
        {
          icon: '🤝',
          text: 'Connect with buyers',
          description: 'Direct marketplace access to verified agricultural buyers'
        },
        {
          icon: '🌱',
          text: 'Monitor soil health',
          description: 'AI-powered insights for optimal crop yields'
        }
      ],
      link: '/farmer',
      color: 'green',
      gradient: 'from-green-500 via-green-600 to-green-700',
      bgGradient: 'from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20'
    },
    {
      id: 'lender',
      title: 'Lender Services',
      description: 'Provide financial support to farmers, manage your loan portfolio, earn competitive returns, and make a positive impact on agricultural development.',
      icon: '💵',
      features: [
        {
          icon: '📋',
          text: 'Review loan applications',
          description: 'Streamlined process with AI-powered risk assessment'
        },
        {
          icon: '📈',
          text: 'Manage loan portfolio',
          description: 'Track all your investments in one dashboard'
        },
        {
          icon: '📅',
          text: 'Track repayment schedules',
          description: 'Automated reminders and payment tracking'
        },
        {
          icon: '🔍',
          text: 'Assess farmer creditworthiness',
          description: 'Advanced credit scoring with blockchain verification'
        },
        {
          icon: '📊',
          text: 'Monitor agricultural markets',
          description: 'Real-time market insights and trends'
        },
        {
          icon: '📑',
          text: 'Generate investment reports',
          description: 'Detailed analytics and performance metrics'
        }
      ],
      link: '/lender',
      color: 'blue',
      gradient: 'from-blue-500 via-blue-600 to-blue-700',
      bgGradient: 'from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20'
    },
    {
      id: 'buyer',
      title: 'Buyer Services',
      description: 'Purchase verified agricultural products, track the complete supply chain, ensure product quality and authenticity, and access market analytics.',
      icon: '🛒',
      features: [
        {
          icon: '🛍️',
          text: 'Browse verified products',
          description: 'NFT-verified agricultural goods with blockchain authenticity'
        },
        {
          icon: '🔗',
          text: 'Track supply chain',
          description: 'End-to-end visibility from farm to your facility'
        },
        {
          icon: '✅',
          text: 'Verify product authenticity',
          description: 'Blockchain verification ensures genuine products'
        },
        {
          icon: '📦',
          text: 'Place bulk orders',
          description: 'Streamlined ordering process for large quantities'
        },
        {
          icon: '🔬',
          text: 'Monitor product quality',
          description: 'Real-time quality metrics and certification status'
        },
        {
          icon: '📊',
          text: 'Access market analytics',
          description: 'Comprehensive data for informed purchasing decisions'
        }
      ],
      link: '/buyer',
      color: 'purple',
      gradient: 'from-purple-500 via-purple-600 to-purple-700',
      bgGradient: 'from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20'
    }
  ];

  const benefits = [
    {
      icon: '🔐',
      title: 'Blockchain Verified',
      description: 'All transactions and products are verified on-chain for maximum transparency and security',
      color: 'green'
    },
    {
      icon: '⚡',
      title: 'Fast & Secure',
      description: 'Quick loan processing and secure payment systems powered by smart contracts',
      color: 'blue'
    },
    {
      icon: '🌍',
      title: 'Community Driven',
      description: 'Built by and for the agricultural community with sustainable farming practices',
      color: 'purple'
    },
    {
      icon: '🤖',
      title: 'AI-Powered',
      description: 'Advanced credit scoring and predictive analytics for better decision making',
      color: 'orange'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-green-600 via-green-700 to-green-600 dark:from-green-800 dark:via-green-900 dark:to-green-800 text-white">
        <div className="container mx-auto px-4 py-12 sm:py-16">
          <div className="text-center max-w-4xl mx-auto">
            <div className="text-4xl sm:text-5xl mb-4">🌾</div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">
              Our Services
            </h1>
            <p className="text-lg sm:text-xl text-green-50 dark:text-green-100 mb-3">
              Comprehensive solutions for farmers, lenders, and buyers
            </p>
            <p className="text-base sm:text-lg text-green-100 dark:text-green-200">
              Powered by blockchain technology, AI credit scoring, and transparent supply chains
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 sm:py-16">
        {/* Services Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {services.map((service) => (
            <div
              key={service.id}
              className={`bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group border border-gray-200 dark:border-gray-700 ${service.bgGradient}`}
            >
              {/* Service Header */}
              <div className={`bg-gradient-to-r ${service.gradient} p-8 text-white relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
                <div className="relative z-10">
                  <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform duration-300">
                    {service.icon}
                  </div>
                  <h3 className="text-2xl font-bold mb-3">{service.title}</h3>
                  <p className="text-white/90 leading-relaxed">{service.description}</p>
                </div>
              </div>

              {/* Features List */}
              <div className="p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
                  <span className="mr-2">✨</span>
                  Key Features
                </h4>
                <ul className="space-y-4 mb-6">
                  {service.features.map((feature, index) => (
                    <li key={index} className="flex items-start group/item">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-600 flex items-center justify-center mr-3 group-hover/item:scale-110 transition-transform">
                        <span className="text-lg">{feature.icon}</span>
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
                  ))}
                </ul>

                {/* Action Button */}
                {user ? (
                  <Link
                    to={service.link}
                    className={`w-full bg-gradient-to-r ${service.gradient} text-white font-semibold py-3 px-6 rounded-lg hover:shadow-lg transition-all duration-200 transform group-hover:scale-105 text-center block flex items-center justify-center space-x-2`}
                  >
                    <span>Access {service.title}</span>
                    <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                  </Link>
                ) : (
                  <div className="space-y-2">
                    <Link
                      to="/signin"
                      className={`w-full bg-gradient-to-r ${service.gradient} text-white font-semibold py-3 px-6 rounded-lg hover:shadow-lg transition-all duration-200 transform group-hover:scale-105 text-center block flex items-center justify-center space-x-2`}
                    >
                      <span>Sign In to Access</span>
                      <span className="transform group-hover:translate-x-1 transition-transform">→</span>
                    </Link>
                    <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                      New user? <Link to="/signup" className="text-green-600 dark:text-green-400 hover:underline">Sign up</Link>
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Benefits Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 sm:p-12 mb-12 border border-gray-200 dark:border-gray-700">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Why Choose AgriFinance?
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              We combine cutting-edge technology with agricultural expertise to deliver the best experience for all stakeholders
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => {
              const colorClasses = {
                green: 'from-green-100 to-green-200 dark:from-green-900/30 dark:to-green-800/30',
                blue: 'from-blue-100 to-blue-200 dark:from-blue-900/30 dark:to-blue-800/30',
                purple: 'from-purple-100 to-purple-200 dark:from-purple-900/30 dark:to-purple-800/30',
                orange: 'from-orange-100 to-orange-200 dark:from-orange-900/30 dark:to-orange-800/30'
              };
              
              return (
                <div
                  key={index}
                  className="text-center p-6 rounded-xl bg-gradient-to-br from-gray-50 to-white dark:from-gray-700/50 dark:to-gray-800/50 border border-gray-200 dark:border-gray-600 hover:shadow-lg transition-all duration-300 hover:scale-105"
                >
                  <div className={`w-16 h-16 bg-gradient-to-br ${colorClasses[benefit.color]} rounded-2xl flex items-center justify-center mx-auto mb-4 text-3xl transform hover:rotate-12 transition-transform duration-300`}>
                    {benefit.icon}
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
        <div className="bg-gradient-to-r from-green-600 to-blue-600 dark:from-green-800 dark:to-blue-800 rounded-2xl shadow-xl p-8 sm:p-12 text-center text-white">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-base sm:text-lg text-white/90 mb-6 max-w-2xl mx-auto">
            Join thousands of farmers, lenders, and buyers already using AgriFinance to transform agricultural finance and supply chains.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {!user ? (
              <>
                <Link
                  to="/signup"
                  className="bg-white text-green-600 dark:text-green-700 font-semibold py-3 px-8 rounded-lg hover:bg-gray-100 transition-all duration-200 transform hover:scale-105 shadow-lg"
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
              <Link
                to={user.role === 'farmer' ? '/farmer' : user.role === 'lender' ? '/lender' : user.role === 'buyer' ? '/buyer' : '/'}
                className="bg-white text-green-600 dark:text-green-700 font-semibold py-3 px-8 rounded-lg hover:bg-gray-100 transition-all duration-200 transform hover:scale-105 shadow-lg"
              >
                Go to Dashboard
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Services;
