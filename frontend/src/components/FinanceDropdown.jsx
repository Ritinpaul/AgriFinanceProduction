import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  MdAccountBalance,
  MdAttachMoney,
  MdDescription,
  MdGroups,
  MdAssessment,
  MdTrendingUp,
  MdHistory
} from 'react-icons/md';

const ChevronDownIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const FinanceDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isActive = (path) => {
    return location.pathname === path;
  };

  const isFinanceActive = () => {
    return [
      '/liquidity',
      '/loans',
      '/loan-requests',
      '/committee',
      '/credit-scoring',
      '/staking',
      '/transactions'
    ].includes(location.pathname);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const handleItemClick = (path, requiresAuth = false, requiredRoles = null) => {
    if (requiresAuth && !user) {
      navigate('/signin');
      return;
    }

    if (requiredRoles && user && !requiredRoles.includes(user.role) && user.role !== 'admin') {
      return;
    }

    navigate(path);
    setIsOpen(false);
  };

  const canAccessItem = (item) => {
    if (!item.requiresAuth) return true;
    if (!user) return false;
    if (!item.roles) return true;
    return item.roles.includes(user.role) || user.role === 'admin';
  };

  const financeItems = [
    {
      name: 'Liquidity Pool',
      path: '/liquidity',
      description: 'Provide liquidity and earn returns',
      icon: <MdAccountBalance className="text-blue-500 text-2xl" />,
      requiresAuth: true,
      roles: ['farmer', 'lender', 'admin'],
    },
    {
      name: 'Loans',
      path: '/loans',
      description: 'Create and manage loans',
      icon: <MdAttachMoney className="text-green-500 text-2xl" />,
      requiresAuth: true,
      roles: ['farmer', 'lender', 'buyer', 'admin'],
    },
    {
      name: 'Loan Requests',
      path: '/loan-requests',
      description: 'Submit and track loan applications',
      icon: <MdDescription className="text-purple-500 text-2xl" />,
      requiresAuth: true,
      roles: ['farmer', 'admin'],
    },
    {
      name: 'Committee',
      path: '/committee',
      description: 'Stake and vote on loan approvals',
      icon: <MdGroups className="text-orange-500 text-2xl" />,
      requiresAuth: true,
      roles: ['lender', 'admin'],
    },
    {
      name: 'Credit Scoring',
      path: '/credit-scoring',
      description: 'View and improve your credit score',
      icon: <MdAssessment className="text-indigo-500 text-2xl" />,
      requiresAuth: true,
      roles: ['farmer', 'lender', 'buyer', 'admin'],
    },
    {
      name: 'Staking',
      path: '/staking',
      description: 'Stake tokens and earn rewards',
      icon: <MdTrendingUp className="text-teal-500 text-2xl" />,
      requiresAuth: true,
      roles: ['farmer', 'lender', 'buyer', 'admin'],
    },
    {
      name: 'Transaction History',
      path: '/transactions',
      description: 'View your complete transaction history',
      icon: <MdHistory className="text-gray-600 dark:text-gray-400 text-2xl" />,
      requiresAuth: true,
      roles: ['farmer', 'lender', 'buyer', 'admin'],
    }
  ];

  return (
    <div className="relative shrink-0 z-50" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`nav-link flex items-center space-x-1 px-3 py-2 rounded-lg transition-all duration-200 ${isFinanceActive()
            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 font-semibold'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
      >
        <span className="text-sm font-medium">Finance</span>
        <ChevronDownIcon
          className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''
            }`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden max-h-[600px] overflow-y-auto"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 to-blue-600 dark:from-green-700 dark:to-blue-700 p-4 text-white sticky top-0 z-10">
            <h3 className="text-sm font-bold mb-1">Finance</h3>
            <p className="text-xs text-white/90">
              Manage your financial activities
            </p>
          </div>

          {/* Items List */}
          <div className="p-2">
            {financeItems.map((item) => {
              const active = isActive(item.path);
              const hasAccess = canAccessItem(item);

              return (
                <button
                  key={item.path}
                  onClick={() => handleItemClick(item.path, item.requiresAuth, item.roles)}
                  disabled={item.requiresAuth && !hasAccess}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 mb-1 group ${active
                      ? 'bg-green-50 dark:bg-green-900/20 border-l-4 border-green-600 dark:border-green-400'
                      : hasAccess
                        ? 'hover:bg-gray-50 dark:hover:bg-gray-700'
                        : 'opacity-60 cursor-not-allowed'
                    }`}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`transform group-hover:scale-110 transition-transform ${active ? 'scale-110' : ''
                        }`}
                    >
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm font-semibold ${active
                              ? 'text-green-700 dark:text-green-300'
                              : hasAccess
                                ? 'text-gray-900 dark:text-gray-100'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                        >
                          {item.name}
                        </span>
                        {item.requiresAuth && !user && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            Sign in required
                          </span>
                        )}
                        {item.roles && user && !item.roles.includes(user.role) && user.role !== 'admin' && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            Not available
                          </span>
                        )}
                        {active && (
                          <span className="text-green-600 dark:text-green-400">
                            <svg
                              className="w-4 h-4"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-xs mt-1 ${active
                            ? 'text-green-600 dark:text-green-400'
                            : hasAccess
                              ? 'text-gray-600 dark:text-gray-400'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}
                      >
                        {item.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          {!user && (
            <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900/50 sticky bottom-0">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 text-center">
                Sign in to access all financial features
              </p>
              <div className="flex gap-2">
                <Link
                  to="/signin"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 text-center text-xs font-semibold py-2 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 text-center text-xs font-semibold py-2 px-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FinanceDropdown;
