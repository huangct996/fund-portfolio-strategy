const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function analyzeEarlyPerformance() {
    console.log('===============================================');
    console.log('🔬 分析前期表现（2020-2022）');
    console.log('===============================================\n');

    // 测试前期时段（2020-2022）
    const params = {
        startDate: '20200710',
        endDate: '20221231',
        strategyType: 'riskParity',
        useAdaptive: 'true',
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
        const response = await axios.get(`${API_BASE}/index-returns`, { params });
        const data = response.data.data;
        
        console.log('📊 自适应策略（2020-2022）:');
        console.log(`   累计收益: ${(data.customRisk.totalReturn * 100).toFixed(2)}%`);
        console.log(`   年化收益: ${(data.customRisk.annualizedReturn * 100).toFixed(2)}%`);
        console.log(`   夏普比率: ${data.customRisk.sharpeRatio.toFixed(4)}`);
        console.log(`   最大回撤: ${(data.customRisk.maxDrawdown * 100).toFixed(2)}%\n`);

        console.log('📊 指数（2020-2022）:');
        console.log(`   累计收益: ${(data.indexRisk.totalReturn * 100).toFixed(2)}%`);
        console.log(`   年化收益: ${(data.indexRisk.annualizedReturn * 100).toFixed(2)}%`);
        console.log(`   夏普比率: ${data.indexRisk.sharpeRatio.toFixed(4)}`);
        console.log(`   最大回撤: ${(data.indexRisk.maxDrawdown * 100).toFixed(2)}%\n`);

        const diff = (data.customRisk.annualizedReturn - data.indexRisk.annualizedReturn) * 100;
        console.log(`💡 年化收益差异: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}%`);
        
        if (diff < 0) {
            console.log('\n⚠️  前期跑输指数！需要分析原因：');
            console.log('   可能原因1: maxWeight设置过低，限制了牛市期间的收益');
            console.log('   可能原因2: 市场状态识别错误，将牛市识别为震荡或熊市');
            console.log('   可能原因3: 股票筛选过于严格，错过了优质股票');
        }

        // 查看各调仓期的市场状态
        console.log('\n📋 各调仓期市场状态:');
        console.log('-----------------------------------------------');
        for (let i = 0; i < Math.min(data.periods.length, 10); i++) {
            const period = data.periods[i];
            console.log(`${i + 1}. ${period.date}: ${period.marketRegimeName || 'N/A'}`);
        }

    } catch (error) {
        console.error('❌ 错误:', error.message);
    }
}

analyzeEarlyPerformance();
