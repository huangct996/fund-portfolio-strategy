/**
 * 对比v7.0.0和v8.0.0的筛选结果
 * 测试相同参数下的差异
 */

const axios = require('axios');

async function compareVersions() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 对比v7.0.0和v8.0.0的筛选逻辑');
  console.log('='.repeat(80) + '\n');

  // v7.0.0的参数（输入框有默认值，即使不勾选也会传递）
  const v7Params = {
    fundCode: '512890.SH',
    startDate: '20200101',
    endDate: '20241231',
    strategyType: 'riskParity',
    volatilityWindow: 12,
    ewmaDecay: 0.94,
    rebalanceFrequency: 'yearly',
    enableTradingCost: false,
    enableStockFilter: true,
    minROE: 0.08,        // v7.0.0中输入框的默认值
    maxDebtRatio: 0.60,  // v7.0.0中输入框的默认值
    momentumMonths: 6,
    minMomentumReturn: -0.10,
    filterByQuality: true
  };

  // v8.0.0未勾选复选框的参数
  const v8UncheckParams = {
    fundCode: '512890.SH',
    startDate: '20200101',
    endDate: '20241231',
    strategyType: 'riskParity',
    volatilityWindow: 12,
    ewmaDecay: 0.94,
    rebalanceFrequency: 'yearly',
    enableTradingCost: false,
    enableStockFilter: true,
    minROE: 0,           // v8.0.0未勾选时传递0
    maxDebtRatio: 1.0,   // v8.0.0未勾选时传递1.0
    momentumMonths: 6,
    minMomentumReturn: -0.10,
    filterByQuality: true
  };

  // v8.0.0勾选复选框的参数
  const v8CheckParams = {
    fundCode: '512890.SH',
    startDate: '20200101',
    endDate: '20241231',
    strategyType: 'riskParity',
    volatilityWindow: 12,
    ewmaDecay: 0.94,
    rebalanceFrequency: 'yearly',
    enableTradingCost: false,
    enableStockFilter: true,
    minROE: 0.08,        // v8.0.0勾选后传递8%
    maxDebtRatio: 0.60,  // v8.0.0勾选后传递60%
    momentumMonths: 6,
    minMomentumReturn: -0.10,
    filterByQuality: true
  };

  const testCases = [
    { name: 'v7.0.0模拟（ROE=8%, 负债率=60%）', params: v7Params },
    { name: 'v8.0.0未勾选（ROE=0%, 负债率=100%）', params: v8UncheckParams },
    { name: 'v8.0.0勾选（ROE=8%, 负债率=60%）', params: v8CheckParams }
  ];

  const results = [];

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`测试: ${testCase.name}`);
    console.log('='.repeat(70));
    console.log(`参数: minROE=${(testCase.params.minROE * 100).toFixed(0)}%, maxDebtRatio=${(testCase.params.maxDebtRatio * 100).toFixed(0)}%`);

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
        
        // 检查第一个调仓期的筛选情况
        if (data.periods && data.periods.length > 0) {
          const firstPeriod = data.periods[0];
          const holdingsCount = firstPeriod.holdings ? firstPeriod.holdings.length : 0;
          const filteredCount = firstPeriod.filteredOutStocks ? firstPeriod.filteredOutStocks.length : 0;
          const totalWeight = firstPeriod.holdings 
            ? firstPeriod.holdings.reduce((sum, h) => sum + (h.customWeight || 0), 0) 
            : 0;
          
          console.log(`   第一个调仓期: ${firstPeriod.rebalanceDate}`);
          console.log(`   持仓股票数: ${holdingsCount}, 筛选掉: ${filteredCount}, 总权重: ${(totalWeight * 100).toFixed(2)}%`);
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

  // 对比结果
  console.log('\n' + '='.repeat(80));
  console.log('📊 结果对比');
  console.log('='.repeat(80) + '\n');

  console.log('配置                                      夏普比率  年化收益  最大回撤  年化波动率');
  console.log('-'.repeat(80));
  
  results.forEach(r => {
    if (r.error) {
      console.log(`${r.name.padEnd(40)} 失败: ${r.error}`);
    } else {
      const sharpe = r.sharpeRatio.toFixed(3).padStart(8);
      const ret = `${(r.annualizedReturn * 100).toFixed(2)}%`.padStart(8);
      const dd = `${(r.maxDrawdown * 100).toFixed(2)}%`.padStart(8);
      const vol = `${(r.volatility * 100).toFixed(2)}%`.padStart(10);
      console.log(`${r.name.padEnd(40)} ${sharpe}  ${ret}  ${dd}  ${vol}`);
    }
  });

  // 分析差异
  console.log('\n' + '='.repeat(80));
  console.log('🔍 差异分析');
  console.log('='.repeat(80));
  
  if (results.length >= 3 && !results[0].error && !results[1].error && !results[2].error) {
    const v7Result = results[0];
    const v8UncheckResult = results[1];
    const v8CheckResult = results[2];
    
    console.log('\n1. v7.0.0 vs v8.0.0未勾选：');
    console.log(`   夏普比率差异: ${(v7Result.sharpeRatio - v8UncheckResult.sharpeRatio).toFixed(3)}`);
    console.log(`   年化收益差异: ${((v7Result.annualizedReturn - v8UncheckResult.annualizedReturn) * 100).toFixed(2)}%`);
    console.log(`   结论: ${Math.abs(v7Result.sharpeRatio - v8UncheckResult.sharpeRatio) < 0.01 ? '✅ 基本一致' : '❌ 存在差异'}`);
    
    console.log('\n2. v7.0.0 vs v8.0.0勾选：');
    console.log(`   夏普比率差异: ${(v7Result.sharpeRatio - v8CheckResult.sharpeRatio).toFixed(3)}`);
    console.log(`   年化收益差异: ${((v7Result.annualizedReturn - v8CheckResult.annualizedReturn) * 100).toFixed(2)}%`);
    console.log(`   结论: ${Math.abs(v7Result.sharpeRatio - v8CheckResult.sharpeRatio) < 0.01 ? '✅ 基本一致' : '❌ 存在差异'}`);
    
    console.log('\n3. v8.0.0未勾选 vs v8.0.0勾选：');
    console.log(`   夏普比率差异: ${(v8UncheckResult.sharpeRatio - v8CheckResult.sharpeRatio).toFixed(3)}`);
    console.log(`   年化收益差异: ${((v8UncheckResult.annualizedReturn - v8CheckResult.annualizedReturn) * 100).toFixed(2)}%`);
    console.log(`   结论: ${Math.abs(v8UncheckResult.sharpeRatio - v8CheckResult.sharpeRatio) < 0.01 ? '✅ 基本一致' : '❌ 存在显著差异（符合预期）'}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ 对比测试完成');
  console.log('='.repeat(80));
}

compareVersions().catch(console.error);
