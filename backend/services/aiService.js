// Enhanced AI Credit Scoring Service
// This service calculates credit scores using multiple factors and machine learning-inspired algorithms

const crypto = require('crypto');

// Enhanced credit scoring algorithm with multiple factors
function calculateEnhancedCreditScore(userAddress, userData = {}) {
  let score = 300; // Base score must start at 300
  const factors = {};
  const weights = {
    accountAge: 0.15,
    transactionVolume: 0.20,
    loanHistory: 0.25,
    supplyChainActivity: 0.15,
    socialProof: 0.10,
    riskFactors: 0.15
  };

  // Factor 1: Account Age & Activity
  const accountAge = userData.accountAge || 0; // days
  const accountActivityScore = Math.min(accountAge * 1.5, 100);
  factors.accountAge = accountActivityScore;
  score += accountActivityScore * weights.accountAge;

  // Factor 2: Transaction Volume & Frequency
  const transactionCount = userData.transactionCount || 0;
  const avgTransactionValue = userData.avgTransactionValue || 0;
  const transactionVolumeScore = Math.min(
    (transactionCount * 2) + (avgTransactionValue / 100), 
    150
  );
  factors.transactionVolume = transactionVolumeScore;
  score += transactionVolumeScore * weights.transactionVolume;

  // Factor 3: Loan History & Repayment Behavior
  const loanHistory = userData.loanHistory || [];
  const totalLoans = loanHistory.length;
  const repaidLoans = loanHistory.filter(loan => loan.status === 'repaid').length;
  const defaultedLoans = loanHistory.filter(loan => loan.status === 'defaulted').length;
  const latePayments = loanHistory.filter(loan => loan.latePayments > 0).length;
  
  let loanScore = 0;
  if (totalLoans > 0) {
    const repaymentRate = repaidLoans / totalLoans;
    const defaultRate = defaultedLoans / totalLoans;
    const latePaymentRate = latePayments / totalLoans;
    
    loanScore = (repaymentRate * 100) - (defaultRate * 50) - (latePaymentRate * 25);
    loanScore = Math.max(0, Math.min(150, loanScore));
  }
  
  factors.loanHistory = loanScore;
  score += loanScore * weights.loanHistory;

  // Factor 4: Supply Chain Activity & Quality
  const batchCount = userData.batchCount || 0;
  const verifiedBatches = userData.verifiedBatches || 0;
  const qualityScore = userData.avgQualityScore || 0;
  
  let supplyChainScore = 0;
  if (batchCount > 0) {
    const verificationRate = verifiedBatches / batchCount;
    supplyChainScore = (batchCount * 5) + (verificationRate * 50) + (qualityScore * 2);
    supplyChainScore = Math.min(supplyChainScore, 100);
  }
  
  factors.supplyChainActivity = supplyChainScore;
  score += supplyChainScore * weights.supplyChainActivity;

  // Factor 5: Social Proof & Community Standing
  const referrals = userData.referrals || 0;
  const communityRating = userData.communityRating || 0;
  const certifications = userData.certifications || [];
  
  const socialProofScore = (referrals * 5) + (communityRating * 2) + (certifications.length * 10);
  factors.socialProof = Math.min(socialProofScore, 80);
  score += factors.socialProof * weights.socialProof;

  // Factor 6: Risk Assessment
  const riskFactors = userData.riskFactors || [];
  const suspiciousActivity = userData.suspiciousActivity || 0;
  const addressReputation = userData.addressReputation || 0;
  
  let riskScore = 50; // Base risk score
  riskScore -= riskFactors.length * 10; // Deduct for each risk factor
  riskScore -= suspiciousActivity * 15; // Deduct for suspicious activity
  riskScore += addressReputation; // Add reputation bonus
  
  factors.riskFactors = Math.max(0, Math.min(100, riskScore));
  score += factors.riskFactors * weights.riskFactors;

  // Factor 7: Address-based consistency (deterministic but fair)
  const addressHash = crypto.createHash('sha256').update(userAddress.toLowerCase()).digest('hex');
  const consistencyBonus = parseInt(addressHash.substring(0, 2), 16) % 20; // 0-19 bonus
  score += consistencyBonus;

  // Factor 8: Temporal factors (time-based scoring)
  const currentTime = Date.now();
  const timeFactor = Math.sin((currentTime / 1000000) % (2 * Math.PI)) * 10; // ±10 points
  score += timeFactor;

  // Cap the score between 300-850 (standard credit score range)
  const finalScore = Math.max(300, Math.min(850, Math.round(score)));

  return {
    score: finalScore,
    factors: factors,
    weights: weights,
    consistencyBonus: consistencyBonus,
    timeFactor: Math.round(timeFactor)
  };
}

// Calculate confidence based on data completeness and consistency
function calculateConfidence(userData, scoreResult) {
  let confidence = 0.5; // Base confidence
  
  // Increase confidence based on data completeness
  const dataPoints = Object.keys(userData).length;
  confidence += Math.min(dataPoints * 0.05, 0.3);
  
  // Increase confidence based on historical data
  if (userData.loanHistory && userData.loanHistory.length > 0) {
    confidence += 0.2;
  }
  
  if (userData.transactionCount > 10) {
    confidence += 0.1;
  }
  
  if (userData.batchCount > 5) {
    confidence += 0.1;
  }
  
  // Decrease confidence for new accounts
  if (userData.accountAge < 30) {
    confidence -= 0.2;
  }
  
  return Math.max(0.3, Math.min(0.95, confidence));
}

