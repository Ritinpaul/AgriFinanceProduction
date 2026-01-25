import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const GuidedTour = ({ isOpen, onClose }) => {
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const tourSteps = [
    {
      id: 'home',
      title: 'Welcome to AgriFinance! 🌾',
      content: 'This blockchain-powered platform connects farmers, lenders, and buyers in a transparent agricultural ecosystem.',
      position: 'center',
      route: '/'
    },
    {
      id: 'farmer-dashboard',
      title: 'Farmer Dashboard 👨‍🌾',
      content: 'Farmers can manage their crops, create batches, request loans, and track their agricultural assets.',
      position: 'top',
      route: '/farmer'
    },
    {
      id: 'lender-dashboard',
      title: 'Lender Dashboard 💰',
      content: 'Lenders can view available loans, assess risk scores, calculate APY, and fund agricultural projects.',
      position: 'top',
      route: '/lender'
    },
    {
      id: 'buyer-dashboard',
      title: 'Buyer Dashboard 🛒',
      content: 'Buyers can browse verified products, view supply chain traceability, and make purchases.',
      position: 'top',
      route: '/buyer'
    },
    {
      id: 'supply-chain',
      title: 'Supply Chain Tracking 📦',
      content: 'Track products from farm to table with complete transparency and blockchain verification.',
      position: 'top',
      route: '/supply-chain'
    },
    {
      id: 'nft-marketplace',
      title: 'NFT Marketplace 🎨',
      content: 'Trade agricultural land NFTs and digital certificates representing real-world assets.',
      position: 'top',
      route: '/nft-marketplace'
    },
    {
      id: 'product-verification',
      title: 'Product Verification ✅',
      content: 'Scan QR codes to verify product authenticity and view complete supply chain journey.',
      position: 'top',
      route: '/verify-product'
    },
    {
      id: 'token-faucet',
      title: 'Token Faucet 💧',
      content: 'Get test tokens for interacting with smart contracts and testing the platform.',
      position: 'top',
      route: '/token-faucet'
    }
  ];

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setCurrentStep(0);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isVisible && tourSteps[currentStep]) {
      const targetRoute = tourSteps[currentStep].route;
      if (location.pathname !== targetRoute) {
        // Navigate to the target route
        window.history.pushState({}, '', targetRoute);
      }
    }
  }, [currentStep, isVisible, location.pathname]);

  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const skipTour = () => {
    onClose();
  };

  if (!isVisible || !isOpen) return null;

  const currentTourStep = tourSteps[currentStep];

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 relative">
        {/* Close button */}
        <button
          onClick={skipTour}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Tour content */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-4">{currentTourStep.title.split(' ')[0]}</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            {currentTourStep.title.substring(currentTourStep.title.indexOf(' ') + 1)}
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {currentTourStep.content}
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex justify-center mb-6">
          <div className="flex space-x-2">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full ${
                  index === currentStep ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between">
          <button
            onClick={prevStep}
            disabled={currentStep === 0}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <div className="flex space-x-2">
            <button
              onClick={skipTour}
              className="px-4 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Skip Tour
            </button>
            <button
              onClick={nextStep}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
            >
              {currentStep === tourSteps.length - 1 ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>

        {/* Step counter */}
        <div className="text-center mt-4 text-sm text-gray-500 dark:text-gray-400">
          Step {currentStep + 1} of {tourSteps.length}
        </div>
      </div>
    </div>
  );
};

export default GuidedTour;
