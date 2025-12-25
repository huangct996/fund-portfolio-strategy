/**
 * 直接测试财务数据获取功能
 */

const tushareService = require('./services/tushareService');
const dbService = require('./services/dbService');

async function testFinancialFetch() {
  try {
    await dbService.init();
    
    console.log('\n测试财务数据获取...\n');
    
    // 测试几只股票
    const testCodes = ['601088.SH', '600028.SH', '000651.SZ'];
    const testDate = '20230101';
    
    console.log(`调用 batchGetStockBasic 获取 ${testCodes.length} 只股票的数据...`);
    console.log(`交易日期: ${testDate}\n`);
    
    const results = await tushareService.batchGetStockBasic(testCodes, testDate);
    
    console.log('\n获取结果:');
    for (const code of testCodes) {
      const data = results[code];
      console.log(`\n${code} (${data?.name || 'N/A'}):`);
      console.log(`  市值: ${data?.totalMv || 0}`);
      console.log(`  PE: ${data?.peTtm || 0}`);
      console.log(`  PB: ${data?.pb || 0}`);
      console.log(`  ROE: ${data?.roe || 0} (${data?.roe ? (data.roe * 100).toFixed(2) + '%' : 'N/A'})`);
      console.log(`  负债率: ${data?.debtRatio || 0} (${data?.debtRatio ? (data.debtRatio * 100).toFixed(2) + '%' : 'N/A'})`);
    }
    
    // 验证数据库
    console.log('\n\n验证数据库中的数据:');
    for (const code of testCodes) {
      const dbData = await dbService.getStockBasicInfo(code, testDate);
      console.log(`\n${code}:`);
      console.log(`  ROE (DB): ${dbData?.roe} (type: ${typeof dbData?.roe})`);
      console.log(`  debt_ratio (DB): ${dbData?.debt_ratio} (type: ${typeof dbData?.debt_ratio})`);
    }
    
    await dbService.close();
    process.exit(0);
  } catch (error) {
    console.error('错误:', error);
    process.exit(1);
  }
}

testFinancialFetch();
