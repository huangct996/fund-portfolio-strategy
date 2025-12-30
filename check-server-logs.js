const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function checkServerLogs() {
    console.log('===============================================');
    console.log('🔍 触发回测并查看服务器日志');
    console.log('===============================================\n');

    console.log('运行2020-2021年回测，启用自适应策略...');
    console.log('请查看服务器终端的输出，寻找：');
    console.log('1. 🔍 [日期] 市场状态: XXX');
    console.log('2. 市场宽度、趋势强度、波动率');
    console.log('3. 调整参数: maxWeight=XX%\n');

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

        console.log('开始回测...\n');
        const response = await axios.get(`${API_BASE}/index-returns`, { params });
        
        console.log('\n回测完成！');
        console.log('===============================================');
        console.log('请查看上方服务器日志中的市场状态识别信息');
        console.log('===============================================\n');
        
        const data = response.data.data;
        console.log(`策略收益: ${(data.customRisk.annualizedReturn * 100).toFixed(2)}%`);
        console.log(`指数收益: ${(data.indexRisk.annualizedReturn * 100).toFixed(2)}%`);
        
    } catch (error) {
        console.error('错误:', error.message);
    }
}

checkServerLogs();
