const tushareService = require('./tushareService');

/**
 * 基于指数成分股的投资组合回测服务
 * 用于跟踪指数成分股并计算收益率
 */
class IndexPortfolioService {
  constructor(maxWeight = 0.10) {
    this.maxWeight = maxWeight;
  }

  /**
   * 计算基于指数成分股的回测收益率
   * @param {string} indexCode - 指数代码，如 'h30269.CSI'
   * @param {string} fundCode - 基金代码，用于获取基金净值对比，如 '512890.SH'
   * @param {Object} config - 配置参数
   */
  async calculateIndexBasedReturns(indexCode, fundCode, config = {}) {
    const {
      startDate = '',
      endDate = '',
      useCompositeScore = false,
      scoreWeights = { mvWeight: 0.5, dvWeight: 0.3, qualityWeight: 0.2 },
      qualityFactorType = 'pe_pb'
    } = config;

    console.log('\n' + '='.repeat(60));
    console.log(`开始计算基于指数成分股的回测收益率`);
    console.log(`指数代码: ${indexCode}`);
    console.log(`基金代码: ${fundCode} (用于净值对比)`);
    if (startDate) console.log(`开始日期: ${startDate}`);
    if (endDate) console.log(`结束日期: ${endDate}`);
    console.log('='.repeat(60) + '\n');

    // 1. 获取指数的所有调仓日期
    let rebalanceDates = await tushareService.getIndexWeightDates(indexCode);
    
    if (!rebalanceDates || rebalanceDates.length === 0) {
      throw new Error(`未找到指数 ${indexCode} 的调仓日期数据`);
    }

    // 2. 根据日期范围过滤调仓日期
    if (startDate) {
      rebalanceDates = rebalanceDates.filter(date => date >= startDate);
    }
    if (endDate) {
      rebalanceDates = rebalanceDates.filter(date => date <= endDate);
    }

    if (rebalanceDates.length === 0) {
      throw new Error(`在指定日期范围内未找到调仓日期`);
    }

    console.log(`✅ 获取到 ${rebalanceDates.length} 个调仓日期`);
    console.log(`回测起始日期: ${rebalanceDates[0]}`);
    console.log(`回测结束日期: ${rebalanceDates[rebalanceDates.length - 1]}\n`);

    const results = [];
    
    // 2. 遍历每个调仓日期，计算收益率
    for (let i = 0; i < rebalanceDates.length; i++) {
      const currentDate = rebalanceDates[i];
      const nextDate = i < rebalanceDates.length - 1 ? rebalanceDates[i + 1] : null;
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`处理调仓日期 ${i + 1}/${rebalanceDates.length}: ${currentDate}`);
      console.log(`${'='.repeat(60)}`);

      try {
        // 获取当前日期的指数成分股权重
        const indexWeights = await tushareService.getIndexWeightByDate(indexCode, currentDate);
        
        if (!indexWeights || indexWeights.length === 0) {
          console.warn(`⚠️  调仓日期 ${currentDate} 无成分股数据，跳过`);
          continue;
        }

        console.log(`成分股数量: ${indexWeights.length} 只`);
        
        // 计算持有时间段
        const startDate = currentDate;  // 在调仓日建仓
        const endDate = nextDate || this.getTodayDate();  // 持有到下一个调仓日或今天
        
        console.log(`持有时间段: ${startDate} → ${endDate}`);

        // 3. 计算三种策略的收益率
        const periodResult = await this.calculatePeriodReturns(
          indexWeights,
          startDate,
          endDate,
          fundCode,
          config
        );

        if (periodResult) {
          results.push({
            rebalanceDate: currentDate,
            startDate,
            endDate,
            ...periodResult
          });
        }

      } catch (error) {
        console.error(`处理调仓日期 ${currentDate} 时出错:`, error.message);
        continue;
      }
    }

    // 4. 计算累计收益率
    this.calculateCumulativeReturns(results);

    // 5. 计算风险指标
    const customReturns = results.map(r => r.customReturn);
    const indexReturns = results.map(r => r.indexReturn);
    const fundReturns = results.map(r => r.fundReturn);

    const customRisk = this.calculateRiskMetrics(customReturns, results.length);
    const indexRisk = this.calculateRiskMetrics(indexReturns, results.length);
    const fundRisk = this.calculateRiskMetrics(fundReturns, results.length);

