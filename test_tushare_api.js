/**
 * 测试Tushare API的daily_basic接口
 */

const axios = require('axios');
require('dotenv').config();

const TUSHARE_TOKEN = process.env.TUSHARE_TOKEN;
const TUSHARE_API_URL = 'http://api.tushare.pro';

async function callTushareApi(apiName, params) {
  try {
    const response = await axios.post(TUSHARE_API_URL, {
      api_name: apiName,
      token: TUSHARE_TOKEN,
      params: params,
      fields: params.fields || ''
    });

    if (response.data.code !== 0) {
      throw new Error(`Tushare API错误: ${response.data.msg}`);
    }

    const items = response.data.data.items || [];
    const fields = response.data.data.fields || [];
    
    return items.map(item => {
      const obj = {};
      fields.forEach((field, index) => {
        obj[field] = item[index];
      });
      return obj;
    });
  } catch (error) {
    console.error(`API调用失败:`, error.message);
    return [];
  }
}

async function testDailyBasicApi() {
  console.log('\n========================================');
  console.log('测试Tushare daily_basic接口');
  console.log('========================================\n');

  // 测试1: 单个股票查询
  console.log('【测试1】单个股票查询');
  const result1 = await callTushareApi('daily_basic', {
    ts_code: '601939.SH',
    start_date: '20190623',
    end_date: '20190707',
    fields: 'ts_code,trade_date,total_mv,dv_ratio,pe_ttm,pb'
  });
  console.log(`结果: ${result1.length} 条数据`);
  if (result1.length > 0) {
    console.log('前3条:', result1.slice(0, 3));
  }

  await new Promise(resolve => setTimeout(resolve, 500));

  // 测试2: 批量股票查询（用逗号分隔）
  console.log('\n【测试2】批量股票查询（逗号分隔）');
  const result2 = await callTushareApi('daily_basic', {
    ts_code: '601939.SH,601998.SH,601288.SH',
    start_date: '20190623',
    end_date: '20190707',
    fields: 'ts_code,trade_date,total_mv,dv_ratio,pe_ttm,pb'
  });
  console.log(`结果: ${result2.length} 条数据`);
  if (result2.length > 0) {
    console.log('前3条:', result2.slice(0, 3));
  }

  await new Promise(resolve => setTimeout(resolve, 500));

  // 测试3: 指定交易日期查询
  console.log('\n【测试3】指定交易日期查询');
  const result3 = await callTushareApi('daily_basic', {
    trade_date: '20190628',
    fields: 'ts_code,trade_date,total_mv,dv_ratio,pe_ttm,pb'
  });
  console.log(`结果: ${result3.length} 条数据`);
  if (result3.length > 0) {
    console.log('前3条:', result3.slice(0, 3));
  }

  await new Promise(resolve => setTimeout(resolve, 500));

  // 测试4: 指定交易日期 + 股票代码
  console.log('\n【测试4】指定交易日期 + 股票代码');
  const result4 = await callTushareApi('daily_basic', {
    ts_code: '601939.SH',
    trade_date: '20190628',
    fields: 'ts_code,trade_date,total_mv,dv_ratio,pe_ttm,pb'
  });
  console.log(`结果: ${result4.length} 条数据`);
  if (result4.length > 0) {
    console.log('数据:', result4);
  }

  process.exit(0);
}

testDailyBasicApi();
