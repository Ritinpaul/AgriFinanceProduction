const ZKProverService = require('../../zk-circuits/proverService');
const { ethers } = require('ethers');

class ZKIntegrationService {
    constructor(web3StorageToken, provider, contractAddresses) {
        this.proverService = new ZKProverService(web3StorageToken);
        this.provider = provider;
        this.contractAddresses = contractAddresses;
        
        // Contract ABIs (simplified)
        this.zkVerifierABI = [
            "function verifyLandDocumentProof(uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[] memory publicSignals, bytes32 commitment) external returns (bool)",
            "function isProofVerified(bytes32 proofHash) external view returns (bool)",
            "function getProofData(bytes32 proofHash) external view returns (tuple(string circuitId, uint256 timestamp, address verifier, bytes32 commitment, bool isValid, bool revoked))"
        ];
        
        this.landNFTABI = [
            "function verifyWithZKProof(uint256 tokenId, bytes32 zkProofHash, uint256[2] memory a, uint256[2][2] memory b, uint256[2] memory c, uint256[] memory publicSignals, bytes32 commitment) external returns (bool)",
            "function getLandData(uint256 tokenId) external view returns (tuple(string landId, string location, uint256 area, string coordinates, uint256 timestamp, bytes32 documentHash, bytes32 zkProofHash, bool isVerified, bool isZKVerified, string metadataURI))",
            "function isLandZKVerified(uint256 tokenId) external view returns (bool)"
        ];
    }

