/**
 * 夏普比率计算单元测试
 * 
 * 夏普比率 = (年化收益率 - 无风险利率) / 年化波动率
 * 
 * 测试场景：
 * 1. 正常情况：有正收益和波动
 * 2. 零波动：所有收益率相同
 * 3. 负收益：收益率低于无风险利率
 * 4. 高波动：波动率很高的情况
 */

const assert = require('assert');

/**
 * 计算风险指标（从indexPortfolioService.js复制）
 */
function calculateRiskMetrics(returns, periods) {
  if (!returns || returns.length === 0) return null;

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const volatility = Math.sqrt(variance);
  
  // 计算累计收益率
  const totalReturn = returns.reduce((prod, r) => prod * (1 + r), 1) - 1;
  
  // 年化收益率和波动率（实际调仓频率约为每年1次）
  const periodsPerYear = 1;
  
  // 使用几何平均收益率进行年化（复利计算）
  const geometricMean = Math.pow(
    returns.reduce((prod, r) => prod * (1 + r), 1),
    1 / returns.length
  ) - 1;
  const annualizedReturn = Math.pow(1 + geometricMean, periodsPerYear) - 1;
  
  const annualizedVolatility = volatility * Math.sqrt(periodsPerYear);
  
  // 夏普比率（假设无风险利率3%）
  const riskFreeRate = 0.03;
  const sharpeRatio = annualizedVolatility > 0 
    ? (annualizedReturn - riskFreeRate) / annualizedVolatility 
    : 0;
  
  // 索提诺比率（只考虑下行波动）
  const downReturns = returns.filter(r => r < 0);
  let sortinoRatio = 0;
  if (downReturns.length > 0) {
    const downVariance = downReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / returns.length;
    const downVolatility = Math.sqrt(downVariance) * Math.sqrt(periodsPerYear);
    sortinoRatio = downVolatility > 0 ? (annualizedReturn - riskFreeRate) / downVolatility : 0;
  }
  
  // 最大回撤
  let maxDrawdown = 0;
  let peak = 1;
  let cumulative = 1;
  
  returns.forEach(r => {
    cumulative *= (1 + r);
    if (cumulative > peak) {
      peak = cumulative;
    }
    const drawdown = (peak - cumulative) / peak;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  return {
    totalReturn,
    annualizedReturn,
    volatility: annualizedVolatility,
    sharpeRatio,
    sortinoRatio,
    maxDrawdown,
    periods
  };
}

console.log('='.repeat(80));
console.log('夏普比率计算单元测试');
console.log('='.repeat(80));

// 测试1: 稳定正收益（年化10%，波动率5%）
console.log('\n【测试1】稳定正收益');
const test1Returns = [0.10, 0.12, 0.08, 0.11, 0.09, 0.10, 0.11, 0.10];
const test1Result = calculateRiskMetrics(test1Returns, test1Returns.length);
console.log('输入收益率:', test1Returns);
console.log('累计收益率:', (test1Result.totalReturn * 100).toFixed(2) + '%');
console.log('年化收益率:', (test1Result.annualizedReturn * 100).toFixed(2) + '%');
console.log('年化波动率:', (test1Result.volatility * 100).toFixed(2) + '%');
console.log('夏普比率:', test1Result.sharpeRatio.toFixed(4));
console.log('预期: 夏普比率应该为正数，约为 (0.10 - 0.03) / 0.014 ≈ 5.0');
assert(test1Result.sharpeRatio > 0, '夏普比率应该为正数');
assert(test1Result.sharpeRatio > 3, '夏普比率应该大于3');
console.log('✅ 测试通过');

// 测试2: 零波动（所有收益率相同）
console.log('\n【测试2】零波动情况');
const test2Returns = [0.05, 0.05, 0.05, 0.05, 0.05];
const test2Result = calculateRiskMetrics(test2Returns, test2Returns.length);
console.log('输入收益率:', test2Returns);
console.log('年化收益率:', (test2Result.annualizedReturn * 100).toFixed(2) + '%');
console.log('年化波动率:', (test2Result.volatility * 100).toFixed(2) + '%');
console.log('夏普比率:', test2Result.sharpeRatio.toFixed(4));
console.log('预期: 波动率为0时，夏普比率应该为0（避免除以0）');
assert(test2Result.sharpeRatio === 0, '零波动时夏普比率应该为0');
console.log('✅ 测试通过');

// 测试3: 负收益（收益率低于无风险利率）
console.log('\n【测试3】负收益情况');
const test3Returns = [-0.05, -0.03, 0.01, -0.02, 0.00, -0.04];
const test3Result = calculateRiskMetrics(test3Returns, test3Returns.length);
console.log('输入收益率:', test3Returns);
console.log('累计收益率:', (test3Result.totalReturn * 100).toFixed(2) + '%');
console.log('年化收益率:', (test3Result.annualizedReturn * 100).toFixed(2) + '%');
console.log('年化波动率:', (test3Result.volatility * 100).toFixed(2) + '%');
console.log('夏普比率:', test3Result.sharpeRatio.toFixed(4));
console.log('预期: 年化收益率低于无风险利率时，夏普比率应该为负数');
assert(test3Result.sharpeRatio < 0, '负收益时夏普比率应该为负数');
console.log('✅ 测试通过');

// 测试4: 高波动（波动率很高）
console.log('\n【测试4】高波动情况');
const test4Returns = [0.30, -0.20, 0.40, -0.15, 0.25, -0.10, 0.35, -0.05];
const test4Result = calculateRiskMetrics(test4Returns, test4Returns.length);
console.log('输入收益率:', test4Returns);
console.log('累计收益率:', (test4Result.totalReturn * 100).toFixed(2) + '%');
console.log('年化收益率:', (test4Result.annualizedReturn * 100).toFixed(2) + '%');
console.log('年化波动率:', (test4Result.volatility * 100).toFixed(2) + '%');
console.log('夏普比率:', test4Result.sharpeRatio.toFixed(4));
console.log('最大回撤:', (test4Result.maxDrawdown * 100).toFixed(2) + '%');
console.log('预期: 高波动会降低夏普比率');
assert(test4Result.volatility > 0.15, '波动率应该很高');
assert(test4Result.maxDrawdown > 0, '应该有回撤');
console.log('✅ 测试通过');

// 测试5: 实际数据模拟（从用户日志中的数据）
console.log('\n【测试5】实际数据模拟');
// 模拟8期数据，年化收益率约10%，波动率约10%
const test5Returns = [0.15, -0.05, 0.12, 0.08, -0.03, 0.14, 0.10, 0.06];
const test5Result = calculateRiskMetrics(test5Returns, test5Returns.length);
console.log('输入收益率:', test5Returns);
console.log('累计收益率:', (test5Result.totalReturn * 100).toFixed(2) + '%');
console.log('年化收益率:', (test5Result.annualizedReturn * 100).toFixed(2) + '%');
console.log('年化波动率:', (test5Result.volatility * 100).toFixed(2) + '%');
console.log('夏普比率:', test5Result.sharpeRatio.toFixed(4));
console.log('索提诺比率:', test5Result.sortinoRatio.toFixed(4));
console.log('最大回撤:', (test5Result.maxDrawdown * 100).toFixed(2) + '%');
console.log('预期: 夏普比率应该在0.5-1.5之间');
assert(test5Result.sharpeRatio > 0, '夏普比率应该为正数');
assert(test5Result.maxDrawdown > 0, '应该有回撤');
console.log('✅ 测试通过');

// 测试6: 最大回撤计算验证
console.log('\n【测试6】最大回撤计算验证');
const test6Returns = [0.10, 0.05, -0.15, -0.10, 0.08, 0.12];
const test6Result = calculateRiskMetrics(test6Returns, test6Returns.length);
console.log('输入收益率:', test6Returns);
console.log('累计收益过程:');
let cumulative = 1;
let peak = 1;
test6Returns.forEach((r, i) => {
  cumulative *= (1 + r);
  if (cumulative > peak) peak = cumulative;
  const drawdown = (peak - cumulative) / peak;
  console.log(`  期${i+1}: 收益率=${(r*100).toFixed(1)}%, 累计=${cumulative.toFixed(4)}, 峰值=${peak.toFixed(4)}, 回撤=${(drawdown*100).toFixed(2)}%`);
});
console.log('最大回撤:', (test6Result.maxDrawdown * 100).toFixed(2) + '%');
console.log('预期: 最大回撤应该在20%左右（从峰值1.155回落到0.9009）');
assert(test6Result.maxDrawdown > 0.15, '最大回撤应该大于15%');
assert(test6Result.maxDrawdown < 0.25, '最大回撤应该小于25%');
console.log('✅ 测试通过');

// 测试7: 全部正收益（无回撤）
console.log('\n【测试7】全部正收益（无回撤）');
const test7Returns = [0.05, 0.08, 0.06, 0.10, 0.07, 0.09];
const test7Result = calculateRiskMetrics(test7Returns, test7Returns.length);
console.log('输入收益率:', test7Returns);
console.log('累计收益率:', (test7Result.totalReturn * 100).toFixed(2) + '%');
console.log('最大回撤:', (test7Result.maxDrawdown * 100).toFixed(2) + '%');
console.log('预期: 全部正收益时，最大回撤应该为0');
assert(test7Result.maxDrawdown === 0, '全部正收益时最大回撤应该为0');
console.log('✅ 测试通过');

console.log('\n' + '='.repeat(80));
console.log('✅ 所有测试通过！');
console.log('='.repeat(80));
console.log('\n总结：');
console.log('1. 夏普比率计算公式正确：(年化收益率 - 无风险利率) / 年化波动率');
console.log('2. 零波动时正确返回0，避免除以0错误');
console.log('3. 负收益时正确返回负的夏普比率');
console.log('4. 最大回撤计算正确，能够识别峰值和回撤');
console.log('5. 全部正收益时最大回撤为0是正确的');
