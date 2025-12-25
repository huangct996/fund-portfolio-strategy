/**
 * 检查自定义策略的数据
 */

const axios = require('axios');

async function checkCustom() {
  const params = {
    startDate: '20200710',
    endDate: '20250710',
    maxWeight: '0.13',
    strategyType: 'riskParity',
    volatilityWindow: '6',
    ewmaDecay: '0.91',
    rebalanceFrequency: 'yearly',
    enableTradingCost: 'false',
    tradingCostRate: '0',
    riskFreeRate: '0.02',
    useQualityTilt: 'false',
    useCovariance: 'false',
    hybridRatio: '0',
    enableStockFilter: 'true',
    minROE: '0',
    maxDebtRatio: '1',
    momentumMonths: '6',
    minMomentumReturn: '-0.1',
    filterByQuality: 'true'
  };
  
  const response = await axios.get('http://localhost:3001/api/index-returns', { params });
  const data = response.data.data;
  
  console.log('自定义策略（风险平价）:');
  console.log(`  累计收益率: ${(data.customRisk.totalReturn * 100).toFixed(2)}%`);
  console.log(`  年化收益率: ${(data.customRisk.annualizedReturn * 100).toFixed(2)}%`);
  console.log(`  年化波动率: ${(data.customRisk.volatility * 100).toFixed(2)}%`);
  console.log(`  夏普比率: ${data.customRisk.sharpeRatio.toFixed(2)}`);
  console.log(`  最大回撤: ${(data.customRisk.maxDrawdown * 100).toFixed(2)}%`);
  console.log(`  交易日数: ${data.customRisk.tradingDays}`);
  
  console.log('\n期间数据:');
  data.periods.forEach((p, i) => {
    const customDataPoints = p.customDailyReturns ? p.customDailyReturns.length : 0;
    console.log(`${i + 1}. ${p.rebalanceDate} (${p.startDate} -> ${p.endDate})`);
    console.log(`   自定义数据点: ${customDataPoints}, 期间收益: ${(p.customReturn * 100).toFixed(2)}%`);
  });
  
  // 检查最后一个期间
  const lastPeriod = data.periods[data.periods.length - 1];
  console.log(`\n最后期间分析:`);
  console.log(`  调仓日期: ${lastPeriod.rebalanceDate}`);
  console.log(`  开始日期: ${lastPeriod.startDate}`);
  console.log(`  结束日期: ${lastPeriod.endDate}`);
  console.log(`  期间收益: ${(lastPeriod.customReturn * 100).toFixed(2)}%`);
  console.log(`  数据点数: ${lastPeriod.customDailyReturns ? lastPeriod.customDailyReturns.length : 0}`);
}

checkCustom().catch(console.error);
