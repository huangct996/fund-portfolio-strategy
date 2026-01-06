/**
 * 股票池筛选服务
 * 用于在风险平价策略中筛选优质股票
 */

const tushareService = require('./tushareService');

class StockFilterService {
  /**
   * 筛选股票池
   * @param {Array} stocks - 原始股票列表
   * @param {Object} filterParams - 筛选参数
   * @param {string} rebalanceDate - 调仓日期
   * @returns {Array} 筛选后的股票列表
   */
  async filterStocks(stocks, filterParams, rebalanceDate) {
    if (!filterParams || stocks.length === 0) {
      return { filteredStocks: stocks, removedStocks: [] };
    }

    console.log(`\n🔍 股票池筛选 - 调仓日期: ${rebalanceDate}`);
    console.log(`   原始股票数: ${stocks.length}`);
    console.log(`   筛选条件:`, filterParams);

    let filteredStocks = [...stocks];
    const removedStocks = [];
    const filterReasons = new Map(); // 记录每只股票被筛选的原因

    // 1. ROE筛选（暂时跳过，数据库中没有ROE数据）
    if (filterParams.minROE > 0) {
      const beforeCount = filteredStocks.length;
      const withROE = filteredStocks.filter(stock => stock.roe && stock.roe > 0);
      if (withROE.length > 0) {
        const removed = filteredStocks.filter(stock => {
          const roe = stock.roe || 0;
          return roe < filterParams.minROE;
        });
        removed.forEach(stock => {
          filterReasons.set(stock.con_code, `ROE过低(${((stock.roe || 0) * 100).toFixed(1)}%)`);
        });
        filteredStocks = filteredStocks.filter(stock => {
          const roe = stock.roe || 0;
          return roe >= filterParams.minROE;
        });
        console.log(`   ✓ ROE >= ${(filterParams.minROE * 100).toFixed(1)}%: ${beforeCount} → ${filteredStocks.length}`);
      } else {
        console.log(`   ⚠️  跳过ROE筛选（数据库中无ROE数据）`);
      }
    }

    // 2. 负债率筛选（暂时跳过，数据库中没有负债率数据）
    if (filterParams.maxDebtRatio < 1) {
      const beforeCount = filteredStocks.length;
      const withDebt = filteredStocks.filter(stock => stock.debtRatio && stock.debtRatio > 0);
      if (withDebt.length > 0) {
        const removed = filteredStocks.filter(stock => {
          const debtRatio = stock.debtRatio || 0;
          return debtRatio > filterParams.maxDebtRatio;
        });
        removed.forEach(stock => {
          filterReasons.set(stock.con_code, `负债率过高(${((stock.debtRatio || 0) * 100).toFixed(0)}%)`);
        });
        filteredStocks = filteredStocks.filter(stock => {
          const debtRatio = stock.debtRatio || 0;
          return debtRatio <= filterParams.maxDebtRatio;
        });
        console.log(`   ✓ 负债率 <= ${(filterParams.maxDebtRatio * 100).toFixed(0)}%: ${beforeCount} → ${filteredStocks.length}`);
      } else {
        console.log(`   ⚠️  跳过负债率筛选（数据库中无负债率数据）`);
      }
    }

    // 3. 动量筛选（基于历史价格）
    if (filterParams.momentumMonths > 0 && filterParams.minMomentumReturn !== undefined) {
      const beforeCount = filteredStocks.length;
      const result = await this.filterByMomentum(
        filteredStocks, 
        rebalanceDate, 
        filterParams.momentumMonths, 
        filterParams.minMomentumReturn
      );
      result.removed.forEach(stock => {
        filterReasons.set(stock.con_code, `动量过低(${(stock.momentumReturn * 100).toFixed(1)}%)`);
      });
      filteredStocks = result.filtered;
      console.log(`   ✓ ${filterParams.momentumMonths}月动量 >= ${(filterParams.minMomentumReturn * 100).toFixed(0)}%: ${beforeCount} → ${filteredStocks.length}`);
    }

    // 4. 质量得分筛选（基于PE、PB、股息率）
    if (filterParams.filterByQuality) {
      const beforeCount = filteredStocks.length;
      const result = this.filterByQualityScore(filteredStocks);
      result.removed.forEach(stock => {
        filterReasons.set(stock.con_code, `质量得分过低(${stock.qualityScore?.toFixed(2) || 'N/A'})`);
      });
      filteredStocks = result.filtered;
      console.log(`   ✓ 质量得分 >= 中位数: ${beforeCount} → ${filteredStocks.length}`);
    }

    // 5. 最小持仓股票数检查（防止持仓过度集中）
    const MIN_HOLDINGS = 10;
    if (filteredStocks.length < MIN_HOLDINGS && filteredStocks.length < stocks.length) {
      console.log(`   ⚠️  筛选后股票数过少（${filteredStocks.length}只），放宽筛选条件以保证至少${MIN_HOLDINGS}只股票`);
      
      // 如果启用了质量筛选，先尝试关闭质量筛选
      if (filterParams.filterByQuality && filteredStocks.length < MIN_HOLDINGS) {
        console.log(`   → 尝试关闭质量筛选...`);
        // 重新筛选，但不使用质量筛选
        let relaxedStocks = stocks;
        
        // 重新应用ROE筛选
        if (filterParams.minROE > 0) {
          relaxedStocks = relaxedStocks.filter(stock => {
            const roe = stock.roe || 0;
            return roe >= filterParams.minROE;
          });
        }
        
        // 重新应用动量筛选
        if (filterParams.momentumMonths > 0 && filterParams.minMomentumReturn !== undefined) {
          const momentumResult = await this.filterByMomentum(
            relaxedStocks, 
            rebalanceDate, 
            filterParams.momentumMonths, 
            filterParams.minMomentumReturn
          );
          relaxedStocks = momentumResult.filtered;
        }
        
        if (relaxedStocks.length >= MIN_HOLDINGS) {
          filteredStocks = relaxedStocks;
          console.log(`   ✓ 关闭质量筛选后: ${filteredStocks.length}只股票`);
        }
      }
      
      // 如果还是不够，使用原始股票池
      if (filteredStocks.length < MIN_HOLDINGS) {
        console.log(`   → 筛选条件过于严格，使用原始股票池（${stocks.length}只）`);
        filteredStocks = stocks;
        removedStocks = [];
        filterReasons.clear();
      }
    }
    
    // 收集所有被筛选掉的股票
    const filteredCodes = new Set(filteredStocks.map(s => s.con_code));
    stocks.forEach(stock => {
      if (!filteredCodes.has(stock.con_code)) {
        removedStocks.push({
          ...stock,
          filterReason: filterReasons.get(stock.con_code) || '未通过筛选'
        });
      }
    });

    console.log(`   📊 最终筛选结果: ${stocks.length} → ${filteredStocks.length} (保留${(filteredStocks.length / stocks.length * 100).toFixed(1)}%)`);
    if (removedStocks.length > 0) {
      console.log(`   ❌ 筛选掉 ${removedStocks.length} 只股票`);
    }
    console.log('');

    return { filteredStocks, removedStocks };
  }

