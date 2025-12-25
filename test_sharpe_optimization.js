/**
 * 风险平价策略参数优化测试
 * 目标：找出最大化夏普比率的参数组合
 * 
 * 测试参数范围：
 * - 波动率窗口：6-24个月，步长1
 * - 最低动量收益率：10%到-20%，步长1%
 * - 动量期间：1-12个月，步长1（独立于波动率窗口）
 */

const axios = require('axios');
const fs = require('fs');

// 参数范围定义
const PARAM_RANGES = {
  volatilityWindow: { min: 6, max: 6, step: 1 },
  minMomentumReturn: { min: -0.20, max: 0.10, step: 0.01 },
  momentumMonths: { min: 6, max: 6, step: 1 }
};

// 固定参数（使用默认配置）
const FIXED_PARAMS = {
  fundCode: '512890.SH',
  startDate: '20200101',
  endDate: '20241231',
  strategyType: 'riskParity',
  ewmaDecay: 0.94,
  rebalanceFrequency: 'yearly',
  enableTradingCost: false,
  maxWeight: 0.10,
  enableStockFilter: true,
  minROE: 0,              // 不启用ROE筛选
  maxDebtRatio: 1.0,      // 不启用负债率筛选
  filterByQuality: true,
  useQualityTilt: false,
  useCovariance: false,
  useMomentumTilt: false,
  hybridRatio: 0
};

// 生成参数组合
function generateParamCombinations() {
  const combinations = [];
  
  for (let volatilityWindow = PARAM_RANGES.volatilityWindow.min; 
       volatilityWindow <= PARAM_RANGES.volatilityWindow.max; 
       volatilityWindow += PARAM_RANGES.volatilityWindow.step) {
    
    for (let momentumMonths = PARAM_RANGES.momentumMonths.min;
         momentumMonths <= PARAM_RANGES.momentumMonths.max;
         momentumMonths += PARAM_RANGES.momentumMonths.step) {
      
      for (let minMomentumReturn = PARAM_RANGES.minMomentumReturn.min;
           minMomentumReturn <= PARAM_RANGES.minMomentumReturn.max;
           minMomentumReturn += PARAM_RANGES.minMomentumReturn.step) {
        
        combinations.push({
          volatilityWindow,
          momentumMonths,
          minMomentumReturn: Math.round(minMomentumReturn * 100) / 100 // 避免浮点数精度问题
        });
      }
    }
  }
  
  return combinations;
}

// 测试单个参数组合
async function testParams(params) {
  try {
    const response = await axios.get('http://localhost:3001/api/index-returns', {
      params: { ...FIXED_PARAMS, ...params },
      timeout: 120000
    });

    if (response.data && response.data.success && response.data.data) {
      const data = response.data.data;
      return {
        ...params,
        sharpeRatio: data.customRisk?.sharpeRatio || 0,
        annualizedReturn: data.customRisk?.annualizedReturn || 0,
        maxDrawdown: data.customRisk?.maxDrawdown || 0,
        volatility: data.customRisk?.volatility || 0,
        totalReturn: data.customRisk?.totalReturn || 0,
        success: true
      };
    }
  } catch (error) {
    return {
      ...params,
      error: error.message,
      success: false
    };
  }
}

