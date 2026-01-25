const QRCode = require('qrcode');
const crypto = require('crypto');

/**
 * QR Code Generation Service for Supply Chain Traceability
 * Generates QR codes that link to batch information and traceability data
 */
class QRCodeService {
  constructor() {
    this.baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  }

  /**
   * Generate QR code data for a batch
   * @param {Object} batchData - Batch information
   * @returns {Object} QR code data and hash
   */
  async generateBatchQR(batchData) {
    try {
      // Create unique hash for the batch
      const batchHash = this.generateBatchHash(batchData);
      
      // Create QR payload with traceability URL
      const qrPayload = {
        type: 'batch_traceability',
        batchId: batchData.batchId,
        hash: batchHash,
        url: `${this.baseUrl}/traceability/${batchHash}`,
        timestamp: Date.now(),
        farmer: batchData.farmer,
        productType: batchData.productType,
        grade: batchData.grade
      };

      // Generate QR code as data URL
      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrPayload), {
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      });

      return {
        success: true,
        qrCode: qrCodeDataURL,
        hash: batchHash,
        payload: qrPayload,
        url: qrPayload.url
      };
    } catch (error) {
      console.error('QR Code generation error:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Generate unique hash for batch
   * @param {Object} batchData - Batch data
   * @returns {string} Unique hash
   */
  generateBatchHash(batchData) {
    const dataString = JSON.stringify({
      farmer: batchData.farmer,
      productType: batchData.productType,
      grade: batchData.grade,
      quantity: batchData.quantity,
      timestamp: batchData.timestamp || Date.now(),
      random: Math.random().toString(36)
    });
    
    return crypto.createHash('sha256').update(dataString).digest('hex').substring(0, 16);
  }

  /**
   * Generate QR code for product packaging
   * @param {Object} productData - Product information
   * @returns {Object} QR code data
   */
  async generateProductQR(productData) {
    try {
      const productHash = this.generateBatchHash(productData);
      
      const qrPayload = {
        type: 'product_info',
        productId: productData.productId,
        hash: productHash,
        url: `${this.baseUrl}/product/${productHash}`,
        timestamp: Date.now(),
        batchId: productData.batchId,
        farmer: productData.farmer,
        productType: productData.productType,
        certifications: productData.certifications
      };

      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrPayload), {
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#2D5A27', // Green color for agricultural theme
          light: '#F0F8F0'
        },
        width: 200
      });

      return {
        success: true,
        qrCode: qrCodeDataURL,
        hash: productHash,
        payload: qrPayload,
        url: qrPayload.url
      };
    } catch (error) {
      console.error('Product QR generation error:', error);
      throw new Error('Failed to generate product QR code');
    }
  }

  /**
   * Generate QR code for farmer verification
   * @param {Object} farmerData - Farmer information
   * @returns {Object} QR code data
   */
  async generateFarmerQR(farmerData) {
    try {
      const farmerHash = this.generateBatchHash(farmerData);
      
      const qrPayload = {
        type: 'farmer_verification',
        farmerId: farmerData.farmerId,
        hash: farmerHash,
        url: `${this.baseUrl}/farmer/${farmerHash}`,
        timestamp: Date.now(),
        name: farmerData.name,
        location: farmerData.location,
        certifications: farmerData.certifications
      };

      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(qrPayload), {
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#1A4D1A', // Dark green
          light: '#E8F5E8'
        },
        width: 180
      });

      return {
        success: true,
        qrCode: qrCodeDataURL,
        hash: farmerHash,
        payload: qrPayload,
        url: qrPayload.url
      };
    } catch (error) {
      console.error('Farmer QR generation error:', error);
      throw new Error('Failed to generate farmer QR code');
    }
  }

  /**
   * Parse QR code data
   * @param {string} qrData - QR code data string
   * @returns {Object} Parsed QR data
   */
  parseQRData(qrData) {
    try {
      const parsed = JSON.parse(qrData);
      
      // Validate QR code structure
      if (!parsed.type || !parsed.hash || !parsed.url) {
        throw new Error('Invalid QR code format');
      }

      return {
        success: true,
        data: parsed,
        type: parsed.type,
        hash: parsed.hash,
        url: parsed.url
      };
    } catch (error) {
      console.error('QR parsing error:', error);
      return {
        success: false,
        error: 'Invalid QR code data'
      };
    }
  }

  /**
   * Generate batch traceability URL
   * @param {string} batchHash - Batch hash
   * @returns {string} Traceability URL
   */
  generateTraceabilityURL(batchHash) {
    return `${this.baseUrl}/traceability/${batchHash}`;
  }

  /**
   * Generate farmer profile URL
   * @param {string} farmerHash - Farmer hash
   * @returns {string} Farmer profile URL
   */
  generateFarmerURL(farmerHash) {
    return `${this.baseUrl}/farmer/${farmerHash}`;
  }

  /**
   * Generate product info URL
   * @param {string} productHash - Product hash
   * @returns {string} Product info URL
   */
  generateProductURL(productHash) {
    return `${this.baseUrl}/product/${productHash}`;
  }
}

module.exports = QRCodeService;
