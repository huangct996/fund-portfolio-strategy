/**
 * 全面测试所有功能
 * 1. 测试ROE和负债率可选筛选
 * 2. 测试不同参数配置的夏普比率
 * 3. 验证风险平价策略逻辑
 */

const axios = require('axios');

async function testAllFeatures() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 全面功能测试');
  console.log('='.repeat(80) + '\n');

  const testCases = [
    {
      name: '测试1：不启用ROE和负债率筛选',
      params: {
        fundCode: '512890.SH',
        startDate: '20200101',
        endDate: '20241231',
        strategyType: 'riskParity',
        volatilityWindow: 12,
        ewmaDecay: 0.94,
        rebalanceFrequency: 'yearly',
        enableTradingCost: false,
        enableStockFilter: true,
        minROE: 0,           // 不筛选ROE
        maxDebtRatio: 1.0,   // 不筛选负债率
        momentumMonths: 6,
        minMomentumReturn: -0.10,
        filterByQuality: true
      }
    },
    {
      name: '测试2：只启用ROE筛选',
      params: {
        fundCode: '512890.SH',
        startDate: '20200101',
        endDate: '20241231',
        strategyType: 'riskParity',
        volatilityWindow: 12,
        ewmaDecay: 0.94,
        rebalanceFrequency: 'yearly',
        enableTradingCost: false,
        enableStockFilter: true,
        minROE: 0.08,        // 启用ROE筛选
        maxDebtRatio: 1.0,   // 不筛选负债率
        momentumMonths: 6,
        minMomentumReturn: -0.10,
        filterByQuality: true
      }
    },
    {
      name: '测试3：只启用负债率筛选',
      params: {
        fundCode: '512890.SH',
        startDate: '20200101',
        endDate: '20241231',
        strategyType: 'riskParity',
        volatilityWindow: 12,
        ewmaDecay: 0.94,
        rebalanceFrequency: 'yearly',
        enableTradingCost: false,
        enableStockFilter: true,
        minROE: 0,           // 不筛选ROE
        maxDebtRatio: 0.60,  // 启用负债率筛选
        momentumMonths: 6,
        minMomentumReturn: -0.10,
        filterByQuality: true
      }
    },
    {
      name: '测试4：同时启用ROE和负债率筛选',
      params: {
        fundCode: '512890.SH',
        startDate: '20200101',
        endDate: '20241231',
        strategyType: 'riskParity',
        volatilityWindow: 12,
        ewmaDecay: 0.94,
        rebalanceFrequency: 'yearly',
        enableTradingCost: false,
        enableStockFilter: true,
        minROE: 0.08,        // 启用ROE筛选
        maxDebtRatio: 0.60,  // 启用负债率筛选
        momentumMonths: 6,
        minMomentumReturn: -0.10,
        filterByQuality: true
      }
    },
    {
      name: '测试5：推荐配置（最大化夏普比率）',
      params: {
        fundCode: '512890.SH',
        startDate: '20200101',
        endDate: '20241231',
        strategyType: 'riskParity',
        volatilityWindow: 9,
        ewmaDecay: 0.94,
        rebalanceFrequency: 'yearly',
        enableTradingCost: false,
        enableStockFilter: true,
        minROE: 0.08,
        maxDebtRatio: 0.60,
        momentumMonths: 6,
        minMomentumReturn: -0.10,
        filterByQuality: true
      }
    }
  ];

  const results = [];

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`${testCase.name}`);
    console.log('='.repeat(70));

    try {
      const response = await axios.get('http://localhost:3001/api/index-returns', {
        params: testCase.params,
        timeout: 120000
      });

      if (response.data && response.data.success && response.data.data) {
        const data = response.data.data;
        
        const result = {
          name: testCase.name,
          totalReturn: data.customRisk?.totalReturn || 0,
          annualizedReturn: data.customRisk?.annualizedReturn || 0,
          sharpeRatio: data.customRisk?.sharpeRatio || 0,
          maxDrawdown: data.customRisk?.maxDrawdown || 0,
          volatility: data.customRisk?.volatility || 0
        };
        
        results.push(result);
        
        console.log(`✅ 测试成功`);
        console.log(`   累计收益率: ${(result.totalReturn * 100).toFixed(2)}%`);
        console.log(`   年化收益率: ${(result.annualizedReturn * 100).toFixed(2)}%`);
        console.log(`   夏普比率: ${result.sharpeRatio.toFixed(3)}`);
        console.log(`   最大回撤: ${(result.maxDrawdown * 100).toFixed(2)}%`);
        console.log(`   年化波动率: ${(result.volatility * 100).toFixed(2)}%`);
        
        // 检查调仓期数据
        if (data.periods && data.periods.length > 0) {
          const firstPeriod = data.periods[0];
          const holdingsCount = firstPeriod.holdings ? firstPeriod.holdings.length : 0;
          const filteredCount = firstPeriod.filteredOutStocks ? firstPeriod.filteredOutStocks.length : 0;
          
          console.log(`   第一个调仓期: ${firstPeriod.rebalanceDate}`);
          console.log(`   持仓股票数: ${holdingsCount}, 筛选掉: ${filteredCount}`);
          
          // 检查是否有ROE和负债率数据
          if (firstPeriod.holdings && firstPeriod.holdings.length > 0) {
            const withROE = firstPeriod.holdings.filter(h => h.roe && h.roe > 0).length;
            const withDebt = firstPeriod.holdings.filter(h => h.debtRatio && h.debtRatio > 0).length;
            console.log(`   有ROE数据: ${withROE}只, 有负债率数据: ${withDebt}只`);
          }
        }
      }
    } catch (error) {
      console.log(`❌ 测试失败: ${error.message}`);
      results.push({
        name: testCase.name,
        error: error.message
      });
    }
  }

  // 汇总结果
  console.log('\n' + '='.repeat(80));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(80) + '\n');

  console.log('测试名称                                  夏普比率  年化收益  最大回撤');
  console.log('-'.repeat(80));
  
  results.forEach(r => {
    if (r.error) {
      console.log(`${r.name.padEnd(40)} 失败: ${r.error}`);
    } else {
      const sharpe = r.sharpeRatio.toFixed(3).padStart(8);
      const ret = `${(r.annualizedReturn * 100).toFixed(2)}%`.padStart(8);
      const dd = `${(r.maxDrawdown * 100).toFixed(2)}%`.padStart(8);
      console.log(`${r.name.padEnd(40)} ${sharpe}  ${ret}  ${dd}`);
    }
  });

  // 找出最佳配置
  const validResults = results.filter(r => !r.error);
  if (validResults.length > 0) {
    const bestSharpe = validResults.reduce((max, r) => r.sharpeRatio > max.sharpeRatio ? r : max);
    
    console.log('\n' + '='.repeat(80));
    console.log('🏆 最佳配置（最高夏普比率）');
    console.log('='.repeat(80));
    console.log(`配置: ${bestSharpe.name}`);
    console.log(`夏普比率: ${bestSharpe.sharpeRatio.toFixed(3)}`);
    console.log(`年化收益率: ${(bestSharpe.annualizedReturn * 100).toFixed(2)}%`);
    console.log(`最大回撤: ${(bestSharpe.maxDrawdown * 100).toFixed(2)}%`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ 所有测试完成');
  console.log('='.repeat(80));
}

testAllFeatures().catch(console.error);
