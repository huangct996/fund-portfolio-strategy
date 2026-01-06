/**
 * 分析自定义策略高收益率问题
 */

const axios = require('axios');

async function analyzeHighReturns() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 分析自定义策略高收益率问题');
    console.log('='.repeat(80) + '\n');
    
    const params = {
      startDate: '20200710',
      endDate: '20250710',
      maxWeight: 0.13,
      strategyType: 'riskParity',
      useAdaptive: true,
      volatilityWindow: 6,
      ewmaDecay: 0.91,
      rebalanceFrequency: 'quarterly',
      enableTradingCost: false,
      tradingCostRate: 0,
      riskFreeRate: 0.02,
      useQualityTilt: false,
      useCovariance: false,
      hybridRatio: 0,
      enableStockFilter: true,
      minROE: 0,
      maxDebtRatio: 1,
      momentumMonths: 6,
      minMomentumReturn: -0.1,
      filterByQuality: false
    };
    
    const url = 'http://localhost:3001/api/index-returns';
    const response = await axios.get(url, { params });
    
    if (!response.data.success) {
      throw new Error(response.data.error || '获取数据失败');
    }
    
    const data = response.data.data;
    
    // 1. 总体收益率分析
    console.log('【总体收益率】\n');
    console.log(`自定义策略累计收益: ${(data.customStrategy.cumulativeReturn * 100).toFixed(2)}%`);
    console.log(`指数策略累计收益: ${(data.indexStrategy.cumulativeReturn * 100).toFixed(2)}%`);
    console.log(`基金累计收益: ${(data.fundStrategy.cumulativeReturn * 100).toFixed(2)}%`);
    console.log(`\n自定义策略年化收益: ${(data.customStrategy.annualizedReturn * 100).toFixed(2)}%`);
    console.log(`自定义策略夏普比率: ${data.customStrategy.sharpeRatio.toFixed(2)}`);
    console.log(`自定义策略最大回撤: ${(data.customStrategy.maxDrawdown * 100).toFixed(2)}%`);
    
    // 2. 调仓期数统计
    console.log(`\n\n【调仓期统计】\n`);
    console.log(`总调仓期数: ${data.periods.length}`);
    console.log(`时间跨度: ${params.startDate} - ${params.endDate}`);
    
    // 3. 分析各调仓期收益率
    console.log(`\n\n【各调仓期收益率详情】\n`);
    console.log('序号 | 调仓日期   | 结束日期   | 自定义收益 | 指数收益 | 基金收益 | 持仓数 | 温度');
    console.log('-'.repeat(100));
    
    let cumulativeCustom = 1;
    let cumulativeIndex = 1;
    let cumulativeFund = 1;
    
    data.periods.forEach((period, index) => {
      const customReturn = period.customCumulativeReturn || 0;
      const indexReturn = period.indexCumulativeReturn || 0;
      const fundReturn = period.fundCumulativeReturn || 0;
      
      cumulativeCustom *= (1 + customReturn);
      cumulativeIndex *= (1 + indexReturn);
      cumulativeFund *= (1 + fundReturn);
      
      const holdingsCount = period.holdings ? period.holdings.length : 0;
      const temp = period.marketTemperature || '--';
      
      console.log(
        `${String(index + 1).padStart(4)} | ` +
        `${period.rebalanceDate} | ` +
        `${period.endDate} | ` +
        `${(customReturn * 100).toFixed(2).padStart(10)}% | ` +
        `${(indexReturn * 100).toFixed(2).padStart(9)}% | ` +
        `${(fundReturn * 100).toFixed(2).padStart(9)}% | ` +
        `${String(holdingsCount).padStart(6)} | ` +
        `${String(temp).padStart(4)}°`
      );
    });
    
    console.log('-'.repeat(100));
    console.log(`累计 |            |            | ` +
      `${((cumulativeCustom - 1) * 100).toFixed(2).padStart(10)}% | ` +
      `${((cumulativeIndex - 1) * 100).toFixed(2).padStart(9)}% | ` +
      `${((cumulativeFund - 1) * 100).toFixed(2).padStart(9)}%`
    );
    
    // 4. 异常收益期分析
    console.log(`\n\n【异常高收益期分析（单期收益>30%）】\n`);
    const highReturnPeriods = data.periods.filter(p => (p.customCumulativeReturn || 0) > 0.3);
    
    if (highReturnPeriods.length > 0) {
      highReturnPeriods.forEach(period => {
        console.log(`\n调仓日期: ${period.rebalanceDate} - ${period.endDate}`);
        console.log(`  自定义收益: ${((period.customCumulativeReturn || 0) * 100).toFixed(2)}%`);
        console.log(`  指数收益: ${((period.indexCumulativeReturn || 0) * 100).toFixed(2)}%`);
        console.log(`  基金收益: ${((period.fundCumulativeReturn || 0) * 100).toFixed(2)}%`);
        console.log(`  持仓数量: ${period.holdings ? period.holdings.length : 0}`);
        
        if (period.holdings && period.holdings.length > 0) {
          console.log(`  前5大持仓:`);
          period.holdings.slice(0, 5).forEach((h, i) => {
            console.log(`    ${i + 1}. ${h.name} (${h.symbol}): ${(h.customWeight * 100).toFixed(2)}%`);
          });
        }
      });
    } else {
      console.log('  无异常高收益期');
    }
    
    // 5. 持仓集中度分析
    console.log(`\n\n【持仓集中度分析】\n`);
    
    const firstPeriod = data.periods[0];
    const lastPeriod = data.periods[data.periods.length - 1];
    
    if (firstPeriod.holdings) {
      console.log(`首期（${firstPeriod.rebalanceDate}）持仓:`);
      console.log(`  总持仓数: ${firstPeriod.holdings.length}`);
      const top5First = firstPeriod.holdings.slice(0, 5);
      const top5Weight = top5First.reduce((sum, h) => sum + h.customWeight, 0);
      console.log(`  前5大权重: ${(top5Weight * 100).toFixed(2)}%`);
      top5First.forEach((h, i) => {
        console.log(`    ${i + 1}. ${h.name}: ${(h.customWeight * 100).toFixed(2)}%`);
      });
    }
    
    if (lastPeriod.holdings) {
      console.log(`\n末期（${lastPeriod.rebalanceDate}）持仓:`);
      console.log(`  总持仓数: ${lastPeriod.holdings.length}`);
      const top5Last = lastPeriod.holdings.slice(0, 5);
      const top5Weight = top5Last.reduce((sum, h) => sum + h.customWeight, 0);
      console.log(`  前5大权重: ${(top5Weight * 100).toFixed(2)}%`);
      top5Last.forEach((h, i) => {
        console.log(`    ${i + 1}. ${h.name}: ${(h.customWeight * 100).toFixed(2)}%`);
      });
    }
    
    // 6. 收益率合理性检查
    console.log(`\n\n【收益率合理性检查】\n`);
    
    const avgCustomReturn = data.periods.reduce((sum, p) => sum + (p.customCumulativeReturn || 0), 0) / data.periods.length;
    const avgIndexReturn = data.periods.reduce((sum, p) => sum + (p.indexCumulativeReturn || 0), 0) / data.periods.length;
    
    console.log(`平均单期收益率:`);
    console.log(`  自定义策略: ${(avgCustomReturn * 100).toFixed(2)}%`);
    console.log(`  指数策略: ${(avgIndexReturn * 100).toFixed(2)}%`);
    console.log(`  差异: ${((avgCustomReturn - avgIndexReturn) * 100).toFixed(2)}%`);
    
    const maxCustomReturn = Math.max(...data.periods.map(p => p.customCumulativeReturn || 0));
    const minCustomReturn = Math.min(...data.periods.map(p => p.customCumulativeReturn || 0));
    
    console.log(`\n单期收益率范围:`);
    console.log(`  最大: ${(maxCustomReturn * 100).toFixed(2)}%`);
    console.log(`  最小: ${(minCustomReturn * 100).toFixed(2)}%`);
    
    // 7. 可能的问题点
    console.log(`\n\n【可能的问题点】\n`);
    
    const issues = [];
    
    if (data.customStrategy.cumulativeReturn > 2) {
      issues.push('⚠️ 累计收益率超过200%，远高于指数和基金，需要检查');
    }
    
    if (avgCustomReturn > 0.2) {
      issues.push('⚠️ 平均单期收益率超过20%，可能存在计算错误');
    }
    
    if (maxCustomReturn > 0.5) {
      issues.push('⚠️ 存在单期收益率超过50%的情况，需要检查数据');
    }
    
    const volatility = Math.sqrt(
      data.periods.reduce((sum, p) => {
        const ret = (p.customCumulativeReturn || 0) - avgCustomReturn;
        return sum + ret * ret;
      }, 0) / data.periods.length
    );
    
    console.log(`收益率波动率: ${(volatility * 100).toFixed(2)}%`);
    
    if (volatility > 0.3) {
      issues.push('⚠️ 收益率波动过大，可能存在异常数据');
    }
    
    if (issues.length > 0) {
      issues.forEach(issue => console.log(issue));
    } else {
      console.log('✅ 未发现明显异常');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ 分析完成');
    console.log('='.repeat(80) + '\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 分析失败:', error.message);
    if (error.response) {
      console.error('响应数据:', error.response.data);
    }
    process.exit(1);
  }
}

analyzeHighReturns();
