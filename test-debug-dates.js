/**
 * 调试脚本：查看两种策略的调仓日期和数据收集情况
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

const baseParams = {
  startDate: '20200710',
  endDate: '20250710',
  maxWeight: '0.13',
  strategyType: 'riskParity',
  volatilityWindow: '6',
  ewmaDecay: '0.91',
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

async function debugDates() {
  console.log('='.repeat(80));
  console.log('调试：查看调仓日期和数据收集情况');
  console.log('='.repeat(80));
  
  try {
    // 测试1：年度调仓
    console.log('\n📊 年度调仓 (yearly)');
    const yearlyParams = { ...baseParams, rebalanceFrequency: 'yearly' };
    const yearlyResponse = await axios.get(`${BASE_URL}/api/index-returns`, { params: yearlyParams });
    
    if (!yearlyResponse.data.success) {
      throw new Error('年度调仓请求失败: ' + yearlyResponse.data.error);
    }
    
    const yearlyPeriods = yearlyResponse.data.data.periods;
    const yearlyDailyData = yearlyResponse.data.data.dailyData;
    
    console.log(`\n调仓期数: ${yearlyPeriods.length}`);
    console.log('调仓日期:');
    yearlyPeriods.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.rebalanceDate} (${p.startDate} -> ${p.endDate}) [年度: ${p.isYearlyRebalance}]`);
    });
    console.log(`\n指数策略每日数据点: ${yearlyDailyData.index.length}`);
    if (yearlyDailyData.index.length > 0) {
      console.log(`  首日: ${yearlyDailyData.index[0].date}`);
      console.log(`  末日: ${yearlyDailyData.index[yearlyDailyData.index.length - 1].date}`);
    }
    
    // 测试2：季度调仓
    console.log('\n' + '='.repeat(80));
    console.log('📊 季度调仓 (quarterly)');
    const quarterlyParams = { ...baseParams, rebalanceFrequency: 'quarterly' };
    const quarterlyResponse = await axios.get(`${BASE_URL}/api/index-returns`, { params: quarterlyParams });
    
    if (!quarterlyResponse.data.success) {
      throw new Error('季度调仓请求失败: ' + quarterlyResponse.data.error);
    }
    
    const quarterlyPeriods = quarterlyResponse.data.data.periods;
    const quarterlyDailyData = quarterlyResponse.data.data.dailyData;
    
    console.log(`\n调仓期数: ${quarterlyPeriods.length}`);
    console.log('调仓日期:');
    quarterlyPeriods.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.rebalanceDate} (${p.startDate} -> ${p.endDate}) [年度: ${p.isYearlyRebalance}]`);
    });
    console.log(`\n指数策略每日数据点: ${quarterlyDailyData.index.length}`);
    if (quarterlyDailyData.index.length > 0) {
      console.log(`  首日: ${quarterlyDailyData.index[0].date}`);
      console.log(`  末日: ${quarterlyDailyData.index[quarterlyDailyData.index.length - 1].date}`);
    }
    
    // 比较
    console.log('\n' + '='.repeat(80));
    console.log('比较分析');
    console.log('='.repeat(80));
    console.log(`年度调仓期数: ${yearlyPeriods.length}`);
    console.log(`季度调仓期数: ${quarterlyPeriods.length}`);
    console.log(`年度指数数据点: ${yearlyDailyData.index.length}`);
    console.log(`季度指数数据点: ${quarterlyDailyData.index.length}`);
    console.log(`差异: ${yearlyDailyData.index.length - quarterlyDailyData.index.length} 个交易日`);
    
    // 找出年度调仓期
    const yearlyRebalanceDates = yearlyPeriods.filter(p => p.isYearlyRebalance).map(p => p.rebalanceDate);
    const quarterlyRebalanceDates = quarterlyPeriods.filter(p => p.isYearlyRebalance).map(p => p.rebalanceDate);
    
    console.log(`\n年度调仓日期 (yearly策略): ${yearlyRebalanceDates.join(', ')}`);
    console.log(`年度调仓日期 (quarterly策略): ${quarterlyRebalanceDates.join(', ')}`);
    
    // 找出最后一个年度调仓日期
    const lastYearlyDate = yearlyRebalanceDates[yearlyRebalanceDates.length - 1];
    console.log(`\n最后一个年度调仓日期: ${lastYearlyDate}`);
    
    // 查看最后一个年度调仓日期之后的期间
    const yearlyPeriodsAfterLast = yearlyPeriods.filter(p => p.rebalanceDate > lastYearlyDate);
    const quarterlyPeriodsAfterLast = quarterlyPeriods.filter(p => p.rebalanceDate > lastYearlyDate);
    
    console.log(`\n最后年度调仓日期之后的期间:`);
    console.log(`  年度策略: ${yearlyPeriodsAfterLast.length} 个期间`);
    yearlyPeriodsAfterLast.forEach(p => {
      console.log(`    ${p.rebalanceDate} (${p.startDate} -> ${p.endDate})`);
    });
    console.log(`  季度策略: ${quarterlyPeriodsAfterLast.length} 个期间`);
    quarterlyPeriodsAfterLast.forEach(p => {
      console.log(`    ${p.rebalanceDate} (${p.startDate} -> ${p.endDate})`);
    });
    
  } catch (error) {
    console.error('\n❌ 调试失败:', error.message);
    if (error.response) {
      console.error('响应数据:', error.response.data);
    }
    process.exit(1);
  }
}

debugDates();