// 主测试函数
async function optimizeSharpeRatio() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 风险平价策略参数优化测试');
  console.log('='.repeat(80));
  
  console.log('\n参数范围:');
  console.log(`  波动率窗口: ${PARAM_RANGES.volatilityWindow.min}-${PARAM_RANGES.volatilityWindow.max}个月`);
  console.log(`  动量期间: ${PARAM_RANGES.momentumMonths.min}-${PARAM_RANGES.momentumMonths.max}个月`);
  console.log(`  最低动量收益率: ${(PARAM_RANGES.minMomentumReturn.min * 100).toFixed(0)}%到${(PARAM_RANGES.minMomentumReturn.max * 100).toFixed(0)}%`);
  
  const combinations = generateParamCombinations();
  console.log(`\n总共需要测试: ${combinations.length} 个参数组合`);
  console.log(`预计耗时: ${Math.ceil(combinations.length * 3 / 60)} 分钟（假设每个测试3秒）\n`);
  
  const results = [];
  let successCount = 0;
  let failCount = 0;
  
  const startTime = Date.now();
  
  for (let i = 0; i < combinations.length; i++) {
    const params = combinations[i];
    
    // 显示进度
    if (i % 10 === 0 || i === combinations.length - 1) {
      const progress = ((i + 1) / combinations.length * 100).toFixed(1);
      const elapsed = (Date.now() - startTime) / 1000;
      const avgTime = elapsed / (i + 1);
      const remaining = Math.ceil((combinations.length - i - 1) * avgTime);
      
      process.stdout.write(`\r进度: ${i + 1}/${combinations.length} (${progress}%) | 成功: ${successCount} | 失败: ${failCount} | 剩余时间: ${remaining}秒`);
    }
    
    const result = await testParams(params);
    results.push(result);
    
    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // 每100个结果保存一次（防止意外中断丢失数据）
    if ((i + 1) % 100 === 0) {
      saveResults(results, 'optimization_results_partial.json');
    }
  }
  
  console.log('\n\n' + '='.repeat(80));
  console.log('✅ 测试完成');
  console.log('='.repeat(80));
  console.log(`总测试数: ${combinations.length}`);
  console.log(`成功: ${successCount}`);
  console.log(`失败: ${failCount}`);
  console.log(`总耗时: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} 分钟`);
  
  // 保存完整结果
  saveResults(results, 'optimization_results_full.json');
  
  // 分析结果
  analyzeResults(results);
}

// 保存结果到文件
function saveResults(results, filename) {
  const filepath = `/Users/huang/CascadeProjects/fund_replication/${filename}`;
  fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
  console.log(`\n💾 结果已保存到: ${filename}`);
}

