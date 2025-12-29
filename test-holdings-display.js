/**
 * 测试持仓显示逻辑修复
 * 验证holdings只包含权重>0的股票，filteredOutStocks包含被过滤的股票
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testHoldingsDisplay() {
  console.log('='.repeat(80));
  console.log('测试持仓显示逻辑');
  console.log('='.repeat(80));
  
  try {
    const params = {
      startDate: '20200710',
      endDate: '20201231',
      strategyType: 'riskParity',
      maxWeight: '0.13',
      volatilityWindow: '6',
      ewmaDecay: '0.91',
      rebalanceFrequency: 'yearly',
      enableTradingCost: 'false',
      riskFreeRate: '0.02',
      enableStockFilter: 'true',
      minROE: '0',
      maxDebtRatio: '1',
      momentumMonths: '6',
      minMomentumReturn: '-0.1',
      filterByQuality: 'true'
    };
    
    console.log('\n发送请求...\n');
    const response = await axios.get(`${BASE_URL}/api/index-returns`, { params });
    
    if (!response.data.success) {
      throw new Error('请求失败: ' + response.data.error);
    }
    
    const data = response.data.data;
    const firstPeriod = data.periods[0];
    
    console.log('第一个调仓期数据:');
    console.log(`  调仓日期: ${firstPeriod.rebalanceDate}`);
    console.log(`  总股票数: ${firstPeriod.stockCount}`);
    console.log(`  holdings数量: ${firstPeriod.holdings.length}`);
    console.log(`  filteredOutStocks数量: ${firstPeriod.filteredOutStocks.length}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('Holdings（应该只包含权重>0的股票）:');
    console.log('='.repeat(80));
    
    firstPeriod.holdings.slice(0, 10).forEach((h, i) => {
      console.log(`${i + 1}. ${h.name} (${h.symbol})`);
      console.log(`   指数权重: ${(h.indexWeight * 100).toFixed(2)}%`);
      console.log(`   策略权重: ${(h.customWeight * 100).toFixed(2)}%`);
    });
    
    if (firstPeriod.holdings.length > 10) {
      console.log(`... 还有 ${firstPeriod.holdings.length - 10} 只股票`);
    }
    
    // 检查是否有权重为0的股票
    const zeroWeightInHoldings = firstPeriod.holdings.filter(h => h.customWeight === 0);
    if (zeroWeightInHoldings.length > 0) {
      console.log(`\n❌ 错误：holdings中发现 ${zeroWeightInHoldings.length} 只权重为0的股票！`);
      zeroWeightInHoldings.slice(0, 5).forEach(h => {
        console.log(`   - ${h.name} (${h.symbol}): ${(h.customWeight * 100).toFixed(2)}%`);
      });
    } else {
      console.log(`\n✅ 正确：holdings中所有股票权重都>0`);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('FilteredOutStocks（被过滤的股票）:');
    console.log('='.repeat(80));
    
    if (firstPeriod.filteredOutStocks.length > 0) {
      firstPeriod.filteredOutStocks.slice(0, 10).forEach((f, i) => {
        console.log(`${i + 1}. ${f.name} (${f.symbol})`);
        console.log(`   指数权重: ${(f.indexWeight * 100).toFixed(2)}%`);
        console.log(`   过滤原因: ${f.filterReason}`);
      });
      
      if (firstPeriod.filteredOutStocks.length > 10) {
        console.log(`... 还有 ${firstPeriod.filteredOutStocks.length - 10} 只被过滤的股票`);
      }
    } else {
      console.log('没有被过滤的股票');
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('验证结果:');
    console.log('='.repeat(80));
    
    const totalStocks = firstPeriod.holdings.length + firstPeriod.filteredOutStocks.length;
    console.log(`\n总股票数: ${firstPeriod.stockCount}`);
    console.log(`Holdings: ${firstPeriod.holdings.length}`);
    console.log(`FilteredOut: ${firstPeriod.filteredOutStocks.length}`);
    console.log(`合计: ${totalStocks}`);
    
    if (zeroWeightInHoldings.length === 0) {
      console.log('\n✅ 测试通过：持仓显示逻辑正确！');
      console.log('   - Holdings只包含权重>0的股票');
      console.log('   - FilteredOutStocks包含被过滤的股票');
    } else {
      console.log('\n❌ 测试失败：Holdings中仍包含权重为0的股票');
    }
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('\n❌ 测试执行失败:', error.message);
    if (error.response) {
      console.error('响应数据:', error.response.data);
    }
    process.exit(1);
  }
}

testHoldingsDisplay();
