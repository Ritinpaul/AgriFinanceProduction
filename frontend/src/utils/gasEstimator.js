/**
 * Gas Estimation Utilities
 * Provides gas cost estimation and display helpers
 */

/**
 * Format gas cost in ETH
 * @param {string|BigInt} gasUsed - Gas used in wei
 * @param {string|BigInt} gasPrice - Gas price in wei
 * @returns {string} Formatted cost in ETH
 */
export function formatGasCost(gasUsed, gasPrice) {
  try {
    const gasUsedBigInt = typeof gasUsed === 'string' ? BigInt(gasUsed) : gasUsed;
    const gasPriceBigInt = typeof gasPrice === 'string' ? BigInt(gasPrice) : gasPrice;
    const costWei = gasUsedBigInt * gasPriceBigInt;
    const costEth = Number(costWei) / 1e18;
    return costEth.toFixed(6);
  } catch (error) {
    return '0.000000';
  }
}

/**
 * Estimate gas cost for a transaction
 * @param {object} provider - Ethers provider
 * @param {string} methodName - Contract method name
 * @param {array} args - Method arguments
 * @param {object} contract - Contract instance
 * @returns {Promise<{estimatedGas: string, estimatedCost: string}>}
 */
export async function estimateGasCost(provider, contract, methodName, args = []) {
  try {
    if (!contract || !contract[methodName]) {
      return { estimatedGas: '0', estimatedCost: '0.000000' };
    }

    // Estimate gas
    const method = contract[methodName];
    const estimatedGas = await method.estimateGas(...args);
    
    // Get current gas price
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || feeData.maxFeePerGas || BigInt(21000000000); // Default 21 gwei
    
    const gasPriceBigInt = typeof gasPrice === 'string' ? BigInt(gasPrice) : gasPrice;
    const estimatedGasBigInt = typeof estimatedGas === 'string' ? BigInt(estimatedGas) : estimatedGas;
    
    // Calculate cost (add 20% buffer for safety)
    const gasWithBuffer = estimatedGasBigInt * BigInt(120) / BigInt(100);
    const costWei = gasWithBuffer * gasPriceBigInt;
    const costEth = Number(costWei) / 1e18;

    return {
      estimatedGas: gasWithBuffer.toString(),
      estimatedCost: costEth.toFixed(6),
      gasPrice: gasPriceBigInt.toString()
    };
    } catch (error) {
      return { 
        estimatedGas: '0', 
        estimatedCost: '0.000000',
        error: error.message 
      };
    }
}

/**
 * Format gas estimation display
 * @param {object} estimation - Gas estimation result
 * @param {string} network - Network name (sepolia, mainnet, etc.)
 * @returns {string} Formatted display string
 */
export function formatGasEstimation(estimation, network = 'sepolia') {
  if (estimation.error) {
    return `Gas estimation failed: ${estimation.error}`;
  }
  
  const costEth = parseFloat(estimation.estimatedCost);
  const networkName = network.charAt(0).toUpperCase() + network.slice(1);
  
  return `Estimated gas: ~${estimation.estimatedGas} units (~${costEth} ${networkName} ETH)`;
}

