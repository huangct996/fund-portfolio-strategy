const dbService = require('./services/dbService');
const tushareService = require('./services/tushareService');

async function checkWhy52Days() {
  try {
    await dbService.init();
    
    const indexCode = 'h30269.CSI';
    const testDate = '20251128';
    
    // 获取成分股
    const stocks = await tushareService.getIndexWeightByDate(indexCode, testDate);
    const stockCodes = stocks.map(s => s.con_code);
    
    console.log(`\n成分股数量: ${stockCodes.length}\n`);
    
    // 检查每个日期有多少成分股有数据
    const [dateStats] = await dbService.pool.execute(`
      SELECT 
        trade_date,
        COUNT(*) as stock_count,
        COUNT(CASE WHEN pe_ttm > 0 THEN 1 END) as valid_pe_count
      FROM stock_basic_info
      WHERE ts_code IN (${stockCodes.map(() => '?').join(',')})
      GROUP BY trade_date
      ORDER BY trade_date
    `, stockCodes);
    
    console.log(`日期\t\t股票数\t有效PE数\t覆盖率`);
    console.log('='.repeat(60));
    
    let qualifiedDates = 0;
    dateStats.forEach(row => {
      const coverage = (row.valid_pe_count / stockCodes.length * 100).toFixed(1);
      const qualified = row.valid_pe_count >= stockCodes.length * 0.5 ? '✓' : '✗';
      
      if (row.valid_pe_count >= stockCodes.length * 0.5) {
        qualifiedDates++;
      }
      
      console.log(`${row.trade_date}\t${row.stock_count}\t${row.valid_pe_count}\t\t${coverage}%\t${qualified}`);
    });
    
    console.log(`\n总日期数: ${dateStats.length}`);
    console.log(`合格日期数 (≥50%覆盖): ${qualifiedDates}`);
    console.log(`不合格日期数: ${dateStats.length - qualifiedDates}`);
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkWhy52Days();
