const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function traceAdaptiveLogic() {
    console.log('===============================================');
    console.log('🔍 追踪2020-2021年自适应策略是否生效');
    console.log('===============================================\n');

    console.log('关键问题：');
    console.log('1. 自适应策略是否正确识别了2020-2021年的市场状态？');
    console.log('2. 如果识别为牛市，为什么maxWeight调整无效？');
    console.log('3. hybridRatio（市值加权混合）是否真正生效？\n');

    // 测试1：验证自适应策略是否启用
    console.log('📊 测试1：对比启用/禁用自适应策略');
    console.log('-----------------------------------------------\n');

    const configs = [
        { name: '禁用自适应', useAdaptive: 'false' },
        { name: '启用自适应', useAdaptive: 'true' }
    ];

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
            
            console.log(`${config.name}: 策略${customReturn.toFixed(2)}% vs 指数${indexReturn.toFixed(2)}% (${diff > 0 ? '+' : ''}${diff.toFixed(2)}%)`);
            
        } catch (error) {
            console.error(`❌ ${config.name}: 错误`);
        }
    }

    // 测试2：如果自适应策略无效，尝试直接提高固定maxWeight
    console.log('\n\n📊 测试2：禁用自适应，直接提高固定maxWeight');
    console.log('-----------------------------------------------\n');

    const fixedMaxWeights = [0.10, 0.15, 0.20, 0.25, 0.30];
    
    for (const mw of fixedMaxWeights) {
        try {
            const params = {
                startDate: '20200710',
                endDate: '20211231',
                strategyType: 'riskParity',
                useAdaptive: 'false',  // 禁用自适应
                maxWeight: mw,
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
            
            const status = diff > 0 ? '✅' : '❌';
            console.log(`${status} maxWeight=${(mw*100).toFixed(0)}%: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}% (策略${customReturn.toFixed(2)}%)`);
            
        } catch (error) {
            console.error(`❌ maxWeight=${(mw*100).toFixed(0)}%: 错误`);
        }
    }

    console.log('\n\n===============================================');
    console.log('📊 关键发现');
    console.log('===============================================\n');
    console.log('如果测试1中启用/禁用自适应结果相同：');
    console.log('  → 说明自适应策略未生效（可能是成分股数据问题）\n');
    console.log('如果测试2中提高maxWeight无效：');
    console.log('  → 说明问题不在maxWeight，而在于：');
    console.log('    1. 股票筛选过滤掉了高涨幅股票');
    console.log('    2. 风险平价本身的分散化特性');
    console.log('    3. 需要更激进的市值加权混合\n');
}

traceAdaptiveLogic();
