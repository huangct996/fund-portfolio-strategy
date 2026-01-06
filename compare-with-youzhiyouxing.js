const marketThermometerService = require('./services/marketThermometerService');
const dbService = require('./services/dbService');

async function compareWithYouzhiyouxing() {
  try {
    await dbService.init();
    
    const indexCode = 'h30269.CSI';
    const testDate = '20251128';
    
    console.log(`\n分析当前温度计算 [${testDate}]\n`);
    
    // 获取成分股
    const tushareService = require('./services/tushareService');
    const stocks = await tushareService.getIndexWeightByDate(indexCode, testDate);
    const stockCodes = stocks.map(s => s.con_code);
    
    // 获取10年历史数据
    const startDate = marketThermometerService.getDateBefore(testDate, 3650);
    const historicalData = await dbService.getStockBasicInfoBatch(stockCodes, startDate, testDate);
    
    console.log(`历史数据范围: ${startDate} - ${testDate}`);
    console.log(`历史数据总量: ${historicalData.length}条\n`);
    
    // 分析PE数据
    const peData = historicalData.filter(d => {
      const pe = parseFloat(d.pe_ttm);
      return pe && pe > 0 && pe <= 200;
    });
    
    const pes = peData.map(d => parseFloat(d.pe_ttm)).sort((a, b) => a - b);
    
    console.log(`PE数据统计:`);
    console.log(`  有效数据: ${pes.length}条`);
    console.log(`  最小值: ${pes[0].toFixed(2)}`);
    console.log(`  10%分位: ${pes[Math.floor(pes.length * 0.1)].toFixed(2)}`);
    console.log(`  25%分位: ${pes[Math.floor(pes.length * 0.25)].toFixed(2)}`);
    console.log(`  50%分位: ${pes[Math.floor(pes.length * 0.5)].toFixed(2)}`);
    console.log(`  75%分位: ${pes[Math.floor(pes.length * 0.75)].toFixed(2)}`);
    console.log(`  90%分位: ${pes[Math.floor(pes.length * 0.9)].toFixed(2)}`);
    console.log(`  最大值: ${pes[pes.length - 1].toFixed(2)}\n`);
    
    // 按日期分组计算中位数PE
    const dateMap = new Map();
    peData.forEach(item => {
      const pe = parseFloat(item.pe_ttm);
      if (!dateMap.has(item.trade_date)) {
        dateMap.set(item.trade_date, []);
      }
      dateMap.get(item.trade_date).push(pe);
    });
    
    const dailyPEs = [];
    dateMap.forEach((pes, date) => {
      if (pes.length >= stockCodes.length * 0.2) {
        const sortedPEs = pes.sort((a, b) => a - b);
        const medianPE = sortedPEs.length % 2 === 0
          ? (sortedPEs[sortedPEs.length / 2 - 1] + sortedPEs[sortedPEs.length / 2]) / 2
          : sortedPEs[Math.floor(sortedPEs.length / 2)];
        dailyPEs.push({ date, pe: medianPE });
      }
    });
    
    dailyPEs.sort((a, b) => a.date.localeCompare(b.date));
    
    console.log(`每日中位数PE统计:`);
    console.log(`  有效日期: ${dailyPEs.length}天`);
    
    const dailyPEValues = dailyPEs.map(d => d.pe).sort((a, b) => a - b);
    console.log(`  最小值: ${dailyPEValues[0].toFixed(2)}`);
    console.log(`  中位数: ${dailyPEValues[Math.floor(dailyPEValues.length * 0.5)].toFixed(2)}`);
    console.log(`  最大值: ${dailyPEValues[dailyPEValues.length - 1].toFixed(2)}\n`);
    
    // 当前日期的PE
    const currentData = dailyPEs.find(d => d.date === testDate);
    if (currentData) {
      const currentPE = currentData.pe;
      const rank = dailyPEValues.filter(pe => pe < currentPE).length;
      const percentile = rank / dailyPEValues.length;
      
      console.log(`当前PE分析:`);
      console.log(`  当前PE: ${currentPE.toFixed(2)}`);
      console.log(`  排名: ${rank}/${dailyPEValues.length}`);
      console.log(`  分位数: ${(percentile * 100).toFixed(1)}%`);
      console.log(`  温度: ${(percentile * 100).toFixed(1)}°\n`);
    }
    
    // 问题分析
    console.log(`问题分析:`);
    console.log(`  1. 当前PE=${currentData.pe.toFixed(2)}，历史最大值=${dailyPEValues[dailyPEValues.length-1].toFixed(2)}`);
    console.log(`  2. 当前PE非常接近历史最大值，所以温度接近100°`);
    console.log(`  3. 有知有行温度69°说明他们的历史数据更长（可能15-20年）`);
    console.log(`  4. 或者他们使用了不同的平滑方法\n`);
    
    console.log(`解决方案:`);
    console.log(`  方案1: 扩展历史数据到2010年之前（需要更多数据）`);
    console.log(`  方案2: 使用对数变换平滑极端值`);
    console.log(`  方案3: 限制温度上限为95°（避免100°）`);
    
    process.exit(0);
  } catch (error) {
    console.error('错误:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

compareWithYouzhiyouxing();
