const tushareService = require('./tushareService');

/**
 * 市场状态识别服务（5状态完整版）
 * 
 * 市场状态分类：
 * 1. AGGRESSIVE_BULL - 强势牛市
 * 2. MODERATE_BULL - 温和牛市
 * 3. SIDEWAYS - 震荡市场
 * 4. WEAK_BEAR - 弱势市场
 * 5. PANIC - 恐慌市场
 */
class MarketRegimeService {
  
  /**
   * 识别市场状态
   * @param {string} indexCode - 指数代码
   * @param {Array} stocks - 成分股列表
   * @param {string} date - 日期 YYYYMMDD
   * @returns {Object} 市场状态信息
   */
  async identifyMarketRegime(indexCode, stocks, date) {
    try {
      // 1. 计算各项指标
      const trendStrength = await this.calculateTrendStrength(indexCode, date);
      const marketBreadth = await this.calculateMarketBreadth(stocks, date);
      const volatilityLevel = await this.calculateVolatilityLevel(indexCode, date);
      const momentumStrength = await this.calculateMomentumStrength(indexCode, date);
      
      // 🔍 调试日志：输出实际指标值
      console.log(`[${date}] 市场指标 - 趋势:${(trendStrength*100).toFixed(2)}%, 宽度:${(marketBreadth*100).toFixed(1)}%, 波动:${(volatilityLevel*100).toFixed(0)}%, 动量:${(momentumStrength*100).toFixed(2)}%`);
      
      // 2. 判断市场状态
      const regime = this.classifyRegime(trendStrength, marketBreadth, volatilityLevel, momentumStrength);
      
      // 3. 获取对应的策略参数
      const params = this.getRegimeParams(regime);
      
      // 4. 计算置信度
      const confidence = this.calculateConfidence(trendStrength, marketBreadth, volatilityLevel, momentumStrength, regime);
      
      return {
        regime,
        regimeName: this.getRegimeName(regime),
        trendStrength,
        marketBreadth,
        volatilityLevel,
        momentumStrength,
        confidence,
        params,
        date
      };
    } catch (error) {
      console.error('识别市场状态失败:', error.message);
      // 返回默认状态（震荡市场）
      return this.getDefaultRegime(date);
    }
  }
  
  /**
   * 计算趋势强度（基于多周期移动平均线）
   */
  async calculateTrendStrength(indexCode, date) {
    try {
      // 使用沪深300指数作为市场基准
      const marketIndex = '000300.SH';
      const startDate = this.getDateBefore(date, 150);
      const prices = await tushareService.getIndexDaily(marketIndex, startDate, date);
      
      if (!prices || prices.length < 120) {
        console.warn('数据不足，无法计算趋势强度');
        return 0;
      }
      
      const current = prices[prices.length - 1].close;
      const ma20 = this.calculateMA(prices, 20);
      const ma60 = this.calculateMA(prices, 60);
      const ma120 = this.calculateMA(prices, 120);
      
      if (!ma20 || !ma60 || !ma120) return 0;
      
      // 多周期趋势加权
      const score = (current - ma20) / ma20 * 0.5 +
                    (ma20 - ma60) / ma60 * 0.3 +
                    (ma60 - ma120) / ma120 * 0.2;
      
      return score;
    } catch (error) {
      console.warn('计算趋势强度失败:', error.message);
      return 0;
    }
  }
  
  /**
   * 计算市场宽度（上涨股票占比）
   */
  async calculateMarketBreadth(stocks, date) {
    try {
      if (!stocks || stocks.length === 0) return 0.5;
      
      const startDate = this.getDateBefore(date, 25);
      let positiveCount = 0;
      let validCount = 0;
      
      // 采样计算（避免API调用过多）
      const sampleSize = Math.min(stocks.length, 30);
      const step = Math.floor(stocks.length / sampleSize);
      
      for (let i = 0; i < stocks.length; i += step) {
        const stock = stocks[i];
        try {
          const prices = await tushareService.getStockDaily(stock.con_code, startDate, date);
          if (prices && prices.length >= 2) {
            const firstPrice = prices[0].close;
            const lastPrice = prices[prices.length - 1].close;
            const return20d = (lastPrice - firstPrice) / firstPrice;
            
            if (return20d > 0) positiveCount++;
            validCount++;
          }
        } catch (err) {
          // 跳过单个股票错误
        }
      }
      
      return validCount > 0 ? positiveCount / validCount : 0.5;
    } catch (error) {
      console.warn('计算市场宽度失败:', error.message);
      return 0.5;
    }
  }
  
