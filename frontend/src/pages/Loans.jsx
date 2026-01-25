import React, { useEffect, useState } from 'react';
import { useWeb3 } from '../context/Web3Context';
import LoanVaultService from '../services/loanVaultService';
import inAppWalletService from '../services/inAppWalletService';
import TransactionStatus from '../components/TransactionStatus';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { getUserFriendlyError, isUserRejection } from '../utils/errorMessages';
import { estimateGasCost, formatGasEstimation } from '../utils/gasEstimator';

const api = async (path, opts = {}) => {
    const base = import.meta.env.VITE_API_BASE || '';
	const token = localStorage.getItem('auth_token');
    const res = await fetch(`${base}/api${path}`, {
		method: opts.method || 'GET',
		headers: {
			'Content-Type': 'application/json',
			Authorization: token ? `Bearer ${token}` : undefined,
		},
		body: opts.body ? JSON.stringify(opts.body) : undefined,
	});
	if (!res.ok) throw new Error(await res.text());
	return res.json();
};

export default function Loans() {
	const { contracts, signer, account, isConnected } = useWeb3();
	const [loanVaultService, setLoanVaultService] = useState(null);
	const [walletAddress, setWalletAddress] = useState(null);
	const [walletBalance, setWalletBalance] = useState(null); // ETH balance
	const [krishiBalance, setKrishiBalance] = useState(null); // KRSI balance
	
	const [principal, setPrincipal] = useState('100');
    const [durationDays, setDurationDays] = useState('180');
    // Fixed APR at 8% - only changeable via DAO
    const [interestBps, setInterestBps] = useState('8');
    const [category, setCategory] = useState('operations');
    const [reason, setReason] = useState('');
    const [isAgri, setIsAgri] = useState(true);
	const [loan, setLoan] = useState(null);
	const [repayAmt, setRepayAmt] = useState('');
	const [msg, setMsg] = useState('');
	const [err, setErr] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [isRepaying, setIsRepaying] = useState(false);
    const [schedule, setSchedule] = useState([]);
    const [streamRate, setStreamRate] = useState(''); // KRSI/day
    const [streaming, setStreaming] = useState(false);
    const [activeLoans, setActiveLoans] = useState([]);
    const [repaidLoans, setRepaidLoans] = useState([]);
	const [txStatus, setTxStatus] = useState(null); // { type: 'create'|'repay', status: 'pending'|'confirmed'|'error', txHash: string, loanId: number }

	// Auto-refresh balance from blockchain
	useEffect(() => {
		const refreshBalance = async () => {
			if (loanVaultService && walletAddress) {
				try {
					const onChainBalance = await loanVaultService.krishiToken.balanceOf(walletAddress);
					const onChainBalanceKRSI = Number(onChainBalance) / 1_000_000;
					setKrishiBalance(onChainBalanceKRSI);
					// Balance auto-refreshed
					
					// Sync to database
					try {
						await api('/wallet/sync-balance', { method: 'POST', body: {} });
					} catch {}
				} catch (e) {
					// Could not auto-refresh balance
				}
			}
		};
		
		const intervalId = setInterval(refreshBalance, 30000); // Refresh every 30 seconds
		refreshBalance(); // Initial refresh
		
		return () => clearInterval(intervalId);
	}, [loanVaultService, walletAddress]);

	// Initialize LoanVault service (similar to Liquidity.jsx)
	useEffect(() => {
		let isMounted = true;
		
		const initLoanVaultService = async () => {
			const contractAddresses = {
				krishiToken: import.meta.env.VITE_KRSI_CONTRACT_ADDRESS || "0x41ef54662509D66715C237c6e1d025DBC6a9D8d1",
				loanVault: import.meta.env.VITE_LOAN_VAULT_ADDRESS || "0xb3c84011492b4126337798E53aE5e483FD2933A8"
			};

			try {
				// Get wallet from backend
				let wallet = null;
				let walletAddress = null;
				try {
					const token = localStorage.getItem('auth_token');
					if (token) {
						const walletRes = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/wallet`, {
							headers: { 'Authorization': `Bearer ${token}` }
						});
						if (walletRes.ok) {
							const walletData = await walletRes.json();
							if (walletData.wallet?.metadata?.private_key) {
								wallet = new ethers.Wallet(walletData.wallet.metadata.private_key);
								walletAddress = wallet.address;
							}
						}
					}
				} catch (apiError) {
					// Fallback to in-app wallet
				}

				// Fallback to in-app wallet
				if (!wallet) {
					if (!inAppWalletService.isServiceInitialized()) {
						await inAppWalletService.initialize();
					}
					wallet = inAppWalletService.getWallet();
					if (!wallet) {
						const result = await inAppWalletService.generateWallet();
						if (result.success) wallet = result.wallet;
					}
					if (wallet) walletAddress = wallet.address;
				}

				if (!wallet || !walletAddress) {
					throw new Error('Could not initialize wallet');
				}

				const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia.publicnode.com');
				const inAppSigner = wallet.connect(provider);

				// Get ETH balance
				try {
					const balance = await provider.getBalance(walletAddress);
					if (isMounted) setWalletBalance(ethers.formatEther(balance));
				} catch {}

				if (isMounted) setWalletAddress(walletAddress);

				// Create contracts
				const krishiTokenAddress = contractAddresses.krishiToken;
				const loanVaultAddress = contractAddresses.loanVault;
				
				const krishiTokenABI = [
					"function balanceOf(address owner) view returns (uint256)",
					"function approve(address spender, uint256 amount) external returns (bool)",
					"function allowance(address owner, address spender) external view returns (uint256)"
				];

				const loanVaultABI = [
					"function createLoan(uint256 amount, uint256 termDays, uint256 collateralValue) external returns (uint256)",
					"function repayLoan(uint256 loanId) external",
					"function calculateRepaymentAmount(uint256 loanId) external view returns (uint256)",
					"function loans(uint256) external view returns (uint256 loanId, address borrower, uint256 amount, uint256 interestRate, uint256 termDays, uint256 collateralValue, uint256 creditScore, uint256 createdAt, uint256 dueDate, bool isActive, bool isRepaid, bool isDefaulted)",
					"function totalLiquidity() external view returns (uint256)",
					"function getCreditScore(address borrower) external view returns (uint256)",
					"function borrowerLoans(address borrower) external view returns (uint256[])",
					"function paused() external view returns (bool)"
				];
				
				const loanVaultWithSigner = new ethers.Contract(loanVaultAddress, loanVaultABI, inAppSigner);
				const krishiTokenWithSigner = new ethers.Contract(krishiTokenAddress, krishiTokenABI, inAppSigner);

				// Check if farmer (for gasless transactions)
				let useSponsored = false;
				try {
					const token = localStorage.getItem('auth_token');
					if (token) {
						const userRes = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/auth/me`, {
							headers: { 'Authorization': `Bearer ${token}` }
						});
						if (userRes.ok) {
							const userData = await userRes.json();
							useSponsored = userData.user?.role === 'farmer';
						}
					}
				} catch (e) {}

				const service = new LoanVaultService(loanVaultWithSigner, krishiTokenWithSigner, inAppSigner, useSponsored);
				
				if (isMounted) {
					setLoanVaultService(service);
					setWalletAddress(walletAddress);
					
					// Fetch initial balance from blockchain
					try {
						const balance = await krishiTokenWithSigner.balanceOf(walletAddress);
						const balanceKRSI = Number(balance) / 1_000_000;
						setKrishiBalance(balanceKRSI);
						// Initial balance loaded
						
						// Sync to database
						try {
							await api('/wallet/sync-balance', { method: 'POST', body: {} });
						} catch {}
					} catch (balanceErr) {
						// Balance will be fetched on next update
					}
				}
			} catch (error) {
				if (isMounted) {
					setErr(`Failed to initialize wallet: ${error.message}`);
				}
			}
		};

		const timeoutId = setTimeout(initLoanVaultService, 100);
		return () => {
			isMounted = false;
			clearTimeout(timeoutId);
		};
	}, []);

	const createLoan = async () => {
		setMsg(''); setErr(''); setTxStatus(null);
		
		if (!loanVaultService) {
			setErr('LoanVault service not ready. Please wait...');
			toast.error('Wallet not ready');
			return;
		}
		
		if (!principal || isNaN(Number(principal)) || Number(principal) <= 0) {
			setErr('Enter a valid principal');
			return;
		}

		// Check wallet balance for gas (if not using sponsored transactions)
		if (loanVaultService && !loanVaultService.useSponsored && walletBalance !== null && Number(walletBalance) < 0.001) {
			setErr(`Insufficient ETH for gas fees. Your wallet needs at least 0.001 Sepolia ETH. Current balance: ${Number(walletBalance).toFixed(6)} ETH`);
			toast.error('Insufficient ETH for gas. Please fund your wallet first.');
			return;
		}

		setIsCreating(true);
		setTxStatus({ type: 'create', status: 'pending', txHash: null });

		try {
			const amountWei = BigInt(Math.floor(Number(principal) * 1_000_000));
			const amountKRSI = Number(principal);
			const termDaysNum = Number(durationDays) || 180;
			const collateralValueWei = '0'; // No collateral for now

			// PRE-FLIGHT CHECKS: Verify pool has enough liquidity BEFORE attempting transaction
			try {
				const totalLiquidity = await loanVaultService.loanVault.totalLiquidity();
				const totalLiquidityKRSI = Number(totalLiquidity) / 1_000_000;
				
				if (BigInt(totalLiquidity) < amountWei) {
					const errorMsg = `Insufficient liquidity in pool. Available: ${totalLiquidityKRSI.toFixed(2)} KRSI, Requested: ${amountKRSI.toFixed(2)} KRSI`;
					throw new Error(errorMsg);
				}

				// Check credit score (contract will check this too, but good to know upfront)
				try {
					const creditScore = await loanVaultService.loanVault.getCreditScore(walletAddress);
					if (Number(creditScore) < 500) {
						throw new Error(`Credit score too low. Required: 500, Your score: ${creditScore.toString()}`);
					}
				} catch (creditError) {
					// Continue anyway - contract will enforce it
				}
			} catch (preFlightError) {
				throw preFlightError;
			}
			toast.loading('Creating loan on blockchain...', { id: 'create-loan' });

			// Call LoanVault contract to create loan
			let result;
			try {
				result = await loanVaultService.createLoan(
					amountWei.toString(),
					termDaysNum,
					collateralValueWei
				);
			} catch (contractError) {
				// Re-throw with more context
				throw new Error(`Contract error: ${contractError.message || contractError.toString()}`);
			}

			if (!result || !result.success || !result.txHash) {
				throw new Error('Loan creation failed - no transaction hash received. Transaction may have been rejected or reverted.');
			}

			setTxStatus({ type: 'create', status: 'confirmed', txHash: result.txHash, loanId: result.loanId });
			toast.success('Loan created successfully!', { id: 'create-loan' });
			setMsg(`Loan created! Transaction: ${result.txHash.substring(0, 10)}...`);

			// Wait for transaction to be confirmed and balances to update
			await new Promise(resolve => setTimeout(resolve, 3000));

			// Refresh KRSI balance from blockchain (loan creation increases borrower balance)
			if (walletAddress) {
				try {
					const newBalance = await loanVaultService.krishiToken.balanceOf(walletAddress);
					const newBalanceKRSI = Number(newBalance) / 1_000_000;
					setKrishiBalance(newBalanceKRSI);
					// Balance updated after loan
					
					// Sync balance to backend
					try {
						await api('/wallet/sync-balance', { method: 'POST', body: {} });
					} catch (syncErr) {
						// Balance sync failed
					}
				} catch (balanceErr) {
					// Could not refresh balance
				}
			}

			// Create database record with tx_hash
			try {
				const dbResult = await api('/loans/create', { 
					method: 'POST', 
					body: { 
						principalWei: amountWei.toString(), 
						durationDays: termDaysNum,
						txHash: result.txHash,
						loanId: result.loanId ? Number(result.loanId) : null,
						category,
						reason,
						isAgri
					} 
				});
				
				if (dbResult.loan) {
					setLoan(dbResult.loan);
					
					// Load schedule
					try {
						const sc = await api(`/loans/${dbResult.loan.id}/schedule`);
						setSchedule(sc.schedule || []);
					} catch {}
					
					// Refresh active loans and repaid loans
					await loadActive();
					await loadRepaid();
				}
			} catch (dbError) {
				toast.error('Loan created on-chain but database sync failed. Please refresh.', { duration: 5000 });
			}

		} catch (error) {
			
			// Check if user rejected
			if (isUserRejection(error)) {
				setTxStatus(null);
				setIsCreating(false);
				return;
			}
			
			const friendlyError = getUserFriendlyError(error);
			setErr(friendlyError);
			setTxStatus({ type: 'create', status: 'error', txHash: null, error: friendlyError });
			toast.error(friendlyError, { id: 'create-loan', duration: 10000 });
		} finally {
			setIsCreating(false);
		}
	};

	const repay = async () => {
		setMsg(''); setErr(''); setTxStatus(null);
		
		if (!loanVaultService) {
			setErr('LoanVault service not ready. Please wait...');
			toast.error('Wallet not ready');
			return;
		}

		if (!loan || !loan.id) {
			setErr('No active loan to repay');
			return;
		}

		// Get loanId - MUST use on-chain loanId, not database id
		let loanId = loan.loanvault_loan_id || loan.on_chain_loan_id;
		
		if (!loanId) {
			// Try to find the loan ID from transaction hash if available
			
			if (loan.tx_hash && loanVaultService) {
				try {
					const extractedLoanId = await loanVaultService.getLoanIdFromTxHash(loan.tx_hash);
					
					if (extractedLoanId) {
						loanId = extractedLoanId.toString();
						
						// Update database with the loan ID
						try {
							await api(`/loans/${loan.id}/sync-loan-id`, {
								method: 'POST',
								body: { loanvaultLoanId: extractedLoanId }
							});
							// Update local state
							setLoan({ ...loan, loanvault_loan_id: extractedLoanId, on_chain_loan_id: extractedLoanId });
							toast.success(`Found on-chain loan ID: ${extractedLoanId}`, { duration: 5000 });
						} catch (updateErr) {
							// Continue anyway with the extracted ID
						}
					} else {
						// Try querying borrowerLoans to find matching loan
						const borrowerLoanIds = await loanVaultService.loanVault.borrowerLoans(walletAddress);
						
						// If user only has one loan and this DB loan matches the amount, use it
						if (borrowerLoanIds.length === 1) {
							const singleLoanId = Number(borrowerLoanIds[0]);
							const singleLoanDetails = await loanVaultService.loanVault.loans(singleLoanId);
							const loanAmount = Number(singleLoanDetails.amount) / 1_000_000;
							const dbAmount = Number(loan.principal_wei) / 1_000_000;
							
							if (Math.abs(loanAmount - dbAmount) < 0.01) { // Within 0.01 KRSI
								loanId = singleLoanId.toString();
								
								// Update database
								try {
									await api(`/loans/${loan.id}/sync-loan-id`, {
										method: 'POST',
										body: { loanvaultLoanId: singleLoanId }
									});
									setLoan({ ...loan, loanvault_loan_id: singleLoanId, on_chain_loan_id: singleLoanId });
									toast.success(`Matched loan ID: ${singleLoanId}`, { duration: 5000 });
								} catch {}
							}
						}
						
						if (!loanId) {
							throw new Error(
								'Could not automatically find on-chain loan ID.\n\n' +
								`Database loan ID: ${loan.id}\n` +
								`Your on-chain loans: ${borrowerLoanIds.length > 0 ? borrowerLoanIds.map(id => id.toString()).join(', ') : 'none'}\n\n` +
								`Please contact support or try creating a new loan.`
							);
						}
					}
				} catch (findError) {
					setErr(
						`⚠️ Could not find on-chain loan ID for this loan.\n\n` +
						`Database Loan ID: ${loan.id}\n` +
						`Transaction Hash: ${loan.tx_hash || 'Not available'}\n\n` +
						`The loan exists on-chain but the loan ID wasn't stored in the database.\n` +
						`Please use the "Sync Loan ID" button below or contact support.`
					);
					toast.error('Could not find on-chain loan ID', { duration: 10000 });
					return;
				}
			} else {
				setErr(
					'⚠️ This loan has no on-chain loan ID or transaction hash.\n\n' +
					'Database loan ID: ' + loan.id + '\n\n' +
					'This loan may have been created before on-chain integration. Please create a new loan.'
				);
				toast.error('Loan missing on-chain ID and transaction hash', { duration: 10000 });
				return;
			}
		}

		// Validate loanId is a number (on-chain IDs are uint256)
		const loanIdNum = Number(loanId);
		if (isNaN(loanIdNum) || loanIdNum <= 0) {
			setErr(`Invalid loan ID: ${loanId}. Expected a positive number.`);
			toast.error('Invalid loan ID', { duration: 5000 });
			return;
		}

		// Check wallet balance for gas (if not using sponsored transactions)
		if (loanVaultService && !loanVaultService.useSponsored && walletBalance !== null && Number(walletBalance) < 0.001) {
			setErr(`Insufficient ETH for gas fees. Your wallet needs at least 0.001 Sepolia ETH. Current balance: ${Number(walletBalance).toFixed(6)} ETH`);
			toast.error('Insufficient ETH for gas. Please fund your wallet first.');
			return;
		}

		// PRE-FLIGHT CHECKS: Validate loan exists on-chain and user is the borrower
		try {
			if (!walletAddress) {
				throw new Error('Wallet address not available');
			}

			// First, get all your on-chain loans to verify loanId exists
			// Fetching on-chain loans
			let borrowerLoanIds = [];
			try {
				borrowerLoanIds = await loanVaultService.loanVault.borrowerLoans(walletAddress);
			} catch (borrowerLoansError) {
			}

			// Check if the loanId exists in your loans
			const loanIdExists = borrowerLoanIds.some(id => Number(id) === Number(loanId));
			if (!loanIdExists && borrowerLoanIds.length > 0) {
			}
			
			// Check loan exists and get loan details
			const loanDetails = await loanVaultService.loanVault.loans(loanId);
			const borrowerAddress = loanDetails.borrower;
			const isActive = loanDetails.isActive;
			const isRepaid = loanDetails.isRepaid;

			// Verify borrower matches
			if (borrowerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
				// Borrower mismatch
				
				// Try to help user understand what's happening
				let helpMsg = `You are not the borrower for this loan.\n\n`;
				helpMsg += `Loan ID (on-chain): ${loanId}\n`;
				helpMsg += `Loan Borrower (on-chain): ${borrowerAddress}\n`;
				helpMsg += `Your Wallet Address: ${walletAddress}\n`;
				helpMsg += `Database Loan ID: ${loan.id}\n\n`;
				
				if (borrowerLoanIds.length > 0) {
					helpMsg += `Your on-chain loans: ${borrowerLoanIds.map(id => id.toString()).join(', ')}\n\n`;
				}
				
				helpMsg += `Possible causes:\n`;
				helpMsg += `1. Loan was created with a different wallet address\n`;
				helpMsg += `2. Database loan ID ${loan.id} doesn't match on-chain loan ID ${loanId}\n`;
				helpMsg += `3. You need to use the same wallet that created the loan\n\n`;
				helpMsg += `Please check which wallet address was used to create this loan.`;
				
				setErr(helpMsg);
				toast.error('Borrower address mismatch', { duration: 15000 });
				return;
			}

			// Check if already repaid
			if (isRepaid || !isActive) {
				const errorMsg = `This loan has already been ${isRepaid ? 'repaid' : 'closed'}.\n\n` +
					`Loan ID: ${loanId}\n` +
					`Status: ${isRepaid ? 'Repaid' : 'Inactive'}`;
				setErr(errorMsg);
				toast.error('Loan already repaid or closed', { duration: 8000 });
				return;
			}

			// Check KRSI balance and calculate repayment amount
			const onChainBalance = await loanVaultService.krishiToken.balanceOf(walletAddress);
			const onChainBalanceKRSI = Number(onChainBalance) / 1_000_000;
			
			// Calculate expected repayment amount from contract
			const expectedRepaymentWei = await loanVaultService.loanVault.calculateRepaymentAmount(loanId);
			const expectedRepaymentKRSI = Number(expectedRepaymentWei) / 1_000_000;
			

			if (onChainBalanceKRSI < expectedRepaymentKRSI) {
				setErr(
					`Insufficient KRSI balance for repayment.\n\n` +
					`Required: ${expectedRepaymentKRSI.toFixed(2)} KRSI\n` +
					`Your balance: ${onChainBalanceKRSI.toFixed(2)} KRSI\n` +
					`Shortfall: ${(expectedRepaymentKRSI - onChainBalanceKRSI).toFixed(2)} KRSI`
				);
				toast.error(`Need ${expectedRepaymentKRSI.toFixed(2)} KRSI but only have ${onChainBalanceKRSI.toFixed(2)}`, { duration: 8000 });
				return;
			}

		} catch (preFlightError) {
			
			let errorMsg = preFlightError.message || 'Failed to validate loan before repayment';
			
			if (preFlightError.message?.includes('Not the borrower') || preFlightError.message?.includes('not the borrower')) {
				errorMsg = `You are not the borrower for loan ${loanId}.\n\n` +
					`This loan belongs to a different address. Only the original borrower can repay it.`;
			} else if (preFlightError.message?.includes('Loan not active') || preFlightError.message?.includes('already repaid')) {
				errorMsg = `Loan ${loanId} is not active or has already been repaid.`;
			} else if (preFlightError.message?.includes('revert') || preFlightError.message?.includes('execution reverted')) {
				// Extract revert reason
				const revertMatch = preFlightError.message.match(/execution reverted: (.+)/i);
				if (revertMatch) {
					errorMsg = `Loan validation failed: ${revertMatch[1]}`;
				}
			}
			
			setErr(errorMsg);
			toast.error(errorMsg, { id: 'repay-loan', duration: 10000 });
			return;
		}

		setIsRepaying(true);
		setTxStatus({ type: 'repay', status: 'pending', txHash: null });

		try {
			toast.loading('Processing repayment on blockchain...', { id: 'repay-loan' });

			// Call LoanVault contract to repay loan (contract calculates full repayment amount)
			const result = await loanVaultService.repayLoan(loanId);

			if (!result.success || !result.txHash) {
				throw new Error('Loan repayment failed - no transaction hash received');
			}

			setTxStatus({ type: 'repay', status: 'confirmed', txHash: result.txHash });
			toast.success('Repayment successful!', { id: 'repay-loan' });
			setMsg(`Repayment successful! Transaction: ${result.txHash.substring(0, 10)}...`);

			// Wait a moment for transaction to be confirmed
			await new Promise(resolve => setTimeout(resolve, 2000));

			// Update database record with tx_hash
			try {
				// Get the repayment amount from the blockchain event or calculate it
				let repaymentAmountWei = '0';
				try {
					// Try to get from contract if loan still exists
					repaymentAmountWei = await loanVaultService.loanVault.calculateRepaymentAmount(loanId);
				} catch {
					// If loan is repaid, use principal + estimated interest
					const principalWei = loan.principal_wei || '0';
					const interestEstimate = BigInt(principalWei) * BigInt(Number(loan.interest_bps || 800)) / 10000n / 2n; // Rough estimate
					repaymentAmountWei = (BigInt(principalWei) + interestEstimate).toString();
				}

				const dbResult = await api('/loans/repay', { 
					method: 'POST', 
					body: { 
						loanId: loan.id,
						amountWei: repaymentAmountWei,
						txHash: result.txHash
					} 
				});
				
				if (dbResult.loan) {
					setLoan(dbResult.loan);
					
					// Load schedule
					try {
						const sc = await api(`/loans/${loan.id}/schedule`);
						setSchedule(sc.schedule || []);
					} catch {}
					
					// Refresh active loans and repaid loans
					await loadActive();
					await loadRepaid();
					
					// Refresh KRSI balance
					if (walletAddress) {
						try {
							const newBalance = await loanVaultService.krishiToken.balanceOf(walletAddress);
							const newBalanceKRSI = Number(newBalance) / 1_000_000;
							setKrishiBalance(newBalanceKRSI);
						} catch {}
					}
				}
			} catch (dbError) {
				toast.error('Repayment successful on-chain but database sync failed. Please refresh.', { duration: 5000 });
			}

		} catch (error) {
			
			// Check if user rejected
			if (isUserRejection(error)) {
				setTxStatus(null);
				setIsRepaying(false);
				setRepayAmt('');
				return;
			}
			
			const friendlyError = getUserFriendlyError(error);
			setErr(friendlyError);
			setTxStatus({ type: 'repay', status: 'error', txHash: null, error: friendlyError });
			toast.error(friendlyError, { id: 'repay-loan', duration: 8000 });
		} finally {
			setIsRepaying(false);
			setRepayAmt(''); // Clear repayment amount input
		}
	};

    const loadSchedule = async (loanId) => {
        try { const sc = await api(`/loans/${loanId}/schedule`); setSchedule(sc.schedule || []); } catch {}
    }

    const loadActive = async () => {
        try { 
            const r = await api('/loans/active');
            const loans = r.loans || [];
            
            // If we have loans but they're missing on-chain IDs, try to sync them
            for (const loanRecord of loans) {
                if (!loanRecord.loanvault_loan_id && !loanRecord.on_chain_loan_id && loanRecord.tx_hash && loanVaultService) {
                    try {
                        const extractedId = await loanVaultService.getLoanIdFromTxHash(loanRecord.tx_hash);
                        if (extractedId) {
                            // Update via API
                            try {
                                await api(`/loans/${loanRecord.id}/sync-loan-id`, {
                                    method: 'POST',
                                    body: { loanvaultLoanId: extractedId }
                                });
                                // Update local record
                                loanRecord.loanvault_loan_id = extractedId;
                                loanRecord.on_chain_loan_id = extractedId;
                            } catch (syncErr) {
                                // Could not sync loan ID
                            }
                        }
                    } catch (extractErr) {
                        // Could not extract loan ID
                    }
                }
            }
            
            setActiveLoans(loans); 
        } catch (err) {
            // Error loading loans
            setActiveLoans([]);
        }
    };

    const loadRepaid = async () => {
        try {
            const r = await api('/loans/repaid');
            setRepaidLoans(r.loans || []);
        } catch (err) {
            // Error loading repaid loans
            setRepaidLoans([]);
        }
    };

    // Helper to fetch user's on-chain loans and match with database
    const syncLoansFromBlockchain = async () => {
        if (!loanVaultService || !walletAddress) {
            // Cannot sync loans
            return;
        }

        try {
            
            // Try to get borrower loans - handle gracefully if function doesn't exist or reverts
            // NOTE: borrowerLoans mapping getter might not work correctly, so we'll skip it and use tx_hash extraction instead
            let borrowerLoanIds = [];
            
            // First, try to extract from transaction hash if available (more reliable)
            if (loan && loan.tx_hash && !loan.loanvault_loan_id && !loan.on_chain_loan_id) {
                try {
                    const extractedLoanId = await loanVaultService.getLoanIdFromTxHash(loan.tx_hash);
                    if (extractedLoanId) {
                        borrowerLoanIds = [extractedLoanId];
                        
                        // Auto-update database
                        try {
                            await api(`/loans/${loan.id}/sync-loan-id`, {
                                method: 'POST',
                                body: { loanvaultLoanId: extractedLoanId }
                            });
                            console.log(`✅ Auto-synced loan ID ${extractedLoanId} to database`);
                            // Update local state
                            setLoan({ ...loan, loanvault_loan_id: extractedLoanId, on_chain_loan_id: extractedLoanId });
                        } catch (updateErr) {
                            console.warn('Could not auto-update database:', updateErr);
                        }
                    }
                } catch (extractErr) {
                    console.warn('Could not extract loan ID from transaction:', extractErr.message || extractErr);
                }
            }
            
            // Only try borrowerLoans if we didn't get IDs from tx_hash
            if (borrowerLoanIds.length === 0) {
                try {
                    // Try calling borrowerLoans - this might revert if user has no loans
                    // We'll catch and ignore the error
                    const result = await loanVaultService.loanVault.borrowerLoans(walletAddress);
                    
                    // Handle different return types
                    if (Array.isArray(result)) {
                        borrowerLoanIds = result.map(id => {
                            try {
                                return Number(id.toString());
                            } catch {
                                return 0;
                            }
                        }).filter(id => id > 0);
                    } else if (result && typeof result === 'object') {
                        // Might be an object with length property
                        const length = result.length ? Number(result.length) : 0;
                        borrowerLoanIds = [];
                        for (let i = 0; i < length; i++) {
                            try {
                                const id = Number(result[i]?.toString() || '0');
                                if (id > 0) borrowerLoanIds.push(id);
                            } catch {}
                        }
                    }
                    
                    if (borrowerLoanIds.length > 0) {
                    }
                } catch (borrowerLoansError) {
                    // borrowerLoans might revert if user has no loans - this is expected behavior
                    // Silently skip - we've already tried tx_hash extraction above
                    if (borrowerLoansError.message && borrowerLoansError.message.includes('require(false)')) {
                        // This is a known issue - the mapping getter reverts when the array is empty
                        // Don't log as error, just continue silently
                    } else {
                        // Only log as warning if it's not the expected revert
                    }
                }
            }
            
            // If still no loans found, that's okay - user might not have any on-chain loans
            if (borrowerLoanIds.length === 0) {
                // No on-chain loans found
                return;
            }
            
            // For each loan ID, fetch details and match with database
            for (let i = 0; i < borrowerLoanIds.length; i++) {
                const onChainLoanId = borrowerLoanIds[i];
                try {
                    const loanDetails = await loanVaultService.loanVault.loans(onChainLoanId);
                    
                    // Check if this matches current loan
                    if (loan && (loan.loanvault_loan_id === onChainLoanId || loan.on_chain_loan_id === onChainLoanId)) {
                        
                        // Verify borrower (silently)
                    }
                } catch (loanErr) {
                    // Could not fetch loan
                }
            }
        } catch (syncErr) {
            // Error syncing loans (non-critical)
            // This is not a critical error - user can still use the app
        }
    }

    // Load loans immediately on mount (don't wait for service)
    useEffect(()=>{ 
        (async()=>{ 
            try {
                await loadActive();
                await loadRepaid(); // Also load repaid loans
            } catch (err) {
                // Error loading loans on mount
            }
        })(); 
    },[]); // Run once on mount
    
    // Also reload when service becomes available (in case we missed some on-chain loans)
    useEffect(()=>{ 
        if (loanVaultService) {
            (async()=>{ 
                try {
                    await loadActive();
                    await loadRepaid();
                } catch (err) {
                    // Error reloading loans
                }
            })(); 
        }
    },[loanVaultService]); // Re-run when service becomes available

    // computed totals when we have a loan
    const principalKRSI = loan ? Number(loan.principal_wei)/1_000_000 : 0;
    const aprPct = loan ? Number(loan.interest_bps || 0)/100 : Number(interestBps||0);
    const termDays = loan ? Number(loan.duration_days||0) : Number(durationDays||0);
    const interestKRSI = loan ? (principalKRSI * (aprPct/100) * (termDays/365)) : (Number(principal||0) * (Number(interestBps||0)/100) * (Number(durationDays||0)/365));
    const totalPayableKRSI = loan ? (principalKRSI + interestKRSI) : (Number(principal||0) + interestKRSI);
    const endsOn = loan ? (()=>{ const d = new Date(loan.created_at || Date.now()); d.setUTCDate(d.getUTCDate() + (Number(loan.duration_days||0)||0)); return d.toISOString().slice(0,10); })() : null;

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Loans</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">Borrow from the liquidity pool and repay as you earn.</p>
            </div>
            {err && <div className="mb-4 p-3 rounded bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 whitespace-pre-line">{err}</div>}
            {msg && <div className="mb-4 p-3 rounded bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300">{msg}</div>}
            
            {/* Transaction Status */}
            <TransactionStatus
                txHash={txStatus?.txHash}
                status={txStatus?.status}
                type={txStatus?.type}
                onConfirmed={() => {
                    setTxStatus(null);
                    loadActive();
                    loadRepaid();
                }}
            />
            {txStatus?.loanId && (
                <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
                    <div className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>Loan ID:</strong> {txStatus.loanId}
                    </div>
                </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Create Loan</h2>
                    <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">Principal (KRSI)</label>
                    <input 
                        value={principal} 
                        onChange={(e) => setPrincipal(e.target.value)} 
                        placeholder="e.g. 500"
                        inputMode="decimal"
                        className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500" 
                    />
                    <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                            <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">Term (days)</label>
                            <input value={durationDays} onChange={(e)=>setDurationDays(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700"/>
                        </div>
                        <div>
                            <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">Interest (%)</label>
                            <div className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                                8% (Fixed - DAO controlled)
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                        <div>
                            <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300">Category</label>
                            <select value={category} onChange={(e)=>setCategory(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700 text-gray-800 dark:text-gray-100">
                                <option value="operations">Operations</option>
                                <option value="machinery">Machinery</option>
                                <option value="land">Land</option>
                                <option value="storage">Storage</option>
                                <option value="marketing">Marketing</option>
                                <option value="expansion">Expansion</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                <input type="checkbox" checked={isAgri} onChange={(e)=>setIsAgri(e.target.checked)} className="form-checkbox"/>
                                Agriculture eligible
                            </label>
                        </div>
                    </div>
                    <label className="block text-sm mb-1 text-gray-600 dark:text-gray-300 mt-3">Purpose / Reason (optional)</label>
                    <textarea value={reason} onChange={(e)=>setReason(e.target.value)} rows={3} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700"/>
                    <button 
                        onClick={createLoan} 
                        disabled={isCreating}
                        className="mt-3 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg transition"
                    >
                        {isCreating ? 'Creating…' : 'Create'}
                    </button>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Preview: approx {Math.max(1, Math.ceil((Number(durationDays||0))/30))} monthly installments; interest 8% APR (fixed).
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Repay Loan</h2>
                    {!loan ? (
                        <p className="text-gray-500">No active loan yet.</p>
                    ) : (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Loan ID</div>
                                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                        DB: {loan.id}
                                        {(loan.loanvault_loan_id || loan.on_chain_loan_id) ? (
                                            <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-mono">
                                                On-chain: {loan.loanvault_loan_id || loan.on_chain_loan_id}
                                            </span>
                                        ) : (
                                            <span className="ml-2 text-xs text-red-600 dark:text-red-400">
                                                ⚠️ No on-chain ID
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Principal</div>
                                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{(Number(loan.principal_wei)/1_000_000).toLocaleString()} KRSI</div>
                                </div>
                                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Status</div>
                                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{loan.status}</div>
                                </div>
                            </div>
                            {walletAddress && (
                                <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700">
                                    <div className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                                        <strong>🔍 Debug & Verification:</strong>
                                    </div>
                                    <div className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
                                        <div>Your Wallet: <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">{walletAddress}</code></div>
                                        {!(loan.loanvault_loan_id || loan.on_chain_loan_id) && loan.tx_hash && (
                                            <button
                                                onClick={async () => {
                                                    if (!loanVaultService || !loan.tx_hash) return;
                                                    try {
                                                        toast.loading('Extracting loan ID from transaction...', { id: 'sync-loan-id' });
                                                        const loanId = await loanVaultService.getLoanIdFromTxHash(loan.tx_hash);
                                                        if (loanId) {
                                                            // Update database
                                                            await api(`/loans/${loan.id}/sync-loan-id`, {
                                                                method: 'POST',
                                                                body: { loanvaultLoanId: loanId }
                                                            });
                                                            setLoan({ ...loan, loanvault_loan_id: loanId, on_chain_loan_id: loanId });
                                                            toast.success(`Synced loan ID: ${loanId}`, { id: 'sync-loan-id' });
                                                        } else {
                                                            toast.error('Could not find loan ID in transaction', { id: 'sync-loan-id' });
                                                        }
                                                    } catch (err) {
                                                        toast.error(`Failed to sync: ${err.message}`, { id: 'sync-loan-id' });
                                                    }
                                                }}
                                                className="mt-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                                            >
                                                🔄 Sync Loan ID from Transaction
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.preventDefault();
                                                syncLoansFromBlockchain().catch(err => {
                                                    // Sync error (non-critical)
                                                });
                                            }}
                                            className="mt-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded"
                                        >
                                            🔍 Check My On-Chain Loans
                                        </button>
                                        <div className="mt-2 text-gray-600 dark:text-gray-400 text-xs">
                                            {loan.tx_hash && (
                                                <div>TX: <a href={`https://sepolia.etherscan.io/tx/${loan.tx_hash}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{loan.tx_hash.substring(0, 16)}...</a></div>
                                            )}
                                            {loan.loanvault_loan_id || loan.on_chain_loan_id ? (
                                                <div className="text-green-600">✅ On-chain loan ID linked</div>
                                            ) : (
                                                <div className="text-red-600">⚠️ Missing on-chain loan ID</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Ends On</div>
                                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{endsOn || '—'}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Delinquent</div>
                                    <div className={`text-sm font-semibold ${loan.delinquent ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>{loan.delinquent ? 'Yes' : 'No'}</div>
                                </div>
                                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Estimated Interest</div>
                                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{interestKRSI.toFixed(6)} KRSI</div>
                                </div>
                                <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Total Payable</div>
                                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{totalPayableKRSI.toFixed(6)} KRSI</div>
                                </div>
                            </div>
                            {loan && loan.status !== 'repaid' && (
                                <>
                                    <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700">
                                        <div className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
                                            Repayment Information
                                        </div>
                                        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                                            <div>• The contract will calculate the full repayment amount (principal + interest)</div>
                                            <div>• You need to have enough KRSI tokens in your wallet</div>
                                            <div>• Repayment will transfer tokens from your wallet to the LoanVault contract</div>
                                            <div>• Total payable: ~{totalPayableKRSI.toFixed(2)} KRSI (principal + interest)</div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={repay} 
                                        disabled={isRepaying || !loanVaultService}
                                        className="mt-3 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-lg transition w-full"
                                    >
                                        {isRepaying ? 'Processing Repayment…' : loanVaultService ? 'Repay Full Amount (Principal + Interest)' : 'Wallet not ready'}
                                    </button>
                                    {!loanVaultService && (
                                        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                            Waiting for wallet to initialize...
                                        </div>
                                    )}
                                </>
                            )}
                            {loan && loan.status === 'repaid' && (
                                <div className="mt-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700">
                                    <div className="text-sm font-semibold text-green-900 dark:text-green-100">
                                        ✅ Loan Fully Repaid
                                    </div>
                                    <div className="text-xs text-green-700 dark:text-green-300 mt-1">
                                        This loan has been fully repaid on the blockchain.
                                    </div>
                                </div>
                            )}
                            <div className="mt-6 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/40">
                                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Streaming Repayments</div>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                                    <div className="md:col-span-2">
                                        <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Rate (KRSI/day)</label>
                                        <input value={streamRate} onChange={(e)=>setStreamRate(e.target.value)} placeholder="e.g. 5" className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 dark:bg-gray-700" />
                                    </div>
                                    <button onClick={async()=>{ try{ const weiPerSec = Math.round((Number(streamRate||0))*1_000_000/86400); await api(`/loans/${loan.id}/stream/start`, { method:'POST', body:{ rateWeiPerSec: String(weiPerSec) } }); setStreaming(true); setMsg('Streaming started'); } catch(e){ setErr(e.message);} }} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded">Start</button>
                                    <button onClick={async()=>{ try{ await api(`/loans/${loan.id}/stream/stop`, { method:'POST', body:{} }); setStreaming(false); setMsg('Streaming stopped'); } catch(e){ setErr(e.message);} }} className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded">Stop</button>
                                </div>
                                <div className="mt-2 text-xs text-gray-600 dark:text-gray-300">Click Accrue Streams in Admin tools (or we can schedule) to apply streamed repayments.</div>
                            </div>
                            <div className="mt-3">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Repayment</h3>
                                    <button onClick={()=>loadSchedule(loan.id)} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Refresh</button>
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">No fixed due dates. Repay any amount, anytime before the end date.</div>
                                {schedule.length > 0 && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-gray-500">
                                                    <th className="py-2">Planned Date</th>
                                                    <th className="py-2">Planned Amount</th>
                                                    <th className="py-2">Paid</th>
                                                    <th className="py-2">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {schedule.map((p)=> (
                                                    <tr key={p.id} className="border-t border-gray-200 dark:border-gray-700">
                                                        <td className="py-2">{p.due_date}</td>
                                                        <td className="py-2">{(Number(p.amount_wei)/1_000_000).toLocaleString()} KRSI</td>
                                                        <td className="py-2">{(Number(p.paid_wei)/1_000_000).toLocaleString()} KRSI</td>
                                                        <td className="py-2">
                                                            <span className={`px-2 py-1 rounded text-xs ${p.status==='paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : p.status==='partial' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200'}`}>{p.status}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                            <div className="mt-3">
                                <button onClick={async()=>{ try{ const r = await api('/loans/stream/accrue', { method:'POST', body:{} }); setMsg(`Streams accrued ${(Number(r.accruedWei||0)/1_000_000).toLocaleString()} KRSI`); await loadSchedule(loan.id);} catch(e){ setErr(e.message);} }} className="text-xs px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-700 text-white">Accrue Streams (demo)</button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Active loans list */}
            <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow p-6">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Active Loans</h2>
                    <button onClick={loadActive} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Refresh</button>
                </div>
                {activeLoans.length === 0 ? (
                    <div className="text-sm text-gray-500">No active loans.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {activeLoans.map(al => {
                            const p = Number(al.principal_wei)/1_000_000;
                            const repaid = Number(al.repaid_wei)/1_000_000;
                            const remaining = Math.max(p - repaid, 0).toFixed(6);
                            const apr = (Number(al.interest_bps||0)/100).toFixed(2);
                            const hasOnChainId = al.loanvault_loan_id || al.on_chain_loan_id;
                            return (
                                <button key={al.id} onClick={async()=>{ 
                                    setLoan(al); 
                                    await loadSchedule(al.id);
                                    // Sync loans from blockchain when selecting a loan
                                    if (loanVaultService && walletAddress) {
                                        setTimeout(syncLoansFromBlockchain, 500);
                                    }
                                }} className="text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 hover:bg-gray-100 dark:hover:bg-gray-700 transition">
                                    <div className="flex items-center justify-between">
                                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                                            Loan #{al.id}
                                            {hasOnChainId ? (
                                                <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-mono">
                                                    (On-chain: {al.loanvault_loan_id || al.on_chain_loan_id})
                                                </span>
                                            ) : (
                                                <span className="ml-2 text-xs text-yellow-600 dark:text-yellow-400">
                                                    ⚠️ Not synced
                                                </span>
                                            )}
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded ${al.delinquent ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>{al.delinquent ? 'delinquent' : 'on track'}</span>
                                    </div>
                                    <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">Principal {p.toLocaleString()} KRSI • APR {apr}% • Term {al.duration_days}d</div>
                                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">Remaining {remaining} KRSI • Next {al.next_due_date || '—'}</div>
                                    {al.tx_hash && (
                                        <div className="mt-1 text-xs">
                                            <a 
                                                href={`https://sepolia.etherscan.io/tx/${al.tx_hash}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                onClick={(e) => e.stopPropagation()}
                                                className="text-blue-600 dark:text-blue-400 hover:underline"
                                            >
                                                View on Etherscan →
                                            </a>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Paid/Repaid loans list */}
            <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow p-6">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Paid Loans</h2>
                    <button onClick={loadRepaid} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Refresh</button>
                </div>
                {repaidLoans.length === 0 ? (
                    <div className="text-sm text-gray-500">No repaid loans yet.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {repaidLoans.map(rl => {
                            const p = Number(rl.principal_wei)/1_000_000;
                            const repaid = Number(rl.repaid_wei)/1_000_000;
                            const apr = (Number(rl.interest_bps||0)/100).toFixed(2);
                            const hasOnChainId = rl.loanvault_loan_id || rl.on_chain_loan_id;
                            const repaidDate = rl.repaid_at ? new Date(rl.repaid_at).toLocaleDateString() : 
                                              (rl.created_at ? new Date(rl.created_at).toLocaleDateString() : '—');
                            return (
                                <div key={rl.id} className="text-left p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                                    <div className="flex items-center justify-between">
                                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                                            Loan #{rl.id}
                                            {hasOnChainId && (
                                                <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-mono">
                                                    (On-chain: {rl.loanvault_loan_id || rl.on_chain_loan_id})
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Paid</span>
                                    </div>
                                    <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">Principal {p.toLocaleString()} KRSI • APR {apr}% • Term {rl.duration_days}d</div>
                                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">Repaid: {repaid.toFixed(6)} KRSI • Paid on {repaidDate}</div>
                                    {(rl.tx_hash || rl.repayment_tx_hash) && (
                                        <div className="mt-1 text-xs">
                                            <a 
                                                href={`https://sepolia.etherscan.io/tx/${rl.repayment_tx_hash || rl.tx_hash}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-blue-600 dark:text-blue-400 hover:underline"
                                            >
                                                View Repayment on Etherscan →
                                            </a>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
