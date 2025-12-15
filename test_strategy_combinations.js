const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 测试配置
const BASE_URL = 'http://localhost:3001';
const START_DATE = '20181130';
const END_DATE = '20251215';
const WEIGHT_STEP = 0.05;
const QUALITY_FACTOR_TYPES = ['pe_pb', 'pe', 'pb', 'roe'];
const MAX_WEIGHTS = [0.05, 0.10];

// 生成所有有效的权重组合（总和为1）
function generateWeightCombinations() {
  const combinations = [];
  
  // 遍历所有可能的市值权重
  for (let mv = 0; mv <= 1; mv += WEIGHT_STEP) {
    // 遍历所有可能的股息率权重
    for (let dv = 0; dv <= 1 - mv; dv += WEIGHT_STEP) {
      // 计算质量因子权重（确保总和为1）
      const quality = 1 - mv - dv;
      
      // 由于浮点数精度问题，检查是否接近有效值
      if (Math.abs(quality - Math.round(quality / WEIGHT_STEP) * WEIGHT_STEP) < 0.001 && quality >= 0) {
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
    markdown += `### 最高年化收益率\n`;
    markdown += `- 参数: 市值${bestReturn.mvWeight.toFixed(2)}, 股息率${bestReturn.dvWeight.toFixed(2)}, 质量因子${bestReturn.qualityWeight.toFixed(2)}, 类型${bestReturn.qualityFactorType}, 最大权重${(bestReturn.maxWeight * 100).toFixed(0)}%\n`;
    markdown += `- 年化收益率: ${(bestReturn.customAnnualReturn * 100).toFixed(2)}%\n`;
    markdown += `- 夏普比率: ${bestReturn.customSharpe.toFixed(4)}\n\n`;
    
    // 最高夏普比率
    const bestSharpe = successResults.reduce((max, r) => 
      r.customSharpe > max.customSharpe ? r : max
    );
    markdown += `### 最高夏普比率\n`;
    markdown += `- 参数: 市值${bestSharpe.mvWeight.toFixed(2)}, 股息率${bestSharpe.dvWeight.toFixed(2)}, 质量因子${bestSharpe.qualityWeight.toFixed(2)}, 类型${bestSharpe.qualityFactorType}, 最大权重${(bestSharpe.maxWeight * 100).toFixed(0)}%\n`;
    markdown += `- 夏普比率: ${bestSharpe.customSharpe.toFixed(4)}\n`;
    markdown += `- 年化收益率: ${(bestSharpe.customAnnualReturn * 100).toFixed(2)}%\n\n`;
    
    // 最小回撤
    const bestDrawdown = successResults.reduce((min, r) => 
      r.customMaxDrawdown < min.customMaxDrawdown ? r : min
    );
    markdown += `### 最小最大回撤\n`;
    markdown += `- 参数: 市值${bestDrawdown.mvWeight.toFixed(2)}, 股息率${bestDrawdown.dvWeight.toFixed(2)}, 质量因子${bestDrawdown.qualityWeight.toFixed(2)}, 类型${bestDrawdown.qualityFactorType}, 最大权重${(bestDrawdown.maxWeight * 100).toFixed(0)}%\n`;
    markdown += `- 最大回撤: ${(bestDrawdown.customMaxDrawdown * 100).toFixed(2)}%\n`;
    markdown += `- 年化收益率: ${(bestDrawdown.customAnnualReturn * 100).toFixed(2)}%\n\n`;
  }
  
  return markdown;
}

// 主函数
async function main() {
  console.log('开始生成测试用例...');
  const testCases = generateTestCases();
  console.log(`总共生成 ${testCases.length} 个测试用例\n`);
  
  const results = [];
  let completed = 0;
  
  console.log('开始执行回测...');
  for (const testCase of testCases) {
    console.log(`\n[${completed + 1}/${testCases.length}] 测试参数:`);
    console.log(`  市值权重: ${testCase.mvWeight}, 股息率权重: ${testCase.dvWeight}, 质量因子权重: ${testCase.qualityWeight}`);
    console.log(`  质量因子类型: ${testCase.qualityFactorType}, 最大权重: ${(testCase.maxWeight * 100).toFixed(0)}%`);
    
    const result = await runBacktest(testCase);
    const metrics = extractMetrics(result, testCase);
    results.push(metrics);
    
    if (metrics.success) {
      console.log(`  ✅ 成功 - 年化收益率: ${(metrics.customAnnualReturn * 100).toFixed(2)}%, 夏普比率: ${metrics.customSharpe.toFixed(4)}`);
    } else {
      console.log(`  ❌ 失败 - ${metrics.error}`);
    }
    
    completed++;
    
    // 每10个测试保存一次中间结果
    if (completed % 10 === 0) {
      const markdown = generateMarkdownTable(results);
      const outputPath = path.join(__dirname, 'docs', 'strategy_test_results_temp.md');
      fs.writeFileSync(outputPath, markdown, 'utf-8');
      console.log(`\n已保存中间结果到 ${outputPath}`);
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
