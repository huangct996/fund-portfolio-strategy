require('dotenv').config();
const axios = require('axios');

const TUSHARE_TOKEN = process.env.TUSHARE_TOKEN;
const TUSHARE_API_URL = 'http://api.tushare.pro';

async function testFundPortfolioAPI() {
  console.log('========================================');
  console.log('测试 Tushare fund_portfolio 接口');
  console.log('========================================\n');

  const params = {
    api_name: 'fund_portfolio',
    token: TUSHARE_TOKEN,
    params: {
      ts_code: '512890.SH'
    },
    fields: 'ts_code,ann_date,end_date,symbol,mkv,amount,stk_mkv_ratio,stk_float_ratio'
  };

  console.log('【入参】');
  console.log('API名称:', params.api_name);
  console.log('基金代码:', params.params.ts_code);
  console.log('请求字段:', params.fields);
  console.log('');

  try {
    const response = await axios.post(TUSHARE_API_URL, params);
    
    if (response.data.code !== 0) {
      console.error('API调用失败:', response.data.msg);
      return;
    }

    const data = response.data.data;
    console.log('【出参】');
    console.log('返回记录数:', data.items.length);
    console.log('');

    // 按报告期分组
    const groupedByEndDate = {};
    data.items.forEach(item => {
      const [ts_code, ann_date, end_date, symbol, mkv, amount, stk_mkv_ratio, stk_float_ratio] = item;
      if (!groupedByEndDate[end_date]) {
        groupedByEndDate[end_date] = [];
      }
      groupedByEndDate[end_date].push({
        ts_code,
        ann_date,
        end_date,
        symbol,
        mkv,
        amount,
        stk_mkv_ratio,
        stk_float_ratio
      });
    });

    // 显示每个报告期的信息
    const endDates = Object.keys(groupedByEndDate).sort();
    console.log('【报告期详情】');
    console.log(`共 ${endDates.length} 个报告期\n`);

    endDates.slice(0, 5).forEach(endDate => {
      const holdings = groupedByEndDate[endDate];
      const firstHolding = holdings[0];
      
      console.log(`报告期: ${endDate}`);
      console.log(`  披露日期(ann_date): ${firstHolding.ann_date}`);
      console.log(`  持仓数量: ${holdings.length} 只`);
      console.log(`  前3只股票:`);
      holdings.slice(0, 3).forEach((h, i) => {
        console.log(`    ${i+1}. ${h.symbol}: 权重=${h.stk_mkv_ratio}%, 市值=${h.mkv}元`);
      });
      console.log('');
    });

    // 重点检查2019-01-10这个报告期
    console.log('【重点检查：2019-01-10报告期】');
    const target = groupedByEndDate['20190110'];
    if (target && target.length > 0) {
      console.log(`报告期日期(end_date): ${target[0].end_date}`);
      console.log(`披露日期(ann_date): ${target[0].ann_date}`);
      console.log(`持仓数量: ${target.length} 只`);
      console.log(`前5只股票:`);
      target.slice(0, 5).forEach((h, i) => {
        console.log(`  ${i+1}. ${h.symbol}: 权重=${h.stk_mkv_ratio}%, 市值=${h.mkv}元, 披露日=${h.ann_date}`);
      });
    } else {
      console.log('未找到2019-01-10报告期数据');
    }

  } catch (error) {
    console.error('API调用异常:', error.message);
  }
}

testFundPortfolioAPI();
