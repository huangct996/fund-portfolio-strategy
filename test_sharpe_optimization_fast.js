/**
 * 风险平价策略参数优化测试（快速版本）
 * 采用两阶段策略：
 * 1. 粗粒度搜索：快速找到大致最优区域
 * 2. 细粒度搜索：在最优区域附近精确搜索
 */

const axios = require('axios');
const fs = require('fs');

// 固定参数
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
  minROE: 0,
  maxDebtRatio: 1.0,
  filterByQuality: true,
  useQualityTilt: false,
  useCovariance: false,
  useMomentumTilt: false,
  hybridRatio: 0
};

// 阶段1：粗粒度搜索
const COARSE_RANGES = {
  volatilityWindow: { min: 6, max: 24, step: 3 },      // 6, 9, 12, 15, 18, 21, 24
  minMomentumReturn: { min: -0.20, max: 0.10, step: 0.05 }, // -20%, -15%, -10%, -5%, 0%, 5%, 10%
  momentumMonths: { min: 1, max: 12, step: 2 }         // 1, 3, 5, 7, 9, 11
};

// 阶段2：细粒度搜索（在最优点周围）
function getFineRanges(bestCoarse) {
  return {
    volatilityWindow: {
      min: Math.max(6, bestCoarse.volatilityWindow - 3),
      max: Math.min(24, bestCoarse.volatilityWindow + 3),
      step: 1
    },
    minMomentumReturn: {
      min: Math.max(-0.20, bestCoarse.minMomentumReturn - 0.05),
      max: Math.min(0.10, bestCoarse.minMomentumReturn + 0.05),
      step: 0.01
    },
    momentumMonths: {
      min: Math.max(1, bestCoarse.momentumMonths - 2),
      max: Math.min(12, bestCoarse.momentumMonths + 2),
      step: 1
    }
  };
}

