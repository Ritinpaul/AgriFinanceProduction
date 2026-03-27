import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  MdDashboard,
  MdAgriculture,
  MdAccountBalance,
  MdShoppingCart
} from 'react-icons/md';

const ChevronDownIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const ServicesDropdown = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const isActive = (path) => location.pathname === path;

  const isServicesActive = () =>
    ['/services', '/farmer', '/lender', '/buyer'].includes(location.pathname);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const handleServiceClick = (path, requiresAuth = false) => {
    if (requiresAuth && !user) {
      navigate('/signin');
      return;
    }
    navigate(path);
    setIsOpen(false);
  };

  const services = [
    {
      name: 'Services Overview',
      path: '/services',
      description: 'Explore all our service offerings',
      icon: <MdDashboard className="text-green-600 text-2xl" />,
      requiresAuth: false,
    },
    {
      name: 'Farmer',
      path: '/farmer',
      description: 'Manage your farm, apply for loans, and track crops',
      icon: <MdAgriculture className="text-green-500 text-2xl" />,
      requiresAuth: true,
    },
    {
      name: 'Lender',
      path: '/lender',
      description: 'Provide loans to farmers and manage your portfolio',
      icon: <MdAccountBalance className="text-blue-500 text-2xl" />,
      requiresAuth: true,
    },
    {
      name: 'Buyer',
      path: '/buyer',
      description: 'Purchase verified products and track supply chain',
      icon: <MdShoppingCart className="text-purple-500 text-2xl" />,
      requiresAuth: true,
    },
  ];

  return (
    <div className="relative shrink-0 z-50" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`nav-link flex items-center space-x-1 px-3 py-2 rounded-xl transition-all duration-200 ${isServicesActive()
            ? 'bg-agri-leaf/15 dark:bg-agri-leaf/10 text-agri-forest dark:text-agri-leaf font-semibold'
            : 'hover:bg-agri-leaf/8 dark:hover:bg-agri-leaf/5 text-gray-600 dark:text-gray-300'
          }`}
      >
        <span className="text-xs font-medium">Services</span>
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
          <div className="bg-gradient-to-r from-green-600 to-green-700 dark:from-green-700 dark:to-green-800 p-4 text-white">
            <h3 className="text-sm font-bold mb-1">Our Services</h3>
            <p className="text-xs text-green-50 dark:text-green-100">
              Choose a service to get started
            </p>
          </div>

          {/* Services List */}
          <div className="p-2">
            {services.map((service) => {
              const active = isActive(service.path);
              const canAccess = !service.requiresAuth || user;

              return (
                <button
                  key={service.path}
                  onClick={() =>
                    handleServiceClick(service.path, service.requiresAuth)
                  }
                  disabled={service.requiresAuth && !user}
                  className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 mb-1 group ${active
                      ? 'bg-agri-leaf/15 dark:bg-agri-leaf/10 border-l-4 border-agri-leaf dark:border-agri-leaf'
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
                      {service.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-sm font-semibold ${active
                              ? 'text-green-700 dark:text-green-300'
                              : 'text-gray-900 dark:text-gray-100'
                            }`}
                        >
                          {service.name}
                        </span>
                        {service.requiresAuth && !user && (
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
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-gray-600 dark:text-gray-400'
                          }`}
                      >
                        {service.description}
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
                Sign in to access all services
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

export default ServicesDropdown;
