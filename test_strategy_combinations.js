const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 测试配置
const BASE_URL = 'http://localhost:3001';
const START_DATE = '20181130';
const END_DATE = '20251215';
const WEIGHT_STEP = 0.05;
const QUALITY_FACTOR_TYPES = ['pe_pb', 'pe', 'pb', 'roe'];
const MAX_WEIGHTS = [0.05, 0.06, 0.07, 0.08, 0.09, 0.10];  // 5%-10%，步长1%
const CONCURRENT_LIMIT = 20;  // 并发数量限制（已设置为20）

// 生成所有有效的权重组合（总和为1）
function generateWeightCombinations() {
  const combinations = [];
  
  // 市值权重范围：0.5-1.0
  for (let mv = 0.5; mv <= 1.0; mv += WEIGHT_STEP) {
    // 股息率权重范围：0-0.5
    for (let dv = 0; dv <= 0.5; dv += WEIGHT_STEP) {
      // 计算质量因子权重（确保总和为1）
      const quality = 1 - mv - dv;
      
      // 质量因子权重必须在0-0.5范围内
      if (quality >= 0 && quality <= 0.5 && Math.abs(quality - Math.round(quality / WEIGHT_STEP) * WEIGHT_STEP) < 0.001) {
        combinations.push({
          mvWeight: parseFloat(mv.toFixed(2)),
          dvWeight: parseFloat(dv.toFixed(2)),
          qualityWeight: parseFloat(quality.toFixed(2))
        });
      }
    }
  }
  
  return combinations;
}

// 生成所有测试用例
function generateTestCases() {
  const weightCombinations = generateWeightCombinations();
  const testCases = [];
  
  for (const weights of weightCombinations) {
    for (const maxWeight of MAX_WEIGHTS) {
      for (const qualityFactorType of QUALITY_FACTOR_TYPES) {
        testCases.push({
          ...weights,
          maxWeight,
          qualityFactorType
        });
      }
    }
  }
  
  return testCases;
}

// 调用API进行回测
async function runBacktest(testCase) {
  const url = `${BASE_URL}/api/index-returns`;
  const params = {
    startDate: START_DATE,
    endDate: END_DATE,
    useCompositeScore: true,
    mvWeight: testCase.mvWeight,
    dvWeight: testCase.dvWeight,
    qualityWeight: testCase.qualityWeight,
    qualityFactorType: testCase.qualityFactorType,
    maxWeight: testCase.maxWeight
  };
  
  try {
    const response = await axios.get(url, { params, timeout: 300000 }); // 5分钟超时
    return response.data;
  } catch (error) {
    console.error(`测试失败: ${JSON.stringify(testCase)}`);
    console.error(`错误: ${error.message}`);
    return null;
  }
}

// 提取关键指标
function extractMetrics(result, testCase) {
  if (!result || !result.data) {
    return {
      ...testCase,
      success: false,
      error: '无数据返回'
    };
  }
  
  const { customRisk, indexRisk, trackingError } = result.data;
  
  return {
    ...testCase,
    success: true,
    // 自定义策略指标
    customAnnualReturn: customRisk?.annualizedReturn || null,
    customVolatility: customRisk?.volatility || null,
    customSharpe: customRisk?.sharpeRatio || null,
    customMaxDrawdown: customRisk?.maxDrawdown || null,
    // 指数指标
    indexAnnualReturn: indexRisk?.annualizedReturn || null,
    indexVolatility: indexRisk?.volatility || null,
    indexSharpe: indexRisk?.sharpeRatio || null,
    indexMaxDrawdown: indexRisk?.maxDrawdown || null,
    // 跟踪误差
    trackingError: trackingError?.trackingError || null,
    avgDifference: trackingError?.avgDifference || null,
    // 超额收益
    excessReturn: customRisk?.annualizedReturn && indexRisk?.annualizedReturn 
      ? customRisk.annualizedReturn - indexRisk.annualizedReturn 
      : null
  };
}

