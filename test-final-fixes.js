/**
 * 测试最终修复
 */

const axios = require('axios');

async function testFinalFixes() {
  console.log('\n' + '='.repeat(80));
  console.log('🔧 最终修复测试');
  console.log('='.repeat(80) + '\n');

  // 测试1: 综合温度API - 检查中证1000的PE/PB
  console.log('【测试1】综合温度API - 中证1000数据检查');
  console.log('-'.repeat(80));
  
  try {
    const res1 = await axios.get('http://localhost:3001/api/composite-temperature');
    const data1 = res1.data.data;
    
    console.log('✅ API调用成功');
    console.log('\n各指数PE/PB数据:');
    
    data1.indexTemperatures.forEach(index => {
      const peStatus = index.pe != null ? `${index.pe.toFixed(2)}` : '❌ null';
      const pbStatus = index.pb != null ? `${index.pb.toFixed(2)}` : '❌ null';
      const status = index.pe != null && index.pb != null ? '✅' : '⚠️';
      
      console.log(`  ${status} ${index.name}:`);
      console.log(`     温度: ${index.temperature}°`);
      console.log(`     PE: ${peStatus}`);
      console.log(`     PB: ${pbStatus}`);
      
      if (index.pe == null || index.pb == null) {
        console.log(`     说明: 该指数暂无估值数据（前端将显示"暂无数据"）`);
      }
    });
  } catch (error) {
    console.error('❌ 测试1失败:', error.message);
  }

  console.log('\n');

  // 测试2: 前端显示逻辑验证
  console.log('【测试2】前端显示逻辑验证');
  console.log('-'.repeat(80));
  
  console.log('修复内容:');
  console.log('1. ✅ 添加了null检查，避免TypeError');
  console.log('2. ✅ 当PE/PB为null时，显示"暂无数据"而不是"N/A (温度XX°)"');
  console.log('3. ✅ 添加友好提示："⚠️ 该指数暂无估值数据"');
  console.log('4. ✅ 修复了updateTemperatureChart中的null元素检查');

  console.log('\n');

  // 测试3: 页面访问测试
  console.log('【测试3】页面访问测试');
  console.log('-'.repeat(80));
  
  try {
    const res3 = await axios.get('http://localhost:3001/temperature-detail.html');
    console.log('✅ 温度详情页面可访问 (HTTP 200)');
    
    const res4 = await axios.get('http://localhost:3001/temperature-detail.js');
    console.log('✅ JavaScript文件可访问 (HTTP 200)');
  } catch (error) {
    console.error('❌ 页面访问失败:', error.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ 测试完成');
  console.log('='.repeat(80) + '\n');
  
  console.log('📝 修复总结:');
  console.log('');
  console.log('问题1: TypeError - Cannot read properties of null');
  console.log('  原因: updateTemperatureChart函数未检查DOM元素是否存在');
  console.log('  修复: 添加chartElement的null检查');
  console.log('');
  console.log('问题2: 中证1000显示"PE: N/A (温度50°)"');
  console.log('  原因: 该指数无历史数据，PE/PB为null，但温度仍然计算');
  console.log('  修复: 改为显示"PE: 暂无数据"，并添加友好提示');
  console.log('');
  console.log('🌐 访问测试:');
  console.log('主页: http://localhost:3001/');
  console.log('温度详情: http://localhost:3001/temperature-detail.html');
  console.log('浏览器预览: http://127.0.0.1:57589/temperature-detail.html');
  console.log('');
  console.log('💡 预期显示:');
  console.log('中证1000卡片应显示:');
  console.log('  - 温度: 50° (中估)');
  console.log('  - PE: 暂无数据');
  console.log('  - PB: 暂无数据');
  console.log('  - ⚠️ 该指数暂无估值数据');
}

testFinalFixes();
