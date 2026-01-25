// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title EscrowLoan
 * @notice Minimal on-chain escrow for loans; emits indexed events for off-chain indexers.
 */
contract EscrowLoan is ReentrancyGuard, Ownable, Pausable {
    struct Loan {
        address borrower;
        uint256 principalWei;
        uint256 repaidWei;
        bool active;
    }

    mapping(uint256 => Loan) public loans; // loanId => Loan

    event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 principalWei);
    event LoanRepaid(uint256 indexed loanId, address indexed payer, uint256 amountWei, uint256 totalRepaidWei);
    event LoanClosed(uint256 indexed loanId);

    constructor() Ownable(msg.sender) {}

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function createLoan(uint256 loanId, address borrower, uint256 principalWei) external onlyOwner whenNotPaused {
        require(!loans[loanId].active, "exists");
        loans[loanId] = Loan({ borrower: borrower, principalWei: principalWei, repaidWei: 0, active: true });
        emit LoanCreated(loanId, borrower, principalWei);
    }

    function repay(uint256 loanId) external payable nonReentrant whenNotPaused {
        Loan storage ln = loans[loanId];
        require(ln.active, "not active");
        require(msg.value > 0, "amount=0");
        ln.repaidWei += msg.value;
        emit LoanRepaid(loanId, msg.sender, msg.value, ln.repaidWei);
        if (ln.repaidWei >= ln.principalWei) {
            ln.active = false;
            emit LoanClosed(loanId);
        }
    }

    function sweep(address payable to, uint256 amountWei) external onlyOwner {
        require(address(this).balance >= amountWei, "insufficient");
        to.transfer(amountWei);
    }
}