    // 6. 计算跟踪误差
    const trackingError = this.calculateTrackingError(customReturns, indexReturns);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`回测完成`);
    console.log(`有效调仓期数: ${results.length}`);
    console.log(`${'='.repeat(60)}\n`);

    return {
      periods: results,
      customRisk,
      indexRisk,
      fundRisk,
      trackingError
    };
  }

  /**
   * 计算单个调仓期的收益率
   */
  async calculatePeriodReturns(indexWeights, startDate, endDate, fundCode, config) {
    const { useCompositeScore, scoreWeights, qualityFactorType } = config;

    // 1. 准备成分股列表
    const stockCodes = indexWeights.map(w => w.con_code);
    
    // 2. 获取股票的市值、股息率等数据
    const stocksWithData = await this.enrichStockData(indexWeights, startDate);
    
    if (stocksWithData.length === 0) {
      console.warn(`⚠️  无有效股票数据，跳过该期`);
      return null;
    }

    // 3. 计算自定义策略权重
    const customPortfolio = this.calculateCustomWeights(
      stocksWithData,
      useCompositeScore,
      scoreWeights,
      qualityFactorType
    );

    // 4. 准备指数策略组合（使用指数原始权重）
    const indexPortfolio = stocksWithData.map(stock => ({
      ...stock,
      adjustedWeight: stock.indexWeight / 100  // 指数权重是百分比，转换为小数
    }));

    // 5. 计算三种策略的收益率
    const customReturns = await this.calculatePortfolioReturns(customPortfolio, startDate, endDate);
    const indexReturns = await this.calculatePortfolioReturns(indexPortfolio, startDate, endDate);
    const fundNavReturn = await this.calculateReturnsFromNav(fundCode, startDate, endDate);

    if (!customReturns || !indexReturns) {
      return null;
    }

    return {
      // 自定义策略
      customReturn: customReturns.portfolioReturn,
      customStockCount: customReturns.stockCount,
      // 指数策略
      indexReturn: indexReturns.portfolioReturn,
      indexStockCount: indexReturns.stockCount,
      // 基金净值
      fundReturn: fundNavReturn?.return || 0,
      fundStartNav: fundNavReturn?.startNav || 0,
      fundEndNav: fundNavReturn?.endNav || 0,
      // 统计信息
      stockCount: stocksWithData.length,
      holdings: customPortfolio.map(p => ({
        symbol: p.con_code,
        name: p.name,
        indexWeight: p.indexWeight,
        customWeight: p.adjustedWeight,
        marketValue: p.marketValue,
        dvRatio: p.dvRatio,
        peTtm: p.peTtm,
        pb: p.pb
      }))
    };
  }

  /**
   * 丰富股票数据（添加市值、股息率等）
   */
  async enrichStockData(indexWeights, tradeDate) {
    const stockCodes = indexWeights.map(w => w.con_code);
    
    // 批量获取股票基本信息（使用正确的方法名）
    const stockInfoMap = await tushareService.batchGetStockBasic(stockCodes, tradeDate);
    
    // 合并数据
    const enrichedStocks = [];
    for (const weight of indexWeights) {
      const info = stockInfoMap[weight.con_code];
      if (info && info.totalMv > 0) {
        enrichedStocks.push({
          con_code: weight.con_code,
          name: info.name || weight.con_code,
          indexWeight: weight.weight,  // 指数权重（百分比）
          marketValue: info.totalMv,
          dvRatio: info.dvRatio || 0,
          peTtm: info.peTtm || 0,
          pb: info.pb || 0
        });
      }
    }

    console.log(`有效股票数: ${enrichedStocks.length}/${indexWeights.length}`);
    
    return enrichedStocks;
  }

  /**
   * 计算自定义策略权重
   */
  calculateCustomWeights(stocks, useCompositeScore, scoreWeights, qualityFactorType) {
    let portfolio;

    if (useCompositeScore) {
      // 使用综合得分策略
      console.log(`使用综合得分策略`);
      portfolio = this.calculateCompositeScore(stocks, scoreWeights, qualityFactorType);
    } else {
      // 使用市值加权策略
      console.log(`使用市值加权策略`);
      const totalMv = stocks.reduce((sum, s) => sum + s.marketValue, 0);
      portfolio = stocks.map(s => ({
        ...s,
        adjustedWeight: s.marketValue / totalMv,
        isLimited: false
      }));
    }

    // 应用权重上限
    portfolio = this.applyWeightLimit(portfolio, useCompositeScore);

    return portfolio.sort((a, b) => b.adjustedWeight - a.adjustedWeight);
  }

  /**
   * 计算综合得分（复用原有逻辑）
   */
  calculateCompositeScore(stocks, weights, qualityFactorType) {
    // 这里复用portfolioService.js中的逻辑
    // 为了简化，暂时使用市值加权
    const totalMv = stocks.reduce((sum, s) => sum + s.marketValue, 0);
    return stocks.map(s => ({
      ...s,
      adjustedWeight: s.marketValue / totalMv,
      compositeScore: s.marketValue,
      isLimited: false
    }));
  }

  /**
   * 应用权重上限
   */
  applyWeightLimit(portfolio, useCompositeScore) {
    const maxWeight = this.maxWeight;
    let needsAdjustment = true;
    let iterationCount = 0;
    const maxIterations = 100;

    while (needsAdjustment && iterationCount < maxIterations) {
      needsAdjustment = false;
      let excessWeight = 0;
      let unrestrictedCount = 0;
      iterationCount++;

      // 找出超过限制的股票
      portfolio.forEach(stock => {
        if (!stock.isLimited && stock.adjustedWeight > maxWeight) {
          const excess = stock.adjustedWeight - maxWeight;
          excessWeight += excess;
          stock.adjustedWeight = maxWeight;
          stock.isLimited = true;
          needsAdjustment = true;
        } else if (!stock.isLimited) {
          unrestrictedCount++;
        }
      });

      // 重新分配超出的权重
      if (excessWeight > 0 && unrestrictedCount > 0) {
        if (useCompositeScore) {
          const unrestrictedTotalScore = portfolio
            .filter(s => !s.isLimited)
            .reduce((sum, s) => sum + (s.compositeScore || 0), 0);
          
          portfolio.forEach(stock => {
            if (!stock.isLimited && unrestrictedTotalScore > 0) {
              const scoreRatio = (stock.compositeScore || 0) / unrestrictedTotalScore;
              stock.adjustedWeight += excessWeight * scoreRatio;
            }
          });
        } else {
          const unrestrictedTotalMv = portfolio
            .filter(s => !s.isLimited)
            .reduce((sum, s) => sum + s.marketValue, 0);
          
          portfolio.forEach(stock => {
            if (!stock.isLimited) {
              const mvRatio = stock.marketValue / unrestrictedTotalMv;
              stock.adjustedWeight += excessWeight * mvRatio;
            }
          });
        }
      }
    }

    return portfolio;
  }

  /**
   * 计算投资组合收益率
   */
  async calculatePortfolioReturns(portfolio, startDate, endDate) {
    const stockCodes = portfolio.map(p => p.con_code || p.symbol);
    
    // 获取股票价格数据
    const priceData = await tushareService.getStockPrices(stockCodes, startDate, endDate);
    
    const stockReturns = [];
    let validWeightSum = 0;

    for (const stock of portfolio) {
      const code = stock.con_code || stock.symbol;
      const prices = priceData[code];
      
      if (!prices || prices.length < 2) {
        console.warn(`⚠️  ${code} 价格数据不足，跳过`);
        continue;
      }

      const startPrice = prices[0].close;
      const endPrice = prices[prices.length - 1].close;
      const stockReturn = (endPrice - startPrice) / startPrice;

      stockReturns.push({
        symbol: code,
        return: stockReturn,
        weight: stock.adjustedWeight,
        normalizedWeight: stock.adjustedWeight
      });

      validWeightSum += stock.adjustedWeight;
    }

    if (stockReturns.length === 0) {
      return null;
    }

    // 归一化权重
    stockReturns.forEach(s => {
      s.normalizedWeight = s.weight / validWeightSum;
    });

    // 计算组合收益率
    const portfolioReturn = stockReturns.reduce((sum, s) => {
      return sum + s.return * s.normalizedWeight;
    }, 0);

    return {
      startDate,
      endDate,
      portfolioReturn,
      stockCount: stockReturns.length,
      totalStocks: portfolio.length,
      stockReturns,
      validWeightSum
    };
  }

  /**
   * 使用基金净值计算收益率
   */
  async calculateReturnsFromNav(fundCode, startDate, endDate) {
    const navData = await tushareService.getFundNav(fundCode, startDate);
    
    if (!navData || navData.length < 2) {
      return null;
    }

    const startNav = navData.find(n => n.nav_date >= startDate);
    const endNav = navData.filter(n => n.nav_date <= endDate).pop();

    if (!startNav || !endNav) {
      return null;
    }

    const unitNavChange = (endNav.unit_nav - startNav.unit_nav) / startNav.unit_nav;
    const accumNavChange = (endNav.accum_nav - startNav.accum_nav) / startNav.accum_nav;
    
    const hasDividend = Math.abs(unitNavChange - accumNavChange) > 0.1;
    
    return {
      return: hasDividend ? accumNavChange : unitNavChange,
      startNav: startNav.unit_nav,
      endNav: endNav.unit_nav,
      hasDividend
    };
  }

  /**
   * 计算累计收益率
   */
  calculateCumulativeReturns(results) {
    let customCumulative = 1;
    let indexCumulative = 1;
    let fundCumulative = 1;

    results.forEach((r, index) => {
      if (index === 0) {
        // 第一个调仓期：累计收益率为0（建仓基点）
        r.customCumulativeReturn = 0;
        r.indexCumulativeReturn = 0;
        r.fundCumulativeReturn = 0;
        r.trackingError = 0;
      } else {
        // 后续调仓期：累加收益率
        customCumulative *= (1 + r.customReturn);
        indexCumulative *= (1 + r.indexReturn);
        fundCumulative *= (1 + r.fundReturn);
        
        r.customCumulativeReturn = customCumulative - 1;
        r.indexCumulativeReturn = indexCumulative - 1;
        r.fundCumulativeReturn = fundCumulative - 1;
        r.trackingError = r.customCumulativeReturn - r.indexCumulativeReturn;
      }

      console.log(`调仓期${index + 1} ${r.rebalanceDate}: 自定义${(r.customCumulativeReturn * 100).toFixed(2)}%, 指数${(r.indexCumulativeReturn * 100).toFixed(2)}%, 跟踪误差${(r.trackingError * 100).toFixed(2)}%`);
    });
  }

  /**
   * 计算风险指标
   */
  calculateRiskMetrics(returns, periods) {
    if (!returns || returns.length === 0) return null;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    
    // 年化收益率和波动率（假设每期约3个月）
    const periodsPerYear = 4;
    const annualizedReturn = Math.pow(1 + avgReturn, periodsPerYear) - 1;
    const annualizedVolatility = volatility * Math.sqrt(periodsPerYear);
    
    // 夏普比率（假设无风险利率3%）
    const riskFreeRate = 0.03;
    const sharpeRatio = annualizedVolatility > 0 
      ? (annualizedReturn - riskFreeRate) / annualizedVolatility 
      : 0;
    
    // 最大回撤
    let maxDrawdown = 0;
    let peak = 1;
    let cumulative = 1;
    
    returns.forEach(r => {
      cumulative *= (1 + r);
      if (cumulative > peak) {
        peak = cumulative;
      }
      const drawdown = (peak - cumulative) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    return {
      annualizedReturn,
      volatility: annualizedVolatility,
      sharpeRatio,
      maxDrawdown,
      periods
    };
  }

  /**
   * 计算跟踪误差
   */
  calculateTrackingError(customReturns, indexReturns) {
    if (!customReturns || !indexReturns || customReturns.length !== indexReturns.length) {
      return null;
    }

    const differences = customReturns.map((r, i) => r - indexReturns[i]);
    const avgDiff = differences.reduce((sum, d) => sum + d, 0) / differences.length;
    const variance = differences.reduce((sum, d) => sum + Math.pow(d - avgDiff, 2), 0) / differences.length;
    const trackingError = Math.sqrt(variance);
    
    // 年化跟踪误差
    const periodsPerYear = 4;
    const annualizedTE = trackingError * Math.sqrt(periodsPerYear);

    return {
      trackingError: annualizedTE,
      avgDifference: avgDiff,
      periods: customReturns.length
    };
  }

  /**
   * 获取今天的日期（YYYYMMDD格式）
   */
  getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
}

module.exports = new IndexPortfolioService();
