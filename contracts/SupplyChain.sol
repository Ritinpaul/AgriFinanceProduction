// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract SupplyChain is Ownable, ReentrancyGuard, Pausable {
    struct Batch {
        uint256 id;
        address farmer;
        string productType;
        uint256 quantity;
        uint256 pricePerUnit;
        uint256 totalValue;
        string location;
        uint256 harvestDate;
        string certification;
        bool isVerified;
        bool isSold;
        address buyer;
        uint256 saleTimestamp;
        string qrCodeHash;
    }

    struct Farmer {
        address farmerAddress;
        string name;
        string location;
        uint256 totalBatches;
        uint256 totalSales;
        uint256 reputation;
        bool isRegistered;
    }

    struct Buyer {
        address buyerAddress;
        string name;
        string organization;
        uint256 totalPurchases;
        bool isRegistered;
    }

    mapping(uint256 => Batch) public batches;
    mapping(address => Farmer) public farmers;
    mapping(address => Buyer) public buyers;
    mapping(address => uint256[]) public farmerBatches;
    mapping(address => uint256[]) public buyerPurchases;
    mapping(string => uint256) public qrHashToBatchId; // QR hash -> batch ID mapping

    uint256 public nextBatchId = 1;
    uint256 public constant FARMER_PROFIT_PERCENTAGE = 75; // 75% profit to farmer
    uint256 public constant PLATFORM_FEE_PERCENTAGE = 5; // 5% platform fee
    uint256 public constant VERIFICATION_FEE = 20; // 20 tokens for verification

    event FarmerRegistered(address indexed farmer, string name, string location);
    event BuyerRegistered(address indexed buyer, string name, string organization);
    event BatchCreated(uint256 indexed batchId, address indexed farmer, string productType, uint256 quantity);
    event BatchVerified(uint256 indexed batchId, address indexed verifier);
    event BatchSold(uint256 indexed batchId, address indexed buyer, uint256 price);
    event PaymentProcessed(uint256 indexed batchId, address indexed farmer, uint256 amount);

    constructor() Ownable(msg.sender) {}

    function registerFarmer(
        string memory _name,
        string memory _location
    ) external whenNotPaused {
        require(!farmers[msg.sender].isRegistered, "Farmer already registered");
        
        farmers[msg.sender] = Farmer({
            farmerAddress: msg.sender,
            name: _name,
            location: _location,
            totalBatches: 0,
            totalSales: 0,
            reputation: 100, // Starting reputation
            isRegistered: true
        });

        emit FarmerRegistered(msg.sender, _name, _location);
    }

    function registerBuyer(
        string memory _name,
        string memory _organization
    ) external whenNotPaused {
        require(!buyers[msg.sender].isRegistered, "Buyer already registered");
        
        buyers[msg.sender] = Buyer({
            buyerAddress: msg.sender,
            name: _name,
            organization: _organization,
            totalPurchases: 0,
            isRegistered: true
        });

        emit BuyerRegistered(msg.sender, _name, _organization);
    }

    function createBatch(
        string memory _productType,
        uint256 _quantity,
        uint256 _pricePerUnit,
        string memory _location,
        uint256 _harvestDate,
        string memory _certification,
        string memory _qrCodeHash
    ) external whenNotPaused nonReentrant rateLimited returns (uint256) {
        require(farmers[msg.sender].isRegistered, "Farmer not registered");
        require(_quantity > 0, "Quantity must be greater than zero");
        require(_quantity <= 1000000, "Quantity exceeds maximum limit");
        require(_pricePerUnit > 0, "Price per unit must be greater than zero");
        require(_pricePerUnit <= 1000 ether, "Price per unit exceeds maximum limit");
        require(bytes(_productType).length > 0, "Product type cannot be empty");
        require(bytes(_productType).length <= 50, "Product type too long");
        require(bytes(_location).length > 0, "Location cannot be empty");
        require(bytes(_location).length <= 100, "Location too long");
        require(bytes(_certification).length <= 200, "Certification too long");
        require(bytes(_qrCodeHash).length > 0, "QR code hash cannot be empty");

        uint256 batchId = nextBatchId++;
        uint256 totalValue = _quantity * _pricePerUnit;

        batches[batchId] = Batch({
            id: batchId,
            farmer: msg.sender,
            productType: _productType,
            quantity: _quantity,
            pricePerUnit: _pricePerUnit,
            totalValue: totalValue,
            location: _location,
            harvestDate: _harvestDate,
            certification: _certification,
            isVerified: false,
            isSold: false,
            buyer: address(0),
            saleTimestamp: 0,
            qrCodeHash: _qrCodeHash
        });

        farmerBatches[msg.sender].push(batchId);
        farmers[msg.sender].totalBatches++;
        
        // Map QR hash to batch ID for easy lookup
        qrHashToBatchId[_qrCodeHash] = batchId;

        emit BatchCreated(batchId, msg.sender, _productType, _quantity);
        
        return batchId;
    }

    function verifyBatch(uint256 _batchId) external onlyOwner {
        require(batches[_batchId].farmer != address(0), "Batch does not exist");
        require(!batches[_batchId].isVerified, "Batch already verified");
        require(!batches[_batchId].isSold, "Batch already sold");

        batches[_batchId].isVerified = true;
        
        // Increase farmer reputation for verified batch
        farmers[batches[_batchId].farmer].reputation += 10;

        emit BatchVerified(_batchId, msg.sender);
    }

    function purchaseBatch(uint256 _batchId) external payable nonReentrant {
        require(buyers[msg.sender].isRegistered, "Buyer not registered");
        require(batches[_batchId].farmer != address(0), "Batch does not exist");
        require(batches[_batchId].isVerified, "Batch not verified");
        require(!batches[_batchId].isSold, "Batch already sold");
        require(msg.value >= batches[_batchId].totalValue, "Insufficient payment");

        Batch storage batch = batches[_batchId];
        
        // Mark batch as sold
        batch.isSold = true;
        batch.buyer = msg.sender;
        batch.saleTimestamp = block.timestamp;

        // Update farmer stats
        farmers[batch.farmer].totalSales += batch.totalValue;
        farmers[batch.farmer].reputation += 5;

        // Update buyer stats
        buyers[msg.sender].totalPurchases += batch.totalValue;
        buyerPurchases[msg.sender].push(_batchId);

        // Process payment
        _processPayment(_batchId, batch.totalValue);

        emit BatchSold(_batchId, msg.sender, batch.totalValue);
    }

    function _processPayment(uint256 _batchId, uint256 _totalValue) internal {
        address farmer = batches[_batchId].farmer;
        
        // Calculate farmer's share (75% of total value)
        uint256 farmerShare = (_totalValue * FARMER_PROFIT_PERCENTAGE) / 100;
        
        // Calculate platform fee (5% of total value)
        uint256 platformFee = (_totalValue * PLATFORM_FEE_PERCENTAGE) / 100;
        
        // Transfer farmer's share
        payable(farmer).transfer(farmerShare);
        
        // Transfer platform fee to owner
        payable(owner()).transfer(platformFee);

        emit PaymentProcessed(_batchId, farmer, farmerShare);
    }

    function getBatchDetails(uint256 _batchId) external view returns (Batch memory) {
        return batches[_batchId];
    }

    function getFarmerBatches(address _farmer) external view returns (uint256[] memory) {
        return farmerBatches[_farmer];
    }

    function getBuyerPurchases(address _buyer) external view returns (uint256[] memory) {
        return buyerPurchases[_buyer];
    }

    function getFarmerDetails(address _farmer) external view returns (Farmer memory) {
        return farmers[_farmer];
    }

    function getBuyerDetails(address _buyer) external view returns (Buyer memory) {
        return buyers[_buyer];
    }

    function verifyBatchByQR(string memory _qrCodeHash) external view returns (uint256) {
        // Direct lookup using mapping for better gas efficiency
        uint256 batchId = qrHashToBatchId[_qrCodeHash];
        require(batchId > 0, "Batch not found for QR hash");
        return batchId;
    }
    
    function getBatchByQR(string memory _qrCodeHash) external view returns (Batch memory) {
        uint256 batchId = qrHashToBatchId[_qrCodeHash];
        require(batchId > 0, "Batch not found for QR hash");
        return batches[batchId];
    }

    function getBatchTraceability(uint256 _batchId) external view returns (
        address farmer,
        string memory productType,
        string memory location,
        uint256 harvestDate,
        string memory certification,
        bool isVerified,
        address buyer,
        uint256 saleTimestamp
    ) {
        Batch memory batch = batches[_batchId];
        return (
            batch.farmer,
            batch.productType,
            batch.location,
            batch.harvestDate,
            batch.certification,
            batch.isVerified,
            batch.buyer,
            batch.saleTimestamp
        );
    }

    // Emergency pause/unpause functions
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Emergency functions for critical situations
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    // Rate limiting for batch creation (max 10 batches per day per farmer)
    mapping(address => uint256) public lastBatchCreation;
    mapping(address => uint256) public dailyBatchCount;
    uint256 public constant MAX_BATCHES_PER_DAY = 10;
    uint256 public constant BATCH_COOLDOWN = 1 hours;

    modifier rateLimited() {
        require(
            block.timestamp >= lastBatchCreation[msg.sender] + BATCH_COOLDOWN,
            "Batch creation cooldown not met"
        );
        
        // Reset daily count if it's a new day
        if (block.timestamp >= lastBatchCreation[msg.sender] + 1 days) {
            dailyBatchCount[msg.sender] = 0;
        }
        
        require(
            dailyBatchCount[msg.sender] < MAX_BATCHES_PER_DAY,
            "Daily batch limit exceeded"
        );
        
        dailyBatchCount[msg.sender]++;
        lastBatchCreation[msg.sender] = block.timestamp;
        _;
    }
}
