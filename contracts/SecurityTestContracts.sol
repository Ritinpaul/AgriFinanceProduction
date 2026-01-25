// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface ILoanContract {
    function repayLoan(uint256 loanId, uint256 amount) external;
    function requestLoan(uint256 amount, uint256 duration, string memory description) external;
}

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract ReentrancyAttacker is IERC721Receiver {
    address public loanContract;
    address public token;
    
    constructor(address _loanContract, address _token) {
        loanContract = _loanContract;
        token = _token;
    }
    
    function attack() external {
        // Try to reenter during loan repayment
        ILoanContract(loanContract).repayLoan(1, 1000);
    }
    
    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) public override returns (bytes4) {
        // Reentrancy attack attempt
        ILoanContract(loanContract).repayLoan(1, 1000);
        return this.onERC721Received.selector;
    }
}

contract FrontRunningAttacker {
    address public supplyChain;
    
    constructor(address _supplyChain) {
        supplyChain = _supplyChain;
    }
    
    function frontRunBatch(string memory batchId) external payable {
        // Try to create batch with same ID to front-run
        (bool success,) = supplyChain.call(
            abi.encodeWithSignature(
                "createBatch(string,string,uint256,bytes32)",
                batchId,
                "Rice",
                500,
                keccak256("frontrun")
            )
        );
        require(success, "Front-running failed");
    }
}

contract IntegerOverflowAttacker {
    function testOverflow() external pure returns (uint256) {
        uint256 max = type(uint256).max;
        return max + 1; // This will wrap around to 0
    }
    
    function testUnderflow() external pure returns (uint256) {
        uint256 min = 0;
        return min - 1; // This will wrap around to max value
    }
}





