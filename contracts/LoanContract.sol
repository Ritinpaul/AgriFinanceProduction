// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./KrishiToken.sol";
import "./CreditProtocol.sol";

contract LoanContract is ReentrancyGuard, Ownable {
    struct Loan {
        uint256 id;
        address borrower;
        uint256 amount;
        uint256 interestRate;
        uint256 duration;
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        bool isRepaid;
        uint256 creditScore;
        string purpose;
    }

    struct Lender {
        address lenderAddress;
        uint256 totalLent;
        uint256 totalEarned;
        bool isActive;
    }

    mapping(uint256 => Loan) public loans;
    mapping(address => Lender) public lenders;
    mapping(address => uint256[]) public borrowerLoans;
    mapping(address => uint256[]) public lenderLoans;

    uint256 public nextLoanId = 1;
    uint256 public totalLent = 0;
    uint256 public totalEarned = 0;
    uint256 public constant MIN_CREDIT_SCORE = 500; // Lowered to allow more users
    uint256 public constant MAX_LOAN_AMOUNT = 10000 * 10**6; // 10,000 tokens (6 decimals)
    uint256 public constant MIN_LOAN_AMOUNT = 100 * 10**6; // 100 tokens (6 decimals)
    
    // Credit score tiers for different loan terms
    uint256 public constant EXCELLENT_SCORE = 750; // Best rates
    uint256 public constant GOOD_SCORE = 650; // Good rates
    uint256 public constant FAIR_SCORE = 550; // Standard rates
    uint256 public constant POOR_SCORE = 500; // Higher rates

    KrishiToken public krishiToken;
    CreditProtocol public creditProtocol;
    
    // Credit-based interest rate modifiers (in basis points)
    uint256 public constant EXCELLENT_RATE_MODIFIER = 800; // 8% base rate
    uint256 public constant GOOD_RATE_MODIFIER = 1000; // 10% base rate
    uint256 public constant FAIR_RATE_MODIFIER = 1200; // 12% base rate
    uint256 public constant POOR_RATE_MODIFIER = 1500; // 15% base rate

    event LoanCreated(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 amount,
        uint256 interestRate,
        uint256 duration
    );

    event LoanFunded(
        uint256 indexed loanId,
        address indexed lender,
        uint256 amount
    );

    event LoanRepaid(
        uint256 indexed loanId,
        address indexed borrower,
        uint256 amount
    );

    event LenderRegistered(address indexed lender);

    constructor(address _krishiToken, address _creditProtocol) Ownable(msg.sender) {
        krishiToken = KrishiToken(_krishiToken);
        creditProtocol = CreditProtocol(_creditProtocol);
    }

    function registerLender() external {
        require(!lenders[msg.sender].isActive, "Lender already registered");
        
        lenders[msg.sender] = Lender({
            lenderAddress: msg.sender,
            totalLent: 0,
            totalEarned: 0,
            isActive: true
        });

        emit LenderRegistered(msg.sender);
    }

    // Get current credit score for a borrower
    function getBorrowerCreditScore(address _borrower) public view returns (CreditProtocol.ScoreInfo memory) {
        return creditProtocol.getScore(_borrower);
    }

    // Calculate credit-based interest rate
    function calculateCreditBasedInterestRate(uint256 _creditScore) public pure returns (uint256) {
        if (_creditScore >= EXCELLENT_SCORE) {
            return EXCELLENT_RATE_MODIFIER;
        } else if (_creditScore >= GOOD_SCORE) {
            return GOOD_RATE_MODIFIER;
        } else if (_creditScore >= FAIR_SCORE) {
            return FAIR_RATE_MODIFIER;
        } else if (_creditScore >= POOR_SCORE) {
            return POOR_RATE_MODIFIER;
        } else {
            return 2000; // 20% for very poor credit
        }
    }

    // Calculate maximum loan amount based on credit score
    function calculateMaxLoanAmount(uint256 _creditScore) public pure returns (uint256) {
        if (_creditScore >= EXCELLENT_SCORE) {
            return MAX_LOAN_AMOUNT; // Full amount
        } else if (_creditScore >= GOOD_SCORE) {
            return (MAX_LOAN_AMOUNT * 80) / 100; // 80% of max
        } else if (_creditScore >= FAIR_SCORE) {
            return (MAX_LOAN_AMOUNT * 60) / 100; // 60% of max
        } else if (_creditScore >= POOR_SCORE) {
            return (MAX_LOAN_AMOUNT * 40) / 100; // 40% of max
        } else {
            return MIN_LOAN_AMOUNT; // Minimum amount only
        }
    }

    // Get loan eligibility for a borrower
    function getLoanEligibility(address _borrower) external view returns (
        bool eligible,
        uint256 maxAmount,
        uint256 recommendedRate,
        string memory reason
    ) {
        CreditProtocol.ScoreInfo memory scoreInfo = getBorrowerCreditScore(_borrower);
        uint256 score = scoreInfo.score;
        
        if (score < MIN_CREDIT_SCORE) {
            return (false, 0, 0, "Credit score too low");
        }
        
        maxAmount = calculateMaxLoanAmount(score);
        recommendedRate = calculateCreditBasedInterestRate(score);
        
        return (true, maxAmount, recommendedRate, "Eligible for loan");
    }

    function createLoan(
        uint256 _amount,
        uint256 _duration,
        string memory _purpose
    ) external returns (uint256) {
        // Get current credit score from CreditProtocol
        CreditProtocol.ScoreInfo memory scoreInfo = getBorrowerCreditScore(msg.sender);
        uint256 creditScore = scoreInfo.score;
        
        require(creditScore >= MIN_CREDIT_SCORE, "Credit score too low");
        require(_amount >= MIN_LOAN_AMOUNT, "Loan amount too small");
        
        // Calculate credit-based maximum amount
        uint256 maxAmount = calculateMaxLoanAmount(creditScore);
        require(_amount <= maxAmount, "Loan amount exceeds credit limit");
        
        require(_duration > 0, "Invalid duration");
        
        // Calculate credit-based interest rate
        uint256 interestRate = calculateCreditBasedInterestRate(creditScore);
        
        // Validate interest rate is reasonable
        require(interestRate <= 3000, "Interest rate too high"); // Max 30%

        uint256 loanId = nextLoanId++;
        
        loans[loanId] = Loan({
            id: loanId,
            borrower: msg.sender,
            amount: _amount,
            interestRate: interestRate,
            duration: _duration,
            startTime: block.timestamp,
            endTime: block.timestamp + _duration,
            isActive: false,
            isRepaid: false,
            creditScore: creditScore,
            purpose: _purpose
        });

        borrowerLoans[msg.sender].push(loanId);

        emit LoanCreated(loanId, msg.sender, _amount, interestRate, _duration);
        
        return loanId;
    }

    function fundLoan(uint256 _loanId) external nonReentrant {
        require(lenders[msg.sender].isActive, "Not a registered lender");
        
        Loan storage loan = loans[_loanId];
        require(loan.borrower != address(0), "Loan does not exist");
        require(!loan.isActive, "Loan already funded");
        require(block.timestamp <= loan.endTime, "Loan expired");

        uint256 fundingAmount = loan.amount;
        require(krishiToken.balanceOf(msg.sender) >= fundingAmount, "Insufficient token balance");
        require(krishiToken.allowance(msg.sender, address(this)) >= fundingAmount, "Insufficient allowance");

        // Transfer tokens from lender to contract
        krishiToken.transferFrom(msg.sender, address(this), fundingAmount);

        // Update loan status
        loan.isActive = true;

        // Update lender stats
        lenders[msg.sender].totalLent += fundingAmount;
        lenderLoans[msg.sender].push(_loanId);
        totalLent += fundingAmount;

        emit LoanFunded(_loanId, msg.sender, fundingAmount);
    }

    function repayLoan(uint256 _loanId) external nonReentrant {
        Loan storage loan = loans[_loanId];
        require(loan.borrower == msg.sender, "Not the borrower");
        require(loan.isActive, "Loan not active");
        require(!loan.isRepaid, "Loan already repaid");

        uint256 totalRepayment = calculateRepayment(_loanId);
        require(krishiToken.balanceOf(msg.sender) >= totalRepayment, "Insufficient balance for repayment");
        require(krishiToken.allowance(msg.sender, address(this)) >= totalRepayment, "Insufficient allowance");

        // Transfer repayment from borrower to contract
        krishiToken.transferFrom(msg.sender, address(this), totalRepayment);

        // Mark loan as repaid
        loan.isRepaid = true;
        loan.isActive = false;

        // Calculate interest earned
        uint256 interestEarned = totalRepayment - loan.amount;
        totalEarned += interestEarned;

        emit LoanRepaid(_loanId, msg.sender, totalRepayment);
    }

    function calculateRepayment(uint256 _loanId) public view returns (uint256) {
        Loan memory loan = loans[_loanId];
        if (!loan.isActive) return 0;

        uint256 interest = (loan.amount * loan.interestRate * loan.duration) / (365 days * 100);
        return loan.amount + interest;
    }

    function getBorrowerLoans(address _borrower) external view returns (uint256[] memory) {
        return borrowerLoans[_borrower];
    }

    function getLenderLoans(address _lender) external view returns (uint256[] memory) {
        return lenderLoans[_lender];
    }

    function getLoanDetails(uint256 _loanId) external view returns (Loan memory) {
        return loans[_loanId];
    }

    function withdrawEarnings() external {
        require(lenders[msg.sender].isActive, "Not a registered lender");
        
        uint256 earnings = lenders[msg.sender].totalEarned;
        require(earnings > 0, "No earnings to withdraw");
        require(krishiToken.balanceOf(address(this)) >= earnings, "Insufficient contract balance");

        lenders[msg.sender].totalEarned = 0;
        krishiToken.transfer(msg.sender, earnings);
    }

    // Update credit score for existing loans (admin function)
    function updateLoanCreditScore(uint256 _loanId) external onlyOwner {
        Loan storage loan = loans[_loanId];
        require(loan.borrower != address(0), "Loan does not exist");
        require(!loan.isRepaid, "Cannot update repaid loan");
        
        CreditProtocol.ScoreInfo memory scoreInfo = getBorrowerCreditScore(loan.borrower);
        loan.creditScore = scoreInfo.score;
        
        // Recalculate interest rate based on new score
        uint256 newRate = calculateCreditBasedInterestRate(scoreInfo.score);
        loan.interestRate = newRate;
    }

    // Get credit score tier name
    function getCreditScoreTier(uint256 _score) public pure returns (string memory) {
        if (_score >= EXCELLENT_SCORE) {
            return "Excellent";
        } else if (_score >= GOOD_SCORE) {
            return "Good";
        } else if (_score >= FAIR_SCORE) {
            return "Fair";
        } else if (_score >= POOR_SCORE) {
            return "Poor";
        } else {
            return "Very Poor";
        }
    }

    // Get loan statistics by credit tier
    function getLoanStatsByCreditTier() external view returns (
        uint256 excellentCount,
        uint256 goodCount,
        uint256 fairCount,
        uint256 poorCount,
        uint256 totalAmount
    ) {
        for (uint256 i = 1; i < nextLoanId; i++) {
            Loan memory loan = loans[i];
            if (loan.borrower != address(0)) {
                totalAmount += loan.amount;
                
                if (loan.creditScore >= EXCELLENT_SCORE) {
                    excellentCount++;
                } else if (loan.creditScore >= GOOD_SCORE) {
                    goodCount++;
                } else if (loan.creditScore >= FAIR_SCORE) {
                    fairCount++;
                } else {
                    poorCount++;
                }
            }
        }
    }
}
