require('dotenv').config();
const tushareService = require('./services/tushareService');

async function test() {
  try {
    console.log('测试基金代码: 512890.SH\n');
    
    console.log('1. 测试基金基本信息...');
    const fundInfo = await tushareService.getFundBasic('512890.SH');
    console.log('基金信息:', fundInfo);
    
    console.log('\n2. 测试基金持仓...');
    const holdings = await tushareService.getFundHoldings('512890.SH');
    console.log(`持仓数量: ${holdings.length}`);
    if (holdings.length > 0) {
      console.log('第一条持仓:', holdings[0]);
      console.log('最后一条持仓:', holdings[holdings.length - 1]);
      
      // 统计报告期
      const reportDates = [...new Set(holdings.map(h => h.end_date))].sort();
      console.log('\n报告期列表:', reportDates);
    }
    
    console.log('\n3. 测试基金净值...');
    const navData = await tushareService.getFundNav('512890.SH', '20240101');
    console.log(`净值数据条数: ${navData.length}`);
    if (navData.length > 0) {
      console.log('最新净值:', navData[navData.length - 1]);
    }
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

test();
