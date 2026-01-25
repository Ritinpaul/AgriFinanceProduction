// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BatchNFT
 * @dev ERC721 contract for representing product batches in the marketplace
 * Each NFT represents a verified batch of agricultural products
 */
contract BatchNFT is ERC721, ERC721Enumerable, ERC721URIStorage, Ownable, ReentrancyGuard {
    
    struct BatchInfo {
        uint256 batchId;
        address farmer;
        string productType;
        string grade;
        uint256 quantity;
        uint256 pricePerUnit;
        string certifications; // IPFS hash of certifications
        string photos; // IPFS hash of photos
        string logs; // IPFS hash of production logs
        uint256 createdAt;
        bool isVerified;
        bool isSold;
        address buyer;
        uint256 soldAt;
    }

    mapping(uint256 => BatchInfo) public batches;
    mapping(address => uint256[]) public farmerBatches;
    mapping(address => uint256[]) public buyerBatches;
    mapping(string => uint256) public qrHashToBatchId; // QR hash -> batch ID mapping
    
    uint256 public nextBatchId = 1;
    uint256 public totalBatches = 0;
    uint256 public totalSold = 0;
    
    // Events
    event BatchCreated(
        uint256 indexed batchId,
        address indexed farmer,
        string productType,
        string grade,
        uint256 quantity,
        string qrHash
    );
    
    event BatchVerified(uint256 indexed batchId, address indexed verifier);
    event BatchSold(uint256 indexed batchId, address indexed buyer, uint256 price);
    event BatchUpdated(uint256 indexed batchId, string newMetadata);
    
    constructor(address initialOwner) ERC721("AgriFinance Batch NFT", "AFB") Ownable(initialOwner) {}
    
    /**
     * @dev Create a new batch NFT
     * @param productType Type of agricultural product
     * @param grade Quality grade of the product
     * @param quantity Amount of product in the batch
     * @param pricePerUnit Price per unit in wei
     * @param certifications IPFS hash of certifications
     * @param photos IPFS hash of photos
     * @param logs IPFS hash of production logs
     * @param qrHash QR code hash for traceability
     */
    function createBatch(
        string memory productType,
        string memory grade,
        uint256 quantity,
        uint256 pricePerUnit,
        string memory certifications,
        string memory photos,
        string memory logs,
        string memory qrHash
    ) external returns (uint256) {
        require(bytes(productType).length > 0, "Product type required");
        require(bytes(grade).length > 0, "Grade required");
        require(quantity > 0, "Quantity must be positive");
        require(pricePerUnit > 0, "Price must be positive");
        require(bytes(qrHash).length > 0, "QR hash required");
        require(qrHashToBatchId[qrHash] == 0, "QR hash already exists");
        
        uint256 batchId = nextBatchId++;
        
        batches[batchId] = BatchInfo({
            batchId: batchId,
            farmer: msg.sender,
            productType: productType,
            grade: grade,
            quantity: quantity,
            pricePerUnit: pricePerUnit,
            certifications: certifications,
            photos: photos,
            logs: logs,
            createdAt: block.timestamp,
            isVerified: false,
            isSold: false,
            buyer: address(0),
            soldAt: 0
        });
        
        farmerBatches[msg.sender].push(batchId);
        qrHashToBatchId[qrHash] = batchId;
        totalBatches++;
        
        // Mint NFT to farmer
        _safeMint(msg.sender, batchId);
        
        // Set token URI (IPFS metadata)
        string memory metadataURI = string(abi.encodePacked(
            "ipfs://",
            certifications,
            "/batch-",
            _toString(batchId),
            ".json"
        ));
        _setTokenURI(batchId, metadataURI);
        
        emit BatchCreated(batchId, msg.sender, productType, grade, quantity, qrHash);
        
        return batchId;
    }
    
    /**
     * @dev Verify a batch (only owner/DAO can call)
     * @param batchId ID of the batch to verify
     */
    function verifyBatch(uint256 batchId) external onlyOwner {
        require(batchId > 0 && batchId < nextBatchId, "Batch does not exist");
        require(!batches[batchId].isVerified, "Batch already verified");
        
        batches[batchId].isVerified = true;
        
        emit BatchVerified(batchId, msg.sender);
    }
    
    /**
     * @dev Purchase a batch
     * @param batchId ID of the batch to purchase
     */
    function purchaseBatch(uint256 batchId) external payable nonReentrant {
        require(batchId > 0 && batchId < nextBatchId, "Batch does not exist");
        require(batches[batchId].isVerified, "Batch must be verified");
        require(!batches[batchId].isSold, "Batch already sold");
        require(msg.sender != batches[batchId].farmer, "Cannot buy own batch");
        
        uint256 totalPrice = batches[batchId].quantity * batches[batchId].pricePerUnit;
        require(msg.value >= totalPrice, "Insufficient payment");
        
        // Mark as sold
        batches[batchId].isSold = true;
        batches[batchId].buyer = msg.sender;
        batches[batchId].soldAt = block.timestamp;
        
        buyerBatches[msg.sender].push(batchId);
        totalSold++;
        
        // Transfer NFT to buyer
        _transfer(batches[batchId].farmer, msg.sender, batchId);
        
        // Transfer payment to farmer
        payable(batches[batchId].farmer).transfer(totalPrice);
        
        // Refund excess payment
        if (msg.value > totalPrice) {
            payable(msg.sender).transfer(msg.value - totalPrice);
        }
        
        emit BatchSold(batchId, msg.sender, totalPrice);
    }
    
    /**
     * @dev Get batch information by QR hash
     * @param qrHash QR code hash
     * @return BatchInfo struct
     */
    function getBatchByQR(string memory qrHash) external view returns (BatchInfo memory) {
        uint256 batchId = qrHashToBatchId[qrHash];
        require(batchId > 0, "Batch not found for QR hash");
        return batches[batchId];
    }
    
    /**
     * @dev Get all batches for a farmer
     * @param farmer Address of the farmer
     * @return Array of batch IDs
     */
    function getFarmerBatches(address farmer) external view returns (uint256[] memory) {
        return farmerBatches[farmer];
    }
    
    /**
     * @dev Get all batches purchased by a buyer
     * @param buyer Address of the buyer
     * @return Array of batch IDs
     */
    function getBuyerBatches(address buyer) external view returns (uint256[] memory) {
        return buyerBatches[buyer];
    }
    
    /**
     * @dev Get batch statistics
     * @return totalBatches Total number of batches created
     * @return totalSold Total number of batches sold
     * @return totalVerified Total number of verified batches
     */
    function getBatchStats() external view returns (uint256, uint256, uint256) {
        uint256 totalVerified = 0;
        for (uint256 i = 1; i < nextBatchId; i++) {
            if (batches[i].isVerified) {
                totalVerified++;
            }
        }
        return (totalBatches, totalSold, totalVerified);
    }
    
    /**
     * @dev Update batch metadata (only farmer can update before verification)
     * @param batchId ID of the batch to update
     * @param newMetadata New IPFS metadata hash
     */
    function updateBatchMetadata(uint256 batchId, string memory newMetadata) external {
        require(batchId > 0 && batchId < nextBatchId, "Batch does not exist");
        require(msg.sender == batches[batchId].farmer, "Only farmer can update");
        require(!batches[batchId].isVerified, "Cannot update verified batch");
        
        _setTokenURI(batchId, newMetadata);
        
        emit BatchUpdated(batchId, newMetadata);
    }
    
    // Required overrides for multiple inheritance
    function _update(address to, uint256 tokenId, address auth) internal override(ERC721, ERC721Enumerable) returns (address) {
        return super._update(to, tokenId, auth);
    }
    
    function _increaseBalance(address account, uint128 value) internal override(ERC721, ERC721Enumerable) {
        super._increaseBalance(account, value);
    }
    
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721Enumerable, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
    
    // Helper function to convert uint to string
    function _toString(uint256 value) internal pure returns (string memory) {
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
}