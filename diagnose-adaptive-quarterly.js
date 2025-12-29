const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function diagnoseAdaptiveStrategy() {
    console.log('===============================================');
    console.log('🔬 诊断自适应策略（季度调仓）');
    console.log('===============================================\n');

    // 测试1：固定参数策略（季度调仓）
    console.log('📊 测试1：固定参数策略（季度调仓）');
    console.log('-----------------------------------------------');
    const fixedParams = {
        startDate: '20200710',
        endDate: '20250710',
        strategyType: 'riskParity',
        useAdaptive: 'false',
        maxWeight: 0.13,
        volatilityWindow: 6,
        ewmaDecay: 0.91,
        rebalanceFrequency: 'quarterly',
        enableTradingCost: false,
        riskFreeRate: 0.02,
        enableStockFilter: true,
        minROE: 0,
        maxDebtRatio: 1,
        momentumMonths: 6,
        minMomentumReturn: -0.1,
        filterByQuality: true
    };

    try {
        const fixedResponse = await axios.get(`${API_BASE}/index-returns`, { params: fixedParams });
        const fixedData = fixedResponse.data.data;
        
        console.log('✅ 固定参数策略结果:');
        console.log(`   累计收益: ${(fixedData.customRisk.totalReturn * 100).toFixed(2)}%`);
        console.log(`   年化收益: ${(fixedData.customRisk.annualizedReturn * 100).toFixed(2)}%`);
        console.log(`   夏普比率: ${fixedData.customRisk.sharpeRatio.toFixed(4)}`);
        console.log(`   最大回撤: ${(fixedData.customRisk.maxDrawdown * 100).toFixed(2)}%`);
        console.log(`   调仓期数: ${fixedData.periods.length}\n`);

        // 测试2：自适应策略（季度调仓）
        console.log('📊 测试2：自适应策略（季度调仓）');
        console.log('-----------------------------------------------');
        const adaptiveParams = { ...fixedParams, useAdaptive: 'true' };

        const adaptiveResponse = await axios.get(`${API_BASE}/index-returns`, { params: adaptiveParams });
        const adaptiveData = adaptiveResponse.data.data;

        console.log('✅ 自适应策略结果:');
        console.log(`   累计收益: ${(adaptiveData.customRisk.totalReturn * 100).toFixed(2)}%`);
        console.log(`   年化收益: ${(adaptiveData.customRisk.annualizedReturn * 100).toFixed(2)}%`);
        console.log(`   夏普比率: ${adaptiveData.customRisk.sharpeRatio.toFixed(4)}`);
        console.log(`   最大回撤: ${(adaptiveData.customRisk.maxDrawdown * 100).toFixed(2)}%`);
        console.log(`   调仓期数: ${adaptiveData.periods.length}\n`);

        // 对比分析
        console.log('===============================================');
        console.log('📊 策略对比分析');
        console.log('===============================================\n');
        
        const returnDiff = (adaptiveData.customRisk.annualizedReturn - fixedData.customRisk.annualizedReturn) * 100;
        const sharpeDiff = adaptiveData.customRisk.sharpeRatio - fixedData.customRisk.sharpeRatio;
        const drawdownDiff = (adaptiveData.customRisk.maxDrawdown - fixedData.customRisk.maxDrawdown) * 100;

        console.log('指标对比:');
        console.log(`   年化收益差异: ${returnDiff > 0 ? '+' : ''}${returnDiff.toFixed(2)}%`);
        console.log(`   夏普比率差异: ${sharpeDiff > 0 ? '+' : ''}${sharpeDiff.toFixed(4)}`);
        console.log(`   最大回撤差异: ${drawdownDiff > 0 ? '+' : ''}${drawdownDiff.toFixed(2)}%\n`);

        if (returnDiff > 0 && sharpeDiff > 0) {
            console.log('结论:');
            console.log('   ✅ 自适应策略表现优于固定策略\n');
        } else {
            console.log('结论:');
            console.log('   ❌ 自适应策略表现不如固定策略，需要优化参数\n');
        }

        // 查看每个调仓期的市场状态和参数
        console.log('📋 各调仓期市场状态详情:');
        console.log('-----------------------------------------------');
        
        // 获取市场状态信息
        for (let i = 0; i < Math.min(adaptiveData.periods.length, 10); i++) {
            const period = adaptiveData.periods[i];
            if (period.marketRegime) {
                console.log(`${i + 1}. ${period.date}: ${period.marketRegime.regime}`);
                console.log(`   参数: maxWeight=${(period.marketRegime.params.maxWeight * 100).toFixed(0)}%, ` +
                    `minROE=${(period.marketRegime.params.minROE * 100).toFixed(0)}%, ` +
                    `momentum=${period.marketRegime.params.momentumMonths}月`);
            }
        }

        console.log('\n===============================================');
        console.log('✅ 诊断完成！');
        console.log('===============================================');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        if (error.response) {
            console.error('响应数据:', error.response.data);
        }
    }
}

diagnoseAdaptiveStrategy();
