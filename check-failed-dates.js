const dbService = require('./services/dbService');
const tushareService = require('./services/tushareService');

async function checkFailedDates() {
  try {
    await dbService.init();
    
    const failedDates = ['20151231', '20160331', '20171229', '20180131'];
    const indexCode = 'h30269.CSI';
    
    for (const date of failedDates) {
      console.log(`\n检查日期: ${date}`);
      
      // 1. 检查是否有成分股数据
      const stocks = await tushareService.getIndexWeightByDate(indexCode, date);
      console.log(`  成分股数量: ${stocks ? stocks.length : 0}`);
      
      if (stocks && stocks.length > 0) {
        // 2. 检查成分股的PE/PB数据
        const stockCodes = stocks.map(s => s.con_code);
        const startDate = date.substring(0, 4) + '0101';
        
        const data = await dbService.getStockBasicInfoBatch(stockCodes, startDate, date);
        console.log(`  PE/PB数据量: ${data.length}条`);
        
        // 3. 统计有效数据
        const validPE = data.filter(d => d.pe_ttm && parseFloat(d.pe_ttm) > 0).length;
        const validPB = data.filter(d => d.pb && parseFloat(d.pb) > 0).length;
        console.log(`  有效PE: ${validPE}条, 有效PB: ${validPB}条`);
        
        // 4. 按日期分组
        const dateMap = new Map();
        data.forEach(item => {
          const pe = parseFloat(item.pe_ttm);
          if (pe && pe > 0) {
            if (!dateMap.has(item.trade_date)) {
              dateMap.set(item.trade_date, []);
            }
            dateMap.get(item.trade_date).push(pe);
          }
        });
        
        console.log(`  有效日期数: ${dateMap.size}`);
        
        // 5. 检查当前日期是否有数据
        if (dateMap.has(date)) {
          console.log(`  ✅ 当前日期有数据: ${dateMap.get(date).length}只股票`);
        } else {
          console.log(`  ❌ 当前日期无数据`);
          console.log(`  可用日期: ${Array.from(dateMap.keys()).slice(0, 5).join(', ')}`);
        }
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    process.exit(1);
  }
}

checkFailedDates();
