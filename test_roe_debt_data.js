/**
 * 检查数据库中是否有ROE和负债率数据
 * 以及这些数据何时被添加的
 */

const dbService = require('./services/dbService');

async function checkROEDebtData() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 检查数据库中的ROE和负债率数据');
  console.log('='.repeat(80) + '\n');

  try {
    // 查询stock_basic_info表中有ROE和负债率数据的股票
    const query = `
      SELECT 
        ts_code,
        name,
        roe,
        debt_ratio,
        CASE 
          WHEN roe IS NOT NULL AND roe > 0 THEN 1 
          ELSE 0 
        END as has_roe,
        CASE 
          WHEN debt_ratio IS NOT NULL AND debt_ratio > 0 THEN 1 
          ELSE 0 
        END as has_debt
      FROM stock_basic_info
      WHERE ts_code LIKE '%.SH' OR ts_code LIKE '%.SZ'
      LIMIT 100
    `;

    const result = await dbService.query(query);
    
    console.log(`总共查询了 ${result.length} 只股票\n`);
    
    const withROE = result.filter(r => r.has_roe === 1);
    const withDebt = result.filter(r => r.has_debt === 1);
    
    console.log(`有ROE数据的股票: ${withROE.length}只 (${(withROE.length / result.length * 100).toFixed(1)}%)`);
    console.log(`有负债率数据的股票: ${withDebt.length}只 (${(withDebt.length / result.length * 100).toFixed(1)}%)`);
    
    if (withROE.length > 0) {
      console.log('\n前10只有ROE数据的股票:');
      withROE.slice(0, 10).forEach(stock => {
        console.log(`  ${stock.ts_code.padEnd(12)} ${stock.name?.padEnd(10) || '未知'.padEnd(10)} ROE=${(stock.roe * 100).toFixed(2)}% 负债率=${(stock.debt_ratio * 100).toFixed(2)}%`);
      });
    }
    
    if (withROE.length === 0) {
      console.log('\n⚠️  数据库中没有ROE和负债率数据！');
      console.log('这意味着即使前端传递了minROE和maxDebtRatio参数，后端也不会应用筛选。');
    } else {
      console.log('\n✅ 数据库中有ROE和负债率数据！');
      console.log('这意味着当前版本会应用ROE和负债率筛选。');
    }
    
    // 检查特定的中证红利低波100成分股
    console.log('\n检查中证红利低波100指数成分股的ROE和负债率数据:');
    const indexQuery = `
      SELECT DISTINCT
        iw.con_code as ts_code,
        sbi.name,
        sbi.roe,
        sbi.debt_ratio
      FROM index_weight iw
      LEFT JOIN stock_basic_info sbi ON iw.con_code = sbi.ts_code
      WHERE iw.index_code = 'h30269.CSI'
        AND iw.trade_date = '20240101'
      LIMIT 10
    `;
    
    const indexStocks = await dbService.query(indexQuery);
    console.log(`\n2024-01-01调仓日的前10只成分股:`);
    indexStocks.forEach(stock => {
      const roe = stock.roe ? `${(stock.roe * 100).toFixed(2)}%` : '无数据';
      const debt = stock.debt_ratio ? `${(stock.debt_ratio * 100).toFixed(2)}%` : '无数据';
      console.log(`  ${stock.ts_code.padEnd(12)} ${stock.name?.padEnd(10) || '未知'.padEnd(10)} ROE=${roe.padEnd(8)} 负债率=${debt.padEnd(8)}`);
    });
    
  } catch (error) {
    console.error('查询失败:', error);
  } finally {
    await dbService.close();
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 检查完成');
  console.log('='.repeat(80));
}

checkROEDebtData().catch(console.error);
