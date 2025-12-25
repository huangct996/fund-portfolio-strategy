/**
 * 分析重复数据对夏普比率的影响
 */

// 修改前的数据（有重复）
const before = {
  tradingDays: 1344,
  totalReturn: 1.0141, // 假设重复导致收益被放大
  volatility: 0.1898
};

// 修改后的数据（正确）
const after = {
  tradingDays: 1218,
  totalReturn: 1.3654,
  volatility: 0.1598
};

const riskFreeRate = 0.02;

// 计算年化收益率
function annualizedReturn(totalReturn, tradingDays) {
  const years = tradingDays / 244; // 假设每年244个交易日
  return Math.pow(1 + totalReturn, 1 / years) - 1;
}

// 计算夏普比率
function sharpeRatio(annualReturn, volatility, riskFree) {
  return (annualReturn - riskFree) / volatility;
}

console.log('修改前（有重复数据）:');
const beforeAnnual = annualizedReturn(before.totalReturn, before.tradingDays);
const beforeSharpe = sharpeRatio(beforeAnnual, before.volatility, riskFreeRate);
console.log(`  交易日数: ${before.tradingDays}`);
console.log(`  累计收益: ${(before.totalReturn * 100).toFixed(2)}%`);
console.log(`  年化收益: ${(beforeAnnual * 100).toFixed(2)}%`);
console.log(`  年化波动: ${(before.volatility * 100).toFixed(2)}%`);
console.log(`  夏普比率: ${beforeSharpe.toFixed(2)}`);

console.log('\n修改后（正确数据）:');
const afterAnnual = annualizedReturn(after.totalReturn, after.tradingDays);
const afterSharpe = sharpeRatio(afterAnnual, after.volatility, riskFreeRate);
console.log(`  交易日数: ${after.tradingDays}`);
console.log(`  累计收益: ${(after.totalReturn * 100).toFixed(2)}%`);
console.log(`  年化收益: ${(afterAnnual * 100).toFixed(2)}%`);
console.log(`  年化波动: ${(after.volatility * 100).toFixed(2)}%`);
console.log(`  夏普比率: ${afterSharpe.toFixed(2)}`);

console.log('\n差异分析:');
console.log(`  交易日数差异: ${before.tradingDays - after.tradingDays} 天`);
console.log(`  夏普比率变化: ${beforeSharpe.toFixed(2)} -> ${afterSharpe.toFixed(2)}`);
console.log(`  \n结论: 修改前的数据因为重复计算了最后126天的数据，`);
console.log(`  导致交易日数虚高，影响了年化收益率和波动率的计算。`);
console.log(`  修改后的1.05是正确的夏普比率。`);
