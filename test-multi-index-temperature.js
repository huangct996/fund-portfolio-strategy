/**
 * 测试多指数温度计算功能
 */

const axios = require('axios');

async function testMultiIndexTemperature() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 多指数温度计算功能测试');
  console.log('='.repeat(80) + '\n');

  // 测试1: 综合温度
  console.log('【测试1】多指数综合温度');
  console.log('-'.repeat(80));
  
  try {
    const res1 = await axios.get('http://localhost:3001/api/composite-temperature');
    const data1 = res1.data.data;
    
    console.log('综合温度:', data1.temperature + '°');
    console.log('温度级别:', data1.levelName);
    console.log('置信度:', (data1.confidence * 100).toFixed(0) + '%');
    console.log('有效指数:', data1.composition.validIndices + '/' + data1.composition.totalIndices);
    console.log('\n各指数温度:');
    data1.indexTemperatures.forEach(index => {
      console.log(`  ${index.name}: ${index.temperature}° (${index.levelName}) - 权重${(index.weight * 100).toFixed(0)}%`);
    });
    console.log('\n策略参数建议:');
    console.log('  单只股票最大权重:', (data1.params.maxWeight * 100).toFixed(0) + '%');
    console.log('  波动率窗口:', data1.params.volatilityWindow + '月');
    console.log('  质量筛选:', data1.params.filterByQuality ? '启用' : '关闭');
  } catch (error) {
    console.error('测试1失败:', error.message);
  }

  console.log('\n');

  // 测试2: 多指数历史温度
  console.log('【测试2】多指数历史温度（近1年）');
  console.log('-'.repeat(80));
  
  try {
    const endDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10).replace(/-/g, '');
    
    const res2 = await axios.get(`http://localhost:3001/api/multi-index-temperature?startDate=${startDate}&endDate=${endDate}`);
    const data2 = res2.data.data;
    
    console.log('综合温度数据点:', data2.composite.temperatures.length);
    console.log('综合温度分布:');
    console.log('  低估 (0-30°):', data2.composite.distribution.cold.percentage + '%');
    console.log('  中估 (30-70°):', data2.composite.distribution.normal.percentage + '%');
    console.log('  高估 (70-100°):', data2.composite.distribution.hot.percentage + '%');
    console.log('  平均温度:', data2.composite.distribution.average + '°');
    
    console.log('\n各指数数据点:');
    for (const [code, indexData] of Object.entries(data2.indices)) {
      console.log(`  ${indexData.name}: ${indexData.temperatures.length}个数据点, 平均${indexData.distribution.average}°`);
    }
  } catch (error) {
    console.error('测试2失败:', error.message);
  }

  console.log('\n');

  // 测试3: 单指数温度（对比）
  console.log('【测试3】单指数温度（沪深300）');
  console.log('-'.repeat(80));
  
  try {
    const res3 = await axios.get('http://localhost:3001/api/market-temperature?indexCode=000300.SH');
    const data3 = res3.data.data;
    
    console.log('沪深300温度:', data3.temperature + '°');
    console.log('PE温度:', data3.components.pe + '°');
    console.log('PB温度:', data3.components.pb + '°');
    console.log('PE值:', data3.values.pe?.toFixed(2));
    console.log('PB值:', data3.values.pb?.toFixed(2));
  } catch (error) {
    console.error('测试3失败:', error.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ 测试完成');
  console.log('='.repeat(80) + '\n');
}

testMultiIndexTemperature();
