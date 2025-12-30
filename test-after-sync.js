const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testAfterSync() {
    console.log('===============================================');
    console.log('🔍 数据同步后测试：自适应策略在2020-2021年的表现');
    console.log('===============================================\n');

    console.log('现在2020-2021年已有成分股数据，自适应策略应该能够：');
    console.log('1. 识别市场状态（牛市/熊市/震荡）');
    console.log('2. 动态调整参数（maxWeight、hybridRatio、filterByQuality）');
    console.log('3. 根据市场状态优化收益\n');

    // 测试1：对比启用/禁用自适应策略
    console.log('📊 测试1：对比启用/禁用自适应策略');
    console.log('-----------------------------------------------\n');

    const configs = [
        { name: '禁用自适应', useAdaptive: 'false' },
        { name: '启用自适应', useAdaptive: 'true' }
    ];

    const results = {};

    for (const config of configs) {
        try {
            const params = {
                startDate: '20200710',
                endDate: '20211231',
                strategyType: 'riskParity',
                useAdaptive: config.useAdaptive,
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
                filterByQuality: false
            };

            const response = await axios.get(`${API_BASE}/index-returns`, { params });
            const data = response.data.data;
            
            const customReturn = data.customRisk.annualizedReturn * 100;
            const indexReturn = data.indexRisk.annualizedReturn * 100;
            const diff = customReturn - indexReturn;
            const sharpe = data.customRisk.sharpeRatio;
            
            results[config.name] = { customReturn, indexReturn, diff, sharpe };
            
            console.log(`${config.name}:`);
            console.log(`  策略收益: ${customReturn.toFixed(2)}%`);
            console.log(`  指数收益: ${indexReturn.toFixed(2)}%`);
            console.log(`  差异: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}%`);
            console.log(`  夏普比率: ${sharpe.toFixed(4)}\n`);
            
        } catch (error) {
            console.error(`❌ ${config.name}: 错误 - ${error.message}\n`);
        }
    }

    // 分析差异
    console.log('\n===============================================');
    console.log('📊 分析');
    console.log('===============================================\n');

    if (results['启用自适应'] && results['禁用自适应']) {
        const diffReturn = results['启用自适应'].customReturn - results['禁用自适应'].customReturn;
        const diffVsIndex = results['启用自适应'].diff - results['禁用自适应'].diff;
        
        console.log(`启用自适应 vs 禁用自适应:`);
        console.log(`  收益差异: ${diffReturn > 0 ? '+' : ''}${diffReturn.toFixed(2)}%`);
        console.log(`  相对指数改善: ${diffVsIndex > 0 ? '+' : ''}${diffVsIndex.toFixed(2)}%\n`);
        
        if (Math.abs(diffReturn) < 0.5) {
            console.log('⚠️  启用/禁用自适应收益差异很小（<0.5%）');
            console.log('   可能原因：');
            console.log('   1. 2020-2021年市场状态识别为震荡/熊市，参数调整不明显');
            console.log('   2. 需要查看服务器日志确认市场状态识别结果\n');
        } else if (diffReturn > 0) {
            console.log('✅ 启用自适应策略显著改善了收益！');
            console.log('   自适应策略成功识别市场状态并优化了参数\n');
        } else {
            console.log('❌ 启用自适应策略反而降低了收益');
            console.log('   可能原因：');
            console.log('   1. 市场状态识别错误');
            console.log('   2. 参数设置需要进一步优化\n');
        }
    }

    // 测试2：全周期对比
    console.log('\n===============================================');
    console.log('📊 测试2：全周期表现（2020-2025）');
    console.log('===============================================\n');

    try {
        const params = {
            startDate: '20200710',
            endDate: '20241231',
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
            filterByQuality: false
        };

        const response = await axios.get(`${API_BASE}/index-returns`, { params });
        const data = response.data.data;
        
        const customReturn = data.customRisk.annualizedReturn * 100;
        const indexReturn = data.indexRisk.annualizedReturn * 100;
        const diff = customReturn - indexReturn;
        const sharpe = data.customRisk.sharpeRatio;
        
        console.log('全周期表现（启用自适应）:');
        console.log(`  策略年化收益: ${customReturn.toFixed(2)}%`);
        console.log(`  指数年化收益: ${indexReturn.toFixed(2)}%`);
        console.log(`  超额收益: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}%`);
        console.log(`  夏普比率: ${sharpe.toFixed(4)}\n`);
        
        if (diff > 5) {
            console.log('✅ 全周期大幅跑赢指数！自适应策略表现优异。');
        } else if (diff > 0) {
            console.log('✅ 全周期跑赢指数，但优势不明显，可能需要进一步优化。');
        } else {
            console.log('❌ 全周期跑输指数，需要重新审视策略设计。');
        }
        
    } catch (error) {
        console.error('全周期测试错误:', error.message);
    }

    console.log('\n\n===============================================');
    console.log('💡 下一步建议');
    console.log('===============================================\n');
    console.log('1. 查看服务器日志中的市场状态识别结果');
    console.log('2. 确认2020-2021年是否被识别为牛市');
    console.log('3. 如果识别为牛市但仍跑输，需要调整牛市参数');
    console.log('4. 如果识别为震荡/熊市，需要调整市场状态判断阈值');
}

testAfterSync();
