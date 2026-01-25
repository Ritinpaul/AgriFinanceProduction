/**
 * Error Message Mapping
 * Maps contract revert reasons and errors to user-friendly messages
 */

const ERROR_PATTERNS = {
  // Balance errors
  'insufficient funds': 'You don\'t have enough KRSI tokens for this transaction.',
  'insufficient balance': 'Your balance is too low. Please add more tokens.',
  'ERC20: transfer amount exceeds balance': 'Insufficient balance. You don\'t have enough tokens.',
  
  // Allowance errors
  'insufficient allowance': 'The contract needs permission to spend your tokens. Please approve first.',
  'ERC20: transfer amount exceeds allowance': 'Token approval required. Please approve the contract to spend your tokens.',
  
  // Pool errors
  'insufficient liquidity': 'The liquidity pool doesn\'t have enough funds for this loan.',
  'pool depleted': 'The liquidity pool is empty. Please wait for more deposits.',
  
  // Credit score errors
  'credit score too low': 'Your credit score is below the minimum required (500).',
  'credit score below threshold': 'Your credit score is too low. Improve your score to qualify for loans.',
  
  // Loan errors
  'loan not found': 'This loan doesn\'t exist or has been deleted.',
  'loan already repaid': 'This loan has already been fully repaid.',
  'loan defaulted': 'This loan has been defaulted and cannot be repaid.',
  'not the borrower': 'You are not the borrower of this loan. Only the borrower can repay.',
  'loan is not active': 'This loan is not active and cannot be repaid.',
  
  // Contract state errors
  'contract is paused': 'The contract is currently paused. Transactions are temporarily disabled.',
  'enforced pause': 'The contract is paused. Please try again later.',
  
  // Gas errors
  'insufficient funds for gas': 'You don\'t have enough ETH to pay for gas fees. Please add Sepolia ETH to your wallet.',
  'gas estimation failed': 'Could not estimate gas. The transaction may fail.',
  
  // Reentrancy errors
  'reentrant call': 'Transaction failed due to reentrancy protection. Please try again.',
  
  // Generic errors
  'user rejected': 'Transaction was rejected. Please try again if you want to proceed.',
  'user denied': 'Transaction was denied. Please approve the transaction to continue.',
  'transaction failed': 'Transaction failed. Please check your balance and try again.',
};

/**
 * Map error message to user-friendly version
 * @param {Error|string} error - Error object or message string
 * @returns {string} User-friendly error message
 */
export function getUserFriendlyError(error) {
  if (!error) {
    return 'An unknown error occurred. Please try again.';
  }

  const errorMessage = typeof error === 'string' 
    ? error 
    : error.message || error.reason || String(error);

  // Convert to lowercase for pattern matching
  const lowerMessage = errorMessage.toLowerCase();

  // Check for specific patterns
  for (const [pattern, friendlyMessage] of Object.entries(ERROR_PATTERNS)) {
    if (lowerMessage.includes(pattern.toLowerCase())) {
      return friendlyMessage;
    }
  }

  // Check for common contract error formats
  if (lowerMessage.includes('revert')) {
    // Extract revert reason if available
    const revertMatch = errorMessage.match(/revert\s+(.+)/i);
    if (revertMatch) {
      const revertReason = revertMatch[1];
      // Try to find a matching pattern for the revert reason
      for (const [pattern, friendlyMessage] of Object.entries(ERROR_PATTERNS)) {
        if (revertReason.toLowerCase().includes(pattern.toLowerCase())) {
          return friendlyMessage;
        }
      }
      // If no match, return the revert reason
      return revertReason;
    }
  }

  // If error contains a hex error code, try to decode it
  if (errorMessage.includes('0x') && errorMessage.length < 100) {
    return 'Transaction failed. Please check your balance and try again.';
  }

  // Return original message if no match found, but clean it up
  return errorMessage.length > 200 
    ? errorMessage.substring(0, 200) + '...'
    : errorMessage;
}

/**
 * Check if error is a user rejection (not a real error)
 * @param {Error|string} error - Error object or message
 * @returns {boolean} True if user rejected the transaction
 */
export function isUserRejection(error) {
  const errorMessage = typeof error === 'string' 
    ? error 
    : error.message || error.reason || String(error);
  
  const lowerMessage = errorMessage.toLowerCase();
  return lowerMessage.includes('user rejected') ||
         lowerMessage.includes('user denied') ||
         lowerMessage.includes('rejected the request') ||
         lowerMessage.includes('denied transaction');
}

/**
 * Get error severity level
 * @param {Error|string} error - Error object or message
 * @returns {'info'|'warning'|'error'} Error severity
 */
export function getErrorSeverity(error) {
  if (isUserRejection(error)) {
    return 'info';
  }

  const errorMessage = typeof error === 'string' 
    ? error 
    : error.message || String(error);
  
  const lowerMessage = errorMessage.toLowerCase();
  
  if (lowerMessage.includes('insufficient') || 
      lowerMessage.includes('too low') ||
      lowerMessage.includes('below threshold')) {
    return 'warning';
  }
  
  return 'error';
}

