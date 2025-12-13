const tushareService = require('./tushareService');

class PortfolioService {
  constructor(maxWeight = 0.10) {
    this.maxWeight = maxWeight;
  }

  /**
   * 计算综合得分并分配权重
   * @param {Array} stocks - 股票列表，包含市值、股息率、质量因子
   * @param {Object} weights - 权重配置 {mvWeight, dvWeight, qualityWeight}
   * @param {string} qualityFactorType - 质量因子类型: 'pe_pb', 'pe', 'pb', 'roe'
   * @returns {Array} 带有综合得分和权重的股票列表
   */
  calculateCompositeScore(stocks, weights = {mvWeight: 0.5, dvWeight: 0.3, qualityWeight: 0.2}, qualityFactorType = 'pe_pb') {
    const {mvWeight, dvWeight, qualityWeight} = weights;
    
    // 根据类型计算质量因子
    stocks.forEach(stock => {
      switch(qualityFactorType) {
        case 'pe':
          stock.qualityFactor = stock.peScore || 0;
          break;
        case 'pb':
          stock.qualityFactor = stock.pbScore || 0;
          break;
        case 'roe':
          stock.qualityFactor = (stock.roe || 0) / 100;  // ROE转换为0-1范围
          break;
        case 'pe_pb':
        default:
          // 已经在tushareService中计算好了
          stock.qualityFactor = stock.qualityFactor || 0;
      }
    });
    
    // 确保权重和为1
    const totalWeight = mvWeight + dvWeight + qualityWeight;
    const normalizedMvWeight = mvWeight / totalWeight;
    const normalizedDvWeight = dvWeight / totalWeight;
    const normalizedQualityWeight = qualityWeight / totalWeight;
    
    // 过滤掉无效数据
    const validStocks = stocks.filter(s => s.marketValue > 0);
    
    if (validStocks.length === 0) {
      return [];
    }
    
    // 计算排名（值越大排名越高，排名分数越高）
    // 市值排名
    const sortedByMv = [...validStocks].sort((a, b) => b.marketValue - a.marketValue);
    sortedByMv.forEach((stock, index) => {
      stock.mvRank = validStocks.length - index;  // 排名分数：第1名得最高分
    });
    
    // 股息率排名
    const sortedByDv = [...validStocks].sort((a, b) => (b.dvRatio || 0) - (a.dvRatio || 0));
    sortedByDv.forEach((stock, index) => {
      stock.dvRank = validStocks.length - index;
    });
    
    // 质量因子排名
    const sortedByQuality = [...validStocks].sort((a, b) => (b.qualityFactor || 0) - (a.qualityFactor || 0));
    sortedByQuality.forEach((stock, index) => {
      stock.qualityRank = validStocks.length - index;
    });
    
    // 计算综合得分（归一化排名分数）
    validStocks.forEach(stock => {
      const mvScore = stock.mvRank / validStocks.length;
      const dvScore = stock.dvRank / validStocks.length;
      const qualityScore = stock.qualityRank / validStocks.length;
      
      stock.compositeScore = 
        mvScore * normalizedMvWeight + 
        dvScore * normalizedDvWeight + 
        qualityScore * normalizedQualityWeight;
    });
    
    // 按综合得分分配权重
    const totalScore = validStocks.reduce((sum, s) => sum + s.compositeScore, 0);
    validStocks.forEach(stock => {
      stock.adjustedWeight = stock.compositeScore / totalScore;
      stock.isLimited = false;
    });
    
    return validStocks.sort((a, b) => b.compositeScore - a.compositeScore);
  }

