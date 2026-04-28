import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  MdAccountBalanceWallet
} from 'react-icons/md';

const ChevronDownIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const DigitalAssetsDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isActive = (path) => {
    return location.pathname === path;
  };

  const isDigitalAssetsActive = () => {
    return ['/hybrid-wallet', '/wallet', '/token-faucet'].includes(location.pathname);
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

  const handleItemClick = (path, requiresAuth = false) => {
    if (requiresAuth && !user) {
      navigate('/signin');
      return;
    }
    navigate(path);
    setIsOpen(false);
  };

  const digitalAssets = [
    {
      name: 'Hybrid Wallet',
      path: '/hybrid-wallet',
      description: 'Manage your mobile and blockchain wallets',
      icon: <MdAccountBalanceWallet className="text-blue-500 text-2xl" />,
      requiresAuth: true,
    },
    {
      name: 'Token Faucet',
      path: '/token-faucet',
      description: 'Get 2 free KRSI tokens every 24 hours',
      icon: <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
      requiresAuth: true,
    }
  ];

  return (
    <div className="relative shrink-0 z-50" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`nav-link flex items-center space-x-1 px-3 py-2 rounded-xl transition-all duration-200 ${isDigitalAssetsActive()
          ? 'bg-agri-leaf/15 dark:bg-agri-leaf/10 text-agri-forest dark:text-agri-leaf font-semibold'
          : 'hover:bg-agri-leaf/8 dark:hover:bg-agri-leaf/5 text-gray-600 dark:text-gray-300'
          }`}
      >
        <span className="text-xs font-medium">Digital Assets</span>
        <ChevronDownIcon
          className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''
            }`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 w-80 rounded-2xl shadow-2xl z-50 overflow-hidden animate-scale-in bg-white dark:bg-[#1a2e23] border border-gray-200 dark:border-agri-leaf/15"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-agri-forest to-agri-leaf dark:from-agri-deep dark:to-agri-forest p-4 text-white">
            <h3 className="text-sm font-bold mb-1">Digital Assets</h3>
            <p className="text-xs text-white/90">
              Manage your wallets and digital assets
            </p>
          </div>

          {/* Items List */}
          <div className="p-2">
            {digitalAssets
              .filter(item => !item.roles || !user || item.roles.includes(user.role))
              .map((item) => {
                const active = isActive(item.path);
                const canAccess = !item.requiresAuth || user;

                return (
                  <button
                    key={item.path}
                    onClick={() => handleItemClick(item.path, item.requiresAuth)}
                    disabled={item.requiresAuth && !user}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 mb-1 group ${active
                      ? 'bg-agri-leaf/15 dark:bg-agri-leaf/10 border-l-4 border-agri-leaf'
                      : canAccess
                        ? 'hover:bg-agri-leaf/8 dark:hover:bg-agri-leaf/5'
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
                              ? 'text-agri-forest dark:text-agri-leaf'
                              : canAccess
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
                          {active && (
                            <span className="text-agri-leaf dark:text-agri-leaf">
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
                            ? 'text-agri-forest dark:text-agri-leaf'
                            : canAccess
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
            <div className="border-t border-agri-leaf/10 dark:border-agri-leaf/5 p-3 bg-agri-leaf/5 dark:bg-agri-dark/50">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 text-center">
                Sign in to access wallet features
              </p>
              <div className="flex gap-2">
                <Link
                  to="/signin"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 text-center text-xs font-semibold py-2 px-3 bg-gradient-to-r from-agri-forest to-agri-green hover:from-agri-deep hover:to-agri-forest text-white rounded-xl transition-all duration-200"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 text-center text-xs font-semibold py-2 px-3 bg-agri-leaf/15 dark:bg-agri-leaf/10 hover:bg-agri-leaf/25 text-agri-forest dark:text-agri-leaf rounded-xl transition-all duration-200"
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

export default DigitalAssetsDropdown;
