/**
 * 检查年度策略的数据点
 */

const axios = require('axios');

async function checkYearly() {
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
  const periods = response.data.data.periods;
  
  console.log('年度策略的所有期间:');
  periods.forEach((p, i) => {
    const hasIndexData = p.indexDailyReturns && p.indexDailyReturns.length > 0;
    const dataPoints = hasIndexData ? p.indexDailyReturns.length : 0;
    console.log(`${i + 1}. ${p.rebalanceDate} (${p.startDate} -> ${p.endDate})`);
    console.log(`   年度调仓: ${p.isYearlyRebalance}, 指数数据点: ${dataPoints}`);
  });
  
  // 统计总的指数数据点
  let totalIndexPoints = 0;
  periods.forEach(p => {
    if (p.indexDailyReturns && p.indexDailyReturns.length > 0) {
      totalIndexPoints += p.indexDailyReturns.length;
    }
  });
  
  console.log(`\n总指数数据点（从periods统计）: ${totalIndexPoints}`);
  console.log(`总指数数据点（从dailyData）: ${response.data.data.dailyData.index.length}`);
  
  // 计算期间6和7的数据点
  console.log(`\n期间6数据点: ${periods[5].indexDailyReturns ? periods[5].indexDailyReturns.length : 0}`);
  console.log(`期间7数据点: ${periods[6].indexDailyReturns ? periods[6].indexDailyReturns.length : 0}`);
  console.log(`期间6+7总计: ${(periods[5].indexDailyReturns ? periods[5].indexDailyReturns.length : 0) + (periods[6].indexDailyReturns ? periods[6].indexDailyReturns.length : 0)}`);
}

checkYearly().catch(console.error);
