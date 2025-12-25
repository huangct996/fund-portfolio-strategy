/**
 * 检查数据库中的ROE和负债率数据
 */

const dbService = require('./services/dbService');

async function checkDatabase() {
  try {
    await dbService.init();
    
    console.log('\n检查数据库中的股票基本信息...\n');
    
    // 查询一些示例股票
    const testCodes = ['601088.SH', '600028.SH', '000651.SZ'];
    const testDate = '20230101';
    
    for (const code of testCodes) {
      const data = await dbService.getStockBasicInfo(code, testDate);
      console.log(`${code}:`);
      if (data) {
        console.log(`  name: ${data.name}`);
        console.log(`  roe: ${data.roe} (type: ${typeof data.roe})`);
        console.log(`  debt_ratio: ${data.debt_ratio} (type: ${typeof data.debt_ratio})`);
        console.log(`  pe_ttm: ${data.pe_ttm}`);
        console.log(`  pb: ${data.pb}`);
      } else {
        console.log('  未找到数据');
      }
      console.log('');
    }
    
    await dbService.close();
    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

checkDatabase();
