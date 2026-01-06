/**
 * 批量同步指数每日估值指标数据
 * 使用场景：首次初始化或定期更新指数PE/PB数据
 */

const tushareService = require('../services/tushareService');
const dbService = require('../services/dbService');

async function syncIndexDailybasic() {
  try {
    await dbService.init();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 开始同步指数每日估值指标数据');
    console.log('='.repeat(60) + '\n');
    
    // 定义要同步的指数
    const indices = [
      { code: '000300.SH', name: '沪深300' },
      { code: '000905.SH', name: '中证500' },
      { code: '000852.SH', name: '中证1000' },
      { code: '000001.SH', name: '上证指数' },
      { code: '399001.SZ', name: '深证成指' }
    ];
    
    // 同步时间范围：从2005年到今天（20年数据）
    const startDate = '20050101';
    const endDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    console.log(`同步时间范围: ${startDate} - ${endDate}\n`);
    
    // 批量同步
    for (const index of indices) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`正在同步: ${index.name} (${index.code})`);
      console.log('='.repeat(60));
      
      try {
        const data = await tushareService.getIndexDailybasic(index.code, startDate, endDate);
        console.log(`✅ ${index.name} 同步完成，共 ${data.length} 条数据`);
        
        // 统计数据
        if (data.length > 0) {
          const validData = data.filter(d => d.pe && d.pb);
          const avgPE = (validData.reduce((sum, d) => sum + parseFloat(d.pe_ttm || d.pe), 0) / validData.length).toFixed(2);
          const avgPB = (validData.reduce((sum, d) => sum + parseFloat(d.pb), 0) / validData.length).toFixed(2);
          
          console.log(`   有效数据: ${validData.length} 条`);
          console.log(`   平均PE: ${avgPE}`);
          console.log(`   平均PB: ${avgPB}`);
          console.log(`   最早日期: ${data[0].trade_date}`);
          console.log(`   最新日期: ${data[data.length - 1].trade_date}`);
        }
        
        // 每个指数间隔1秒，避免频繁调用
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ ${index.name} 同步失败:`, error.message);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 所有指数同步完成！');
    console.log('='.repeat(60) + '\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 同步失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行同步
syncIndexDailybasic();