// 生成Markdown表格
function generateMarkdownTable(results) {
  let markdown = '# 策略参数组合测试报告\n\n';
  markdown += `测试时间: ${new Date().toLocaleString('zh-CN')}\n`;
  markdown += `测试期间: ${START_DATE} - ${END_DATE}\n`;
  markdown += `总测试用例数: ${results.length}\n`;
  markdown += `成功用例数: ${results.filter(r => r.success).length}\n\n`;
  
  markdown += '## 测试结果汇总\n\n';
  markdown += '| 序号 | 市值权重 | 股息率权重 | 质量因子权重 | 质量因子类型 | 最大权重 | 年化收益率 | 波动率 | 夏普比率 | 最大回撤 | 超额收益 | 跟踪误差 | 状态 |\n';
  markdown += '|------|----------|------------|--------------|--------------|----------|------------|--------|----------|----------|----------|----------|------|\n';
  
  results.forEach((result, index) => {
    if (result.success) {
      markdown += `| ${index + 1} `;
      markdown += `| ${result.mvWeight.toFixed(2)} `;
      markdown += `| ${result.dvWeight.toFixed(2)} `;
      markdown += `| ${result.qualityWeight.toFixed(2)} `;
      markdown += `| ${result.qualityFactorType} `;
      markdown += `| ${(result.maxWeight * 100).toFixed(0)}% `;
      markdown += `| ${(result.customAnnualReturn * 100).toFixed(2)}% `;
      markdown += `| ${(result.customVolatility * 100).toFixed(2)}% `;
      markdown += `| ${result.customSharpe.toFixed(4)} `;
      markdown += `| ${(result.customMaxDrawdown * 100).toFixed(2)}% `;
      markdown += `| ${(result.excessReturn * 100).toFixed(2)}% `;
      markdown += `| ${(result.trackingError * 100).toFixed(2)}% `;
      markdown += `| ✅ |\n`;
    } else {
      markdown += `| ${index + 1} `;
      markdown += `| ${result.mvWeight.toFixed(2)} `;
      markdown += `| ${result.dvWeight.toFixed(2)} `;
      markdown += `| ${result.qualityWeight.toFixed(2)} `;
      markdown += `| ${result.qualityFactorType} `;
      markdown += `| ${(result.maxWeight * 100).toFixed(0)}% `;
      markdown += `| - | - | - | - | - | - `;
      markdown += `| ❌ ${result.error} |\n`;
    }
  });
  
  // 添加最佳策略分析
  const successResults = results.filter(r => r.success && r.customAnnualReturn !== null);
  if (successResults.length > 0) {
    markdown += '\n## 最佳策略分析\n\n';
    
    // 最高年化收益率
    const bestReturn = successResults.reduce((max, r) => 
      r.customAnnualReturn > max.customAnnualReturn ? r : max
    );
    markdown += `### 🏆 最高年化收益率\n`;
    markdown += `- **参数组合**: 市值权重${bestReturn.mvWeight.toFixed(2)}, 股息率权重${bestReturn.dvWeight.toFixed(2)}, 质量因子权重${bestReturn.qualityWeight.toFixed(2)}\n`;
    markdown += `- **质量因子类型**: ${bestReturn.qualityFactorType}\n`;
    markdown += `- **单股最大权重**: ${(bestReturn.maxWeight * 100).toFixed(0)}%\n`;
    markdown += `- **年化收益率**: ${(bestReturn.customAnnualReturn * 100).toFixed(2)}%\n`;
    markdown += `- **年化波动率**: ${(bestReturn.customVolatility * 100).toFixed(2)}%\n`;
    markdown += `- **夏普比率**: ${bestReturn.customSharpe.toFixed(4)}\n`;
    markdown += `- **最大回撤**: ${(bestReturn.customMaxDrawdown * 100).toFixed(2)}%\n`;
    markdown += `- **超额收益**: ${(bestReturn.excessReturn * 100).toFixed(2)}%\n`;
    markdown += `- **跟踪误差**: ${(bestReturn.trackingError * 100).toFixed(2)}%\n\n`;
    
    // 最高夏普比率
    const bestSharpe = successResults.reduce((max, r) => 
      r.customSharpe > max.customSharpe ? r : max
    );
    markdown += `### 📈 最高夏普比率\n`;
    markdown += `- **参数组合**: 市值权重${bestSharpe.mvWeight.toFixed(2)}, 股息率权重${bestSharpe.dvWeight.toFixed(2)}, 质量因子权重${bestSharpe.qualityWeight.toFixed(2)}\n`;
    markdown += `- **质量因子类型**: ${bestSharpe.qualityFactorType}\n`;
    markdown += `- **单股最大权重**: ${(bestSharpe.maxWeight * 100).toFixed(0)}%\n`;
    markdown += `- **夏普比率**: ${bestSharpe.customSharpe.toFixed(4)}\n`;
    markdown += `- **年化收益率**: ${(bestSharpe.customAnnualReturn * 100).toFixed(2)}%\n`;
    markdown += `- **年化波动率**: ${(bestSharpe.customVolatility * 100).toFixed(2)}%\n`;
    markdown += `- **最大回撤**: ${(bestSharpe.customMaxDrawdown * 100).toFixed(2)}%\n`;
    markdown += `- **超额收益**: ${(bestSharpe.excessReturn * 100).toFixed(2)}%\n`;
    markdown += `- **跟踪误差**: ${(bestSharpe.trackingError * 100).toFixed(2)}%\n\n`;
    
    // 最小回撤
    const bestDrawdown = successResults.reduce((min, r) => 
      r.customMaxDrawdown < min.customMaxDrawdown ? r : min
    );
    markdown += `### 🛡️ 最小最大回撤\n`;
    markdown += `- **参数组合**: 市值权重${bestDrawdown.mvWeight.toFixed(2)}, 股息率权重${bestDrawdown.dvWeight.toFixed(2)}, 质量因子权重${bestDrawdown.qualityWeight.toFixed(2)}\n`;
    markdown += `- **质量因子类型**: ${bestDrawdown.qualityFactorType}\n`;
    markdown += `- **单股最大权重**: ${(bestDrawdown.maxWeight * 100).toFixed(0)}%\n`;
    markdown += `- **最大回撤**: ${(bestDrawdown.customMaxDrawdown * 100).toFixed(2)}%\n`;
    markdown += `- **年化收益率**: ${(bestDrawdown.customAnnualReturn * 100).toFixed(2)}%\n`;
    markdown += `- **年化波动率**: ${(bestDrawdown.customVolatility * 100).toFixed(2)}%\n`;
    markdown += `- **夏普比率**: ${bestDrawdown.customSharpe.toFixed(4)}\n`;
    markdown += `- **超额收益**: ${(bestDrawdown.excessReturn * 100).toFixed(2)}%\n`;
    markdown += `- **跟踪误差**: ${(bestDrawdown.trackingError * 100).toFixed(2)}%\n\n`;
    
    // 最高超额收益
    const bestExcess = successResults.reduce((max, r) => 
      r.excessReturn > max.excessReturn ? r : max
    );
    markdown += `### 💰 最高超额收益\n`;
    markdown += `- **参数组合**: 市值权重${bestExcess.mvWeight.toFixed(2)}, 股息率权重${bestExcess.dvWeight.toFixed(2)}, 质量因子权重${bestExcess.qualityWeight.toFixed(2)}\n`;
    markdown += `- **质量因子类型**: ${bestExcess.qualityFactorType}\n`;
    markdown += `- **单股最大权重**: ${(bestExcess.maxWeight * 100).toFixed(0)}%\n`;
    markdown += `- **超额收益**: ${(bestExcess.excessReturn * 100).toFixed(2)}%\n`;
    markdown += `- **年化收益率**: ${(bestExcess.customAnnualReturn * 100).toFixed(2)}%\n`;
    markdown += `- **夏普比率**: ${bestExcess.customSharpe.toFixed(4)}\n`;
    markdown += `- **最大回撤**: ${(bestExcess.customMaxDrawdown * 100).toFixed(2)}%\n`;
    markdown += `- **跟踪误差**: ${(bestExcess.trackingError * 100).toFixed(2)}%\n\n`;
    
    // 最低跟踪误差
    const bestTracking = successResults.reduce((min, r) => 
      r.trackingError < min.trackingError ? r : min
    );
    markdown += `### 🎯 最低跟踪误差\n`;
    markdown += `- **参数组合**: 市值权重${bestTracking.mvWeight.toFixed(2)}, 股息率权重${bestTracking.dvWeight.toFixed(2)}, 质量因子权重${bestTracking.qualityWeight.toFixed(2)}\n`;
    markdown += `- **质量因子类型**: ${bestTracking.qualityFactorType}\n`;
    markdown += `- **单股最大权重**: ${(bestTracking.maxWeight * 100).toFixed(0)}%\n`;
    markdown += `- **跟踪误差**: ${(bestTracking.trackingError * 100).toFixed(2)}%\n`;
    markdown += `- **年化收益率**: ${(bestTracking.customAnnualReturn * 100).toFixed(2)}%\n`;
    markdown += `- **夏普比率**: ${bestTracking.customSharpe.toFixed(4)}\n`;
    markdown += `- **最大回撤**: ${(bestTracking.customMaxDrawdown * 100).toFixed(2)}%\n`;
    markdown += `- **超额收益**: ${(bestTracking.excessReturn * 100).toFixed(2)}%\n\n`;
    
    // 最低波动率
    const bestVolatility = successResults.reduce((min, r) => 
      r.customVolatility < min.customVolatility ? r : min
    );
    markdown += `### 📊 最低波动率\n`;
    markdown += `- **参数组合**: 市值权重${bestVolatility.mvWeight.toFixed(2)}, 股息率权重${bestVolatility.dvWeight.toFixed(2)}, 质量因子权重${bestVolatility.qualityWeight.toFixed(2)}\n`;
    markdown += `- **质量因子类型**: ${bestVolatility.qualityFactorType}\n`;
    markdown += `- **单股最大权重**: ${(bestVolatility.maxWeight * 100).toFixed(0)}%\n`;
    markdown += `- **年化波动率**: ${(bestVolatility.customVolatility * 100).toFixed(2)}%\n`;
    markdown += `- **年化收益率**: ${(bestVolatility.customAnnualReturn * 100).toFixed(2)}%\n`;
    markdown += `- **夏普比率**: ${bestVolatility.customSharpe.toFixed(4)}\n`;
    markdown += `- **最大回撤**: ${(bestVolatility.customMaxDrawdown * 100).toFixed(2)}%\n`;
    markdown += `- **超额收益**: ${(bestVolatility.excessReturn * 100).toFixed(2)}%\n\n`;
    
    // 统计摘要
    markdown += `## 📋 统计摘要\n\n`;
    markdown += `- **测试用例总数**: ${results.length}\n`;
    markdown += `- **成功用例数**: ${successResults.length}\n`;
    markdown += `- **失败用例数**: ${results.length - successResults.length}\n`;
    markdown += `- **平均年化收益率**: ${(successResults.reduce((sum, r) => sum + r.customAnnualReturn, 0) / successResults.length * 100).toFixed(2)}%\n`;
    markdown += `- **平均夏普比率**: ${(successResults.reduce((sum, r) => sum + r.customSharpe, 0) / successResults.length).toFixed(4)}\n`;
    markdown += `- **平均最大回撤**: ${(successResults.reduce((sum, r) => sum + r.customMaxDrawdown, 0) / successResults.length * 100).toFixed(2)}%\n`;
    markdown += `- **平均超额收益**: ${(successResults.reduce((sum, r) => sum + r.excessReturn, 0) / successResults.length * 100).toFixed(2)}%\n`;
    markdown += `- **平均跟踪误差**: ${(successResults.reduce((sum, r) => sum + r.trackingError, 0) / successResults.length * 100).toFixed(2)}%\n\n`;
  }
  
  return markdown;
}

