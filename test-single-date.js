const marketThermometerService = require('./services/marketThermometerService');

async function testSingleDate() {
  try {
    const indexCode = 'h30269.CSI';
    const date = '20151231';
    
    console.log(`\n测试日期: ${date}\n`);
    
    const temp = await marketThermometerService.calculateMarketTemperature(indexCode, date);
    
    console.log('\n结果:');
    console.log(`  温度: ${temp.temperature}°`);
    console.log(`  PE温度: ${temp.components.pe}°`);
    console.log(`  PB温度: ${temp.components.pb}°`);
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testSingleDate();
