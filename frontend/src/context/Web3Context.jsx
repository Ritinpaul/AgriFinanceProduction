import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { gaslessClient } from '../utils/gasless';
import { useAccountAbstraction } from './AccountAbstractionContext';
import inAppWalletService from '../services/inAppWalletService';

const Web3Context = createContext();

export const useWeb3 = () => {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};

export const Web3Provider = ({ children }) => {
  // Safely get AccountAbstraction context with fallbacks
  let accountAbstractionData = {
    userRole: null,
    walletChoice: null,
    setUserRoleAndPolicy: () => { },
    setWalletChoiceForUser: () => { },
    getCurrentWalletPolicy: () => null
  };

  try {
    accountAbstractionData = useAccountAbstraction();
  } catch (error) {
    console.warn('AccountAbstraction context not available:', error.message);
  }

  const {
    userRole,
    walletChoice,
    setUserRoleAndPolicy,
    setWalletChoiceForUser,
    getCurrentWalletPolicy
  } = accountAbstractionData;

  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [walletType, setWalletType] = useState(null); // 'inapp' or 'metamask'
  const [inAppWallet, setInAppWallet] = useState(null);
  const walletFetchedRef = useRef(false);
  const [contracts, setContracts] = useState({
    krishiToken: null,
    loanContract: null,
    supplyChain: null,
    nftLand: null,
    creditProtocol: null,
    creditScoreOracle: null,
    batchNFT: null,
    loanVault: null,
    dao: null,
    timelockController: null,
    executionHooks: null,
    governanceToken: null
  });

  // Contract addresses (use environment variables or fallback to new deployed addresses)
  const contractAddresses = {
    krishiToken: import.meta.env.VITE_KRSI_CONTRACT_ADDRESS || "0x41ef54662509D66715C237c6e1d025DBC6a9D8d1", // Fixed: overflow protection
    loanContract: "0x25F20Ce49D6A1a1bf48B76417635E448e002412C", // Sepolia deployment
    supplyChain: "0x2FDf116504b8FB172F6b98363a9047481f59dd8b", // Phase 3 deployment
    nftLand: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9", // Will be updated after deployment
    creditProtocol: "0x24EBB2B67801ae30E96B5dc8A18a5079548714Ae", // Sepolia deployment
    creditScoreOracle: "0x3FeEa5139E867543Ec8Ba2711fA30f58Ce808465", // Sepolia deployment
    batchNFT: "0x36f9d540B32f5b8F5962a3928c1f328d30b71189", // Phase 3 deployment
    loanVault: import.meta.env.VITE_LOAN_VAULT_ADDRESS || "0xb3c84011492b4126337798E53aE5e483FD2933A8", // Fixed: uses new KrishiToken with overflow protection
    dao: "0x7bE793fd39F98bB3c3f04013139066A48482d9ad", // Phase 5 deployment
    timelockController: "0x0000000000000000000000000000000000000000", // Not used in simple governance
    executionHooks: "0xC537436DE76406D89ae79C7fC0f3d8682526e3Dc", // Phase 5 deployment
    governanceToken: "0x0000000000000000000000000000000000000000", // Not used in simple governance
    zkVerifier: "0xB736C3942b1d79A975F9DE29bd9b139F20419a03", // Phase 7 deployment
    landNFTv2: "0xeb757Afe09626855169403cA0BC4322030428232" // Phase 7 deployment
  };

  // Contract ABIs (simplified for demo)
  const contractABIs = {
    krishiToken: [
      "function balanceOf(address owner) view returns (uint256)",
      "function approve(address spender, uint256 amount) external returns (bool)",
      "function allowance(address owner, address spender) external view returns (uint256)",
      "function transfer(address to, uint256 amount) external returns (bool)",
      "function faucetDistribute(address recipient, uint256 amount) external",
      // Staking-related
      "function stake(uint256 amount, uint256 lockPeriod) external",
      "function unstake(uint256 stakeIndex) external",
      "function claimRewards() external",
      "function calculateStakingReward(address user, uint256 stakeIndex) view returns (uint256)"
    ],
    nftLand: [
      "function ownerOf(uint256 tokenId) view returns (address)",
      "function transferFrom(address from, address to, uint256 tokenId) external",
      "function approve(address to, uint256 tokenId) external",
      "function getApproved(uint256 tokenId) view returns (address)",
      "function mint(address to, uint256 tokenId, string memory tokenURI) external",
      "function setTokenPrice(uint256 tokenId, uint256 price) external",
      "function buyToken(uint256 tokenId) external payable",
      "function tokenPrice(uint256 tokenId) view returns (uint256)",
      "function isForSale(uint256 tokenId) view returns (bool)"
    ],
    loanContract: [
      "function registerLender() external",
      "function createLoan(uint256 _amount, uint256 _duration, string memory _purpose) external returns (uint256)",
      "function fundLoan(uint256 _loanId) external",
      "function repayLoan(uint256 _loanId) external",
      "function getBorrowerCreditScore(address _borrower) external view returns (tuple(uint256 score, uint256 lastUpdated, string source))",
      "function getLoanEligibility(address _borrower) external view returns (bool eligible, uint256 maxAmount, uint256 recommendedRate, string memory reason)",
      "function calculateCreditBasedInterestRate(uint256 _creditScore) external view returns (uint256)",
      "function calculateMaxLoanAmount(uint256 _creditScore) external view returns (uint256)",
      "function getCreditScoreTier(uint256 _score) external view returns (string memory)",
      "function getLoanDetails(uint256 _loanId) external view returns (tuple(uint256 id, address borrower, uint256 amount, uint256 interestRate, uint256 duration, uint256 startTime, uint256 endTime, bool isActive, bool isRepaid, uint256 creditScore, string purpose))",
      "function getBorrowerLoans(address _borrower) external view returns (uint256[] memory)",
      "function calculateRepayment(uint256 _loanId) external view returns (uint256)",
      "event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 interestRate, uint256 duration)",
      "event LoanFunded(uint256 indexed loanId, address indexed lender, uint256 amount)",
      "event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 amount)"
    ],
    supplyChain: [
      "function verifyBatchByQR(string memory qrCodeHash) external view returns (uint256)",
      "function getBatchDetails(uint256 batchId) external view returns (tuple(uint256 id, address farmer, string productType, uint256 quantity, uint256 pricePerUnit, uint256 totalValue, string location, uint256 harvestDate, string certification, bool isVerified, bool isSold, address buyer, uint256 saleTimestamp, string qrCodeHash))",
      "function getBatchTraceability(uint256 batchId) external view returns (address farmer, string productType, string location, uint256 harvestDate, string certification, bool isVerified, address buyer, uint256 saleTimestamp)"
    ],
    creditProtocol: [
      "function getScore(address user) external view returns (tuple(uint256 score, uint256 lastUpdated, string source))",
      "function updateScore(address user, uint256 score, string calldata source) external"
    ],
    creditScoreOracle: [
      "function requestCreditScore(address userAddress) external",
      "function s_lastRequestId() external view returns (bytes32)",
      "function s_lastResponse() external view returns (bytes)",
      "function s_lastError() external view returns (bytes)",
      "event CreditScoreRequested(bytes32 indexed requestId, address indexed user)",
      "event CreditScoreUpdated(bytes32 indexed requestId, address indexed user, uint256 score, string source)"
    ],
    batchNFT: [
      "function createBatch(string memory productType, string memory grade, uint256 quantity, uint256 pricePerUnit, string memory certifications, string memory photos, string memory logs, string memory qrHash) external returns (uint256)",
      "function verifyBatch(uint256 batchId) external",
      "function purchaseBatch(uint256 batchId) external payable",
      "function getBatchDetails(uint256 batchId) external view returns (tuple(uint256 id, address farmer, string productType, string grade, uint256 quantity, uint256 pricePerUnit, string certifications, string photos, string logs, string qrHash, bool isVerified, bool isSold, address buyer, uint256 saleTimestamp))",
      "function getBatchIdByQRHash(string memory qrHash) external view returns (uint256)"
    ],
    loanVault: [
      // Core functions
      "function depositLiquidity(uint256 amount) external",
      "function withdrawLiquidity(uint256 amount) external",
      "function createLoan(uint256 amount, uint256 termDays, uint256 collateralValue) external returns (uint256)",
      "function repayLoan(uint256 loanId) external",
      // View functions
      "function lenders(address) external view returns (address lenderAddress, uint256 totalDeposited, uint256 totalWithdrawn, uint256 lpShares, uint256 lastDepositTime, bool isActive)",
      "function loans(uint256) external view returns (uint256 loanId, address borrower, uint256 amount, uint256 interestRate, uint256 termDays, uint256 collateralValue, uint256 creditScore, uint256 createdAt, uint256 dueDate, bool isActive, bool isRepaid, bool isDefaulted)",
      "function totalLiquidity() external view returns (uint256)",
      "function getDebugInfo(address lender) external view returns (uint256 poolTotalLiquidity, uint256 poolTotalLpShares, uint256 lenderTotalDeposited, uint256 lenderLpShares, bool lenderIsActive, uint256 maxUint256)",
      "function totalLpShares() external view returns (uint256)",
      "function calculateRepaymentAmount(uint256 loanId) external view returns (uint256)",
      // Events
      "event LiquidityDeposited(address indexed lender, uint256 amount, uint256 lpShares)",
      "event LiquidityWithdrawn(address indexed lender, uint256 amount, uint256 lpShares)",
      "event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 interestRate)",
      "event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 amount)"
    ],
    dao: [
      "function createProposal(uint8 proposalType, string memory title, string memory description, address[] memory targets, uint256[] memory values, bytes[] memory calldatas, bool isEmergency) external returns (uint256)",
      "function castVote(uint256 proposalId, uint8 support) external",
      "function executeProposal(uint256 proposalId) external",
      "function getProposal(uint256 proposalId) external view returns (uint256 id, uint8 proposalType, string memory title, string memory description, address proposer, uint256 startTime, uint256 endTime, uint256 forVotes, uint256 againstVotes, uint256 abstainVotes, bool executed, bool isEmergency)",
      "function getProposalState(uint256 proposalId) external view returns (string memory)",
      "function hasVoted(uint256 proposalId, address voter) external view returns (bool)",
      "function updateParameter(string memory parameterName, uint256 newValue, address targetContract) external",
      "function updateVerifier(address verifier, bool isVerified) external",
      "function setProposalTypeParameters(uint8 proposalType, uint256 delay, uint256 threshold) external",
      "function getParameter(string memory parameterName) external view returns (uint256)",
      "function isVerifier(address account) external view returns (bool)",
      "function toggleEmergencyMode() external",
      "function pause() external",
      "function unpause() external"
    ],
    timelockController: [
      "function scheduleWithCustomDelay(address target, uint256 value, bytes calldata data, bytes32 salt, uint256 delay) external returns (bytes32)",
      "function executeWithEmergency(address target, uint256 value, bytes calldata data, bytes32 salt) external payable returns (bytes32)",
      "function toggleEmergencyMode() external",
      "function getOperationDelay(bytes4 operation) external view returns (uint256)",
      "function isEmergencyMode() external view returns (bool)"
    ],
    executionHooks: [
      "function updateParameter(string memory parameterName, uint256 newValue) external",
      "function updateInterestRate(uint256 newRate) external",
      "function updateFeeStructure(string memory feeType, uint256 newFee) external",
      "function updateVerifier(address verifier, bool isVerified) external",
      "function updateFeeExemption(address account, bool isExempt) external",
      "function getParameter(string memory parameterName) external view returns (uint256)",
      "function isVerifier(address account) external view returns (bool)",
      "function hasFeeExemption(address account) external view returns (bool)",
      "function getContractAddresses() external view returns (address loanVault, address creditProtocol, address supplyChainTrace, address batchNFT, address landNFT, address daoContract)"
    ],
    governanceToken: [
      "function balanceOf(address account) external view returns (uint256)",
      "function totalSupply() external view returns (uint256)",
      "function transfer(address to, uint256 amount) external returns (bool)",
      "function mint(address to, uint256 amount) external",
      "function delegate(address delegatee) external",
      "function getVotes(address account) external view returns (uint256)",
      "function getPastVotes(address account, uint256 blockNumber) external view returns (uint256)"
    ],
    zkVerifier: [
      "function verifyLandDocumentProof(uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[] memory publicSignals, bytes32 commitment) external returns (bool)",
      "function isProofVerified(bytes32 proofHash) external view returns (bool)",
      "function getProofData(bytes32 proofHash) external view returns (tuple(string circuitId, uint256 timestamp, address verifier, bytes32 commitment, bool isValid, bool revoked))",
      "function registerCircuit(string memory circuitId, tuple(uint256[2] alfa1, uint256[2][2] beta2, uint256[2] gamma2, uint256[2][2] delta2, uint256[2] IC) vk) external",
      "function circuitVerifyingKeys(string memory circuitId) external view returns (tuple(uint256[2] alfa1, uint256[2][2] beta2, uint256[2] gamma2, uint256[2][2] delta2, uint256[2] IC))"
    ],
    landNFTv2: [
      "function mintLand(address to, string memory landId, string memory location, uint256 area, string memory coordinates, bytes32 documentHash, string memory metadataURI) external returns (uint256)",
      "function verifyWithZKProof(uint256 tokenId, bytes32 zkProofHash, uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[] memory publicSignals, bytes32 commitment) external returns (bool)",
      "function getLandData(uint256 tokenId) external view returns (tuple(string landId, string location, uint256 area, string coordinates, uint256 timestamp, bytes32 documentHash, bytes32 zkProofHash, bool isVerified, bool isZKVerified, string metadataURI))",
      "function isLandVerified(uint256 tokenId) external view returns (bool)",
      "function isLandZKVerified(uint256 tokenId) external view returns (bool)",
      "function getLandDataByLandId(string memory landId) external view returns (tuple(string landId, string location, uint256 area, string coordinates, uint256 timestamp, bytes32 documentHash, bytes32 zkProofHash, bool isVerified, bool isZKVerified, string metadataURI))",
      "function totalSupply() external view returns (uint256)",
      "function ownerOf(uint256 tokenId) external view returns (address)",
      "function tokenURI(uint256 tokenId) external view returns (string memory)"
    ]
  };

  // Initialize contracts
  const initializeContracts = async (signer) => {
    try {
      const newContracts = {};

      // Initialize KrishiToken contract
      if (contractAddresses.krishiToken !== "0x...") {
        newContracts.krishiToken = new ethers.Contract(
          contractAddresses.krishiToken,
          contractABIs.krishiToken,
          signer
        );
      }

      // Initialize LoanContract
      if (contractAddresses.loanContract !== "0x...") {
        newContracts.loanContract = new ethers.Contract(
          contractAddresses.loanContract,
          contractABIs.loanContract,
          signer
        );
      }

      // Initialize SupplyChain contract
      if (contractAddresses.supplyChain !== "0x...") {
        newContracts.supplyChain = new ethers.Contract(
          contractAddresses.supplyChain,
          contractABIs.supplyChain,
          signer
        );
      }

      // Initialize NFTLand contract
      if (contractAddresses.nftLand !== "0x...") {
        newContracts.nftLand = new ethers.Contract(
          contractAddresses.nftLand,
          contractABIs.nftLand,
          signer
        );
      }

      // Initialize CreditProtocol contract
      if (contractAddresses.creditProtocol !== "0x...") {
        newContracts.creditProtocol = new ethers.Contract(
          contractAddresses.creditProtocol,
          contractABIs.creditProtocol,
          signer
        );
      }

      // Initialize CreditScoreOracle contract
      if (contractAddresses.creditScoreOracle !== "0x...") {
        newContracts.creditScoreOracle = new ethers.Contract(
          contractAddresses.creditScoreOracle,
          contractABIs.creditScoreOracle,
          signer
        );
      }

      // Initialize BatchNFT contract
      if (contractAddresses.batchNFT !== "0x...") {
        newContracts.batchNFT = new ethers.Contract(
          contractAddresses.batchNFT,
          contractABIs.batchNFT,
          signer
        );
      }

      // Initialize LoanVault contract
      if (contractAddresses.loanVault !== "0x...") {
        newContracts.loanVault = new ethers.Contract(
          contractAddresses.loanVault,
          contractABIs.loanVault,
          signer
        );
      }

      // Initialize DAO contract
      if (contractAddresses.dao !== "0x0000000000000000000000000000000000000000") {
        newContracts.dao = new ethers.Contract(
          contractAddresses.dao,
          contractABIs.dao,
          signer
        );
      }

      // Initialize TimelockController contract
      if (contractAddresses.timelockController !== "0x0000000000000000000000000000000000000000") {
        newContracts.timelockController = new ethers.Contract(
          contractAddresses.timelockController,
          contractABIs.timelockController,
          signer
        );
      }

      // Initialize ExecutionHooks contract
      if (contractAddresses.executionHooks !== "0x0000000000000000000000000000000000000000") {
        newContracts.executionHooks = new ethers.Contract(
          contractAddresses.executionHooks,
          contractABIs.executionHooks,
          signer
        );
      }

      // Initialize GovernanceToken contract
      if (contractAddresses.governanceToken !== "0x0000000000000000000000000000000000000000") {
        newContracts.governanceToken = new ethers.Contract(
          contractAddresses.governanceToken,
          contractABIs.governanceToken,
          signer
        );
      }

      // Initialize ZKVerifier contract
      if (contractAddresses.zkVerifier !== "0x0000000000000000000000000000000000000000") {
        newContracts.zkVerifier = new ethers.Contract(
          contractAddresses.zkVerifier,
          contractABIs.zkVerifier,
          signer
        );
      }

      // Initialize LandNFTv2 contract
      if (contractAddresses.landNFTv2 !== "0x0000000000000000000000000000000000000000") {
        newContracts.landNFTv2 = new ethers.Contract(
          contractAddresses.landNFTv2,
          contractABIs.landNFTv2,
          signer
        );
      }

      setContracts(newContracts);
    } catch (error) {
      console.error("Error initializing contracts:", error);
    }
  };

  // Check if MetaMask is installed
  const isMetaMaskInstalled = () => {
    return typeof window !== 'undefined' && typeof window.ethereum !== 'undefined';
  };

  // Initialize wallet based on user role and choice
  const initializeWallet = async (role) => {
    try {
      setIsLoading(true);
      setError(null);

      // Set user role and get wallet policy
      const policy = setUserRoleAndPolicy(role);

      console.log('Wallet policy for role', role, ':', policy);

      // Initialize based on wallet policy
      if (policy.requiredWallet === 'inapp') {
        await connectInAppWallet();
      } else if (policy.requiredWallet === 'metamask') {
        await connectMetaMaskWallet();
      } else if (policy.canChoose) {
        // For buyers, check if they have a saved choice
        const savedChoice = localStorage.getItem('wallet_choice');
        if (savedChoice && policy.allowedWallets.includes(savedChoice)) {
          setWalletChoiceForUser(savedChoice);
          if (savedChoice === 'inapp') {
            await connectInAppWallet();
          } else {
            await connectMetaMaskWallet();
          }
        } else {
          // Show wallet choice modal (handled by parent component)
          return { success: true, needsChoice: true, policy };
        }
      }

      return { success: true };

    } catch (err) {
      console.error('Wallet initialization error:', err);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setIsLoading(false);
    }
  };

  // Connect to in-app wallet
  const connectInAppWallet = async () => {
    try {
      console.log('Connecting to in-app wallet...');

      // For farmers, try to get the wallet from database first
      if (userRole === 'farmer') {
        try {
          // First, disconnect any existing MetaMask connection for farmers
          if (isConnected && walletType === 'metamask') {
            console.log('🔄 Disconnecting MetaMask for farmer - switching to in-app wallet');
            disconnectWallet();
          }

          // Import apiClient dynamically to avoid circular dependencies
          const { default: apiClient } = await import('../lib/api');
          const result = await apiClient.getWallet();

          if (result.data && result.data.wallet) {
            console.log('✅ Using farmer wallet from database:', result.data.wallet.address);

            // Create ethers wallet from the database wallet
            const wallet = new ethers.Wallet(result.data.wallet.metadata.private_key);

            // Create provider and signer for in-app wallet
            const provider = new ethers.JsonRpcProvider('https://rpc-amoy.polygon.technology/');
            const signer = wallet.connect(provider);
            const account = wallet.address;

            setProvider(provider);
            setSigner(signer);
            setAccount(account);
            setWalletType('inapp');
            setInAppWallet(wallet);
            setIsConnected(true);

            // Initialize contracts
            await initializeContracts(signer);

            console.log('✅ Farmer wallet connected from database:', account);
            return { success: true, account, walletType: 'inapp' };
          }
        } catch (dbError) {
          console.log('⚠️ Could not load farmer wallet from database, falling back to generation:', dbError.message);
        }
      }

      // Fallback to generating new wallet (for non-farmers or if database fails)
      await inAppWalletService.initialize();

      // Generate or load existing wallet
      let wallet = inAppWalletService.getWallet();
      if (!wallet) {
        const result = await inAppWalletService.generateWallet();
        if (!result.success) {
          throw new Error(result.error);
        }
        wallet = result.wallet;
      }

      // Create provider and signer for in-app wallet
      const provider = new ethers.JsonRpcProvider('https://rpc-amoy.polygon.technology/');
      const signer = wallet.connect(provider);
      const account = wallet.address;

      setProvider(provider);
      setSigner(signer);
      setAccount(account);
      setWalletType('inapp');
      setInAppWallet(wallet);
      setIsConnected(true);

      // Initialize contracts
      await initializeContracts(signer);

      console.log('In-app wallet connected:', account);
      return { success: true, account, walletType: 'inapp' };

    } catch (err) {
      console.error('In-app wallet connection error:', err);
      setError(err);
      throw err;
    }
  };

  // Connect to MetaMask wallet
  const connectMetaMaskWallet = async () => {
    try {
      console.log('Connecting to MetaMask wallet...');

      if (!window.ethereum) {
        throw new Error('MetaMask not installed');
      }

      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const account = await signer.getAddress();
      const network = await provider.getNetwork();

      setProvider(provider);
      setSigner(signer);
      setAccount(account);
      setChainId(network.chainId);
      setWalletType('metamask');
      setIsConnected(true);

      // Initialize contracts
      await initializeContracts(signer);

      // Listen for account changes
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      console.log('MetaMask wallet connected:', account);
      return { success: true, account, walletType: 'metamask' };

    } catch (err) {
      console.error('MetaMask connection error:', err);
      throw err;
    }
  };

  // Legacy connectWallet function for backward compatibility
  const connectWallet = async () => {
    if (userRole) {
      return await initializeWallet(userRole);
    } else {
      // Fallback to MetaMask if no role is set
      return await connectMetaMaskWallet();
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    setIsConnected(false);
    setError(null);

    // Remove event listeners
    if (window.ethereum) {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
    }
  };

  // Send transaction with gasless fallback
  const sendTransaction = async (txRequest) => {
    // Try gasless first if not connected or paymaster is configured
    try {
      if (!isConnected && gaslessClient.isConfigured()) {
        return await gaslessClient.sendTransaction(txRequest);
      }
    } catch (e) {
      console.warn('Gasless failed, falling back:', e?.message || e);
    }

    if (!signer) throw new Error('No signer available');
    const tx = await signer.sendTransaction(txRequest);
    return await tx.wait();
  };

  // Staking helpers
  const stakeTokens = async (amountWei, lockPeriodSeconds) => {
    if (!contracts.krishiToken) throw new Error('Token contract not ready');
    // Ensure allowance is sufficient if staking requires transferFrom in actual contract; current ABI transfers to contract internally
    const tx = await contracts.krishiToken.stake(amountWei, lockPeriodSeconds);
    return await tx.wait();
  };

  const unstakeTokens = async (stakeIndex) => {
    if (!contracts.krishiToken) throw new Error('Token contract not ready');
    const tx = await contracts.krishiToken.unstake(stakeIndex);
    return await tx.wait();
  };

  const claimStakingRewards = async () => {
    if (!contracts.krishiToken) throw new Error('Token contract not ready');
    const tx = await contracts.krishiToken.claimRewards();
    return await tx.wait();
  };

  // NFT Marketplace helpers
  const buyNFT = async (tokenId, price) => {
    if (!contracts.nftLand) throw new Error('NFT contract not ready');
    const tx = await contracts.nftLand.buyToken(tokenId, { value: price });
    return await tx.wait();
  };

  const transferNFT = async (to, tokenId) => {
    if (!contracts.nftLand) throw new Error('NFT contract not ready');
    const tx = await contracts.nftLand.transferFrom(account, to, tokenId);
    return await tx.wait();
  };

  const setNFTPrice = async (tokenId, price) => {
    if (!contracts.nftLand) throw new Error('NFT contract not ready');
    const tx = await contracts.nftLand.setTokenPrice(tokenId, price);
    return await tx.wait();
  };

  // Credit score helpers
  const getCreditScore = async (userAddress) => {
    try {
      if (contracts.creditProtocol && typeof contracts.creditProtocol.getScore === 'function') {
        const scoreBn = await contracts.creditProtocol.getScore(userAddress);
        const scoreNum = Number(scoreBn);
        return {
          score: isNaN(scoreNum) ? 0 : scoreNum,
          source: 'on-chain',
          lastUpdated: Math.floor(Date.now() / 1000)
        };
      }
      // Fallback when contract not ready
      return {
        score: 0,
        source: 'offline',
        lastUpdated: Math.floor(Date.now() / 1000)
      };
    } catch (e) {
      console.error('getCreditScore error:', e);
      return {
        score: 0,
        source: 'error',
        lastUpdated: Math.floor(Date.now() / 1000)
      };
    }
  };

  // Oracle helpers
  const requestCreditScore = async (userAddress) => {
    try {
      if (contracts.creditScoreOracle && typeof contracts.creditScoreOracle.requestCreditScore === 'function') {
        const tx = await contracts.creditScoreOracle.requestCreditScore(userAddress);
        return await tx.wait();
      }
      // Soft-success when oracle not configured (dev mode)
      return { status: 1, mock: true };
    } catch (e) {
      console.error('requestCreditScore error:', e);
      throw e;
    }
  };

  const getOracleStatus = async () => {
    try {
      if (contracts.creditScoreOracle) {
        const [lastRequestId, lastResponse, lastError] = await Promise.all([
          contracts.creditScoreOracle.s_lastRequestId(),
          contracts.creditScoreOracle.s_lastResponse(),
          contracts.creditScoreOracle.s_lastError()
        ]);
        return { lastRequestId, lastResponse, lastError };
      }
      return null;
    } catch (e) {
      console.error('getOracleStatus error:', e);
      return null;
    }
  };

  // Handle account changes
  const handleAccountsChanged = (accounts) => {
    if (accounts.length === 0) {
      disconnectWallet();
    } else {
      setAccount(accounts[0]);
    }
  };

  // Handle chain changes
  const handleChainChanged = (chainId) => {
    setChainId(chainId);
    // Optionally reload the page or update contracts
    window.location.reload();
  };

  // Fetch wallet from backend API with debouncing
  const fetchWalletFromBackend = async () => {
    // Prevent multiple simultaneous calls
    if (isLoading || walletFetchedRef.current) return null;

    walletFetchedRef.current = true;

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        walletFetchedRef.current = false;
        return null;
      }

      const response = await fetch('http://localhost:3001/api/wallet', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.wallet && data.wallet.wallet_type === 'agrifinance') {
          console.log('📱 Found AgriFinance wallet in backend:', data.wallet);

          // Create a mock wallet object for the inAppWallet state
          const mockWallet = {
            address: data.wallet.address,
            balance: data.wallet.balance_wei,
            walletType: 'agrifinance'
          };

          setInAppWallet(mockWallet);
          setAccount(data.wallet.address);
          setIsConnected(true);
          setWalletType('inapp');

          return mockWallet;
        }
      }
    } catch (error) {
      console.error('Error fetching wallet from backend:', error);
    } finally {
      // Reset the ref after 5 seconds to allow future calls
      setTimeout(() => {
        walletFetchedRef.current = false;
      }, 5000);
    }
    return null;
  };

  // Check connection status on mount
  useEffect(() => {
    const checkConnection = async () => {
      // Only run in browser environment
      if (typeof window === 'undefined') return;

      // First, try to fetch wallet from backend
      const backendWallet = await fetchWalletFromBackend();
      if (backendWallet) {
        console.log('✅ Wallet loaded from backend');
        return;
      }

      // Don't auto-connect MetaMask for farmers - they should only use in-app wallet
      if (userRole === 'farmer') {
        console.log('👨‍🌾 Farmer detected - skipping MetaMask auto-connection');
        return;
      }

      if (isMetaMaskInstalled() && window.ethereum.selectedAddress) {
        try {
          const accounts = await window.ethereum.request({
            method: 'eth_accounts',
          });

          if (accounts.length > 0) {
            const account = accounts[0];
            setAccount(account);

            const provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await provider.getSigner();
            const network = await provider.getNetwork();

            setProvider(provider);
            setSigner(signer);
            setChainId(network.chainId.toString());
            setWalletType('metamask');
            setIsConnected(true);

            // Initialize contracts
            await initializeContracts(signer);

            // Set up event listeners
            window.ethereum.on('accountsChanged', handleAccountsChanged);
            window.ethereum.on('chainChanged', handleChainChanged);
          }
        } catch (err) {
          setError(err.message);
        }
      }
    };

    checkConnection();
  }, [userRole]); // Add userRole as dependency

  // Switch to Amoy testnet
  const switchToAmoy = async () => {
    if (!isMetaMaskInstalled()) {
      setError('MetaMask is not installed');
      return;
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x13882' }], // Amoy testnet chain ID
      });
    } catch (switchError) {
      // If Amoy is not added, add it
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x13882',
                chainName: 'Polygon Amoy Testnet',
                nativeCurrency: {
                  name: 'MATIC',
                  symbol: 'MATIC',
                  decimals: 18,
                },
                rpcUrls: ['https://rpc-amoy.polygon.technology/'],
                blockExplorerUrls: ['https://amoy.polygonscan.com'],
              },
            ],
          });
        } catch (addError) {
          setError('Failed to add Amoy network');
        }
      } else {
        setError('Failed to switch to Amoy network');
      }
    }
  };

  const value = {
    account,
    provider,
    signer,
    chainId,
    isConnected,
    isLoading,
    error: error ? error.message || String(error) : null,
    contracts,
    krishiTokenContract: contracts.krishiToken,
    nftLandContract: contracts.nftLand,
    supplyChainContract: contracts.supplyChain,
    creditProtocolContract: contracts.creditProtocol,
    creditScoreOracleContract: contracts.creditScoreOracle,
    walletType,
    inAppWallet,
    connectWallet,
    disconnectWallet,
    initializeWallet,
    connectInAppWallet,
    connectMetaMaskWallet,
    switchToAmoy,
    isMetaMaskInstalled,
    sendTransaction,
    stakeTokens,
    unstakeTokens,
    claimStakingRewards,
    buyNFT,
    transferNFT,
    setNFTPrice,
    getCreditScore,
    requestCreditScore,
    getOracleStatus,
    fetchWalletFromBackend,
    // Role-aware functions
    userRole,
    walletChoice,
    getCurrentWalletPolicy
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
};
