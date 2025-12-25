/**
 * 简单测试：只查看季度策略的最后几个期间
 */

const axios = require('axios');

async function test() {
  const params = {
    startDate: '20200710',
    endDate: '20250710',
    maxWeight: '0.13',
    strategyType: 'riskParity',
    volatilityWindow: '6',
    ewmaDecay: '0.91',
    rebalanceFrequency: 'quarterly',
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
  const periods = response.data.data.periods;
  
  console.log('最后5个期间:');
  periods.slice(-5).forEach((p, i) => {
    console.log(`${periods.length - 5 + i + 1}. ${p.rebalanceDate} (${p.startDate} -> ${p.endDate}) [年度: ${p.isYearlyRebalance}, 结束: ${p.isEndDate || false}]`);
  });
  
  console.log(`\n总期间数: ${periods.length}`);
  console.log(`最后期间的结束日期: ${periods[periods.length - 1].endDate}`);
  console.log(`用户选择的结束日期: ${params.endDate}`);
  console.log(`是否相等: ${periods[periods.length - 1].endDate === params.endDate}`);
}

test().catch(console.error);
