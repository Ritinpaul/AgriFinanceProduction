// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ZKVerifier.sol";

/**
 * @title LandNFTv2
 * @dev Enhanced Land NFT contract with ZK proof integration
 * @notice This contract represents land ownership as NFTs with ZK verification
 */
contract LandNFTv2 is ERC721, AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ZK Verifier contract
    ZKVerifier public zkVerifier;
    
    // Land data structure
    struct LandData {
        string landId;
        string location;
        uint256 area; // in square meters
        string coordinates; // GPS coordinates
        uint256 timestamp;
        bytes32 documentHash;
        bytes32 zkProofHash;
        bool isVerified;
        bool isZKVerified;
        string metadataURI;
    }

    // Token ID to land data mapping
    mapping(uint256 => LandData) public landData;
    
    // Land ID to token ID mapping
    mapping(string => uint256) public landIdToTokenId;
    
    // ZK proof hash to token ID mapping
    mapping(bytes32 => uint256) public zkProofToTokenId;
    
    // Document hash to token ID mapping
    mapping(bytes32 => uint256) public documentHashToTokenId;
    
    // Events
    event LandMinted(uint256 indexed tokenId, string indexed landId, address indexed owner);
    event LandVerified(uint256 indexed tokenId, bool isVerified);
    event LandZKVerified(uint256 indexed tokenId, bytes32 indexed zkProofHash, bool isZKVerified);
    event LandDataUpdated(uint256 indexed tokenId, string newMetadataURI);
    
    constructor(address _zkVerifier) ERC721("AgriFinance Land NFT", "AFLAND") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
        
        zkVerifier = ZKVerifier(_zkVerifier);
    }

    /**
     * @dev Mint a new land NFT
     * @param to The address to mint the NFT to
     * @param landId The unique land identifier
     * @param location The location description
     * @param area The area in square meters
     * @param coordinates GPS coordinates
     * @param documentHash Hash of the land document
     * @param metadataURI URI for the NFT metadata
     * @return tokenId The minted token ID
     */
    function mintLand(
        address to,
        string memory landId,
        string memory location,
        uint256 area,
        string memory coordinates,
        bytes32 documentHash,
        string memory metadataURI
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant returns (uint256) {
        require(to != address(0), "Invalid recipient address");
        require(bytes(landId).length > 0, "Land ID cannot be empty");
        require(area > 0, "Area must be greater than 0");
        require(documentHash != bytes32(0), "Document hash cannot be empty");
        require(landIdToTokenId[landId] == 0, "Land ID already exists");
        require(documentHashToTokenId[documentHash] == 0, "Document hash already used");

        uint256 tokenId = totalSupply() + 1;
        
        landData[tokenId] = LandData({
            landId: landId,
            location: location,
            area: area,
            coordinates: coordinates,
            timestamp: block.timestamp,
            documentHash: documentHash,
            zkProofHash: bytes32(0),
            isVerified: false,
            isZKVerified: false,
            metadataURI: metadataURI
        });

        landIdToTokenId[landId] = tokenId;
        documentHashToTokenId[documentHash] = tokenId;

        _safeMint(to, tokenId);
        
        emit LandMinted(tokenId, landId, to);
        return tokenId;
    }

    /**
     * @dev Verify land document using ZK proof
     * @param tokenId The token ID of the land
     * @param zkProofHash The hash of the ZK proof
     * @param a Proof point A
     * @param b Proof point B
     * @param c Proof point C
     * @param publicSignals The public signals from the proof
     * @param commitment The commitment hash
     * @return success Whether the verification was successful
     */
    function verifyWithZKProof(
        uint256 tokenId,
        bytes32 zkProofHash,
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[] memory publicSignals,
        bytes32 commitment
    ) external onlyRole(VERIFIER_ROLE) whenNotPaused nonReentrant returns (bool success) {
        require(_exists(tokenId), "Token does not exist");
        require(zkProofHash != bytes32(0), "Invalid ZK proof hash");
        require(zkProofToTokenId[zkProofHash] == 0, "ZK proof hash already used");

        // Verify the ZK proof
        bool isValid = zkVerifier.verifyLandDocumentProof(a, b, c, publicSignals, commitment);
        
        if (isValid) {
            // Update land data
            landData[tokenId].zkProofHash = zkProofHash;
            landData[tokenId].isZKVerified = true;
            landData[tokenId].isVerified = true; // ZK verification implies document verification
            
            zkProofToTokenId[zkProofHash] = tokenId;
            
            emit LandZKVerified(tokenId, zkProofHash, true);
            success = true;
        } else {
            emit LandZKVerified(tokenId, zkProofHash, false);
            success = false;
        }
        
        return success;
    }

    /**
     * @dev Manually verify land document (non-ZK verification)
     * @param tokenId The token ID of the land
     * @param isVerified Whether the land is verified
     */
    function setLandVerification(uint256 tokenId, bool isVerified) 
        external 
        onlyRole(VERIFIER_ROLE) 
        whenNotPaused 
    {
        require(_exists(tokenId), "Token does not exist");
        
        landData[tokenId].isVerified = isVerified;
        
        emit LandVerified(tokenId, isVerified);
    }

    /**
     * @dev Update land metadata URI
     * @param tokenId The token ID of the land
     * @param newMetadataURI The new metadata URI
     */
    function updateLandMetadata(uint256 tokenId, string memory newMetadataURI) 
        external 
        onlyRole(ADMIN_ROLE) 
        whenNotPaused 
    {
        require(_exists(tokenId), "Token does not exist");
        require(bytes(newMetadataURI).length > 0, "Metadata URI cannot be empty");
        
        landData[tokenId].metadataURI = newMetadataURI;
        
        emit LandDataUpdated(tokenId, newMetadataURI);
    }

    /**
     * @dev Get land data for a token
     * @param tokenId The token ID
     * @return data The land data
     */
    function getLandData(uint256 tokenId) external view returns (LandData memory data) {
        require(_exists(tokenId), "Token does not exist");
        return landData[tokenId];
    }

    /**
     * @dev Get land data by land ID
     * @param landId The land ID
     * @return data The land data
     */
    function getLandDataByLandId(string memory landId) external view returns (LandData memory data) {
        uint256 tokenId = landIdToTokenId[landId];
        require(tokenId != 0, "Land ID not found");
        return landData[tokenId];
    }

    /**
     * @dev Check if a land is verified
     * @param tokenId The token ID
     * @return isVerified Whether the land is verified
     */
    function isLandVerified(uint256 tokenId) external view returns (bool isVerified) {
        require(_exists(tokenId), "Token does not exist");
        return landData[tokenId].isVerified;
    }

    /**
     * @dev Check if a land is ZK verified
     * @param tokenId The token ID
     * @return isZKVerified Whether the land is ZK verified
     */
    function isLandZKVerified(uint256 tokenId) external view returns (bool isZKVerified) {
        require(_exists(tokenId), "Token does not exist");
        return landData[tokenId].isZKVerified;
    }

    /**
     * @dev Get token URI (overrides ERC721)
     * @param tokenId The token ID
     * @return The token URI
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        return landData[tokenId].metadataURI;
    }

    /**
     * @dev Get total supply
     * @return The total number of tokens minted
     */
    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter();
    }

    /**
     * @dev Internal function to get the current token ID counter
     * @return The current token ID counter
     */
    function _tokenIdCounter() internal view returns (uint256) {
        // This is a simplified implementation
        // In practice, you might want to use a proper counter
        return 0; // Placeholder - would need proper implementation
    }

    /**
     * @dev Check if a token exists
     * @param tokenId The token ID to check
     * @return Whether the token exists
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        return landData[tokenId].timestamp > 0;
    }

    /**
     * @dev Override supportsInterface to include AccessControl
     * @param interfaceId The interface ID
     * @return Whether the interface is supported
     */
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        override(ERC721, AccessControl) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }

    /**
     * @dev Emergency pause function
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause function
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Update ZK verifier contract address
     * @param newZKVerifier The new ZK verifier contract address
     */
    function updateZKVerifier(address newZKVerifier) external onlyRole(ADMIN_ROLE) {
        require(newZKVerifier != address(0), "Invalid ZK verifier address");
        zkVerifier = ZKVerifier(newZKVerifier);
    }
}
