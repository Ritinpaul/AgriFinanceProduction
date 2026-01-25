import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const Traceability = () => {
  const { hash } = useParams();
  const [traceabilityData, setTraceabilityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (hash) {
      fetchTraceabilityData(hash);
    }
  }, [hash]);

  const fetchTraceabilityData = async (batchHash) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/batch/traceability/${batchHash}`);
      const data = await response.json();
      
      if (data.success) {
        setTraceabilityData(data.traceability);
      } else {
        setError(data.error || 'Failed to fetch traceability data');
      }
    } catch (err) {
      console.error('Error fetching traceability data:', err);
      setError('Failed to fetch traceability data');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getVerificationBadge = (isVerified) => {
    if (isVerified) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Verified
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Pending Verification
        </span>
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading traceability information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
            <svg className="w-12 h-12 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-lg font-medium text-red-800 mb-2">Error</h3>
            <p className="text-red-600">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!traceabilityData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md">
            <svg className="w-12 h-12 text-yellow-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <h3 className="text-lg font-medium text-yellow-800 mb-2">No Data Found</h3>
            <p className="text-yellow-600">No traceability information found for this batch.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Product Traceability</h1>
              <p className="text-gray-600">Complete supply chain information for batch #{traceabilityData.batchId}</p>
            </div>
            {getVerificationBadge(traceabilityData.verification.isVerified)}
          </div>
        </div>

        {/* Farmer Information */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Farmer Information</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">{traceabilityData.farmer.name}</h4>
                <p className="text-gray-600 mb-1">
                  <span className="font-medium">Location:</span> {traceabilityData.farmer.location}
                </p>
                <p className="text-gray-600 mb-1">
                  <span className="font-medium">Address:</span> {traceabilityData.farmer.address}
                </p>
              </div>
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Certifications</h5>
                <div className="flex flex-wrap gap-2">
                  {traceabilityData.farmer.certifications.map((cert, index) => (
                    <span key={index} className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                      {cert}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Information */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Product Information</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">{traceabilityData.product.type}</h4>
                <p className="text-gray-600 mb-1">
                  <span className="font-medium">Grade:</span> {traceabilityData.product.grade}
                </p>
                <p className="text-gray-600 mb-1">
                  <span className="font-medium">Quantity:</span> {traceabilityData.product.quantity} units
                </p>
                <p className="text-gray-600 mb-1">
                  <span className="font-medium">Harvest Date:</span> {formatDate(traceabilityData.product.harvestDate)}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Farm Location:</span> {traceabilityData.product.location}
                </p>
              </div>
              <div>
                <h5 className="font-medium text-gray-900 mb-2">Certifications</h5>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <span className={`w-3 h-3 rounded-full mr-2 ${traceabilityData.certifications.organic ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    <span className="text-sm text-gray-600">Organic Certified</span>
                  </div>
                  <div className="flex items-center">
                    <span className={`w-3 h-3 rounded-full mr-2 ${traceabilityData.certifications.fairTrade ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    <span className="text-sm text-gray-600">Fair Trade Certified</span>
                  </div>
                  <div className="flex items-center">
                    <span className={`w-3 h-3 rounded-full mr-2 ${traceabilityData.certifications.gmoFree ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    <span className="text-sm text-gray-600">GMO Free</span>
                  </div>
                </div>
                <div className="mt-3">
                  <h6 className="font-medium text-gray-900 mb-1">Certificates</h6>
                  <div className="space-y-1">
                    {traceabilityData.certifications.certificates.map((cert, index) => (
                      <p key={index} className="text-sm text-gray-600">• {cert}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Production Logs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Production Timeline</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {traceabilityData.logs.map((log, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-3 h-3 bg-green-500 rounded-full mt-2"></div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-medium text-gray-900">{log.action}</h4>
                      <span className="text-sm text-gray-500">{formatDate(log.date)}</span>
                    </div>
                    <p className="text-gray-600 text-sm">{log.details}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Photos */}
        {traceabilityData.photos && traceabilityData.photos.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm mb-6">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Production Photos</h3>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {traceabilityData.photos.map((photo, index) => (
                  <div key={index} className="bg-gray-100 rounded-lg p-4 text-center">
                    <p className="text-gray-600 text-sm">{photo}</p>
                    <p className="text-xs text-gray-500 mt-1">IPFS Hash</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Verification Information */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Verification Status</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Verification Details</h4>
                <p className="text-gray-600 mb-1">
                  <span className="font-medium">Status:</span> {traceabilityData.verification.isVerified ? 'Verified' : 'Pending'}
                </p>
                <p className="text-gray-600 mb-1">
                  <span className="font-medium">Verified By:</span> {traceabilityData.verification.verifiedBy}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Verified At:</span> {formatDate(traceabilityData.verification.verifiedAt)}
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Sale Information</h4>
                <p className="text-gray-600 mb-1">
                  <span className="font-medium">Status:</span> {traceabilityData.sale.isSold ? 'Sold' : 'Available'}
                </p>
                {traceabilityData.sale.isSold && (
                  <>
                    <p className="text-gray-600 mb-1">
                      <span className="font-medium">Buyer:</span> {traceabilityData.sale.buyer}
                    </p>
                    <p className="text-gray-600">
                      <span className="font-medium">Sold At:</span> {formatDate(traceabilityData.sale.soldAt)}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Blockchain Information */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Blockchain Information</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Batch Hash</h4>
                <p className="text-gray-600 font-mono text-sm break-all">{traceabilityData.hash}</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Batch ID</h4>
                <p className="text-gray-600 font-mono text-sm">#{traceabilityData.batchId}</p>
              </div>
            </div>
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="text-green-800 text-sm">
                  This information is stored on the blockchain and cannot be tampered with.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Traceability;
