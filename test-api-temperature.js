/**
 * 测试市场温度计API接口
 */

const axios = require('axios');

async function testTemperatureAPI() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🌡️ 测试市场温度计API接口');
    console.log('='.repeat(60) + '\n');
    
    const baseUrl = 'http://localhost:3001/api';
    
    // 测试1：获取当前市场温度（使用有数据的日期）
    console.log('【测试1】获取2025年12月31日的市场温度\n');
    
    const currentTemp = await axios.get(`${baseUrl}/market-temperature`, {
      params: {
        indexCode: '000300.SH'
      }
    });
    
    if (currentTemp.data.success) {
      const data = currentTemp.data.data;
      console.log(`✅ 当前温度: ${data.temperature}° (${data.levelName})`);
      console.log(`   PE: ${data.values.pe} (温度${data.components.pe}°)`);
      console.log(`   PB: ${data.values.pb} (温度${data.components.pb}°)`);
      console.log(`   置信度: ${(data.confidence * 100).toFixed(0)}%`);
      console.log(`   建议: ${data.suggestion}`);
    } else {
      console.log('❌ 获取失败:', currentTemp.data.error);
    }
    
    // 测试2：获取近1年历史温度
    console.log('\n\n【测试2】获取近1年历史温度\n');
    
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const startDate = oneYearAgo.toISOString().slice(0, 10).replace(/-/g, '');
    const endDate = '20251231';
    
    const historicalTemp = await axios.get(`${baseUrl}/historical-temperature`, {
      params: {
        indexCode: '000300.SH',
        startDate,
        endDate
      }
    });
    
    if (historicalTemp.data.success) {
      const { temperatures, distribution } = historicalTemp.data.data;
      
      console.log(`✅ 获取到 ${temperatures.length} 个温度点`);
      console.log('\n温度分布:');
      console.log(`   低估区间(0-30°): ${distribution.cold.count}次 (${distribution.cold.percentage}%)`);
      console.log(`   中估区间(30-70°): ${distribution.normal.count}次 (${distribution.normal.percentage}%)`);
      console.log(`   高估区间(70-100°): ${distribution.hot.count}次 (${distribution.hot.percentage}%)`);
      console.log(`   平均温度: ${distribution.avgTemperature}°`);
      
      // 显示最近5个温度点
      console.log('\n最近5个温度点:');
      const recent5 = temperatures.slice(-5);
      recent5.forEach(t => {
        console.log(`   ${t.date}: ${t.temperature}° (${t.level}) - PE:${t.components.pe}° PB:${t.components.pb}°`);
      });
    } else {
      console.log('❌ 获取失败:', historicalTemp.data.error);
    }
    
    // 测试3：对比不同指数
    console.log('\n\n【测试3】对比不同指数的温度\n');
    
    const indices = [
      { code: '000300.SH', name: '沪深300' },
      { code: '000905.SH', name: '中证500' },
      { code: '000001.SH', name: '上证指数' }
    ];
    
    for (const index of indices) {
      try {
        const temp = await axios.get(`${baseUrl}/historical-temperature`, {
          params: {
            indexCode: index.code,
            startDate: '20251201',
            endDate: '20251231'
          }
        });
        
        if (temp.data.success) {
          const dist = temp.data.data.distribution;
          console.log(`${index.name}: 平均温度 ${dist.avgTemperature}°`);
        }
      } catch (error) {
        console.log(`${index.name}: 获取失败`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ API测试完成！');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    if (error.response) {
      console.error('响应数据:', error.response.data);
    }
  }
}

testTemperatureAPI();
