const marketThermometerService = require('./services/marketThermometerService');
const dbService = require('./services/dbService');
const tushareService = require('./services/tushareService');

async function testTemperature() {
  try {
    console.log('\n🧪 测试市场温度计算\n');
    
    const indexCode = 'h30269.CSI';
    // 使用一个有效的历史日期
    const date = '20241220';
    
    console.log(`📊 指数代码: ${indexCode}`);
    console.log(`📅 日期: ${date}\n`);
    
    await dbService.init();
    console.log('✅ 数据库连接成功\n');
    
    // 获取指数成分股
    console.log('获取指数成分股...');
    const stocks = await tushareService.getIndexWeightByDate(indexCode, date);
    console.log(`成分股数量: ${stocks ? stocks.length : 0}\n`);
    
    if (!stocks || stocks.length === 0) {
      console.log('⚠️  无成分股数据，尝试使用最近的调仓日期...');
      // 获取最近的调仓日期
      const rebalanceDates = await tushareService.getIndexRebalanceDates(indexCode, '20240101', date);
      if (rebalanceDates && rebalanceDates.length > 0) {
        const latestDate = rebalanceDates[rebalanceDates.length - 1];
        console.log(`最近的调仓日期: ${latestDate}\n`);
        const stocksLatest = await tushareService.getIndexWeightByDate(indexCode, latestDate);
        console.log(`该日期成分股数量: ${stocksLatest ? stocksLatest.length : 0}\n`);
      }
    }
    
    // 计算温度
    console.log('计算市场温度...\n');
    const temperature = await marketThermometerService.calculateMarketTemperature(indexCode, date);
    
    console.log('\n📊 计算结果:');
    console.log(`温度: ${temperature.temperature}°`);
    console.log(`级别: ${temperature.levelName}`);
    console.log(`PE温度: ${temperature.components.pe}°`);
    console.log(`PB温度: ${temperature.components.pb}°`);
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testTemperature();