    /**
     * Process land document verification with ZK proofs
     * @param {Object} landDocument - The land document data
     * @param {Object} privateInputs - Private inputs for ZK proof
     * @param {Object} metadata - Additional metadata
     * @returns {Object} Processing result
     */
    async processLandDocumentVerification(landDocument, privateInputs, metadata = {}) {
        try {
            console.log('🔐 Processing land document verification with ZK proofs...');
            
            // Generate ZK proof
            const proofResult = await this.proverService.processLandDocument(
                landDocument,
                privateInputs,
                {
                    ...metadata,
                    landId: landDocument.landId,
                    ownerAddress: landDocument.ownerAddress,
                    timestamp: Date.now()
                }
            );

            // Verify proof on-chain
            const onChainVerification = await this.verifyProofOnChain(
                proofResult.proofData.proof,
                proofResult.proofData.publicSignals,
                proofResult.proofData.commitment
            );

            return {
                success: true,
                proofResult,
                onChainVerification,
                ipfsCID: proofResult.ipfsResult.cid,
                proofId: proofResult.ipfsResult.proofId
            };

        } catch (error) {
            console.error('❌ Land document verification failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Verify ZK proof on-chain
     * @param {Object} proof - The ZK proof
     * @param {Array} publicSignals - Public signals
     * @param {string} commitment - Commitment hash
     * @returns {Object} Verification result
     */
    async verifyProofOnChain(proof, publicSignals, commitment) {
        try {
            console.log('⛓️ Verifying ZK proof on-chain...');
            
            const zkVerifier = new ethers.Contract(
                this.contractAddresses.zkVerifier,
                this.zkVerifierABI,
                this.provider
            );

            // Convert proof format for on-chain verification
            const proofData = {
                a: [proof.pi_a[0], proof.pi_a[1]],
                b: [[proof.pi_b[0][0], proof.pi_b[0][1]], [proof.pi_b[1][0], proof.pi_b[1][1]]],
                c: [proof.pi_c[0], proof.pi_c[1]],
                publicSignals: publicSignals,
                commitment: commitment
            };

            // Verify proof on-chain
            const tx = await zkVerifier.verifyLandDocumentProof(
                proofData.a,
                proofData.b,
                proofData.c,
                proofData.publicSignals,
                proofData.commitment
            );

            const receipt = await tx.wait();
            
            console.log('✅ On-chain verification successful!');
            
            return {
                success: true,
                txHash: receipt.transactionHash,
                gasUsed: receipt.gasUsed.toString(),
                blockNumber: receipt.blockNumber
            };

        } catch (error) {
            console.error('❌ On-chain verification failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Link ZK proof to LandNFT
     * @param {number} tokenId - The LandNFT token ID
     * @param {Object} proofResult - The proof result from prover service
     * @returns {Object} Linking result
     */
    async linkProofToLandNFT(tokenId, proofResult) {
        try {
            console.log(`🔗 Linking ZK proof to LandNFT token ${tokenId}...`);
            
            const landNFT = new ethers.Contract(
                this.contractAddresses.landNFT,
                this.landNFTABI,
                this.provider
            );

            // Generate proof hash
            const proofHash = ethers.keccak256(
                ethers.AbiCoder.defaultAbiCoder().encode(
                    ['uint256[2]', 'uint256[2][2]', 'uint256[2]', 'uint256[]', 'bytes32'],
                    [
                        proofResult.proofData.proof.pi_a,
                        proofResult.proofData.proof.pi_b,
                        proofResult.proofData.proof.pi_c,
                        proofResult.proofData.publicSignals,
                        proofResult.proofData.commitment
                    ]
                )
            );

            // Link proof to LandNFT
            const tx = await landNFT.verifyWithZKProof(
                tokenId,
                proofHash,
                proofResult.proofData.proof.pi_a,
                proofResult.proofData.proof.pi_b,
                proofResult.proofData.proof.pi_c,
                proofResult.proofData.publicSignals,
                proofResult.proofData.commitment
            );

            const receipt = await tx.wait();
            
            console.log('✅ ZK proof linked to LandNFT successfully!');
            
            return {
                success: true,
                txHash: receipt.transactionHash,
                proofHash: proofHash,
                gasUsed: receipt.gasUsed.toString()
            };

        } catch (error) {
            console.error('❌ Linking proof to LandNFT failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check if a land is ZK verified
     * @param {number} tokenId - The LandNFT token ID
     * @returns {Object} Verification status
     */
    async checkLandZKVerification(tokenId) {
        try {
            console.log(`🔍 Checking ZK verification status for LandNFT token ${tokenId}...`);
            
            const landNFT = new ethers.Contract(
                this.contractAddresses.landNFT,
                this.landNFTABI,
                this.provider
            );

            const isZKVerified = await landNFT.isLandZKVerified(tokenId);
            const landData = await landNFT.getLandData(tokenId);
            
            return {
                success: true,
                isZKVerified,
                landData: {
                    landId: landData.landId,
                    location: landData.location,
                    area: landData.area.toString(),
                    coordinates: landData.coordinates,
                    timestamp: landData.timestamp.toString(),
                    documentHash: landData.documentHash,
                    zkProofHash: landData.zkProofHash,
                    isVerified: landData.isVerified,
                    isZKVerified: landData.isZKVerified,
                    metadataURI: landData.metadataURI
                }
            };

        } catch (error) {
            console.error('❌ Checking ZK verification failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Retrieve proof from IPFS and verify
     * @param {string} cid - The IPFS CID
     * @returns {Object} Proof data
     */
    async retrieveAndVerifyProof(cid) {
        try {
            console.log(`📥 Retrieving proof from IPFS: ${cid}...`);
            
            const proofData = await this.proverService.retrieveProofFromIPFS(cid);
            
            // Verify proof locally
            const isValid = await this.proverService.verifyProofLocally(
                proofData.proof,
                proofData.publicSignals
            );
            
            return {
                success: true,
                proofData,
                isValid
            };

        } catch (error) {
            console.error('❌ Retrieving proof failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate sample land document data for testing
     * @returns {Object} Sample land document data
     */
    generateSampleLandDocument() {
        const timestamp = Math.floor(Date.now() / 1000) - (365 * 24 * 60 * 60); // 1 year ago
        
        return {
            landId: `LAND_${Date.now()}`,
            ownerAddress: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
            documentHash: ethers.keccak256(ethers.toUtf8Bytes(`land_document_${timestamp}`)),
            ownerHash: ethers.keccak256(ethers.toUtf8Bytes("owner_identity_hash")),
            timestamp: timestamp,
            ageThreshold: 365 * 24 * 60 * 60, // 1 year
            location: "Sample Farm Location",
            area: 1000, // square meters
            coordinates: "40.7128,-74.0060"
        };
    }

    /**
     * Generate sample private inputs for testing
     * @param {Object} publicData - Public data to match
     * @returns {Object} Private inputs
     */
    generateSamplePrivateInputs(publicData) {
        return {
            privateDocumentHash: publicData.documentHash,
            privateOwnerAddress: publicData.ownerAddress,
            privateLandId: publicData.landId,
            privateTimestamp: publicData.timestamp,
            privateSignature: ethers.keccak256(ethers.toUtf8Bytes("document_signature")),
            privateSecretKey: ethers.keccak256(ethers.toUtf8Bytes("secret_key")),
            privateSecretSalt: ethers.keccak256(ethers.toUtf8Bytes("secret_salt"))
        };
    }
}

module.exports = ZKIntegrationService;
