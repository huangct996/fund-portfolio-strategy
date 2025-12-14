require('dotenv').config();
const tushareService = require('./services/tushareService');

async function testReportPeriods() {
  console.log('========================================');
  console.log('测试报告期数据');
  console.log('========================================\n');

  const fundCode = '512890.SH';
  
  try {
    // 获取持仓数据
    const holdings = await tushareService.getFundHoldings(fundCode);
    
    // 按报告期分组
    const groupedHoldings = {};
    holdings.forEach(h => {
      if (!groupedHoldings[h.end_date]) {
        groupedHoldings[h.end_date] = [];
      }
      groupedHoldings[h.end_date].push(h);
    });
    
    // 获取所有报告期并排序
    const reportDates = Object.keys(groupedHoldings).sort();
    
    console.log(`共 ${reportDates.length} 个报告期\n`);
    
    // 显示前10个报告期的详细信息
    reportDates.slice(0, 10).forEach((reportDate, index) => {
      const reportHoldings = groupedHoldings[reportDate];
      const totalWeight = reportHoldings.reduce((sum, h) => sum + (parseFloat(h.stk_mkv_ratio) || 0), 0);
      const isPartial = totalWeight < 50;
      
      console.log(`${index + 1}. 报告期: ${reportDate}`);
      console.log(`   披露日期: ${reportHoldings[0].ann_date}`);
      console.log(`   持仓数量: ${reportHoldings.length} 只`);
      console.log(`   权重总和: ${totalWeight.toFixed(2)}%`);
      console.log(`   是否部分披露: ${isPartial ? '是 ⚠️' : '否 ✅'}`);
      
      if (reportHoldings.length <= 10) {
        console.log(`   前10只股票:`);
        reportHoldings.forEach((h, i) => {
          console.log(`     ${i+1}. ${h.symbol}: 权重=${h.stk_mkv_ratio}%`);
        });
      }
      console.log('');
    });
    
    // 找出第一个完整披露的报告期
    let firstCompleteReportDate = null;
    let firstCompleteDisclosureDate = null;
    
    for (const reportDate of reportDates) {
      const reportHoldings = groupedHoldings[reportDate];
      const totalWeight = reportHoldings.reduce((sum, h) => sum + (parseFloat(h.stk_mkv_ratio) || 0), 0);
      
      if (totalWeight >= 50) {
        firstCompleteReportDate = reportDate;
        firstCompleteDisclosureDate = reportHoldings[0].ann_date;
        break;
      }
    }
    
    console.log('========================================');
    console.log('【第一个完整披露的报告期】');
    console.log(`报告期: ${firstCompleteReportDate}`);
    console.log(`披露日期: ${firstCompleteDisclosureDate}`);
    console.log('========================================');
    
  } catch (error) {
    console.error('测试失败:', error.message);
  }
}

testReportPeriods();
