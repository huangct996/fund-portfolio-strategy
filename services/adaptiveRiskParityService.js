const tushareService = require('./tushareService');

/**
 * 自适应风险平价策略增强服务
 * 提供动态参数调整和市场状态识别功能
 */
class AdaptiveRiskParityService {
  
  /**
   * 根据市场波动状态动态调整EWMA衰减系数
   * @param {Array} marketReturns - 市场近期收益率
   * @param {number} baseDecay - 基础衰减系数
   * @returns {number} 调整后的衰减系数
   */
  calculateAdaptiveEWMADecay(marketReturns, baseDecay = 0.91) {
    if (!marketReturns || marketReturns.length < 20) {
      return baseDecay;
    }
    
    const recentReturns = marketReturns.slice(-20);
    const volatility = this.calculateVolatility(recentReturns);
    
    const avgVolatility = 0.015;
    
    if (volatility > avgVolatility * 1.5) {
      return Math.max(0.85, baseDecay - 0.03);
    } else if (volatility < avgVolatility * 0.7) {
      return Math.min(0.95, baseDecay + 0.02);
    }
    
    return baseDecay;
  }
  
  /**
   * 计算波动率
   */
  calculateVolatility(returns) {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }
  
  /**
   * 动态调整波动率窗口
   * @param {string} currentDate - 当前日期
   * @param {number} baseWindow - 基础窗口（月）
   * @returns {number} 调整后的窗口
   */
  calculateAdaptiveVolatilityWindow(marketVolatility, baseWindow = 6) {
    const avgVolatility = 0.015;
    
    if (marketVolatility > avgVolatility * 1.5) {
      return Math.max(3, baseWindow - 2);
    } else if (marketVolatility < avgVolatility * 0.7) {
      return Math.min(12, baseWindow + 3);
    }
    
    return baseWindow;
  }
  
  /**
   * 协方差矩阵优化的风险平价权重
   * 考虑股票间的相关性，而不仅仅是单独的波动率
   */
  async calculateCovarianceBasedWeights(stocks, rebalanceDate, params = {}) {
    const {
      volatilityWindow = 12,
      ewmaDecay = 0.94,
      maxWeight = 0.15
    } = params;
    
    const tsCodes = stocks.map(s => s.con_code);
    
    const endDateObj = new Date(
      rebalanceDate.substring(0, 4),
      parseInt(rebalanceDate.substring(4, 6)) - 1,
      rebalanceDate.substring(6, 8)
    );
    const startDateObj = new Date(endDateObj);
    startDateObj.setMonth(startDateObj.getMonth() - volatilityWindow);
    
    const startDate = startDateObj.getFullYear() + 
      String(startDateObj.getMonth() + 1).padStart(2, '0') + 
      String(startDateObj.getDate()).padStart(2, '0');
    
    const expectedMinRecords = Math.floor(volatilityWindow * 20 * 0.8);
    
    const stockDataMap = await tushareService.getStockDailyWithCacheBatch(
      tsCodes, 
      startDate, 
      rebalanceDate, 
      expectedMinRecords
    );
    
    const returnsMatrix = [];
    const validStocks = [];
    
    for (const stock of stocks) {
      const dailyData = stockDataMap[stock.con_code] || [];
      
      if (dailyData.length >= 2) {
        dailyData.sort((a, b) => a.trade_date.localeCompare(b.trade_date));
        
        const returns = [];
        for (let i = 1; i < dailyData.length; i++) {
          const prevClose = dailyData[i - 1].adj_close || dailyData[i - 1].close_price || dailyData[i - 1].close;
          const currClose = dailyData[i].adj_close || dailyData[i].close_price || dailyData[i].close;
          
          if (prevClose > 0 && currClose > 0) {
            returns.push((currClose - prevClose) / prevClose);
          }
        }
        
        if (returns.length > 0) {
          returnsMatrix.push(returns);
          validStocks.push(stock.con_code);
        }
      }
    }
    
    if (returnsMatrix.length === 0) {
      return {};
    }
    
    const covMatrix = this.calculateCovarianceMatrix(returnsMatrix);
    
    const weights = this.optimizeRiskParityWithCovariance(covMatrix, validStocks, maxWeight);
    
    return weights;
  }
  
  /**
   * 计算协方差矩阵
   */
  calculateCovarianceMatrix(returnsMatrix) {
    const n = returnsMatrix.length;
    const covMatrix = Array(n).fill(0).map(() => Array(n).fill(0));
    
    const means = returnsMatrix.map(returns => 
      returns.reduce((sum, r) => sum + r, 0) / returns.length
    );
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const returns_i = returnsMatrix[i];
        const returns_j = returnsMatrix[j];
        const minLen = Math.min(returns_i.length, returns_j.length);
        
        let cov = 0;
        for (let k = 0; k < minLen; k++) {
          cov += (returns_i[k] - means[i]) * (returns_j[k] - means[j]);
        }
        covMatrix[i][j] = cov / minLen;
      }
    }
    
    return covMatrix;
  }
  
  /**
   * 基于协方差矩阵优化风险平价权重
   */
  optimizeRiskParityWithCovariance(covMatrix, stockCodes, maxWeight) {
    const n = covMatrix.length;
    
    const volatilities = covMatrix.map((row, i) => Math.sqrt(row[i]));
    
    const invVols = volatilities.map(v => v > 0 ? 1 / v : 0);
    const totalInvVol = invVols.reduce((sum, v) => sum + v, 0);
    
    const weights = {};
    invVols.forEach((invVol, i) => {
      let weight = totalInvVol > 0 ? invVol / totalInvVol : 1 / n;
      weight = Math.min(weight, maxWeight);
      weights[stockCodes[i]] = weight;
    });
    
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    Object.keys(weights).forEach(code => {
      weights[code] = weights[code] / totalWeight;
    });
    
    return weights;
  }
  
  /**
   * 动态止损机制
   * 当单只股票或组合出现大幅回撤时，降低其权重
   */
  applyDynamicStopLoss(weights, stockReturns, stopLossThreshold = -0.15) {
    const adjustedWeights = { ...weights };
    let totalAdjustment = 0;
    
    Object.keys(weights).forEach(code => {
      const returns = stockReturns[code] || [];
      if (returns.length > 0) {
        const recentReturn = returns.slice(-20).reduce((prod, r) => prod * (1 + r), 1) - 1;
        
        if (recentReturn < stopLossThreshold) {
          const reduction = weights[code] * 0.3;
          adjustedWeights[code] = weights[code] - reduction;
          totalAdjustment += reduction;
        }
      }
    });
    
    if (totalAdjustment > 0) {
      const remainingCodes = Object.keys(adjustedWeights).filter(
        code => adjustedWeights[code] === weights[code]
      );
      
      remainingCodes.forEach(code => {
        adjustedWeights[code] += totalAdjustment / remainingCodes.length;
      });
    }
    
    return adjustedWeights;
  }
}

module.exports = new AdaptiveRiskParityService();
