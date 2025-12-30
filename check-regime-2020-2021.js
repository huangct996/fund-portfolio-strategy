const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function checkRegime2020_2021() {
    console.log('===============================================');
    console.log('🔍 检查2020-2021年的实际市场状态识别');
    console.log('===============================================\n');

    console.log('运行回测并查看服务器日志中的市场状态识别...\n');

    try {
        const params = {
            startDate: '20200710',
            endDate: '20211231',
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

        console.log('请求参数：');
        console.log(JSON.stringify(params, null, 2));
        console.log('\n开始回测...\n');

        const response = await axios.get(`${API_BASE}/index-returns`, { params });
        const data = response.data.data;
        
        console.log('\n===============================================');
        console.log('📊 回测结果');
        console.log('===============================================\n');
        
        const customReturn = data.customRisk.annualizedReturn * 100;
        const indexReturn = data.indexRisk.annualizedReturn * 100;
        const diff = customReturn - indexReturn;
        
        console.log(`策略年化收益: ${customReturn.toFixed(2)}%`);
        console.log(`指数年化收益: ${indexReturn.toFixed(2)}%`);
        console.log(`差异: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}%`);
        console.log(`夏普比率: ${data.customRisk.sharpeRatio.toFixed(4)}`);
        
        console.log('\n💡 请查看上方服务器日志中的市场状态识别信息：');
        console.log('   - 每个调仓期识别的市场状态（AGGRESSIVE_BULL/MODERATE_BULL/SIDEWAYS/WEAK_BEAR/PANIC）');
        console.log('   - 市场宽度（marketBreadth）');
        console.log('   - 应用的maxWeight');
        console.log('   - 是否识别为牛市？');
        
    } catch (error) {
        console.error(`❌ 错误: ${error.message}`);
    }
}

checkRegime2020_2021();
