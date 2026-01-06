/**
 * 同步指数基本指标数据（PE/PB等）
 */
const tushareService = require('../services/tushareService');

async function syncIndexBasicData() {
  try {
    console.log('\n🚀 开始同步指数基本指标数据...\n');
    
    const indexCode = 'h30269.CSI'; // 中证红利低波100指数
    // 转换指数代码格式：h30269.CSI -> 930269.CSI
    const tushareIndexCode = indexCode.replace('h', '9');
    const endDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    
    // 同步10年数据（2轮完整牛熊周期）
    const startDate = getDateBefore(endDate, 3650);
    
    console.log(`📊 指数代码: ${indexCode} (Tushare: ${tushareIndexCode})`);
    console.log(`📅 时间范围: ${startDate} - ${endDate}`);
    console.log(`⏱️  预计同步约2500条数据...\n`);
    
    // 调用同步方法
    const data = await tushareService.getIndexDailyBasic(tushareIndexCode, startDate, endDate);
    
    if (data && data.length > 0) {
      console.log(`\n✅ 同步完成！共同步 ${data.length} 条数据`);
      console.log(`\n示例数据（最新一条）:`);
      console.log(JSON.stringify(data[data.length - 1], null, 2));
      
      // 统计有效PE/PB数据
      const validPE = data.filter(d => d.pe_ttm && d.pe_ttm > 0).length;
      const validPB = data.filter(d => d.pb && d.pb > 0).length;
      console.log(`\n📈 有效PE数据: ${validPE}条`);
      console.log(`📈 有效PB数据: ${validPB}条`);
    } else {
      console.log('\n⚠️  未获取到数据');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 同步失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function getDateBefore(date, days) {
  const d = new Date(
    parseInt(date.substring(0, 4)),
    parseInt(date.substring(4, 6)) - 1,
    parseInt(date.substring(6, 8))
  );
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

// 执行同步
syncIndexBasicData();