  /**
   * 调整组合权重（单只不超过maxWeight）
   */
  adjustWeights(holdings, maxWeight = 0.10) {
    if (!holdings || holdings.length === 0) {
      return [];
    }

    const totalMkv = holdings.reduce((sum, h) => sum + (h.mkv || 0), 0);
    
    let portfolio = holdings.map(h => ({
      symbol: h.symbol,
      originalMkv: h.mkv || 0,
      originalWeight: (h.mkv || 0) / totalMkv,
      adjustedWeight: 0,
      isLimited: false
    }));

    portfolio.sort((a, b) => b.originalWeight - a.originalWeight);

    let remainingWeight = 1.0;
    let unprocessedStocks = [...portfolio];

    while (unprocessedStocks.length > 0) {
      const totalOriginalWeight = unprocessedStocks.reduce(
        (sum, s) => sum + s.originalWeight, 0
      );

      let hasLimited = false;

      for (const stock of unprocessedStocks) {
        const proposedWeight = (stock.originalWeight / totalOriginalWeight) * remainingWeight;

        if (proposedWeight > maxWeight) {
          stock.adjustedWeight = maxWeight;
          stock.isLimited = true;
          remainingWeight -= maxWeight;
          hasLimited = true;
        }
      }

      unprocessedStocks = unprocessedStocks.filter(s => !s.isLimited);

      if (!hasLimited) {
        for (const stock of unprocessedStocks) {
          stock.adjustedWeight = (stock.originalWeight / totalOriginalWeight) * remainingWeight;
        }
        break;
      }
    }

    const totalAdjustedWeight = portfolio.reduce((sum, s) => sum + s.adjustedWeight, 0);
    portfolio.forEach(s => {
      s.adjustedWeight = s.adjustedWeight / totalAdjustedWeight;
    });

    portfolio.sort((a, b) => b.adjustedWeight - a.adjustedWeight);

    return portfolio;
  }

