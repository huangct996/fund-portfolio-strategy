/**
 * 测试100%回撤问题
 * 使用图片中显示的参数：ROE=0, 负债率=100%, 动量=-10%, 质量筛选=开启
 */

const axios = require('axios');

async function testDrawdownIssue() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔍 测试100%回撤问题');
    console.log('='.repeat(80) + '\n');

    const params = {
      fundCode: '512890.SH',
      startDate: '20200101',
      endDate: '20241231',
      strategyType: 'riskParity',
      volatilityWindow: 12,
      ewmaDecay: 0.94,
      rebalanceFrequency: 'yearly',
      enableTradingCost: false,
      enableStockFilter: true,
      minROE: 0,           // 图片中显示为0
      maxDebtRatio: 1.0,   // 图片中显示为100%
      momentumMonths: 6,
      minMomentumReturn: -0.10,
      filterByQuality: true
    };

    console.log('📋 测试参数:');
    console.log('   最低ROE: 0%');
    console.log('   最高负债率: 100%');
    console.log('   动量期间: 6个月');
    console.log('   最低动量收益率: -10%');
    console.log('   剔除质量得分低于中位数: true');
    console.log('\n正在调用API...\n');

    const response = await axios.get('http://localhost:3001/api/index-returns', {
      params,
      timeout: 120000
    });

    if (response.data && response.data.success && response.data.data) {
      const data = response.data.data;
      
      console.log('\n' + '='.repeat(80));
      console.log('✅ API调用成功');
      console.log('='.repeat(80) + '\n');

      // 检查风险指标
      if (data.customRisk) {
        console.log('📊 自定义策略风险指标:');
        console.log(`   累计收益率: ${(data.customRisk.totalReturn * 100).toFixed(2)}%`);
        console.log(`   年化收益率: ${(data.customRisk.annualizedReturn * 100).toFixed(2)}%`);
        console.log(`   最大回撤: ${(data.customRisk.maxDrawdown * 100).toFixed(2)}%`);
        console.log(`   夏普比率: ${data.customRisk.sharpeRatio.toFixed(2)}`);
        
        if (data.customRisk.maxDrawdown >= 0.99) {
          console.log('\n⚠️  检测到异常：最大回撤接近或等于100%！');
        }
      }

      // 检查每个调仓期的股票数量
      if (data.periods && data.periods.length > 0) {
        console.log('\n📅 调仓期详情:');
        data.periods.forEach((period, index) => {
          const holdingsCount = period.holdings ? period.holdings.length : 0;
          const filteredCount = period.filteredOutStocks ? period.filteredOutStocks.length : 0;
          const totalWeight = period.holdings 
            ? period.holdings.reduce((sum, h) => sum + (h.customWeight || 0), 0) 
            : 0;
          
          console.log(`\n   调仓期 ${index + 1}: ${period.rebalanceDate}`);
          console.log(`      持仓股票数: ${holdingsCount}`);
          console.log(`      筛选掉股票数: ${filteredCount}`);
          console.log(`      总权重: ${(totalWeight * 100).toFixed(2)}%`);
          
          if (totalWeight < 0.01) {
            console.log(`      ⚠️  警告：总权重接近0，可能导致组合价值归零！`);
          }
          
          // 显示有权重的股票
          if (period.holdings) {
            const withWeight = period.holdings.filter(h => h.customWeight > 0.001);
            console.log(`      有效持仓: ${withWeight.length}只`);
            if (withWeight.length > 0 && withWeight.length <= 5) {
              withWeight.forEach(h => {
                console.log(`         ${h.name}: ${(h.customWeight * 100).toFixed(2)}%`);
              });
            }
          }
        });
      }

      // 检查每日收益率数据
      if (data.customDailyData && data.customDailyData.length > 0) {
        console.log('\n📈 每日数据检查:');
        console.log(`   总数据点: ${data.customDailyData.length}`);
        
        // 查找异常数据点
        const zeroValues = data.customDailyData.filter(d => d.cumulative <= 0.01);
        if (zeroValues.length > 0) {
          console.log(`\n   ⚠️  发现 ${zeroValues.length} 个异常数据点（累计净值≤0.01）:`);
          zeroValues.slice(0, 5).forEach(d => {
            console.log(`      ${d.date}: 累计净值=${d.cumulative.toFixed(4)}`);
          });
        }
      }

    } else {
      console.log('❌ API返回数据格式异常');
    }

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
  }
}

testDrawdownIssue();
