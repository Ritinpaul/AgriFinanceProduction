// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./CreditProtocol.sol";

/**
 * @title CreditScoreOracle
 * @dev Oracle consumer that fetches credit scores via Chainlink Functions
 */
contract CreditScoreOracle is FunctionsClient {
    using FunctionsRequest for FunctionsRequest.Request;
    
    CreditProtocol public creditProtocol;
    
    bytes32 public s_lastRequestId;
    bytes public s_lastResponse;
    bytes public s_lastError;
    
    // Chainlink Functions configuration
    bytes32 public s_donId; // DON ID for the job
    uint64 public s_subscriptionId; // Subscription ID
    uint32 public s_gasLimit; // Gas limit for the request
    uint16 public s_requestConfirmations; // Confirmations to wait for
    
    // JavaScript source code for the function
    string public s_source = 
        'const req = await Functions.makeHttpRequest({'
        'url: "https://bronchiolar-marie-gracile.ngrok-free.dev/api/ai/credit-score",'
        'method: "POST",'
        'headers: { "Content-Type": "application/json" },'
        'data: { userAddress: args[0], timestamp: args[1] }'
        '});'
        'if (req.error) { throw Error("AI service error"); }'
        'const score = req.data.score;'
        'const source = req.data.source;'
        'return Functions.encodeString(`${score},${source}`);';
    
    // Events
    event CreditScoreRequested(bytes32 indexed requestId, address indexed user);
    event CreditScoreUpdated(bytes32 indexed requestId, address indexed user, uint256 score, string source);
    event RequestProcessed(bytes32 indexed requestId, bytes response, bytes err);
    
    constructor(
        address functionsRouter,
        bytes32 donId,
        uint64 subscriptionId,
        address _creditProtocol
    ) FunctionsClient(functionsRouter) {
        s_donId = donId;
        s_subscriptionId = subscriptionId;
        s_gasLimit = 300000;
        s_requestConfirmations = 1;
        creditProtocol = CreditProtocol(_creditProtocol);
    }
    
    /**
     * @notice Request credit score update for a user
     * @param userAddress The address to get credit score for
     */
    function requestCreditScore(address userAddress) external {
        // Create the request using the source code
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(s_source);
        
        // Set arguments: userAddress, timestamp
        string[] memory args = new string[](2);
        args[0] = addressToString(userAddress);
        args[1] = uintToString(block.timestamp);
        req.setArgs(args);
        
        // Send the request
        bytes32 requestId = _sendRequest(
            req.encodeCBOR(),
            s_subscriptionId,
            s_gasLimit,
            s_donId
        );
        
        s_lastRequestId = requestId;
        
        emit CreditScoreRequested(requestId, userAddress);
    }
    
    /**
     * @notice Process the response from Chainlink Functions
     */
    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        s_lastResponse = response;
        s_lastError = err;
        
        emit RequestProcessed(requestId, response, err);
        
        if (err.length > 0) {
            return; // Handle error case
        }
        
        // Parse response: "score,source"
        string memory responseString = string(response);
        (uint256 score, string memory source) = parseResponse(responseString);
        
        // Update credit protocol
        creditProtocol.updateScore(msg.sender, score, source);
        
        emit CreditScoreUpdated(requestId, msg.sender, score, source);
    }
    
    /**
     * @notice Parse the response string
     */
    function parseResponse(string memory response) internal pure returns (uint256 score, string memory source) {
        // Simple parsing - in production, use proper string parsing
        bytes memory responseBytes = bytes(response);
        uint256 commaIndex = 0;
        
        for (uint256 i = 0; i < responseBytes.length; i++) {
            if (responseBytes[i] == bytes1(",")) {
                commaIndex = i;
                break;
            }
        }
        
        require(commaIndex > 0, "Invalid response format");
        
        // Extract score
        bytes memory scoreBytes = new bytes(commaIndex);
        for (uint256 i = 0; i < commaIndex; i++) {
            scoreBytes[i] = responseBytes[i];
        }
        score = stringToUint(string(scoreBytes));
        
        // Extract source
        bytes memory sourceBytes = new bytes(responseBytes.length - commaIndex - 1);
        for (uint256 i = 0; i < sourceBytes.length; i++) {
            sourceBytes[i] = responseBytes[commaIndex + 1 + i];
        }
        source = string(sourceBytes);
    }
    
    // Helper functions
    function addressToString(address addr) internal pure returns (string memory) {
        return Strings.toHexString(uint160(addr), 20);
    }
    
    function uintToString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
    
    function stringToUint(string memory s) internal pure returns (uint256) {
        bytes memory b = bytes(s);
        uint256 result = 0;
        for (uint256 i = 0; i < b.length; i++) {
            if (uint8(b[i]) >= 48 && uint8(b[i]) <= 57) {
                result = result * 10 + (uint8(b[i]) - 48);
            }
        }
        return result;
    }
}