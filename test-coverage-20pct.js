const dbService = require('./services/dbService');
const tushareService = require('./services/tushareService');

async function testCoverage20Pct() {
  try {
    await dbService.init();
    
    const indexCode = 'h30269.CSI';
    const testDate = '20251128';
    
    const stocks = await tushareService.getIndexWeightByDate(indexCode, testDate);
    const stockCodes = stocks.map(s => s.con_code);
    
    console.log(`\n成分股数量: ${stockCodes.length}`);
    console.log(`20%覆盖率要求: ${Math.ceil(stockCodes.length * 0.2)}只股票\n`);
    
    const startDate = '20151231';
    const historicalData = await dbService.getStockBasicInfoBatch(stockCodes, startDate, testDate);
    
    // 按日期分组
    const dateMap = new Map();
    historicalData.forEach(item => {
      const pe = parseFloat(item.pe_ttm);
      if (pe && pe > 0) {
        if (!dateMap.has(item.trade_date)) {
          dateMap.set(item.trade_date, []);
        }
        dateMap.get(item.trade_date).push(pe);
      }
    });
    
    // 计算每天的平均PE（20%覆盖率）
    const dailyPEs = [];
    dateMap.forEach((pes, date) => {
      if (pes.length >= stockCodes.length * 0.2) {
        const avgPE = pes.reduce((sum, pe) => sum + pe, 0) / pes.length;
        dailyPEs.push({ date, pe: avgPE, count: pes.length });
      }
    });
    
    dailyPEs.sort((a, b) => a.date.localeCompare(b.date));
    
    console.log(`有效PE数据: ${dailyPEs.length}天\n`);
    
    // 显示前10天和后10天
    console.log('前10天:');
    dailyPEs.slice(0, 10).forEach(d => {
      console.log(`  ${d.date}: PE=${d.pe.toFixed(2)}, 股票数=${d.count}`);
    });
    
    console.log('\n后10天:');
    dailyPEs.slice(-10).forEach(d => {
      console.log(`  ${d.date}: PE=${d.pe.toFixed(2)}, 股票数=${d.count}`);
    });
    
    // PE分布
    const pes = dailyPEs.map(d => d.pe).sort((a, b) => a - b);
    console.log(`\nPE分布:`);
    console.log(`  最小值: ${pes[0].toFixed(2)}`);
    console.log(`  中位数: ${pes[Math.floor(pes.length * 0.5)].toFixed(2)}`);
    console.log(`  最大值: ${pes[pes.length - 1].toFixed(2)}`);
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testCoverage20Pct();
