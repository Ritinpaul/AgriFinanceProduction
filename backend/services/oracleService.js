const { ethers } = require('ethers');

// Chainlink price feed addresses (Sepolia testnet)
const PRICE_FEEDS = {
  // ETH/USD on Sepolia
  ETH_USD: '0x694AA1769357215DE4FAC081bf1f309aDC325306',
  // USDC/USD on Sepolia (if available)
  USDC_USD: '0xA2F78ab2355fe2f984D808B5CeE7FD0A93D5270E',
  // KRSI/USD - using ETH/USD as proxy for now (you can deploy your own aggregator)
  KRSI_USD: '0x694AA1769357215DE4FAC081bf1f309aDC325306'
};

// Chainlink Aggregator V3 Interface ABI (simplified)
const AGGREGATOR_V3_INTERFACE = [
  'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() external view returns (uint8)'
];

class OracleService {
  constructor(rpcUrl) {
    this.rpcUrl = rpcUrl || process.env.RPC_SEPOLIA || 'https://ethereum-sepolia.publicnode.com';
    this.provider = null;
    this.priceCache = new Map();
    this.priceHistory = new Map(); // Track price history for volatility
    this.cacheTimeout = 60000; // 1 minute cache
  }

  getProvider() {
    if (!this.provider) {
      this.provider = new ethers.providers.JsonRpcProvider(this.rpcUrl);
    }
    return this.provider;
  }

  async getPrice(feedAddress) {
    try {
      const provider = this.getProvider();
      const aggregator = new ethers.Contract(feedAddress, AGGREGATOR_V3_INTERFACE, provider);
      
      const [roundData, decimals] = await Promise.all([
        aggregator.latestRoundData(),
        aggregator.decimals()
      ]);

      // Handle BigNumber from ethers
      const answerValue = typeof roundData.answer === 'object' && roundData.answer.gt 
        ? roundData.answer 
        : ethers.BigNumber.from(roundData.answer || 0);
      
      const price = Number(answerValue.toString()) / Math.pow(10, decimals);
      const timestamp = Number(roundData.updatedAt.toString()) * 1000;

      return {
        price,
        timestamp,
        roundId: roundData.roundId.toString(),
        isValid: answerValue.gt(0) && timestamp > Date.now() - 3600000 // Valid if updated within 1 hour
      };
    } catch (error) {
      console.error('Chainlink price feed error:', error);
      return null;
    }
  }

  async getKRSIPrice() {
    // For now, use ETH/USD as proxy for KRSI
    // In production, deploy your own Chainlink aggregator or use another oracle
    const cacheKey = 'KRSI_USD';
    const cached = this.priceCache.get(cacheKey);
    
    if (cached && Date.now() - cached.cachedAt < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const ethPrice = await this.getPrice(PRICE_FEEDS.ETH_USD);
      if (!ethPrice || !ethPrice.isValid) {
        return { price: 0, volatility: 0, isValid: false };
      }

      // Mock conversion: assume 1 KRSI = 0.001 ETH (adjust based on your tokenomics)
      const krsiPrice = ethPrice.price * 0.001;
      
      // Calculate volatility from price history
      const volatility = this.calculateVolatility(cacheKey, krsiPrice);
      
      const result = {
        price: krsiPrice,
        volatility,
        timestamp: ethPrice.timestamp,
        isValid: true
      };

      this.priceCache.set(cacheKey, { data: result, cachedAt: Date.now() });
      return result;
    } catch (error) {
      console.error('KRSI price fetch error:', error);
      return { price: 0, volatility: 0, isValid: false };
    }
  }

  calculateVolatility(key, currentPrice) {
    if (!this.priceHistory.has(key)) {
      this.priceHistory.set(key, []);
    }

    const history = this.priceHistory.get(key);
    history.push({ price: currentPrice, timestamp: Date.now() });

    // Keep last 24 hours of data
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const filtered = history.filter(h => h.timestamp > cutoff);
    this.priceHistory.set(key, filtered);

    if (filtered.length < 2) return 0;

    // Calculate standard deviation as volatility proxy
    const prices = filtered.map(h => h.price);
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    
    // Return as percentage
    return mean > 0 ? (stdDev / mean) * 100 : 0;
  }

  async getETHPrice() {
    return this.getPrice(PRICE_FEEDS.ETH_USD);
  }
}

module.exports = OracleService;