  /**
   * 计算波动率水平（相对历史分位数）
   */
  async calculateVolatilityLevel(indexCode, date) {
    try {
      // 使用沪深300指数作为市场基准
      const marketIndex = '000300.SH';
      const startDate = this.getDateBefore(date, 270);
      const prices = await tushareService.getIndexDaily(marketIndex, startDate, date);
      
      if (!prices || prices.length < 250) {
        return 0.5;
      }
      
      // 计算当前20日波动率
      const recentPrices = prices.slice(-20);
      const currentVol = this.calculateVolatility(recentPrices);
      
      // 计算历史滚动20日波动率
      const historicalVols = [];
      for (let i = 20; i < prices.length; i++) {
        const windowPrices = prices.slice(i - 20, i);
        const vol = this.calculateVolatility(windowPrices);
        if (vol > 0) historicalVols.push(vol);
      }
      
      if (historicalVols.length === 0) return 0.5;
      
      // 计算分位数
      historicalVols.sort((a, b) => a - b);
      const rank = historicalVols.filter(v => v <= currentVol).length;
      const percentile = rank / historicalVols.length;
      
      return percentile;
    } catch (error) {
      console.warn('计算波动率水平失败:', error.message);
      return 0.5;
    }
  }
  
  /**
   * 计算动量强度（多周期加权）
   */
  async calculateMomentumStrength(indexCode, date) {
    try {
      // 使用沪深300指数作为市场基准
      const marketIndex = '000300.SH';
      const startDate = this.getDateBefore(date, 200);
      const prices = await tushareService.getIndexDaily(marketIndex, startDate, date);
      
      if (!prices || prices.length < 180) {
        return 0;
      }
      
      const current = prices[prices.length - 1].close;
      
      // 1个月前（20个交易日）
      const price1m = prices.length >= 20 ? prices[prices.length - 20].close : current;
      const return1m = (current - price1m) / price1m;
      
      // 3个月前（60个交易日）
      const price3m = prices.length >= 60 ? prices[prices.length - 60].close : current;
      const return3m = (current - price3m) / price3m;
      
      // 6个月前（120个交易日）
      const price6m = prices.length >= 120 ? prices[prices.length - 120].close : current;
      const return6m = (current - price6m) / price6m;
      
      // 多周期加权
      const momentum = return1m * 0.5 + return3m * 0.3 + return6m * 0.2;
      
      return momentum;
    } catch (error) {
      console.warn('计算动量强度失败:', error.message);
      return 0;
    }
  }
  
  /**
   * 分类市场状态（5状态）- 优化版：主要依赖市场宽度判断（更可靠）
   */
  classifyRegime(trend, breadth, volatility, momentum) {
    // 优先使用市场宽度作为主要判断依据（因为趋势和动量可能为0）
    
    // 1. 强势牛市：市场宽度高（52%以上股票上涨）- 进一步降低阈值
    if (breadth >= 0.52) {
      return 'AGGRESSIVE_BULL';
    }
    
    // 2. 温和牛市：市场宽度中等（42-52%股票上涨）- 进一步降低阈值
    if (breadth >= 0.42) {
      return 'MODERATE_BULL';
    }
    
    // 3. 恐慌市场：波动极高且宽度极低
    if (volatility > 0.80 && breadth < 0.25) {
      return 'PANIC';
    }
    
    // 4. 弱势市场：市场宽度低（32%以下股票上涨）- 进一步降低阈值
    if (breadth < 0.32) {
      return 'WEAK_BEAR';
    }
    
    // 5. 震荡市场：其他情况（32-42%）
    return 'SIDEWAYS';
  }
  
  /**
   * 获取市场状态对应的策略参数（优化版：提升牛市进攻性）
   */
  getRegimeParams(regime) {
    const paramsMap = {
      // 强势牛市：极高进攻性，最大化收益（基于市场宽度>52%的客观判断）
      AGGRESSIVE_BULL: {
        maxWeight: 0.25,           // 提升至25%（极高集中度）
        volatilityWindow: 12,
        ewmaDecay: 0.97,           // 提升至0.97，更重视近期数据
        minROE: 0,                 // 完全放开质量限制
        maxDebtRatio: 1,
        momentumMonths: 3,         // 短周期动量，快速响应
        minMomentumReturn: -0.05,  // 放宽至-5%，允许小幅回调
        filterByQuality: false
      },
      
      // 温和牛市：高进攻性（基于市场宽度42-52%的客观判断）
      MODERATE_BULL: {
        maxWeight: 0.20,           // 提升至20%（高集中度）
        volatilityWindow: 6,
        ewmaDecay: 0.94,           // 提升至0.94
        minROE: 0,                 // 放开ROE限制
        maxDebtRatio: 1,
        momentumMonths: 6,
        minMomentumReturn: -0.08,  // 放宽至-8%
        filterByQuality: false     // 不筛选质量，最大化参与
      },
      
      // 震荡市场：偏进攻策略（市场宽度32-42%，大幅提升以应对牛市误判）
      SIDEWAYS: {
        maxWeight: 0.18,           // 大幅提升至18%（原10%）
        volatilityWindow: 6,
        ewmaDecay: 0.92,           // 提升至0.92
        minROE: 0,                 // 完全放开质量要求
        maxDebtRatio: 1,
        momentumMonths: 6,
        minMomentumReturn: -0.10,  // 放宽至-10%
        filterByQuality: false     // 不筛选质量
      },
      
      // 弱势市场：中性偏进攻策略（市场宽度<32%，大幅提升以应对牛市误判）
      WEAK_BEAR: {
        maxWeight: 0.16,           // 大幅提升至16%（原8%，提升100%）
        volatilityWindow: 6,
        ewmaDecay: 0.91,           // 提升至0.91
        minROE: 0,                 // 完全放开质量要求
        maxDebtRatio: 1,           // 完全放开债务限制
        momentumMonths: 6,         // 缩短至6个月
        minMomentumReturn: -0.10,  // 放宽至-10%
        filterByQuality: false     // 不筛选质量
      },
      
      // 恐慌市场：极度防守
      PANIC: {
        maxWeight: 0.06,
        volatilityWindow: 3,
        ewmaDecay: 0.80,
        minROE: 0.12,
        maxDebtRatio: 0.40,
        momentumMonths: 12,
        minMomentumReturn: -0.15,
        filterByQuality: true
      }
    };
    
    return paramsMap[regime] || paramsMap.SIDEWAYS;
  }
  
