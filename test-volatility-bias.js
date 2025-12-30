const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testVolatilityBias() {
    console.log('===============================================');
    console.log('🔍 测试假设：风险平价偏向低波动股票导致跑输');
    console.log('===============================================\n');

    console.log('核心假设：');
    console.log('2020-2021年，高波动股票（小盘股、成长股）表现更好');
    console.log('风险平价基于波动率倒数分配权重 → 给高波动股票更低权重');
    console.log('指数基于市值分配权重 → 不考虑波动率');
    console.log('结果：风险平价错过了高波动股票的收益\n');

    console.log('测试方案：');
    console.log('如果这个假设成立，那么：');
    console.log('1. 降低volatilityWindow（使用更短期波动率）应该能改善');
    console.log('2. 增加hybridRatio（混合更多市值加权）应该能改善\n');

    // 测试1：不同的volatilityWindow
    console.log('📊 测试1：不同的波动率窗口');
    console.log('-----------------------------------------------\n');

    const volatilityWindows = [3, 6, 12, 24];
    
    for (const vw of volatilityWindows) {
        try {
            const params = {
                startDate: '20200710',
                endDate: '20211231',
                strategyType: 'riskParity',
                useAdaptive: 'false',
                maxWeight: 0.20,
                volatilityWindow: vw,
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
            console.log(`${status} volatilityWindow=${vw}月: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}% (策略${customReturn.toFixed(2)}%)`);
            
        } catch (error) {
            console.error(`❌ volatilityWindow=${vw}月: 错误`);
        }
    }

    // 测试2：不同的ewmaDecay
    console.log('\n\n📊 测试2：不同的EWMA衰减系数（更激进=更低）');
    console.log('-----------------------------------------------\n');

    const ewmaDecays = [0.80, 0.85, 0.91, 0.95];
    
    for (const decay of ewmaDecays) {
        try {
            const params = {
                startDate: '20200710',
                endDate: '20211231',
                strategyType: 'riskParity',
                useAdaptive: 'false',
                maxWeight: 0.20,
                volatilityWindow: 6,
                ewmaDecay: decay,
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
            console.log(`${status} ewmaDecay=${decay}: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}% (策略${customReturn.toFixed(2)}%)`);
            
        } catch (error) {
            console.error(`❌ ewmaDecay=${decay}: 错误`);
        }
    }

    console.log('\n\n===============================================');
    console.log('📊 结论');
    console.log('===============================================\n');
    console.log('如果调整波动率参数无效：');
    console.log('  → 问题不在波动率计算方式');
    console.log('  → 而在于风险平价的根本逻辑（波动率倒数）\n');
    console.log('真正的原因可能是：');
    console.log('1. 2020-2021年高波动股票表现更好');
    console.log('2. 风险平价天然给高波动股票低权重');
    console.log('3. 这是风险平价策略的设计初衷（降低波动）');
    console.log('4. 代价是在高波动股票表现好的时期跑输\n');
    console.log('这是策略的权衡，不是bug：');
    console.log('- 牺牲部分牛市收益');
    console.log('- 换取全周期稳定性和更高夏普比率');
}

testVolatilityBias();
