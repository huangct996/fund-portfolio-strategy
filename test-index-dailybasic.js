const tushareService = require('./services/tushareService');

async function testIndexDailybasic() {
  try {
    console.log('\n测试index_dailybasic接口权限...\n');
    
    // 测试获取沪深300最近一天的数据
    const data = await tushareService.callApi('index_dailybasic', {
      ts_code: '000300.SH',
      start_date: '20251201',
      end_date: '20251231'
    });
    
    if (data && data.length > 0) {
      console.log('✅ 接口调用成功！');
      console.log(`获取到 ${data.length} 条数据\n`);
      console.log('示例数据:');
      console.log(JSON.stringify(data[0], null, 2));
      
      // 检查是否有PE/PB字段
      if (data[0].pe && data[0].pb) {
        console.log('\n✅ PE/PB数据可用！');
        console.log(`PE: ${data[0].pe}`);
        console.log(`PB: ${data[0].pb}`);
        console.log(`PE_TTM: ${data[0].pe_ttm || 'N/A'}`);
      } else {
        console.log('\n⚠️ 数据中没有PE/PB字段');
      }
    } else {
      console.log('⚠️ 接口返回空数据');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 接口调用失败:', error.message);
    
    if (error.message.includes('权限') || error.message.includes('积分')) {
      console.log('\n⚠️ 权限不足！');
      console.log('需要: 5000积分');
      console.log('请访问 https://tushare.pro 购买积分');
    }
    
    process.exit(1);
  }
}

testIndexDailybasic();
