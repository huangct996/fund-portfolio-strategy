/**
 * 分析2020-2023年期间自定义策略vs指数策略的表现差异
 */

const axios = require('axios');

async function analyzeEarlyPeriod() {
  const params = {
    startDate: '20200710',
    endDate: '20250710',
    maxWeight: '0.13',
    strategyType: 'riskParity',
    volatilityWindow: '6',
    ewmaDecay: '0.91',
    rebalanceFrequency: 'yearly',
    enableTradingCost: 'false',
    tradingCostRate: '0',
    riskFreeRate: '0.02',
    useQualityTilt: 'false',
    useCovariance: 'false',
    hybridRatio: '0',
    enableStockFilter: 'true',
    minROE: '0',
    maxDebtRatio: '1',
    momentumMonths: '6',
    minMomentumReturn: '-0.1',
    filterByQuality: 'true'
  };
  
  const response = await axios.get('http://localhost:3001/api/index-returns', { params });
  const data = response.data.data;
  
  console.log('='.repeat(80));
  console.log('2020-2023年期间表现分析');
  console.log('='.repeat(80));
  
  // 分析每个期间的表现
  console.log('\n各期间收益率对比：');
  console.log('-'.repeat(80));
  
  data.periods.forEach((p, i) => {
    const customReturn = (p.customReturn * 100).toFixed(2);
    const indexReturn = (p.indexReturn * 100).toFixed(2);
    const diff = ((p.customReturn - p.indexReturn) * 100).toFixed(2);
    const winner = p.customReturn > p.indexReturn ? '自定义胜' : '指数胜';
    
    console.log(`\n期间${i + 1}: ${p.startDate} -> ${p.endDate}`);
    console.log(`  自定义策略: ${customReturn}%`);
    console.log(`  指数策略:   ${indexReturn}%`);
    console.log(`  差异:       ${diff}% (${winner})`);
  });
  
  // 计算前3个期间（2020-2023）的累计表现
  console.log('\n' + '='.repeat(80));
  console.log('前3个期间（2020年7月-2022年12月）累计表现：');
  console.log('='.repeat(80));
  
  let customCumulative = 1;
  let indexCumulative = 1;
  
  for (let i = 0; i < Math.min(3, data.periods.length); i++) {
    customCumulative *= (1 + data.periods[i].customReturn);
    indexCumulative *= (1 + data.periods[i].indexReturn);
  }
  
  console.log(`自定义策略累计收益: ${((customCumulative - 1) * 100).toFixed(2)}%`);
  console.log(`指数策略累计收益:   ${((indexCumulative - 1) * 100).toFixed(2)}%`);
  console.log(`差异:               ${((customCumulative - indexCumulative) * 100).toFixed(2)}%`);
  
  // 分析权重分配
  console.log('\n' + '='.repeat(80));
  console.log('权重分配分析（前3个期间）：');
  console.log('='.repeat(80));
  
  for (let i = 0; i < Math.min(3, data.periods.length); i++) {
    const period = data.periods[i];
    console.log(`\n期间${i + 1}: ${period.startDate}`);
    
    if (period.topHoldings && period.topHoldings.length > 0) {
      console.log('  前5大持仓（自定义策略）:');
      period.topHoldings.slice(0, 5).forEach((h, idx) => {
        console.log(`    ${idx + 1}. ${h.name} (${h.code}): ${(h.weight * 100).toFixed(2)}%`);
      });
    }
  }
  
  // 分析可能的原因
  console.log('\n' + '='.repeat(80));
  console.log('可能的原因分析：');
  console.log('='.repeat(80));
  console.log('\n1. 风险平价策略的特点：');
  console.log('   - 根据波动率分配权重，波动率高的股票权重低');
  console.log('   - 在牛市初期，可能错过高波动高收益股票');
  console.log('   - 更注重风险控制，而非收益最大化');
  
  console.log('\n2. 2020-2022年市场特征：');
  console.log('   - 2020年下半年：疫情后复苏，市场快速上涨');
  console.log('   - 2021年：结构性牛市，部分高波动股票表现突出');
  console.log('   - 2022年：市场震荡，风险平价策略开始显现优势');
  
  console.log('\n3. 指数策略的优势：');
  console.log('   - 等权重或市值加权，充分参与市场上涨');
  console.log('   - 不考虑波动率，在牛市中可能获得更高收益');
  
  console.log('\n4. 2023年后的转折：');
  console.log('   - 从图表可以看出，2023年5月后自定义策略开始超越指数');
  console.log('   - 这可能是因为市场进入震荡期，风险控制的优势显现');
  console.log('   - 风险平价策略在控制回撤方面表现更好');
}

analyzeEarlyPeriod().catch(console.error);
