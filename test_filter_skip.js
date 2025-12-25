/**
 * 验证未勾选ROE和负债率时是否真的跳过了筛选
 */

const axios = require('axios');

async function testFilterSkip() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 验证筛选跳过逻辑');
  console.log('='.repeat(80) + '\n');

  const params = {
    fundCode: '512890.SH',
    startDate: '20200101',
    endDate: '20201231', // 测试前两个调仓期
    strategyType: 'riskParity',
    volatilityWindow: 12,
    ewmaDecay: 0.94,
    rebalanceFrequency: 'yearly',
    enableTradingCost: false,
    enableStockFilter: true,
    minROE: 0,           // 不筛选ROE
    maxDebtRatio: 1.0,   // 不筛选负债率
    momentumMonths: 6,
    minMomentumReturn: -0.10,
    filterByQuality: true
  };

  console.log('测试参数:');
  console.log(`  minROE: ${params.minROE} (0表示不筛选)`);
  console.log(`  maxDebtRatio: ${params.maxDebtRatio} (1.0表示不筛选)`);
  console.log(`  momentumMonths: ${params.momentumMonths}`);
  console.log(`  minMomentumReturn: ${params.minMomentumReturn}`);
  console.log(`  filterByQuality: ${params.filterByQuality}`);

  try {
    const response = await axios.get('http://localhost:3001/api/index-returns', {
      params,
      timeout: 120000
    });

    if (response.data && response.data.success && response.data.data) {
      const data = response.data.data;
      
      if (data.periods && data.periods.length > 0) {
        const period = data.periods[0];
        
        console.log('\n第一个调仓期结果:');
        console.log(`  调仓日期: ${period.rebalanceDate}`);
        console.log(`  原始股票数: 50`);
        console.log(`  筛选后股票数: ${period.holdings ? period.holdings.length : 0}`);
        console.log(`  筛选掉股票数: ${period.filteredOutStocks ? period.filteredOutStocks.length : 0}`);
        
        // 检查筛选原因
        if (period.filteredOutStocks && period.filteredOutStocks.length > 0) {
          console.log('\n筛选原因统计:');
          const reasons = {};
          period.filteredOutStocks.forEach(stock => {
            const reason = stock.filterReason || '未知';
            reasons[reason] = (reasons[reason] || 0) + 1;
          });
          
          Object.entries(reasons).forEach(([reason, count]) => {
            console.log(`  ${reason}: ${count}只`);
          });
          
          // 检查是否有ROE或负债率相关的筛选原因
          const hasROEFilter = Object.keys(reasons).some(r => r.includes('ROE'));
          const hasDebtFilter = Object.keys(reasons).some(r => r.includes('负债率'));
          
          console.log('\n筛选验证:');
          console.log(`  是否应用了ROE筛选: ${hasROEFilter ? '❌ 是（不应该）' : '✅ 否（正确）'}`);
          console.log(`  是否应用了负债率筛选: ${hasDebtFilter ? '❌ 是（不应该）' : '✅ 否（正确）'}`);
          
          if (!hasROEFilter && !hasDebtFilter) {
            console.log('\n✅ 验证通过：未勾选时确实跳过了ROE和负债率筛选');
          } else {
            console.log('\n❌ 验证失败：未勾选时仍然应用了ROE或负债率筛选');
          }
        }
        
        // 显示前10只被筛选掉的股票
        if (period.filteredOutStocks && period.filteredOutStocks.length > 0) {
          console.log('\n前10只被筛选掉的股票:');
          period.filteredOutStocks.slice(0, 10).forEach(stock => {
            console.log(`  ${stock.ts_code.padEnd(12)} ${stock.name?.padEnd(10) || '未知'.padEnd(10)} 原因: ${stock.filterReason || '未知'}`);
          });
        }
      }
    }
  } catch (error) {
    console.log(`❌ 测试失败: ${error.message}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ 测试完成');
  console.log('='.repeat(80));
}

testFilterSkip().catch(console.error);
