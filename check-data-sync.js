/**
 * 检查数据同步状态
 * 1. 检查Tushare API是否有最新数据
 * 2. 检查数据库中的数据是否完整
 * 3. 找出数据缺失的原因
 */

const tushareService = require('./services/tushareService');
const dbService = require('./services/dbService');

async function checkDataSync() {
  console.log('\n' + '='.repeat(80));
  console.log('📊 检查数据同步状态（2025-12-12 至今）');
  console.log('='.repeat(80) + '\n');

  try {
    await dbService.init();
    console.log('✅ 数据库初始化成功\n');

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const startDate = '20251212';  // 从问题日期开始检查
    
    // 测试1: 检查指数日线数据
    console.log('【测试1】检查h30269.CSI指数日线数据');
    console.log('-'.repeat(80));
    console.log(`查询范围: ${startDate} - ${todayStr}\n`);
    
    // 从数据库查询
    console.log('1. 数据库中的数据:');
    const conn1 = await dbService.pool.getConnection();
    try {
      const [dbIndexRows] = await conn1.query(
        'SELECT * FROM index_daily WHERE ts_code = ? AND trade_date >= ? AND trade_date <= ? ORDER BY trade_date',
        ['h30269.CSI', startDate, todayStr]
      );
      
      console.log(`   找到 ${dbIndexRows.length} 条记录`);
      if (dbIndexRows.length > 0) {
        const dates = dbIndexRows.map(d => d.trade_date).sort();
        console.log(`   日期范围: ${dates[0]} - ${dates[dates.length - 1]}`);
        console.log(`   最后5个交易日: ${dates.slice(-5).join(', ')}`);
      } else {
        console.log('   ⚠️  数据库中没有这个时间段的数据！');
      }
      
      // 从Tushare API查询
      console.log('\n2. Tushare API的数据:');
      const apiIndexData = await tushareService.callApi('index_daily', {
        ts_code: 'h30269.CSI',
        start_date: startDate,
        end_date: todayStr
      });
      
      console.log(`   返回 ${apiIndexData ? apiIndexData.length : 0} 条记录`);
      if (apiIndexData && apiIndexData.length > 0) {
        const dates = apiIndexData.map(d => d.trade_date).sort();
        console.log(`   日期范围: ${dates[0]} - ${dates[dates.length - 1]}`);
        console.log(`   最后5个交易日: ${dates.slice(-5).join(', ')}`);
        
        // 对比
        const dbDates = new Set(dbIndexRows.map(d => d.trade_date));
        const missing = apiIndexData.filter(d => !dbDates.has(d.trade_date));
        
        if (missing.length > 0) {
          console.log(`\n   ❌ 数据库缺失 ${missing.length} 个交易日的数据！`);
          console.log('   缺失的日期:');
          missing.forEach(d => {
            console.log(`      ${d.trade_date}: close=${d.close}`);
          });
        } else {
          console.log('\n   ✅ 数据库数据完整');
        }
      } else {
        console.log('   ⚠️  Tushare API也没有返回数据');
      }
    } finally {
      conn1.release();
    }
    
    // 测试2: 检查基金净值数据
    console.log('\n【测试2】检查512890.SH基金净值数据');
    console.log('-'.repeat(80));
    console.log(`查询范围: ${startDate} - ${todayStr}\n`);
    
    console.log('1. 数据库中的数据:');
    const dbFundData = await dbService.getFundNav('512890.SH', startDate, todayStr);
    console.log(`   找到 ${dbFundData.length} 条记录`);
    if (dbFundData.length > 0) {
      const dates = dbFundData.map(d => d.nav_date).sort();
      console.log(`   日期范围: ${dates[0]} - ${dates[dates.length - 1]}`);
      console.log(`   最后5个净值日: ${dates.slice(-5).join(', ')}`);
    } else {
      console.log('   ⚠️  数据库中没有这个时间段的数据！');
    }
    
    console.log('\n2. Tushare API的数据:');
    const apiFundData = await tushareService.callApi('fund_nav', {
      ts_code: '512890.SH',
      start_date: startDate,
      end_date: todayStr
    });
    
    console.log(`   返回 ${apiFundData ? apiFundData.length : 0} 条记录`);
    if (apiFundData && apiFundData.length > 0) {
      const dates = apiFundData.map(d => d.nav_date).sort();
      console.log(`   日期范围: ${dates[0]} - ${dates[dates.length - 1]}`);
      console.log(`   最后5个净值日: ${dates.slice(-5).join(', ')}`);
      
      // 对比
      const dbDates = new Set(dbFundData.map(d => d.nav_date));
      const missing = apiFundData.filter(d => !dbDates.has(d.nav_date));
      
      if (missing.length > 0) {
        console.log(`\n   ❌ 数据库缺失 ${missing.length} 个净值日的数据！`);
        console.log('   缺失的日期:');
        missing.forEach(d => {
          console.log(`      ${d.nav_date}: unit_nav=${d.unit_nav}, accum_nav=${d.accum_nav}`);
        });
      } else {
        console.log('\n   ✅ 数据库数据完整');
      }
    } else {
      console.log('   ⚠️  Tushare API也没有返回数据');
    }
    
    // 测试3: 检查股票日线数据（抽样）
    console.log('\n【测试3】检查股票日线数据（抽样3只）');
    console.log('-'.repeat(80));
    
    const samples = ['601006.SH', '601088.SH', '600028.SH'];
    
    for (const code of samples) {
      console.log(`\n${code}:`);
      
      const dbStock = await dbService.getStockDaily(code, startDate, todayStr);
      console.log(`  数据库: ${dbStock.length} 条`);
      
      const apiStock = await tushareService.callApi('daily', {
        ts_code: code,
        start_date: startDate,
        end_date: todayStr
      });
      
      console.log(`  Tushare API: ${apiStock ? apiStock.length : 0} 条`);
      
      if (apiStock && apiStock.length > 0) {
        const dbDates = new Set(dbStock.map(d => d.trade_date));
        const missing = apiStock.filter(d => !dbDates.has(d.trade_date));
        
        if (missing.length > 0) {
          console.log(`  ❌ 缺失 ${missing.length} 个交易日: ${missing.map(d => d.trade_date).join(', ')}`);
        } else {
          console.log(`  ✅ 数据完整`);
        }
      }
    }
    
    // 测试4: 检查缺失标记
    console.log('\n【测试4】检查数据缺失标记');
    console.log('-'.repeat(80));
    
    const conn2 = await dbService.pool.getConnection();
    try {
      const [marks] = await conn2.query(
        'SELECT * FROM data_missing_mark WHERE trade_date >= ? ORDER BY trade_date DESC LIMIT 30',
        [startDate]
      );
      
      console.log(`找到 ${marks.length} 条缺失标记\n`);
      if (marks.length > 0) {
        marks.forEach(mark => {
          console.log(`  ${mark.trade_date} - ${mark.ts_code} - ${mark.data_type}: ${mark.reason}`);
        });
      }
    } finally {
      conn2.release();
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('📋 诊断结论:');
    console.log('='.repeat(80));
    console.log('✓ 如果Tushare API有数据但数据库没有 → 数据库同步问题');
    console.log('✓ 如果Tushare API也没有数据 → API数据源问题');
    console.log('✓ 如果有错误的缺失标记 → 需要清除标记并重新同步');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ 检查失败:', error.message);
    console.error(error.stack);
  } finally {
    await dbService.close();
    process.exit(0);
  }
}

checkDataSync().catch(console.error);
