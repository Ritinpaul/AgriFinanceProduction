import React, { useEffect, useState } from 'react';
import { useWeb3 } from '../context/Web3Context';
import LoanVaultService from '../services/loanVaultService';
import inAppWalletService from '../services/inAppWalletService';
import FaucetRequestForm from '../components/FaucetRequestForm';
import TransactionStatus from '../components/TransactionStatus';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';
import { getUserFriendlyError, isUserRejection } from '../utils/errorMessages';
import { estimateGasCost, formatGasEstimation } from '../utils/gasEstimator';
import { FaMoneyBillWave, FaChartLine, FaPiggyBank, FaUnlock, FaGasPump, FaWallet, FaLeaf, FaSync, FaArrowDown, FaArrowUp, FaCheckCircle, FaExclamationTriangle } from 'react-icons/fa';

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

export default function Liquidity() {
	const { contracts, signer, account, isConnected, walletType, inAppWallet } = useWeb3();
	const [loanVaultService, setLoanVaultService] = useState(null);
	const [pool, setPool] = useState(null);
	const [amount, setAmount] = useState('50');
	const [withdrawAmt, setWithdrawAmt] = useState('');
	const [loading, setLoading] = useState(false);
	const [msg, setMsg] = useState('');
	const [err, setErr] = useState('');
	const [isDepositing, setIsDepositing] = useState(false);
	const [isWithdrawing, setIsWithdrawing] = useState(false);
	const [myTotal, setMyTotal] = useState('0');
	const [strategy, setStrategy] = useState({ name: '', aprBps: 0 });
	const [txStatus, setTxStatus] = useState(null); // { type: 'deposit'|'withdraw', status: 'pending'|'confirmed'|'error', txHash: string }
	const [walletBalance, setWalletBalance] = useState(null); // ETH balance
	const [walletAddress, setWalletAddress] = useState(null);
	const [krishiBalance, setKrishiBalance] = useState(null); // KRSI balance from database
	const [onChainKrishiBalance, setOnChainKrishiBalance] = useState(null); // KRSI balance from blockchain
	const [lastSyncTxHash, setLastSyncTxHash] = useState(null); // Last sync transaction hash
	const [isCheckingBalance, setIsCheckingBalance] = useState(false);

	const load = async () => {
		setLoading(true);
		try {
			const data = await api('/liquidity/pool');
			setPool(data.pool);
			setStrategy({ name: data.pool.strategy_name || '', aprBps: data.pool.strategy_apr_bps || 0 });
			try { const m = await api('/liquidity/my'); setMyTotal(m.totalDepositedWei || '0'); } catch { }
		} catch (e) {
			setErr(e.message);
		} finally {
			setLoading(false);
		}
	};

	// Initialize LoanVault service when contracts are ready
	// IMPORTANT: Always use in-app wallet signer, never MetaMask
	useEffect(() => {
		let isMounted = true; // Track if component is still mounted

		const initLoanVaultService = async () => {
			// Contract addresses (use environment variables or new deployed addresses)
			const contractAddresses = {
				krishiToken: import.meta.env.VITE_KRSI_CONTRACT_ADDRESS || "0x41ef54662509D66715C237c6e1d025DBC6a9D8d1",
				loanVault: import.meta.env.VITE_LOAN_VAULT_ADDRESS || "0xb3c84011492b4126337798E53aE5e483FD2933A8" // Fixed contracts with overflow protection
			};

			try {
				// Get wallet from backend API first (this has the actual balance)
				let wallet = null;
				let walletAddress = null;
				let walletBalanceWei = '0';

				try {
					const token = localStorage.getItem('auth_token');
					if (token) {
						const walletRes = await fetch(`${import.meta.env.VITE_API_BASE || ''}/api/wallet`, {
							headers: { 'Authorization': `Bearer ${token}` }
						});
						if (walletRes.ok) {
							const walletData = await walletRes.json();
							if (walletData.wallet && walletData.wallet.address) {
								walletAddress = walletData.wallet.address;
								walletBalanceWei = walletData.wallet.balance_wei || '0';

								// Create wallet from private key if available in metadata
								if (walletData.wallet.metadata && walletData.wallet.metadata.private_key) {
									wallet = new ethers.Wallet(walletData.wallet.metadata.private_key);
								}
							}
						}
					}
				} catch (apiError) {
					// Fallback to in-app wallet
				}

				// Fallback to in-app wallet service if backend wallet not found
				if (!wallet) {
					// Initialize in-app wallet service if needed
					if (!inAppWalletService.isServiceInitialized()) {
						await inAppWalletService.initialize();
					}

					// Get or create in-app wallet
					wallet = inAppWalletService.getWallet();
					if (!wallet) {
						// Generating new wallet
						const result = await inAppWalletService.generateWallet();
						if (!result.success) {
							// Failed to generate wallet
							if (isMounted) {
								setErr(`Failed to create wallet: ${result.error}`);
							}
							return;
						}
						wallet = result.wallet;
					}
					walletAddress = wallet.address;
				}

				// Wallet ready

				// Create provider and signer from in-app wallet
				const provider = new ethers.JsonRpcProvider('https://rpc-amoy.polygon.technology/');
				const inAppSigner = wallet.connect(provider);

				// Check wallet ETH balance (for gas) - with timeout, fail silently
				let balanceEth = '0';
				try {
					const balance = await Promise.race([
						provider.getBalance(walletAddress),
						new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
					]);
					balanceEth = ethers.formatEther(balance);
				} catch {
					// Silently fail - not critical for app functionality
					balanceEth = '0';
				}

				if (isMounted) {
					setWalletBalance(balanceEth);
					setWalletAddress(walletAddress);
					// Store KRSI balance from database for later use
					const krishiBalanceKRSI = Number(walletBalanceWei) / 1_000_000;
					setKrishiBalance(krishiBalanceKRSI);
					// Balance loaded from database
				}

				// CRITICAL: Re-create contracts directly with signer (not provider)
				// This ensures the contract is properly connected to the signer

				// Get contract addresses
				const krishiTokenAddress = contractAddresses?.krishiToken || import.meta.env.VITE_KRSI_CONTRACT_ADDRESS || "0x41ef54662509D66715C237c6e1d025DBC6a9D8d1";
				const loanVaultAddress = contractAddresses?.loanVault || import.meta.env.VITE_LOAN_VAULT_ADDRESS || "0xb3c84011492b4126337798E53aE5e483FD2933A8";

				// Contract ABIs
				const krishiTokenABI = [
					"function balanceOf(address owner) view returns (uint256)",
					"function approve(address spender, uint256 amount) external returns (bool)",
					"function allowance(address owner, address spender) external view returns (uint256)",
					"function transfer(address to, uint256 amount) external returns (bool)"
				];

				const loanVaultABI = [
					"function depositLiquidity(uint256 amount) external",
					"function withdrawLiquidity(uint256 amount) external",
					"function lenders(address) external view returns (address lenderAddress, uint256 totalDeposited, uint256 totalWithdrawn, uint256 lpShares, uint256 lastDepositTime, bool isActive)",
					"function loans(uint256) external view returns (uint256 loanId, address borrower, uint256 amount, uint256 interestRate, uint256 termDays, uint256 collateralValue, uint256 creditScore, uint256 createdAt, uint256 dueDate, bool isActive, bool isRepaid, bool isDefaulted)",
					"function totalLiquidity() external view returns (uint256)",
					"function totalLpShares() external view returns (uint256)",
					"function getDebugInfo(address lender) external view returns (uint256 poolTotalLiquidity, uint256 poolTotalLpShares, uint256 lenderTotalDeposited, uint256 lenderLpShares, bool lenderIsActive, uint256 maxUint256)"
				];

				// Create contracts WITH signer (not provider)
				let loanVaultWithSigner = new ethers.Contract(
					loanVaultAddress,
					loanVaultABI,
					inAppSigner
				);

				let krishiTokenWithSigner = new ethers.Contract(
					krishiTokenAddress,
					krishiTokenABI,
					inAppSigner
				);

				// Verify signer is connected
				const signerAddr = await inAppSigner.getAddress();

				// Verify contracts are properly connected to signer
				try {
					// Verify contract runner (in ethers v6, contracts use "runner" not "signer")
					if (loanVaultWithSigner.runner) {
						const runnerAddr = await loanVaultWithSigner.runner.getAddress();
						if (runnerAddr.toLowerCase() !== signerAddr.toLowerCase()) {
							// Reconnect contract to ensure it uses the correct signer
							loanVaultWithSigner = loanVaultWithSigner.connect(inAppSigner);
							krishiTokenWithSigner = krishiTokenWithSigner.connect(inAppSigner);
						}
					} else {
						loanVaultWithSigner = loanVaultWithSigner.connect(inAppSigner);
						krishiTokenWithSigner = krishiTokenWithSigner.connect(inAppSigner);
					}
				} catch (e) {
					// Try to reconnect contracts silently
					try {
						loanVaultWithSigner = loanVaultWithSigner.connect(inAppSigner);
						krishiTokenWithSigner = krishiTokenWithSigner.connect(inAppSigner);
					} catch (reconnectError) {
						// Silently handle reconnection errors
					}
				}

				// Check if user is a farmer (for gasless transactions)
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
							// Farmer detected - using sponsored transactions
						}
					}
				} catch (e) {
					// Could not check user role
				}

				const service = new LoanVaultService(loanVaultWithSigner, krishiTokenWithSigner, inAppSigner, useSponsored);

				if (isMounted) {
					setLoanVaultService(service);
					setWalletAddress(walletAddress);
					// LoanVault service initialized

					// Check on-chain balance now that contracts are ready
					try {
						const onChainBal = await krishiTokenWithSigner.balanceOf(walletAddress);
						const onChainBalKRSI = Number(onChainBal) / 1_000_000;
						setOnChainKrishiBalance(onChainBalKRSI);
					} catch (e) {
						// Silently handle balance check errors
					}
				}
			} catch (error) {
				// Failed to initialize service
				if (isMounted) {
					setErr(`Failed to initialize wallet: ${error.message}`);
				}
			}
		};

		// Add a small delay to allow contracts to fully initialize
		const timeoutId = setTimeout(() => {
			initLoanVaultService();
		}, 100);

		return () => {
			isMounted = false;
			clearTimeout(timeoutId);
		};
	}, []); // Run once on mount, don't depend on contracts from context

	useEffect(() => {
		load();
		// Also automatically check on-chain balance when page loads
		const checkOnChainBalance = async () => {
			if (loanVaultService && walletAddress) {
				try {
					const balance = await loanVaultService.krishiToken.balanceOf(walletAddress);
					const balanceKRSI = Number(balance) / 1_000_000;
					setOnChainKrishiBalance(balanceKRSI);
					// Balance auto-checked
				} catch (e) {
					// Could not check balance
				}
			}
		};
		// Check after a short delay to ensure contracts are ready
		const timeoutId = setTimeout(checkOnChainBalance, 2000);
		return () => clearTimeout(timeoutId);
	}, [loanVaultService, walletAddress]);

	const deposit = async () => {
		setMsg(''); setErr(''); setTxStatus(null);

		if (!loanVaultService) {
			setErr('LoanVault service not ready. Please wait...');
			toast.error('Wallet not ready');
			return;
		}

		if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
			setErr('Enter a valid positive amount');
			return;
		}

		// Check wallet balance only if not using sponsored transactions
		// (sponsored transactions don't require user to have ETH)
		if (loanVaultService && !loanVaultService.useSponsored && walletBalance !== null && Number(walletBalance) < 0.001) {
			setErr(`Insufficient ETH for gas fees. Your wallet needs at least 0.001 Sepolia ETH. Current balance: ${Number(walletBalance).toFixed(6)} ETH`);
			toast.error('Insufficient ETH for gas. Please fund your wallet first.');
			return;
		}

		setIsDepositing(true);
		setTxStatus({ type: 'deposit', status: 'pending', txHash: null });

		try {
			// Check KRSI balance and sync to blockchain if needed
			const requestedKRSI = parseFloat(amount || '0');
			let balanceKRSI = 0;

			// Get user address from signer (required for all checks)
			let userAddress;
			try {
				userAddress = await loanVaultService.signer.getAddress();
				// Preparing deposit
			} catch (addrError) {
				setErr(`Failed to get wallet address: ${addrError.message}. Please refresh the page.`);
				setIsDepositing(false);
				return;
			}

			try {
				// Get database balance
				const dbBalanceKRSI = krishiBalance !== null ? krishiBalance : 0;

				// Get on-chain balance
				const onChainBalance = await loanVaultService.krishiToken.balanceOf(userAddress);
				const onChainBalanceKRSI = Number(onChainBalance) / 1_000_000;

				// Checking balance sync status

				// If database has more tokens than on-chain, sync them FIRST (CRITICAL STEP)
				if (dbBalanceKRSI > onChainBalanceKRSI) {
					const differenceKRSI = dbBalanceKRSI - onChainBalanceKRSI;
					// Syncing balance before deposit

					toast.loading(`Syncing ${differenceKRSI.toFixed(2)} KRSI to blockchain (required before deposit)...`, { id: 'sync' });

					try {
						const syncRes = await api('/wallet/sync-to-blockchain', { method: 'POST', body: {} });

						if (!syncRes.success) {
							// If sync fails, show clear error and STOP
							const errorMsg = syncRes.error || 'Sync failed';
							// Sync failed
							toast.error(`Sync failed: ${errorMsg}`, { id: 'sync' });

							setErr(
								`❌ Cannot deposit without syncing balance. ` +
								`Database: ${dbBalanceKRSI.toFixed(2)} KRSI, On-chain: ${onChainBalanceKRSI.toFixed(2)} KRSI. ` +
								`Error: ${errorMsg}. ` +
								`Please use the "Sync Balance" button below or contact support.`
							);
							setIsDepositing(false);
							return;
						}

						// Balance sync transaction sent
						toast.loading(`Waiting for sync confirmation (this may take 30-60 seconds)... TX: ${syncRes.txHash?.substring(0, 10)}...`, { id: 'sync' });

						// Wait up to 60 seconds, checking balance periodically (longer wait for minting)
						let confirmed = false;
						let lastCheckedBalance = onChainBalanceKRSI;

						for (let i = 0; i < 30; i++) { // 30 iterations * 2 seconds = 60 seconds max
							await new Promise(resolve => setTimeout(resolve, 2000));

							try {
								const newOnChainBalance = await loanVaultService.krishiToken.balanceOf(userAddress);
								const newOnChainBalanceKRSI = Number(newOnChainBalance) / 1_000_000;
								lastCheckedBalance = newOnChainBalanceKRSI;

								// Success criteria: balance increased to at least what we need
								if (newOnChainBalanceKRSI >= requestedKRSI && newOnChainBalanceKRSI > onChainBalanceKRSI) {
									balanceKRSI = newOnChainBalanceKRSI;
									toast.success(`Balance synced! On-chain: ${balanceKRSI.toFixed(2)} KRSI`, { id: 'sync' });
									confirmed = true;
									break;
								}
							} catch (e) {
								// Balance check failed
							}
						}

						// Final verification
						if (!confirmed) {
							try {
								const finalBalance = await loanVaultService.krishiToken.balanceOf(userAddress);
								const finalBalanceKRSI = Number(finalBalance) / 1_000_000;
								lastCheckedBalance = finalBalanceKRSI;

								if (finalBalanceKRSI >= requestedKRSI) {
									balanceKRSI = finalBalanceKRSI;
									confirmed = true;
								}
							} catch (e) {
								// Final balance check failed
							}
						}

						if (!confirmed) {
							// Sync transaction was sent but balance not updated yet
							setErr(
								`⏳ Sync transaction sent but not confirmed yet. ` +
								`Current on-chain balance: ${lastCheckedBalance.toFixed(2)} KRSI. ` +
								`Please wait 30-60 seconds for the transaction to confirm, then try depositing again. ` +
								`Transaction: ${syncRes.txHash?.substring(0, 16)}...`
							);
							toast.error('Sync pending - please wait and try again in 30-60 seconds', { id: 'sync', duration: 10000 });
							setIsDepositing(false);
							return;
						}
					} catch (syncError) {
						toast.error(`Sync failed: ${syncError.message || 'Unknown error'}`, { id: 'sync' });

						setErr(
							`❌ Cannot deposit: Sync failed. ` +
							`Database: ${dbBalanceKRSI.toFixed(2)} KRSI, On-chain: ${onChainBalanceKRSI.toFixed(2)} KRSI. ` +
							`Error: ${syncError.message || 'Unknown'}. ` +
							`Please use the "Sync Balance" button below or contact support.`
						);
						setIsDepositing(false);
						return;
					}
				} else {
					// Use on-chain balance
					balanceKRSI = onChainBalanceKRSI;
				}

				// Final on-chain balance check BEFORE deposit attempt
				try {
					const finalCheck = await loanVaultService.krishiToken.balanceOf(userAddress);
					const finalCheckKRSI = Number(finalCheck) / 1_000_000;

					if (finalCheckKRSI < requestedKRSI) {
						// Balance still insufficient after sync attempt
						setErr(
							`❌ Insufficient KRSI balance on-chain.\n\n` +
							`Your on-chain balance: ${finalCheckKRSI.toFixed(2)} KRSI\n` +
							`Required for deposit: ${requestedKRSI.toFixed(2)} KRSI\n` +
							`Shortfall: ${(requestedKRSI - finalCheckKRSI).toFixed(2)} KRSI\n\n` +
							`If your database shows ${dbBalanceKRSI.toFixed(2)} KRSI:\n` +
							`1. Use the "Sync Balance" button below to sync\n` +
							`2. Wait 30-60 seconds for blockchain confirmation\n` +
							`3. Refresh the page and try again`
						);
						toast.error(`Need ${requestedKRSI.toFixed(2)} KRSI but only have ${finalCheckKRSI.toFixed(2)} on-chain`, { id: 'balance', duration: 8000 });
						setIsDepositing(false);
						return;
					}

					balanceKRSI = finalCheckKRSI;
				} catch (checkError) {
					// Final balance check failed
					setErr(
						`❌ Could not verify on-chain balance before deposit.\n\n` +
						`Error: ${checkError.message}\n\n` +
						`Please try:\n` +
						`1. Refresh the page\n` +
						`2. Use "Sync Balance" button if database has more tokens\n` +
						`3. Try again in a few moments`
					);
					toast.error('Balance verification failed', { id: 'balance', duration: 8000 });
					setIsDepositing(false);
					return;
				}
			} catch (balanceError) {
				// Balance check error
				setErr(
					`❌ Balance check failed: ${balanceError.message}\n\n` +
					`Please try:\n` +
					`1. Refresh the page\n` +
					`2. Check your database balance\n` +
					`3. Use "Sync Balance" button if needed`
				);
				toast.error('Balance check failed', { id: 'balance', duration: 8000 });
				setIsDepositing(false);
				return;
			}

			// Convert amount to wei for deposit
			const wei = BigInt(Math.floor(requestedKRSI * 1_000_000));

			// Final safety checks before deposit (userAddress is already defined above)
			try {
				// One more balance check using the exact same method the contract will use
				const lastMinuteCheck = await loanVaultService.krishiToken.balanceOf(userAddress);
				const lastMinuteKRSI = Number(lastMinuteCheck) / 1_000_000;
				const lastMinuteBigInt = BigInt(lastMinuteCheck.toString());

				if (lastMinuteBigInt < wei) {
					setErr(
						`❌ Insufficient balance for deposit!\n\n` +
						`Your on-chain balance: ${lastMinuteKRSI.toFixed(2)} KRSI\n` +
						`Required for deposit: ${requestedKRSI.toFixed(2)} KRSI\n` +
						`Shortfall: ${(requestedKRSI - lastMinuteKRSI).toFixed(2)} KRSI\n\n` +
						`Please:\n` +
						`1. Check your on-chain balance using the "Check On-Chain Balance" button\n` +
						`2. If it's less than ${requestedKRSI.toFixed(2)} KRSI, sync your balance\n` +
						`3. Wait for sync to confirm, then try again`
					);
					toast.error(`Need ${requestedKRSI.toFixed(2)} KRSI but only have ${lastMinuteKRSI.toFixed(2)}`, { id: 'balance', duration: 10000 });
					setIsDepositing(false);
					return;
				}

			} catch (lastCheckError) {
				// Final verification failed
				setErr(
					`❌ Failed to verify balance before deposit: ${lastCheckError.message}\n\n` +
					`Please refresh the page and try again.`
				);
				toast.error('Balance verification failed', { id: 'balance', duration: 8000 });
				setIsDepositing(false);
				return;
			}

			// Check if this is the first time approving (user needs to pay gas once)
			try {
				const loanVaultAddress = await loanVaultService.loanVault.getAddress();
				const currentAllowance = await loanVaultService.krishiToken.allowance(userAddress, loanVaultAddress);
				const requestedAmount = BigInt(wei);

				if (currentAllowance < requestedAmount && loanVaultService?.useSponsored) {
					toast.loading(
						'First time approval required - you\'ll pay gas once, then all deposits will be gasless!',
						{ id: 'approve', duration: 5000 }
					);
				} else {
					toast.loading('Processing deposit...', { id: 'approve' });
				}
			} catch (e) {
				toast.loading('Processing deposit...', { id: 'approve' });
			}

			// Attempt deposit - depositLiquidity will do its own balance check as well
			let result;
			try {
				result = await loanVaultService.depositLiquidity(wei);
			} catch (depositError) {

				// Check if user rejected
				if (isUserRejection(depositError)) {
					setTxStatus(null);
					setIsDepositing(false);
					return;
				}

				const friendlyError = getUserFriendlyError(depositError);
				setErr(friendlyError);
				toast.error(friendlyError, { id: 'deposit', duration: 8000 });
				setTxStatus({ type: 'deposit', status: 'error', txHash: null, error: friendlyError });
				setIsDepositing(false);
				return;
			}

			setTxStatus({ type: 'deposit', status: 'confirmed', txHash: result.txHash });
			toast.success('Deposit successful!', { id: 'approve' });

			setMsg(`Deposit successful! Transaction: ${result.txHash.substring(0, 10)}...`);

			// Wait a moment for transaction to be confirmed on-chain
			await new Promise(resolve => setTimeout(resolve, 2000));

			// Sync to backend database (updates wallet balance from blockchain AND pool total)
			try {
				const syncResult = await api('/liquidity/deposit', { method: 'POST', body: { amountWei: wei.toString(), txHash: result.txHash } });
				// Backend sync completed
				if (syncResult.balanceUpdated) {
					// Refresh wallet balance display
					const updatedBalance = Number(syncResult.balanceUpdated) / 1_000_000;
					setKrishiBalance(updatedBalance);
					// Also refresh on-chain balance
					if (loanVaultService && walletAddress) {
						try {
							const onChainBal = await loanVaultService.krishiToken.balanceOf(walletAddress);
							const onChainBalKRSI = Number(onChainBal) / 1_000_000;
							setOnChainKrishiBalance(onChainBalKRSI);
						} catch (e) {
							// Could not refresh balance
						}
					}
				}
			} catch (syncErr) {
				// Backend sync failed
				toast.error('Deposit successful but balance sync failed. Please refresh the page.', { duration: 5000 });
			}

			// CRITICAL: Refresh pool data AFTER backend sync (so it gets blockchain-synced value)
			// The /api/liquidity/pool endpoint now syncs from blockchain, so this will show correct total
			await load();

			// Also refresh user's deposited amount
			try {
				const myData = await api('/liquidity/my');
				if (myData.totalDepositedWei) {
					setMyTotal(myData.totalDepositedWei);
				}
			} catch (e) {
				// Could not refresh deposit info
			}

			setAmount(''); // Clear input
		} catch (e) {
			const errorMsg = e.message || 'Deposit failed';
			setErr(errorMsg);
			setTxStatus({ type: 'deposit', status: 'error', txHash: null, error: errorMsg });
			toast.error(errorMsg, { id: 'approve' });
		} finally {
			setIsDepositing(false);
		}
	};

	const withdraw = async () => {
		setMsg(''); setErr(''); setTxStatus(null);

		if (!loanVaultService) {
			setErr('LoanVault service not ready. Please wait...');
			toast.error('Wallet not ready');
			return;
		}

		if (!withdrawAmt || isNaN(Number(withdrawAmt)) || Number(withdrawAmt) <= 0) {
			setErr('Enter a valid withdraw amount');
			return;
		}

		// Check wallet balance only if not using sponsored transactions
		if (loanVaultService && !loanVaultService.useSponsored && walletBalance !== null && Number(walletBalance) < 0.001) {
			setErr(`Insufficient ETH for gas fees. Your wallet needs at least 0.001 Sepolia ETH. Current balance: ${Number(walletBalance).toFixed(6)} ETH`);
			toast.error('Insufficient ETH for gas. Please fund your wallet first.');
			return;
		}

		setIsWithdrawing(true);
		setTxStatus({ type: 'withdraw', status: 'pending', txHash: null });

		try {
			const wei = (parseFloat(withdrawAmt || '0') * 1_000_000).toFixed(0);

			// Show gas estimation if available
			try {
				const provider = loanVaultService.signer.provider;
				if (provider) {
					const gasEstimation = await estimateGasCost(
						provider,
						loanVaultService.loanVault,
						'withdrawLiquidity',
						[BigInt(wei)]
					);
				}
			} catch (gasErr) {
				// Gas estimation is optional, don't fail on it
			}

			toast.loading('Processing withdrawal...', { id: 'withdraw' });
			const result = await loanVaultService.withdrawLiquidity(wei);

			setTxStatus({ type: 'withdraw', status: 'confirmed', txHash: result.txHash });
			toast.success('Withdrawal successful!', { id: 'withdraw' });

			setMsg(`Withdraw successful! Transaction: ${result.txHash.substring(0, 10)}...`);

			// Wait a moment for transaction to be confirmed on-chain
			await new Promise(resolve => setTimeout(resolve, 2000));

			// Sync to backend (updates wallet balance from blockchain AND pool total)
			try {
				const syncResult = await api('/liquidity/withdraw', { method: 'POST', body: { amountWei: wei.toString(), txHash: result.txHash } });
				// Backend sync completed
				if (syncResult.balanceUpdated) {
					// Refresh wallet balance display
					const updatedBalance = Number(syncResult.balanceUpdated) / 1_000_000;
					setKrishiBalance(updatedBalance);
					// Also refresh on-chain balance
					if (loanVaultService && walletAddress) {
						try {
							const onChainBal = await loanVaultService.krishiToken.balanceOf(walletAddress);
							const onChainBalKRSI = Number(onChainBal) / 1_000_000;
							setOnChainKrishiBalance(onChainBalKRSI);
						} catch (e) {
							// Could not refresh balance
						}
					}
				}
			} catch (syncErr) {
				// Backend sync failed
				toast.error('Withdrawal successful but balance sync failed. Please refresh the page.', { duration: 5000 });
			}

			// CRITICAL: Refresh pool data AFTER backend sync (so it gets blockchain-synced value)
			// The /api/liquidity/pool endpoint now syncs from blockchain, so this will show correct total
			await load();

			// Also refresh user's deposited amount
			try {
				const myData = await api('/liquidity/my');
				if (myData.totalDepositedWei) {
					setMyTotal(myData.totalDepositedWei);
				}
			} catch (e) {
				// Could not refresh deposit info
			}

			setWithdrawAmt(''); // Clear input
		} catch (e) {
			const errorMsg = e.message || 'Withdrawal failed';
			setErr(errorMsg);
			setTxStatus({ type: 'withdraw', status: 'error', txHash: null, error: errorMsg });
			toast.error(errorMsg, { id: 'withdraw' });
		} finally {
			setIsWithdrawing(false);
		}
	};

	const seedDemo = async () => {
		setMsg(''); setErr('');
		try {
			const data = await api('/admin/seed-liquidity', { method: 'POST', body: {} });
			setMsg('Seeded demo liquidity');
			setPool(data.pool);
			const m = await api('/liquidity/my'); setMyTotal(m.totalDepositedWei || '0');
		} catch (e) { setErr(e.message); }
	};

	const saveStrategy = async () => {
		setMsg(''); setErr('');
		try {
			const r = await api('/liquidity/strategy', { method: 'POST', body: { name: strategy.name, aprBps: Number(strategy.aprBps) || 0 } });
			setPool(r.pool);
			setStrategy({ name: r.pool.strategy_name || '', aprBps: r.pool.strategy_apr_bps || 0 });
			setMsg('Strategy saved');
		} catch (e) { setErr(e.message); }
	};

	const accrue = async () => {
		setMsg(''); setErr('');
		try {
			const r = await api('/liquidity/accrue', { method: 'POST', body: {} });
			setPool(r.pool);
			setMsg(`Accrued ${(Number(r.accruedWei || 0) / 1_000_000).toLocaleString()} KRSI`);
		} catch (e) { setErr(e.message); }
	};

	const [activeTab, setActiveTab] = useState('deposit');

	return (
		<div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
			<div className="mb-8">
				<h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Liquidity Pool</h1>
				<p className="text-lg text-gray-600 dark:text-gray-400 mt-2">Earn APY by providing liquidity to the protocol.</p>
			</div>

			{err && (
				<div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
					<div className="flex items-center gap-3">
						<span className="text-red-600 text-xl">⚠️</span>
						<div className="text-red-700 dark:text-red-300 font-medium whitespace-pre-line">{err}</div>
					</div>
				</div>
			)}
			{msg && <div className="mb-6 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 font-medium flex items-center gap-3"><span className="text-xl">✅</span>{msg}</div>}

			{/* Transaction Status Overlay */}
			<TransactionStatus
				txHash={txStatus?.txHash}
				status={txStatus?.status}
				type={txStatus?.type}
				onConfirmed={() => {
					setTxStatus(null);
					load();
				}}
			/>

			{!loanVaultService && (
				<div className="mb-8 p-6 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/50 animate-pulse">
					<div className="flex items-center gap-4">
						<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
						<div>
							<p className="text-blue-900 dark:text-blue-100 text-base font-semibold">
								Connecting to LoanVault...
							</p>
							<p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
								Initializing secure wallet connection
							</p>
						</div>
					</div>
				</div>
			)}

			{/* Top Stats Row */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
				<div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden group hover:border-blue-500/50 transition-all duration-300">
					<div className="absolute top-0 right-0 p-4 opacity-30 group-hover:opacity-40 transition-opacity text-blue-500">
						<FaMoneyBillWave size={40} />
					</div>
					<div className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Liquidity</div>
					<div className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
						{pool ? (Number(pool.total_deposits_wei) / 1_000_000).toLocaleString() : '0'} <span className="text-sm font-normal text-gray-500">KRSI</span>
					</div>
				</div>

				<div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden group hover:border-green-500/50 transition-all duration-300">
					<div className="absolute top-0 right-0 p-4 opacity-30 group-hover:opacity-40 transition-opacity text-green-500">
						<FaChartLine size={40} />
					</div>
					<div className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">APY</div>
					<div className="mt-2 text-2xl font-bold text-green-600 dark:text-green-400">
						{pool ? (pool.apy_bps / 100).toFixed(2) : '0.00'}%
					</div>
				</div>

				<div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden group hover:border-purple-500/50 transition-all duration-300">
					<div className="absolute top-0 right-0 p-4 opacity-30 group-hover:opacity-40 transition-opacity text-purple-500">
						<FaPiggyBank size={40} />
					</div>
					<div className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Your Deposits</div>
					<div className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
						{(Number(myTotal) / 1_000_000).toLocaleString()} <span className="text-sm font-normal text-gray-500">KRSI</span>
					</div>
				</div>

				<div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden group hover:border-orange-500/50 transition-all duration-300">
					<div className="absolute top-0 right-0 p-4 opacity-30 group-hover:opacity-40 transition-opacity text-orange-500">
						<FaUnlock size={40} />
					</div>
					<div className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Available</div>
					<div className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
						{pool ? ((Number(pool.total_deposits_wei) - Number(pool.total_borrows_wei)) / 1_000_000).toLocaleString() : '0'} <span className="text-sm font-normal text-gray-500">KRSI</span>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
				{/* Main Column: Actions */}
				<div className="lg:col-span-2 space-y-6">
					<div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
						<div className="border-b border-gray-200 dark:border-gray-700">
							<nav className="flex -mb-px">
								<button
									onClick={() => setActiveTab('deposit')}
									className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-base transition-colors duration-200 ${activeTab === 'deposit'
										? 'border-green-500 text-green-600 dark:text-green-400 bg-green-50/50 dark:bg-green-900/10'
										: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
										}`}
								>
									📥 Deposit Liquidity
								</button>
								<button
									onClick={() => setActiveTab('withdraw')}
									className={`w-1/2 py-4 px-1 text-center border-b-2 font-medium text-base transition-colors duration-200 ${activeTab === 'withdraw'
										? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
										: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
										}`}
								>
									📤 Withdraw Liquidity
								</button>
							</nav>
						</div>

						<div className="p-8">
							{activeTab === 'deposit' ? (
								<div className="space-y-6">
									<div className="flex justify-between items-center mb-2">
										<label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
											Amount to Deposit
										</label>
										<div className="text-xs text-gray-500 dark:text-gray-400">
											Wallet: {krishiBalance ? krishiBalance.toFixed(2) : '-'} KRSI
										</div>
									</div>

									<div className="relative">
										<input
											value={amount}
											onChange={(e) => setAmount(e.target.value)}
											placeholder="e.g. 500"
											inputMode="decimal"
											className="block w-full text-lg border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700/50 py-4 pl-4 pr-16 focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500 transition-all text-gray-900 dark:text-white shadow-sm"
										/>
										<div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">KRSI</div>
									</div>

									{/* Balance Alerts Inline */}
									{Math.abs((krishiBalance || 0) - (onChainKrishiBalance || 0)) > 0.01 && (
										<div className={`p-4 rounded-xl text-sm flex items-start gap-3 ${(krishiBalance || 0) > (onChainKrishiBalance || 0)
											? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
											: 'bg-red-50 text-red-800 border border-red-200'
											}`}>
											<FaExclamationTriangle className="text-lg mt-0.5" />
											<div className="flex-1">
												<div className="font-semibold">Balance Mismatch Detected</div>
												<div className="mt-1">
													Database: <span className="font-mono font-medium">{krishiBalance?.toFixed(2)}</span> |
													On-Chain: <span className="font-mono font-medium">{onChainKrishiBalance?.toFixed(2)}</span>
												</div>
												{(krishiBalance || 0) > (onChainKrishiBalance || 0) && (
													<button
														onClick={async () => {
															toast.loading('Syncing...', { id: 'inline-sync' });
															await api('/wallet/sync-to-blockchain', { method: 'POST', body: {} });
															toast.success('Sync started! Refreshing...', { id: 'inline-sync' });
															// Wait for minting to likely complete then reload
															setTimeout(() => window.location.reload(), 3000);
														}}
														className="mt-2 text-xs bg-white/50 hover:bg-white/80 px-3 py-1.5 rounded-lg border border-yellow-300 font-medium transition-colors"
													>
														Sync to Blockchain
													</button>
												)}
											</div>
										</div>
									)}

									<button
										onClick={deposit}
										disabled={isDepositing}
										className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-green-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
									>
										{isDepositing ? (
											<span className="flex items-center justify-center gap-2">
												<svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
												Processing Deposit...
											</span>
										) : 'Deposit Liquidity'}
									</button>
									<p className="text-center text-sm text-gray-500">
										Your deposit will immediately start earning interest.
									</p>
								</div>
							) : (
								<div className="space-y-6">
									<div className="flex justify-between items-center mb-2">
										<label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
											Amount to Withdraw
										</label>
										<div className="text-xs text-gray-500 dark:text-gray-400">
											Deposited: {(Number(myTotal) / 1_000_000).toLocaleString()} KRSI
										</div>
									</div>

									<div className="relative">
										<input
											value={withdrawAmt}
											onChange={(e) => setWithdrawAmt(e.target.value)}
											placeholder="e.g. 100"
											inputMode="decimal"
											className="block w-full text-lg border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700/50 py-4 pl-4 pr-16 focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500 transition-all text-gray-900 dark:text-white shadow-sm"
										/>
										<div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-medium">KRSI</div>
									</div>

									<button
										onClick={withdraw}
										disabled={isWithdrawing}
										className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white rounded-xl font-bold text-lg shadow-lg hover:shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
									>
										{isWithdrawing ? (
											<span className="flex items-center justify-center gap-2">
												<svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
												Processing Withdrawal...
											</span>
										) : 'Withdraw Liquidity'}
									</button>
									<p className="text-center text-sm text-gray-500">
										Funds will be returned to your wallet immediately.
									</p>
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Sidebar */}
				<div className="space-y-6">
					{/* Wallet Card */}
					{walletAddress && (
						<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow p-5">
							<h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
								Wallet Status
							</h3>

							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<span className="text-sm text-gray-600 dark:text-gray-300">Mode</span>
									{loanVaultService?.useSponsored ? (
										<span className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs font-bold flex items-center gap-1">
											<FaLeaf className="text-green-500" /> Gasless
										</span>
									) : (
										<span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-xs font-medium">Standard</span>
									)}
								</div>

								<div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
									<div className="text-xs text-gray-500 uppercase">Connected As</div>
									<div className="flex items-center gap-2 mt-1">
										<span className="font-mono text-sm font-medium text-gray-800 dark:text-gray-200">
											{walletAddress.substring(0, 6)}...{walletAddress.substring(walletAddress.length - 4)}
										</span>
										<button
											onClick={() => {
												navigator.clipboard.writeText(walletAddress);
												toast.success('Address copied!');
											}}
											className="text-gray-400 hover:text-gray-600"
										>
											📋
										</button>
									</div>
									<div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
										<div className="text-xs text-gray-500">GAS (ETH)</div>
										<div className={`text-sm font-medium ${Number(walletBalance) < 0.001 ? 'text-red-500' : 'text-gray-700 dark:text-gray-300'}`}>
											{Number(walletBalance || 0).toFixed(4)} ETH
										</div>
									</div>
								</div>

								{Number(walletBalance || 0) < 0.001 && (
									<div className="text-xs text-red-600 bg-red-50 p-2 rounded">
										Low ETH! Get standard Sepolia ETH for first approval.
										<div className="mt-2">
											<FaucetRequestForm
												walletAddress={walletAddress}
												onSuccess={() => { }}
												compact={true}
											/>
										</div>
									</div>
								)}

								<button
									onClick={async () => {
										setIsCheckingBalance(true);
										try {
											const balance = await loanVaultService.krishiToken.balanceOf(walletAddress);
											const balanceKRSI = Number(balance) / 1_000_000;
											setOnChainKrishiBalance(balanceKRSI);
											toast.success(`Verified On-Chain: ${balanceKRSI.toFixed(2)} KRSI`, { id: 'check-balance' });
										} catch (error) {
											toast.error('Failed to check');
										} finally {
											setIsCheckingBalance(false);
										}
									}}
									disabled={isCheckingBalance}
									className="w-full py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition"
								>
									{isCheckingBalance ? 'Verifying...' : 'Verify On-Chain Sync'}
								</button>

								<a
									href={`https://sepolia.etherscan.io/address/${walletAddress}#tokentxns`}
									target="_blank"
									rel="noopener noreferrer"
									className="block w-full text-center py-2 text-xs text-blue-600 hover:underline"
								>
									View on Etherscan ↗
								</a>
							</div>
						</div>
					)}

					{/* Admin/Strategy Card */}
					<div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow p-5">
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
								Strategy
							</h3>
							<span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">Active</span>
						</div>

						<div className="space-y-4">
							<div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800">
								<span className="block text-xs text-indigo-600 dark:text-indigo-400 font-semibold uppercase mb-1">Current Pool</span>
								<div className="font-medium text-gray-900 dark:text-gray-100">{strategy.name || 'Standard Pool'}</div>
								<div className="text-2xl font-bold text-indigo-700 dark:text-indigo-400 mt-1">{((Number(strategy.aprBps) || 0) / 100).toFixed(2)}% <span className="text-sm font-normal text-indigo-500">APR</span></div>
							</div>

							<Registry strategy={strategy} setStrategy={setStrategy} />

							<div className="pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-2 gap-3">
								<button onClick={saveStrategy} className="px-3 py-2.5 bg-gray-900 dark:bg-gray-700 text-white text-xs font-medium rounded-lg hover:bg-black dark:hover:bg-gray-600 transition shadow-sm">Update Strategy</button>
								<button onClick={accrue} className="px-3 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-xs font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition shadow-sm">Accrue Yield</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function Registry({ strategy, setStrategy }) {
	const [list, setList] = useState([]);
	useEffect(() => { (async () => { try { const r = await api('/liquidity/strategy/registry'); setList(r.strategies || []); } catch { } })(); }, []);

	return (
		<div>
			<label className="block text-xs font-medium text-gray-500 mb-1">Select Strategy</label>
			<select
				value={strategy.name}
				onChange={(e) => { const s = list.find(x => x.name === e.target.value); setStrategy({ name: e.target.value, aprBps: s ? s.aprBps : strategy.aprBps }); }}
				className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-700 focus:ring-1 focus:ring-indigo-500"
			>
				<option value="">Custom / Manual</option>
				{list.map(s => (<option key={s.name} value={s.name}>{s.name} ({(s.aprBps / 100).toFixed(2)}%)</option>))}
			</select>
		</div>
	);
}
