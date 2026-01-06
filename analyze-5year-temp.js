const marketThermometerService = require('./services/marketThermometerService');
const dbService = require('./services/dbService');

async function analyze5YearTemp() {
  try {
    await dbService.init();
    
    const indexCode = 'h30269.CSI';
    
    // 获取近5年的调仓日期
    const [dates] = await dbService.pool.execute(`
      SELECT DISTINCT trade_date 
      FROM index_weight 
      WHERE index_code = ? 
        AND trade_date >= '20200101'
        AND trade_date <= '20251231'
      ORDER BY trade_date ASC
    `, [indexCode]);
    
    console.log(`\n近5年调仓日期数: ${dates.length}\n`);
    
    const results = [];
    
    for (const row of dates) {
      const date = row.trade_date;
      const temp = await marketThermometerService.calculateMarketTemperature(indexCode, date);
      
      results.push({
        date,
        temperature: temp.temperature,
        pe: temp.components.pe,
        pb: temp.components.pb
      });
      
      console.log(`${date}: ${temp.temperature}° (PE:${temp.components.pe}° PB:${temp.components.pb}°)`);
    }
    
    // 统计
    const temps = results.map(r => r.temperature);
    const avg = (temps.reduce((sum, t) => sum + t, 0) / temps.length).toFixed(1);
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    
    console.log(`\n近5年温度统计:`);
    console.log(`  平均温度: ${avg}°`);
    console.log(`  最低温度: ${min}°`);
    console.log(`  最高温度: ${max}°`);
    console.log(`  温度范围: ${min}° - ${max}°`);
    
    // 分析问题
    console.log(`\n问题分析:`);
    if (parseFloat(avg) > 80) {
      console.log(`  ⚠️ 平均温度${avg}°过高，应该在50-70°区间`);
      console.log(`  可能原因:`);
      console.log(`    1. 历史数据范围太窄（只有2015-2025年）`);
      console.log(`    2. 近5年数据占比过高，导致温度偏高`);
      console.log(`    3. 需要更长的历史周期（至少10-15年）`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

analyze5YearTemp();