// 并发控制函数
async function runConcurrent(tasks, limit) {
  const results = [];
  const executing = [];
  
  for (const [index, task] of tasks.entries()) {
    const promise = task().then(result => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });
    
    results.push(promise);
    executing.push(promise);
    
    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }
  
  return Promise.all(results);
}

// 主函数
async function main() {
  console.log('开始生成测试用例...');
  const testCases = generateTestCases();
  console.log(`总共生成 ${testCases.length} 个测试用例`);
  console.log(`并发数量: ${CONCURRENT_LIMIT}\n`);
  
  const results = [];
  let completed = 0;
  const startTime = Date.now();
  
  console.log('开始执行回测（并发模式）...\n');
  
  // 创建所有测试任务
  const tasks = testCases.map((testCase, index) => async () => {
    const result = await runBacktest(testCase);
    const metrics = extractMetrics(result, testCase);
    
    completed++;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const avgTime = (elapsed / completed).toFixed(1);
    const remaining = ((testCases.length - completed) * avgTime / 60).toFixed(1);
    
    console.log(`[${completed}/${testCases.length}] ${testCase.mvWeight}/${testCase.dvWeight}/${testCase.qualityWeight} ${testCase.qualityFactorType} ${(testCase.maxWeight*100).toFixed(0)}% - ${metrics.success ? `✅ ${(metrics.customAnnualReturn*100).toFixed(2)}% SR:${metrics.customSharpe.toFixed(3)}` : '❌'} | 已用${elapsed}s 平均${avgTime}s 剩余${remaining}min`);
    
    return { index, metrics };
  });
  
  // 并发执行所有任务
  const taskResults = await runConcurrent(tasks, CONCURRENT_LIMIT);
  
  // 按原始顺序排序结果
  taskResults.sort((a, b) => a.index - b.index);
  const orderedResults = taskResults.map(r => r.metrics);
  
  // 每5个结果保存一次
  for (let i = 0; i < orderedResults.length; i++) {
    results.push(orderedResults[i]);
    
    if ((i + 1) % 5 === 0 || i === orderedResults.length - 1) {
      const markdown = generateMarkdownTable(results);
      const outputPath = path.join(__dirname, 'docs', 'strategy_test_results.md');
      fs.writeFileSync(outputPath, markdown, 'utf-8');
      
      const jsonPath = path.join(__dirname, 'docs', 'strategy_test_results.json');
      fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8');
      
      if ((i + 1) % 20 === 0 || i === orderedResults.length - 1) {
        console.log(`\n✅ 已保存测试结果 (${i + 1}/${orderedResults.length})\n`);
      }
    }
  }
  
  // 生成最终报告
  console.log('\n\n生成最终报告...');
  const markdown = generateMarkdownTable(results);
  const outputPath = path.join(__dirname, 'docs', 'strategy_test_results.md');
  fs.writeFileSync(outputPath, markdown, 'utf-8');
  
  // 同时保存JSON格式
  const jsonPath = path.join(__dirname, 'docs', 'strategy_test_results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8');
  
  console.log(`\n✅ 测试完成！`);
  console.log(`Markdown报告: ${outputPath}`);
  console.log(`JSON数据: ${jsonPath}`);
  console.log(`\n总测试用例: ${testCases.length}`);
  console.log(`成功: ${results.filter(r => r.success).length}`);
  console.log(`失败: ${results.filter(r => !r.success).length}`);
}

// 运行测试
main().catch(error => {
  console.error('测试执行失败:', error);
  process.exit(1);
});
