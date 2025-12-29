/**
 * 自适应策略完整回测测试
 * 对比固定参数策略 vs 5状态自适应策略
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testAdaptiveStrategy() {
  console.log('='.repeat(80));
  console.log('🔬 自适应策略完整回测测试（5状态）');
  console.log('='.repeat(80));
  
  const baseParams = {
    startDate: '20200710',
    endDate: '20250710',
    strategyType: 'riskParity',
    maxWeight: '0.13',
    volatilityWindow: '6',
    ewmaDecay: '0.91',
    rebalanceFrequency: 'yearly',
    enableTradingCost: 'false',
    riskFreeRate: '0.02',
    enableStockFilter: 'true',
    minROE: '0',
    maxDebtRatio: '1',
    momentumMonths: '6',
    minMomentumReturn: '-0.1',
    filterByQuality: 'true'
  };
  
  try {
    console.log('\n📊 测试1：固定参数策略');
    console.log('-'.repeat(80));
    const fixedParams = { ...baseParams, useAdaptive: 'false' };
    const fixedResponse = await axios.get(`${BASE_URL}/api/index-returns`, { params: fixedParams });
    
    if (!fixedResponse.data.success) {
      throw new Error('固定策略请求失败: ' + fixedResponse.data.error);
    }
    
    const fixedData = fixedResponse.data.data;
    
    if (!fixedData || !fixedData.customRisk) {
      console.error('固定策略响应数据结构:', JSON.stringify(fixedResponse.data, null, 2));
      throw new Error('固定策略返回数据格式错误');
    }
    
    const fixedMetrics = fixedData.customRisk;
    
    console.log('\n✅ 固定参数策略结果:');
    console.log(`   累计收益: ${(fixedMetrics.cumulativeReturn * 100).toFixed(2)}%`);
    console.log(`   年化收益: ${(fixedMetrics.annualizedReturn * 100).toFixed(2)}%`);
    console.log(`   夏普比率: ${fixedMetrics.sharpeRatio.toFixed(4)}`);
    console.log(`   最大回撤: ${(fixedMetrics.maxDrawdown * 100).toFixed(2)}%`);
    console.log(`   调仓期数: ${fixedData.periods.length}`);
    
    console.log('\n📊 测试2：自适应策略（5状态）');
    console.log('-'.repeat(80));
    const adaptiveParams = { ...baseParams, useAdaptive: 'true' };
    const adaptiveResponse = await axios.get(`${BASE_URL}/api/index-returns`, { params: adaptiveParams });
    
    if (!adaptiveResponse.data.success) {
      throw new Error('自适应策略请求失败: ' + adaptiveResponse.data.error);
    }
    
    const adaptiveData = adaptiveResponse.data.data;
    
    if (!adaptiveData || !adaptiveData.customRisk) {
      console.error('自适应策略响应数据结构:', JSON.stringify(adaptiveResponse.data, null, 2));
      throw new Error('自适应策略返回数据格式错误');
    }
    
    const adaptiveMetrics = adaptiveData.customRisk;
    
    console.log('\n✅ 自适应策略结果:');
    console.log(`   累计收益: ${(adaptiveMetrics.cumulativeReturn * 100).toFixed(2)}%`);
    console.log(`   年化收益: ${(adaptiveMetrics.annualizedReturn * 100).toFixed(2)}%`);
    console.log(`   夏普比率: ${adaptiveMetrics.sharpeRatio.toFixed(4)}`);
    console.log(`   最大回撤: ${(adaptiveMetrics.maxDrawdown * 100).toFixed(2)}%`);
    console.log(`   调仓期数: ${adaptiveData.periods.length}`);
    
    // 统计市场状态分布
    console.log('\n📈 市场状态分布:');
    console.log('-'.repeat(80));
    const regimeCount = {};
    adaptiveData.periods.forEach(p => {
      if (p.marketRegimeName) {
        regimeCount[p.marketRegimeName] = (regimeCount[p.marketRegimeName] || 0) + 1;
      }
    });
    
    Object.entries(regimeCount).forEach(([regime, count]) => {
      const percentage = (count / adaptiveData.periods.length * 100).toFixed(1);
      console.log(`   ${regime}: ${count}次 (${percentage}%)`);
    });
    
    // 显示每个调仓期的市场状态
    console.log('\n📋 各调仓期市场状态详情:');
    console.log('-'.repeat(80));
    adaptiveData.periods.forEach((p, i) => {
      if (p.marketRegimeName) {
        const params = p.adaptiveParams;
        console.log(`${i + 1}. ${p.rebalanceDate}: ${p.marketRegimeName}`);
        console.log(`   参数: maxWeight=${(params.maxWeight * 100).toFixed(0)}%, minROE=${(params.minROE * 100).toFixed(0)}%, momentum=${params.momentumMonths}月`);
      }
    });
    
    // 对比分析
    console.log('\n' + '='.repeat(80));
    console.log('📊 策略对比分析');
    console.log('='.repeat(80));
    
    const returnDiff = (adaptiveMetrics.cumulativeReturn - fixedMetrics.cumulativeReturn) * 100;
    const sharpeDiff = adaptiveMetrics.sharpeRatio - fixedMetrics.sharpeRatio;
    const drawdownDiff = (adaptiveMetrics.maxDrawdown - fixedMetrics.maxDrawdown) * 100;
    
    console.log('\n指标对比:');
    console.log(`   累计收益差异: ${returnDiff > 0 ? '+' : ''}${returnDiff.toFixed(2)}%`);
    console.log(`   夏普比率差异: ${sharpeDiff > 0 ? '+' : ''}${sharpeDiff.toFixed(4)}`);
    console.log(`   最大回撤差异: ${drawdownDiff > 0 ? '+' : ''}${drawdownDiff.toFixed(2)}%`);
    
    console.log('\n结论:');
    if (returnDiff > 0 && sharpeDiff > 0) {
      console.log('   ✅ 自适应策略表现更优！');
      console.log(`   - 累计收益提升 ${returnDiff.toFixed(2)}%`);
      console.log(`   - 风险调整后收益（夏普比率）提升 ${(sharpeDiff * 100).toFixed(2)}%`);
    } else if (returnDiff > 0) {
      console.log('   ⚠️  自适应策略收益更高，但风险调整后收益略低');
    } else if (sharpeDiff > 0) {
      console.log('   ⚠️  自适应策略风险调整后收益更高，但绝对收益略低');
    } else {
      console.log('   ❌ 自适应策略表现不如固定策略，需要优化参数');
    }
    
    // 分阶段分析
    console.log('\n📈 分阶段收益分析:');
    console.log('-'.repeat(80));
    
    const stages = [
      { name: '2020-2021 (牛市初期)', start: '20200710', end: '20211231' },
      { name: '2022-2023 (震荡调整)', start: '20220101', end: '20231231' },
      { name: '2024-2025 (强势反弹)', start: '20240101', end: '20250710' }
    ];
    
    stages.forEach(stage => {
      const fixedPeriods = fixedData.periods.filter(p => 
        p.rebalanceDate >= stage.start && p.rebalanceDate <= stage.end
      );
      const adaptivePeriods = adaptiveData.periods.filter(p => 
        p.rebalanceDate >= stage.start && p.rebalanceDate <= stage.end
      );
      
      if (fixedPeriods.length > 0 && adaptivePeriods.length > 0) {
        const fixedReturn = fixedPeriods.reduce((sum, p) => sum + (p.customReturn || 0), 0);
        const adaptiveReturn = adaptivePeriods.reduce((sum, p) => sum + (p.customReturn || 0), 0);
        const diff = (adaptiveReturn - fixedReturn) * 100;
        
        console.log(`\n${stage.name}:`);
        console.log(`   固定策略: ${(fixedReturn * 100).toFixed(2)}%`);
        console.log(`   自适应策略: ${(adaptiveReturn * 100).toFixed(2)}%`);
        console.log(`   差异: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}%`);
      }
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ 测试完成！');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ 测试执行失败:', error.message);
    if (error.response) {
      console.error('响应数据:', error.response.data);
    }
    process.exit(1);
  }
}

testAdaptiveStrategy();