// 分析结果
function analyzeResults(results) {
  const validResults = results.filter(r => r.success && r.sharpeRatio > 0);
  
  if (validResults.length === 0) {
    console.log('\n❌ 没有有效的测试结果');
    return;
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 结果分析');
  console.log('='.repeat(80));
  
  // 按夏普比率排序
  validResults.sort((a, b) => b.sharpeRatio - a.sharpeRatio);
  
  // Top 10 最佳配置
  console.log('\n🏆 Top 10 最佳配置（按夏普比率排序）:');
  console.log('-'.repeat(80));
  console.log('排名  波动窗口  动量期间  最低动量  夏普比率  年化收益  最大回撤');
  console.log('-'.repeat(80));
  
  validResults.slice(0, 10).forEach((r, i) => {
    console.log(
      `${(i + 1).toString().padStart(4)}  ` +
      `${r.volatilityWindow.toString().padStart(8)}  ` +
      `${r.momentumMonths.toString().padStart(8)}  ` +
      `${((r.minMomentumReturn * 100).toFixed(0) + '%').padStart(8)}  ` +
      `${r.sharpeRatio.toFixed(3).padStart(9)}  ` +
      `${((r.annualizedReturn * 100).toFixed(2) + '%').padStart(8)}  ` +
      `${((r.maxDrawdown * 100).toFixed(2) + '%').padStart(8)}`
    );
  });
  
  // 最优配置详细信息
  const best = validResults[0];
  console.log('\n' + '='.repeat(80));
  console.log('🎯 最优配置详细信息');
  console.log('='.repeat(80));
  console.log(`波动率窗口: ${best.volatilityWindow} 个月`);
  console.log(`动量期间: ${best.momentumMonths} 个月`);
  console.log(`最低动量收益率: ${(best.minMomentumReturn * 100).toFixed(0)}%`);
  console.log(`\n风险收益指标:`);
  console.log(`  夏普比率: ${best.sharpeRatio.toFixed(3)}`);
  console.log(`  年化收益率: ${(best.annualizedReturn * 100).toFixed(2)}%`);
  console.log(`  累计收益率: ${(best.totalReturn * 100).toFixed(2)}%`);
  console.log(`  最大回撤: ${(best.maxDrawdown * 100).toFixed(2)}%`);
  console.log(`  年化波动率: ${(best.volatility * 100).toFixed(2)}%`);
  
  // 参数敏感性分析
  console.log('\n' + '='.repeat(80));
  console.log('📈 参数敏感性分析');
  console.log('='.repeat(80));
  
  // 波动率窗口的影响
  const volatilityWindowStats = analyzeParameter(validResults, 'volatilityWindow');
  console.log('\n波动率窗口对夏普比率的影响:');
  console.log('  最佳值: ' + volatilityWindowStats.best.value + ' 个月 (夏普比率: ' + volatilityWindowStats.best.avgSharpe.toFixed(3) + ')');
  console.log('  平均夏普比率范围: ' + volatilityWindowStats.min.toFixed(3) + ' - ' + volatilityWindowStats.max.toFixed(3));
  
  // 动量期间的影响
  const momentumMonthsStats = analyzeParameter(validResults, 'momentumMonths');
  console.log('\n动量期间对夏普比率的影响:');
  console.log('  最佳值: ' + momentumMonthsStats.best.value + ' 个月 (夏普比率: ' + momentumMonthsStats.best.avgSharpe.toFixed(3) + ')');
  console.log('  平均夏普比率范围: ' + momentumMonthsStats.min.toFixed(3) + ' - ' + momentumMonthsStats.max.toFixed(3));
  
  // 最低动量收益率的影响
  const minMomentumReturnStats = analyzeParameter(validResults, 'minMomentumReturn');
  console.log('\n最低动量收益率对夏普比率的影响:');
  console.log('  最佳值: ' + (minMomentumReturnStats.best.value * 100).toFixed(0) + '% (夏普比率: ' + minMomentumReturnStats.best.avgSharpe.toFixed(3) + ')');
  console.log('  平均夏普比率范围: ' + minMomentumReturnStats.min.toFixed(3) + ' - ' + minMomentumReturnStats.max.toFixed(3));
  
  // 生成优化建议
  console.log('\n' + '='.repeat(80));
  console.log('💡 优化建议');
  console.log('='.repeat(80));
  console.log('基于测试结果，推荐以下配置:');
  console.log(`  波动率窗口: ${best.volatilityWindow} 个月`);
  console.log(`  动量期间: ${best.momentumMonths} 个月`);
  console.log(`  最低动量收益率: ${(best.minMomentumReturn * 100).toFixed(0)}%`);
  console.log(`  EWMA衰减: 0.94 (固定)`);
  console.log(`  调仓频率: 年度 (固定)`);
  console.log(`  最大权重: 10% (固定)`);
  console.log(`  质量筛选: 启用 (固定)`);
  console.log(`  ROE筛选: 不启用 (固定)`);
  console.log(`  负债率筛选: 不启用 (固定)`);
  
  // 保存分析报告
  const report = {
    testDate: new Date().toISOString(),
    totalTests: results.length,
    validTests: validResults.length,
    paramRanges: PARAM_RANGES,
    fixedParams: FIXED_PARAMS,
    bestConfig: best,
    top10: validResults.slice(0, 10),
    parameterSensitivity: {
      volatilityWindow: volatilityWindowStats,
      momentumMonths: momentumMonthsStats,
      minMomentumReturn: minMomentumReturnStats
    }
  };
  
  fs.writeFileSync(
    '/Users/huang/CascadeProjects/fund_replication/optimization_report.json',
    JSON.stringify(report, null, 2)
  );
  console.log('\n💾 优化报告已保存到: optimization_report.json');
}

// 分析单个参数的影响
function analyzeParameter(results, paramName) {
  const grouped = {};
  
  results.forEach(r => {
    const value = r[paramName];
    if (!grouped[value]) {
      grouped[value] = [];
    }
    grouped[value].push(r.sharpeRatio);
  });
  
  const stats = Object.entries(grouped).map(([value, sharpes]) => ({
    value: paramName === 'minMomentumReturn' ? parseFloat(value) : parseInt(value),
    avgSharpe: sharpes.reduce((sum, s) => sum + s, 0) / sharpes.length,
    count: sharpes.length
  }));
  
  stats.sort((a, b) => b.avgSharpe - a.avgSharpe);
  
  const avgSharpes = stats.map(s => s.avgSharpe);
  
  return {
    best: stats[0],
    min: Math.min(...avgSharpes),
    max: Math.max(...avgSharpes),
    all: stats
  };
}

// 运行优化测试
optimizeSharpeRatio().catch(console.error);
