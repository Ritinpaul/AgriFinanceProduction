const { ethers } = require('ethers');

/**
 * External Faucet Service - Handles requests to various external faucet APIs
 * Supports: Chainstack, Alchemy, Infura, Blast API, Base Sepolia
 */

class ExternalFaucetService {
  constructor() {
    // Faucet provider configurations
    this.providers = {
      chainstack: {
        name: 'Chainstack',
        url: 'https://faucet.chainstack.com/sepolia',
        requiresApiKey: false,
        enabled: true
      },
      alchemy: {
        name: 'Alchemy',
        url: 'https://sepoliafaucet.com/api/faucet',
        requiresApiKey: false,
        enabled: true
      },
      infura: {
        name: 'Infura',
        url: 'https://www.infura.io/faucet/sepolia',
        requiresApiKey: true,
        apiKeyEnv: 'INFURA_API_KEY',
        projectIdEnv: 'INFURA_PROJECT_ID',
        enabled: !!(process.env.INFURA_API_KEY || process.env.INFURA_PROJECT_ID)
      },
      blast: {
        name: 'Blast API',
        url: 'https://faucet.blastapi.io/api/v1/eth',
        requiresApiKey: true,
        apiKeyEnv: 'BLAST_API_KEY',
        enabled: !!process.env.BLAST_API_KEY
      },
      baseSepolia: {
        name: 'Base Sepolia',
        url: 'https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet',
        requiresApiKey: false,
        enabled: true,
        note: 'May require login'
      }
    };
  }