// 生成参数组合
function generateCombinations(ranges) {
  const combinations = [];
  
  for (let volatilityWindow = ranges.volatilityWindow.min; 
       volatilityWindow <= ranges.volatilityWindow.max; 
       volatilityWindow += ranges.volatilityWindow.step) {
    
    for (let momentumMonths = ranges.momentumMonths.min;
         momentumMonths <= ranges.momentumMonths.max;
         momentumMonths += ranges.momentumMonths.step) {
      
      for (let minMomentumReturn = ranges.minMomentumReturn.min;
           minMomentumReturn <= ranges.minMomentumReturn.max;
           minMomentumReturn += ranges.minMomentumReturn.step) {
        
        combinations.push({
          volatilityWindow,
          momentumMonths,
          minMomentumReturn: Math.round(minMomentumReturn * 100) / 100
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

// 运行测试批次
async function runTests(combinations, phaseName) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔍 ${phaseName}`);
  console.log('='.repeat(80));
  console.log(`总共需要测试: ${combinations.length} 个参数组合\n`);
  
  const results = [];
  let successCount = 0;
  let failCount = 0;
  const startTime = Date.now();
  
  for (let i = 0; i < combinations.length; i++) {
    const params = combinations[i];
    
    // 显示进度
    const progress = ((i + 1) / combinations.length * 100).toFixed(1);
    const elapsed = (Date.now() - startTime) / 1000;
    const avgTime = elapsed / (i + 1);
    const remaining = Math.ceil((combinations.length - i - 1) * avgTime);
    
    process.stdout.write(
      `\r进度: ${i + 1}/${combinations.length} (${progress}%) | ` +
      `成功: ${successCount} | 失败: ${failCount} | ` +
      `剩余: ${remaining}秒 (${(remaining / 60).toFixed(1)}分钟)`
    );
    
    const result = await testParams(params);
    results.push(result);
    
    if (result.success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log('\n');
  console.log(`✅ ${phaseName}完成`);
  console.log(`总测试数: ${combinations.length} | 成功: ${successCount} | 失败: ${failCount}`);
  console.log(`耗时: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} 分钟`);
  
  return results;
}

// 主优化函数
async function optimizeSharpeRatio() {
  console.log('\n' + '='.repeat(80));
  console.log('🎯 风险平价策略参数优化（两阶段策略）');
  console.log('='.repeat(80));
  
  // 阶段1：粗粒度搜索
  console.log('\n📍 阶段1：粗粒度搜索');
  console.log(`  波动率窗口: ${COARSE_RANGES.volatilityWindow.min}-${COARSE_RANGES.volatilityWindow.max}，步长${COARSE_RANGES.volatilityWindow.step}`);
  console.log(`  动量期间: ${COARSE_RANGES.momentumMonths.min}-${COARSE_RANGES.momentumMonths.max}，步长${COARSE_RANGES.momentumMonths.step}`);
  console.log(`  最低动量收益率: ${(COARSE_RANGES.minMomentumReturn.min * 100).toFixed(0)}%到${(COARSE_RANGES.minMomentumReturn.max * 100).toFixed(0)}%，步长${(COARSE_RANGES.minMomentumReturn.step * 100).toFixed(0)}%`);
  
  const coarseCombinations = generateCombinations(COARSE_RANGES);
  const coarseResults = await runTests(coarseCombinations, '阶段1：粗粒度搜索');
  
  // 保存阶段1结果
  fs.writeFileSync(
    '/Users/huang/CascadeProjects/fund_replication/optimization_coarse_results.json',
    JSON.stringify(coarseResults, null, 2)
  );
  
  // 找出阶段1的最优配置
  const validCoarse = coarseResults.filter(r => r.success && r.sharpeRatio > 0);
  if (validCoarse.length === 0) {
    console.log('\n❌ 阶段1没有有效结果，无法继续');
    return;
  }
  
  validCoarse.sort((a, b) => b.sharpeRatio - a.sharpeRatio);
  const bestCoarse = validCoarse[0];
  
  console.log('\n📊 阶段1最优配置:');
  console.log(`  波动率窗口: ${bestCoarse.volatilityWindow} 个月`);
  console.log(`  动量期间: ${bestCoarse.momentumMonths} 个月`);
  console.log(`  最低动量收益率: ${(bestCoarse.minMomentumReturn * 100).toFixed(0)}%`);
  console.log(`  夏普比率: ${bestCoarse.sharpeRatio.toFixed(3)}`);
  console.log(`  年化收益率: ${(bestCoarse.annualizedReturn * 100).toFixed(2)}%`);
  
  // 阶段2：细粒度搜索
  const fineRanges = getFineRanges(bestCoarse);
  console.log('\n📍 阶段2：细粒度搜索（在最优点周围）');
  console.log(`  波动率窗口: ${fineRanges.volatilityWindow.min}-${fineRanges.volatilityWindow.max}，步长${fineRanges.volatilityWindow.step}`);
  console.log(`  动量期间: ${fineRanges.momentumMonths.min}-${fineRanges.momentumMonths.max}，步长${fineRanges.momentumMonths.step}`);
  console.log(`  最低动量收益率: ${(fineRanges.minMomentumReturn.min * 100).toFixed(0)}%到${(fineRanges.minMomentumReturn.max * 100).toFixed(0)}%，步长${(fineRanges.minMomentumReturn.step * 100).toFixed(0)}%`);
  
  const fineCombinations = generateCombinations(fineRanges);
  const fineResults = await runTests(fineCombinations, '阶段2：细粒度搜索');
  
  // 保存阶段2结果
  fs.writeFileSync(
    '/Users/huang/CascadeProjects/fund_replication/optimization_fine_results.json',
    JSON.stringify(fineResults, null, 2)
  );
  
  // 合并所有结果
  const allResults = [...coarseResults, ...fineResults];
  const validResults = allResults.filter(r => r.success && r.sharpeRatio > 0);
  validResults.sort((a, b) => b.sharpeRatio - a.sharpeRatio);
  
  // 生成最终报告
  generateReport(validResults, bestCoarse);
}

// 生成优化报告
function generateReport(validResults, bestCoarse) {
  console.log('\n' + '='.repeat(80));
  console.log('📊 最终优化结果');
  console.log('='.repeat(80));
  
  // Top 10 最佳配置
  console.log('\n🏆 Top 10 最佳配置:');
  console.log('-'.repeat(90));
  console.log('排名  波动窗口  动量期间  最低动量    夏普比率  年化收益  最大回撤  年化波动');
  console.log('-'.repeat(90));
  
  validResults.slice(0, 10).forEach((r, i) => {
    console.log(
      `${(i + 1).toString().padStart(4)}  ` +
      `${r.volatilityWindow.toString().padStart(8)}  ` +
      `${r.momentumMonths.toString().padStart(8)}  ` +
      `${((r.minMomentumReturn * 100).toFixed(0) + '%').padStart(10)}  ` +
      `${r.sharpeRatio.toFixed(3).padStart(11)}  ` +
      `${((r.annualizedReturn * 100).toFixed(2) + '%').padStart(8)}  ` +
      `${((r.maxDrawdown * 100).toFixed(2) + '%').padStart(8)}  ` +
      `${((r.volatility * 100).toFixed(2) + '%').padStart(8)}`
    );
  });
  
  // 最优配置详细信息
  const best = validResults[0];
  console.log('\n' + '='.repeat(80));
  console.log('🎯 最优配置详细信息');
  console.log('='.repeat(80));
  console.log(`\n参数配置:`);
  console.log(`  波动率窗口: ${best.volatilityWindow} 个月`);
  console.log(`  动量期间: ${best.momentumMonths} 个月`);
  console.log(`  最低动量收益率: ${(best.minMomentumReturn * 100).toFixed(0)}%`);
  console.log(`  EWMA衰减: 0.94`);
  console.log(`  调仓频率: 年度`);
  console.log(`  最大权重: 10%`);
  console.log(`\n风险收益指标:`);
  console.log(`  夏普比率: ${best.sharpeRatio.toFixed(3)}`);
  console.log(`  年化收益率: ${(best.annualizedReturn * 100).toFixed(2)}%`);
  console.log(`  累计收益率: ${(best.totalReturn * 100).toFixed(2)}%`);
  console.log(`  最大回撤: ${(best.maxDrawdown * 100).toFixed(2)}%`);
  console.log(`  年化波动率: ${(best.volatility * 100).toFixed(2)}%`);
  
  // 与粗搜索最优点的对比
  if (best.sharpeRatio > bestCoarse.sharpeRatio) {
    const improvement = ((best.sharpeRatio - bestCoarse.sharpeRatio) / bestCoarse.sharpeRatio * 100).toFixed(2);
    console.log(`\n💡 细粒度搜索改进: 夏普比率提升 ${improvement}%`);
  }
  
  // 参数敏感性分析
  console.log('\n' + '='.repeat(80));
  console.log('📈 参数敏感性分析');
  console.log('='.repeat(80));
  
  const volatilityWindowStats = analyzeParameter(validResults, 'volatilityWindow');
  console.log('\n波动率窗口:');
  console.log(`  最佳值: ${volatilityWindowStats.best.value} 个月 (平均夏普: ${volatilityWindowStats.best.avgSharpe.toFixed(3)})`);
  console.log(`  范围: ${volatilityWindowStats.min.toFixed(3)} - ${volatilityWindowStats.max.toFixed(3)}`);
  
  const momentumMonthsStats = analyzeParameter(validResults, 'momentumMonths');
  console.log('\n动量期间:');
  console.log(`  最佳值: ${momentumMonthsStats.best.value} 个月 (平均夏普: ${momentumMonthsStats.best.avgSharpe.toFixed(3)})`);
  console.log(`  范围: ${momentumMonthsStats.min.toFixed(3)} - ${momentumMonthsStats.max.toFixed(3)}`);
  
  const minMomentumReturnStats = analyzeParameter(validResults, 'minMomentumReturn');
  console.log('\n最低动量收益率:');
  console.log(`  最佳值: ${(minMomentumReturnStats.best.value * 100).toFixed(0)}% (平均夏普: ${minMomentumReturnStats.best.avgSharpe.toFixed(3)})`);
  console.log(`  范围: ${minMomentumReturnStats.min.toFixed(3)} - ${minMomentumReturnStats.max.toFixed(3)}`);
  
  // 保存完整报告
  const report = {
    testDate: new Date().toISOString(),
    totalTests: validResults.length,
    coarseSearchBest: bestCoarse,
    finalBest: best,
    top10: validResults.slice(0, 10),
    parameterSensitivity: {
      volatilityWindow: volatilityWindowStats,
      momentumMonths: momentumMonthsStats,
      minMomentumReturn: minMomentumReturnStats
    },
    allResults: validResults
  };
  
  fs.writeFileSync(
    '/Users/huang/CascadeProjects/fund_replication/optimization_report.json',
    JSON.stringify(report, null, 2)
  );
  
  console.log('\n💾 完整报告已保存到: optimization_report.json');
  console.log('\n' + '='.repeat(80));
  console.log('✅ 优化测试完成');
  console.log('='.repeat(80));
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
    maxSharpe: Math.max(...sharpes),
    minSharpe: Math.min(...sharpes),
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

// 运行优化
optimizeSharpeRatio().catch(console.error);
