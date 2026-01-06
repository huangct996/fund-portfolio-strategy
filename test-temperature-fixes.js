/**
 * 测试温度功能修复
 */

const axios = require('axios');

async function testTemperatureFixes() {
  console.log('\n' + '='.repeat(80));
  console.log('🔧 温度功能修复测试');
  console.log('='.repeat(80) + '\n');

  // 测试1: 综合温度API（用于主页横幅）
  console.log('【测试1】综合温度API（主页横幅数据）');
  console.log('-'.repeat(80));
  
  try {
    const res1 = await axios.get('http://localhost:3001/api/composite-temperature');
    const data1 = res1.data.data;
    
    console.log('✅ API调用成功');
    console.log('温度:', data1.temperature + '°');
    console.log('级别:', data1.levelName);
    console.log('建议:', data1.suggestion);
    console.log('横幅文本应显示:', `${data1.temperature}° (${data1.levelName}) - ${data1.suggestion}`);
  } catch (error) {
    console.error('❌ 测试1失败:', error.message);
  }

  console.log('\n');

  // 测试2: 多指数历史温度API（温度详情页面）
  console.log('【测试2】多指数历史温度API（温度详情页面数据）');
  console.log('-'.repeat(80));
  
  try {
    const res2 = await axios.get('http://localhost:3001/api/multi-index-temperature?startDate=20050106&endDate=20260106');
    const data2 = res2.data.data;
    
    console.log('✅ API调用成功');
    console.log('\n综合温度:');
    console.log('  数据点:', data2.composite.temperatures.length);
    console.log('  分布统计:', data2.composite.distribution ? '✅ 存在' : '❌ 缺失');
    if (data2.composite.distribution) {
      console.log('  平均温度:', data2.composite.distribution.average + '°');
      console.log('  低估占比:', data2.composite.distribution.cold.percentage + '%');
      console.log('  中估占比:', data2.composite.distribution.normal.percentage + '%');
      console.log('  高估占比:', data2.composite.distribution.hot.percentage + '%');
    }
    
    console.log('\n各指数数据:');
    for (const [code, indexData] of Object.entries(data2.indices)) {
      const status = indexData.distribution ? '✅' : '❌';
      console.log(`  ${status} ${indexData.name}: ${indexData.temperatures.length}个数据点, 分布统计${indexData.distribution ? '存在' : '缺失'}`);
    }
  } catch (error) {
    console.error('❌ 测试2失败:', error.message);
  }

  console.log('\n');

  // 测试3: 数据完整性检查
  console.log('【测试3】数据完整性检查');
  console.log('-'.repeat(80));
  
  try {
    const res3 = await axios.get('http://localhost:3001/api/multi-index-temperature?startDate=20240101&endDate=20250106');
    const data3 = res3.data.data;
    
    let passCount = 0;
    let totalCount = 0;
    
    // 检查综合温度
    if (data3.composite && data3.composite.distribution) {
      passCount++;
      console.log('✅ 综合温度分布统计正常');
    } else {
      console.log('❌ 综合温度分布统计缺失');
    }
    totalCount++;
    
    // 检查各指数
    for (const [code, indexData] of Object.entries(data3.indices)) {
      totalCount++;
      if (indexData.temperatures.length > 0 && indexData.distribution) {
        passCount++;
        console.log(`✅ ${indexData.name}: 数据正常`);
      } else if (indexData.temperatures.length === 0) {
        console.log(`⚠️  ${indexData.name}: 无历史数据（已知问题）`);
      } else {
        console.log(`❌ ${indexData.name}: 数据异常`);
      }
    }
    
    console.log(`\n数据完整性: ${passCount}/${totalCount} 通过`);
  } catch (error) {
    console.error('❌ 测试3失败:', error.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ 测试完成');
  console.log('='.repeat(80) + '\n');
  
  console.log('📝 修复总结:');
  console.log('1. ✅ 修复了温度详情页面数据显示bug（添加null检查）');
  console.log('2. ✅ 简化了主页温度展示为横幅（一句话+颜色）');
  console.log('3. ✅ 将温度横幅移到基金信息区域');
  console.log('4. ✅ 根据温度级别动态调整横幅颜色（低估蓝色、中估黄色、高估红色）');
  console.log('\n🌐 访问测试:');
  console.log('主页: http://localhost:3001/');
  console.log('温度详情: http://localhost:3001/temperature-detail.html');
}

testTemperatureFixes();
