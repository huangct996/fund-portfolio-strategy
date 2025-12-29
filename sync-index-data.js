const axios = require('axios');
const dbService = require('./services/dbService');
require('dotenv').config();

const TUSHARE_TOKEN = process.env.TUSHARE_TOKEN;
const TUSHARE_API = 'http://api.tushare.pro';

async function syncIndexData() {
    console.log('===============================================');
    console.log('🔄 同步指数日线数据到本地数据库');
    console.log('===============================================\n');

    try {
        // 初始化数据库
        await dbService.init();
        const connection = await dbService.pool.getConnection();

        // 获取000300.SH指数数据（2019-01-01至今）
        const indexCode = '000300.SH';
        const startDate = '20190101';
        const endDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');

        console.log(`📊 获取指数 ${indexCode} 数据...`);
        console.log(`   时间范围: ${startDate} - ${endDate}\n`);

        // 调用Tushare API
        const response = await axios.post(TUSHARE_API, {
            api_name: 'index_daily',
            token: TUSHARE_TOKEN,
            params: {
                ts_code: indexCode,
                start_date: startDate,
                end_date: endDate
            },
            fields: 'ts_code,trade_date,open,high,low,close,vol,amount'
        });

        if (!response.data || !response.data.data || !response.data.data.items) {
            throw new Error('Tushare API返回数据格式错误');
        }

        const items = response.data.data.items;
        console.log(`✅ 获取到 ${items.length} 条数据\n`);

        // 批量插入数据库
        let insertCount = 0;
        let updateCount = 0;

        for (const item of items) {
            const [ts_code, trade_date, open, high, low, close, vol, amount] = item;

            try {
                await connection.execute(`
                    INSERT INTO index_daily (ts_code, trade_date, open_price, high_price, low_price, close_price, volume, amount)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        open_price = VALUES(open_price),
                        high_price = VALUES(high_price),
                        low_price = VALUES(low_price),
                        close_price = VALUES(close_price),
                        volume = VALUES(volume),
                        amount = VALUES(amount),
                        updated_at = CURRENT_TIMESTAMP
                `, [ts_code, trade_date, open, high, low, close, vol, amount]);

                // 检查是否是插入还是更新
                const [result] = await connection.execute(
                    'SELECT ROW_COUNT() as affected_rows'
                );
                
                if (result[0].affected_rows === 1) {
                    insertCount++;
                } else if (result[0].affected_rows === 2) {
                    updateCount++;
                }
            } catch (error) {
                console.error(`❌ 插入数据失败 (${trade_date}):`, error.message);
            }
        }

        connection.release();

        console.log('\n===============================================');
        console.log('✅ 同步完成！');
        console.log('===============================================');
        console.log(`   新增: ${insertCount} 条`);
        console.log(`   更新: ${updateCount} 条`);
        console.log(`   总计: ${items.length} 条`);

    } catch (error) {
        console.error('❌ 同步失败:', error.message);
        throw error;
    } finally {
        if (dbService.pool) {
            await dbService.pool.end();
        }
    }
}

syncIndexData();