  /**
   * 计算置信度
   */
  calculateConfidence(trend, breadth, volatility, momentum, regime) {
    let confidence = 0.5;
    
    switch (regime) {
      case 'AGGRESSIVE_BULL':
        confidence = Math.min(1.0, 
          (Math.abs(trend) / 0.10) * 0.3 +
          (breadth / 0.70) * 0.3 +
          (momentum / 0.20) * 0.2 +
          ((1 - volatility) / 0.50) * 0.2
        );
        break;
        
      case 'MODERATE_BULL':
        confidence = Math.min(1.0,
          (Math.abs(trend) / 0.05) * 0.4 +
          (breadth / 0.60) * 0.3 +
          (momentum / 0.10) * 0.3
        );
        break;
        
      case 'PANIC':
        confidence = Math.min(1.0,
          (Math.abs(trend) / 0.10) * 0.3 +
          (volatility / 0.90) * 0.3 +
          ((1 - breadth) / 0.80) * 0.2 +
          (Math.abs(momentum) / 0.15) * 0.2
        );
        break;
        
      case 'WEAK_BEAR':
        confidence = Math.min(1.0,
          (Math.abs(trend) / 0.05) * 0.4 +
          ((1 - breadth) / 0.70) * 0.4 +
          (volatility / 0.70) * 0.2
        );
        break;
        
      default: // SIDEWAYS
        confidence = 0.6;
    }
    
    return Math.max(0.3, Math.min(1.0, confidence));
  }
  
  /**
   * 获取市场状态中文名称
   */
  getRegimeName(regime) {
    const nameMap = {
      AGGRESSIVE_BULL: '强势牛市',
      MODERATE_BULL: '温和牛市',
      SIDEWAYS: '震荡市场',
      WEAK_BEAR: '弱势市场',
      PANIC: '恐慌市场'
    };
    return nameMap[regime] || '未知';
  }
  
  /**
   * 获取默认状态（震荡市场）
   */
  getDefaultRegime(date) {
    return {
      regime: 'SIDEWAYS',
      regimeName: '震荡市场',
      trendStrength: 0,
      marketBreadth: 0.5,
      volatilityLevel: 0.5,
      momentumStrength: 0,
      confidence: 0.5,
      params: this.getRegimeParams('SIDEWAYS'),
      date
    };
  }
  
  // ========== 辅助函数 ==========
  
  /**
   * 计算移动平均
   */
  calculateMA(prices, period) {
    if (!prices || prices.length < period) return null;
    
    const recentPrices = prices.slice(-period);
    const sum = recentPrices.reduce((acc, p) => acc + p.close, 0);
    return sum / period;
  }
  
  /**
   * 计算波动率（年化）
   */
  calculateVolatility(prices) {
    if (!prices || prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      const ret = Math.log(prices[i].close / prices[i - 1].close);
      returns.push(ret);
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / returns.length;
    const dailyVol = Math.sqrt(variance);
    
    // 年化波动率（假设252个交易日）
    return dailyVol * Math.sqrt(252);
  }
  
  /**
   * 获取N天前的日期
   */
  getDateBefore(date, days) {
    const year = parseInt(date.substring(0, 4));
    const month = parseInt(date.substring(4, 6)) - 1;
    const day = parseInt(date.substring(6, 8));
    
    const d = new Date(year, month, day);
    d.setDate(d.getDate() - days);
    
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    
    return `${y}${m}${dd}`;
  }
}

module.exports = new MarketRegimeService();
