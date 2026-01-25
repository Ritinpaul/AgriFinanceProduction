import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  MdLightbulb,
  MdLock,
  MdHowToVote
} from 'react-icons/md';

const ChevronDownIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const SmartToolsDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isActive = (path) => {
    return location.pathname === path;
  };

  const isSmartToolsActive = () => {
    return ['/smart-tools', '/zk-verification', '/dao', '/governance'].includes(location.pathname);
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

  const handleToolClick = (path, requiresAuth = false, requiredRoles = null) => {
    if (requiresAuth && !user) {
      navigate('/signin');
      return;
    }

    if (requiredRoles && user && !requiredRoles.includes(user.role) && user.role !== 'admin') {
      // Show a message or prevent navigation
      return;
    }

    navigate(path);
    setIsOpen(false);
  };

  const canAccessTool = (tool) => {
    if (!tool.requiresAuth) return true;
    if (!user) return false;
    if (!tool.roles) return true;
    return tool.roles.includes(user.role) || user.role === 'admin';
  };

  const tools = [
    {
      name: 'Smart Tools Overview',
      path: '/smart-tools',
      description: 'Explore all our smart tools and features',
      icon: <MdLightbulb className="text-yellow-500 text-2xl" />,
      requiresAuth: false,
      badge: null
    },
    {
      name: 'ZK Verification',
      path: '/zk-verification',
      description: 'Privacy-preserving zero-knowledge proofs',
      icon: <MdLock className="text-green-500 text-2xl" />,
      requiresAuth: true,
      roles: ['farmer', 'lender', 'buyer', 'admin'],
      badge: 'Privacy',
      color: 'green'
    },
    {
      name: 'DAO Governance',
      path: '/dao',
      description: 'Participate in decentralized governance',
      icon: <MdHowToVote className="text-orange-500 text-2xl" />,
      requiresAuth: true,
      roles: ['farmer', 'lender', 'buyer', 'admin'],
      badge: 'Community',
      color: 'orange'
    }
  ];

  return (
    <div className="relative shrink-0 z-50" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`nav-link flex items-center space-x-1 px-3 py-2 rounded-lg transition-all duration-200 ${isSmartToolsActive()
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-semibold'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
      >
        <span className="text-sm font-medium">Smart Tools</span>
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
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-700 dark:to-purple-700 p-4 text-white">
            <h3 className="text-sm font-bold mb-1">Smart Tools</h3>
            <p className="text-xs text-white/90">
              Advanced blockchain-powered features
            </p>
          </div>

          {/* Tools List */}
          <div className="p-2">
            {tools.map((tool) => {
              const active = isActive(tool.path);
              const hasAccess = canAccessTool(tool);

              return (
                <button
                  key={tool.path}
                  onClick={() => handleToolClick(tool.path, tool.requiresAuth, tool.roles)}
                  disabled={tool.requiresAuth && !hasAccess}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-all duration-200 mb-1 group ${active
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600 dark:border-blue-400'
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
                      {tool.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-semibold ${active
                            ? 'text-blue-700 dark:text-blue-300'
                            : hasAccess
                              ? 'text-gray-900 dark:text-gray-100'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}>
                          {tool.name}
                        </span>
                        <div className="flex items-center gap-2">
                          {tool.requiresAuth && !user && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                              Sign in required
                            </span>
                          )}
                          {tool.badge && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tool.color === 'green' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                                'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300'
                              }`}>
                              {tool.badge}
                            </span>
                          )}
                          {active && (
                            <span className="text-blue-600 dark:text-blue-400">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </div>
                      <p className={`text-xs mt-1 ${active
                          ? 'text-blue-600 dark:text-blue-400'
                          : hasAccess
                            ? 'text-gray-600 dark:text-gray-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                        {tool.description}
                      </p>
                      {tool.requiresAuth && !hasAccess && user && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Not available for {user.role}s
                        </p>
                      )}
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
                Sign in to access all smart tools
              </p>
              <div className="flex gap-2">
                <Link
                  to="/signin"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 text-center text-xs font-semibold py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
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

export default SmartToolsDropdown;
