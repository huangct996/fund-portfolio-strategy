/**
 * 测试脚本：验证风险平价策略的调仓频率不会影响指数策略的夏普比率
 * 
 * 测试逻辑：
 * 1. 使用相同的参数，只改变rebalanceFrequency（yearly vs quarterly）
 * 2. 验证指数策略的夏普比率保持一致
 * 3. 验证指数策略的其他风险指标也保持一致
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// 基础参数配置
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

async function testRebalanceFrequency() {
  console.log('='.repeat(80));
  console.log('开始测试：风险平价策略调仓频率对指数策略的影响');
  console.log('='.repeat(80));
  
  try {
    // 测试1：年度调仓
    console.log('\n📊 测试1：年度调仓 (yearly)');
    const yearlyParams = { ...baseParams, rebalanceFrequency: 'yearly' };
    const yearlyResponse = await axios.get(`${BASE_URL}/api/index-returns`, { params: yearlyParams });
    
    if (!yearlyResponse.data.success) {
      throw new Error('年度调仓请求失败: ' + yearlyResponse.data.error);
    }
    
    const yearlyIndexRisk = yearlyResponse.data.data.indexRisk;
    console.log('指数策略风险指标:');
    console.log(`  累计收益率: ${(yearlyIndexRisk.totalReturn * 100).toFixed(2)}%`);
    console.log(`  年化收益率: ${(yearlyIndexRisk.annualizedReturn * 100).toFixed(2)}%`);
    console.log(`  年化波动率: ${(yearlyIndexRisk.volatility * 100).toFixed(2)}%`);
    console.log(`  夏普比率: ${yearlyIndexRisk.sharpeRatio.toFixed(4)}`);
    console.log(`  最大回撤: ${(yearlyIndexRisk.maxDrawdown * 100).toFixed(2)}%`);
    console.log(`  交易日数: ${yearlyIndexRisk.tradingDays}`);
    
    // 测试2：季度调仓
    console.log('\n📊 测试2：季度调仓 (quarterly)');
    const quarterlyParams = { ...baseParams, rebalanceFrequency: 'quarterly' };
    const quarterlyResponse = await axios.get(`${BASE_URL}/api/index-returns`, { params: quarterlyParams });
    
    if (!quarterlyResponse.data.success) {
      throw new Error('季度调仓请求失败: ' + quarterlyResponse.data.error);
    }
    
    const quarterlyIndexRisk = quarterlyResponse.data.data.indexRisk;
    console.log('指数策略风险指标:');
    console.log(`  累计收益率: ${(quarterlyIndexRisk.totalReturn * 100).toFixed(2)}%`);
    console.log(`  年化收益率: ${(quarterlyIndexRisk.annualizedReturn * 100).toFixed(2)}%`);
    console.log(`  年化波动率: ${(quarterlyIndexRisk.volatility * 100).toFixed(2)}%`);
    console.log(`  夏普比率: ${quarterlyIndexRisk.sharpeRatio.toFixed(4)}`);
    console.log(`  最大回撤: ${(quarterlyIndexRisk.maxDrawdown * 100).toFixed(2)}%`);
    console.log(`  交易日数: ${quarterlyIndexRisk.tradingDays}`);
    
    // 验证结果
    console.log('\n' + '='.repeat(80));
    console.log('验证结果');
    console.log('='.repeat(80));
    
    const tolerance = 0.0001; // 容差：0.01%
    
    const sharpeRatioDiff = Math.abs(yearlyIndexRisk.sharpeRatio - quarterlyIndexRisk.sharpeRatio);
    const totalReturnDiff = Math.abs(yearlyIndexRisk.totalReturn - quarterlyIndexRisk.totalReturn);
    const volatilityDiff = Math.abs(yearlyIndexRisk.volatility - quarterlyIndexRisk.volatility);
    const maxDrawdownDiff = Math.abs(yearlyIndexRisk.maxDrawdown - quarterlyIndexRisk.maxDrawdown);
    const tradingDaysDiff = Math.abs(yearlyIndexRisk.tradingDays - quarterlyIndexRisk.tradingDays);
    
    console.log(`\n夏普比率差异: ${sharpeRatioDiff.toFixed(6)} (容差: ${tolerance})`);
    console.log(`累计收益率差异: ${(totalReturnDiff * 100).toFixed(4)}%`);
    console.log(`年化波动率差异: ${(volatilityDiff * 100).toFixed(4)}%`);
    console.log(`最大回撤差异: ${(maxDrawdownDiff * 100).toFixed(4)}%`);
    console.log(`交易日数差异: ${tradingDaysDiff}`);
    
    let allTestsPassed = true;
    
    if (sharpeRatioDiff > tolerance) {
      console.log(`\n❌ 测试失败：夏普比率差异 ${sharpeRatioDiff.toFixed(6)} 超过容差 ${tolerance}`);
      allTestsPassed = false;
    } else {
      console.log(`\n✅ 夏普比率测试通过：差异 ${sharpeRatioDiff.toFixed(6)} 在容差范围内`);
    }
    
    if (totalReturnDiff > tolerance) {
      console.log(`❌ 测试失败：累计收益率差异 ${(totalReturnDiff * 100).toFixed(4)}% 超过容差`);
      allTestsPassed = false;
    } else {
      console.log(`✅ 累计收益率测试通过：差异 ${(totalReturnDiff * 100).toFixed(4)}% 在容差范围内`);
    }
    
    if (volatilityDiff > tolerance) {
      console.log(`❌ 测试失败：年化波动率差异 ${(volatilityDiff * 100).toFixed(4)}% 超过容差`);
      allTestsPassed = false;
    } else {
      console.log(`✅ 年化波动率测试通过：差异 ${(volatilityDiff * 100).toFixed(4)}% 在容差范围内`);
    }
    
    if (maxDrawdownDiff > tolerance) {
      console.log(`❌ 测试失败：最大回撤差异 ${(maxDrawdownDiff * 100).toFixed(4)}% 超过容差`);
      allTestsPassed = false;
    } else {
      console.log(`✅ 最大回撤测试通过：差异 ${(maxDrawdownDiff * 100).toFixed(4)}% 在容差范围内`);
    }
    
    if (tradingDaysDiff !== 0) {
      console.log(`❌ 测试失败：交易日数不一致 (${yearlyIndexRisk.tradingDays} vs ${quarterlyIndexRisk.tradingDays})`);
      allTestsPassed = false;
    } else {
      console.log(`✅ 交易日数测试通过：两者相同 (${yearlyIndexRisk.tradingDays})`);
    }
    
    console.log('\n' + '='.repeat(80));
    if (allTestsPassed) {
      console.log('✅ 所有测试通过！指数策略不受风险平价调仓频率影响。');
    } else {
      console.log('❌ 部分测试失败！指数策略受到风险平价调仓频率影响。');
    }
    console.log('='.repeat(80));
    
    process.exit(allTestsPassed ? 0 : 1);
    
  } catch (error) {
    console.error('\n❌ 测试执行失败:', error.message);
    if (error.response) {
      console.error('响应数据:', error.response.data);
    }
    process.exit(1);
  }
}

testRebalanceFrequency();
