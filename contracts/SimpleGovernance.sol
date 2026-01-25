// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SimpleGovernance
 * @dev Simplified governance contract for Phase 5
 */
contract SimpleGovernance is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant PARAMETER_UPDATER_ROLE = keccak256("PARAMETER_UPDATER_ROLE");

    // Proposal types
    enum ProposalType {
        PARAMETER_CHANGE,
        EMERGENCY_ACTION,
        VERIFIER_UPDATE,
        FEE_UPDATE,
        INTEREST_RATE_UPDATE,
        SBT_EXCEPTION,
        TREASURY_MANAGEMENT,
        GENERAL
    }

    struct Proposal {
        uint256 id;
        ProposalType proposalType;
        string title;
        string description;
        address proposer;
        address[] targets;
        uint256[] values;
        bytes[] calldatas;
        uint256 startTime;
        uint256 endTime;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 abstainVotes;
        bool executed;
        bool isEmergency;
        mapping(address => bool) hasVoted;
    }

    // Contract references
    address public loanVault;
    address public creditProtocol;
    address public supplyChainTrace;
    address public batchNFT;
    address public landNFT;

    // Governance parameters
    mapping(ProposalType => uint256) public proposalTypeDelays;
    mapping(ProposalType => uint256) public proposalTypeThresholds;
    
    // Emergency controls
    bool public emergencyMode = false;
    uint256 public emergencyThreshold = 1000 * 10**18;

    // Proposals
    mapping(uint256 => Proposal) public proposals;
    uint256 public nextProposalId = 1;
    uint256 public votingPeriod = 7 days;
    uint256 public executionDelay = 2 days;

    // Parameter storage
    mapping(string => uint256) public parameters;
    mapping(address => bool) public verifiers;
    mapping(address => bool) public feeExemptions;

    // Events
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, ProposalType proposalType, string title);
    event VoteCast(uint256 indexed proposalId, address indexed voter, uint8 support, uint256 weight);
    event ProposalExecuted(uint256 indexed proposalId);
    event ParameterUpdated(string indexed parameter, uint256 oldValue, uint256 newValue);
    event EmergencyModeToggled(bool enabled);
    event VerifierUpdated(address indexed verifier, bool isVerified);
    event ExecutionHookCalled(address indexed target, string functionName, bytes data);

    constructor(
        address _loanVault,
        address _creditProtocol,
        address _supplyChainTrace,
        address _batchNFT,
        address _landNFT
    ) {
        loanVault = _loanVault;
        creditProtocol = _creditProtocol;
        supplyChainTrace = _supplyChainTrace;
        batchNFT = _batchNFT;
        landNFT = _landNFT;

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(GUARDIAN_ROLE, msg.sender);
        _grantRole(EXECUTOR_ROLE, msg.sender);
        _grantRole(PARAMETER_UPDATER_ROLE, msg.sender);

        // Set default proposal type delays and thresholds
        proposalTypeDelays[ProposalType.PARAMETER_CHANGE] = 2 days;
        proposalTypeDelays[ProposalType.EMERGENCY_ACTION] = 0;
        proposalTypeDelays[ProposalType.VERIFIER_UPDATE] = 1 days;
        proposalTypeDelays[ProposalType.FEE_UPDATE] = 3 days;
        proposalTypeDelays[ProposalType.INTEREST_RATE_UPDATE] = 2 days;
        proposalTypeDelays[ProposalType.SBT_EXCEPTION] = 1 days;
        proposalTypeDelays[ProposalType.TREASURY_MANAGEMENT] = 5 days;
        proposalTypeDelays[ProposalType.GENERAL] = 1 days;

        proposalTypeThresholds[ProposalType.PARAMETER_CHANGE] = 1000 * 10**18;
        proposalTypeThresholds[ProposalType.EMERGENCY_ACTION] = 10000 * 10**18;
        proposalTypeThresholds[ProposalType.VERIFIER_UPDATE] = 500 * 10**18;
        proposalTypeThresholds[ProposalType.FEE_UPDATE] = 2000 * 10**18;
        proposalTypeThresholds[ProposalType.INTEREST_RATE_UPDATE] = 1500 * 10**18;
        proposalTypeThresholds[ProposalType.SBT_EXCEPTION] = 5000 * 10**18;
        proposalTypeThresholds[ProposalType.TREASURY_MANAGEMENT] = 5000 * 10**18;
        proposalTypeThresholds[ProposalType.GENERAL] = 100 * 10**18;

        // Initialize default parameters
        parameters["maxLoanAmount"] = 100000 * 10**18;
        parameters["minLoanAmount"] = 1000 * 10**18;
        parameters["maxInterestRate"] = 2000;
        parameters["minInterestRate"] = 100;
        parameters["platformFee"] = 500;
        parameters["verificationFee"] = 20 * 10**18;
        parameters["maxBatchSize"] = 10000;
        parameters["minBatchSize"] = 1;
    }

    /**
     * @dev Create a proposal
     */
    function createProposal(
        ProposalType _proposalType,
        string memory _title,
        string memory _description,
        address[] memory _targets,
        uint256[] memory _values,
        bytes[] memory _calldatas,
        bool _isEmergency
    ) external returns (uint256) {
        require(!paused(), "Governance is paused");
        require(_targets.length == _values.length && _targets.length == _calldatas.length, "Array length mismatch");
        
        // For now, allow any authenticated user to create proposals
        // In a real implementation, you would check token balance/voting power

        uint256 proposalId = nextProposalId++;
        Proposal storage proposal = proposals[proposalId];
        
        proposal.id = proposalId;
        proposal.proposalType = _proposalType;
        proposal.title = _title;
        proposal.description = _description;
        proposal.proposer = msg.sender;
        proposal.targets = _targets;
        proposal.values = _values;
        proposal.calldatas = _calldatas;
        proposal.startTime = block.timestamp;
        proposal.endTime = block.timestamp + votingPeriod;
        proposal.isEmergency = _isEmergency;

        emit ProposalCreated(proposalId, msg.sender, _proposalType, _title);
        
        return proposalId;
    }

    /**
     * @dev Cast a vote on a proposal
     */
    function castVote(
        uint256 proposalId,
        uint8 support
    ) external {
        require(!paused(), "Governance is paused");
        require(support <= 2, "Invalid vote type");
        require(proposalId < nextProposalId, "Proposal does not exist");
        
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp >= proposal.startTime, "Voting not started");
        require(block.timestamp <= proposal.endTime, "Voting ended");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        
        proposal.hasVoted[msg.sender] = true;
        
        // For now, each vote counts as 1
        // In a real implementation, you would use token balance
        uint256 weight = 1;
        
        if (support == 0) {
            proposal.againstVotes += weight;
        } else if (support == 1) {
            proposal.forVotes += weight;
        } else if (support == 2) {
            proposal.abstainVotes += weight;
        }
        
        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    /**
     * @dev Execute a proposal
     */
    function executeProposal(uint256 proposalId) external {
        require(!paused(), "Governance is paused");
        require(proposalId < nextProposalId, "Proposal does not exist");
        
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp > proposal.endTime, "Voting not ended");
        require(!proposal.executed, "Already executed");
        require(proposal.forVotes > proposal.againstVotes, "Proposal not passed");
        
        // Check execution delay
        require(block.timestamp >= proposal.endTime + executionDelay, "Execution delay not met");
        
        proposal.executed = true;
        
        // Execute the proposal
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            (bool success, ) = proposal.targets[i].call{value: proposal.values[i]}(proposal.calldatas[i]);
            require(success, "Execution failed");
        }
        
        emit ProposalExecuted(proposalId);
    }

    /**
     * @dev Update a parameter value
     */
    function updateParameter(
        string memory parameterName,
        uint256 newValue,
        address targetContract
    ) external onlyRole(PARAMETER_UPDATER_ROLE) {
        uint256 oldValue = parameters[parameterName];
        parameters[parameterName] = newValue;
        
        if (targetContract != address(0)) {
            bytes memory data = abi.encodeWithSignature(
                "updateParameter(string,uint256)",
                parameterName,
                newValue
            );
            
            (bool success, ) = targetContract.call(data);
            require(success, "Parameter update failed");
            
            emit ExecutionHookCalled(targetContract, "updateParameter", data);
        }
        
        emit ParameterUpdated(parameterName, oldValue, newValue);
    }

    /**
     * @dev Emergency pause/unpause functionality
     */
    function toggleEmergencyMode() external onlyRole(GUARDIAN_ROLE) {
        emergencyMode = !emergencyMode;
        emit EmergencyModeToggled(emergencyMode);
    }

    /**
     * @dev Update verifier status
     */
    function updateVerifier(address verifier, bool isVerified) external onlyRole(DEFAULT_ADMIN_ROLE) {
        verifiers[verifier] = isVerified;
        emit VerifierUpdated(verifier, isVerified);
    }

    /**
     * @dev Set proposal type parameters
     */
    function setProposalTypeParameters(
        ProposalType proposalType,
        uint256 delay,
        uint256 threshold
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        proposalTypeDelays[proposalType] = delay;
        proposalTypeThresholds[proposalType] = threshold;
    }

    /**
     * @dev Pause the governance
     */
    function pause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause the governance
     */
    function unpause() external onlyRole(GUARDIAN_ROLE) {
        _unpause();
    }

    /**
     * @dev Get proposal details
     */
    function getProposal(uint256 proposalId) external view returns (
        uint256 id,
        ProposalType proposalType,
        string memory title,
        string memory description,
        address proposer,
        uint256 startTime,
        uint256 endTime,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 abstainVotes,
        bool executed,
        bool isEmergency
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.id,
            proposal.proposalType,
            proposal.title,
            proposal.description,
            proposal.proposer,
            proposal.startTime,
            proposal.endTime,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.abstainVotes,
            proposal.executed,
            proposal.isEmergency
        );
    }

    /**
     * @dev Get parameter value
     */
    function getParameter(string memory parameterName) external view returns (uint256) {
        return parameters[parameterName];
    }

    /**
     * @dev Check if address is a verifier
     */
    function isVerifier(address account) external view returns (bool) {
        return verifiers[account];
    }

    /**
     * @dev Check if address has fee exemption
     */
    function hasFeeExemption(address account) external view returns (bool) {
        return feeExemptions[account];
    }

    /**
     * @dev Get all contract addresses
     */
    function getContractAddresses() external view returns (
        address _loanVault,
        address _creditProtocol,
        address _supplyChainTrace,
        address _batchNFT,
        address _landNFT
    ) {
        return (loanVault, creditProtocol, supplyChainTrace, batchNFT, landNFT);
    }

    /**
     * @dev Check if user has voted on a proposal
     */
    function hasVoted(uint256 proposalId, address voter) external view returns (bool) {
        return proposals[proposalId].hasVoted[voter];
    }

    /**
     * @dev Get proposal state
     */
    function getProposalState(uint256 proposalId) external view returns (string memory) {
        Proposal storage proposal = proposals[proposalId];
        
        if (proposal.executed) {
            return "Executed";
        } else if (block.timestamp <= proposal.endTime) {
            return "Active";
        } else if (proposal.forVotes > proposal.againstVotes) {
            return "Succeeded";
        } else {
            return "Defeated";
        }
    }
}
