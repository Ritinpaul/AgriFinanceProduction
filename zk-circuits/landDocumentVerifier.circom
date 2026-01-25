pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/bitify.circom";

// Land Document Verification Circuit
// This circuit verifies that a land document is valid without revealing its contents
template LandDocumentVerifier() {
    // Public inputs (known to verifier)
    signal input publicDocumentHash;     // Hash of the document (public)
    signal input publicOwnerAddress;    // Owner's address (public)
    signal input publicLandId;          // Land ID (public)
    signal input publicTimestamp;       // Document timestamp (public)
    
    // Private inputs (hidden from verifier)
    signal private input privateDocumentHash;    // Actual document hash (private)
    signal private input privateOwnerAddress;    // Actual owner address (private)
    signal private input privateLandId;          // Actual land ID (private)
    signal private input privateTimestamp;       // Actual timestamp (private)
    signal private input privateSignature;      // Document signature (private)
    signal private input privateSecretKey;      // Secret key for verification (private)
    
    // Outputs
    signal output isValid;              // Whether the document is valid
    signal output commitment;           // Commitment to the verification
    
    // Component instances
    component poseidon = Poseidon(5);
    component eq1 = IsEqual();
    component eq2 = IsEqual();
    component eq3 = IsEqual();
    component eq4 = IsEqual();
    
    // Verify that private inputs match public inputs
    eq1.in[0] <== privateDocumentHash;
    eq1.in[1] <== publicDocumentHash;
    
    eq2.in[0] <== privateOwnerAddress;
    eq2.in[1] <== publicOwnerAddress;
    
    eq3.in[0] <== privateLandId;
    eq3.in[1] <== publicLandId;
    
    eq4.in[0] <== privateTimestamp;
    eq4.in[1] <== publicTimestamp;
    
    // Verify signature (simplified - in practice you'd use proper signature verification)
    // For this example, we'll use a simple hash-based verification
    component signatureVerifier = Poseidon(3);
    signatureVerifier.inputs[0] <== privateDocumentHash;
    signatureVerifier.inputs[1] <== privateOwnerAddress;
    signatureVerifier.inputs[2] <== privateSecretKey;
    
    // Check if signature matches
    component sigEq = IsEqual();
    sigEq.in[0] <== signatureVerifier.out;
    sigEq.in[1] <== privateSignature;
    
    // All conditions must be true for valid document
    isValid <== eq1.out * eq2.out * eq3.out * eq4.out * sigEq.out;
    
    // Create commitment to the verification
    poseidon.inputs[0] <== privateDocumentHash;
    poseidon.inputs[1] <== privateOwnerAddress;
    poseidon.inputs[2] <== privateLandId;
    poseidon.inputs[3] <== privateTimestamp;
    poseidon.inputs[4] <== isValid;
    
    commitment <== poseidon.out;
}

// Document Age Verification Circuit
// Proves that a document is older than a certain threshold without revealing exact age
template DocumentAgeVerifier(minAge) {
    signal input currentTimestamp;
    signal input documentTimestamp;
    signal input ageThreshold;
    
    signal output isOldEnough;
    
    component ageCheck = LessThan(32);
    ageCheck.in[0] <== currentTimestamp - documentTimestamp;
    ageCheck.in[1] <== ageThreshold;
    
    isOldEnough <== ageCheck.out;
}

// Land Ownership Proof Circuit
// Proves ownership of land without revealing the owner's identity
template LandOwnershipProof() {
    signal input publicLandId;
    signal input publicOwnerHash;       // Hash of owner's identity
    
    signal private input privateLandId;
    signal private input privateOwnerAddress;
    signal private input privateSecretSalt;
    
    signal output isValidOwnership;
    signal output ownershipCommitment;
    
    component eq = IsEqual();
    eq.in[0] <== privateLandId;
    eq.in[1] <== publicLandId;
    
    component ownerHash = Poseidon(2);
    ownerHash.inputs[0] <== privateOwnerAddress;
    ownerHash.inputs[1] <== privateSecretSalt;
    
    component hashEq = IsEqual();
    hashEq.in[0] <== ownerHash.out;
    hashEq.in[1] <== publicOwnerHash;
    
    isValidOwnership <== eq.out * hashEq.out;
    
    component commitment = Poseidon(3);
    commitment.inputs[0] <== privateLandId;
    commitment.inputs[1] <== privateOwnerAddress;
    commitment.inputs[2] <== isValidOwnership;
    
    ownershipCommitment <== commitment.out;
}

// Main circuit that combines all verification components
template AgriFinanceZKVerifier() {
    signal input publicDocumentHash;
    signal input publicOwnerAddress;
    signal input publicLandId;
    signal input publicTimestamp;
    signal input publicOwnerHash;
    signal input currentTimestamp;
    signal input ageThreshold;
    
    signal private input privateDocumentHash;
    signal private input privateOwnerAddress;
    signal private input privateLandId;
    signal private input privateTimestamp;
    signal private input privateSignature;
    signal private input privateSecretKey;
    signal private input privateSecretSalt;
    
    signal output isValidDocument;
    signal output isValidOwnership;
    signal output isOldEnough;
    signal output finalCommitment;
    
    // Document verification
    component docVerifier = LandDocumentVerifier();
    docVerifier.publicDocumentHash <== publicDocumentHash;
    docVerifier.publicOwnerAddress <== publicOwnerAddress;
    docVerifier.publicLandId <== publicLandId;
    docVerifier.publicTimestamp <== publicTimestamp;
    docVerifier.privateDocumentHash <== privateDocumentHash;
    docVerifier.privateOwnerAddress <== privateOwnerAddress;
    docVerifier.privateLandId <== privateLandId;
    docVerifier.privateTimestamp <== privateTimestamp;
    docVerifier.privateSignature <== privateSignature;
    docVerifier.privateSecretKey <== privateSecretKey;
    
    // Ownership proof
    component ownershipProof = LandOwnershipProof();
    ownershipProof.publicLandId <== publicLandId;
    ownershipProof.publicOwnerHash <== publicOwnerHash;
    ownershipProof.privateLandId <== privateLandId;
    ownershipProof.privateOwnerAddress <== privateOwnerAddress;
    ownershipProof.privateSecretSalt <== privateSecretSalt;
    
    // Age verification
    component ageVerifier = DocumentAgeVerifier(365 * 24 * 60 * 60); // 1 year in seconds
    ageVerifier.currentTimestamp <== currentTimestamp;
    ageVerifier.documentTimestamp <== publicTimestamp;
    ageVerifier.ageThreshold <== ageThreshold;
    
    // Outputs
    isValidDocument <== docVerifier.isValid;
    isValidOwnership <== ownershipProof.isValidOwnership;
    isOldEnough <== ageVerifier.isOldEnough;
    
    // Final commitment
    component finalCommit = Poseidon(4);
    finalCommit.inputs[0] <== docVerifier.commitment;
    finalCommit.inputs[1] <== ownershipProof.ownershipCommitment;
    finalCommit.inputs[2] <== isValidDocument;
    finalCommit.inputs[3] <== isValidOwnership;
    
    finalCommitment <== finalCommit.out;
}

// Compile the main circuit
component main = AgriFinanceZKVerifier();
