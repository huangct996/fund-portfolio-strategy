/**
 * 调试温度计算问题
 */

const marketThermometerService = require('./services/marketThermometerService');

async function debugTemperature() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 调试温度计算问题');
    console.log('='.repeat(60) + '\n');
    
    // 问题1: 测试2026-01-05和当前日期的温度
    console.log('【问题1】当前温度与2026-01-05差异分析\n');
    
    const temp20260105 = await marketThermometerService.calculateMarketTemperature('000300.SH', '20260105');
    console.log('2026-01-05温度:');
    console.log(`  温度: ${temp20260105.temperature}°`);
    console.log(`  PE: ${temp20260105.values.pe} (温度${temp20260105.components.pe}°)`);
    console.log(`  PB: ${temp20260105.values.pb} (温度${temp20260105.components.pb}°)`);
    console.log(`  数据点: ${temp20260105.dataPoints}`);
    
    const tempCurrent = await marketThermometerService.calculateMarketTemperature('000300.SH');
    console.log('\n当前日期温度:');
    console.log(`  温度: ${tempCurrent.temperature}°`);
    console.log(`  PE: ${tempCurrent.values.pe} (温度${tempCurrent.components.pe}°)`);
    console.log(`  PB: ${tempCurrent.values.pb} (温度${tempCurrent.components.pb}°)`);
    console.log(`  数据点: ${tempCurrent.dataPoints}`);
    console.log(`  警告: ${tempCurrent.warning}`);
    
    // 问题2: 测试历史温度，查看5%和95%界线
    console.log('\n\n【问题2】温度曲线5%和95%界线分析\n');
    
    const historicalTemp = await marketThermometerService.calculateHistoricalTemperature(
      '000300.SH',
      '20200101',
      '20251231'
    );
    
    // 统计温度分布
    const tempStats = {
      min: Math.min(...historicalTemp.map(t => t.temperature)),
      max: Math.max(...historicalTemp.map(t => t.temperature)),
      at5: historicalTemp.filter(t => t.temperature === 5).length,
      at95: historicalTemp.filter(t => t.temperature === 95).length,
      between5and95: historicalTemp.filter(t => t.temperature > 5 && t.temperature < 95).length,
      total: historicalTemp.length
    };
    
    console.log('温度统计:');
    console.log(`  总数据点: ${tempStats.total}`);
    console.log(`  最小温度: ${tempStats.min}°`);
    console.log(`  最大温度: ${tempStats.max}°`);
    console.log(`  等于5°的点: ${tempStats.at5} (${(tempStats.at5/tempStats.total*100).toFixed(1)}%)`);
    console.log(`  等于95°的点: ${tempStats.at95} (${(tempStats.at95/tempStats.total*100).toFixed(1)}%)`);
    console.log(`  5°-95°之间: ${tempStats.between5and95} (${(tempStats.between5and95/tempStats.total*100).toFixed(1)}%)`);
    
    // 显示一些边界值的详细信息
    console.log('\n边界温度样本:');
    const samples = [
      ...historicalTemp.filter(t => t.temperature === 5).slice(0, 3),
      ...historicalTemp.filter(t => t.temperature === 95).slice(0, 3)
    ];
    
    samples.forEach(t => {
      console.log(`  ${t.date}: ${t.temperature}° (PE:${t.components.pe}° PB:${t.components.pb}°)`);
    });
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 调试完成');
    console.log('='.repeat(60) + '\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 调试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

debugTemperature();
