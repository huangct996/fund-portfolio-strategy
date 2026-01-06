const dbService = require('./services/dbService');

async function checkDataCoverage() {
  try {
    await dbService.init();
    
    // 检查stock_basic_info表的数据分布
    const [dateDist] = await dbService.pool.execute(`
      SELECT 
        LEFT(trade_date, 4) as year,
        COUNT(DISTINCT trade_date) as date_count,
        COUNT(*) as record_count,
        MIN(trade_date) as min_date,
        MAX(trade_date) as max_date
      FROM stock_basic_info
      GROUP BY LEFT(trade_date, 4)
      ORDER BY year
    `);
    
    console.log('\nstock_basic_info表的年度数据分布:\n');
    console.log('年份\t日期数\t记录数\t\t最早\t\t最晚');
    console.log('='.repeat(70));
    
    dateDist.forEach(row => {
      console.log(`${row.year}\t${row.date_count}\t${row.record_count}\t\t${row.min_date}\t${row.max_date}`);
    });
    
    // 检查总体统计
    const [total] = await dbService.pool.execute(`
      SELECT 
        COUNT(DISTINCT trade_date) as total_dates,
        COUNT(DISTINCT ts_code) as total_stocks,
        COUNT(*) as total_records
      FROM stock_basic_info
    `);
    
    console.log('\n总体统计:');
    console.log(`  总日期数: ${total[0].total_dates}`);
    console.log(`  总股票数: ${total[0].total_stocks}`);
    console.log(`  总记录数: ${total[0].total_records}`);
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

checkDataCoverage();
