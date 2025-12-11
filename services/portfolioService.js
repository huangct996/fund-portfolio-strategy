const tushareService = require('./tushareService');

class PortfolioService {
  constructor(maxWeight = 0.10) {
    this.maxWeight = maxWeight;
  }

  /**
   * 计算综合得分并分配权重
   * @param {Array} stocks - 股票列表，包含市值、股息率、质量因子
   * @param {Object} weights - 权重配置 {mvWeight, dvWeight, qualityWeight}
   * @returns {Array} 带有综合得分和权重的股票列表
   */
  calculateCompositeScore(stocks, weights = {mvWeight: 0.5, dvWeight: 0.3, qualityWeight: 0.2}) {
    const {mvWeight, dvWeight, qualityWeight} = weights;
    
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
   * 计算调整后组合的收益率
   */
  async calculatePortfolioReturns(portfolio, startDate, endDate) {
    const stockCodes = portfolio.map(p => p.symbol);
    
    console.log(`\n计算调整后组合收益: ${startDate} -> ${endDate}`);
    console.log(`股票数量: ${stockCodes.length}`);

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
    console.log(`✅ 调整后组合收益率: ${(portfolioReturn * 100).toFixed(2)}%`);

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

    const returnRate = (endNav.accum_nav - startNav.accum_nav) / startNav.accum_nav;
    
    return {
      startDate: startNav.nav_date,
      endDate: endNav.nav_date,
      startNav: startNav.accum_nav,
      endNav: endNav.accum_nav,
      return: returnRate
    };
  }

  /**
   * 计算所有报告期持仓的收益率（支持综合得分策略）
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
      useCompositeScore = false
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
    
    if (reportPeriods && reportPeriods.length > 0) {
      // 使用用户指定的报告期
      selectedReportDates = allReportDates.filter(date => reportPeriods.includes(date));
      console.log(`所有报告期: ${allReportDates.join(', ')}`);
      console.log(`选择的报告期: ${selectedReportDates.join(', ')}`);
    } else {
      // 使用全部报告期
      selectedReportDates = allReportDates;
      console.log(`使用全部 ${selectedReportDates.length} 个报告期: ${selectedReportDates.join(', ')}`);
    }
    
    const results = [];

    console.log('\n开始计算各报告期收益率\n');

    for (let i = 0; i < selectedReportDates.length; i++) {
      const reportDate = selectedReportDates[i];
      const reportHoldings = groupedHoldings[reportDate];

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
      const today = new Date();
      const endDate = today.toISOString().slice(0, 10).replace(/-/g, '');

      console.log(`\n报告期: ${reportDate}`);
      console.log(`计算时间段: ${startDate} -> ${endDate}`);

      try {
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
        
        // 根据策略分配权重
        let portfolioWithWeights;
        if (useCompositeScore) {
          console.log(`使用综合得分策略 - 市值权重:${scoreWeights.mvWeight}, 股息率权重:${scoreWeights.dvWeight}, 质量因子权重:${scoreWeights.qualityWeight}`);
          portfolioWithWeights = this.calculateCompositeScore(validPortfolio, scoreWeights);
        } else {
          console.log(`使用市值加权策略`);
          const validTotalMv = validPortfolio.reduce((sum, p) => sum + p.marketValue, 0);
          portfolioWithWeights = validPortfolio.map(p => ({
            ...p,
            adjustedWeight: p.marketValue / validTotalMv,
            isLimited: false
          })).sort((a, b) => b.adjustedWeight - a.adjustedWeight);
        }
        
        // 应用10%权重上限限制
        const maxWeight = this.maxWeight;
        let needsAdjustment = true;
        let iterationCount = 0;
        const maxIterations = 100; // 防止无限循环
        
        console.log(`开始应用10%权重上限限制...`);
        console.log(`初始权重前5名:`);
        portfolioWithWeights.slice(0, 5).forEach(s => {
          console.log(`  ${s.symbol} ${s.name}: ${(s.adjustedWeight * 100).toFixed(2)}%`);
        });
        
        while (needsAdjustment && iterationCount < maxIterations) {
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
          
          // 将超出的权重按市值比例重新分配给未受限的股票
          if (excessWeight > 0 && unrestrictedCount > 0) {
            // 计算未受限股票的总市值
            const unrestrictedTotalMv = portfolioWithWeights
              .filter(s => !s.isLimited)
              .reduce((sum, s) => sum + s.marketValue, 0);
            
            // 按市值比例分配超额权重
            portfolioWithWeights.forEach(stock => {
              if (!stock.isLimited) {
                const mvRatio = stock.marketValue / unrestrictedTotalMv;
                stock.adjustedWeight += excessWeight * mvRatio;
              }
            });
            console.log(`  重新分配 ${(excessWeight * 100).toFixed(2)}% 给 ${unrestrictedCount} 只未受限股票（按市值比例）`);
          }
        }
        
        const replicatedPortfolio = portfolioWithWeights.sort((a, b) => b.adjustedWeight - a.adjustedWeight);
        const limitedCount = replicatedPortfolio.filter(s => s.isLimited).length;
        
        console.log(`有效持仓数: ${replicatedPortfolio.length}/${reportHoldings.length}`);
        console.log(`受限股票数: ${limitedCount} (权重>10%)`);
        console.log(`权重调整迭代次数: ${iterationCount}`);

        const replicatedReturns = await this.calculatePortfolioReturns(
          replicatedPortfolio,
          startDate,
          endDate
        );

        const fundNavReturn = await this.calculateReturnsFromNav(fundCode, startDate, endDate);

        if (replicatedReturns && fundNavReturn) {
          results.push({
            reportDate,
            startDate: fundNavReturn.startDate,
            endDate: fundNavReturn.endDate,
            adjustedReturn: replicatedReturns.portfolioReturn,
            adjustedStockCount: replicatedReturns.stockCount,
            fundReturn: fundNavReturn.return,
            fundStartNav: fundNavReturn.startNav,
            fundEndNav: fundNavReturn.endNav,
            stockCount: replicatedPortfolio.length,
            totalStocks: reportHoldings.length,
            limitedStocks: 0,
            excessReturn: replicatedReturns.portfolioReturn - fundNavReturn.return,
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

          console.log(`✅ 原基金收益: ${(fundNavReturn.return * 100).toFixed(2)}%`);
          console.log(`✅ 复制组合收益: ${(replicatedReturns.portfolioReturn * 100).toFixed(2)}%`);
          console.log(`✅ 超额收益: ${((replicatedReturns.portfolioReturn - fundNavReturn.return) * 100).toFixed(2)}%`);
          console.log(`✅ 持仓: ${replicatedPortfolio.length}只 (完全复制)`);
        } else {
          console.log(`⚠️  无法计算该期收益率`);
        }
      } catch (error) {
        console.error(`❌ 计算报告期 ${reportDate} 失败:`, error.message);
      }
    }

    const filteredResults = results.filter(r => r.totalStocks > 10);

    let adjustedCumulative = 1;
    let fundCumulative = 1;
    
    filteredResults.forEach(r => {
      adjustedCumulative *= (1 + r.adjustedReturn);
      fundCumulative *= (1 + r.fundReturn);
      
      r.adjustedCumulativeReturn = adjustedCumulative - 1;
      r.fundCumulativeReturn = fundCumulative - 1;
      r.excessCumulativeReturn = r.adjustedCumulativeReturn - r.fundCumulativeReturn;
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`总报告期数: ${results.length} (过滤后: ${filteredResults.length})`);
    console.log(`已过滤掉 ${results.length - filteredResults.length} 个只显示前10大持仓的报告期`);
    if (filteredResults.length > 0) {
      const lastPeriod = filteredResults[filteredResults.length - 1];
      console.log(`\n调整后组合累计收益: ${(lastPeriod.adjustedCumulativeReturn * 100).toFixed(2)}%`);
      console.log(`原基金累计收益: ${(lastPeriod.fundCumulativeReturn * 100).toFixed(2)}%`);
      console.log(`累计超额收益: ${(lastPeriod.excessCumulativeReturn * 100).toFixed(2)}%`);
    }
    console.log(`${'='.repeat(60)}\n`);

    return filteredResults;
  }
}

module.exports = new PortfolioService();
