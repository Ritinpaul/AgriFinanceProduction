import React, { useState, useEffect } from 'react';

const CreditScore = () => {
  const [creditScore, setCreditScore] = useState(720);
  const [scoreHistory, setScoreHistory] = useState([
    { date: '2024-01-15', score: 720, change: 0 },
    { date: '2024-01-10', score: 715, change: 5 },
    { date: '2024-01-05', score: 710, change: 5 },
    { date: '2023-12-28', score: 705, change: 5 }
  ]);
  const [factors, setFactors] = useState({
    yieldHistory: 85,
    salesHistory: 78,
    weatherData: 92,
    landArea: 65,
    soilQuality: 88,
    reputation: 85
  });

  const getScoreColor = (score) => {
    if (score >= 750) return 'text-green-600 dark:text-green-400';
    if (score >= 700) return 'text-blue-600 dark:text-blue-400';
    if (score >= 650) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreLabel = (score) => {
    if (score >= 750) return 'Excellent';
    if (score >= 700) return 'Good';
    if (score >= 650) return 'Fair';
    return 'Poor';
  };

  const calculateNewScore = () => {
    // Mock calculation - in real app, this would call the AI service
    const newScore = Math.floor(Math.random() * 50) + 700; // 700-750
    setCreditScore(newScore);
    
    const newEntry = {
      date: new Date().toISOString().split('T')[0],
      score: newScore,
      change: newScore - scoreHistory[0].score
    };
    setScoreHistory([newEntry, ...scoreHistory]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200">
          Credit Score Analysis
        </h3>
        <button
          onClick={calculateNewScore}
          className="agri-button"
        >
          Recalculate Score
        </button>
      </div>

      {/* Current Score */}
      <div className="agri-card p-8 text-center">
        <div className={`text-6xl font-bold mb-4 ${getScoreColor(creditScore)}`}>
          {creditScore}
        </div>
        <div className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
          {getScoreLabel(creditScore)} Credit Score
        </div>
        <div className="text-gray-600 dark:text-gray-400">
          Last updated: {scoreHistory[0].date}
        </div>
      </div>

      {/* Score Factors */}
      <div className="agri-card p-6">
        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Score Factors
        </h4>
        <div className="space-y-4">
          {Object.entries(factors).map(([factor, value]) => (
            <div key={factor} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">
                  {factor.replace(/([A-Z])/g, ' $1').trim()}
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-32 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${value}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-8">
                  {value}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Score History */}
      <div className="agri-card p-6">
        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Score History
        </h4>
        <div className="space-y-3">
          {scoreHistory.map((entry, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div>
                <div className="font-medium text-gray-800 dark:text-gray-200">
                  {entry.score}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {entry.date}
                </div>
              </div>
              <div className={`text-sm font-medium ${
                entry.change > 0 ? 'text-green-600 dark:text-green-400' : 
                entry.change < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'
              }`}>
                {entry.change > 0 ? '+' : ''}{entry.change}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div className="agri-card p-6">
        <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Recommendations
        </h4>
        <div className="space-y-3">
          {creditScore < 700 && (
            <div className="flex items-start space-x-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="text-yellow-600 dark:text-yellow-400 text-lg">⚠️</div>
              <div>
                <div className="font-medium text-yellow-800 dark:text-yellow-200">
                  Improve Your Credit Score
                </div>
                <div className="text-sm text-yellow-700 dark:text-yellow-300">
                  Consider updating your crop history, increasing land area, or improving soil quality to boost your score.
                </div>
              </div>
            </div>
          )}
          
          <div className="flex items-start space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="text-blue-600 dark:text-blue-400 text-lg">💡</div>
            <div>
              <div className="font-medium text-blue-800 dark:text-blue-200">
                Maintain Good Practices
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                Keep updating your crop history, maintain consistent yields, and ensure timely loan repayments.
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <div className="text-green-600 dark:text-green-400 text-lg">🎯</div>
            <div>
              <div className="font-medium text-green-800 dark:text-green-200">
                Loan Eligibility
              </div>
              <div className="text-sm text-green-700 dark:text-green-300">
                With your current score, you're eligible for loans up to $10,000 with competitive interest rates.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreditScore;
