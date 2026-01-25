// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CreditProtocol
 * @dev Minimal on-chain credit score registry with role-gated updates.
 */
contract CreditProtocol is AccessControl {
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");

    struct ScoreInfo {
        uint256 score;
        uint256 lastUpdated;
        string source; // optional: oracle/job identifier
    }

    mapping(address => ScoreInfo) private scores;

    event ScoreUpdated(address indexed user, uint256 score, string source);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPDATER_ROLE, admin);
    }

    function updateScore(address user, uint256 score, string calldata source) external onlyRole(UPDATER_ROLE) {
        require(user != address(0), "invalid user");
        scores[user] = ScoreInfo({ score: score, lastUpdated: block.timestamp, source: source });
        emit ScoreUpdated(user, score, source);
    }

    function getScore(address user) external view returns (ScoreInfo memory) {
        return scores[user];
    }
}


