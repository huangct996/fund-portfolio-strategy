/**
 * 调试参数传递
 * 检查前端传递的参数是否正确
 */

const axios = require('axios');

async function debugParams() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 调试参数传递');
  console.log('='.repeat(80) + '\n');

  const params = {
    fundCode: '512890.SH',
    startDate: '20200101',
    endDate: '20201231',
    strategyType: 'riskParity',
    volatilityWindow: 12,
    ewmaDecay: 0.94,
    rebalanceFrequency: 'yearly',
    enableTradingCost: false,
    enableStockFilter: true,
    minROE: 0,           // 明确设置为0
    maxDebtRatio: 1.0,   // 明确设置为1.0
    momentumMonths: 6,
    minMomentumReturn: -0.10,
    filterByQuality: true
  };

  console.log('发送的参数:');
  console.log(JSON.stringify(params, null, 2));

  try {
    // 拦截请求，查看实际发送的参数
    const url = 'http://localhost:3001/api/index-returns';
    const queryString = new URLSearchParams(params).toString();
    console.log('\n完整URL:');
    console.log(`${url}?${queryString}`);
    
    console.log('\n关键参数检查:');
    console.log(`  minROE: ${params.minROE} (类型: ${typeof params.minROE})`);
    console.log(`  maxDebtRatio: ${params.maxDebtRatio} (类型: ${typeof params.maxDebtRatio})`);
    console.log(`  minROE > 0: ${params.minROE > 0}`);
    console.log(`  maxDebtRatio < 1: ${params.maxDebtRatio < 1}`);

    const response = await axios.get(url, {
      params,
      timeout: 120000
    });

    if (response.data && response.data.success && response.data.data) {
      const data = response.data.data;
      
      if (data.periods && data.periods.length > 0) {
        const period = data.periods[0];
        
        console.log('\n第一个调仓期结果:');
        console.log(`  筛选掉股票数: ${period.filteredOutStocks ? period.filteredOutStocks.length : 0}`);
        
        // 统计筛选原因
        if (period.filteredOutStocks && period.filteredOutStocks.length > 0) {
          const reasons = {};
          period.filteredOutStocks.forEach(stock => {
            const reason = stock.filterReason || '未知';
            reasons[reason] = (reasons[reason] || 0) + 1;
          });
          
          console.log('\n筛选原因统计:');
          Object.entries(reasons).forEach(([reason, count]) => {
            const isROE = reason.includes('ROE');
            const isDebt = reason.includes('负债率');
            const marker = (isROE || isDebt) ? ' ⚠️' : '';
            console.log(`  ${reason}: ${count}只${marker}`);
          });
        }
      }
    }
  } catch (error) {
    console.log(`❌ 测试失败: ${error.message}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ 调试完成');
  console.log('='.repeat(80));
}

debugParams().catch(console.error);
