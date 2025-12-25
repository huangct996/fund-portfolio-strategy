/**
 * 测试极端情况下的回撤问题
 */

const axios = require('axios');

async function testExtremeCases() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 测试极端筛选条件');
  console.log('='.repeat(80) + '\n');

  const testCases = [
    {
      name: '极端ROE筛选（ROE >= 20%）',
      params: {
        minROE: 0.20,
        maxDebtRatio: 1.0,
        momentumMonths: 6,
        minMomentumReturn: -0.10,
        filterByQuality: true
      }
    },
    {
      name: '极端负债率筛选（负债率 <= 30%）',
      params: {
        minROE: 0,
        maxDebtRatio: 0.30,
        momentumMonths: 6,
        minMomentumReturn: -0.10,
        filterByQuality: true
      }
    },
    {
      name: '极端动量筛选（动量 >= 10%）',
      params: {
        minROE: 0,
        maxDebtRatio: 1.0,
        momentumMonths: 6,
        minMomentumReturn: 0.10,
        filterByQuality: true
      }
    },
    {
      name: '多重极端筛选',
      params: {
        minROE: 0.15,
        maxDebtRatio: 0.40,
        momentumMonths: 6,
        minMomentumReturn: 0.05,
        filterByQuality: true
      }
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`测试: ${testCase.name}`);
    console.log('='.repeat(60));

    try {
      const response = await axios.get('http://localhost:3001/api/index-returns', {
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
          ...testCase.params
        },
        timeout: 120000
      });

      if (response.data && response.data.success && response.data.data) {
        const data = response.data.data;
        
        console.log(`\n风险指标:`);
        if (data.customRisk) {
          console.log(`  累计收益: ${(data.customRisk.totalReturn * 100).toFixed(2)}%`);
          console.log(`  年化收益: ${(data.customRisk.annualizedReturn * 100).toFixed(2)}%`);
          console.log(`  最大回撤: ${(data.customRisk.maxDrawdown * 100).toFixed(2)}%`);
          console.log(`  夏普比率: ${data.customRisk.sharpeRatio.toFixed(2)}`);
          
          if (data.customRisk.maxDrawdown >= 0.99) {
            console.log(`  ⚠️  检测到100%回撤！`);
          } else if (data.customRisk.maxDrawdown >= 0.50) {
            console.log(`  ⚠️  回撤超过50%！`);
          }
        }

        console.log(`\n调仓期详情:`);
        if (data.periods) {
          data.periods.forEach((period, idx) => {
            const holdingsCount = period.holdings ? period.holdings.length : 0;
            const filteredCount = period.filteredOutStocks ? period.filteredOutStocks.length : 0;
            const totalWeight = period.holdings 
              ? period.holdings.reduce((sum, h) => sum + (h.customWeight || 0), 0) 
              : 0;
            const withWeight = period.holdings 
              ? period.holdings.filter(h => h.customWeight > 0.001).length 
              : 0;
            
            console.log(`  ${period.rebalanceDate}: 持仓${withWeight}/${holdingsCount}只, 筛选掉${filteredCount}只, 总权重${(totalWeight * 100).toFixed(2)}%`);
            
            if (withWeight === 0 || totalWeight < 0.01) {
              console.log(`    ⚠️  警告：无有效持仓！`);
            }
          });
        }
      }
    } catch (error) {
      console.log(`  ❌ 错误: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('测试完成');
  console.log('='.repeat(80));
}

testExtremeCases();
