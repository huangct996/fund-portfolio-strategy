/**
 * 测试自适应策略中的市场温度计应用
 */

const indexPortfolioService = require('./services/indexPortfolioService');

async function testAdaptiveStrategy() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🧪 测试自适应策略中的市场温度计');
    console.log('='.repeat(60) + '\n');
    
    const indexCode = 'h30269.CSI';  // 中证红利低波100
    const fundCode = '512890.SH';
    
    // 配置自适应风险平价策略
    const config = {
      startDate: '20240101',
      endDate: '20241231',
      useRiskParity: true,
      useAdaptive: true,  // 启用自适应策略
      riskParityParams: {
        volatilityWindow: 6,
        ewmaDecay: 0.94,
        maxWeight: 0.10,  // 基础权重，会根据温度调整
        rebalanceFrequency: 'quarterly',
        stockFilterParams: {
          momentumMonths: 6,
          minMomentumReturn: 0.0,
          filterByQuality: true,  // 基础过滤，会根据温度调整
          minROE: 0.05,
          maxDebtRatio: 0.8
        }
      }
    };
    
    console.log('配置参数:');
    console.log(`  指数: ${indexCode}`);
    console.log(`  时间范围: ${config.startDate} - ${config.endDate}`);
    console.log(`  策略: 风险平价 + 自适应（基于市场温度）`);
    console.log(`  调仓频率: 季度\n`);
    
    console.log('开始回测...\n');
    
    const results = await indexPortfolioService.calculateIndexBasedReturns(
      indexCode,
      fundCode,
      config
    );
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 回测结果统计');
    console.log('='.repeat(60) + '\n');
    
    // 统计温度分布
    const tempStats = {
      cold: 0,
      normal: 0,
      hot: 0,
      total: 0
    };
    
    const tempValues = [];
    
    results.forEach(r => {
      if (r.marketTemperature) {
        tempValues.push(r.marketTemperature);
        tempStats.total++;
        
        if (r.marketTemperature < 30) tempStats.cold++;
        else if (r.marketTemperature < 70) tempStats.normal++;
        else tempStats.hot++;
      }
    });
    
    if (tempStats.total > 0) {
      const avgTemp = (tempValues.reduce((sum, t) => sum + t, 0) / tempValues.length).toFixed(1);
      
      console.log('温度统计:');
      console.log(`  调仓期数: ${tempStats.total}`);
      console.log(`  平均温度: ${avgTemp}°`);
      console.log(`  低估区间: ${tempStats.cold}次 (${(tempStats.cold / tempStats.total * 100).toFixed(1)}%)`);
      console.log(`  中估区间: ${tempStats.normal}次 (${(tempStats.normal / tempStats.total * 100).toFixed(1)}%)`);
      console.log(`  高估区间: ${tempStats.hot}次 (${(tempStats.hot / tempStats.total * 100).toFixed(1)}%)`);
      
      // 显示每个调仓期的温度和参数调整
      console.log('\n调仓期温度详情:');
      console.log('日期       | 温度 | 级别 | maxWeight | filterByQuality');
      console.log('-'.repeat(65));
      
      results.slice(0, 8).forEach(r => {
        if (r.marketTemperature) {
          const maxWeight = r.adaptiveParams?.maxWeight ? (r.adaptiveParams.maxWeight * 100).toFixed(0) + '%' : 'N/A';
          const filterByQuality = r.adaptiveParams?.filterByQuality !== undefined ? r.adaptiveParams.filterByQuality : 'N/A';
          console.log(
            `${r.rebalanceDate} | ${r.marketTemperature}°  | ${r.temperatureLevel.padEnd(4)} | ${maxWeight.padEnd(9)} | ${filterByQuality}`
          );
        }
      });
      
      if (results.length > 8) {
        console.log('...');
      }
    } else {
      console.log('⚠️ 未获取到温度数据');
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 测试完成！');
    console.log('='.repeat(60) + '\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testAdaptiveStrategy();
