// 测试配置传递
const testConfig = {
  startDate: '20200710',
  endDate: '20250710',
  useRiskParity: true,
  riskParityParams: {
    volatilityWindow: 6,
    ewmaDecay: 0.91,
    rebalanceFrequency: 'quarterly',
    enableTradingCost: false,
    tradingCostRate: 0,
    riskFreeRate: 0.02,
    useQualityTilt: true,
    useCovariance: false,
    hybridRatio: 0.3
  },
  maxWeight: 0.13
};

console.log('测试配置:');
console.log(JSON.stringify(testConfig, null, 2));
console.log('\nuseRiskParity:', testConfig.useRiskParity);
console.log('riskParityParams存在:', !!testConfig.riskParityParams);
console.log('useQualityTilt:', testConfig.riskParityParams?.useQualityTilt);
console.log('hybridRatio:', testConfig.riskParityParams?.hybridRatio);
