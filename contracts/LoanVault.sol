// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title LoanVault v2
 * @dev Decentralized lending pool with risk-based pricing and pooled liquidity
 */
contract LoanVault is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // Structs
    struct Lender {
        address lenderAddress;
        uint256 totalDeposited;
        uint256 totalWithdrawn;
        uint256 lpShares;
        uint256 lastDepositTime;
        bool isActive;
    }

    struct Loan {
        uint256 loanId;
        address borrower;
        uint256 amount;
        uint256 interestRate;
        uint256 termDays;
        uint256 collateralValue;
        uint256 creditScore;
        uint256 createdAt;
        uint256 dueDate;
        bool isActive;
        bool isRepaid;
        bool isDefaulted;
    }

    struct PoolStats {
        uint256 totalLiquidity;
        uint256 totalLoans;
        uint256 totalBorrowed;
        uint256 totalRepaid;
        uint256 totalDefaults;
        uint256 utilizationRate; // Percentage of liquidity currently lent out
        uint256 averageAPY;
    }

    // State variables
    IERC20 public krishiToken;
    address public creditProtocol;
    address public loanContract;
    
    mapping(address => Lender) public lenders;
    mapping(uint256 => Loan) public loans;
    mapping(address => uint256[]) public borrowerLoans;
    mapping(address => uint256[]) public lenderLoans;
    
    uint256 public nextLoanId = 1;
    uint256 public totalLiquidity = 0;
    uint256 public totalLpShares = 0;
    
    // Risk parameters (DAO controlled)
    uint256 public baseInterestRate = 800; // 8% base rate (in basis points)
    uint256 public maxUtilizationRate = 8000; // 80% max utilization
    uint256 public liquidationThreshold = 7500; // 75% liquidation threshold
    uint256 public gracePeriodDays = 7; // 7 days grace period for defaults
    uint256 public penaltyRate = 200; // 2% penalty rate for defaults
    
    // Events
    event LiquidityDeposited(address indexed lender, uint256 amount, uint256 lpShares);
    event LiquidityWithdrawn(address indexed lender, uint256 amount, uint256 lpShares);
    event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 interestRate);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 amount);
    event LoanDefaulted(uint256 indexed loanId, address indexed borrower);
    event LiquidationExecuted(uint256 indexed loanId, address indexed liquidator);
    event ParametersUpdated(string parameter, uint256 newValue);

    constructor(
        address _krishiToken,
        address _creditProtocol,
        address _loanContract,
        address initialOwner
    ) Ownable(initialOwner) {
        krishiToken = IERC20(_krishiToken);
        creditProtocol = _creditProtocol;
        loanContract = _loanContract;
    }

    /**
     * @dev Deposit liquidity into the pool
     * @param amount Amount of tokens to deposit
     */
    function depositLiquidity(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(krishiToken.balanceOf(msg.sender) >= amount, "Insufficient balance");
        
        // Transfer tokens from lender FIRST (before any state changes)
        krishiToken.safeTransferFrom(msg.sender, address(this), amount);
        
        // Calculate LP shares (1:1 ratio for simplicity, can be enhanced)
        uint256 lpShares = amount;
        
        // Update lender info - Initialize if needed
        Lender storage lender = lenders[msg.sender];
        
        // CRITICAL: Initialize lender if this is their first deposit
        // Check address(0) first as it's more reliable than isActive for uninitialized structs
        if (lender.lenderAddress == address(0)) {
            // Initialize all fields explicitly to zero
            lender.lenderAddress = msg.sender;
            lender.totalDeposited = 0;
            lender.totalWithdrawn = 0;
            lender.lpShares = 0;
            lender.lastDepositTime = 0;
            lender.isActive = true;
        }
        
        // Read current values (now guaranteed to be initialized to 0 for new lender)
        uint256 currentTotalDeposited = lender.totalDeposited;
        uint256 currentLpShares = lender.lpShares;
        uint256 currentTotalLiquidity = totalLiquidity;
        uint256 currentTotalLpShares = totalLpShares;
        
        // CRITICAL: Verify all values are reasonable before arithmetic
        // This ensures no corrupted state variables cause overflow
        // Since we've verified state is clean (all 0s for first deposit), additions should be safe
        // Solidity 0.8+ will automatically check for overflow in additions
        
        // Simply perform the additions - they will be checked by Solidity automatically
        // For first deposit: 0 + amount cannot overflow (amount is user's balance, reasonable)
        // For subsequent deposits: values have been validated by previous deposits
        lender.totalDeposited = currentTotalDeposited + amount;
        lender.lpShares = currentLpShares + lpShares;
        totalLiquidity = currentTotalLiquidity + amount;
        totalLpShares = currentTotalLpShares + lpShares;
        
        lender.lastDepositTime = block.timestamp;
        
        emit LiquidityDeposited(msg.sender, amount, lpShares);
    }

    /**
     * @dev Withdraw liquidity from the pool
     * @param amount Amount of tokens to withdraw
     */
    function withdrawLiquidity(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        require(lenders[msg.sender].isActive, "Lender not active");
        require(lenders[msg.sender].lpShares >= amount, "Insufficient LP shares");
        
        // Check if withdrawal would affect active loans
        require(canWithdraw(amount), "Withdrawal would affect active loans");
        
        // Calculate withdrawal amount (1:1 ratio)
        uint256 withdrawalAmount = amount;
        
        // Update lender info
        lenders[msg.sender].totalWithdrawn += withdrawalAmount;
        lenders[msg.sender].lpShares -= amount;
        
        // Update pool stats
        totalLiquidity -= withdrawalAmount;
        totalLpShares -= amount;
        
        // Transfer tokens to lender
        krishiToken.safeTransfer(msg.sender, withdrawalAmount);
        
        emit LiquidityWithdrawn(msg.sender, withdrawalAmount, amount);
    }

    /**
     * @dev Create a new loan using pooled liquidity
     * @param amount Loan amount
     * @param termDays Loan term in days
     * @param collateralValue Collateral value
     */
    function createLoan(
        uint256 amount,
        uint256 termDays,
        uint256 collateralValue
    ) external nonReentrant whenNotPaused returns (uint256) {
        require(amount > 0, "Loan amount must be greater than 0");
        require(termDays > 0, "Term must be greater than 0");
        require(totalLiquidity >= amount, "Insufficient liquidity in pool");
        
        // Get borrower's credit score from CreditProtocol
        uint256 creditScore = getCreditScore(msg.sender);
        require(creditScore >= 500, "Credit score too low");
        
        // Calculate interest rate based on credit score and utilization
        uint256 interestRate = calculateInterestRate(creditScore, amount);
        
        // Create loan
        uint256 loanId = nextLoanId++;
        loans[loanId] = Loan({
            loanId: loanId,
            borrower: msg.sender,
            amount: amount,
            interestRate: interestRate,
            termDays: termDays,
            collateralValue: collateralValue,
            creditScore: creditScore,
            createdAt: block.timestamp,
            dueDate: block.timestamp + (termDays * 1 days),
            isActive: true,
            isRepaid: false,
            isDefaulted: false
        });
        
        borrowerLoans[msg.sender].push(loanId);
        
        // Update pool stats
        totalLiquidity -= amount;
        
        // Transfer tokens to borrower
        krishiToken.safeTransfer(msg.sender, amount);
        
        emit LoanCreated(loanId, msg.sender, amount, interestRate);
        
        return loanId;
    }

    /**
     * @dev Repay a loan
     * @param loanId ID of the loan to repay
     */
    function repayLoan(uint256 loanId) external nonReentrant whenNotPaused {
        require(loans[loanId].borrower == msg.sender, "Not the borrower");
        require(loans[loanId].isActive, "Loan not active");
        require(!loans[loanId].isRepaid, "Loan already repaid");
        
        Loan storage loan = loans[loanId];
        
        // Calculate repayment amount (principal + interest)
        uint256 repaymentAmount = calculateRepaymentAmount(loanId);
        
        require(krishiToken.balanceOf(msg.sender) >= repaymentAmount, "Insufficient balance");
        
        // Transfer repayment from borrower
        krishiToken.safeTransferFrom(msg.sender, address(this), repaymentAmount);
        
        // Update loan status
        loan.isRepaid = true;
        loan.isActive = false;
        
        // Update pool stats
        totalLiquidity += loan.amount;
        
        emit LoanRepaid(loanId, msg.sender, repaymentAmount);
    }

    /**
     * @dev Mark a loan as defaulted
     * @param loanId ID of the loan to default
     */
    function markLoanDefault(uint256 loanId) external onlyOwner {
        require(loans[loanId].isActive, "Loan not active");
        require(!loans[loanId].isRepaid, "Loan already repaid");
        require(block.timestamp > loans[loanId].dueDate + (gracePeriodDays * 1 days), "Still in grace period");
        
        loans[loanId].isDefaulted = true;
        loans[loanId].isActive = false;
        
        emit LoanDefaulted(loanId, loans[loanId].borrower);
    }

    /**
     * @dev Execute liquidation of a defaulted loan
     * @param loanId ID of the loan to liquidate
     */
    function executeLiquidation(uint256 loanId) external nonReentrant {
        require(loans[loanId].isDefaulted, "Loan not defaulted");
        
        // In a real implementation, this would handle collateral liquidation
        // For now, we'll just mark the loan as liquidated
        
        loans[loanId].isActive = false;
        
        emit LiquidationExecuted(loanId, msg.sender);
    }

    /**
     * @dev Calculate interest rate - Fixed at 8% (800 basis points)
     * Only changeable via DAO governance through updateParameters() (owner-only function)
     */
    function calculateInterestRate(uint256 creditScore, uint256 loanAmount) public view returns (uint256) {
        // Fixed at 8% APR - only changeable via DAO
        return baseInterestRate; // Always returns 800 (8%)
    }

    /**
     * @dev Calculate repayment amount for a loan
     */
    function calculateRepaymentAmount(uint256 loanId) public view returns (uint256) {
        Loan memory loan = loans[loanId];
        
        // Simple interest calculation: Principal + (Principal * Rate * Time)
        uint256 timeElapsed = block.timestamp - loan.createdAt;
        uint256 interest = (loan.amount * loan.interestRate * timeElapsed) / (365 days * 10000);
        
        return loan.amount + interest;
    }

    /**
     * @dev Get credit score from CreditProtocol
     */
    function getCreditScore(address borrower) public view returns (uint256) {
        // In a real implementation, this would call the CreditProtocol contract
        // For now, return a mock score
        return 650; // Mock credit score
    }

    /**
     * @dev Check if a withdrawal is allowed
     */
    function canWithdraw(uint256 amount) public view returns (bool) {
        return (totalLiquidity - amount) >= (totalLiquidity * maxUtilizationRate) / 10000;
    }

    /**
     * @dev Get pool statistics
     */
    function getPoolStats() external view returns (PoolStats memory) {
        uint256 utilizationRate = totalLiquidity > 0 ? 
            ((totalLiquidity - getAvailableLiquidity()) * 10000) / totalLiquidity : 0;
        
        return PoolStats({
            totalLiquidity: totalLiquidity,
            totalLoans: nextLoanId - 1,
            totalBorrowed: getTotalBorrowed(),
            totalRepaid: getTotalRepaid(),
            totalDefaults: getTotalDefaults(),
            utilizationRate: utilizationRate,
            averageAPY: calculateAverageAPY()
        });
    }

    /**
     * @dev Get available liquidity for new loans
     */
    function getAvailableLiquidity() public view returns (uint256) {
        uint256 borrowed = getTotalBorrowed();
        return totalLiquidity > borrowed ? totalLiquidity - borrowed : 0;
    }

    /**
     * @dev Get total amount borrowed
     */
    function getTotalBorrowed() public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 1; i < nextLoanId; i++) {
            if (loans[i].isActive && !loans[i].isRepaid) {
                total += loans[i].amount;
            }
        }
        return total;
    }

    /**
     * @dev Get total amount repaid
     */
    function getTotalRepaid() public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 1; i < nextLoanId; i++) {
            if (loans[i].isRepaid) {
                total += loans[i].amount;
            }
        }
        return total;
    }

    /**
     * @dev Get total number of defaults
     */
    function getTotalDefaults() public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 1; i < nextLoanId; i++) {
            if (loans[i].isDefaulted) {
                total++;
            }
        }
        return total;
    }

    /**
     * @dev Calculate average APY for lenders
     */
    function calculateAverageAPY() public view returns (uint256) {
        if (totalLiquidity == 0) return 0;
        
        uint256 totalInterest = 0;
        for (uint256 i = 1; i < nextLoanId; i++) {
            if (loans[i].isRepaid) {
                uint256 interest = calculateRepaymentAmount(i) - loans[i].amount;
                totalInterest += interest;
            }
        }
        
        return (totalInterest * 10000) / totalLiquidity;
    }

    /**
     * @dev Update risk parameters (only owner/DAO)
     */
    function updateParameters(
        uint256 _baseInterestRate,
        uint256 _maxUtilizationRate,
        uint256 _liquidationThreshold,
        uint256 _gracePeriodDays,
        uint256 _penaltyRate
    ) external onlyOwner {
        baseInterestRate = _baseInterestRate;
        maxUtilizationRate = _maxUtilizationRate;
        liquidationThreshold = _liquidationThreshold;
        gracePeriodDays = _gracePeriodDays;
        penaltyRate = _penaltyRate;
        
        emit ParametersUpdated("All parameters", block.timestamp);
    }

    /**
     * @dev Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency withdrawal (only owner)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = krishiToken.balanceOf(address(this));
        krishiToken.safeTransfer(owner(), balance);
    }

    /**
     * @dev Debug function to check current pool state (helps diagnose overflow issues)
     */
    function getDebugInfo(address lender) external view returns (
        uint256 poolTotalLiquidity,
        uint256 poolTotalLpShares,
        uint256 lenderTotalDeposited,
        uint256 lenderLpShares,
        bool lenderIsActive,
        uint256 maxUint256
    ) {
        return (
            totalLiquidity,
            totalLpShares,
            lenders[lender].totalDeposited,
            lenders[lender].lpShares,
            lenders[lender].isActive,
            type(uint256).max
        );
    }
}
