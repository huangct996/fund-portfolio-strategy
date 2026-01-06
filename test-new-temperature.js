/**
 * 测试新的市场温度计（基于指数PE/PB）
 */

const marketThermometerService = require('./services/marketThermometerService');
const tushareService = require('./services/tushareService');

async function testNewTemperature() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🌡️ 测试新的市场温度计');
    console.log('='.repeat(60) + '\n');
    
    // 测试1：计算当前温度
    console.log('【测试1】计算当前市场温度\n');
    const currentTemp = await marketThermometerService.calculateMarketTemperature();
    
    console.log('\n当前市场温度结果:');
    console.log(JSON.stringify(currentTemp, null, 2));
    
    // 测试2：计算近5年历史温度
    console.log('\n\n【测试2】计算近5年历史温度\n');
    const startDate = '20200101';
    const endDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    const historicalTemps = await marketThermometerService.calculateHistoricalTemperature(
      '000300.SH',
      startDate,
      endDate
    );
    
    console.log(`\n获取到 ${historicalTemps.length} 个温度点`);
    
    // 按年度统计
    const yearlyStats = {};
    historicalTemps.forEach(t => {
      const year = t.date.substring(0, 4);
      if (!yearlyStats[year]) {
        yearlyStats[year] = [];
      }
      yearlyStats[year].push(t.temperature);
    });
    
    console.log('\n年度温度统计:');
    for (const year of Object.keys(yearlyStats).sort()) {
      const temps = yearlyStats[year];
      const avg = (temps.reduce((sum, t) => sum + t, 0) / temps.length).toFixed(1);
      const min = Math.min(...temps);
      const max = Math.max(...temps);
      console.log(`  ${year}年: 平均${avg}° (${min}°-${max}°) [${temps.length}个数据点]`);
    }
    
    // 测试3：温度分布统计
    console.log('\n\n【测试3】温度分布统计\n');
    const distribution = marketThermometerService.calculateTemperatureDistribution(historicalTemps);
    
    console.log('温度分布:');
    console.log(`  低估区间(0-30°): ${distribution.cold.count}次 (${distribution.cold.percentage}%)`);
    console.log(`  中估区间(30-70°): ${distribution.normal.count}次 (${distribution.normal.percentage}%)`);
    console.log(`  高估区间(70-100°): ${distribution.hot.count}次 (${distribution.hot.percentage}%)`);
    console.log(`  平均温度: ${distribution.avgTemperature}°`);
    
    // 测试4：最近10个温度点
    console.log('\n\n【测试4】最近10个温度点\n');
    const recent10 = historicalTemps.slice(-10);
    console.log('日期       | 温度 | 级别 | PE温度 | PB温度 | PE值  | PB值');
    console.log('-'.repeat(70));
    recent10.forEach(t => {
      console.log(
        `${t.date} | ${t.temperature}° | ${t.level.padEnd(6)} | ${t.components.pe}°    | ${t.components.pb}°    | ${t.values.pe.toFixed(2)} | ${t.values.pb.toFixed(2)}`
      );
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 测试完成！');
    console.log('='.repeat(60) + '\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testNewTemperature();
