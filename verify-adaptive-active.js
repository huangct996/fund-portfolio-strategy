const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function verifyAdaptiveActive() {
    console.log('===============================================');
    console.log('🔍 验证：2020-2021年是否真的使用了自适应策略？');
    console.log('===============================================\n');

    console.log('关键问题：');
    console.log('如果启用了自适应策略，应该根据市场状态动态调整：');
    console.log('- 牛市：maxWeight=20%, hybridRatio=20%, filterByQuality=false');
    console.log('- 熊市：maxWeight=13%, hybridRatio=0%, filterByQuality=true');
    console.log('\n但之前测试显示：');
    console.log('- 启用自适应：12.18%');
    console.log('- 禁用自适应：12.59%');
    console.log('- 差异很小，说明自适应策略可能没有真正生效！\n');

    // 测试：如果自适应策略真的生效，应该能看到明显差异
    console.log('📊 对比测试：');
    console.log('-----------------------------------------------\n');

    const configs = [
        {
            name: '禁用自适应（固定参数）',
            useAdaptive: 'false',
            maxWeight: 0.13
        },
        {
            name: '启用自适应（应该动态调整）',
            useAdaptive: 'true',
            maxWeight: 0.13  // 这个会被自适应策略覆盖
        },
        {
            name: '禁用自适应但用牛市参数',
            useAdaptive: 'false',
            maxWeight: 0.20  // 模拟牛市的maxWeight
        }
    ];

    for (const config of configs) {
        try {
            const params = {
                startDate: '20200710',
                endDate: '20211231',
                strategyType: 'riskParity',
                useAdaptive: config.useAdaptive,
                maxWeight: config.maxWeight,
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
            
            console.log(`${config.name}:`);
            console.log(`  策略收益: ${customReturn.toFixed(2)}%`);
            console.log(`  差异: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}%\n`);
            
        } catch (error) {
            console.error(`❌ ${config.name}: 错误\n`);
        }
    }

    console.log('\n===============================================');
    console.log('📊 分析');
    console.log('===============================================\n');
    
    console.log('如果三种配置收益相同或接近：');
    console.log('  → 说明自适应策略没有真正生效');
    console.log('  → 可能的原因：');
    console.log('    1. 2020-2021年没有成分股数据，无法识别市场状态');
    console.log('    2. 市场状态识别错误，没有识别为牛市');
    console.log('    3. 参数覆盖逻辑有bug\n');
    
    console.log('如果启用自适应收益显著不同：');
    console.log('  → 说明自适应策略生效了');
    console.log('  → 但可能识别的市场状态不是我们预期的\n');
    
    console.log('关键：需要查看服务器日志中2020-2021年的市场状态识别结果！');
}

verifyAdaptiveActive();