  /**
   * 计算调整后组合的收益率（使用前复权价格）
   */
  async calculatePortfolioReturns(portfolio, startDate, endDate) {
    const stockCodes = portfolio.map(p => p.symbol);
    
    console.log(`\n计算调整后组合收益: ${startDate} -> ${endDate}`);
    console.log(`股票数量: ${stockCodes.length}`);
    console.log(`使用前复权价格计算收益率`);

    const priceData = await tushareService.batchGetStockPrices(
      stockCodes,
      startDate,
      endDate
    );

    const stockReturns = [];
    let validWeightSum = 0;

    for (const stock of portfolio) {
      let prices = priceData[stock.symbol];
      
      if (!prices) {
        const tsCode = stock.symbol.includes('.') ? stock.symbol : 
                      (stock.symbol.startsWith('6') || stock.symbol.startsWith('5')) ? 
                      `${stock.symbol}.SH` : `${stock.symbol}.SZ`;
        prices = priceData[tsCode];
      }
      
      if (prices && prices.length >= 2) {
        const startPrice = prices[0].close;
        const endPrice = prices[prices.length - 1].close;
        const stockReturn = (endPrice - startPrice) / startPrice;
        
        // 计算期望的交易日数量（粗略估算：每月约20个交易日）
        const daysDiff = Math.abs(
          new Date(prices[prices.length - 1].trade_date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')) -
          new Date(prices[0].trade_date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'))
        ) / (1000 * 60 * 60 * 24);
        const expectedTradingDays = Math.floor(daysDiff / 7 * 5);  // 粗略估算
        const dataCompleteness = prices.length / Math.max(expectedTradingDays, 1);
        
        // 过滤条件：数据完整度低于50%或收益率异常高（可能是新股）
        if (dataCompleteness < 0.5 || Math.abs(stockReturn) > 3.0) {
          console.warn(`⚠️  ${stock.symbol} 数据异常，跳过该股票`);
          console.warn(`   收益率: ${(stockReturn * 100).toFixed(2)}%`);
          console.warn(`   数据点数: ${prices.length}/${expectedTradingDays} (完整度${(dataCompleteness*100).toFixed(1)}%)`);
          console.warn(`   起始: ${prices[0].trade_date}, 结束: ${prices[prices.length - 1].trade_date}`);
          continue;  // 跳过该股票
        }
        
        // 添加详细日志，检查异常收益率
        if (Math.abs(stockReturn) > 1.0) {  // 收益率超过100%
          console.warn(`⚠️  ${stock.symbol} 收益率较高: ${(stockReturn * 100).toFixed(2)}%`);
          console.warn(`   起始: ${prices[0].trade_date} 价格${startPrice.toFixed(2)}`);
          console.warn(`   结束: ${prices[prices.length - 1].trade_date} 价格${endPrice.toFixed(2)}`);
          console.warn(`   数据点数: ${prices.length}, 权重: ${(stock.adjustedWeight * 100).toFixed(2)}%`);
        }

        stockReturns.push({
          symbol: stock.symbol,
          weight: stock.adjustedWeight,
          return: stockReturn,
          startPrice,
          endPrice,
          isLimited: stock.isLimited
        });

        validWeightSum += stock.adjustedWeight;
      } else {
        console.warn(`股票 ${stock.symbol} 无有效价格数据`);
      }
    }

    if (stockReturns.length === 0) {
      console.warn('⚠️  没有获取到任何股票价格数据');
      return null;
    }

    stockReturns.forEach(s => {
      s.normalizedWeight = s.weight / validWeightSum;
    });

    const portfolioReturn = stockReturns.reduce(
      (sum, s) => sum + s.return * s.normalizedWeight,
      0
    );

    console.log(`✅ 成功计算 ${stockReturns.length}/${portfolio.length} 只股票`);
    console.log(`   有效权重总和: ${validWeightSum.toFixed(4)}`);
    console.log(`✅ 调整后组合收益率: ${(portfolioReturn * 100).toFixed(2)}%`);
    
    // 显示权重前5的股票
    const topStocks = stockReturns.sort((a, b) => b.normalizedWeight - a.normalizedWeight).slice(0, 5);
    console.log(`   权重前5股票:`);
    topStocks.forEach(s => {
      console.log(`     ${s.symbol}: 权重${(s.normalizedWeight*100).toFixed(2)}%, 收益${(s.return*100).toFixed(2)}%`);
    });
    
    // 如果组合收益率异常，显示贡献最大的股票
    if (Math.abs(portfolioReturn) > 0.5) {  // 超过50%
      console.warn(`⚠️  组合收益率异常，前5大贡献股票:`);
      const contributions = stockReturns.map(s => ({
        symbol: s.symbol,
        contribution: s.return * s.normalizedWeight,
        return: s.return,
        weight: s.normalizedWeight
      })).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
      
      contributions.slice(0, 5).forEach(c => {
        console.warn(`   ${c.symbol}: 收益${(c.return*100).toFixed(2)}% × 权重${(c.weight*100).toFixed(2)}% = 贡献${(c.contribution*100).toFixed(2)}%`);
      });
    }

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
   * 注意：使用单位净值计算区间收益率，而非累计净值
   * 累计净值包含历史分红，不能直接用于计算区间收益率
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

    // 检查是否有分红（累计净值增长但单位净值下降）
    const unitNavChange = (endNav.unit_nav - startNav.unit_nav) / startNav.unit_nav;
    const accumNavChange = (endNav.accum_nav - startNav.accum_nav) / startNav.accum_nav;
    
    // 如果单位净值和累计净值变化差异很大（>10%），说明有分红
    const hasDividend = Math.abs(unitNavChange - accumNavChange) > 0.1;
    
    let returnRate;
    if (hasDividend) {
      // 有分红时，使用累计净值计算（包含分红再投资）
      returnRate = accumNavChange;
      console.log(`基金净值: ${startNav.nav_date}(${startNav.unit_nav}/${startNav.accum_nav}) -> ${endNav.nav_date}(${endNav.unit_nav}/${endNav.accum_nav})`);
      console.log(`⚠️  检测到分红，使用累计净值计算: ${(returnRate * 100).toFixed(2)}% (单位净值: ${(unitNavChange * 100).toFixed(2)}%)`);
    } else {
      // 无分红时，使用单位净值计算
      returnRate = unitNavChange;
      console.log(`基金净值: ${startNav.nav_date}(${startNav.unit_nav}) -> ${endNav.nav_date}(${endNav.unit_nav}), 收益率: ${(returnRate * 100).toFixed(2)}%`);
    }
    
    return {
      startDate: startNav.nav_date,
      endDate: endNav.nav_date,
      startNav: startNav.unit_nav,
      endNav: endNav.unit_nav,
      accumStartNav: startNav.accum_nav,
      accumEndNav: endNav.accum_nav,
      return: returnRate,
      hasDividend: hasDividend
    };
  }

  /**
   * 计算风险指标
   */
  calculateRiskMetrics(returns, periods) {
    if (returns.length === 0) return null;
    
    // 计算年化收益率
    const totalReturn = returns.reduce((acc, r) => acc * (1 + r), 1) - 1;
    const years = periods / 4; // 假设每个报告期是一个季度
    const annualizedReturn = Math.pow(1 + totalReturn, 1 / years) - 1;
    
    // 计算波动率（标准差）
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance);
    const annualizedVolatility = volatility * Math.sqrt(4); // 年化波动率
    
    // 计算最大回撤
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
    
    // 计算夏普比率（假设无风险利率为3%）
    const riskFreeRate = 0.03;
    const excessReturn = annualizedReturn - riskFreeRate;
    const sharpeRatio = annualizedVolatility > 0 ? excessReturn / annualizedVolatility : 0;
    
    // 计算索提诺比率（只考虑下行波动）
    const downReturns = returns.filter(r => r < avgReturn);
    const downVariance = downReturns.length > 0 
      ? downReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
      : 0;
    const downVolatility = Math.sqrt(downVariance) * Math.sqrt(4);
    const sortinoRatio = downVolatility > 0 ? excessReturn / downVolatility : 0;
    
    return {
      totalReturn,
      annualizedReturn,
      volatility: annualizedVolatility,
      maxDrawdown,
      sharpeRatio,
      sortinoRatio
    };
  }

  /**
   * 计算所有报告期持仓的收益率（重构版：确保原策略和自定义策略公平对比）
   * @param {string} fundCode - 基金代码
   * @param {number} maxWeight - 单只股票最大权重
   * @param {Object} options - 配置选项
   * @param {Array} options.reportPeriods - 报告期列表，如['20250630']，空数组表示全部
   * @param {Object} options.scoreWeights - 得分权重配置
   * @param {boolean} options.useCompositeScore - 是否使用综合得分策略
   */
  async calculateAllPeriodReturns(fundCode, maxWeight, options = {}) {
    const {
      reportPeriods = [],  // 空数组表示使用全部报告期
      scoreWeights = {mvWeight: 0.5, dvWeight: 0.3, qualityWeight: 0.2},
      useCompositeScore = false,
      qualityFactorType = 'pe_pb'  // 质量因子类型
    } = options;
    const holdings = await tushareService.getFundHoldings(fundCode);
    
    console.log(`获取到 ${holdings.length} 条持仓记录`);
    
    if (holdings.length === 0) {
      console.warn('⚠️  未获取到任何持仓数据');
      return [];
    }
    
    const groupedHoldings = {};
    holdings.forEach(h => {
      if (!groupedHoldings[h.end_date]) {
        groupedHoldings[h.end_date] = [];
      }
      groupedHoldings[h.end_date].push(h);
    });

    // 筛选报告期
    const allReportDates = Object.keys(groupedHoldings).sort();
    let selectedReportDates;
    let isUserSelected = false;  // 标记是否是用户选择的报告期
    
    if (reportPeriods && reportPeriods.length > 0) {
      // 使用用户指定的报告期
      selectedReportDates = allReportDates.filter(date => reportPeriods.includes(date));
      isUserSelected = true;
      console.log(`所有报告期: ${allReportDates.join(', ')}`);
      console.log(`选择的报告期: ${selectedReportDates.join(', ')}`);
    } else {
      // 使用全部报告期
      selectedReportDates = allReportDates;
      isUserSelected = false;
      console.log(`使用全部 ${selectedReportDates.length} 个报告期: ${selectedReportDates.join(', ')}`);
    }
    
    // 找出真实的最后一个有效报告期（持仓数>10）
    let realLastReportDate = null;
    for (let i = allReportDates.length - 1; i >= 0; i--) {
      if (groupedHoldings[allReportDates[i]].length > 10) {
        realLastReportDate = allReportDates[i];
        break;
      }
    }
    console.log(`真实的最后一个有效报告期: ${realLastReportDate}`);
    
    const results = [];
    let lastValidPortfolio = null;  // 保存上一个有效报告期的持仓组合

    console.log('\n开始计算各报告期收益率\n');

    for (let i = 0; i < selectedReportDates.length; i++) {
      const reportDate = selectedReportDates[i];
      const reportHoldings = groupedHoldings[reportDate];
      
      // 检查是否只公布了前10大持仓
      let useLastPortfolio = false;
      if (reportHoldings.length <= 10) {
        if (lastValidPortfolio) {
          console.log(`\n报告期 ${reportDate}: 只公布前${reportHoldings.length}大持仓，使用上一期持仓计算收益率（不调仓）`);
          useLastPortfolio = true;
        } else {
          console.log(`\n报告期 ${reportDate}: 只公布前${reportHoldings.length}大持仓，且没有上一期持仓，跳过该报告期`);
          continue;
        }
      }

      // 根据报告期计算披露日期（一般是报告期后2个月）
      const year = reportDate.substring(0, 4);
      const month = reportDate.substring(4, 6);
      let disclosureDate;
      
      if (month === '03') {  // 一季报，4月底披露
        disclosureDate = `${year}0430`;
      } else if (month === '06') {  // 中报，8月底披露
        disclosureDate = `${year}0828`;
      } else if (month === '09') {  // 三季报，10月底披露
        disclosureDate = `${year}1031`;
      } else if (month === '12') {  // 年报，次年4月底披露
        const nextYear = parseInt(year) + 1;
        disclosureDate = `${nextYear}0430`;
      } else {
        disclosureDate = reportDate;
      }
      
      const startDate = disclosureDate;
      
      // 计算结束日期：区分用户选择的最后一期和真实的最后一期
      let endDate;
      let nextValidReportIndex = -1;
      const isCurrentRealLast = (reportDate === realLastReportDate);
      
      // 从所有报告期中查找下一个有效报告期（不限于用户选择的）
      const currentIndexInAll = allReportDates.indexOf(reportDate);
      
      for (let j = currentIndexInAll + 1; j < allReportDates.length; j++) {
        const nextReportDate = allReportDates[j];
        const nextReportHoldings = groupedHoldings[nextReportDate];
        
        // 找到下一个持仓数>10的报告期
        if (nextReportHoldings.length > 10) {
          // 计算下一个报告期的披露日
          const nextYear = nextReportDate.substring(0, 4);
          const nextMonth = nextReportDate.substring(4, 6);
          let nextDisclosureDate;
          
          if (nextMonth === '03') {
            nextDisclosureDate = `${nextYear}0430`;
          } else if (nextMonth === '06') {
            nextDisclosureDate = `${nextYear}0828`;
          } else if (nextMonth === '09') {
            nextDisclosureDate = `${nextYear}1031`;
          } else if (nextMonth === '12') {
            const nextNextYear = parseInt(nextYear) + 1;
            nextDisclosureDate = `${nextNextYear}0430`;
          }
          
          // 只有当下一个披露日晚于当前披露日时，才使用这个报告期
          if (nextDisclosureDate > startDate) {
            nextValidReportIndex = j;
            endDate = nextDisclosureDate;
            break;
          }
        }
      }
      
      // 判断是否计算到今天
      if (nextValidReportIndex === -1) {
        // 没有找到下一个有效报告期
        if (isCurrentRealLast) {
          // 当前是真实的最后一期，计算到今天
          const today = new Date();
          endDate = today.toISOString().slice(0, 10).replace(/-/g, '');
          console.log(`当前报告期 ${reportDate} 是真实的最后一期，计算到今天: ${endDate}`);
        } else {
          // 当前不是真实的最后一期，但找不到下一期（理论上不应该发生）
          console.warn(`⚠️  报告期 ${reportDate} 不是最后一期，但找不到下一个有效报告期，跳过`);
          continue;
        }
      } else {
        console.log(`报告期 ${reportDate} 计算到下一个有效报告期 ${allReportDates[nextValidReportIndex]} 的披露日: ${endDate}`);
      }

      console.log(`\n报告期: ${reportDate}`);
      console.log(`计算时间段: ${startDate} -> ${endDate}`);

      try {
        let replicatedPortfolio;
        
        // 如果使用上一期持仓，直接使用，不重新计算
        if (useLastPortfolio) {
          console.log(`📋 使用上一期持仓组合（${lastValidPortfolio.length}只股票），不调仓`);
          replicatedPortfolio = lastValidPortfolio;
        } else {
          // 正常流程：获取持仓并计算权重
          // 获取股票代码列表
          const stockCodes = reportHoldings.map(h => h.symbol);
          
          // 获取股票名称和市值
          const stockInfo = await tushareService.batchGetStockBasic(stockCodes, startDate);
          
          console.log(`获取到 ${Object.keys(stockInfo).length} 只股票的基本信息`);
          
          // 计算原始权重（基金持仓市值）
          const totalOriginalMkv = reportHoldings.reduce((sum, h) => sum + (h.mkv || 0), 0);
          
          // 构建股票数据
          let totalMarketValue = 0;
          const portfolioWithMv = reportHoldings.map(h => {
          const tsCode = h.symbol.includes('.') ? h.symbol : 
                        (h.symbol.startsWith('6') || h.symbol.startsWith('5')) ? 
                        `${h.symbol}.SH` : `${h.symbol}.SZ`;
          const info = stockInfo[tsCode] || {};
          const mv = info.totalMv || 0;
          totalMarketValue += mv;
          return {
            symbol: h.symbol,
            name: info.name || h.symbol,
            originalMkv: h.mkv || 0,
            marketValue: mv,
            dvRatio: info.dvRatio || 0,
            qualityFactor: info.qualityFactor || 0,
            peScore: info.peScore || 0,
            pbScore: info.pbScore || 0,
            roe: info.roe || 0,
            peTtm: info.peTtm || 0,
            pb: info.pb || 0,
            originalWeight: (h.mkv || 0) / totalOriginalMkv,
            adjustedWeight: 0,
            isLimited: false
          };
        });
        
        console.log(`总市值: ${(totalMarketValue / 10000).toFixed(2)} 亿元`);
        
        // 只保留有市值数据的股票
        const validPortfolio = portfolioWithMv.filter(p => p.marketValue > 0);
        
        // 记录被过滤的股票
        const filteredStocks = portfolioWithMv.filter(p => p.marketValue === 0);
        if (filteredStocks.length > 0) {
          console.log(`⚠️  ${filteredStocks.length} 只股票因无市值数据被过滤（通常是新股，上市时间晚于报告期）`);
          console.log(`   被过滤股票: ${filteredStocks.map(s => s.symbol).slice(0, 10).join(', ')}${filteredStocks.length > 10 ? '...' : ''}`);
        }
        
        // 根据策略分配权重
        let portfolioWithWeights;
        let applyWeightLimit = false;  // 是否应用权重上限
        
        if (useCompositeScore) {
          console.log(`使用综合得分策略 - 市值权重:${scoreWeights.mvWeight}, 股息率权重:${scoreWeights.dvWeight}, 质量因子权重:${scoreWeights.qualityWeight}, 质量因子类型:${qualityFactorType}`);
          console.log(`综合得分策略不应用10%权重上限`);
          portfolioWithWeights = this.calculateCompositeScore(validPortfolio, scoreWeights, qualityFactorType);
          applyWeightLimit = false;  // 综合得分策略不应用权重上限
        } else {
          console.log(`使用市值加权策略`);
          const validTotalMv = validPortfolio.reduce((sum, p) => sum + p.marketValue, 0);
          portfolioWithWeights = validPortfolio.map(p => ({
            ...p,
            adjustedWeight: p.marketValue / validTotalMv,
            isLimited: false
          })).sort((a, b) => b.adjustedWeight - a.adjustedWeight);
          applyWeightLimit = true;  // 市值加权策略应用权重上限
        }
        
        // 仅在市值加权策略下应用10%权重上限限制
        const maxWeight = this.maxWeight;
        let needsAdjustment = applyWeightLimit;  // 只有需要应用权重限制时才进入循环
        let iterationCount = 0;
        const maxIterations = 100; // 防止无限循环
        
        if (applyWeightLimit) {
          console.log(`开始应用10%权重上限限制...`);
          console.log(`初始权重前5名:`);
          portfolioWithWeights.slice(0, 5).forEach(s => {
            console.log(`  ${s.symbol} ${s.name}: ${(s.adjustedWeight * 100).toFixed(2)}%`);
          });
        }
        
        while (needsAdjustment && iterationCount < maxIterations && applyWeightLimit) {
          needsAdjustment = false;
          let excessWeight = 0;
          let unrestrictedCount = 0;
          iterationCount++;
          
          // 找出超过限制的股票
          portfolioWithWeights.forEach(stock => {
            if (!stock.isLimited && stock.adjustedWeight > maxWeight) {
              const excess = stock.adjustedWeight - maxWeight;
              excessWeight += excess;
              stock.adjustedWeight = maxWeight;
              stock.isLimited = true;
              needsAdjustment = true;
              console.log(`  限制 ${stock.symbol} ${stock.name}: ${((maxWeight + excess) * 100).toFixed(2)}% -> ${(maxWeight * 100).toFixed(2)}%`);
            } else if (!stock.isLimited) {
              unrestrictedCount++;
            }
          });
          
          // 将超出的权重重新分配给未受限的股票
          if (excessWeight > 0 && unrestrictedCount > 0) {
            if (useCompositeScore) {
              // 综合得分策略：按综合得分比例分配
              const unrestrictedTotalScore = portfolioWithWeights
                .filter(s => !s.isLimited)
                .reduce((sum, s) => sum + (s.compositeScore || 0), 0);
              
              portfolioWithWeights.forEach(stock => {
                if (!stock.isLimited && unrestrictedTotalScore > 0) {
                  const scoreRatio = (stock.compositeScore || 0) / unrestrictedTotalScore;
                  stock.adjustedWeight += excessWeight * scoreRatio;
                }
              });
              console.log(`  重新分配 ${(excessWeight * 100).toFixed(2)}% 给 ${unrestrictedCount} 只未受限股票（按综合得分比例）`);
            } else {
              // 市值加权策略：按市值比例分配
              const unrestrictedTotalMv = portfolioWithWeights
                .filter(s => !s.isLimited)
                .reduce((sum, s) => sum + s.marketValue, 0);
              
              portfolioWithWeights.forEach(stock => {
                if (!stock.isLimited) {
                  const mvRatio = stock.marketValue / unrestrictedTotalMv;
                  stock.adjustedWeight += excessWeight * mvRatio;
                }
              });
              console.log(`  重新分配 ${(excessWeight * 100).toFixed(2)}% 给 ${unrestrictedCount} 只未受限股票（按市值比例）`);
            }
          }
          }
          
          replicatedPortfolio = portfolioWithWeights.sort((a, b) => b.adjustedWeight - a.adjustedWeight);
          const limitedCount = replicatedPortfolio.filter(s => s.isLimited).length;
          
          console.log(`有效持仓数: ${replicatedPortfolio.length}/${reportHoldings.length}`);
          console.log(`受限股票数: ${limitedCount} (权重>10%)`);
          console.log(`权重调整迭代次数: ${iterationCount}`);
          
          // 保存当前持仓组合，供下一期使用
          lastValidPortfolio = replicatedPortfolio;
        }

        // 计算自定义策略收益率（使用调整后的权重）
        const customStrategyReturns = await this.calculatePortfolioReturns(
          replicatedPortfolio,
          startDate,
          endDate
        );

        // 计算原策略收益率（使用基金原始权重，相同的股票池和价格数据）
        // 注意：由于有些股票被过滤（无市值数据），需要重新归一化原始权重
        const totalOriginalWeight = replicatedPortfolio.reduce((sum, p) => sum + p.originalWeight, 0);
        const originalPortfolio = replicatedPortfolio.map(p => ({
          ...p,
          adjustedWeight: totalOriginalWeight > 0 ? p.originalWeight / totalOriginalWeight : 0  // 归一化原始权重
        }));
        
        console.log(`原策略权重归一化: 总权重 ${(totalOriginalWeight * 100).toFixed(2)}% → 100%`);
        console.log(`原策略前5只股票权重:`);
        originalPortfolio.slice(0, 5).forEach(p => {
          console.log(`  ${p.symbol}: 原始权重${(p.originalWeight*100).toFixed(2)}%, 归一化后${(p.adjustedWeight*100).toFixed(2)}%`);
        });
        
        const originalStrategyReturns = await this.calculatePortfolioReturns(
          originalPortfolio,
          startDate,
          endDate
        );

        // 同时获取基金净值作为参考
        const fundNavReturn = await this.calculateReturnsFromNav(fundCode, startDate, endDate);

        if (customStrategyReturns && originalStrategyReturns) {
          results.push({
            reportDate,
            startDate: customStrategyReturns.startDate || startDate,
            endDate: customStrategyReturns.endDate || endDate,
            // 自定义策略
            customReturn: customStrategyReturns.portfolioReturn,
            customStockCount: customStrategyReturns.stockCount,
            // 原策略（使用相同股票和价格，只是权重不同）
            originalReturn: originalStrategyReturns.portfolioReturn,
            originalStockCount: originalStrategyReturns.stockCount,
            // 基金净值（仅作参考）
            fundReturn: fundNavReturn?.return || 0,
            fundStartNav: fundNavReturn?.startNav || 0,
            fundEndNav: fundNavReturn?.endNav || 0,
            // 统计信息
            stockCount: replicatedPortfolio.length,
            totalStocks: reportHoldings.length,
            limitedStocks: 0,
            excessReturn: customStrategyReturns.portfolioReturn - originalStrategyReturns.portfolioReturn,
            adjustedHoldings: replicatedPortfolio.map(p => ({
              symbol: p.symbol,
              name: p.name,
              originalWeight: p.originalWeight,
              adjustedWeight: p.adjustedWeight,
              marketValue: p.marketValue,
              dvRatio: p.dvRatio,
              qualityFactor: p.qualityFactor,
              peTtm: p.peTtm,
              pb: p.pb,
              compositeScore: p.compositeScore,
              mvRank: p.mvRank,
              dvRank: p.dvRank,
              qualityRank: p.qualityRank,
              isLimited: p.isLimited,
              mkv: p.originalMkv
            })),
            topHoldings: replicatedPortfolio.slice(0, 10).map(p => ({
              symbol: p.symbol,
              originalWeight: p.originalWeight,
              adjustedWeight: p.adjustedWeight,
              isLimited: p.isLimited
            }))
          });

          console.log(`✅ 原策略收益: ${(originalStrategyReturns.portfolioReturn * 100).toFixed(2)}% (使用原始权重)`);
          console.log(`✅ 自定义策略收益: ${(customStrategyReturns.portfolioReturn * 100).toFixed(2)}% (使用调整后权重)`);
          console.log(`✅ 超额收益: ${((customStrategyReturns.portfolioReturn - originalStrategyReturns.portfolioReturn) * 100).toFixed(2)}%`);
          console.log(`✅ 基金净值收益: ${(fundNavReturn?.return * 100 || 0).toFixed(2)}% (仅作参考)`);
          console.log(`✅ 持仓: ${replicatedPortfolio.length}只`);
        } else {
          console.log(`⚠️  无法计算该期收益率`);
        }
      } catch (error) {
        console.error(`❌ 计算报告期 ${reportDate} 失败:`, error.message);
      }
    }

    // 计算累计收益率和风险指标
    let customCumulative = 1;
    let originalCumulative = 1;
    let fundCumulative = 1;
    
    const customReturns = [];
    const originalReturns = [];
    const fundReturns = [];
    
    results.forEach((r, index) => {
      customCumulative *= (1 + r.customReturn);
      originalCumulative *= (1 + r.originalReturn);
      fundCumulative *= (1 + r.fundReturn);
      
      r.customCumulativeReturn = customCumulative - 1;
      r.originalCumulativeReturn = originalCumulative - 1;
      r.fundCumulativeReturn = fundCumulative - 1;
      r.excessCumulativeReturn = r.customCumulativeReturn - r.originalCumulativeReturn;
      
      customReturns.push(r.customReturn);
      originalReturns.push(r.originalReturn);
      fundReturns.push(r.fundReturn);
      
      console.log(`累计到${r.reportDate}: 自定义${(r.customCumulativeReturn * 100).toFixed(2)}%, 原策略${(r.originalCumulativeReturn * 100).toFixed(2)}%, 超额${(r.excessCumulativeReturn * 100).toFixed(2)}%`);
    });

    // 计算风险指标
    const customRisk = this.calculateRiskMetrics(customReturns, results.length);
    const originalRisk = this.calculateRiskMetrics(originalReturns, results.length);
    const fundRisk = this.calculateRiskMetrics(fundReturns, results.length);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`有效报告期数: ${results.length}`);
    console.log(`已跳过只公布前10大持仓的报告期`);
    
    if (results.length > 0) {
      const lastPeriod = results[results.length - 1];
      console.log(`\n【累计收益率】`);
      console.log(`自定义策略: ${(lastPeriod.customCumulativeReturn * 100).toFixed(2)}%`);
      console.log(`原策略: ${(lastPeriod.originalCumulativeReturn * 100).toFixed(2)}%`);
      console.log(`累计超额收益: ${(lastPeriod.excessCumulativeReturn * 100).toFixed(2)}%`);
      console.log(`基金净值: ${(lastPeriod.fundCumulativeReturn * 100).toFixed(2)}% (仅作参考)`);
      
      if (customRisk) {
        console.log(`\n【自定义策略风险指标】`);
        console.log(`年化收益率: ${(customRisk.annualizedReturn * 100).toFixed(2)}%`);
        console.log(`年化波动率: ${(customRisk.volatility * 100).toFixed(2)}%`);
        console.log(`最大回撤: ${(customRisk.maxDrawdown * 100).toFixed(2)}%`);
        console.log(`夏普比率: ${customRisk.sharpeRatio.toFixed(2)}`);
        console.log(`索提诺比率: ${customRisk.sortinoRatio.toFixed(2)}`);
      }
      
      if (originalRisk) {
        console.log(`\n【原策略风险指标】`);
        console.log(`年化收益率: ${(originalRisk.annualizedReturn * 100).toFixed(2)}%`);
        console.log(`年化波动率: ${(originalRisk.volatility * 100).toFixed(2)}%`);
        console.log(`最大回撤: ${(originalRisk.maxDrawdown * 100).toFixed(2)}%`);
        console.log(`夏普比率: ${originalRisk.sharpeRatio.toFixed(2)}`);
        console.log(`索提诺比率: ${originalRisk.sortinoRatio.toFixed(2)}`);
      }
    }
    console.log(`${'='.repeat(60)}\n`);

    return {
      periods: results,
      customRisk,
      originalRisk,
      fundRisk
    };
  }
}

module.exports = new PortfolioService();
