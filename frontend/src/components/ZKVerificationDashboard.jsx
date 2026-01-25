import React, { useState, useEffect } from 'react';
import { useWeb3 } from '../context/Web3Context';
import { useAuth } from '../context/AuthContext';

const ZKVerificationDashboard = () => {
  const { account, contracts } = useWeb3();
  const { user } = useAuth();
  const [landDocuments, setLandDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [proofStatus, setProofStatus] = useState({});
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [isVerifyingProof, setIsVerifyingProof] = useState(false);
  const [sampleData, setSampleData] = useState(null);
  
  // New state for interactive functionality
  const [uploadedFile, setUploadedFile] = useState(null);
  const [landData, setLandData] = useState({
    landId: '',
    ownerAddress: '',
    location: '',
    area: '',
    coordinates: '',
    documentHash: ''
  });
  const [privateInputs, setPrivateInputs] = useState({
    ownerPrivateKey: '',
    documentSignature: '',
    ownershipProof: ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Load sample data for testing
  useEffect(() => {
    loadSampleData();
  }, []);

  const loadSampleData = async () => {
    try {
      const response = await fetch('/api/zk/sample-data', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      if (data.success) {
        setSampleData(data);
      }
    } catch (error) {
      console.error('Failed to load sample data:', error);
    }
  };

  const generateZKProof = async (landDocument, privateInputs) => {
    setIsGeneratingProof(true);
    try {
      const response = await fetch('/api/zk/generate-proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          landDocument,
          privateInputs,
          metadata: {
            generatedBy: account,
            timestamp: Date.now()
          }
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setProofStatus(prev => ({
          ...prev,
          [landDocument.landId]: {
            status: 'generated',
            proofResult: result.proofResult,
            ipfsCID: result.ipfsResult.cid
          }
        }));
        
        // Auto-verify the proof
        await verifyZKProof(result.proofResult.proofData);
      } else {
        console.error('Proof generation failed:', result.error);
      }
    } catch (error) {
      console.error('Failed to generate ZK proof:', error);
    } finally {
      setIsGeneratingProof(false);
    }
  };

  const verifyZKProof = async (proofData) => {
    setIsVerifyingProof(true);
    try {
      const response = await fetch('/api/zk/verify-proof', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          proof: proofData.proof,
          publicSignals: proofData.publicSignals,
          commitment: proofData.commitment
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setProofStatus(prev => ({
          ...prev,
          [selectedDocument?.landId]: {
            ...prev[selectedDocument?.landId],
            status: 'verified',
            onChainVerification: result
          }
        }));
      } else {
        console.error('Proof verification failed:', result.error);
      }
    } catch (error) {
      console.error('Failed to verify ZK proof:', error);
    } finally {
      setIsVerifyingProof(false);
    }
  };

  const linkProofToLandNFT = async (tokenId, proofResult) => {
    try {
      const response = await fetch('/api/zk/link-to-landnft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          tokenId,
          proofResult
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setProofStatus(prev => ({
          ...prev,
          [selectedDocument?.landId]: {
            ...prev[selectedDocument?.landId],
            status: 'linked',
            landNFTLink: result
          }
        }));
      } else {
        console.error('Proof linking failed:', result.error);
      }
    } catch (error) {
      console.error('Failed to link proof to LandNFT:', error);
    }
  };

  const checkLandVerification = async (tokenId) => {
    try {
      const response = await fetch(`/api/zk/land-verification/${tokenId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Failed to check land verification:', error);
      return null;
    }
  };

  const handleGenerateProof = async () => {
    if (!sampleData) return;
    
    await generateZKProof(sampleData.landDocument, sampleData.privateInputs);
  };

  // New functions for interactive functionality
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      // Read file content
      const fileContent = await file.text();
      
      // Try to parse as JSON (for structured land documents)
      try {
        const parsedData = JSON.parse(fileContent);
        setLandData(prev => ({
          ...prev,
          landId: parsedData.landId || '',
          ownerAddress: parsedData.ownerAddress || '',
          location: parsedData.location || '',
          area: parsedData.area || '',
          coordinates: parsedData.coordinates || '',
          documentHash: parsedData.documentHash || ''
        }));
      } catch {
        // If not JSON, treat as plain text document
        const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fileContent));
        const hashHex = Array.from(new Uint8Array(hash))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
        
        setLandData(prev => ({
          ...prev,
          documentHash: hashHex,
          landId: `LAND-${Date.now()}`,
          location: 'Uploaded Document',
          area: 'Unknown',
          coordinates: '0,0'
        }));
      }

      setUploadedFile(file);
    } catch (error) {
      console.error('File upload error:', error);
      setUploadError('Failed to process uploaded file');
    } finally {
      setIsUploading(false);
    }
  };

  const handleLandDataChange = (field, value) => {
    setLandData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Auto-generate coordinates when location changes (for farmers)
    if (field === 'location' && user?.role === 'farmer') {
      generateCoordinatesFromLocation(value);
    }
  };

  const handlePrivateInputsChange = (field, value) => {
    setPrivateInputs(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleGenerateCustomProof = async () => {
    if (!landData.landId || !landData.ownerAddress) {
      setUploadError('Please fill in Land ID and Owner Address');
      return;
    }

    const customLandDocument = {
      ...landData,
      timestamp: Date.now()
    };

    await generateZKProof(customLandDocument, privateInputs);
  };

  const generateDocumentHash = () => {
    const dataString = JSON.stringify(landData);
    const hash = btoa(dataString).replace(/[^a-zA-Z0-9]/g, '').substring(0, 64);
    setLandData(prev => ({
      ...prev,
      documentHash: hash
    }));
  };

  // Auto-generate coordinates from location (farmer-friendly)
  const generateCoordinatesFromLocation = (location) => {
    if (!location || user?.role !== 'farmer') return;
    
    try {
      // Simple mock coordinates based on common Indian farming regions
      const mockCoordinates = {
        'punjab': '30.7333,76.7794',
        'haryana': '29.0588,76.0856',
        'uttar pradesh': '26.8467,80.9462',
        'maharashtra': '19.7515,75.7139',
        'karnataka': '15.3173,75.7139',
        'tamil nadu': '11.1271,78.6569',
        'gujarat': '23.0225,72.5714',
        'rajasthan': '27.0238,74.2179',
        'west bengal': '22.9868,87.8550',
        'andhra pradesh': '15.9129,79.7400'
      };
      
      const locationLower = location.toLowerCase();
      for (const [region, coords] of Object.entries(mockCoordinates)) {
        if (locationLower.includes(region)) {
          setLandData(prev => ({
            ...prev,
            coordinates: coords
          }));
          return;
        }
      }
      
      // Default coordinates if no match found
      setLandData(prev => ({
        ...prev,
        coordinates: '28.6139,77.2090' // Delhi coordinates as default
      }));
    } catch (error) {
      console.error('Error generating coordinates:', error);
    }
  };

  const handleLinkToLandNFT = async () => {
    if (!selectedDocument || !proofStatus[selectedDocument.landId]?.proofResult) return;
    
    // For demo purposes, use token ID 1
    await linkProofToLandNFT(1, proofStatus[selectedDocument.landId].proofResult);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'generated': return 'text-blue-600';
      case 'verified': return 'text-green-600';
      case 'linked': return 'text-purple-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'generated': return '🔐';
      case 'verified': return '✅';
      case 'linked': return '🔗';
      default: return '⏳';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            🔐 ZK Proof Verification Dashboard
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Generate and verify Zero-Knowledge proofs for land document verification
          </p>
        </div>

        {/* Interactive Upload and Form Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            📁 Upload Land Document or Enter Data Manually
          </h2>
          
          {/* File Upload Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Upload Land Document (JSON or Text)
            </label>
            <div className="flex items-center space-x-4">
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".json,.txt,.pdf"
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                disabled={isUploading}
              />
              {isUploading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              )}
            </div>
            {uploadedFile && (
              <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                ✅ File uploaded: {uploadedFile.name}
              </p>
            )}
            {uploadError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                ❌ {uploadError}
              </p>
            )}
          </div>

          {/* Manual Data Entry Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Land Document Data */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                📋 Land Document Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Land ID
                  </label>
                  <input
                    type="text"
                    value={landData.landId}
                    onChange={(e) => handleLandDataChange('landId', e.target.value)}
                    placeholder="e.g., LAND-001"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Owner Address
                  </label>
                  <input
                    type="text"
                    value={landData.ownerAddress}
                    onChange={(e) => handleLandDataChange('ownerAddress', e.target.value)}
                    placeholder="0x..."
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={landData.location}
                    onChange={(e) => handleLandDataChange('location', e.target.value)}
                    placeholder="e.g., Punjab, India"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Area
                  </label>
                  <input
                    type="text"
                    value={landData.area}
                    onChange={(e) => handleLandDataChange('area', e.target.value)}
                    placeholder="e.g., 2.5 acres"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Coordinates
                  </label>
                  <input
                    type="text"
                    value={landData.coordinates}
                    onChange={(e) => handleLandDataChange('coordinates', e.target.value)}
                    placeholder="e.g., 30.7333,76.7794"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Document Hash
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={landData.documentHash}
                      onChange={(e) => handleLandDataChange('documentHash', e.target.value)}
                      placeholder="Auto-generated or manual"
                      className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <button
                      onClick={generateDocumentHash}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm"
                    >
                      Generate
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Private Inputs */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                🔐 Private Inputs (for ZK Proof)
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Owner Private Key
                  </label>
                  <input
                    type="password"
                    value={privateInputs.ownerPrivateKey}
                    onChange={(e) => handlePrivateInputsChange('ownerPrivateKey', e.target.value)}
                    placeholder="0x..."
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Document Signature
                  </label>
                  <input
                    type="text"
                    value={privateInputs.documentSignature}
                    onChange={(e) => handlePrivateInputsChange('documentSignature', e.target.value)}
                    placeholder="Document signature hash"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Ownership Proof
                  </label>
                  <input
                    type="text"
                    value={privateInputs.ownershipProof}
                    onChange={(e) => handlePrivateInputsChange('ownershipProof', e.target.value)}
                    placeholder="Ownership verification proof"
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex space-x-4">
            <button
              onClick={handleGenerateCustomProof}
              disabled={isGeneratingProof || !landData.landId || !landData.ownerAddress}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              {isGeneratingProof ? '🔄 Generating Proof...' : '🔐 Generate ZK Proof from Custom Data'}
            </button>
            <button
              onClick={() => {
                setLandData({
                  landId: '',
                  ownerAddress: '',
                  location: '',
                  area: '',
                  coordinates: '',
                  documentHash: ''
                });
                setPrivateInputs({
                  ownerPrivateKey: '',
                  documentSignature: '',
                  ownershipProof: ''
                });
                setUploadedFile(null);
                setUploadError(null);
              }}
              className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              🗑️ Clear Form
            </button>
          </div>
        </div>

        {/* Current Data Preview */}
        {(landData.landId || uploadedFile) && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              📊 Current Data Preview
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Land Document Data
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <pre className="text-sm text-gray-700 dark:text-gray-300 overflow-x-auto">
                    {JSON.stringify(landData, null, 2)}
                  </pre>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Private Inputs
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <pre className="text-sm text-gray-700 dark:text-gray-300 overflow-x-auto">
                    {JSON.stringify(privateInputs, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sample Data Section */}
        {sampleData && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              📋 Sample Land Document Data
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Land Document
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <pre className="text-sm text-gray-700 dark:text-gray-300 overflow-x-auto">
                    {JSON.stringify(sampleData.landDocument, null, 2)}
                  </pre>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Private Inputs
                </h3>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                  <pre className="text-sm text-gray-700 dark:text-gray-300 overflow-x-auto">
                    {JSON.stringify(sampleData.privateInputs, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleGenerateProof}
                disabled={isGeneratingProof}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                {isGeneratingProof ? '🔄 Generating Proof...' : '🔐 Generate ZK Proof'}
              </button>
            </div>
          </div>
        )}

        {/* Proof Status Section */}
        {Object.keys(proofStatus).length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              📊 Proof Status
            </h2>
            
            <div className="space-y-4">
              {Object.entries(proofStatus).map(([landId, status]) => (
                <div key={landId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      {landId}
                    </h3>
                    <span className={`text-sm font-medium ${getStatusColor(status.status)}`}>
                      {getStatusIcon(status.status)} {status.status.toUpperCase()}
                    </span>
                  </div>
                  
                  {status.ipfsCID && (
                    <div className="mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">IPFS CID: </span>
                      <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {status.ipfsCID}
                      </code>
                    </div>
                  )}
                  
                  {status.onChainVerification && (
                    <div className="mb-2">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Transaction: </span>
                      <code className="text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {status.onChainVerification.txHash}
                      </code>
                    </div>
                  )}
                  
                  {status.status === 'verified' && (
                    <button
                      onClick={handleLinkToLandNFT}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      🔗 Link to LandNFT
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            📖 How It Works
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="bg-blue-100 dark:bg-blue-900 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">1️⃣</span>
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Generate Proof</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Create ZK proof for land document verification
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-green-100 dark:bg-green-900 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">2️⃣</span>
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Store on IPFS</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Proof artifacts stored on decentralized storage
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-100 dark:bg-purple-900 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">3️⃣</span>
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Verify On-Chain</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Verify proof using smart contract
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-orange-100 dark:bg-orange-900 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">4️⃣</span>
              </div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Link to NFT</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Associate proof with LandNFT
              </p>
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            🔧 Technical Details
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">ZK Circuit</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Uses Circom to verify land document signatures and ownership without revealing sensitive data.
              </p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Groth16 Proofs</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Implements Groth16 zero-knowledge proof system for efficient verification.
              </p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">IPFS Storage</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Proof artifacts stored on IPFS for decentralized and permanent storage.
              </p>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">Smart Contract</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                On-chain verifier contract performs succinct proof verification.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZKVerificationDashboard;
