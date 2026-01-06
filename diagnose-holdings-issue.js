/**
 * 诊断脚本：为什么持仓数为0？
 */

const axios = require('axios');
const fs = require('fs');

async function diagnose() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 诊断：为什么持仓数为0？');
  console.log('='.repeat(80) + '\n');

  // 测试1: 不启用股票筛选
  console.log('【测试1】不启用股票筛选');
  console.log('-'.repeat(80));
  
  try {
    const url1 = 'http://localhost:3001/api/index-returns?startDate=20200710&endDate=20201231&maxWeight=0.13&strategyType=riskParity&useAdaptive=false&volatilityWindow=6&rebalanceFrequency=quarterly&enableStockFilter=false';
    
    const res1 = await axios.get(url1);
    const data1 = res1.data.data;
    
    console.log('累计收益率:', (data1.customRisk.totalReturn * 100).toFixed(2) + '%');
    console.log('调仓期数:', data1.periods.length);
    
    if (data1.periods.length > 0) {
      const firstPeriod = data1.periods[0];
      const holdingsCount = firstPeriod.customWeights ? Object.keys(firstPeriod.customWeights).length : 0;
      console.log('第1期持仓数:', holdingsCount);
      
      if (holdingsCount > 0) {
        const topHoldings = Object.entries(firstPeriod.customWeights)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);
        console.log('前3大持仓:');
        topHoldings.forEach(([code, weight]) => {
          console.log(`  ${code}: ${(weight * 100).toFixed(2)}%`);
        });
      }
    }
  } catch (error) {
    console.error('测试1失败:', error.message);
  }

  console.log('\n');

  // 测试2: 启用股票筛选，宽松条件
  console.log('【测试2】启用股票筛选（宽松条件）');
  console.log('-'.repeat(80));
  
  try {
    const url2 = 'http://localhost:3001/api/index-returns?startDate=20200710&endDate=20201231&maxWeight=0.13&strategyType=riskParity&useAdaptive=false&volatilityWindow=6&rebalanceFrequency=quarterly&enableStockFilter=true&minROE=0&maxDebtRatio=1&momentumMonths=6&minMomentumReturn=-0.5&filterByQuality=false';
    
    const res2 = await axios.get(url2);
    const data2 = res2.data.data;
    
    console.log('累计收益率:', (data2.customRisk.totalReturn * 100).toFixed(2) + '%');
    console.log('调仓期数:', data2.periods.length);
    
    if (data2.periods.length > 0) {
      const firstPeriod = data2.periods[0];
      const holdingsCount = firstPeriod.customWeights ? Object.keys(firstPeriod.customWeights).length : 0;
      console.log('第1期持仓数:', holdingsCount);
      
      if (holdingsCount > 0) {
        const topHoldings = Object.entries(firstPeriod.customWeights)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);
        console.log('前3大持仓:');
        topHoldings.forEach(([code, weight]) => {
          console.log(`  ${code}: ${(weight * 100).toFixed(2)}%`);
        });
      }
    }
  } catch (error) {
    console.error('测试2失败:', error.message);
  }

  console.log('\n');

  // 测试3: 用户的原始URL参数
  console.log('【测试3】用户的原始URL参数');
  console.log('-'.repeat(80));
  
  try {
    const url3 = 'http://localhost:3001/api/index-returns?startDate=20200710&endDate=20250710&maxWeight=0.13&strategyType=riskParity&useAdaptive=true&volatilityWindow=6&ewmaDecay=0.91&rebalanceFrequency=quarterly&enableTradingCost=false&tradingCostRate=0&riskFreeRate=0.02&useQualityTilt=false&useCovariance=false&hybridRatio=0&enableStockFilter=true&minROE=0&maxDebtRatio=1&momentumMonths=6&minMomentumReturn=-0.1&filterByQuality=false';
    
    const res3 = await axios.get(url3);
    const data3 = res3.data.data;
    
    console.log('累计收益率:', (data3.customRisk.totalReturn * 100).toFixed(2) + '%');
    console.log('调仓期数:', data3.periods.length);
    
    // 检查每个调仓期的持仓情况
    let zeroHoldingsCount = 0;
    data3.periods.forEach((period, idx) => {
      const holdingsCount = period.customWeights ? Object.keys(period.customWeights).length : 0;
      if (holdingsCount === 0) {
        zeroHoldingsCount++;
        if (zeroHoldingsCount <= 3) {
          console.log(`  期${idx + 1} (${period.rebalanceDate}): 持仓数=0 ⚠️`);
        }
      }
    });
    
    console.log(`\n持仓为0的调仓期数: ${zeroHoldingsCount}/${data3.periods.length}`);
    
    if (zeroHoldingsCount === data3.periods.length) {
      console.log('\n❌ 所有调仓期的持仓都是0！这是问题的根源。');
    }
  } catch (error) {
    console.error('测试3失败:', error.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ 诊断完成');
  console.log('='.repeat(80) + '\n');
}

diagnose();
