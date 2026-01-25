// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title KrishiToken (KRSI)
 * @dev Agricultural-focused ERC20 token with staking, burning, and governance features
 * @author AgriFinance Team
 */
contract KrishiToken is ERC20, ERC20Burnable, ERC20Pausable, AccessControl, ReentrancyGuard {
    
    // Roles
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant STAKING_ROLE = keccak256("STAKING_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    
    // Tokenomics (using 6 decimals instead of 18 to avoid bigint overflow)
    uint256 public constant INITIAL_SUPPLY = 100_000_000 * 10**6; // 100 million KRSI
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**6; // 1 billion KRSI max
    uint256 public constant STAKING_REWARD_RATE = 5; // 5% annual reward rate
    uint256 public constant BURN_RATE = 2; // 2% burn rate on transfers
    
    // Staking structures
    struct StakeInfo {
        uint256 amount;
        uint256 startTime;
        uint256 lockPeriod;
        bool isActive;
        uint256 rewardRate;
    }
    
    struct GovernanceProposal {
        uint256 id;
        string title;
        string description;
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 startTime;
        uint256 endTime;
        bool executed;
        address proposer;
    }
    
    // Mappings
    mapping(address => StakeInfo[]) public userStakes;
    mapping(address => uint256) public totalStaked;
    mapping(address => uint256) public lastClaimTime;
    mapping(uint256 => GovernanceProposal) public proposals;
    mapping(address => mapping(uint256 => bool)) public hasVoted;
    mapping(address => uint256) public votingPower;
    
    // State variables
    uint256 public totalStakedAmount;
    uint256 public totalBurnedAmount;
    uint256 public nextProposalId = 1;
    uint256 public stakingLockPeriod = 30 days;
    uint256 public governanceThreshold = 1000 * 10**6; // 1000 KRSI to propose
    bool private _isProcessingBurn; // Flag to skip voting power updates during burns
    
    // Events
    event TokensStaked(address indexed user, uint256 amount, uint256 lockPeriod);
    event TokensUnstaked(address indexed user, uint256 amount, uint256 reward);
    event RewardsClaimed(address indexed user, uint256 amount);
    event TokensBurned(address indexed burner, uint256 amount);
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string title);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 votes);
    event ProposalExecuted(uint256 indexed proposalId);
    event FaucetTokensDistributed(address indexed recipient, uint256 amount);
    
    constructor() ERC20("Krishi Token", "KRSI") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
        _grantRole(STAKING_ROLE, msg.sender);
        _grantRole(GOVERNANCE_ROLE, msg.sender);
        
        // Mint initial supply to deployer
        _mint(msg.sender, INITIAL_SUPPLY);
        
        // Set up initial voting power (1 token = 1 vote)
        votingPower[msg.sender] = INITIAL_SUPPLY;
    }
    
    /**
     * @dev Override decimals to return 6 instead of default 18
     * This matches how tokens were minted and how they're used throughout the system
     */
    function decimals() public pure override returns (uint8) {
        return 6;
    }
    
    /**
     * @dev Mint new tokens (only minters)
     */
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
        // votingPower is already updated in _update, no need to add again
    }
    
    /**
     * @dev Burn tokens (only burners)
     */
    function burnTokens(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(from, amount);
        totalBurnedAmount += amount;
        votingPower[from] -= amount;
        emit TokensBurned(from, amount);
    }
    
    /**
     * @dev Stake tokens for rewards
     */
    function stake(uint256 amount, uint256 lockPeriod) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(lockPeriod >= stakingLockPeriod, "Lock period too short");
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        // Transfer tokens to contract
        _transfer(msg.sender, address(this), amount);
        
        // Create stake info
        StakeInfo memory newStake = StakeInfo({
            amount: amount,
            startTime: block.timestamp,
            lockPeriod: lockPeriod,
            isActive: true,
            rewardRate: STAKING_REWARD_RATE
        });
        
        userStakes[msg.sender].push(newStake);
        totalStaked[msg.sender] += amount;
        totalStakedAmount += amount;
        
        emit TokensStaked(msg.sender, amount, lockPeriod);
    }
    
    /**
     * @dev Unstake tokens and claim rewards
     */
    function unstake(uint256 stakeIndex) external nonReentrant {
        require(stakeIndex < userStakes[msg.sender].length, "Invalid stake index");
        
        StakeInfo storage stakeInfo = userStakes[msg.sender][stakeIndex];
        require(stakeInfo.isActive, "Stake not active");
        require(block.timestamp >= stakeInfo.startTime + stakeInfo.lockPeriod, "Lock period not ended");
        
        uint256 stakedAmount = stakeInfo.amount;
        uint256 reward = calculateStakingReward(msg.sender, stakeIndex);
        
        // Mark stake as inactive
        stakeInfo.isActive = false;
        
        // Update totals
        totalStaked[msg.sender] -= stakedAmount;
        totalStakedAmount -= stakedAmount;
        
        // Transfer staked amount + rewards
        _transfer(address(this), msg.sender, stakedAmount + reward);
        
        emit TokensUnstaked(msg.sender, stakedAmount, reward);
    }
    
    /**
     * @dev Calculate staking rewards for a specific stake
     */
    function calculateStakingReward(address user, uint256 stakeIndex) public view returns (uint256) {
        StakeInfo memory stakeInfo = userStakes[user][stakeIndex];
        if (!stakeInfo.isActive) return 0;
        
        uint256 timeStaked = block.timestamp - stakeInfo.startTime;
        uint256 annualReward = (stakeInfo.amount * stakeInfo.rewardRate) / 100;
        uint256 reward = (annualReward * timeStaked) / 365 days;
        
        return reward;
    }
    
    /**
     * @dev Claim accumulated rewards without unstaking
     */
    function claimRewards() external nonReentrant {
        uint256 totalRewards = 0;
        
        for (uint256 i = 0; i < userStakes[msg.sender].length; i++) {
            if (userStakes[msg.sender][i].isActive) {
                totalRewards += calculateStakingReward(msg.sender, i);
            }
        }
        
        require(totalRewards > 0, "No rewards to claim");
        
        _mint(msg.sender, totalRewards);
        lastClaimTime[msg.sender] = block.timestamp;
        
        emit RewardsClaimed(msg.sender, totalRewards);
    }
    
    /**
     * @dev Create a governance proposal
     */
    function createProposal(
        string memory title,
        string memory description,
        uint256 duration
    ) external onlyRole(GOVERNANCE_ROLE) {
        require(balanceOf(msg.sender) >= governanceThreshold, "Insufficient voting power");
        
        uint256 proposalId = nextProposalId++;
        proposals[proposalId] = GovernanceProposal({
            id: proposalId,
            title: title,
            description: description,
            votesFor: 0,
            votesAgainst: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            executed: false,
            proposer: msg.sender
        });
        
        emit ProposalCreated(proposalId, msg.sender, title);
    }
    
    /**
     * @dev Vote on a governance proposal
     */
    function vote(uint256 proposalId, bool support) external {
        require(proposals[proposalId].id != 0, "Proposal does not exist");
        require(block.timestamp <= proposals[proposalId].endTime, "Voting period ended");
        require(!hasVoted[msg.sender][proposalId], "Already voted");
        require(balanceOf(msg.sender) > 0, "No voting power");
        
        uint256 votes = balanceOf(msg.sender);
        
        if (support) {
            proposals[proposalId].votesFor += votes;
        } else {
            proposals[proposalId].votesAgainst += votes;
        }
        
        hasVoted[msg.sender][proposalId] = true;
        
        emit VoteCast(proposalId, msg.sender, support, votes);
    }
    
    /**
     * @dev Execute a governance proposal
     */
    function executeProposal(uint256 proposalId) external onlyRole(GOVERNANCE_ROLE) {
        require(proposals[proposalId].id != 0, "Proposal does not exist");
        require(block.timestamp > proposals[proposalId].endTime, "Voting period not ended");
        require(!proposals[proposalId].executed, "Proposal already executed");
        
        proposals[proposalId].executed = true;
        
        emit ProposalExecuted(proposalId);
    }
    
    /**
     * @dev Distribute tokens via faucet (for testing)
     */
    function faucetDistribute(address recipient, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(amount <= 1000 * 10**6, "Faucet limit exceeded"); // Max 1000 KRSI per distribution
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        
        _mint(recipient, amount);
        votingPower[recipient] += amount;
        
        emit FaucetTokensDistributed(recipient, amount);
    }
    
    /**
     * @dev Override transfer to implement burn mechanism
     */
    function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Pausable) {
        super._update(from, to, value);
        
        // Skip voting power updates during burns to avoid recursion issues
        if (_isProcessingBurn) {
            return;
        }
        
        // Apply burn rate on transfers (except minting/burning)
        if (from != address(0) && to != address(0) && from != address(this)) {
            uint256 burnAmount = (value * BURN_RATE) / 100;
            if (burnAmount > 0) {
                // Set flag to skip voting power updates in the recursive burn
                _isProcessingBurn = true;
                // Use ERC20Burnable's burn function which will call _update recursively
                // But our flag will prevent the recursive voting power update
                _burn(to, burnAmount);
                _isProcessingBurn = false;
                
                // Prevent overflow in totalBurnedAmount
                if (totalBurnedAmount <= type(uint256).max - burnAmount) {
                    totalBurnedAmount += burnAmount;
                } else {
                    // Cap at max if would overflow (should never happen in practice)
                    totalBurnedAmount = type(uint256).max;
                }
                
                // Manually update voting power for the burn (after burn is complete)
                if (votingPower[to] >= burnAmount) {
                    votingPower[to] -= burnAmount;
                }
            }
        }
        
        // Update voting power (with underflow protection)
        if (from != address(0)) {
            if (votingPower[from] >= value) {
                unchecked {
                    votingPower[from] -= value;
                }
            } else {
                votingPower[from] = 0; // Prevent underflow
            }
        }
        if (to != address(0)) {
            // Prevent overflow when adding to voting power
            uint256 currentVotingPower = votingPower[to];
            if (currentVotingPower <= type(uint256).max - value) {
                unchecked {
                    votingPower[to] += value;
                }
            } else {
                // If would overflow, cap at max
                votingPower[to] = type(uint256).max;
            }
        }
    }
    
    /**
     * @dev Get user's total staking rewards
     */
    function getTotalStakingRewards(address user) external view returns (uint256) {
        uint256 totalRewards = 0;
        for (uint256 i = 0; i < userStakes[user].length; i++) {
            if (userStakes[user][i].isActive) {
                totalRewards += calculateStakingReward(user, i);
            }
        }
        return totalRewards;
    }
    
    /**
     * @dev Get user's active stakes
     */
    function getUserStakes(address user) external view returns (StakeInfo[] memory) {
        return userStakes[user];
    }
    
    /**
     * @dev Get proposal details
     */
    function getProposal(uint256 proposalId) external view returns (GovernanceProposal memory) {
        return proposals[proposalId];
    }
    
    /**
     * @dev Pause token transfers (emergency only)
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause token transfers
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Update staking lock period
     */
    function setStakingLockPeriod(uint256 newLockPeriod) external onlyRole(DEFAULT_ADMIN_ROLE) {
        stakingLockPeriod = newLockPeriod;
    }
    
    /**
     * @dev Update governance threshold
     */
    function setGovernanceThreshold(uint256 newThreshold) external onlyRole(DEFAULT_ADMIN_ROLE) {
        governanceThreshold = newThreshold;
    }
}
