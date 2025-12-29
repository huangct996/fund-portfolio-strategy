/**
 * 诊断市场状态识别
 * 查看每个调仓期的实际指标值
 */

const marketRegimeService = require('./services/marketRegimeService');
const tushareService = require('./services/tushareService');

async function diagnoseMarketRegime() {
  console.log('='.repeat(80));
  console.log('🔍 诊断市场状态识别');
  console.log('='.repeat(80));
  
  const indexCode = 'h30269.CSI';
  const dates = ['20200710', '20201231', '20211231', '20221230', '20231229', '20241231'];
  
  for (const date of dates) {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📅 日期: ${date}`);
    console.log('='.repeat(80));
    
    try {
      // 获取成分股
      const stocks = await tushareService.getIndexWeightByDate(indexCode, date);
      
      if (!stocks || stocks.length === 0) {
        console.log('❌ 无成分股数据');
        continue;
      }
      
      console.log(`成分股数量: ${stocks.length}`);
      
      // 识别市场状态
      const result = await marketRegimeService.identifyMarketRegime(indexCode, stocks, date);
      
      console.log(`\n📊 市场指标:`);
      console.log(`   趋势强度: ${(result.trendStrength * 100).toFixed(2)}%`);
      console.log(`   市场宽度: ${(result.marketBreadth * 100).toFixed(1)}%`);
      console.log(`   波动率水平: ${(result.volatilityLevel * 100).toFixed(0)}%分位数`);
      console.log(`   动量强度: ${(result.momentumStrength * 100).toFixed(2)}%`);
      
      console.log(`\n🎯 市场状态: ${result.regimeName}`);
      console.log(`   置信度: ${(result.confidence * 100).toFixed(0)}%`);
      
      console.log(`\n⚙️  策略参数:`);
      console.log(`   maxWeight: ${(result.params.maxWeight * 100).toFixed(0)}%`);
      console.log(`   minROE: ${(result.params.minROE * 100).toFixed(0)}%`);
      console.log(`   momentumMonths: ${result.params.momentumMonths}月`);
      console.log(`   minMomentumReturn: ${(result.params.minMomentumReturn * 100).toFixed(0)}%`);
      
      // 判断逻辑
      console.log(`\n🔍 判断逻辑:`);
      const { trendStrength: t, marketBreadth: b, volatilityLevel: v, momentumStrength: m } = result;
      
      console.log(`   强势牛市条件: trend>${0.03*100}% && breadth>${0.55*100}% && momentum>${0.10*100}%`);
      console.log(`   当前值: ${(t*100).toFixed(2)}% && ${(b*100).toFixed(1)}% && ${(m*100).toFixed(2)}%`);
      console.log(`   满足: ${t > 0.03 && b > 0.55 && m > 0.10 ? '✅' : '❌'}`);
      
      console.log(`\n   温和牛市条件: trend>${0.01*100}% && breadth>${0.45*100}% && momentum>${0.02*100}%`);
      console.log(`   当前值: ${(t*100).toFixed(2)}% && ${(b*100).toFixed(1)}% && ${(m*100).toFixed(2)}%`);
      console.log(`   满足: ${t > 0.01 && b > 0.45 && m > 0.02 ? '✅' : '❌'}`);
      
      console.log(`\n   弱势市场条件: trend<${-0.01*100}% && breadth<${0.45*100}%`);
      console.log(`   当前值: ${(t*100).toFixed(2)}% && ${(b*100).toFixed(1)}%`);
      console.log(`   满足: ${t < -0.01 && b < 0.45 ? '✅' : '❌'}`);
      
    } catch (error) {
      console.error(`❌ 错误: ${error.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 诊断完成');
  console.log('='.repeat(80));
}

diagnoseMarketRegime().catch(console.error);
