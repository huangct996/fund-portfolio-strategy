/**
 * 测试原策略权重和收益率计算
 */

const tushareService = require('./services/tushareService');
const portfolioService = require('./services/portfolioService');

async function testOriginalStrategy() {
  console.log('\n========================================');
  console.log('测试原策略权重和收益率计算');
  console.log('========================================\n');

  try {
    const fundCode = '512890.SH';
    
    // 获取所有持仓数据
    const holdings = await tushareService.getFundHoldings(fundCode);
    
    // 按报告期分组
    const groupedHoldings = {};
    holdings.forEach(h => {
      if (!groupedHoldings[h.end_date]) {
        groupedHoldings[h.end_date] = [];
      }
      groupedHoldings[h.end_date].push(h);
    });
    
    const allPeriods = Object.keys(groupedHoldings).sort();
    
    console.log(`总共 ${allPeriods.length} 个报告期\n`);
    
    // 检查每个报告期的stk_mkv_ratio字段
    for (let i = 0; i < Math.min(5, allPeriods.length); i++) {
      const period = allPeriods[i];
      const periodHoldings = groupedHoldings[period];
      
      console.log(`\n【报告期 ${period}】`);
      console.log(`持仓数量: ${periodHoldings.length}`);
      
      // 检查前5只股票的权重字段
      console.log(`前5只股票的权重字段:`);
      periodHoldings.slice(0, 5).forEach((h, idx) => {
        console.log(`  ${idx + 1}. ${h.symbol}:`);
        console.log(`     stk_mkv_ratio: ${h.stk_mkv_ratio}`);
        console.log(`     mkv: ${h.mkv}`);
        console.log(`     amount: ${h.amount}`);
      });
      
      // 计算权重总和
      const totalStkMkvRatio = periodHoldings.reduce((sum, h) => sum + (parseFloat(h.stk_mkv_ratio) || 0), 0);
      const totalMkv = periodHoldings.reduce((sum, h) => sum + (parseFloat(h.mkv) || 0), 0);
      
      console.log(`\n  stk_mkv_ratio总和: ${totalStkMkvRatio.toFixed(2)}%`);
      console.log(`  mkv总和: ${(totalMkv / 10000).toFixed(2)}万元`);
    }
    
    // 测试最近3个报告期的收益率计算
    console.log('\n\n========================================');
    console.log('测试最近3个报告期的收益率计算');
    console.log('========================================\n');
    
    const recentPeriods = allPeriods.slice(-3);
    
    for (const period of recentPeriods) {
      console.log(`\n【测试报告期 ${period}】`);
      
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
      
      if (result.periods && result.periods.length > 0) {
        const p = result.periods[0];
        console.log(`  自定义策略收益率: ${(p.customReturn * 100).toFixed(2)}%`);
        console.log(`  原策略收益率: ${(p.originalReturn * 100).toFixed(2)}%`);
        console.log(`  基金净值收益率: ${(p.fundReturn * 100).toFixed(2)}%`);
        console.log(`  持仓股票数: ${p.stockCount}`);
        
        // 检查adjustedHoldings
        if (p.adjustedHoldings && p.adjustedHoldings.length > 0) {
          console.log(`  adjustedHoldings数量: ${p.adjustedHoldings.length}`);
          console.log(`  前3只股票权重:`);
          p.adjustedHoldings.slice(0, 3).forEach((s, idx) => {
            console.log(`    ${idx + 1}. ${s.symbol}: 原始${(s.originalWeight*100).toFixed(2)}%, 调整后${(s.adjustedWeight*100).toFixed(2)}%`);
          });
        } else {
          console.log(`  ❌ adjustedHoldings为空!`);
        }
      } else {
        console.log(`  ❌ 该报告期计算失败!`);
      }
    }
    
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    process.exit(0);
  }
}

// 运行测试
testOriginalStrategy();
