const marketThermometerService = require('./services/marketThermometerService');
const dbService = require('./services/dbService');
const tushareService = require('./services/tushareService');

async function testTemperature() {
  try {
    console.log('\n🧪 测试市场温度计算\n');
    
    const indexCode = 'h30269.CSI';
    const date = '20251128'; // 使用有数据的日期
    
    console.log(`📊 指数代码: ${indexCode}`);
    console.log(`📅 日期: ${date}\n`);
    
    await dbService.init();
    
    // 1. 获取指数成分股
    console.log('1️⃣ 获取指数成分股...');
    const stocks = await tushareService.getIndexWeightByDate(indexCode, date);
    console.log(`   成分股数量: ${stocks ? stocks.length : 0}`);
    
    if (stocks && stocks.length > 0) {
      console.log(`   示例: ${stocks.slice(0, 3).map(s => s.con_code).join(', ')}\n`);
      
      // 2. 检查成分股PE/PB数据
      console.log('2️⃣ 检查成分股PE/PB数据...');
      const stockCodes = stocks.slice(0, 5).map(s => s.con_code);
      const startDate = '20241101';
      const endDate = '20251130';
      
      const stockData = await dbService.getStockBasicInfoBatch(stockCodes, startDate, endDate);
      console.log(`   查询到 ${stockData.length} 条数据`);
      
      if (stockData.length > 0) {
        const sample = stockData.find(d => d.trade_date === date);
        if (sample) {
          console.log(`   ${date}的数据示例:`, {
            ts_code: sample.ts_code,
            pe_ttm: sample.pe_ttm,
            pb: sample.pb
          });
        }
      }
      console.log('');
    }
    
    // 3. 计算温度
    console.log('3️⃣ 计算市场温度...\n');
    const temperature = await marketThermometerService.calculateMarketTemperature(indexCode, date);
    
    console.log('\n📊 计算结果:');
    console.log(`   温度: ${temperature.temperature}°`);
    console.log(`   级别: ${temperature.levelName}`);
    console.log(`   PE温度: ${temperature.components.pe}°`);
    console.log(`   PB温度: ${temperature.components.pb}°`);
    
    if (temperature.temperature === 50 && temperature.components.pe === 50 && temperature.components.pb === 50) {
      console.log('\n⚠️  温度仍然是默认值50°，需要进一步排查');
    } else {
      console.log('\n✅ 温度计算正常！');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testTemperature();
