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
      return stocks;
    }

    console.log(`\n🔍 股票池筛选 - 调仓日期: ${rebalanceDate}`);
    console.log(`   原始股票数: ${stocks.length}`);
    console.log(`   筛选条件:`, filterParams);

    let filteredStocks = [...stocks];

    // 1. ROE筛选（暂时跳过，数据库中没有ROE数据）
    if (filterParams.minROE > 0) {
      const beforeCount = filteredStocks.length;
      const withROE = filteredStocks.filter(stock => stock.roe && stock.roe > 0);
      if (withROE.length > 0) {
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
      filteredStocks = await this.filterByMomentum(
        filteredStocks, 
        rebalanceDate, 
        filterParams.momentumMonths, 
        filterParams.minMomentumReturn
      );
      console.log(`   ✓ ${filterParams.momentumMonths}月动量 >= ${(filterParams.minMomentumReturn * 100).toFixed(0)}%: ${beforeCount} → ${filteredStocks.length}`);
    }

    // 4. 质量得分筛选（基于PE、PB、股息率）
    if (filterParams.filterByQuality) {
      const beforeCount = filteredStocks.length;
      filteredStocks = this.filterByQualityScore(filteredStocks);
      console.log(`   ✓ 质量得分 >= 中位数: ${beforeCount} → ${filteredStocks.length}`);
    }

    console.log(`   📊 最终筛选结果: ${stocks.length} → ${filteredStocks.length} (保留${(filteredStocks.length / stocks.length * 100).toFixed(1)}%)\n`);

    return filteredStocks;
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

    // 筛选动量收益率大于阈值的股票
    const filtered = stocksWithMomentum.filter(stock => stock.momentumReturn >= minReturn);
    
    // 输出被剔除的股票信息（前5个）
    const removed = stocksWithMomentum.filter(stock => stock.momentumReturn < minReturn)
      .sort((a, b) => a.momentumReturn - b.momentumReturn)
      .slice(0, 5);
    if (removed.length > 0) {
      console.log(`   ⚠️  动量最差的5只股票:`);
      removed.forEach(s => {
        console.log(`      ${s.name || s.con_code}: ${(s.momentumReturn * 100).toFixed(2)}%`);
      });
    }
    
    return filtered;
  }

  /**
   * 按质量得分筛选股票（保留得分高于中位数的股票）
   */
  filterByQualityScore(stocks) {
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
    const median = scores[Math.floor(scores.length / 2)];

    // 筛选得分高于中位数的股票
    return stocksWithScore.filter(stock => stock.qualityScore >= median);
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
