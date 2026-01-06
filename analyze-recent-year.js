const dbService = require('./services/dbService');
const tushareService = require('./services/tushareService');

async function analyzeRecentYear() {
  try {
    await dbService.init();
    
    const indexCode = 'h30269.CSI';
    const testDate = '20251128'; // 最近的调仓日期
    
    console.log(`\n分析日期: ${testDate}\n`);
    
    // 获取成分股
    const stocks = await tushareService.getIndexWeightByDate(indexCode, testDate);
    const stockCodes = stocks.map(s => s.con_code);
    
    console.log(`成分股数量: ${stockCodes.length}`);
    console.log(`示例成分股: ${stockCodes.slice(0, 5).join(', ')}\n`);
    
    // 检查这些成分股的历史数据分布
    const [minDate] = await dbService.pool.execute(`
      SELECT MIN(trade_date) as min_date 
      FROM stock_basic_info 
      WHERE ts_code IN (${stockCodes.map(() => '?').join(',')})
    `, stockCodes);
    
    console.log(`数据库最早日期: ${minDate[0].min_date}\n`);
    
    // 获取历史数据
    const startDate = minDate[0].min_date;
    const historicalData = await dbService.getStockBasicInfoBatch(stockCodes, startDate, testDate);
    
    console.log(`历史数据总量: ${historicalData.length}条\n`);
    
    // 按日期分组统计PE
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
    
    // 计算每天的平均PE
    const dailyPEs = [];
    dateMap.forEach((pes, date) => {
      if (pes.length >= stockCodes.length * 0.5) {
        const avgPE = pes.reduce((sum, pe) => sum + pe, 0) / pes.length;
        dailyPEs.push({ date, pe: avgPE });
      }
    });
    
    dailyPEs.sort((a, b) => a.date.localeCompare(b.date));
    
    console.log(`有效PE数据: ${dailyPEs.length}天\n`);
    
    // 显示PE的分布
    const pes = dailyPEs.map(d => d.pe).sort((a, b) => a - b);
    console.log(`PE分布:`);
    console.log(`  最小值: ${pes[0].toFixed(2)}`);
    console.log(`  25%分位: ${pes[Math.floor(pes.length * 0.25)].toFixed(2)}`);
    console.log(`  50%分位: ${pes[Math.floor(pes.length * 0.5)].toFixed(2)}`);
    console.log(`  75%分位: ${pes[Math.floor(pes.length * 0.75)].toFixed(2)}`);
    console.log(`  最大值: ${pes[pes.length - 1].toFixed(2)}\n`);
    
    // 当前PE
    const currentPE = dailyPEs.find(d => d.date === testDate).pe;
    console.log(`当前PE (${testDate}): ${currentPE.toFixed(2)}`);
    
    // 计算分位数
    let rank = 0;
    for (let i = 0; i < pes.length; i++) {
      if (pes[i] < currentPE) {
        rank = i + 1;
      } else {
        break;
      }
    }
    const percentile = rank / pes.length;
    console.log(`PE温度: ${(percentile * 100).toFixed(1)}° (${(percentile * 100).toFixed(1)}%分位数)\n`);
    
    // 显示最近几天的PE
    console.log(`最近10天的PE:`);
    dailyPEs.slice(-10).forEach(d => {
      const rank = pes.filter(pe => pe < d.pe).length;
      const pct = (rank / pes.length * 100).toFixed(1);
      console.log(`  ${d.date}: ${d.pe.toFixed(2)} (${pct}%分位)`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

analyzeRecentYear();
