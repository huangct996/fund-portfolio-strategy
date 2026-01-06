const dbService = require('./services/dbService');
const tushareService = require('./services/tushareService');

async function debugPECalculation() {
  try {
    await dbService.init();
    
    const indexCode = 'h30269.CSI';
    const date = '20251128';
    const startDate = '20151130';
    
    console.log('\n🔍 调试PE计算过程\n');
    
    // 1. 获取成分股
    const stocks = await tushareService.getIndexWeightByDate(indexCode, date);
    const stockCodes = stocks.map(s => s.con_code);
    console.log(`成分股数量: ${stockCodes.length}`);
    console.log(`前3只: ${stockCodes.slice(0, 3).join(', ')}\n`);
    
    // 2. 获取历史数据
    const historicalData = await dbService.getStockBasicInfoBatch(stockCodes, startDate, date);
    console.log(`历史数据总量: ${historicalData.length}条\n`);
    
    // 3. 按日期分组
    const dateMap = new Map();
    historicalData.forEach(item => {
      if (!item.pe_ttm || item.pe_ttm <= 0) return;
      
      if (!dateMap.has(item.trade_date)) {
        dateMap.set(item.trade_date, []);
      }
      dateMap.get(item.trade_date).push(item.pe_ttm);
    });
    
    console.log(`有效日期数: ${dateMap.size}`);
    
    // 4. 计算每天的平均PE
    const dailyPEs = [];
    dateMap.forEach((pes, tradeDate) => {
      if (pes.length >= stockCodes.length * 0.5) {
        const avgPE = pes.reduce((sum, pe) => sum + pe, 0) / pes.length;
        dailyPEs.push({ date: tradeDate, pe: avgPE });
      }
    });
    
    console.log(`满足条件的日期数: ${dailyPEs.length}\n`);
    
    // 5. 查看最近几天的数据
    const recentPEs = dailyPEs.slice(-5);
    console.log('最近5天的PE:');
    recentPEs.forEach(d => {
      console.log(`  ${d.date}: ${d.pe.toFixed(2)}`);
    });
    
    // 6. 查找当前日期的数据
    console.log(`\n查找日期 ${date} 的数据...`);
    const currentData = dailyPEs.find(d => d.date === date);
    if (currentData) {
      console.log(`✅ 找到: PE = ${currentData.pe}`);
      console.log(`   类型: ${typeof currentData.pe}`);
    } else {
      console.log(`❌ 未找到`);
      console.log(`   可用的最近日期:`);
      dailyPEs.slice(-3).forEach(d => {
        console.log(`     ${d.date}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

debugPECalculation();
