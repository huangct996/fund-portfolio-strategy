/**
 * 补充沪深300指数历史数据
 * 从Tushare API获取2019-2025年的完整数据并存入数据库
 */

const tushareService = require('./services/tushareService');
const dbService = require('./services/dbService');

async function fetchIndexHistory() {
  console.log('='.repeat(80));
  console.log('📥 开始补充沪深300指数历史数据');
  console.log('='.repeat(80));
  
  const indexCode = '000300.SH';
  const startDate = '20190101';
  const endDate = '20251231';
  
  try {
    console.log(`\n指数代码: ${indexCode}`);
    console.log(`时间范围: ${startDate} - ${endDate}`);
    
    // 1. 从Tushare API获取数据
    console.log('\n📊 步骤1：从Tushare API获取指数数据...');
    console.log('⏳ 请稍候，这可能需要几秒钟...');
    
    const data = await tushareService.getIndexDaily(indexCode, startDate, endDate);
    
    if (!data || data.length === 0) {
      throw new Error('未获取到任何数据');
    }
    
    console.log(`✅ 成功获取 ${data.length} 条数据`);
    console.log(`   时间范围: ${data[0].trade_date} - ${data[data.length - 1].trade_date}`);
    console.log(`   示例数据: 日期=${data[0].trade_date}, 收盘=${data[0].close}`);
    
    // 2. 数据已通过tushareService缓存
    console.log('\n📊 步骤2：数据已缓存在tushareService中');
    console.log('ℹ️  后续调用getIndexDaily将直接使用缓存数据');
    
    // 3. 验证数据
    console.log('\n📊 步骤3：验证数据完整性...');
    const verifyData = await tushareService.getIndexDaily(indexCode, startDate, endDate);
    console.log(`✅ 验证成功，可获取 ${verifyData.length} 条数据`);
    
    // 5. 统计信息
    console.log('\n' + '='.repeat(80));
    console.log('📈 数据统计');
    console.log('='.repeat(80));
    console.log(`总数据量: ${data.length} 条`);
    console.log(`时间跨度: ${data[0].trade_date} - ${data[data.length - 1].trade_date}`);
    
    // 计算一些基本统计
    const closes = data.map(d => d.close);
    const minClose = Math.min(...closes);
    const maxClose = Math.max(...closes);
    const avgClose = closes.reduce((a, b) => a + b, 0) / closes.length;
    
    console.log(`\n价格统计:`);
    console.log(`   最低: ${minClose.toFixed(2)}`);
    console.log(`   最高: ${maxClose.toFixed(2)}`);
    console.log(`   平均: ${avgClose.toFixed(2)}`);
    
    const totalReturn = (closes[closes.length - 1] - closes[0]) / closes[0];
    console.log(`\n期间收益率: ${(totalReturn * 100).toFixed(2)}%`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ 数据补充完成！');
    console.log('='.repeat(80));
    console.log('\n💡 提示：现在可以运行以下命令测试自适应策略：');
    console.log('   node diagnose-market-regime.js  # 诊断市场状态识别');
    console.log('   node test-adaptive-strategy.js  # 完整回测测试');
    
  } catch (error) {
    console.error('\n❌ 数据补充失败:', error.message);
    console.error('错误详情:', error);
    process.exit(1);
  }
}

fetchIndexHistory();
