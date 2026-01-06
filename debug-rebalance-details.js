/**
 * 调试脚本：分析每次调仓的详细情况
 */

const axios = require('axios');
const fs = require('fs');

const API_URL = 'http://localhost:3001/api/index-returns';
const params = {
  startDate: '20200710',
  endDate: '20250710',
  maxWeight: 0.13,
  strategyType: 'riskParity',
  useAdaptive: true,
  volatilityWindow: 6,
  ewmaDecay: 0.91,
  rebalanceFrequency: 'quarterly',
  enableTradingCost: false,
  tradingCostRate: 0,
  riskFreeRate: 0.02,
  useQualityTilt: false,
  useCovariance: false,
  hybridRatio: 0,
  enableStockFilter: true,
  minROE: 0,
  maxDebtRatio: 1,
  momentumMonths: 6,
  minMomentumReturn: -0.1,
  filterByQuality: false
};

async function analyzeRebalanceDetails() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 调仓详细情况分析');
  console.log('='.repeat(80) + '\n');

  try {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    
    const url = `${API_URL}?${queryString}`;
    console.log('🔗 API URL:', url);
    
    const response = await axios.get(url);
    const data = response.data.data;
    
    console.log('\n📈 总体风险指标:');
    console.log('  自定义策略累计收益:', (data.customRisk.totalReturn * 100).toFixed(2) + '%');
    console.log('  自定义策略年化收益:', (data.customRisk.annualizedReturn * 100).toFixed(2) + '%');
    console.log('  自定义策略夏普比率:', data.customRisk.sharpeRatio.toFixed(2));
    console.log('  自定义策略最大回撤:', (data.customRisk.maxDrawdown * 100).toFixed(2) + '%');
    console.log('');
    console.log('  指数策略累计收益:', (data.indexRisk.totalReturn * 100).toFixed(2) + '%');
    console.log('  基金累计收益:', (data.fundRisk.totalReturn * 100).toFixed(2) + '%');
    
    console.log('\n' + '='.repeat(80));
    console.log('📅 调仓期详细分析');
    console.log('='.repeat(80) + '\n');
    
    const periods = data.periods;
    let cumulativeReturn = 0;
    
    const detailsReport = [];
    
    periods.forEach((period, idx) => {
      console.log(`\n【调仓期 ${idx + 1}/${periods.length}】`);
      console.log('-'.repeat(80));
      console.log(`  调仓日期: ${period.rebalanceDate}`);
      console.log(`  是否年度调仓: ${period.isYearlyRebalance ? '是' : '否'}`);
      
      // 期间收益率
      const periodReturn = period.customReturn || 0;
      console.log(`  期间收益率: ${(periodReturn * 100).toFixed(2)}%`);
      
      // 累计收益率（手动计算验证）
      cumulativeReturn = (1 + cumulativeReturn) * (1 + periodReturn) - 1;
      console.log(`  累计收益率（手动计算）: ${(cumulativeReturn * 100).toFixed(2)}%`);
      
      if (period.customCumulativeReturn !== undefined) {
        console.log(`  累计收益率（API返回）: ${(period.customCumulativeReturn * 100).toFixed(2)}%`);
      }
      
      // 持仓数量
      const holdingsCount = period.currentWeights ? Object.keys(period.currentWeights).length : 0;
      console.log(`  持仓股票数: ${holdingsCount}`);
      
      // 前5大持仓
      if (period.currentWeights) {
        const sortedHoldings = Object.entries(period.currentWeights)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        
        console.log('  前5大持仓:');
        sortedHoldings.forEach(([code, weight], i) => {
          console.log(`    ${i + 1}. ${code}: ${(weight * 100).toFixed(2)}%`);
        });
      }
      
      // 每日收益率统计
      if (period.customDailyReturns && period.customDailyReturns.length > 0) {
        const dailyReturns = period.customDailyReturns;
        const firstDay = dailyReturns[0];
        const lastDay = dailyReturns[dailyReturns.length - 1];
        
        console.log(`  每日数据点数: ${dailyReturns.length}`);
        console.log(`  起始日期: ${firstDay.date}, periodReturn: ${(firstDay.periodReturn * 100).toFixed(2)}%`);
        console.log(`  结束日期: ${lastDay.date}, periodReturn: ${(lastDay.periodReturn * 100).toFixed(2)}%`);
        
        // 检查periodReturn是否异常
        if (Math.abs(lastDay.periodReturn - periodReturn) > 0.001) {
          console.log(`  ⚠️  警告: 最后一天periodReturn (${(lastDay.periodReturn * 100).toFixed(2)}%) 与期间收益率 (${(periodReturn * 100).toFixed(2)}%) 不一致!`);
        }
      }
      
      detailsReport.push({
        period: idx + 1,
        rebalanceDate: period.rebalanceDate,
        isYearlyRebalance: period.isYearlyRebalance,
        periodReturn: periodReturn,
        cumulativeReturn: cumulativeReturn,
        apiCumulativeReturn: period.customCumulativeReturn,
        holdingsCount: holdingsCount,
        dailyDataPoints: period.customDailyReturns ? period.customDailyReturns.length : 0
      });
    });
    
    console.log('\n' + '='.repeat(80));
    console.log('📊 累计收益率验证');
    console.log('='.repeat(80));
    console.log(`  手动计算累计收益率: ${(cumulativeReturn * 100).toFixed(2)}%`);
    console.log(`  API返回累计收益率: ${(data.customRisk.totalReturn * 100).toFixed(2)}%`);
    console.log(`  差异: ${((data.customRisk.totalReturn - cumulativeReturn) * 100).toFixed(2)}%`);
    
    if (Math.abs(data.customRisk.totalReturn - cumulativeReturn) > 0.01) {
      console.log('\n⚠️  警告: 累计收益率计算存在显著差异!');
    }
    
    // 分析每日数据
    console.log('\n' + '='.repeat(80));
    console.log('📈 每日数据分析');
    console.log('='.repeat(80));
    
    if (data.dailyData && data.dailyData.custom) {
      const dailyData = data.dailyData.custom;
      console.log(`  总数据点数: ${dailyData.length}`);
      console.log(`  起始日期: ${dailyData[0].date}, cumulative: ${(dailyData[0].cumulative * 100).toFixed(2)}%`);
      console.log(`  结束日期: ${dailyData[dailyData.length - 1].date}, cumulative: ${(dailyData[dailyData.length - 1].cumulative * 100).toFixed(2)}%`);
      
      // 检查是否有异常跳跃
      let maxJump = 0;
      let maxJumpDate = '';
      for (let i = 1; i < dailyData.length; i++) {
        const prevCum = dailyData[i - 1].cumulative;
        const currCum = dailyData[i].cumulative;
        const jump = Math.abs(currCum - prevCum);
        if (jump > maxJump) {
          maxJump = jump;
          maxJumpDate = dailyData[i].date;
        }
      }
      console.log(`  最大单日跳跃: ${(maxJump * 100).toFixed(2)}% (日期: ${maxJumpDate})`);
    }
    
    // 保存详细报告
    const reportFile = './debug-results/rebalance-details-report.json';
    fs.mkdirSync('./debug-results', { recursive: true });
    fs.writeFileSync(reportFile, JSON.stringify({
      summary: {
        customRisk: data.customRisk,
        indexRisk: data.indexRisk,
        fundRisk: data.fundRisk,
        manualCumulativeReturn: cumulativeReturn
      },
      periods: detailsReport,
      dailyDataSample: data.dailyData?.custom?.slice(0, 10) || []
    }, null, 2));
    
    console.log(`\n💾 详细报告已保存到: ${reportFile}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ 分析完成');
    console.log('='.repeat(80) + '\n');
    
  } catch (error) {
    console.error('\n❌ 分析失败:', error.message);
    if (error.response) {
      console.error('响应状态:', error.response.status);
      console.error('响应数据:', error.response.data);
    }
    process.exit(1);
  }
}

analyzeRebalanceDetails();
