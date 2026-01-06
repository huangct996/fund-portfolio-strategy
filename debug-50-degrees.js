const marketThermometerService = require('./services/marketThermometerService');
const dbService = require('./services/dbService');

async function debug50Degrees() {
  try {
    await dbService.init();
    
    const indexCode = 'h30269.CSI';
    
    // 获取所有调仓日期
    const [dates] = await dbService.pool.execute(`
      SELECT DISTINCT trade_date 
      FROM index_weight 
      WHERE index_code = ? 
      ORDER BY trade_date ASC
    `, [indexCode]);
    
    console.log(`\n找到 ${dates.length} 个调仓日期\n`);
    
    let count50 = 0;
    let countNormal = 0;
    const failures = [];
    
    // 测试每个日期的温度计算
    for (const row of dates) {
      const date = row.trade_date;
      
      try {
        const temp = await marketThermometerService.calculateMarketTemperature(indexCode, date);
        
        if (temp.temperature === 50 && temp.components.pe === 50 && temp.components.pb === 50) {
          count50++;
          failures.push({
            date,
            reason: '返回默认值50°'
          });
        } else {
          countNormal++;
        }
      } catch (error) {
        count50++;
        failures.push({
          date,
          reason: error.message
        });
      }
    }
    
    console.log(`\n统计结果:`);
    console.log(`  正常计算: ${countNormal} 个日期`);
    console.log(`  返回50°: ${count50} 个日期`);
    console.log(`  成功率: ${(countNormal / dates.length * 100).toFixed(1)}%\n`);
    
    if (failures.length > 0) {
      console.log(`前5个失败案例:`);
      failures.slice(0, 5).forEach(f => {
        console.log(`  ${f.date}: ${f.reason}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

debug50Degrees();