  /**
   * 按动量筛选股票
   */
  async filterByMomentum(stocks, rebalanceDate, months, minReturn) {
    // 计算起始日期（往前推N个月）
    const endDate = rebalanceDate;
    const startDate = this.getDateMonthsAgo(rebalanceDate, months);

    // 批量获取股票价格数据（使用con_code字段）
    const stockCodes = stocks.map(s => s.con_code);
    const pricesData = await tushareService.batchGetStockPrices(stockCodes, startDate, endDate);

    // 计算每只股票的动量收益率
    const stocksWithMomentum = [];
    const removed = [];
    for (const stock of stocks) {
      const prices = pricesData[stock.con_code];
      if (!prices || prices.length < 2) {
        // 无数据的股票标记为极低动量
        stocksWithMomentum.push({ ...stock, momentumReturn: -999 });
        continue;
      }

      // 计算收益率：(最后价格 - 第一价格) / 第一价格
      const firstPrice = prices[0].close;
      const lastPrice = prices[prices.length - 1].close;
      const momentumReturn = (lastPrice - firstPrice) / firstPrice;

      stocksWithMomentum.push({ ...stock, momentumReturn });
    }

    // 筛选动量收益率 >= minReturn 的股票
    stocksWithMomentum.forEach(stock => {
      if (stock.momentumReturn >= minReturn) {
        // 通过筛选
      } else {
        removed.push(stock);
      }
    });
    const filtered = stocksWithMomentum.filter(stock => stock.momentumReturn >= minReturn);
    
    // 输出动量最差的5只股票（用于调试）
    const worstMomentum = stocksWithMomentum
      .sort((a, b) => a.momentumReturn - b.momentumReturn)
      .slice(0, 5);
    console.log(`   ⚠️  动量最差的5只股票:`);
    worstMomentum.forEach(stock => {
      console.log(`      ${stock.name || stock.con_code}: ${(stock.momentumReturn * 100).toFixed(2)}%`);
    });

    return { filtered, removed };
  }

  /**
   * 按质量得分筛选股票（剔除低于中位数的股票）
   */
  filterByQualityScore(stocks) {
    const removed = [];
    // 计算每只股票的质量得分
    const stocksWithScore = stocks.map(stock => {
      let qualityScore = 0;
      let scoreCount = 0;

      // ROE得分（越高越好）
      if (stock.roe !== undefined && stock.roe !== null) {
        qualityScore += stock.roe;
        scoreCount++;
      }

      // PE得分（越低越好，取倒数）
      if (stock.peTtm && stock.peTtm > 0) {
        qualityScore += 1 / stock.peTtm * 10; // 乘以10使其与ROE量级相当
        scoreCount++;
      }

      // PB得分（越低越好，取倒数）
      if (stock.pb && stock.pb > 0) {
        qualityScore += 1 / stock.pb * 5; // 乘以5使其与ROE量级相当
        scoreCount++;
      }

      // 股息率得分（越高越好）
      if (stock.dvYield !== undefined && stock.dvYield !== null) {
        qualityScore += stock.dvYield * 100; // 转换为百分比
        scoreCount++;
      }

      // 平均得分
      const avgScore = scoreCount > 0 ? qualityScore / scoreCount : 0;

      return { ...stock, qualityScore: avgScore };
    });

    // 计算中位数
    const scores = stocksWithScore.map(s => s.qualityScore).sort((a, b) => a - b);
    const medianScore = scores[Math.floor(scores.length / 2)];

    // 筛选质量得分 >= 中位数的股票
    stocksWithScore.forEach(stock => {
      if (stock.qualityScore < medianScore) {
        removed.push(stock);
      }
    });
    const filtered = stocksWithScore.filter(stock => stock.qualityScore >= medianScore);
    return { filtered, removed };
  }

  /**
   * 获取N个月前的日期
   */
  getDateMonthsAgo(dateStr, months) {
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6));
    const day = parseInt(dateStr.substring(6, 8));

    const date = new Date(year, month - 1, day);
    date.setMonth(date.getMonth() - months);

    const newYear = date.getFullYear();
    const newMonth = String(date.getMonth() + 1).padStart(2, '0');
    const newDay = String(date.getDate()).padStart(2, '0');

    return `${newYear}${newMonth}${newDay}`;
  }
}

module.exports = new StockFilterService();