  /**
   * Request from Chainstack Faucet
   * Note: Chainstack may require web interface or API key
   */
  async requestFromChainstack(walletAddress) {
    try {
      // Try different possible endpoints
      const endpoints = [
        'https://faucet.chainstack.com/sepolia',
        'https://api.chainstack.com/v1/faucet/sepolia',
        'https://faucet.chainstack.com/api/v1/sepolia'
      ];

      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              address: walletAddress,
              walletAddress: walletAddress,
              network: 'sepolia'
            })
          });

          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('text/html')) {
            continue; // Try next endpoint
          }

          if (!response.ok) {
            const errorText = await response.text().substring(0, 200);
            if (endpoint !== endpoints[endpoints.length - 1]) continue;
            throw new Error(`Chainstack faucet failed: ${response.status}`);
          }

          const result = await response.json().catch(() => ({ success: true }));
          return {
            success: true,
            txHash: result.txHash || result.hash || result.transactionHash || null,
            amount: result.amount || '0.1',
            provider: 'chainstack',
            providerName: 'Chainstack'
          };
        } catch (e) {
          if (endpoint === endpoints[endpoints.length - 1]) throw e;
          continue;
        }
      }

      throw new Error('Chainstack faucet requires web interface. Please visit https://faucet.chainstack.com/sepolia');
    } catch (error) {
      return {
        success: false,
        error: error.message,
        requiresWebInterface: true,
        url: 'https://faucet.chainstack.com/sepolia'
      };
    }
  }

  /**
   * Request from Alchemy Faucet
   * Note: Alchemy typically requires mainnet balance or login
   */
  async requestFromAlchemy(walletAddress) {
    try {
      const apiKey = process.env.ALCHEMY_API_KEY;
      
      // Try Alchemy API if key is available
      if (apiKey) {
        const response = await fetch(`https://eth-sepolia.g.alchemy.com/v2/${apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_requestFunds',
            params: [walletAddress]
          })
        });

        if (response.ok) {
          const result = await response.json();
          if (result.result) {
            return {
              success: true,
              txHash: result.result.txHash || null,
              amount: '0.1',
              provider: 'alchemy',
              providerName: 'Alchemy'
            };
          }
        }
      }

      // Fallback: Alchemy typically requires web interface
      throw new Error('Alchemy faucet requires login or mainnet balance. Please visit https://sepoliafaucet.com/');
    } catch (error) {
      return {
        success: false,
        error: error.message,
        requiresWebInterface: true,
        requiresMainnetBalance: true,
        url: 'https://sepoliafaucet.com/'
      };
    }
  }

  /**
   * Request from Infura Faucet
   * Infura uses RPC endpoints with project IDs
   */
  async requestFromInfura(walletAddress) {
    try {
      // Extract project ID from INFURA_API_KEY (which might be a full URL or just the key)
      let projectId = process.env.INFURA_PROJECT_ID;
      let apiKey = process.env.INFURA_API_KEY;
      
      // If INFURA_API_KEY is a URL, extract the project ID
      if (apiKey && apiKey.includes('/v3/')) {
        const match = apiKey.match(/\/v3\/([a-zA-Z0-9]+)/);
        if (match) {
          projectId = match[1];
        }
      } else if (apiKey && !projectId) {
        // If it's just the project ID
        projectId = apiKey.replace('https://', '').replace('http://', '').replace('gas.api.infura.io/v3/', '').replace('mainnet.infura.io/v3/', '').replace('sepolia.infura.io/v3/', '');
      }

      if (!projectId) {
        throw new Error('INFURA_API_KEY or INFURA_PROJECT_ID not configured');
      }

      console.log(`🚰 Requesting from Infura faucet for ${walletAddress} using project ID: ${projectId.substring(0, 10)}...`);

      // Infura faucet API endpoint (if available)
      // Try the Infura faucet API and RPC endpoints
      const endpoints = [
        `https://faucet.infura.io/v1/request/${walletAddress}`, // Dedicated faucet endpoint
        `https://faucet.infura.io/api/v1/sepolia`,
        `https://sepolia.infura.io/v3/${projectId}`,
        `https://gas.api.infura.io/v3/${projectId}`
      ];

      for (const endpoint of endpoints) {
        try {
          console.log(`   Trying endpoint: ${endpoint.substring(0, 60)}...`);
          
          // Try dedicated faucet endpoint (GET request with wallet address in URL)
          if (endpoint.includes('/v1/request/')) {
            const response = await fetch(endpoint, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${projectId}`,
                'Content-Type': 'application/json'
              }
            });

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('text/html')) {
              if (response.ok) {
                const result = await response.json().catch(() => ({}));
                if (result.txHash || result.hash || result.success) {
                  return {
                    success: true,
                    txHash: result.txHash || result.hash || null,
                    amount: result.amount || '0.1',
                    provider: 'infura',
                    providerName: 'Infura'
                  };
                }
              }
            }
          }
          // Try RPC method if using RPC endpoint
          else if (endpoint.includes('infura.io/v3/')) {
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'eth_requestFunds',
                params: [walletAddress]
              })
            });

            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('text/html')) {
              continue;
            }

            if (response.ok) {
              const result = await response.json();
              
              // Check if it's a successful RPC response
              if (result.result && !result.error) {
                return {
                  success: true,
                  txHash: result.result.txHash || result.result || null,
                  amount: '0.1',
                  provider: 'infura',
                  providerName: 'Infura'
                };
              }
            }
          } else {
            // Try REST API endpoint
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${projectId}`
              },
              body: JSON.stringify({
                address: walletAddress,
                walletAddress: walletAddress
              })
            });

            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('text/html')) {
              continue;
            }

            if (response.ok) {
              const result = await response.json();
              if (result.txHash || result.hash || result.success) {
                return {
                  success: true,
                  txHash: result.txHash || result.hash || null,
                  amount: result.amount || '0.1',
                  provider: 'infura',
                  providerName: 'Infura'
                };
              }
            }
          }
        } catch (e) {
          console.warn(`   Endpoint failed: ${e.message}`);
          if (endpoint === endpoints[endpoints.length - 1]) throw e;
          continue;
        }
      }

      // If all API attempts fail, Infura likely requires web interface
      throw new Error('Infura faucet API not available. Please use web interface.');
    } catch (error) {
      console.error('❌ Infura faucet error:', error);
      return {
        success: false,
        error: error.message || 'Infura faucet requires web interface',
        requiresWebInterface: true,
        url: 'https://www.infura.io/faucet/sepolia'
      };
    }
  }

  /**
   * Request from Blast API Faucet
   */
  async requestFromBlast(walletAddress) {
    try {
      const apiKey = process.env.BLAST_API_KEY;
      if (!apiKey) {
        throw new Error('BLAST_API_KEY not configured');
      }

      const response = await fetch('https://faucet.blastapi.io/api/v1/eth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          address: walletAddress,
          network: 'sepolia'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Blast API failed: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        txHash: result.txHash || result.hash || null,
        amount: result.amount || '0.1',
        provider: 'blast'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Request from Base Sepolia Faucet
   */
  async requestFromBaseSepolia(walletAddress) {
    try {
      // Base Sepolia typically requires login
      throw new Error('Base Sepolia faucet requires login. Please visit the website.');
    } catch (error) {
      return {
        success: false,
        error: error.message,
        requiresWebInterface: true,
        url: 'https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet'
      };
    }
  }

  /**
   * Try all available external faucets
   */
  async requestFromAnyProvider(walletAddress, preferredProvider = null) {
    const providersToTry = preferredProvider 
      ? [preferredProvider] 
      : ['chainstack', 'alchemy', 'infura', 'blast'];

    for (const providerId of providersToTry) {
      const provider = this.providers[providerId];
      if (!provider || !provider.enabled) continue;

      try {
        let result;
        switch (providerId) {
          case 'chainstack':
            result = await this.requestFromChainstack(walletAddress);
            break;
          case 'alchemy':
            result = await this.requestFromAlchemy(walletAddress);
            break;
          case 'infura':
            result = await this.requestFromInfura(walletAddress);
            break;
          case 'blast':
            result = await this.requestFromBlast(walletAddress);
            break;
          default:
            continue;
        }

        if (result.success) {
          return {
            ...result,
            providerName: provider.name
          };
        }
      } catch (error) {
        console.warn(`⚠️ ${provider.name} faucet failed:`, error.message);
        continue;
      }
    }

    return {
      success: false,
      error: 'All external faucets failed. Please try manual faucets or self-hosted faucet.'
    };
  }

  /**
   * Get available providers
   */
  getAvailableProviders() {
    return Object.entries(this.providers)
      .filter(([_, provider]) => provider.enabled)
      .map(([id, provider]) => ({
        id,
        name: provider.name,
        requiresApiKey: provider.requiresApiKey,
        requiresLogin: id === 'baseSepolia'
      }));
  }
}

const externalFaucetService = new ExternalFaucetService();

module.exports = externalFaucetService;

