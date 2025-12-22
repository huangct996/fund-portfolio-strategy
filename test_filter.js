// 测试 filter 逻辑
const results = [
  { rebalanceDate: '20201231', indexReturn: 0.0673, isYearlyRebalance: true },
  { rebalanceDate: '20210331', indexReturn: 0.0425, isYearlyRebalance: false },
  { rebalanceDate: '20210701', indexReturn: 0.0724, isYearlyRebalance: false },
  { rebalanceDate: '20211001', indexReturn: -0.0088, isYearlyRebalance: false },
  { rebalanceDate: '20211231', indexReturn: 0.0342, isYearlyRebalance: true },
  { rebalanceDate: '20220331', indexReturn: 0.0123, isYearlyRebalance: false },
];

console.log('总调仓期数:', results.length);

const yearlyResults = results.filter(r => r.isYearlyRebalance);
console.log('年度调仓期数:', yearlyResults.length);
console.log('年度调仓期:', yearlyResults.map(r => r.rebalanceDate));

const indexReturns = yearlyResults.map(r => r.indexReturn);
console.log('年度收益率数量:', indexReturns.length);
console.log('年度收益率:', indexReturns);

// 这是正确的逻辑
console.log('\n✅ 正确：indexReturns.length =', indexReturns.length);
console.log('✅ 正确：yearlyResults.length =', yearlyResults.length);
