import React, { createContext, useContext, useState, useEffect } from 'react';
import aaService from '../services/accountAbstractionService';

const AccountAbstractionContext = createContext();

export const useAccountAbstraction = () => {
  const context = useContext(AccountAbstractionContext);
  if (!context) {
    throw new Error('useAccountAbstraction must be used within an AccountAbstractionProvider');
  }
  return context;
};

export const AccountAbstractionProvider = ({ children }) => {
  const [smartAccount, setSmartAccount] = useState(null);
  const [smartAccountAddress, setSmartAccountAddress] = useState(null);
  const [isDeployed, setIsDeployed] = useState(false);
  const [balance, setBalance] = useState('0');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sessionKey, setSessionKey] = useState(null);
  const [recoveryInfo, setRecoveryInfo] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [walletChoice, setWalletChoice] = useState(null); // 'inapp' or 'metamask'

  // Initialize AA service on mount
  useEffect(() => {
    const initializeAA = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Check if MetaMask is available before initializing
        if (typeof window.ethereum === 'undefined') {
          console.warn('MetaMask not found - Account Abstraction features will be limited');
          setError('MetaMask not available - Some features may be limited');
          return;
        }
        
        await aaService.initialize();
        
        // Load recovery info if exists
        const recovery = aaService.getRecoveryInfo();
        if (recovery) {
          setRecoveryInfo(recovery);
        }
        
        // Load saved wallet choice if exists
        const savedChoice = localStorage.getItem('wallet_choice');
        if (savedChoice) {
          setWalletChoice(savedChoice);
        }
        
      } catch (err) {
        console.warn('Failed to initialize AA service:', err.message);
        // Don't set error for MetaMask not found - just log it
        if (!err.message.includes('MetaMask not found')) {
          setError(err.message);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeAA();
  }, []);

  // Set user role and determine wallet policy
  const setUserRoleAndPolicy = (role) => {
    setUserRole(role);
    
    const policy = aaService.getWalletPolicy(role);
    
    // Auto-set wallet choice based on role policy
    if (policy.requiredWallet) {
      setWalletChoice(policy.requiredWallet);
      localStorage.setItem('wallet_choice', policy.requiredWallet);
    }
    
    return policy;
  };

  // Set wallet choice (for buyers who can choose)
  const setWalletChoiceForUser = (choice) => {
    if (!aaService.canChooseWalletType(userRole)) {
      throw new Error('This user role cannot choose wallet type');
    }
    
    const policy = aaService.getWalletPolicy(userRole);
    if (!policy.allowedWallets.includes(choice)) {
      throw new Error(`Wallet type ${choice} not allowed for role ${userRole}`);
    }
    
    setWalletChoice(choice);
    localStorage.setItem('wallet_choice', choice);
  };

  // Check if current wallet choice is valid for user role
  const isWalletChoiceValid = () => {
    if (!userRole || !walletChoice) return false;
    
    const policy = aaService.getWalletPolicy(userRole);
    return policy.allowedWallets.includes(walletChoice);
  };

  // Get wallet policy for current user
  const getCurrentWalletPolicy = () => {
    if (!userRole) return null;
    return aaService.getWalletPolicy(userRole);
  };

  // Create smart account (role-aware)
  const createSmartAccount = async (userAddress) => {
    try {
      setIsLoading(true);
      setError(null);

      // Check if user can use in-app wallet
      if (walletChoice === 'inapp' && !aaService.canUseInAppWallet(userRole)) {
        throw new Error('In-app wallet not allowed for this user role');
      }

      // Check if user requires MetaMask
      if (walletChoice === 'metamask' && aaService.requiresMetaMask(userRole)) {
        if (typeof window.ethereum === 'undefined') {
          throw new Error('MetaMask is required for this user role but not found');
        }
      }

      const result = await aaService.getSmartAccount(userAddress);
      
      if (result.success) {
        setSmartAccount(result.smartAccount);
        setSmartAccountAddress(result.smartAccountAddress);
        
        // Check if deployed
        const deployed = await aaService.isSmartAccountDeployed();
        setIsDeployed(deployed);
        
        // Get balance
        await updateBalance();
        
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Failed to create smart account:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Send gasless transaction
  const sendGaslessTransaction = async (transaction) => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await aaService.sendGaslessTransaction(transaction);
      
      if (result.success) {
        // Update balance after transaction
        await updateBalance();
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Failed to send gasless transaction:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Send batch gasless transactions
  const sendBatchTransactions = async (transactions) => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await aaService.sendBatchTransactions(transactions);
      
      if (result.success) {
        // Update balance after transactions
        await updateBalance();
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Failed to send batch gasless transactions:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Update account balance
  const updateBalance = async () => {
    try {
      const result = await aaService.getAccountBalance();
      if (result.success) {
        setBalance(result.balance);
      }
    } catch (err) {
      console.error('Failed to update balance:', err);
    }
  };

  // Create session key
  const createSessionKey = async (permissions = {}) => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await aaService.createSessionKey(permissions);
      
      if (result.success) {
        setSessionKey(result.sessionKey);
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Failed to create session key:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Enable social recovery
  const enableSocialRecovery = async (recoveryEmail, guardianAddresses = []) => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await aaService.enableSocialRecovery(recoveryEmail, guardianAddresses);
      
      if (result.success) {
        setRecoveryInfo(result.recoveryInfo);
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      console.error('Failed to enable social recovery:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Estimate gas for transaction
  const estimateGas = async (transaction) => {
    try {
      const result = await aaService.estimateGas(transaction);
      return result;
    } catch (err) {
      console.error('Failed to estimate gas:', err);
      return { success: false, error: err.message };
    }
  };

  // Check if AA is supported
  const isSupported = () => {
    return aaService.isSupported();
  };

  // Get service status
  const getStatus = () => {
    return aaService.getStatus();
  };

  // Clear error
  const clearError = () => {
    setError(null);
  };

  // Reset smart account
  const resetSmartAccount = () => {
    setSmartAccount(null);
    setSmartAccountAddress(null);
    setIsDeployed(false);
    setBalance('0');
    setSessionKey(null);
    setError(null);
  };

  const value = {
    // State
    smartAccount,
    smartAccountAddress,
    isDeployed,
    balance,
    isLoading,
    error,
    sessionKey,
    recoveryInfo,
    userRole,
    walletChoice,
    
    // Actions
    createSmartAccount,
    sendGaslessTransaction,
    sendBatchTransactions,
    updateBalance,
    createSessionKey,
    enableSocialRecovery,
    estimateGas,
    isSupported,
    getStatus,
    clearError,
    resetSmartAccount,
    
    // Role-aware wallet management
    setUserRoleAndPolicy,
    setWalletChoiceForUser,
    isWalletChoiceValid,
    getCurrentWalletPolicy
  };

  return (
    <AccountAbstractionContext.Provider value={value}>
      {children}
    </AccountAbstractionContext.Provider>
  );
};

export default AccountAbstractionContext;

