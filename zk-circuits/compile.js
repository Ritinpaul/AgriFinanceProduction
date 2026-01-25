const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Compile ZK circuits
function compileCircuits() {
    console.log('🔧 Compiling ZK circuits...');
    
    try {
        // Compile the main circuit
        execSync('circom landDocumentVerifier.circom --r1cs --wasm --sym --c', { stdio: 'inherit' });
        console.log('✅ Circuit compiled successfully!');
        
        // Generate setup files
        console.log('🔧 Generating trusted setup...');
        execSync('snarkjs powersoftau new bn128 12 pot12_0000.ptau -v', { stdio: 'inherit' });
        execSync('snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v', { stdio: 'inherit' });
        execSync('snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v', { stdio: 'inherit' });
        
        // Generate proving key
        execSync('snarkjs groth16 setup landDocumentVerifier.r1cs pot12_final.ptau landDocumentVerifier_0000.zkey', { stdio: 'inherit' });
        execSync('snarkjs zkey contribute landDocumentVerifier_0000.zkey landDocumentVerifier_0001.zkey --name="First contribution" -v', { stdio: 'inherit' });
        execSync('snarkjs zkey export verificationkey landDocumentVerifier_0001.zkey verification_key.json', { stdio: 'inherit' });
        
        console.log('✅ Trusted setup completed!');
        
    } catch (error) {
        console.error('❌ Compilation failed:', error.message);
        process.exit(1);
    }
}

// Generate test inputs
function generateTestInputs() {
    console.log('🧪 Generating test inputs...');
    
    const testInputs = {
        // Public inputs
        publicDocumentHash: "1234567890123456789012345678901234567890123456789012345678901234",
        publicOwnerAddress: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
        publicLandId: "LAND_001",
        publicTimestamp: Math.floor(Date.now() / 1000) - (365 * 24 * 60 * 60), // 1 year ago
        publicOwnerHash: "9876543210987654321098765432109876543210987654321098765432109876",
        currentTimestamp: Math.floor(Date.now() / 1000),
        ageThreshold: 365 * 24 * 60 * 60, // 1 year
        
        // Private inputs (same values as public for testing)
        privateDocumentHash: "1234567890123456789012345678901234567890123456789012345678901234",
        privateOwnerAddress: "0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6",
        privateLandId: "LAND_001",
        privateTimestamp: Math.floor(Date.now() / 1000) - (365 * 24 * 60 * 60),
        privateSignature: "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
        privateSecretKey: "secretkey123456789012345678901234567890",
        privateSecretSalt: "saltsalt123456789012345678901234567890"
    };
    
    fs.writeFileSync('input.json', JSON.stringify(testInputs, null, 2));
    console.log('✅ Test inputs generated!');
}

// Generate proof
function generateProof() {
    console.log('🔐 Generating ZK proof...');
    
    try {
        // Generate witness
        execSync('node landDocumentVerifier_js/generate_witness.js landDocumentVerifier_js/landDocumentVerifier.wasm input.json witness.wtns', { stdio: 'inherit' });
        
        // Generate proof
        execSync('snarkjs groth16 prove landDocumentVerifier_0001.zkey witness.wtns proof.json public.json', { stdio: 'inherit' });
        
        console.log('✅ ZK proof generated successfully!');
        
        // Verify proof
        execSync('snarkjs groth16 verify verification_key.json public.json proof.json', { stdio: 'inherit' });
        
        console.log('✅ Proof verification successful!');
        
    } catch (error) {
        console.error('❌ Proof generation failed:', error.message);
        process.exit(1);
    }
}

// Main execution
if (require.main === module) {
    const command = process.argv[2];
    
    switch (command) {
        case 'compile':
            compileCircuits();
            break;
        case 'test':
            generateTestInputs();
            generateProof();
            break;
        case 'proof':
            generateProof();
            break;
        default:
            console.log('Usage: node compile.js [compile|test|proof]');
            console.log('  compile: Compile circuits and generate trusted setup');
            console.log('  test: Generate test inputs and create proof');
            console.log('  proof: Generate proof from existing inputs');
    }
}

module.exports = {
    compileCircuits,
    generateTestInputs,
    generateProof
};
