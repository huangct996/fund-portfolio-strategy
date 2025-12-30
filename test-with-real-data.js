const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function testWithRealData() {
    console.log('===============================================');
    console.log('🔍 使用真实成分股数据测试2020-2021年表现');
    console.log('===============================================\n');

    console.log('现在成分股数据已同步，测试自适应策略的实际表现...\n');

    // 测试：启用自适应策略
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

        console.log('启动服务器并运行回测...');
        console.log('请确保服务器正在运行: npm start\n');
        console.log('如果服务器未运行，请在另一个终端执行: npm start');
        console.log('然后重新运行此脚本\n');

        const response = await axios.get(`${API_BASE}/index-returns`, { params });
        const data = response.data.data;
        
        const customReturn = data.customRisk.annualizedReturn * 100;
        const indexReturn = data.indexRisk.annualizedReturn * 100;
        const diff = customReturn - indexReturn;
        const sharpe = data.customRisk.sharpeRatio;
        
        console.log('===============================================');
        console.log('📊 回测结果（启用自适应策略）');
        console.log('===============================================\n');
        console.log(`策略年化收益: ${customReturn.toFixed(2)}%`);
        console.log(`指数年化收益: ${indexReturn.toFixed(2)}%`);
        console.log(`差异: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}%`);
        console.log(`夏普比率: ${sharpe.toFixed(4)}\n`);
        
        console.log('===============================================');
        console.log('📊 分析');
        console.log('===============================================\n');
        
        console.log('根据市场状态识别结果：');
        console.log('- 2020年中：强势牛市（市场宽度60%）→ maxWeight=20%');
        console.log('- 2020年底：震荡市场（市场宽度40%）→ maxWeight=15%');
        console.log('- 2021年中：震荡市场（市场宽度40%）→ maxWeight=15%');
        console.log('- 2021年底：强势牛市（市场宽度70%）→ maxWeight=20%\n');
        
        if (diff < -1) {
            console.log('❌ 仍然跑输指数超过1%');
            console.log('\n可能的原因：');
            console.log('1. 2020年底和2021年中被识别为震荡市场（市场宽度40%）');
            console.log('   → 使用了保守参数（maxWeight=15%, filterByQuality=true）');
            console.log('2. 实际上2020-2021年整体是牛市，但市场宽度在40%左右');
            console.log('   → 需要降低牛市判断阈值（当前42%）\n');
            console.log('建议优化：');
            console.log('1. 将温和牛市阈值从42%降低到35%');
            console.log('2. 这样市场宽度40%会被识别为温和牛市');
            console.log('3. 使用更激进的参数（maxWeight=18%, filterByQuality=false）');
        } else {
            console.log('✅ 表现改善！');
        }
        
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error('\n❌ 无法连接到服务器');
            console.error('请先启动服务器: npm start');
            console.error('然后重新运行此脚本');
        } else {
            console.error('\n❌ 错误:', error.message);
        }
    }
}

testWithRealData();