// Generate risk assessment
function generateRiskAssessment(userData, scoreResult) {
  const risks = [];
  const recommendations = [];
  
  if (userData.accountAge < 30) {
    risks.push('New account - limited history');
    recommendations.push('Build transaction history');
  }
  
  if (userData.loanHistory && userData.loanHistory.some(loan => loan.status === 'defaulted')) {
    risks.push('Previous loan defaults');
    recommendations.push('Improve repayment track record');
  }
  
  if (userData.transactionCount < 5) {
    risks.push('Low transaction activity');
    recommendations.push('Increase platform engagement');
  }
  
  if (scoreResult.score < 500) {
    risks.push('Low credit score');
    recommendations.push('Focus on improving credit factors');
  }
  
  return { risks, recommendations };
}

async function getCreditScore(userAddress, additionalData = {}) {
  try {
    console.log(`Calculating enhanced credit score for ${userAddress}`);
    
    // In production, fetch real user data from database
    const userData = {
      accountAge: Math.floor(Math.random() * 365) + 30, // 30-395 days
      transactionCount: Math.floor(Math.random() * 50) + 5,
      avgTransactionValue: Math.floor(Math.random() * 1000) + 100,
      loanHistory: generateMockLoanHistory(),
      batchCount: Math.floor(Math.random() * 20) + 1,
      verifiedBatches: Math.floor(Math.random() * 15) + 1,
      avgQualityScore: Math.floor(Math.random() * 40) + 60, // 60-100
      referrals: Math.floor(Math.random() * 10),
      communityRating: Math.floor(Math.random() * 30) + 70, // 70-100
      certifications: ['Organic', 'Fair Trade'].slice(0, Math.floor(Math.random() * 3)),
      riskFactors: [],
      suspiciousActivity: 0,
      addressReputation: Math.floor(Math.random() * 20),
      ...additionalData
    };
    
    // Calculate enhanced score
    const scoreResult = calculateEnhancedCreditScore(userAddress, userData);
    const confidence = calculateConfidence(userData, scoreResult);
    const riskAssessment = generateRiskAssessment(userData, scoreResult);
    
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
    
    return {
      score: scoreResult.score,
      confidence: parseFloat(confidence.toFixed(2)),
      factors: scoreResult.factors,
      weights: scoreResult.weights,
      riskAssessment: riskAssessment,
      timestamp: Date.now(),
      source: 'enhanced_ai_service_v2',
      metadata: {
        consistencyBonus: scoreResult.consistencyBonus,
        timeFactor: scoreResult.timeFactor,
        dataCompleteness: Object.keys(userData).length,
        algorithmVersion: '2.1.0'
      }
    };
  } catch (error) {
    console.error('Enhanced AI credit scoring error:', error);
    throw new Error('Failed to calculate credit score');
  }
}

// Generate mock loan history for testing
function generateMockLoanHistory() {
  const histories = [];
  const loanCount = Math.floor(Math.random() * 5);
  
  for (let i = 0; i < loanCount; i++) {
    const statuses = ['repaid', 'repaid', 'repaid', 'active', 'defaulted']; // Weighted towards repaid
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    histories.push({
      amount: Math.floor(Math.random() * 5000) + 500,
      status: status,
      latePayments: status === 'repaid' ? Math.floor(Math.random() * 2) : 0,
      duration: Math.floor(Math.random() * 12) + 1 // months
    });
  }
  
  return histories;
}

// Batch processing for multiple users
async function getBatchCreditScores(userAddresses, additionalData = {}) {
  const results = [];
  
  for (const address of userAddresses) {
    try {
      const score = await getCreditScore(address, additionalData);
      results.push({ address, ...score });
    } catch (error) {
      results.push({ 
        address, 
        error: error.message,
        score: null 
      });
    }
  }
  
  return results;
}

// Score prediction based on hypothetical scenarios
async function predictCreditScore(userAddress, scenarioData) {
  const currentScore = await getCreditScore(userAddress);
  
  // Simulate impact of scenario changes
  const impactFactors = {
    'new_loan': { loanHistory: 1, transactionVolume: 0.1 },
    'increased_activity': { transactionVolume: 0.3, accountAge: 0.05 },
    'supply_chain_growth': { supplyChainActivity: 0.4 },
    'community_engagement': { socialProof: 0.2 }
  };
  
  const scenario = scenarioData.scenario || 'new_loan';
  const impact = impactFactors[scenario] || {};
  
  let predictedScore = currentScore.score;
  Object.entries(impact).forEach(([factor, multiplier]) => {
    const factorValue = currentScore.factors[factor] || 0;
    predictedScore += factorValue * multiplier;
  });
  
  return {
    currentScore: currentScore.score,
    predictedScore: Math.max(300, Math.min(850, Math.round(predictedScore))),
    scenario: scenario,
    impact: impact,
    confidence: currentScore.confidence * 0.8 // Lower confidence for predictions
  };
}

module.exports = {
  getCreditScore,
  getBatchCreditScores,
  predictCreditScore,
  calculateEnhancedCreditScore,
  calculateConfidence,
  generateRiskAssessment
};
