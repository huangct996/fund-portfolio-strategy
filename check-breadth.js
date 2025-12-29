/**
 * 检查各个调仓期的市场宽度实际值
 */

const marketRegimeService = require('./services/marketRegimeService');
const tushareService = require('./services/tushareService');

async function checkBreadth() {
  const indexCode = 'h30269.CSI';
  const dates = ['20200710', '20201231', '20211231', '20221230', '20231229', '20241231'];
  
  console.log('\n检查各调仓期的市场宽度：\n');
  
  for (const date of dates) {
    try {
      const stocks = await tushareService.getIndexWeightByDate(indexCode, date);
      
      if (!stocks || stocks.length === 0) {
        console.log(`${date}: 无数据`);
        continue;
      }
      
      const result = await marketRegimeService.identifyMarketRegime(indexCode, stocks, date);
      
      console.log(`${date}: 宽度=${(result.marketBreadth*100).toFixed(1)}% -> ${result.regimeName}`);
      
    } catch (error) {
      console.log(`${date}: 错误 - ${error.message}`);
    }
  }
}

checkBreadth();
