const { Web3Storage } = require('web3.storage');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

class ZKProverService {
    constructor(web3StorageToken) {
        this.storage = new Web3Storage({ token: web3StorageToken });
        this.circuitPath = path.join(__dirname, 'landDocumentVerifier_js');
        this.provingKeyPath = path.join(__dirname, 'landDocumentVerifier_0001.zkey');
        this.verificationKeyPath = path.join(__dirname, 'verification_key.json');
    }

    // Generate ZK proof for land document verification
    async generateLandDocumentProof(documentData, privateInputs) {
        try {
            console.log('🔐 Generating ZK proof for land document...');
            
            // Prepare inputs
            const inputs = {
                // Public inputs
                publicDocumentHash: documentData.documentHash,
                publicOwnerAddress: documentData.ownerAddress,
                publicLandId: documentData.landId,
                publicTimestamp: documentData.timestamp,
                publicOwnerHash: documentData.ownerHash,
                currentTimestamp: Math.floor(Date.now() / 1000),
                ageThreshold: documentData.ageThreshold || (365 * 24 * 60 * 60),
                
                // Private inputs
                ...privateInputs
            };

            // Write inputs to file
            const inputFile = path.join(__dirname, 'temp_input.json');
            fs.writeFileSync(inputFile, JSON.stringify(inputs, null, 2));

            // Generate witness
            const witnessFile = path.join(__dirname, 'temp_witness.wtns');
            execSync(`node ${this.circuitPath}/generate_witness.js ${this.circuitPath}/landDocumentVerifier.wasm ${inputFile} ${witnessFile}`, 
                { stdio: 'pipe' });

            // Generate proof
            const proofFile = path.join(__dirname, 'temp_proof.json');
            const publicFile = path.join(__dirname, 'temp_public.json');
            execSync(`snarkjs groth16 prove ${this.provingKeyPath} ${witnessFile} ${proofFile} ${publicFile}`, 
                { stdio: 'pipe' });

            // Read generated files
            const proof = JSON.parse(fs.readFileSync(proofFile, 'utf8'));
            const publicSignals = JSON.parse(fs.readFileSync(publicFile, 'utf8'));

            // Clean up temporary files
            [inputFile, witnessFile, proofFile, publicFile].forEach(file => {
                if (fs.existsSync(file)) fs.unlinkSync(file);
            });

            console.log('✅ ZK proof generated successfully!');
            
            return {
                proof,
                publicSignals,
                circuitId: 'landDocumentVerifier',
                timestamp: Date.now()
            };

        } catch (error) {
            console.error('❌ Proof generation failed:', error.message);
            throw new Error(`ZK proof generation failed: ${error.message}`);
        }
    }

    // Store proof artifacts on IPFS
    async storeProofOnIPFS(proofData, metadata = {}) {
        try {
            console.log('📦 Storing proof artifacts on IPFS...');
            
            // Create a directory for this proof
            const proofId = crypto.randomUUID();
            const proofDir = path.join(__dirname, 'temp_proofs', proofId);
            fs.mkdirSync(proofDir, { recursive: true });

            // Write proof data
            fs.writeFileSync(
                path.join(proofDir, 'proof.json'), 
                JSON.stringify(proofData.proof, null, 2)
            );
            
            fs.writeFileSync(
                path.join(proofDir, 'public_signals.json'), 
                JSON.stringify(proofData.publicSignals, null, 2)
            );
            
            fs.writeFileSync(
                path.join(proofDir, 'metadata.json'), 
                JSON.stringify({
                    circuitId: proofData.circuitId,
                    timestamp: proofData.timestamp,
                    ...metadata
                }, null, 2)
            );

            // Create a manifest file
            const manifest = {
                version: '1.0',
                circuitId: proofData.circuitId,
                timestamp: proofData.timestamp,
                files: [
                    'proof.json',
                    'public_signals.json',
                    'metadata.json'
                ]
            };
            
            fs.writeFileSync(
                path.join(proofDir, 'manifest.json'), 
                JSON.stringify(manifest, null, 2)
            );

            // Upload to IPFS
            const files = fs.readdirSync(proofDir).map(file => ({
                name: file,
                stream: () => fs.createReadStream(path.join(proofDir, file))
            }));

            const cid = await this.storage.put(files);
            
            // Clean up temporary directory
            fs.rmSync(proofDir, { recursive: true, force: true });

            console.log(`✅ Proof artifacts stored on IPFS with CID: ${cid}`);
            
            return {
                cid,
                proofId,
                manifest
            };

        } catch (error) {
            console.error('❌ IPFS storage failed:', error.message);
            throw new Error(`IPFS storage failed: ${error.message}`);
        }
    }

    // Verify proof locally (for testing)
    async verifyProofLocally(proof, publicSignals) {
        try {
            console.log('🔍 Verifying ZK proof locally...');
            
            // Write proof and public signals to temporary files
            const proofFile = path.join(__dirname, 'temp_verify_proof.json');
            const publicFile = path.join(__dirname, 'temp_verify_public.json');
            
            fs.writeFileSync(proofFile, JSON.stringify(proof, null, 2));
            fs.writeFileSync(publicFile, JSON.stringify(publicSignals, null, 2));

            // Verify proof
            execSync(`snarkjs groth16 verify ${this.verificationKeyPath} ${publicFile} ${proofFile}`, 
                { stdio: 'pipe' });

            // Clean up
            [proofFile, publicFile].forEach(file => {
                if (fs.existsSync(file)) fs.unlinkSync(file);
            });

            console.log('✅ Proof verification successful!');
            return true;

        } catch (error) {
            console.error('❌ Proof verification failed:', error.message);
            return false;
        }
    }

    // Retrieve proof from IPFS
    async retrieveProofFromIPFS(cid) {
        try {
            console.log(`📥 Retrieving proof from IPFS: ${cid}`);
            
            const res = await this.storage.get(cid);
            if (!res.ok) {
                throw new Error(`Failed to retrieve proof: ${res.status}`);
            }

            const files = await res.files();
            const proofData = {};

            for (const file of files) {
                const content = await file.text();
                const fileName = file.name;
                
                if (fileName === 'proof.json') {
                    proofData.proof = JSON.parse(content);
                } else if (fileName === 'public_signals.json') {
                    proofData.publicSignals = JSON.parse(content);
                } else if (fileName === 'metadata.json') {
                    proofData.metadata = JSON.parse(content);
                }
            }

            console.log('✅ Proof retrieved successfully!');
            return proofData;

        } catch (error) {
            console.error('❌ Proof retrieval failed:', error.message);
            throw new Error(`Proof retrieval failed: ${error.message}`);
        }
    }

    // Generate proof for land document and store on IPFS
    async processLandDocument(documentData, privateInputs, metadata = {}) {
        try {
            // Generate proof
            const proofData = await this.generateLandDocumentProof(documentData, privateInputs);
            
            // Store on IPFS
            const ipfsResult = await this.storeProofOnIPFS(proofData, metadata);
            
            // Verify locally
            const isValid = await this.verifyProofLocally(proofData.proof, proofData.publicSignals);
            
            if (!isValid) {
                throw new Error('Generated proof failed local verification');
            }

            return {
                proofData,
                ipfsResult,
                isValid
            };

        } catch (error) {
            console.error('❌ Land document processing failed:', error.message);
            throw error;
        }
    }
}

module.exports = ZKProverService;
