const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function checkRegimeDetection() {
    console.log('===============================================');
    console.log('🔬 检查市场状态识别（前期牛市）');
    console.log('===============================================\n');

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
            enableStockFilter: false
        };

        const response = await axios.get(`${API_BASE}/index-returns`, { params });
        const data = response.data.data;
        
        console.log('📊 各调仓期的市场状态识别：\n');
        
        if (data.periods && data.periods.length > 0) {
            for (let i = 0; i < data.periods.length; i++) {
                const period = data.periods[i];
                console.log(`${i + 1}. ${period.date}: ${period.marketRegimeName || 'N/A'}`);
                if (period.marketRegime) {
                    console.log(`   宽度: ${(period.marketRegime.marketBreadth * 100).toFixed(1)}%`);
                    console.log(`   maxWeight: ${(period.marketRegime.params?.maxWeight * 100).toFixed(0)}%`);
                    console.log(`   hybridRatio: ${period.marketRegime.params?.hybridRatio || 0}`);
                }
            }
        }
        
        console.log('\n📊 整体表现：');
        console.log(`   自定义策略年化: ${(data.customRisk.annualizedReturn * 100).toFixed(2)}%`);
        console.log(`   指数年化: ${(data.indexRisk.annualizedReturn * 100).toFixed(2)}%`);
        console.log(`   差异: ${((data.customRisk.annualizedReturn - data.indexRisk.annualizedReturn) * 100).toFixed(2)}%`);
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
        if (error.response) {
            console.error('响应数据:', error.response.data);
        }
    }
}

checkRegimeDetection();
