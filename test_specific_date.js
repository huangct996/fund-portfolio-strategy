/**
 * 测试特定日期范围的回撤问题
 * 从截图看，问题可能出现在2024年8月附近
 */

const axios = require('axios');

async function testSpecificDateRange() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 测试2024年8月附近的回撤问题');
    console.log('='.repeat(80) + '\n');

    // 测试多个日期范围
    const testRanges = [
      { start: '20240101', end: '20241231', desc: '2024全年' },
      { start: '20230101', end: '20241231', desc: '2023-2024' },
      { start: '20200101', end: '20240831', desc: '2020-2024/08' }
    ];

    for (const range of testRanges) {
      console.log(`\n测试日期范围: ${range.desc} (${range.start} - ${range.end})`);
      console.log('-'.repeat(60));

      const params = {
        fundCode: '512890.SH',
        startDate: range.start,
        endDate: range.end,
        strategyType: 'riskParity',
        volatilityWindow: 12,
        ewmaDecay: 0.94,
        rebalanceFrequency: 'yearly',
        enableTradingCost: false,
        enableStockFilter: true,
        minROE: 0,
        maxDebtRatio: 1.0,
        momentumMonths: 6,
        minMomentumReturn: -0.10,
        filterByQuality: true
      };

      try {
        const response = await axios.get('http://localhost:3001/api/index-returns', {
          params,
          timeout: 120000
        });

        if (response.data && response.data.success && response.data.data) {
          const data = response.data.data;
          
          if (data.customRisk) {
            console.log(`   累计收益: ${(data.customRisk.totalReturn * 100).toFixed(2)}%`);
            console.log(`   年化收益: ${(data.customRisk.annualizedReturn * 100).toFixed(2)}%`);
            console.log(`   最大回撤: ${(data.customRisk.maxDrawdown * 100).toFixed(2)}%`);
            
            if (data.customRisk.maxDrawdown >= 0.99) {
              console.log('   ⚠️  检测到100%回撤！');
              
              // 检查每日数据
              if (data.customDailyData) {
                const zeroValues = data.customDailyData.filter(d => d.cumulative <= 0.01);
                if (zeroValues.length > 0) {
                  console.log(`\n   发现 ${zeroValues.length} 个异常数据点:`);
                  zeroValues.slice(0, 10).forEach(d => {
                    console.log(`      ${d.date}: 累计净值=${d.cumulative.toFixed(6)}`);
                  });
                }
              }
              
              // 检查调仓期
              if (data.periods) {
                console.log('\n   调仓期权重检查:');
                data.periods.forEach(p => {
                  const totalWeight = p.holdings 
                    ? p.holdings.reduce((sum, h) => sum + (h.customWeight || 0), 0) 
                    : 0;
                  const withWeight = p.holdings ? p.holdings.filter(h => h.customWeight > 0.001).length : 0;
                  console.log(`      ${p.rebalanceDate}: 总权重=${(totalWeight * 100).toFixed(2)}%, 有效持仓=${withWeight}只`);
                });
              }
            }
          }
          
          // 检查调仓期数量
          if (data.periods) {
            console.log(`   调仓期数: ${data.periods.length}`);
          }
        }
      } catch (error) {
        console.log(`   ❌ 错误: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('\n❌ 测试失败:', error);
  }
}

testSpecificDateRange();
