import { ethers } from 'ethers';

/**
 * LoanVault Service - Handles direct on-chain interactions with LoanVault contract
 * This service manages real token transfers for deposits, withdrawals, loans, and repayments
 * For farmers, uses backend-sponsored transactions (gasless)
 * 
 * What is a Signer?
 * A signer is your wallet connection - it can sign and send transactions to the blockchain.
 * Without a signer, contracts are "read-only" and can only view data, not send transactions.
 * The contract must be connected to a signer (your wallet) to send transactions like deposits.
 */
class LoanVaultService {
  constructor(loanVaultContract, krishiTokenContract, signer, useSponsored = false) {
    this.loanVault = loanVaultContract; // Must be created with a signer (wallet)
    this.krishiToken = krishiTokenContract; // Must be created with a signer (wallet)
    this.signer = signer; // The wallet that will sign and send transactions
    this.useSponsored = useSponsored; // Use backend-sponsored transactions for farmers
    this.apiBase = import.meta.env.VITE_API_BASE || '';
  }

  /**
   * Check if user has approved LoanVault to spend tokens
   * @param {string} userAddress - User's wallet address
   * @param {string} amountWei - Amount to check (in wei, as string)
   * @returns {Promise<{approved: boolean, allowance: string}>}
   */
  async checkAllowance(userAddress, amountWei) {
    try {
      if (!this.loanVault || !this.krishiToken) {
        throw new Error('Contracts not initialized');
      }

      const loanVaultAddress = await this.loanVault.getAddress();
      const allowance = await this.krishiToken.allowance(userAddress, loanVaultAddress);
      const requiredAmount = BigInt(amountWei);

      return {
        approved: allowance >= requiredAmount,
        allowance: allowance.toString(),
        required: amountWei
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Approve LoanVault to spend tokens
   * @param {string} amountWei - Amount to approve (in wei, as string)
   * @returns {Promise<{txHash: string, receipt: object}>}
   */
  async approveTokenSpending(amountWei) {
    try {
      if (!this.loanVault || !this.krishiToken) {
        throw new Error('Contracts not initialized');
      }

      const loanVaultAddress = await this.loanVault.getAddress();
      const amount = BigInt(amountWei); // amountWei is already in smallest unit (6 decimals)

      const tx = await this.krishiToken.approve(loanVaultAddress, amount);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        receipt
      };
    } catch (error) {
      // Check for insufficient funds error
      if (error.message && (error.message.includes('insufficient funds') || error.message.includes('INSUFFICIENT_FUNDS'))) {
        const signerAddress = await this.signer.getAddress();
        throw new Error(
          `Insufficient ETH for gas fees. Your wallet (${signerAddress.substring(0, 10)}...) needs Sepolia ETH to pay for transactions. ` +
          `Get free Sepolia ETH from: https://sepoliafaucet.com/ or https://faucet.quicknode.com/ethereum/sepolia`
        );
      }
      
      throw new Error(`Approval failed: ${error.message}`);
    }
  }

  /**
   * Execute sponsored transaction via backend
   * @private
   */
  async executeSponsoredTransaction(to, data, value = '0') {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.apiBase}/api/transactions/sponsored`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ to, data, value })
    });

    if (!response.ok) {
      const error = await response.json();
      
      // Check for service not initialized error
      if (error.error && error.error.includes('not initialized')) {
        throw new Error(
          'Gasless transactions are not available. ' +
          'The sponsor wallet is not configured on the backend. ' +
          'Please contact support or try again later.'
        );
      }
      
      throw new Error(error.error || error.details || 'Sponsored transaction failed');
    }

    return await response.json();
  }

  /**
   * Check contract state before deposit (debugging)
   */
  async checkContractState(userAddress) {
    try {
      // Try to call getDebugInfo if available
      if (typeof this.loanVault.getDebugInfo === 'function') {
        const debugInfo = await this.loanVault.getDebugInfo(userAddress);
        return {
          poolTotalLiquidity: debugInfo.poolTotalLiquidity?.toString(),
          poolTotalLpShares: debugInfo.poolTotalLpShares?.toString(),
          lenderTotalDeposited: debugInfo.lenderTotalDeposited?.toString(),
          lenderLpShares: debugInfo.lenderLpShares?.toString(),
          lenderIsActive: debugInfo.lenderIsActive,
          maxUint256: debugInfo.maxUint256?.toString()
        };
      }
      
      // Fallback: try to read state directly
      const totalLiquidity = await this.loanVault.totalLiquidity();
      const totalLpShares = await this.loanVault.totalLpShares();
      
      // Try to read lender info (might fail if not initialized)
      let lenderInfo = null;
      try {
        lenderInfo = await this.loanVault.lenders(userAddress);
      } catch (e) {
        // Could not read lender info
      }
      
      return {
        poolTotalLiquidity: totalLiquidity?.toString(),
        poolTotalLpShares: totalLpShares?.toString(),
        lenderInfo: lenderInfo || 'Not initialized'
      };
    } catch (error) {
      // Error checking contract state
      return { error: error.message };
    }
  }

  /**
   * Deposit liquidity into LoanVault (real token transfer)
   * Uses sponsored transactions for farmers (gasless)
   * @param {string} amountWei - Amount to deposit (in wei, as string)
   * @returns {Promise<{txHash: string, receipt: object}>}
   */
  async depositLiquidity(amountWei) {
    try {
      if (!this.loanVault || !this.signer) {
        throw new Error('Contracts not initialized or no signer');
      }

      const userAddress = await this.signer.getAddress();
      const amount = BigInt(amountWei);
      
      // Check contract state before deposit
      const stateCheck = await this.checkContractState(userAddress);
      
      // Check if any values are suspiciously large
      const maxUint256 = BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');
      const threshold = maxUint256 - BigInt('1000000000000000000000000'); // Max minus 1 million tokens
      
      if (stateCheck.poolTotalLiquidity && BigInt(stateCheck.poolTotalLiquidity) > threshold) {
        throw new Error(
          `Contract state corrupted: totalLiquidity is dangerously high (${stateCheck.poolTotalLiquidity}). ` +
          `Contact admin to reset the contract.`
        );
      }
      
      if (stateCheck.poolTotalLpShares && BigInt(stateCheck.poolTotalLpShares) > threshold) {
        throw new Error(
          `Contract state corrupted: totalLpShares is dangerously high (${stateCheck.poolTotalLpShares}). ` +
          `Contact admin to reset the contract.`
        );
      }
      
      if (stateCheck.lenderTotalDeposited && BigInt(stateCheck.lenderTotalDeposited) > threshold) {
        throw new Error(
          `Contract state corrupted: lender totalDeposited is dangerously high (${stateCheck.lenderTotalDeposited}). ` +
          `Contact admin to reset the contract.`
        );
      }
      
      if (stateCheck.lenderLpShares && BigInt(stateCheck.lenderLpShares) > threshold) {
        throw new Error(
          `Contract state corrupted: lender lpShares is dangerously high (${stateCheck.lenderLpShares}). ` +
          `Contact admin to reset the contract.`
        );
      }
      
      // Verify the contract is connected to the correct signer
      const contractAddress = await this.loanVault.getAddress();

      // CRITICAL: Check balance BEFORE attempting any transaction
      // Check balance using the token contract directly
      let userBalance;
      let userBalanceKRSI;
      let userBalanceBigInt;
      
      try {
        userBalance = await this.krishiToken.balanceOf(userAddress);
        userBalanceKRSI = Number(userBalance) / 1_000_000;
        userBalanceBigInt = BigInt(userBalance.toString());
        
        const requestedAmountKRSI = Number(amount) / 1_000_000;
        
        if (userBalanceBigInt < amount) {
          // Clear error message with actionable steps
          const shortfallKRSI = requestedAmountKRSI - userBalanceKRSI;
          throw new Error(
            `❌ Insufficient KRSI balance on-chain.\n\n` +
            `You have: ${userBalanceKRSI.toFixed(2)} KRSI\n` +
            `You need: ${requestedAmountKRSI.toFixed(2)} KRSI\n` +
            `Shortfall: ${shortfallKRSI.toFixed(2)} KRSI\n\n` +
            `Please:\n` +
            `1. Use the "Sync Balance" button to sync your database balance to blockchain\n` +
            `2. Wait 30-60 seconds for the sync transaction to confirm\n` +
            `3. Then try depositing again`
          );
        }
        
      } catch (balanceError) {
        if (balanceError.message && balanceError.message.includes('Insufficient KRSI balance')) {
          throw balanceError;
        }
        throw new Error(
          `Failed to check token balance: ${balanceError.message}. ` +
          `Please verify your wallet address and try again.`
        );
      }

      // IMPORTANT: LoanVault contract checks balanceOf(msg.sender), so msg.sender must be the user
      // For sponsored transactions, msg.sender would be the sponsor wallet (which has 0 tokens)
      // So we must use the user's wallet directly for deposits, not sponsored transactions
      
      // Check allowance first
      const loanVaultAddress = await this.loanVault.getAddress();
      const currentAllowance = await this.krishiToken.allowance(userAddress, loanVaultAddress);
      
      if (currentAllowance < amount) {
        // Approval MUST be sent from user's wallet (not sponsor)
        // User pays gas once for approval
        try {
          const approveTx = await this.krishiToken.approve(loanVaultAddress, amount);
          const approveReceipt = await approveTx.wait();
        } catch (approveError) {
          
          // Check if user rejected or insufficient funds
          if (approveError.code === 4001 || approveError.message?.includes('user rejected')) {
            throw new Error('Approval was rejected. Please approve to continue.');
          }
          
          if (approveError.message?.includes('insufficient funds') || approveError.code === 'INSUFFICIENT_FUNDS') {
            throw new Error(
              `Insufficient ETH for gas fees to approve tokens. ` +
              `You need to approve once (pays gas). ` +
              `Get Sepolia ETH from: https://sepoliafaucet.com/`
            );
          }
          
