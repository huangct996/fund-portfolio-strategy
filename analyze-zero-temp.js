const marketThermometerService = require('./services/marketThermometerService');
const dbService = require('./services/dbService');

async function analyzeZeroTemp() {
  try {
    await dbService.init();
    
    const indexCode = 'h30269.CSI';
    const testDate = '20160229'; // 图中显示有0度的日期
    
    console.log(`\n分析日期: ${testDate}\n`);
    
    // 计算10年前的日期
    const year = parseInt(testDate.substring(0, 4));
    const month = testDate.substring(4, 6);
    const day = testDate.substring(6, 8);
    const startDate = (year - 10) + month + day;
    
    console.log(`历史数据范围: ${startDate} - ${testDate}`);
    
    // 检查这个时间范围内有多少数据
    const [dateCount] = await dbService.pool.execute(`
      SELECT COUNT(DISTINCT trade_date) as count
      FROM stock_basic_info
      WHERE trade_date >= ? AND trade_date <= ?
    `, [startDate, testDate]);
    
    console.log(`stock_basic_info表中该时间范围的日期数: ${dateCount[0].count}\n`);
    
    // 检查最早的数据日期
    const [earliest] = await dbService.pool.execute(`
      SELECT MIN(trade_date) as min_date, MAX(trade_date) as max_date
      FROM stock_basic_info
    `);
    
    console.log(`stock_basic_info表的数据范围:`);
    console.log(`  最早: ${earliest[0].min_date}`);
    console.log(`  最晚: ${earliest[0].max_date}\n`);
    
    // 计算温度
    const temp = await marketThermometerService.calculateMarketTemperature(indexCode, testDate);
    console.log(`\n温度计算结果: ${temp.temperature}°`);
    console.log(`PE温度: ${temp.components.pe}°`);
    console.log(`PB温度: ${temp.components.pb}°`);
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

analyzeZeroTemp();
