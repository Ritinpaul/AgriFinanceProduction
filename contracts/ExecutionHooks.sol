// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ExecutionHooks
 * @dev Contract that provides execution hooks for DAO governance actions
 * This contract acts as an intermediary between the DAO and other platform contracts
 */
contract ExecutionHooks is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant DAO_ROLE = keccak256("DAO_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    // Contract addresses
    address public loanVault;
    address public creditProtocol;
    address public supplyChainTrace;
    address public batchNFT;
    address public landNFT;
    address public daoContract;

    // Parameter storage
    mapping(string => uint256) public parameters;
    mapping(address => bool) public verifiers;
    mapping(address => bool) public feeExemptions;

    // Events
    event ParameterUpdated(string indexed parameter, uint256 oldValue, uint256 newValue);
    event VerifierUpdated(address indexed verifier, bool isVerified);
    event FeeExemptionUpdated(address indexed account, bool isExempt);
    event InterestRateUpdated(uint256 oldRate, uint256 newRate);
    event FeeStructureUpdated(string indexed feeType, uint256 oldFee, uint256 newFee);
    event ContractUpdated(string indexed contractType, address oldAddress, address newAddress);
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
        _grantRole(DAO_ROLE, msg.sender);
        _grantRole(EXECUTOR_ROLE, msg.sender);
        _grantRole(GUARDIAN_ROLE, msg.sender);

        // Initialize default parameters
        parameters["maxLoanAmount"] = 100000 * 10**18; // 100k tokens
        parameters["minLoanAmount"] = 1000 * 10**18;   // 1k tokens
        parameters["maxInterestRate"] = 2000;         // 20% (in basis points)
        parameters["minInterestRate"] = 100;           // 1% (in basis points)
        parameters["platformFee"] = 500;              // 5% (in basis points)
        parameters["verificationFee"] = 20 * 10**18;   // 20 tokens
        parameters["maxBatchSize"] = 10000;            // Max items per batch
        parameters["minBatchSize"] = 1;                // Min items per batch
    }

    /**
     * @dev Update a parameter value
     */
    function updateParameter(string memory parameterName, uint256 newValue) 
        external 
        onlyRole(DAO_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        uint256 oldValue = parameters[parameterName];
        parameters[parameterName] = newValue;
        
        emit ParameterUpdated(parameterName, oldValue, newValue);
        emit ExecutionHookCalled(address(this), "updateParameter", abi.encode(parameterName, newValue));
    }

    /**
     * @dev Update interest rate in LoanVault
     */
    function updateInterestRate(uint256 newRate) 
        external 
        onlyRole(DAO_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        require(newRate >= parameters["minInterestRate"], "Rate below minimum");
        require(newRate <= parameters["maxInterestRate"], "Rate above maximum");
        
        uint256 oldRate = parameters["currentInterestRate"];
        parameters["currentInterestRate"] = newRate;
        
        // Call LoanVault to update rate
        bytes memory data = abi.encodeWithSignature("setInterestRate(uint256)", newRate);
        (bool success, ) = loanVault.call(data);
        require(success, "Interest rate update failed");
        
        emit InterestRateUpdated(oldRate, newRate);
        emit ExecutionHookCalled(loanVault, "setInterestRate", data);
    }

    /**
     * @dev Update fee structure
     */
    function updateFeeStructure(string memory feeType, uint256 newFee) 
        external 
        onlyRole(DAO_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        uint256 oldFee = parameters[feeType];
        parameters[feeType] = newFee;
        
        // Update fee in relevant contracts
        if (keccak256(bytes(feeType)) == keccak256(bytes("platformFee"))) {
            bytes memory data = abi.encodeWithSignature("setPlatformFee(uint256)", newFee);
            (bool success, ) = loanVault.call(data);
            require(success, "Platform fee update failed");
            emit ExecutionHookCalled(loanVault, "setPlatformFee", data);
        }
        
        emit FeeStructureUpdated(feeType, oldFee, newFee);
        emit ExecutionHookCalled(address(this), "updateFeeStructure", abi.encode(feeType, newFee));
    }

    /**
     * @dev Update verifier status
     */
    function updateVerifier(address verifier, bool isVerified) 
        external 
        onlyRole(DAO_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        verifiers[verifier] = isVerified;
        
        // Update verifier in relevant contracts
        bytes memory data = abi.encodeWithSignature("setVerifier(address,bool)", verifier, isVerified);
        
        // Update in SupplyChain contract
        (bool success1, ) = supplyChainTrace.call(data);
        require(success1, "SupplyChain verifier update failed");
        
        // Update in BatchNFT contract
        (bool success2, ) = batchNFT.call(data);
        require(success2, "BatchNFT verifier update failed");
        
        emit VerifierUpdated(verifier, isVerified);
        emit ExecutionHookCalled(supplyChainTrace, "setVerifier", data);
        emit ExecutionHookCalled(batchNFT, "setVerifier", data);
    }

    /**
     * @dev Update fee exemption status
     */
    function updateFeeExemption(address account, bool isExempt) 
        external 
        onlyRole(DAO_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        feeExemptions[account] = isExempt;
        
        // Update exemption in LoanVault
        bytes memory data = abi.encodeWithSignature("setFeeExemption(address,bool)", account, isExempt);
        (bool success, ) = loanVault.call(data);
        require(success, "Fee exemption update failed");
        
        emit FeeExemptionUpdated(account, isExempt);
        emit ExecutionHookCalled(loanVault, "setFeeExemption", data);
    }

    /**
     * @dev Update contract addresses
     */
    function updateContractAddress(string memory contractType, address newAddress) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
        whenNotPaused 
        nonReentrant 
    {
        require(newAddress != address(0), "Invalid address");
        
        address oldAddress;
        
        if (keccak256(bytes(contractType)) == keccak256(bytes("loanVault"))) {
            oldAddress = loanVault;
            loanVault = newAddress;
        } else if (keccak256(bytes(contractType)) == keccak256(bytes("creditProtocol"))) {
            oldAddress = creditProtocol;
            creditProtocol = newAddress;
        } else if (keccak256(bytes(contractType)) == keccak256(bytes("supplyChainTrace"))) {
            oldAddress = supplyChainTrace;
            supplyChainTrace = newAddress;
        } else if (keccak256(bytes(contractType)) == keccak256(bytes("batchNFT"))) {
            oldAddress = batchNFT;
            batchNFT = newAddress;
        } else if (keccak256(bytes(contractType)) == keccak256(bytes("landNFT"))) {
            oldAddress = landNFT;
            landNFT = newAddress;
        } else if (keccak256(bytes(contractType)) == keccak256(bytes("daoContract"))) {
            oldAddress = daoContract;
            daoContract = newAddress;
        } else {
            revert("Invalid contract type");
        }
        
        emit ContractUpdated(contractType, oldAddress, newAddress);
        emit ExecutionHookCalled(address(this), "updateContractAddress", abi.encode(contractType, newAddress));
    }

    /**
     * @dev Emergency pause
     */
    function emergencyPause() external onlyRole(GUARDIAN_ROLE) {
        _pause();
    }

    /**
     * @dev Emergency unpause
     */
    function emergencyUnpause() external onlyRole(GUARDIAN_ROLE) {
        _unpause();
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
        address _landNFT,
        address _daoContract
    ) {
        return (loanVault, creditProtocol, supplyChainTrace, batchNFT, landNFT, daoContract);
    }

    /**
     * @dev Batch update multiple parameters
     */
    function batchUpdateParameters(
        string[] memory parameterNames,
        uint256[] memory newValues
    ) external onlyRole(DAO_ROLE) whenNotPaused nonReentrant {
        require(parameterNames.length == newValues.length, "Array length mismatch");
        
        for (uint256 i = 0; i < parameterNames.length; i++) {
            uint256 oldValue = parameters[parameterNames[i]];
            parameters[parameterNames[i]] = newValues[i];
            emit ParameterUpdated(parameterNames[i], oldValue, newValues[i]);
        }
        
        emit ExecutionHookCalled(address(this), "batchUpdateParameters", abi.encode(parameterNames, newValues));
    }

    /**
     * @dev Execute arbitrary call (restricted to admin)
     */
    function executeCall(
        address target,
        bytes calldata data
    ) external onlyRole(DEFAULT_ADMIN_ROLE) whenNotPaused nonReentrant {
        (bool success, ) = target.call(data);
        require(success, "Call execution failed");
        
        emit ExecutionHookCalled(target, "executeCall", data);
    }
}
