/**
 * 测试2023年报告期的计算
 */

const portfolioService = require('./services/portfolioService');

async function test2023Periods() {
  console.log('\n========================================');
  console.log('测试2023年报告期的计算');
  console.log('========================================\n');

  try {
    const fundCode = '512890.SH';
    const periods = ['20230630', '20230930', '20231231'];
    
    for (const period of periods) {
      console.log(`\n\n========== 测试报告期 ${period} ==========`);
      
      const result = await portfolioService.calculateAllPeriodReturns(
        fundCode,
        0.10,
        {
          reportPeriods: [period],
          useCompositeScore: false,
          scoreWeights: { mvWeight: 0.5, dvWeight: 0.3, qualityWeight: 0.2 },
          qualityFactorType: 'pe_pb'
        }
      );
      
      console.log(`\n结果: ${result.periods.length} 个有效报告期`);
      
      if (result.periods.length > 0) {
        const p = result.periods[0];
        console.log(`  自定义策略收益率: ${(p.customReturn * 100).toFixed(2)}%`);
        console.log(`  原策略收益率: ${(p.originalReturn * 100).toFixed(2)}%`);
        console.log(`  基金净值收益率: ${(p.fundReturn * 100).toFixed(2)}%`);
        console.log(`  持仓股票数: ${p.stockCount}`);
      } else {
        console.log(`  ❌ 该报告期计算失败，被跳过`);
      }
    }
    
  } catch (error) {
    console.error('测试失败:', error);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

// 运行测试
test2023Periods();
