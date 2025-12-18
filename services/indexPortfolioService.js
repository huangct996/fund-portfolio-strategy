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
      useRiskParity = false,
      scoreWeights = { mvWeight: 0.5, dvWeight: 0.3, qualityWeight: 0.2 },
      qualityFactorType = 'pe_pb',
      riskParityParams = null
    } = config;

    console.log('\n' + '='.repeat(60));
    console.log(`开始计算基于指数成分股的回测收益率`);
    console.log(`指数代码: ${indexCode}`);
    console.log(`基金代码: ${fundCode} (用于净值对比)`);
    if (startDate) console.log(`开始日期: ${startDate}`);
    if (endDate) console.log(`结束日期: ${endDate}`);
    if (useRiskParity) {
      console.log(`策略类型: 风险平价策略`);
      console.log(`风险平价参数:`, riskParityParams);
    } else if (useCompositeScore) {
      console.log(`策略类型: 综合得分策略`);
    } else {
      console.log(`策略类型: 市值加权策略`);
    }
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

    // 保存原始年度调仓日期（用于指数策略）
    const yearlyRebalanceDates = [...rebalanceDates];
    
    // 如果是风险平价策略且需要更高频率调仓，生成新的调仓日期
    if (useRiskParity && riskParityParams && riskParityParams.rebalanceFrequency !== 'yearly') {
      const originalDates = [...rebalanceDates];
      rebalanceDates = this.generateHighFrequencyRebalanceDates(
        rebalanceDates, 
        riskParityParams.rebalanceFrequency
      );
      console.log(`🔄 生成高频调仓日期: ${originalDates.length} → ${rebalanceDates.length} 个`);
      console.log(`   自定义策略: ${riskParityParams.rebalanceFrequency === 'quarterly' ? '每季度' : '每月'}调仓`);
      console.log(`   指数策略: 年度调仓（保持不变）\n`);
    }

    const results = [];
    let previousWeights = null; // 用于计算交易成本
    
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
        // 判断当前日期是否是年度调仓日（指数策略只在年度调仓）
        const isYearlyRebalance = yearlyRebalanceDates.includes(currentDate);
        
        const periodResult = await this.calculatePeriodReturns(
          indexWeights,
          startDate,
          endDate,
          fundCode,
          config,
          previousWeights,
          isYearlyRebalance
        );

        if (periodResult) {
          results.push({
            rebalanceDate: currentDate,
            startDate,
            endDate,
            ...periodResult
          });
          
          // 更新上一期权重（用于下一期计算交易成本）
          if (periodResult.currentWeights) {
            previousWeights = periodResult.currentWeights;
          }
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
    
    // 指数收益率：只使用年度调仓期的数据
    const indexReturns = results
      .filter(r => r.isYearlyRebalance)
      .map(r => r.indexReturn);
    
    const fundReturns = results.map(r => r.fundReturn);

    console.log('\n调试：收益率数据');
    console.log('自定义策略收益率:', customReturns.map(r => (r * 100).toFixed(2) + '%'));
    console.log('指数收益率:', indexReturns.map(r => (r * 100).toFixed(2) + '%'));
    console.log('有负收益的期数 - 自定义:', customReturns.filter(r => r < 0).length);
    console.log('有负收益的期数 - 指数:', indexReturns.filter(r => r < 0).length);

    // 传入完整的调仓期数组，用于计算年化频率
    // 从配置中获取无风险收益率，默认2%
    const riskFreeRate = (useRiskParity && riskParityParams && riskParityParams.riskFreeRate) 
      ? riskParityParams.riskFreeRate 
      : 0.02;
    
    const customRisk = this.calculateRiskMetrics(customReturns, results, riskFreeRate);
    
    // 指数风险指标：使用基金净值数据作为代理（因为基金跟踪指数）
    let indexRisk;
    try {
      const firstDate = results.find(r => r.isYearlyRebalance)?.rebalanceDate;
      const lastDate = results[results.length - 1]?.rebalanceDate;
      
      if (firstDate && lastDate) {
        console.log(`\n使用基金净值数据计算指数的准确风险指标...`);
        indexRisk = await this.calculateIndexRiskMetricsFromFundNav(fundCode, firstDate, lastDate, riskFreeRate);
      } else {
        // 降级方案：使用调仓期数据
        indexRisk = this.calculateRiskMetrics(indexReturns, results.filter(r => r.isYearlyRebalance), riskFreeRate);
      }
    } catch (error) {
      console.warn('使用基金净值数据计算失败，降级使用调仓期数据:', error.message);
      indexRisk = this.calculateRiskMetrics(indexReturns, results.filter(r => r.isYearlyRebalance), riskFreeRate);
    }
    
    const fundRisk = this.calculateRiskMetrics(fundReturns, results, riskFreeRate);
    
    console.log('\n风险指标计算结果:');
    console.log('自定义策略 - 最大回撤:', (customRisk.maxDrawdown * 100).toFixed(2) + '%');
    console.log('指数策略 - 最大回撤:', (indexRisk.maxDrawdown * 100).toFixed(2) + '%');

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
  async calculatePeriodReturns(indexWeights, startDate, endDate, fundCode, config, previousWeights = null, calculateIndexReturn = true) {
    const { useCompositeScore, useRiskParity, scoreWeights, qualityFactorType, riskParityParams } = config;

    // 1. 准备成分股列表
    const stockCodes = indexWeights.map(w => w.con_code);
    
    // 2. 获取股票的市值、股息率等数据
    const stocksWithData = await this.enrichStockData(indexWeights, startDate);
    
    if (stocksWithData.length === 0) {
      console.warn(`⚠️  无有效股票数据，跳过该期`);
      return null;
    }

    // 3. 计算自定义策略权重
    let customPortfolio;
    let currentWeights = null;
    let tradingCost = 0;
    
    if (useRiskParity && riskParityParams) {
      // 风险平价策略
      const riskParityWeights = await this.calculateRiskParityWeights(
        stocksWithData,
        startDate,
        {
          volatilityWindow: riskParityParams.volatilityWindow,
          ewmaDecay: riskParityParams.ewmaDecay,
          maxWeight: config.maxWeight
        }
      );
      
      customPortfolio = stocksWithData.map(stock => ({
        ...stock,
        adjustedWeight: riskParityWeights[stock.con_code] || 0
      }));
      
      currentWeights = riskParityWeights;
      
      // 计算交易成本
      if (riskParityParams.enableTradingCost && riskParityParams.tradingCostRate > 0) {
        tradingCost = this.calculateTradingCost(
          previousWeights,
          currentWeights,
          riskParityParams.tradingCostRate
        );
        console.log(`💰 交易成本: ${(tradingCost * 100).toFixed(3)}%`);
      }
    } else {
      // 原有策略（市值加权或综合得分）
      customPortfolio = this.calculateCustomWeights(
        stocksWithData,
        useCompositeScore,
        scoreWeights,
        qualityFactorType
      );
    }

    // 4. 准备指数策略组合（使用指数原始权重）
    const indexPortfolio = stocksWithData.map(stock => ({
      ...stock,
      adjustedWeight: stock.indexWeight / 100  // 指数权重是百分比，转换为小数
    }));

    // 5. 计算三种策略的收益率
    const customReturns = await this.calculatePortfolioReturns(customPortfolio, startDate, endDate);
    
    // 指数策略只在年度调仓日计算，其他时间返回0
    let indexReturns = null;
    if (calculateIndexReturn) {
      indexReturns = await this.calculatePortfolioReturns(indexPortfolio, startDate, endDate);
    }
    
    const fundNavReturn = await this.calculateReturnsFromNav(fundCode, startDate, endDate);

    if (!customReturns) {
      return null;
    }

    // 扣除交易成本
    const netCustomReturn = customReturns.portfolioReturn - tradingCost;

    return {
      // 自定义策略
      customReturn: netCustomReturn,
      customReturnBeforeCost: customReturns.portfolioReturn,
      tradingCost: tradingCost,
      customStockCount: customReturns.stockCount,
      // 指数策略（只在年度调仓日计算）
      indexReturn: indexReturns ? indexReturns.portfolioReturn : 0,
      indexStockCount: indexReturns ? indexReturns.stockCount : 0,
      isYearlyRebalance: calculateIndexReturn,
      // 基金净值（如果返回null，则不设置这些字段，让它们为undefined）
      fundReturn: fundNavReturn?.return || 0,
      fundStartNav: fundNavReturn?.startNav,
      fundEndNav: fundNavReturn?.endNav,
      // 统计信息
      stockCount: stocksWithData.length,
      currentWeights: currentWeights, // 用于下一期计算交易成本
      holdings: customPortfolio.map(p => ({
        symbol: p.con_code,
        name: p.name,
        indexWeight: p.indexWeight,
        customWeight: p.adjustedWeight,
        marketValue: p.marketValue,
        dvRatio: p.dvRatio,
        peTtm: p.peTtm,
        pb: p.pb,
        compositeScore: p.compositeScore || 0,
        qualityFactor: p.qualityFactor || 0,
        isLimited: p.isLimited || false
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
   * 计算综合得分
   */
  calculateCompositeScore(stocks, weights, qualityFactorType) {
    const { mvWeight, dvWeight, qualityWeight } = weights;
    
    // 计算质量因子
    stocks.forEach(stock => {
      let qualityFactor = 0;
      
      if (qualityFactorType === 'roe') {
        qualityFactor = stock.roe || 0;
      } else if (qualityFactorType === 'pe') {
        qualityFactor = stock.peTtm > 0 ? 1 / stock.peTtm : 0;
      } else if (qualityFactorType === 'pb') {
        qualityFactor = stock.pb > 0 ? 1 / stock.pb : 0;
      } else {
        // pe_pb综合
        const peScore = stock.peTtm > 0 ? 1 / stock.peTtm : 0;
        const pbScore = stock.pb > 0 ? 1 / stock.pb : 0;
        qualityFactor = (peScore + pbScore) / 2;
      }
      
      stock.qualityFactor = qualityFactor;
    });
    
    // 归一化各因子
    const totalMv = stocks.reduce((sum, s) => sum + s.marketValue, 0);
    const totalDv = stocks.reduce((sum, s) => sum + s.dvRatio, 0);
    const totalQuality = stocks.reduce((sum, s) => sum + s.qualityFactor, 0);
    
    // 计算综合得分
    const stocksWithScore = stocks.map(s => {
      const mvScore = totalMv > 0 ? s.marketValue / totalMv : 0;
      const dvScore = totalDv > 0 ? s.dvRatio / totalDv : 0;
      const qualityScore = totalQuality > 0 ? s.qualityFactor / totalQuality : 0;
      
      const compositeScore = mvScore * mvWeight + dvScore * dvWeight + qualityScore * qualityWeight;
      
      return {
        ...s,
        compositeScore,
        adjustedWeight: 0,
        isLimited: false
      };
    });
    
    // 根据综合得分分配权重
    const totalScore = stocksWithScore.reduce((sum, stock) => sum + stock.compositeScore, 0);
    
    return stocksWithScore.map(s => {
      s.adjustedWeight = totalScore > 0 ? s.compositeScore / totalScore : 0;
      return s;
    });
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
    const priceData = await tushareService.batchGetStockPrices(stockCodes, startDate, endDate);
    
    const stockReturns = [];
    let validWeightSum = 0;

    for (const stock of portfolio) {
      const code = stock.con_code || stock.symbol;
      const prices = priceData[code];
      
      if (!prices || prices.length === 0) {
        console.warn(`⚠️  ${code} 无价格数据，跳过`);
        continue;
      }
      
      // 如果只有一条数据，收益率为0
      if (prices.length === 1) {
        stockReturns.push({
          symbol: code,
          return: 0,
          weight: stock.adjustedWeight,
          normalizedWeight: stock.adjustedWeight
        });
        validWeightSum += stock.adjustedWeight;
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
    const navData = await tushareService.getFundNav(fundCode, startDate, endDate);
    
    if (!navData || navData.length === 0) {
      console.warn(`⚠️  基金 ${fundCode} 在 ${startDate}-${endDate} 无净值数据`);
      return null;
    }

    // 找到最接近startDate的净值（可能是之前的日期，因为基金可能不是每天都有净值）
    const startNav = navData.find(n => n.nav_date >= startDate) || navData[0];
    // 找到最接近endDate的净值
    const endNav = navData.filter(n => n.nav_date <= endDate).pop() || navData[navData.length - 1];

    if (!startNav || !endNav || startNav.nav_date === endNav.nav_date) {
      console.warn(`⚠️  基金 ${fundCode} 在 ${startDate}-${endDate} 净值数据不足`);
      return null;
    }

    // 使用单位净值计算收益率（不使用累计净值，避免重复计算分红）
    const unitNavChange = (endNav.unit_nav - startNav.unit_nav) / startNav.unit_nav;
    
    // 检测异常数据：单期收益率超过±50%视为异常
    if (Math.abs(unitNavChange) > 0.5) {
      console.warn(`⚠️  基金净值异常: ${startNav.nav_date}(${startNav.unit_nav}) → ${endNav.nav_date}(${endNav.unit_nav}), 收益率: ${(unitNavChange * 100).toFixed(2)}%`);
      console.warn(`⚠️  疑似数据错误，使用累计净值重新计算`);
      
      // 尝试使用累计净值计算
      if (startNav.accum_nav && endNav.accum_nav) {
        const accumNavChange = (endNav.accum_nav - startNav.accum_nav) / startNav.accum_nav;
        console.log(`📊 使用累计净值: ${startNav.nav_date}(${startNav.accum_nav}) → ${endNav.nav_date}(${endNav.accum_nav}), 收益率: ${(accumNavChange * 100).toFixed(2)}%`);
        
        // 如果累计净值的收益率也异常，则返回null
        if (Math.abs(accumNavChange) > 0.5) {
          console.error(`❌ 累计净值也异常，跳过该期基金数据`);
          return null;
        }
        
        return {
          return: accumNavChange,
          startNav: startNav.accum_nav,
          endNav: endNav.accum_nav,
          startDate: startNav.nav_date,
          endDate: endNav.nav_date
        };
      }
      
      // 如果没有累计净值，返回null
      console.error(`❌ 无累计净值数据，跳过该期基金数据`);
      return null;
    }
    
    console.log(`📊 基金净值: ${startNav.nav_date}(${startNav.unit_nav}) → ${endNav.nav_date}(${endNav.unit_nav}), 收益率: ${(unitNavChange * 100).toFixed(2)}%`);
    
    return {
      return: unitNavChange,
      startNav: startNav.unit_nav,
      endNav: endNav.unit_nav,
      startDate: startNav.nav_date,
      endDate: endNav.nav_date
    };
  }

  /**
   * 计算累计收益率
   */
  calculateCumulativeReturns(results) {
    let customCumulative = 1;
    let indexCumulative = 1;
    
    // 获取基金的起始净值（第一期的startNav）
    const initialFundNav = results[0]?.fundStartNav || 1;
    let lastValidFundNav = initialFundNav;  // 记录最后一个有效的基金净值

    results.forEach((r, index) => {
      if (index === 0) {
        // 第一个调仓期：累计收益率为0（建仓基点）
        r.customCumulativeReturn = 0;
        r.indexCumulativeReturn = 0;
        r.fundCumulativeReturn = 0;
        r.trackingError = 0;
        
        if (r.fundEndNav) {
          lastValidFundNav = r.fundEndNav;
        }
      } else {
        // 后续调仓期：累加收益率
        customCumulative *= (1 + r.customReturn);
        indexCumulative *= (1 + r.indexReturn);
        
        // 基金净值：使用当前净值相对于初始净值的涨幅
        // 如果当前期有有效净值，使用当前净值；否则使用上一期的净值
        const currentFundNav = r.fundEndNav || lastValidFundNav;
        const fundCumulativeReturn = (currentFundNav - initialFundNav) / initialFundNav;
        
        r.customCumulativeReturn = customCumulative - 1;
        r.indexCumulativeReturn = indexCumulative - 1;
        r.fundCumulativeReturn = fundCumulativeReturn;
        r.trackingError = r.customCumulativeReturn - r.indexCumulativeReturn;
        
        // 更新最后有效净值
        if (r.fundEndNav) {
          lastValidFundNav = r.fundEndNav;
        }
      }

      console.log(`调仓期${index + 1} ${r.rebalanceDate}: 自定义${(r.customCumulativeReturn * 100).toFixed(2)}%, 指数${(r.indexCumulativeReturn * 100).toFixed(2)}%, 基金${(r.fundCumulativeReturn * 100).toFixed(2)}%, 跟踪误差${(r.trackingError * 100).toFixed(2)}%`);
    });
  }

  /**
   * 基于基金净值数据计算指数风险指标（使用基金作为指数的代理）
   */
  async calculateIndexRiskMetricsFromFundNav(fundCode, startDate, endDate, riskFreeRate = 0.02) {
    try {
      // 获取基金净值数据
      const navData = await tushareService.getFundNav(fundCode, startDate, endDate);
      
      if (!navData || navData.length < 2) {
        throw new Error('基金净值数据不足');
      }
      
      // 按日期排序
      navData.sort((a, b) => a.nav_date.localeCompare(b.nav_date));
      
      // 计算日收益率
      const dailyReturns = [];
      for (let i = 1; i < navData.length; i++) {
        const prevNav = navData[i - 1].accum_nav || navData[i - 1].unit_nav;
        const currNav = navData[i].accum_nav || navData[i].unit_nav;
        if (prevNav > 0 && currNav > 0) {
          dailyReturns.push((currNav - prevNav) / prevNav);
        }
      }
      
      if (dailyReturns.length === 0) {
        throw new Error('无有效日收益率数据');
      }
      
      // 计算累计收益率
      const totalReturn = dailyReturns.reduce((prod, r) => prod * (1 + r), 1) - 1;
      
      // 计算实际年数
      const firstDate = new Date(
        navData[0].nav_date.substring(0, 4),
        parseInt(navData[0].nav_date.substring(4, 6)) - 1,
        navData[0].nav_date.substring(6, 8)
      );
      const lastDate = new Date(
        navData[navData.length - 1].nav_date.substring(0, 4),
        parseInt(navData[navData.length - 1].nav_date.substring(4, 6)) - 1,
        navData[navData.length - 1].nav_date.substring(6, 8)
      );
      const totalDays = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
      const actualYears = totalDays / 365;
      
      // 年化收益率
      const annualizedReturn = Math.pow(1 + totalReturn, 1 / actualYears) - 1;
      
      // 计算波动率（日收益率的标准差）
      const avgReturn = dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
      const variance = dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length;
      const dailyVolatility = Math.sqrt(variance);
      
      // 年化波动率（假设252个交易日）
      const annualizedVolatility = dailyVolatility * Math.sqrt(252);
      
      // 夏普比率
      const sharpeRatio = annualizedVolatility > 0 
        ? (annualizedReturn - riskFreeRate) / annualizedVolatility 
        : 0;
      
      // 最大回撤（基于净值数据）
      let maxDrawdown = 0;
      let peak = navData[0].accum_nav || navData[0].unit_nav;
      
      for (let i = 1; i < navData.length; i++) {
        const nav = navData[i].accum_nav || navData[i].unit_nav;
        if (nav > peak) {
          peak = nav;
        }
        const drawdown = (peak - nav) / peak;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
      
      console.log(`  📈 指数风险指标（基于基金${navData.length}个交易日净值）:`);
      console.log(`     累计收益率: ${(totalReturn * 100).toFixed(2)}%`);
      console.log(`     年化收益率: ${(annualizedReturn * 100).toFixed(2)}% (基于${actualYears.toFixed(2)}年)`);
      console.log(`     年化波动率: ${(annualizedVolatility * 100).toFixed(2)}%`);
      console.log(`     无风险收益率: ${(riskFreeRate * 100).toFixed(2)}%`);
      console.log(`     夏普比率: ${sharpeRatio.toFixed(2)}`);
      console.log(`     最大回撤: ${(maxDrawdown * 100).toFixed(2)}%`);
      
      return {
        totalReturn,
        annualizedReturn,
        volatility: annualizedVolatility,
        sharpeRatio,
        maxDrawdown,
        periods: navData.length
      };
    } catch (error) {
      console.error('基于基金净值计算指数风险指标失败:', error.message);
      throw error;
    }
  }

  /**
   * 计算风险指标
   */
  calculateRiskMetrics(returns, periods, riskFreeRate = 0.02) {
    if (!returns || returns.length === 0) return null;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    
    // 计算实际时间跨度（年数）
    let actualYears = 1; // 默认1年
    let periodsPerYear = 1; // 默认年度调仓（用于波动率年化）
    
    if (periods && periods.length > 1) {
      // 计算实际时间跨度
      const firstDate = new Date(
        periods[0].rebalanceDate.substring(0, 4),
        parseInt(periods[0].rebalanceDate.substring(4, 6)) - 1,
        periods[0].rebalanceDate.substring(6, 8)
      );
      const lastDate = new Date(
        periods[periods.length - 1].rebalanceDate.substring(0, 4),
        parseInt(periods[periods.length - 1].rebalanceDate.substring(4, 6)) - 1,
        periods[periods.length - 1].rebalanceDate.substring(6, 8)
      );
      const totalDays = (lastDate - firstDate) / (1000 * 60 * 60 * 24);
      actualYears = totalDays / 365;
      
      // 计算平均调仓频率（用于波动率年化）
      const avgDaysPerPeriod = totalDays / (periods.length - 1);
      periodsPerYear = Math.round(365 / avgDaysPerPeriod);
      periodsPerYear = Math.max(1, Math.min(12, periodsPerYear));
      
      console.log(`  📊 时间跨度: ${periods.length}个调仓期, 实际${actualYears.toFixed(2)}年, 平均间隔${avgDaysPerPeriod.toFixed(0)}天, 年化频率=${periodsPerYear}次/年`);
    }
    
    // 计算累计收益率和年化收益率
    const totalReturn = returns.reduce((prod, r) => prod * (1 + r), 1) - 1;
    const annualizedReturn = Math.pow(1 + totalReturn, 1 / actualYears) - 1;
    
    // 波动率年化使用调仓频率
    const annualizedVolatility = volatility * Math.sqrt(periodsPerYear);
    
    // 夏普比率（使用可配置的无风险利率）
    const sharpeRatio = annualizedVolatility > 0 
      ? (annualizedReturn - riskFreeRate) / annualizedVolatility 
      : 0;
    
    console.log(`  📈 风险指标详情:`);
    console.log(`     期间平均收益率: ${(avgReturn * 100).toFixed(2)}%`);
    console.log(`     期间波动率: ${(volatility * 100).toFixed(2)}%`);
    console.log(`     累计收益率: ${(totalReturn * 100).toFixed(2)}%`);
    console.log(`     年化收益率: ${(annualizedReturn * 100).toFixed(2)}% (基于${actualYears.toFixed(2)}年)`);
    console.log(`     年化波动率: ${(annualizedVolatility * 100).toFixed(2)}%`);
    console.log(`     无风险收益率: ${(riskFreeRate * 100).toFixed(2)}%`);
    console.log(`     夏普比率: ${sharpeRatio.toFixed(2)}`);
    
    // 索提诺比率（只考虑下行波动）
    const downReturns = returns.filter(r => r < 0);
    let sortinoRatio = 0;
    if (downReturns.length > 0) {
      const downVariance = downReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / returns.length;
      const downVolatility = Math.sqrt(downVariance) * Math.sqrt(periodsPerYear);
      sortinoRatio = downVolatility > 0 ? (annualizedReturn - riskFreeRate) / downVolatility : 0;
    }
    
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
      totalReturn,
      annualizedReturn,
      volatility: annualizedVolatility,
      sharpeRatio,
      sortinoRatio,
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

  /**
   * 使用EWMA计算股票的历史波动率
   * @param {Array} returns - 历史收益率数组
   * @param {number} decay - EWMA衰减系数 (0-1之间，如0.94)
   * @returns {number} 波动率
   */
  calculateEWMAVolatility(returns, decay = 0.94) {
    if (!returns || returns.length === 0) return 0;
    
    // 计算均值
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    
    // 使用EWMA计算方差
    let ewmaVariance = 0;
    let weight = 1;
    let totalWeight = 0;
    
    // 从最近的数据开始，给予更高权重
    for (let i = returns.length - 1; i >= 0; i--) {
      const deviation = returns[i] - mean;
      ewmaVariance += weight * deviation * deviation;
      totalWeight += weight;
      weight *= decay;
    }
    
    ewmaVariance /= totalWeight;
    return Math.sqrt(ewmaVariance);
  }

  /**
   * 获取股票的历史日收益率数据（使用数据库缓存）
   * @param {string} tsCode - 股票代码
   * @param {string} endDate - 结束日期
   * @param {number} windowMonths - 窗口期（月）
   * @returns {Array} 日收益率数组
   */
  async getStockDailyReturns(tsCode, endDate, windowMonths = 12) {
    try {
      // 计算开始日期（向前推windowMonths个月）
      const endDateObj = new Date(
        endDate.substring(0, 4),
        parseInt(endDate.substring(4, 6)) - 1,
        endDate.substring(6, 8)
      );
      const startDateObj = new Date(endDateObj);
      startDateObj.setMonth(startDateObj.getMonth() - windowMonths);
      
      const startDate = startDateObj.getFullYear() + 
        String(startDateObj.getMonth() + 1).padStart(2, '0') + 
        String(startDateObj.getDate()).padStart(2, '0');
      
      // 使用 tushareService 的缓存机制获取日行情数据
      // 该方法会先从数据库查询，没有则从 Tushare 同步
      // 传入期望的最小数据量：每月约20个交易日，乘以窗口月数，再打8折作为阈值
      const expectedMinRecords = Math.floor(windowMonths * 20 * 0.8);
      
      console.log(`  🔍 获取 ${tsCode} 历史数据: ${startDate}-${endDate}, 窗口=${windowMonths}月, 期望≥${expectedMinRecords}条`);
      
      const dailyData = await tushareService.getStockDailyWithCache(tsCode, startDate, endDate, expectedMinRecords);
      
      console.log(`  📊 ${tsCode} 实际获取: ${dailyData ? dailyData.length : 0}条记录`);
      
      if (!dailyData || dailyData.length < 2) {
        console.log(`  ⚠️ ${tsCode}: 数据不足，获取到${dailyData ? dailyData.length : 0}条记录`);
        return [];
      }
      
      // 按日期升序排序
      dailyData.sort((a, b) => a.trade_date.localeCompare(b.trade_date));
      
      // 计算日收益率（使用后复权价格）
      const returns = [];
      let validCount = 0;
      let invalidCount = 0;
      
      for (let i = 1; i < dailyData.length; i++) {
        const prevClose = dailyData[i - 1].adj_close || dailyData[i - 1].close_price || dailyData[i - 1].close;
        const currClose = dailyData[i].adj_close || dailyData[i].close_price || dailyData[i].close;
        
        if (prevClose > 0 && currClose > 0) {
          returns.push((currClose - prevClose) / prevClose);
          validCount++;
        } else {
          invalidCount++;
        }
      }
      
      if (invalidCount > 0) {
        console.log(`  ⚠️ ${tsCode}: ${invalidCount}条无效数据（价格<=0），有效数据${validCount}条`);
      }
      
      return returns;
    } catch (error) {
      console.error(`获取股票 ${tsCode} 历史收益率失败:`, error.message);
      return [];
    }
  }

  /**
   * 计算风险平价权重
   * @param {Array} stocks - 股票列表，包含tsCode
   * @param {string} rebalanceDate - 调仓日期
   * @param {Object} params - 风险平价参数
   * @returns {Object} 股票代码到权重的映射
   */
  async calculateRiskParityWeights(stocks, rebalanceDate, params = {}) {
    const {
      volatilityWindow = 12,
      ewmaDecay = 0.94,
      maxWeight = 0.15
    } = params;
    
    console.log(`\n计算风险平价权重 - 调仓日期: ${rebalanceDate}`);
    console.log(`参数: 窗口=${volatilityWindow}月, EWMA衰减=${ewmaDecay}, 最大权重=${maxWeight}`);
    
    // 1. 计算每只股票的波动率
    const stockVolatilities = [];
    let successCount = 0;
    let failCount = 0;
    
    for (const stock of stocks) {
      const returns = await this.getStockDailyReturns(stock.con_code, rebalanceDate, volatilityWindow);
      
      if (returns.length > 0) {
        const volatility = this.calculateEWMAVolatility(returns, ewmaDecay);
        stockVolatilities.push({
          tsCode: stock.con_code,
          volatility: volatility,
          returns: returns
        });
        successCount++;
        
        // 调试：输出前3只股票的详细信息
        if (successCount <= 3) {
          console.log(`  ${stock.con_code}: ${returns.length}个交易日, 波动率=${(volatility * 100).toFixed(3)}%`);
        }
      } else {
        // 如果没有数据，使用默认波动率
        stockVolatilities.push({
          tsCode: stock.con_code,
          volatility: 0.02, // 默认2%日波动率
          returns: []
        });
        failCount++;
      }
    }
    
    console.log(`波动率计算完成: 成功${successCount}只, 失败${failCount}只`);
    
    // 输出波动率统计
    const vols = stockVolatilities.map(s => s.volatility).filter(v => v > 0);
    if (vols.length > 0) {
      console.log(`波动率统计: 最小=${(Math.min(...vols) * 100).toFixed(3)}%, 最大=${(Math.max(...vols) * 100).toFixed(3)}%, 平均=${(vols.reduce((a, b) => a + b, 0) / vols.length * 100).toFixed(3)}%`);
    }
    
    // 2. 计算风险平价权重：权重 ∝ 1/波动率
    const invVolatilities = stockVolatilities.map(s => ({
      tsCode: s.tsCode,
      invVol: s.volatility > 0 ? 1 / s.volatility : 0
    }));
    
    const totalInvVol = invVolatilities.reduce((sum, s) => sum + s.invVol, 0);
    
    // 3. 归一化权重
    const weights = {};
    invVolatilities.forEach(s => {
      let weight = totalInvVol > 0 ? s.invVol / totalInvVol : 1 / stocks.length;
      // 应用最大权重限制
      weight = Math.min(weight, maxWeight);
      weights[s.tsCode] = weight;
    });
    
    // 4. 重新归一化（因为应用了最大权重限制）
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    Object.keys(weights).forEach(tsCode => {
      weights[tsCode] = weights[tsCode] / totalWeight;
    });
    
    console.log(`风险平价权重计算完成，共 ${Object.keys(weights).length} 只股票`);
    console.log(`权重范围: ${(Math.min(...Object.values(weights)) * 100).toFixed(2)}% - ${(Math.max(...Object.values(weights)) * 100).toFixed(2)}%`);
    
    return weights;
  }

  /**
   * 生成更高频率的调仓日期
   * @param {Array} baseRebalanceDates - 基础调仓日期（年度）
   * @param {string} frequency - 频率：'quarterly' 或 'monthly'
   * @returns {Array} 新的调仓日期列表
   */
  generateHighFrequencyRebalanceDates(baseRebalanceDates, frequency) {
    if (frequency === 'yearly') {
      return baseRebalanceDates;
    }
    
    const newDates = [];
    
    for (let i = 0; i < baseRebalanceDates.length - 1; i++) {
      const startDate = baseRebalanceDates[i];
      const endDate = baseRebalanceDates[i + 1];
      
      newDates.push(startDate);
      
      const startDateObj = new Date(
        startDate.substring(0, 4),
        parseInt(startDate.substring(4, 6)) - 1,
        startDate.substring(6, 8)
      );
      
      const endDateObj = new Date(
        endDate.substring(0, 4),
        parseInt(endDate.substring(4, 6)) - 1,
        endDate.substring(6, 8)
      );
      
      const monthsToAdd = frequency === 'quarterly' ? 3 : 1;
      
      let currentDate = new Date(startDateObj);
      currentDate.setMonth(currentDate.getMonth() + monthsToAdd);
      
      while (currentDate < endDateObj) {
        const dateStr = currentDate.getFullYear() + 
          String(currentDate.getMonth() + 1).padStart(2, '0') + 
          String(currentDate.getDate()).padStart(2, '0');
        newDates.push(dateStr);
        currentDate.setMonth(currentDate.getMonth() + monthsToAdd);
      }
    }
    
    // 添加最后一个日期
    newDates.push(baseRebalanceDates[baseRebalanceDates.length - 1]);
    
    return newDates;
  }

  /**
   * 计算交易成本
   * @param {Object} oldWeights - 旧权重
   * @param {Object} newWeights - 新权重
   * @param {number} tradingCostRate - 交易成本率
   * @returns {number} 交易成本
   */
  calculateTradingCost(oldWeights, newWeights, tradingCostRate) {
    if (!oldWeights || Object.keys(oldWeights).length === 0) {
      // 首次建仓，所有权重都是买入
      return Object.values(newWeights).reduce((sum, w) => sum + w, 0) * tradingCostRate;
    }
    
    // 计算权重变化的绝对值之和（换手率）
    const allCodes = new Set([...Object.keys(oldWeights), ...Object.keys(newWeights)]);
    let turnover = 0;
    
    allCodes.forEach(code => {
      const oldWeight = oldWeights[code] || 0;
      const newWeight = newWeights[code] || 0;
      turnover += Math.abs(newWeight - oldWeight);
    });
    
    // 交易成本 = 换手率 × 成本率
    return turnover * tradingCostRate;
  }
}

module.exports = new IndexPortfolioService();
