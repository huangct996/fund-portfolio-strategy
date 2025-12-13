/**
 * 测试数据库缓存功能
 * 演示增量同步的工作流程
 */

const tushareService = require('./services/tushareService');
const dbService = require('./services/dbService');

async function testDatabaseCache() {
  console.log('\n========================================');
  console.log('测试数据库缓存功能');
  console.log('========================================\n');

  try {
    // 初始化数据库
    await dbService.init();

    const fundCode = '512890.SH';
    
    // 测试1: 查询基金持仓（第一次）
    console.log('\n【测试1】第一次查询基金持仓');
    console.log('预期: 数据库无数据，调用API并同步\n');
    const holdings1 = await tushareService.getFundHoldings(fundCode);
    console.log(`结果: 获取到 ${holdings1.length} 条持仓记录`);

    // 等待一下
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 测试2: 再次查询基金持仓（第二次）
    console.log('\n【测试2】第二次查询基金持仓');
    console.log('预期: 数据库有数据，直接返回\n');
    const holdings2 = await tushareService.getFundHoldings(fundCode);
    console.log(`结果: 获取到 ${holdings2.length} 条持仓记录`);

    // 测试3: 查询基金净值（第一次）
    console.log('\n【测试3】第一次查询基金净值');
    console.log('预期: 数据库无数据，调用API并同步\n');
    const nav1 = await tushareService.getFundNav(fundCode, '20190101');
    console.log(`结果: 获取到 ${nav1.length} 条净值记录`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 测试4: 再次查询基金净值（第二次）
    console.log('\n【测试4】第二次查询基金净值');
    console.log('预期: 数据库有数据，直接返回\n');
    const nav2 = await tushareService.getFundNav(fundCode, '20190101');
    console.log(`结果: 获取到 ${nav2.length} 条净值记录`);

    // 测试5: 查询股票价格（第一次）
    console.log('\n【测试5】第一次查询股票价格');
    console.log('预期: 数据库无数据，调用API并同步\n');
    const prices1 = await tushareService.batchGetStockPrices(
      ['601398.SH', '600036.SH'],
      '20200101',
      '20200131'
    );
    console.log(`结果: 获取到 ${Object.keys(prices1).length} 只股票的价格数据`);

    await new Promise(resolve => setTimeout(resolve, 1000));

    // 测试6: 再次查询股票价格（第二次）
    console.log('\n【测试6】第二次查询股票价格');
    console.log('预期: 数据库有数据，直接返回\n');
    const prices2 = await tushareService.batchGetStockPrices(
      ['601398.SH', '600036.SH'],
      '20200101',
      '20200131'
    );
    console.log(`结果: 获取到 ${Object.keys(prices2).length} 只股票的价格数据`);

    // 测试7: 查询新的股票价格（增量同步）
    console.log('\n【测试7】查询新的股票价格（增量同步）');
    console.log('预期: 已有的从数据库读取，新的调用API并同步\n');
    const prices3 = await tushareService.batchGetStockPrices(
      ['601398.SH', '600036.SH', '601288.SH'],  // 新增601288.SH
      '20200101',
      '20200131'
    );
    console.log(`结果: 获取到 ${Object.keys(prices3).length} 只股票的价格数据`);

    console.log('\n========================================');
    console.log('✅ 测试完成！');
    console.log('========================================\n');

    console.log('总结:');
    console.log('1. 首次查询 → 调用API并同步到数据库');
    console.log('2. 再次查询 → 直接从数据库读取（速度快）');
    console.log('3. 查询新数据 → 增量同步（只获取缺失的数据）');
    console.log('4. 每次查询都会先查数据库，没有才调用API');

  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await dbService.close();
    process.exit(0);
  }
}

// 运行测试
testDatabaseCache();
