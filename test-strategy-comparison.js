/**
 * 测试脚本：对比风险平价策略和自适应策略
 */

const axios = require('axios');

async function testStrategies() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 策略对比测试');
  console.log('='.repeat(80) + '\n');

  const baseParams = {
    startDate: '20200710',
    endDate: '20250710',
    maxWeight: 0.13,
    strategyType: 'riskParity',
    volatilityWindow: 6,
    ewmaDecay: 0.91,
    rebalanceFrequency: 'quarterly',
    enableTradingCost: false,
    riskFreeRate: 0.02,
    useQualityTilt: false,
    useCovariance: true,
    hybridRatio: 0
  };

  // 测试1: 风险平价策略（v8.0.0版本，不带自适应）
  console.log('【测试1】风险平价策略（v8.0.0版本）');
  console.log('-'.repeat(80));
  
  try {
    const params1 = new URLSearchParams({
      ...baseParams,
      useAdaptive: 'false',
      enableStockFilter: 'false'
    });
    
    const res1 = await axios.get(`http://localhost:3001/api/index-returns?${params1}`);
    const data1 = res1.data.data;
    
    console.log('累计收益率:', (data1.customRisk.totalReturn * 100).toFixed(2) + '%');
    console.log('年化收益率:', (data1.customRisk.annualizedReturn * 100).toFixed(2) + '%');
    console.log('夏普比率:', data1.customRisk.sharpeRatio.toFixed(2));
    console.log('最大回撤:', (data1.customRisk.maxDrawdown * 100).toFixed(2) + '%');
    console.log('调仓期数:', data1.periods.length);
    
    if (data1.periods.length > 0) {
      const firstPeriod = data1.periods[0];
      const holdingsCount = firstPeriod.currentWeights ? Object.keys(firstPeriod.currentWeights).length : 0;
      console.log('第1期持仓数:', holdingsCount);
    }
  } catch (error) {
    console.error('测试1失败:', error.message);
  }

  console.log('\n');

  // 测试2: 自适应策略（根据市场温度调整）
  console.log('【测试2】自适应策略（根据市场温度调整）');
  console.log('-'.repeat(80));
  
  try {
    const params2 = new URLSearchParams({
      ...baseParams,
      useAdaptive: 'true',
      useCovariance: 'false',  // 自适应策略不使用协方差
      enableStockFilter: 'true',
      minROE: 0,
      maxDebtRatio: 1,
      momentumMonths: 6,
      minMomentumReturn: -0.1,
      filterByQuality: false
    });
    
    const res2 = await axios.get(`http://localhost:3001/api/index-returns?${params2}`);
    const data2 = res2.data.data;
    
    console.log('累计收益率:', (data2.customRisk.totalReturn * 100).toFixed(2) + '%');
    console.log('年化收益率:', (data2.customRisk.annualizedReturn * 100).toFixed(2) + '%');
    console.log('夏普比率:', data2.customRisk.sharpeRatio.toFixed(2));
    console.log('最大回撤:', (data2.customRisk.maxDrawdown * 100).toFixed(2) + '%');
    console.log('调仓期数:', data2.periods.length);
    
    if (data2.periods.length > 0) {
      const firstPeriod = data2.periods[0];
      const holdingsCount = firstPeriod.currentWeights ? Object.keys(firstPeriod.currentWeights).length : 0;
      console.log('第1期持仓数:', holdingsCount);
    }
  } catch (error) {
    console.error('测试2失败:', error.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ 测试完成');
  console.log('='.repeat(80) + '\n');
}

testStrategies();
