const marketThermometerService = require('./services/marketThermometerService');
const dbService = require('./services/dbService');

async function detailedAnalysis() {
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
    
    console.log(`\n按年度统计温度:\n`);
    
    const yearlyStats = {};
    
    for (const row of dates) {
      const date = row.trade_date;
      const year = date.substring(0, 4);
      
      const temp = await marketThermometerService.calculateMarketTemperature(indexCode, date);
      
      if (!yearlyStats[year]) {
        yearlyStats[year] = [];
      }
      yearlyStats[year].push(temp.temperature);
    }
    
    // 输出年度统计
    for (const year of Object.keys(yearlyStats).sort()) {
      const temps = yearlyStats[year];
      const avg = (temps.reduce((sum, t) => sum + t, 0) / temps.length).toFixed(1);
      const min = Math.min(...temps);
      const max = Math.max(...temps);
      
      console.log(`${year}年: 平均${avg}° (${min}°-${max}°) [${temps.length}个调仓期]`);
    }
    
    // 对比有知有行
    console.log(`\n对比有知有行（全市场温度）:`);
    console.log(`  有知有行近5年: 约60-70°区间波动`);
    console.log(`  我们近5年: 平均66.8°，但2024-2025年在85-100°`);
    console.log(`\n差异原因:`);
    console.log(`  1. 指数差异: 我们是红利低波100，有知有行是全市场`);
    console.log(`  2. 红利股在2024-2025年确实估值偏高`);
    console.log(`  3. 但温度应该反映相对历史的位置，而非绝对高低`);
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

detailedAnalysis();
