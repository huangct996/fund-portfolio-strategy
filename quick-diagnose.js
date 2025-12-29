/**
 * 快速诊断 - 只检查一个日期的市场指标
 */

const marketRegimeService = require('./services/marketRegimeService');
const tushareService = require('./services/tushareService');

async function quickDiagnose() {
  const indexCode = 'h30269.CSI';
  const date = '20201231';  // 测试一个日期
  
  console.log(`\n检查日期: ${date}`);
  
  try {
    const stocks = await tushareService.getIndexWeightByDate(indexCode, date);
    
    if (!stocks || stocks.length === 0) {
      console.log('❌ 无成分股数据');
      return;
    }
    
    console.log(`成分股数量: ${stocks.length}`);
    
    const result = await marketRegimeService.identifyMarketRegime(indexCode, stocks, date);
    
    console.log(`\n市场指标:`);
    console.log(`  趋势: ${(result.trendStrength * 100).toFixed(2)}%`);
    console.log(`  宽度: ${(result.marketBreadth * 100).toFixed(1)}%`);
    console.log(`  波动: ${(result.volatilityLevel * 100).toFixed(0)}%`);
    console.log(`  动量: ${(result.momentumStrength * 100).toFixed(2)}%`);
    
    console.log(`\n市场状态: ${result.regimeName}`);
    console.log(`置信度: ${(result.confidence * 100).toFixed(0)}%`);
    
    console.log(`\n参数:`);
    console.log(`  maxWeight: ${(result.params.maxWeight * 100).toFixed(0)}%`);
    console.log(`  minROE: ${(result.params.minROE * 100).toFixed(0)}%`);
    
  } catch (error) {
    console.error('错误:', error.message);
  }
}

quickDiagnose();
