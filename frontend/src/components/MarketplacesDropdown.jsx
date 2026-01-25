import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  MdImage,
  MdStore
} from 'react-icons/md';

const ChevronDownIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const MarketplacesDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isActive = (path) => {
    return location.pathname === path;
  };

  const isMarketplacesActive = () => {
    return ['/marketplace', '/nft-marketplace'].includes(location.pathname);
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

  const marketplaceItems = [
    {
      name: 'NFT Marketplace',
      path: '/nft-marketplace',
      description: 'Trade agricultural NFTs and digital assets',
      icon: <MdImage className="text-purple-500 text-2xl" />,
      requiresAuth: false,
    },
    {
      name: 'Product Marketplace',
      path: '/marketplace',
      description: 'Buy and sell verified agricultural products',
      icon: <MdStore className="text-teal-500 text-2xl" />,
      requiresAuth: false,
    }
  ];

  return (
    <div className="relative shrink-0 z-50" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`nav-link flex items-center space-x-1 px-3 py-2 rounded-lg transition-all duration-200 ${isMarketplacesActive()
            ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 font-semibold'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
      >
        <span className="text-sm font-medium">Marketplaces</span>
        <ChevronDownIcon
          className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''
            }`}
        />
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-teal-600 dark:from-purple-700 dark:to-teal-700 p-4 text-white">
            <h3 className="text-sm font-bold mb-1">Marketplaces</h3>
            <p className="text-xs text-white/90">
              All marketplace and trading platforms
            </p>
          </div>

          {/* Items List */}
          <div className="p-2">
            {marketplaceItems.map((item) => {
              const active = isActive(item.path);
              const canAccess = !item.requiresAuth || user;

              return (
                <button
                  key={item.path}
                  onClick={() => handleItemClick(item.path, item.requiresAuth)}
                  disabled={item.requiresAuth && !user}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 mb-1 group ${active
                      ? 'bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-600 dark:border-purple-400'
                      : canAccess
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
                              ? 'text-purple-700 dark:text-purple-300'
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
                          <span className="text-purple-600 dark:text-purple-400">
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
                            ? 'text-purple-600 dark:text-purple-400'
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
            <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-900/50">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 text-center">
                Sign in for enhanced marketplace features
              </p>
              <div className="flex gap-2">
                <Link
                  to="/signin"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 text-center text-xs font-semibold py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
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

export default MarketplacesDropdown;
