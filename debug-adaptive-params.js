const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function debugAdaptiveParams() {
    console.log('===============================================');
    console.log('🔍 调试：自适应策略参数是否真正生效');
    console.log('===============================================\n');

    console.log('对比三种配置的收益：\n');

    const configs = [
        {
            name: '1. 禁用自适应（固定maxWeight=13%）',
            useAdaptive: 'false',
            maxWeight: 0.13
        },
        {
            name: '2. 启用自适应（应该动态调整18-20%）',
            useAdaptive: 'true',
            maxWeight: 0.13  // 这个会被覆盖
        },
        {
            name: '3. 禁用自适应但用牛市参数（固定maxWeight=18%）',
            useAdaptive: 'false',
            maxWeight: 0.18
        }
    ];

    const results = [];

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
            
            results.push({ name: config.name, customReturn, diff });
            
            console.log(`${config.name}:`);
            console.log(`  策略收益: ${customReturn.toFixed(2)}%`);
            console.log(`  差异: ${diff > 0 ? '+' : ''}${diff.toFixed(2)}%\n`);
            
        } catch (error) {
            console.error(`❌ ${config.name}: 错误\n`);
        }
    }

    console.log('\n===============================================');
    console.log('📊 诊断分析');
    console.log('===============================================\n');

    if (results.length >= 3) {
        const [fixed13, adaptive, fixed18] = results;
        
        console.log('关键对比：');
        console.log(`固定13%: ${fixed13.customReturn.toFixed(2)}%`);
        console.log(`自适应: ${adaptive.customReturn.toFixed(2)}%`);
        console.log(`固定18%: ${fixed18.customReturn.toFixed(2)}%\n`);
        
        if (Math.abs(adaptive.customReturn - fixed13.customReturn) < 0.1) {
            console.log('❌ 问题1：自适应策略收益≈固定13%');
            console.log('   说明：自适应策略的参数调整没有生效');
            console.log('   可能原因：');
            console.log('   - 服务器代码未更新（需要重启服务器）');
            console.log('   - 参数覆盖逻辑有bug');
            console.log('   - 市场状态识别结果未被应用\n');
        }
        
        if (Math.abs(adaptive.customReturn - fixed18.customReturn) < 0.1) {
            console.log('✅ 自适应策略收益≈固定18%');
            console.log('   说明：自适应策略正在使用18%的maxWeight');
            console.log('   但仍然跑输，说明问题不在maxWeight\n');
        }
        
        if (Math.abs(fixed13.customReturn - fixed18.customReturn) < 0.1) {
            console.log('❌ 问题2：固定13%和固定18%收益相同');
            console.log('   说明：maxWeight调整对收益没有影响');
            console.log('   可能原因：');
            console.log('   - 股票权重远低于maxWeight限制');
            console.log('   - 问题不在maxWeight，而在其他参数\n');
        } else {
            console.log('✅ 固定13%和固定18%收益不同');
            console.log(`   差异: ${(fixed18.customReturn - fixed13.customReturn).toFixed(2)}%`);
            console.log('   说明：maxWeight调整是有效的\n');
        }
    }

    console.log('\n💡 建议：');
    console.log('1. 如果自适应≈固定13%：重启服务器，确保代码更新生效');
    console.log('2. 如果自适应≈固定18%但仍跑输：问题不在maxWeight，需要调整其他参数');
    console.log('3. 如果固定13%≈固定18%：maxWeight无效，问题在别处');
}

debugAdaptiveParams();