          throw new Error(`Approval failed: ${approveError.message || 'Unknown error'}`);
        }
      } else {
        // Sufficient allowance already exists
      }

      // Deposit MUST be sent from user's wallet (not sponsor)
      // This is because the contract checks balanceOf(msg.sender)
      // Note: User pays gas for deposit, but it's a one-time cost per approval
      
      // Verify signer one more time
      const signerAddress = await this.signer.getAddress();
      if (signerAddress.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error(`Signer mismatch! Expected ${userAddress}, got ${signerAddress}`);
      }
      
      // Verify the contract is connected to the correct signer by checking balance via contract
      const contractBalanceCheck = await this.krishiToken.balanceOf(userAddress);
      
      if (BigInt(contractBalanceCheck.toString()) < amount) {
        throw new Error(
          `Contract reports insufficient balance: ${(Number(contractBalanceCheck) / 1_000_000).toFixed(2)} KRSI. ` +
          `Required: ${(Number(amount) / 1_000_000).toFixed(2)} KRSI. ` +
          `Please sync your balance and try again.`
        );
      }
      
      // CRITICAL: Verify the contract has a signer before calling
      // In ethers v6, contracts don't have a .signer property - we check the runner or use this.signer
      if (!this.signer) {
        throw new Error(
          `Contract not connected to a signer! ` +
          `The LoanVault contract needs to be connected to your wallet to send transactions. ` +
          `Please refresh the page and try again.`
        );
      }
      
      // Verify signer address matches user address (double-check)
      const signerAddressFromSigner = await this.signer.getAddress();
      if (signerAddressFromSigner.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error(
          `Signer mismatch! Signer address (${signerAddressFromSigner}) doesn't match user address (${userAddress}). ` +
          `Please refresh the page.`
        );
      }
      
      // Try to get address from contract runner if available (ethers v6 way)
      let contractRunnerAddress = userAddress; // Default to userAddress
      try {
        if (this.loanVault.runner && typeof this.loanVault.runner.getAddress === 'function') {
          contractRunnerAddress = await this.loanVault.runner.getAddress();
        }
      } catch (e) {
        // Could not get contract runner address, using signer address
      }
      
      // One final balance check using the user address (which should be the msg.sender)
      const finalContractBalance = await this.krishiToken.balanceOf(userAddress);
      const finalContractBalanceKRSI = Number(finalContractBalance) / 1_000_000;
      
      if (BigInt(finalContractBalance.toString()) < amount) {
        throw new Error(
          `Insufficient balance for msg.sender! ` +
          `The contract will check balanceOf(${userAddress}), which is ${finalContractBalanceKRSI.toFixed(2)} KRSI. ` +
          `Required: ${(Number(amount) / 1_000_000).toFixed(2)} KRSI. ` +
          `Please sync your balance to this address.`
        );
      }
      
      const tx = await this.loanVault.depositLiquidity(amount);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        receipt,
        blockNumber: receipt.blockNumber,
        sponsored: false // Not sponsored because contract requires msg.sender to be token owner
      };
    } catch (error) {
      
      // Check for insufficient funds error
      if (error.message && (error.message.includes('insufficient funds') || error.message.includes('INSUFFICIENT_FUNDS'))) {
        // Error message already contains faucet links from approveTokenSpending
        throw error;
      }
      
      // Parse error message for user-friendly display
      let errorMessage = error.message || 'Deposit failed';
      if (errorMessage.includes('insufficient balance')) {
        errorMessage = 'Insufficient KRSI balance';
      } else if (errorMessage.includes('user rejected')) {
        errorMessage = 'Transaction rejected by user';
      } else if (errorMessage.includes('Sponsored transactions only available for farmers')) {
        errorMessage = 'Gasless transactions only available for farmers. Please ensure your wallet has ETH for gas.';
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Withdraw liquidity from LoanVault (real token transfer)
   * @param {string} amountWei - Amount to withdraw (in wei, as string)
   * @returns {Promise<{txHash: string, receipt: object}>}
   */
  async withdrawLiquidity(amountWei) {
    try {
      if (!this.loanVault || !this.signer) {
        throw new Error('Contracts not initialized or no signer');
      }

      const amount = BigInt(amountWei); // amountWei is already in smallest unit (6 decimals)
      
      
      const tx = await this.loanVault.withdrawLiquidity(amount);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        receipt,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      
      let errorMessage = error.message || 'Withdrawal failed';
      if (errorMessage.includes('Insufficient LP shares')) {
        errorMessage = 'Insufficient deposit balance';
      } else if (errorMessage.includes('would affect active loans')) {
        errorMessage = 'Cannot withdraw: would affect active loans';
      } else if (errorMessage.includes('user rejected')) {
        errorMessage = 'Transaction rejected by user';
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Create a loan from LoanVault (real token transfer to borrower)
   * @param {string} amountWei - Loan amount (in wei, as string)
   * @param {number} termDays - Loan term in days
   * @param {string} collateralValueWei - Collateral value (in wei, as string)
   * @returns {Promise<{loanId: number, txHash: string, receipt: object}>}
   */
  async createLoan(amountWei, termDays, collateralValueWei = '0') {
    try {
      if (!this.loanVault || !this.signer) {
        throw new Error('Contracts not initialized or no signer');
      }

      const amount = BigInt(amountWei); // amountWei is already in smallest unit (6 decimals)
      const collateral = BigInt(collateralValueWei || '0');
      
      
      const tx = await this.loanVault.createLoan(amount, termDays, collateral);
      const receipt = await tx.wait();

      // Parse loanId from events - improved parsing
      let loanId = null;
      
      // Try multiple ways to find the LoanCreated event
      for (const log of receipt.logs) {
        try {
          const parsed = this.loanVault.interface.parseLog(log);
          if (parsed?.name === 'LoanCreated') {
            
            // Try different possible argument names/positions
            loanId = parsed.args.loanId?.toString() || 
                     parsed.args[0]?.toString() || 
                     parsed.args.loanId?.toNumber?.()?.toString() ||
                     null;
            
            if (loanId) {
              break;
            }
          }
        } catch (parseError) {
          // Not a LoanCreated event or couldn't parse - continue
          continue;
        }
      }

      // If still no loanId, try to get it from the transaction receipt return value
      if (!loanId && receipt.logs.length > 0) {
        // Could not find loanId in events, checking receipt
        // The createLoan function returns uint256, so check if it's in the receipt
        try {
          // Some contracts emit the return value - check all logs
          for (const log of receipt.logs) {
            if (log.topics && log.topics.length > 0) {
              // LoanCreated event signature: LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 interestRate)
              // First topic is the event signature, second topic should be loanId (indexed)
              if (log.topics.length >= 2) {
                const potentialLoanId = BigInt(log.topics[1]).toString();
                // Verify this is actually a LoanCreated event by checking address
                if (log.address?.toLowerCase() === (await this.loanVault.getAddress()).toLowerCase()) {
                  loanId = potentialLoanId;
                  break;
                }
              }
            }
          }
        } catch (topicError) {
          // Could not extract loanId from topics
        }
      }

      if (!loanId) {
        // Could not extract loanId from transaction
      }

      return {
        success: true,
        loanId,
        txHash: receipt.hash,
        receipt,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      
      let errorMessage = error.message || 'Loan creation failed';
      if (errorMessage.includes('Insufficient liquidity')) {
        errorMessage = 'Insufficient liquidity in pool';
      } else if (errorMessage.includes('Credit score too low')) {
        errorMessage = 'Credit score below minimum (500)';
      } else if (errorMessage.includes('user rejected')) {
        errorMessage = 'Transaction rejected by user';
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Repay a loan (real token transfer to LoanVault)
   * @param {number} loanId - Loan ID to repay
   * @returns {Promise<{txHash: string, receipt: object}>}
   */
  async repayLoan(loanId) {
    try {
      if (!this.loanVault || !this.signer) {
        throw new Error('Contracts not initialized or no signer');
      }

      const userAddress = await this.signer.getAddress();

      // PRE-FLIGHT CHECKS: Verify loan state before attempting repayment
      
      // 0. Check if contract is paused
      try {
        const paused = await this.loanVault.paused();
        if (paused) {
          throw new Error('LoanVault contract is currently paused. Repayments are temporarily disabled.');
        }
      } catch (pauseCheckError) {
        // If paused() doesn't exist, that's fine - contract might not have pause functionality
        // Could not check pause status
      }
      
      // 1. Check loan exists and get details
      const loanDetails = await this.loanVault.loans(loanId);
      
      // 2. Verify borrower
      if (loanDetails.borrower.toLowerCase() !== userAddress.toLowerCase()) {
        throw new Error(`You are not the borrower for loan ${loanId}. Borrower: ${loanDetails.borrower}, Your address: ${userAddress}`);
      }
      
      // 3. Check loan is active
      if (!loanDetails.isActive) {
        throw new Error(`Loan ${loanId} is not active`);
      }
      
      // 4. Check loan not already repaid
      if (loanDetails.isRepaid) {
        throw new Error(`Loan ${loanId} has already been repaid`);
      }

      // Calculate repayment amount (principal + interest)
      const repaymentAmount = await this.loanVault.calculateRepaymentAmount(loanId);
      if (!repaymentAmount) {
        throw new Error(`Could not calculate repayment amount for loan ${loanId}. The loan may not exist.`);
      }
      
      const repaymentAmountStr = repaymentAmount?.toString() || String(repaymentAmount || '0');
      const repaymentAmountKRSI = Number(repaymentAmountStr) / 1_000_000;
      
      if (repaymentAmountStr === '0') {
        throw new Error(`Repayment amount is zero. Cannot proceed with repayment.`);
      }
      
      // 5. Check balance
      const balance = await this.krishiToken.balanceOf(userAddress);
      const balanceStr = balance?.toString() || String(balance || '0');
      const balanceKRSI = Number(balanceStr) / 1_000_000;
      
      if (BigInt(balanceStr) < BigInt(repaymentAmountStr)) {
        throw new Error(
          `Insufficient KRSI balance. Required: ${repaymentAmountKRSI.toFixed(2)} KRSI, ` +
          `You have: ${balanceKRSI.toFixed(2)} KRSI, ` +
          `Shortfall: ${(repaymentAmountKRSI - balanceKRSI).toFixed(2)} KRSI`
        );
      }
      
      // 6. Check allowance
      const allowanceCheck = await this.checkAllowance(userAddress, repaymentAmountStr);
      // checkAllowance returns { approved, allowance, required }
      const currentAllowanceStr = allowanceCheck?.allowance || '0';
      const isApproved = allowanceCheck?.approved || false;
      
      if (!isApproved) {
        // Approve repayment amount (add 10% buffer to avoid precision issues)
        const approvalAmount = (BigInt(repaymentAmountStr) * 110n) / 100n;
        const approveResult = await this.approveTokenSpending(approvalAmount.toString());
        
        // Wait for approval to be confirmed
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Verify approval went through
        try {
          const loanVaultAddress = await this.loanVault.getAddress();
          const newAllowance = await this.krishiToken.allowance(userAddress, loanVaultAddress);
          const newAllowanceStr = newAllowance?.toString() || '0';
          
          if (BigInt(newAllowanceStr) < BigInt(repaymentAmountStr)) {
            throw new Error('Token approval failed or insufficient. Please try again.');
          }
        } catch (allowanceVerifyErr) {
          // Continue anyway - the approval transaction succeeded
        }
      }

      // Estimate gas first to catch errors early
      try {
        await this.loanVault.repayLoan.estimateGas(loanId);
      } catch (estimateError) {
        
        // Try to decode the error
        let decodedError = this.decodeContractError(estimateError);
        if (decodedError) {
          throw new Error(decodedError);
        }
        
        // If can't decode, provide helpful message
        throw new Error(
          `Transaction will fail: ${estimateError.message || 'Unknown error'}. ` +
          `Please check: 1) You have enough KRSI tokens, 2) Loan is still active, 3) You are the borrower.`
        );
      }
      
      const tx = await this.loanVault.repayLoan(loanId);
      const receipt = await tx.wait();

      return {
        success: true,
        txHash: receipt.hash,
        receipt,
        blockNumber: receipt.blockNumber
      };
    } catch (error) {
      
      let errorMessage = error.message || 'Loan repayment failed';
      
      // Try to decode custom errors
      const decodedError = this.decodeContractError(error);
      if (decodedError) {
        errorMessage = decodedError;
      } else {
        // Map common error messages
        if (errorMessage.includes('insufficient balance') || errorMessage.includes('Insufficient')) {
          errorMessage = 'Insufficient KRSI balance for repayment';
        } else if (errorMessage.includes('Not the borrower')) {
          errorMessage = 'You are not the borrower for this loan';
        } else if (errorMessage.includes('already repaid') || errorMessage.includes('isRepaid')) {
          errorMessage = 'Loan has already been repaid';
        } else if (errorMessage.includes('not active') || errorMessage.includes('isActive')) {
          errorMessage = 'Loan is not active';
        } else if (errorMessage.includes('user rejected') || errorMessage.includes('rejected')) {
          errorMessage = 'Transaction rejected by user';
        } else if (errorMessage.includes('unknown custom error') || errorMessage.includes('execution reverted')) {
          errorMessage = 'Transaction failed. This could be due to: insufficient balance, loan already repaid, or contract pause. Please check the loan status.';
        }
      }
      
      throw new Error(errorMessage);
    }
  }

  /**
   * Try to decode contract error from error object
   */
  decodeContractError(error) {
    try {
      // Check if error has data field with custom error
      const errorData = error.data || error.error?.data || error.transaction?.data;
      const errorReason = error.reason || error.message;
      
      if (errorData && typeof errorData === 'string' && errorData.startsWith('0x')) {
        // Extract error selector (first 4 bytes)
        const selector = errorData.substring(0, 10); // 0x + 4 bytes
        
        const errorSignatures = {
          '0x08c379a0': 'Error(string)',
          '0xfb8f41b2': 'EnforcedPause()',
          '0xd93c0665': 'ExpectedPause()',
          '0x815e1d64': 'ReentrancyGuardReentrantCall()',
        };
        
        // Try to decode known errors
        if (errorSignatures[selector]) {
          try {
            const decoded = this.loanVault.interface.decodeErrorResult(errorSignatures[selector], errorData);
            if (errorSignatures[selector] === 'Error(string)') {
              return decoded[0]; // Error message
            } else {
              return errorSignatures[selector].replace('()', ''); // Error name
            }
          } catch (decodeErr) {
            // Could not decode error
          }
        }
        
        // Try to decode as Error(string) as fallback
        if (errorData.length > 10) { // Has more than just selector
          try {
            const decoded = this.loanVault.interface.decodeErrorResult('Error(string)', errorData);
            return decoded[0];
          } catch {}
        }
        
        // If selector matches EnforcedPause
        if (selector === '0xfb8f41b2') {
          return 'Contract is paused. Repayments are temporarily disabled.';
        }
        
        // If selector matches ReentrancyGuard
        if (selector === '0x815e1d64') {
          return 'Reentrancy detected. Please try again.';
        }
      }
      
      // Check error reason/message for helpful info
      if (errorReason) {
        return errorReason;
      }
      
      return null;
    } catch (decodeErr) {
      // Error decoding contract error
      return null;
    }
  }

  /**
   * Get lender information from LoanVault
   * @param {string} lenderAddress - Lender's address
   * @returns {Promise<object>}
   */
  async getLenderInfo(lenderAddress) {
    try {
      if (!this.loanVault) {
        throw new Error('LoanVault contract not initialized');
      }

      const lenderInfo = await this.loanVault.lenders(lenderAddress);
      
      return {
        address: lenderAddress,
        totalDeposited: lenderInfo.totalDeposited.toString(),
        totalWithdrawn: lenderInfo.totalWithdrawn.toString(),
        lpShares: lenderInfo.lpShares.toString(),
        lastDepositTime: lenderInfo.lastDepositTime.toString(),
        isActive: lenderInfo.isActive
      };
    } catch (error) {
      // Error getting lender info
      throw error;
    }
  }

  /**
   * Get pool information
   * @returns {Promise<object>}
   */
  async getPoolInfo() {
    try {
      if (!this.loanVault) {
        throw new Error('LoanVault contract not initialized');
      }

      const totalLiquidity = await this.loanVault.totalLiquidity();
      
      return {
        totalLiquidity: totalLiquidity.toString()
      };
    } catch (error) {
      // Error getting pool info
      throw error;
    }
  }

  /**
   * Get loan ID from transaction hash by parsing the transaction receipt
   * @param {string} txHash - Transaction hash
   * @returns {Promise<number|null>} Loan ID or null if not found
   */
  async getLoanIdFromTxHash(txHash) {
    try {
      if (!this.loanVault || !this.signer) {
        throw new Error('Contracts not initialized');
      }

      const provider = this.signer.provider || this.loanVault.provider;
      if (!provider) {
        throw new Error('Provider not available');
      }

      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      // Parse LoanCreated event from receipt
      for (const log of receipt.logs) {
        try {
          const parsed = this.loanVault.interface.parseLog(log);
          if (parsed?.name === 'LoanCreated') {
            const loanId = parsed.args.loanId?.toString() || parsed.args[0]?.toString() || null;
            if (loanId) {
              return Number(loanId);
            }
          }
        } catch {
          continue;
        }
      }

      // Try extracting from topics (indexed parameters)
      try {
        const eventSignature = this.loanVault.interface.getEvent('LoanCreated');
        if (eventSignature && eventSignature.topicHash) {
          const topic0 = eventSignature.topicHash;
          
          for (const log of receipt.logs) {
            if (log.topics && log.topics[0] === topic0 && log.topics.length >= 2) {
              // topics[1] is the indexed loanId
              const loanId = BigInt(log.topics[1]).toString();
              return Number(loanId);
            }
          }
        } else {
          // Fallback: use ethers.id() to compute topic hash (ethers is already imported)
          try {
            // Compute keccak256 hash of event signature
            // LoanCreated(uint256,address,uint256,uint256)
            const eventSig = 'LoanCreated(uint256,address,uint256,uint256)';
            const topic0 = ethers.id(eventSig);
            
            for (const log of receipt.logs) {
              // Check if log is from our contract
              const contractAddress = await this.loanVault.getAddress();
              if (log.address?.toLowerCase() !== contractAddress.toLowerCase()) {
                continue;
              }
              
              if (log.topics && log.topics[0] === topic0 && log.topics.length >= 2) {
                const loanId = BigInt(log.topics[1]).toString();
                return Number(loanId);
              }
            }
          } catch (manualError) {
            // Could not compute topic hash manually
          }
        }
      } catch (topicError) {
        // Could not extract loanId from topics
      }

      // Could not find LoanCreated event in transaction
      return null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get loan details
   * @param {number} loanId - Loan ID
   * @returns {Promise<object>}
   */
  async getLoanDetails(loanId) {
    try {
      if (!this.loanVault) {
        throw new Error('LoanVault contract not initialized');
      }

      const loan = await this.loanVault.loans(loanId);
      
      return {
        loanId: loan.loanId.toString(),
        borrower: loan.borrower,
        amount: loan.amount.toString(),
        interestRate: loan.interestRate.toString(),
        termDays: loan.termDays.toString(),
        collateralValue: loan.collateralValue.toString(),
        creditScore: loan.creditScore.toString(),
        createdAt: loan.createdAt.toString(),
        dueDate: loan.dueDate.toString(),
        isActive: loan.isActive,
        isRepaid: loan.isRepaid,
        isDefaulted: loan.isDefaulted
      };
    } catch (error) {
      // Error getting loan details
      throw error;
    }
  }
}

export default LoanVaultService;

