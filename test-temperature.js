/**
 * 测试市场温度计算
 */
const marketThermometerService = require('./services/marketThermometerService');
const dbService = require('./services/dbService');

async function testTemperature() {
  try {
    console.log('\n🧪 测试市场温度计算\n');
    
    const indexCode = 'h30269.CSI';
    const date = '20251231';
    
    console.log(`📊 指数代码: ${indexCode}`);
    console.log(`📅 日期: ${date}\n`);
    
    // 1. 检查数据库连接
    console.log('1️⃣ 检查数据库连接...');
    await dbService.init();
    console.log('✅ 数据库连接成功\n');
    
    // 2. 检查stock_basic_info表数据量
    console.log('2️⃣ 检查stock_basic_info表数据...');
    const [countResult] = await dbService.pool.execute(`
      SELECT COUNT(*) as count FROM stock_basic_info
    `);
    console.log(`   总记录数: ${countResult[0].count}`);
    
    const [recentResult] = await dbService.pool.execute(`
      SELECT COUNT(*) as count FROM stock_basic_info 
      WHERE trade_date >= '20241201'
    `);
    console.log(`   最近一个月记录数: ${recentResult[0].count}\n`);
    
    // 3. 获取指数成分股
    console.log('3️⃣ 获取指数成分股...');
    const tushareService = require('./services/tushareService');
    const stocks = await tushareService.getIndexWeightByDate(indexCode, date);
    console.log(`   成分股数量: ${stocks ? stocks.length : 0}`);
    
    if (stocks && stocks.length > 0) {
      console.log(`   示例成分股: ${stocks.slice(0, 3).map(s => s.con_code).join(', ')}\n`);
      
      // 4. 检查成分股的PE/PB数据
      console.log('4️⃣ 检查成分股PE/PB数据...');
      const stockCodes = stocks.slice(0, 5).map(s => s.con_code); // 只检查前5只
      const startDate = '20241201';
      const endDate = '20251231';
      
      const stockData = await dbService.getStockBasicInfoBatch(stockCodes, startDate, endDate);
      console.log(`   查询到 ${stockData.length} 条成分股数据`);
      
      if (stockData.length > 0) {
        console.log(`   示例数据:`, stockData[0]);
      }
    }
    
    // 5. 计算温度
    console.log('\n5️⃣ 计算市场温度...');
    const temperature = await marketThermometerService.calculateMarketTemperature(indexCode, date);
    
    console.log('\n📊 计算结果:');
    console.log(JSON.stringify(temperature, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testTemperature();
