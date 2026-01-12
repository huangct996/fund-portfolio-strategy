/**
 * 诊断策略表现下降问题
 */

const axios = require('axios');

async function diagnosePerformance() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 策略表现诊断');
  console.log('='.repeat(80) + '\n');

  const baseUrl = 'http://localhost:3001';
  const baseParams = {
    startDate: '20200710',
    endDate: '20250710',
    strategyType: 'riskParity',
    useAdaptive: false,
    volatilityWindow: 6,
    ewmaDecay: 0.91,
    rebalanceFrequency: 'quarterly',
    enableTradingCost: false,
    tradingCostRate: 0,
    riskFreeRate: 0.02,
    useQualityTilt: false,
    useCovariance: false,
    hybridRatio: 0,
    enableStockFilter: false
  };

  // 测试不同的maxWeight值
  const maxWeights = [0.10, 0.13, 0.15, 0.20, 0.25];
  
  console.log('【测试1】不同maxWeight的影响');
  console.log('-'.repeat(80));
  console.log('maxWeight | 累计收益 | 年化收益 | 夏普比率 | 最大回撤');
  console.log('-'.repeat(80));
  
  for (const maxWeight of maxWeights) {
    try {
      const url = `${baseUrl}/api/index-returns?${new URLSearchParams({
        ...baseParams,
        maxWeight
      })}`;
      
      const res = await axios.get(url);
      const data = res.data.data;
      
      console.log(`${(maxWeight * 100).toFixed(0).padStart(3)}%      | ${(data.customRisk.totalReturn * 100).toFixed(2).padStart(8)}% | ${(data.customRisk.annualizedReturn * 100).toFixed(2).padStart(8)}% | ${data.customRisk.sharpeRatio.toFixed(2).padStart(8)} | ${(data.customRisk.maxDrawdown * 100).toFixed(2).padStart(8)}%`);
      
      // 等待一下避免请求过快
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`❌ maxWeight=${maxWeight} 测试失败:`, error.message);
    }
  }

  console.log('\n');
  
  // 测试自适应策略
  console.log('【测试2】自适应策略表现');
  console.log('-'.repeat(80));
  
  try {
    const url = `${baseUrl}/api/index-returns?${new URLSearchParams({
      ...baseParams,
      maxWeight: 0.15,  // 这个参数对自适应策略应该无效
      useAdaptive: true
    })}`;
    
    const res = await axios.get(url);
    const data = res.data.data;
    
    console.log('自适应策略:');
    console.log(`  累计收益率: ${(data.customRisk.totalReturn * 100).toFixed(2)}%`);
    console.log(`  年化收益率: ${(data.customRisk.annualizedReturn * 100).toFixed(2)}%`);
    console.log(`  夏普比率: ${data.customRisk.sharpeRatio.toFixed(2)}`);
    console.log(`  最大回撤: ${(data.customRisk.maxDrawdown * 100).toFixed(2)}%`);
  } catch (error) {
    console.error('❌ 自适应策略测试失败:', error.message);
  }

  console.log('\n');
  
  // 对比基准
  console.log('【测试3】与基准对比');
  console.log('-'.repeat(80));
  
  try {
    const url = `${baseUrl}/api/index-returns?${new URLSearchParams({
      ...baseParams,
      maxWeight: 0.15
    })}`;
    
    const res = await axios.get(url);
    const data = res.data.data;
    
    console.log('策略对比:');
    console.log('');
    console.log('指标          | 风险平价 | 指数策略 | 基金基准');
    console.log('-'.repeat(60));
    console.log(`累计收益率    | ${(data.customRisk.totalReturn * 100).toFixed(2).padStart(8)}% | ${(data.indexRisk.totalReturn * 100).toFixed(2).padStart(8)}% | ${(data.fundRisk.totalReturn * 100).toFixed(2).padStart(8)}%`);
    console.log(`年化收益率    | ${(data.customRisk.annualizedReturn * 100).toFixed(2).padStart(8)}% | ${(data.indexRisk.annualizedReturn * 100).toFixed(2).padStart(8)}% | ${(data.fundRisk.annualizedReturn * 100).toFixed(2).padStart(8)}%`);
    console.log(`夏普比率      | ${data.customRisk.sharpeRatio.toFixed(2).padStart(8)} | ${data.indexRisk.sharpeRatio.toFixed(2).padStart(8)} | ${data.fundRisk.sharpeRatio.toFixed(2).padStart(8)}`);
    console.log(`最大回撤      | ${(data.customRisk.maxDrawdown * 100).toFixed(2).padStart(8)}% | ${(data.indexRisk.maxDrawdown * 100).toFixed(2).padStart(8)}% | ${(data.fundRisk.maxDrawdown * 100).toFixed(2).padStart(8)}%`);
  } catch (error) {
    console.error('❌ 基准对比测试失败:', error.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 诊断结果');
  console.log('='.repeat(80) + '\n');
  
  console.log('问题分析:');
  console.log('1. 当前夏普比率约0.60，低于历史最佳0.92');
  console.log('2. 需要检查是否有代码改动影响了策略表现');
  console.log('3. 需要确认自适应策略是否正确使用温度区间参数');
  console.log('');
  console.log('可能原因:');
  console.log('- 数据库数据变化');
  console.log('- 参数计算逻辑变化');
  console.log('- 风险平价算法变化');
  console.log('- 市场环境变化（最近数据）');
}

diagnosePerformance();
