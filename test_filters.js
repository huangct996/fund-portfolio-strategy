/**
 * 测试股票池筛选功能
 * 验证ROE、负债率、动量、质量得分筛选是否都有数据和效果
 */

const axios = require('axios');

async function testFilters() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 开始测试股票池筛选功能');
  console.log('='.repeat(80) + '\n');

  try {
    // 测试参数：启用所有筛选条件
    const params = {
      fundCode: '512890.SH',
      startDate: '20230101',
      endDate: '20231231',
      strategyType: 'riskParity',
      volatilityWindow: 12,
      ewmaDecay: 0.94,
      rebalanceFrequency: 'yearly',
      enableTradingCost: false,
      tradingCostRate: 0,
      riskFreeRate: 0.02,
      // 启用股票池筛选
      enableStockFilter: true,
      minROE: 0.08,  // 8%
      maxDebtRatio: 0.60,  // 60%
      momentumMonths: 6,
      minMomentumReturn: -0.10,  // -10%
      filterByQuality: true
    };

    console.log('📋 测试参数:');
    console.log('   启用股票池筛选: true');
    console.log('   最低ROE: 8%');
    console.log('   最高负债率: 60%');
    console.log('   动量期间: 6个月');
    console.log('   最低动量收益率: -10%');
    console.log('   剔除质量得分低于中位数: true');
    console.log('\n正在调用API...\n');

    const response = await axios.get('http://localhost:3001/api/index-returns', {
      params,
      timeout: 120000  // 2分钟超时
    });

    console.log('API响应数据结构:', Object.keys(response.data));
    
    if (response.data && response.data.success && response.data.data && response.data.data.periods) {
      console.log('\n' + '='.repeat(80));
      console.log('✅ API调用成功');
      console.log('='.repeat(80) + '\n');

      const periods = response.data.data.periods;
      console.log(`📊 返回了 ${periods.length} 个调仓期的数据\n`);

      // 检查每个调仓期的筛选结果
      periods.forEach((period, index) => {
        console.log(`\n📅 调仓期 ${index + 1}: ${period.rebalanceDate}`);
        console.log('─'.repeat(60));
        
        if (period.filteredOutStocks && period.filteredOutStocks.length > 0) {
          console.log(`\n❌ 筛选掉的股票 (${period.filteredOutStocks.length}只):`);
          period.filteredOutStocks.slice(0, 10).forEach(stock => {
            console.log(`   ${stock.name || stock.con_code}: ${stock.filterReason}`);
          });
          if (period.filteredOutStocks.length > 10) {
            console.log(`   ... 还有 ${period.filteredOutStocks.length - 10} 只股票被筛选`);
          }
        }

        if (period.holdings) {
          console.log(`\n✅ 通过筛选的股票: ${period.holdings.length}只`);
          
          // 显示第一只股票的所有字段
          if (period.holdings.length > 0) {
            console.log('\n   第一只股票的所有字段:', Object.keys(period.holdings[0]));
          }
          
          // 统计有ROE和负债率数据的股票
          const withROE = period.holdings.filter(s => s.roe && s.roe > 0);
          const withDebt = period.holdings.filter(s => s.debtRatio && s.debtRatio > 0);
          
          console.log(`   有ROE数据: ${withROE.length}只`);
          console.log(`   有负债率数据: ${withDebt.length}只`);
          
          // 显示前5只股票的详细信息
          console.log('\n   前5只股票详情:');
          period.holdings.slice(0, 5).forEach(stock => {
            console.log(`   ${stock.name || stock.symbol}:`);
            console.log(`      权重: ${(stock.customWeight * 100).toFixed(2)}%`);
            console.log(`      ROE: ${stock.roe ? (stock.roe * 100).toFixed(2) + '%' : 'N/A'}`);
            console.log(`      负债率: ${stock.debtRatio ? (stock.debtRatio * 100).toFixed(2) + '%' : 'N/A'}`);
            console.log(`      PE: ${stock.peTtm ? stock.peTtm.toFixed(2) : 'N/A'}`);
            console.log(`      PB: ${stock.pb ? stock.pb.toFixed(2) : 'N/A'}`);
          });
        }
      });

      console.log('\n' + '='.repeat(80));
      console.log('🎉 测试完成！');
      console.log('='.repeat(80) + '\n');

      // 验证结果
      let hasROEData = false;
      let hasDebtData = false;
      let hasFilteredStocks = false;

      periods.forEach(period => {
        if (period.holdings) {
          const withROE = period.holdings.filter(s => s.roe && s.roe > 0);
          const withDebt = period.holdings.filter(s => s.debtRatio && s.debtRatio > 0);
          
          if (withROE.length > 0) hasROEData = true;
          if (withDebt.length > 0) hasDebtData = true;
        }
        
        if (period.filteredOutStocks && period.filteredOutStocks.length > 0) {
          hasFilteredStocks = true;
        }
      });

      console.log('📋 验证结果:');
      console.log(`   ✅ ROE数据: ${hasROEData ? '有数据' : '❌ 无数据'}`);
      console.log(`   ✅ 负债率数据: ${hasDebtData ? '有数据' : '❌ 无数据'}`);
      console.log(`   ✅ 筛选功能: ${hasFilteredStocks ? '有效果' : '❌ 无效果'}`);

      if (hasROEData && hasDebtData && hasFilteredStocks) {
        console.log('\n🎊 所有筛选功能均正常工作！');
      } else {
        console.log('\n⚠️  部分筛选功能可能未生效，请检查日志');
      }

    } else {
      console.error('❌ API返回数据格式异常');
    }

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

// 运行测试
testFilters().then(() => {
  console.log('\n测试脚本执行完毕');
  process.exit(0);
}).catch(error => {
  console.error('测试脚本执行失败:', error);
  process.exit(1);
});
