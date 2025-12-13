# Tushare API 接口文档

本文档记录了基金复制策略系统中使用的所有Tushare API接口，包括接口方法、路径、入参、出参字段及中文含义。

---

## 1. 基金持仓接口 (fund_portfolio)

### 接口信息
- **接口名称**: `fund_portfolio`
- **接口说明**: 获取公募基金持仓明细数据
- **调用频率**: 每分钟最多调用200次
- **数据更新**: 季度更新

### 请求参数

| 参数名 | 类型 | 必选 | 说明 | 示例 |
|--------|------|------|------|------|
| ts_code | string | 是 | 基金代码（带后缀） | 512890.SH |
| end_date | string | 否 | 报告期（YYYYMMDD） | 20230630 |

### 返回字段

| 字段名 | 类型 | 说明 | 备注 |
|--------|------|------|------|
| ts_code | string | 基金代码 | 如：512890.SH |
| ann_date | string | 公告日期 | 格式：YYYYMMDD |
| end_date | string | 报告期 | 格式：YYYYMMDD |
| symbol | string | 股票代码 | 不带后缀，如：601939 |
| mkv | float | 持仓市值（元） | 单位：元 |
| amount | float | 持仓数量（股） | 单位：股 |
| stk_mkv_ratio | float | 占净值比例（%） | **关键字段**，用于计算原策略权重 |
| stk_float_ratio | float | 占流通股比例（%） | - |

### 使用场景
- 获取基金在每个报告期的持仓明细
- 计算原策略的持仓权重（使用`stk_mkv_ratio`字段）
- 判断是否为部分披露（权重总和<50%）

### 代码示例
```javascript
const data = await tushareService.callApi('fund_portfolio', {
  ts_code: '512890.SH'
});
```

---

## 2. 基金净值接口 (fund_nav)

### 接口信息
- **接口名称**: `fund_nav`
- **接口说明**: 获取公募基金净值数据
- **调用频率**: 每分钟最多调用2000次
- **数据更新**: 每日更新

### 请求参数

| 参数名 | 类型 | 必选 | 说明 | 示例 |
|--------|------|------|------|------|
| ts_code | string | 是 | 基金代码（带后缀） | 512890.SH |
| start_date | string | 否 | 开始日期（YYYYMMDD） | 20190101 |
| end_date | string | 否 | 结束日期（YYYYMMDD） | 20251231 |

### 返回字段

| 字段名 | 类型 | 说明 | 备注 |
|--------|------|------|------|
| ts_code | string | 基金代码 | 如：512890.SH |
| ann_date | string | 公告日期 | 格式：YYYYMMDD |
| nav_date | string | 净值日期 | 格式：YYYYMMDD |
| unit_nav | float | 单位净值 | **关键字段**，用于计算基金收益率 |
| accum_nav | float | 累计净值 | - |
| accum_div | float | 累计分红 | - |
| net_asset | float | 资产净值（元） | - |
| total_netasset | float | 合计资产净值（元） | - |
| adj_nav | float | 复权单位净值 | - |

### 使用场景
- 获取基金每日净值数据
- 计算基金在回测期间的收益率
- 作为策略收益率的对比基准

### 代码示例
```javascript
const data = await tushareService.callApi('fund_nav', {
  ts_code: '512890.SH',
  start_date: '20190101',
  end_date: '20251231'
});
```

---

## 3. 股票日线行情接口 (daily)

### 接口信息
- **接口名称**: `daily`
- **接口说明**: 获取股票日线行情数据（未复权）
- **调用频率**: 每分钟最多调用500次
- **数据更新**: 每日更新

### 请求参数

| 参数名 | 类型 | 必选 | 说明 | 示例 |
|--------|------|------|------|------|
| ts_code | string | 否 | 股票代码（带后缀） | 601939.SH |
| trade_date | string | 否 | 交易日期（YYYYMMDD） | 20230630 |
| start_date | string | 否 | 开始日期（YYYYMMDD） | 20230101 |
| end_date | string | 否 | 结束日期（YYYYMMDD） | 20231231 |

### 返回字段

| 字段名 | 类型 | 说明 | 备注 |
|--------|------|------|------|
| ts_code | string | 股票代码 | 如：601939.SH |
| trade_date | string | 交易日期 | 格式：YYYYMMDD |
| open | float | 开盘价 | - |
| high | float | 最高价 | - |
| low | float | 最低价 | - |
| close | float | 收盘价 | **关键字段**，未复权价格 |
| pre_close | float | 昨收价 | - |
| change | float | 涨跌额 | - |
| pct_chg | float | 涨跌幅（%） | - |
| vol | float | 成交量（手） | - |
| amount | float | 成交额（千元） | - |

### 使用场景
- 获取股票未复权的日线行情数据
- 配合复权因子计算前复权价格
- 计算股票收益率

### 代码示例
```javascript
const data = await tushareService.callApi('daily', {
  ts_code: '601939.SH',
  start_date: '20230101',
  end_date: '20231231'
});
```

---

## 4. 复权因子接口 (adj_factor)

### 接口信息
- **接口名称**: `adj_factor`
- **接口说明**: 获取股票复权因子数据
- **调用频率**: 每分钟最多调用2000次
- **数据更新**: 每日更新

### 请求参数

| 参数名 | 类型 | 必选 | 说明 | 示例 |
|--------|------|------|------|------|
| ts_code | string | 否 | 股票代码（带后缀） | 601939.SH |
| trade_date | string | 否 | 交易日期（YYYYMMDD） | 20230630 |
| start_date | string | 否 | 开始日期（YYYYMMDD） | 20230101 |
| end_date | string | 否 | 结束日期（YYYYMMDD） | 20231231 |

### 返回字段

| 字段名 | 类型 | 说明 | 备注 |
|--------|------|------|------|
| ts_code | string | 股票代码 | 如：601939.SH |
| trade_date | string | 交易日期 | 格式：YYYYMMDD |
| adj_factor | float | 复权因子 | **关键字段**，用于计算前复权价格 |

### 使用场景
- 获取股票复权因子
- 计算前复权价格：`前复权价 = 收盘价 × 复权因子`
- 确保股票收益率计算准确（处理分红、配股等因素）

### 复权价格计算公式
```javascript
// 前复权价格 = 未复权收盘价 × 复权因子
const adjPrice = closePrice * adjFactor;
```

### 代码示例
```javascript
const data = await tushareService.callApi('adj_factor', {
  ts_code: '601939.SH',
  start_date: '20230101',
  end_date: '20231231'
});
```

---

## 5. 股票基本信息接口 (stock_basic)

### 接口信息
- **接口名称**: `stock_basic`
- **接口说明**: 获取股票基本信息（名称、上市日期等）
- **调用频率**: 每分钟最多调用500次
- **数据更新**: 不定期更新

### 请求参数

| 参数名 | 类型 | 必选 | 说明 | 示例 |
|--------|------|------|------|------|
| ts_code | string | 否 | 股票代码（带后缀） | 601939.SH |
| exchange | string | 否 | 交易所代码 | SSE（上交所）、SZSE（深交所） |
| list_status | string | 否 | 上市状态 | L（上市）、D（退市）、P（暂停） |
| fields | string | 否 | 返回字段 | ts_code,name,list_date |

### 返回字段

| 字段名 | 类型 | 说明 | 备注 |
|--------|------|------|------|
| ts_code | string | 股票代码 | 如：601939.SH |
| symbol | string | 股票代码（不带后缀） | 如：601939 |
| name | string | 股票名称 | **关键字段**，如：中国建筑 |
| area | string | 地域 | - |
| industry | string | 行业 | - |
| market | string | 市场类型 | 主板、创业板、科创板等 |
| list_date | string | 上市日期 | 格式：YYYYMMDD |

### 使用场景
- 获取股票名称，用于前端显示
- 批量获取多只股票的基本信息

### 代码示例
```javascript
const data = await tushareService.callApi('stock_basic', {
  ts_code: '601939.SH,601998.SH,601288.SH'
});
```

---

## 6. 每日指标接口 (daily_basic)

### 接口信息
- **接口名称**: `daily_basic`
- **接口说明**: 获取股票每日指标数据（市值、PE、PB、股息率等）
- **调用频率**: 每分钟最多调用500次
- **数据更新**: 每日更新

### 请求参数

| 参数名 | 类型 | 必选 | 说明 | 示例 |
|--------|------|------|------|------|
| ts_code | string | 否 | 股票代码（带后缀） | 601939.SH |
| trade_date | string | 否 | 交易日期（YYYYMMDD） | 20230630 |
| start_date | string | 否 | 开始日期（YYYYMMDD） | 20230101 |
| end_date | string | 否 | 结束日期（YYYYMMDD） | 20231231 |
| fields | string | 否 | 返回字段 | ts_code,trade_date,total_mv,dv_ratio,pe_ttm,pb |

### 返回字段

| 字段名 | 类型 | 说明 | 备注 |
|--------|------|------|------|
| ts_code | string | 股票代码 | 如：601939.SH |
| trade_date | string | 交易日期 | 格式：YYYYMMDD |
| close | float | 收盘价 | - |
| turnover_rate | float | 换手率（%） | - |
| turnover_rate_f | float | 换手率（自由流通股，%） | - |
| volume_ratio | float | 量比 | - |
| pe | float | 市盈率（动态） | - |
| pe_ttm | float | 市盈率（TTM） | **关键字段**，用于质量因子计算 |
| pb | float | 市净率 | **关键字段**，用于质量因子计算 |
| ps | float | 市销率 | - |
| ps_ttm | float | 市销率（TTM） | - |
| dv_ratio | float | 股息率（%） | **关键字段**，用于综合得分计算 |
| dv_ttm | float | 股息率（TTM，%） | - |
| total_share | float | 总股本（万股） | - |
| float_share | float | 流通股本（万股） | - |
| free_share | float | 自由流通股本（万股） | - |
| total_mv | float | 总市值（万元） | **关键字段**，用于市值加权策略 |
| circ_mv | float | 流通市值（万元） | - |

### 使用场景
- 获取股票市值数据，用于市值加权策略
- 获取股息率数据，用于综合得分计算
- 获取PE、PB数据，用于质量因子计算

### 重要说明
⚠️ **该接口不支持批量股票查询（用逗号分隔）**，只支持：
1. 单个股票 + 日期范围查询
2. **指定交易日期查询所有股票**（推荐）

### 正确用法
```javascript
// ✅ 正确：指定交易日期，查询所有股票
const data = await tushareService.callApi('daily_basic', {
  trade_date: '20230630',
  fields: 'ts_code,trade_date,total_mv,dv_ratio,pe_ttm,pb'
});

// ❌ 错误：批量股票查询（返回0条数据）
const data = await tushareService.callApi('daily_basic', {
  ts_code: '601939.SH,601998.SH,601288.SH',  // 不支持
  trade_date: '20230630'
});
```

### 代码示例
```javascript
// 尝试多个日期，找到最接近的交易日
const datesToTry = [
  tradeDate,
  this.addDays(tradeDate, -1),
  this.addDays(tradeDate, -2),
  this.addDays(tradeDate, -3),
  this.addDays(tradeDate, 1),
  this.addDays(tradeDate, 2),
  this.addDays(tradeDate, 3)
];

for (const date of datesToTry) {
  const data = await this.callApi('daily_basic', {
    trade_date: date,
    fields: 'ts_code,trade_date,total_mv,dv_ratio,pe_ttm,pb'
  });
  
  if (data && data.length > 0) {
    // 找到有数据的交易日
    break;
  }
}
```

---

## 7. 财务指标接口 (fina_indicator)

### 接口信息
- **接口名称**: `fina_indicator`
- **接口说明**: 获取上市公司财务指标数据
- **调用频率**: 每分钟最多调用2000次
- **数据更新**: 季度更新

### 请求参数

| 参数名 | 类型 | 必选 | 说明 | 示例 |
|--------|------|------|------|------|
| ts_code | string | 否 | 股票代码（带后缀） | 601939.SH |
| ann_date | string | 否 | 公告日期（YYYYMMDD） | 20230430 |
| start_date | string | 否 | 报告期开始日期 | 20230101 |
| end_date | string | 否 | 报告期结束日期 | 20231231 |
| period | string | 否 | 报告期（YYYYMMDD） | 20230630 |

### 返回字段

| 字段名 | 类型 | 说明 | 备注 |
|--------|------|------|------|
| ts_code | string | 股票代码 | 如：601939.SH |
| ann_date | string | 公告日期 | 格式：YYYYMMDD |
| end_date | string | 报告期 | 格式：YYYYMMDD |
| eps | float | 基本每股收益 | - |
| dt_eps | float | 稀释每股收益 | - |
| total_revenue_ps | float | 每股营业总收入 | - |
| revenue_ps | float | 每股营业收入 | - |
| capital_rese_ps | float | 每股资本公积 | - |
| surplus_rese_ps | float | 每股盈余公积 | - |
| undist_profit_ps | float | 每股未分配利润 | - |
| extra_item | float | 非经常性损益 | - |
| profit_dedt | float | 扣除非经常性损益后的净利润 | - |
| gross_margin | float | 毛利率（%） | - |
| current_ratio | float | 流动比率 | - |
| quick_ratio | float | 速动比率 | - |
| cash_ratio | float | 保守速动比率 | - |
| invturn_days | float | 存货周转天数 | - |
| arturn_days | float | 应收账款周转天数 | - |
| inv_turn | float | 存货周转率 | - |
| ar_turn | float | 应收账款周转率 | - |
| ca_turn | float | 流动资产周转率 | - |
| fa_turn | float | 固定资产周转率 | - |
| assets_turn | float | 总资产周转率 | - |
| op_income | float | 经营活动净收益 | - |
| valuechange_income | float | 价值变动净收益 | - |
| interst_income | float | 利息费用 | - |
| daa | float | 折旧与摊销 | - |
| ebit | float | 息税前利润 | - |
| ebitda | float | 息税折旧摊销前利润 | - |
| fcff | float | 企业自由现金流量 | - |
| fcfe | float | 股权自由现金流量 | - |
| current_exint | float | 无息流动负债 | - |
| noncurrent_exint | float | 无息非流动负债 | - |
| interestdebt | float | 带息债务 | - |
| netdebt | float | 净债务 | - |
| tangible_asset | float | 有形资产 | - |
| working_capital | float | 营运资金 | - |
| networking_capital | float | 营运流动资本 | - |
| invest_capital | float | 全部投入资本 | - |
| retained_earnings | float | 留存收益 | - |
| diluted2_eps | float | 期末摊薄每股收益 | - |
| bps | float | 每股净资产 | - |
| ocfps | float | 每股经营活动产生的现金流量净额 | - |
| retainedps | float | 每股留存收益 | - |
| cfps | float | 每股现金流量净额 | - |
| ebit_ps | float | 每股息税前利润 | - |
| fcff_ps | float | 每股企业自由现金流量 | - |
| fcfe_ps | float | 每股股东自由现金流量 | - |
| netprofit_margin | float | 销售净利率（%） | - |
| grossprofit_margin | float | 销售毛利率（%） | - |
| cogs_of_sales | float | 销售成本率（%） | - |
| expense_of_sales | float | 销售期间费用率（%） | - |
| profit_to_gr | float | 净利润/营业总收入（%） | - |
| saleexp_to_gr | float | 销售费用/营业总收入（%） | - |
| adminexp_of_gr | float | 管理费用/营业总收入（%） | - |
| finaexp_of_gr | float | 财务费用/营业总收入（%） | - |
| impai_ttm | float | 资产减值损失/营业总收入（%） | - |
| gc_of_gr | float | 营业总成本/营业总收入（%） | - |
| op_of_gr | float | 营业利润/营业总收入（%） | - |
| ebit_of_gr | float | 息税前利润/营业总收入（%） | - |
| roe | float | 净资产收益率（%） | **关键字段**，用于质量因子计算 |
| roe_waa | float | 加权平均净资产收益率（%） | - |
| roe_dt | float | 净资产收益率（扣除非经常损益，%） | - |
| roa | float | 总资产报酬率（%） | **关键字段**，用于质量因子计算 |
| npta | float | 总资产净利润（%） | - |
| roic | float | 投入资本回报率（%） | - |
| roe_yearly | float | 年化净资产收益率（%） | - |
| roa2_yearly | float | 年化总资产报酬率（%） | - |
| roe_avg | float | 平均净资产收益率（基于年初年末，%） | - |
| opincome_of_ebt | float | 经营活动净收益/利润总额（%） | - |
| investincome_of_ebt | float | 价值变动净收益/利润总额（%） | - |
| n_op_profit_of_ebt | float | 营业外收支净额/利润总额（%） | - |
| tax_to_ebt | float | 所得税/利润总额（%） | - |
| dtprofit_to_profit | float | 扣除非经常损益后的净利润/净利润（%） | - |
| salescash_to_or | float | 销售商品提供劳务收到的现金/营业收入（%） | - |
| ocf_to_or | float | 经营活动产生的现金流量净额/营业收入（%） | - |
| ocf_to_opincome | float | 经营活动产生的现金流量净额/经营活动净收益（%） | - |
| capitalized_to_da | float | 资本支出/折旧和摊销（%） | - |
| debt_to_assets | float | 资产负债率（%） | - |
| assets_to_eqt | float | 权益乘数 | - |
| dp_assets_to_eqt | float | 权益乘数（杜邦分析） | - |
| ca_to_assets | float | 流动资产/总资产（%） | - |
| nca_to_assets | float | 非流动资产/总资产（%） | - |
| tbassets_to_totalassets | float | 有形资产/总资产（%） | - |
| int_to_talcap | float | 带息债务/全部投入资本（%） | - |
| eqt_to_talcapital | float | 归属于母公司的股东权益/全部投入资本（%） | - |
| currentdebt_to_debt | float | 流动负债/负债合计（%） | - |
| longdeb_to_debt | float | 非流动负债/负债合计（%） | - |
| ocf_to_shortdebt | float | 经营活动产生的现金流量净额/流动负债（%） | - |
| debt_to_eqt | float | 产权比率（%） | - |
| eqt_to_debt | float | 归属于母公司的股东权益/负债合计（%） | - |
| eqt_to_interestdebt | float | 归属于母公司的股东权益/带息债务（%） | - |
| tangibleasset_to_debt | float | 有形资产/负债合计（%） | - |
| tangasset_to_intdebt | float | 有形资产/带息债务（%） | - |
| tangibleasset_to_netdebt | float | 有形资产/净债务（%） | - |
| ocf_to_debt | float | 经营活动产生的现金流量净额/负债合计（%） | - |
| ocf_to_interestdebt | float | 经营活动产生的现金流量净额/带息债务（%） | - |
| ocf_to_netdebt | float | 经营活动产生的现金流量净额/净债务（%） | - |
| ebit_to_interest | float | 已获利息倍数（EBIT/利息费用） | - |
| longdebt_to_workingcapital | float | 长期债务与营运资金比率（%） | - |
| ebitda_to_debt | float | 息税折旧摊销前利润/负债合计（%） | - |
| turn_days | float | 营业周期（天） | - |
| roa_yearly | float | 年化总资产净利率（%） | - |
| roa_dp | float | 总资产净利率（杜邦分析，%） | - |
| fixed_assets | float | 固定资产合计 | - |
| profit_prefin_exp | float | 扣除财务费用前营业利润 | - |
| non_op_profit | float | 非营业利润 | - |
| op_to_ebt | float | 营业利润／利润总额（%） | - |
| nop_to_ebt | float | 非营业利润／利润总额（%） | - |
| ocf_to_profit | float | 经营活动产生的现金流量净额／营业利润（%） | - |
| cash_to_liqdebt | float | 货币资金／流动负债（%） | - |
| cash_to_liqdebt_withinterest | float | 货币资金／带息流动负债（%） | - |
| op_to_liqdebt | float | 营业利润／流动负债（%） | - |
| op_to_debt | float | 营业利润／负债合计（%） | - |
| roic_yearly | float | 年化投入资本回报率（%） | - |
| total_fa_trun | float | 固定资产合计周转率 | - |
| profit_to_op | float | 利润总额／营业收入（%） | - |
| q_opincome | float | 经营活动单季度净收益 | - |
| q_investincome | float | 价值变动单季度净收益 | - |
| q_dtprofit | float | 扣除非经常损益后的单季度净利润 | - |
| q_eps | float | 每股收益（单季度） | - |
| q_netprofit_margin | float | 销售净利率（单季度，%） | - |
| q_gsprofit_margin | float | 销售毛利率（单季度，%） | - |
| q_exp_to_sales | float | 销售期间费用率（单季度，%） | - |
| q_profit_to_gr | float | 净利润／营业总收入（单季度，%） | - |
| q_saleexp_to_gr | float | 销售费用／营业总收入（单季度，%） | - |
| q_adminexp_to_gr | float | 管理费用／营业总收入（单季度，%） | - |
| q_finaexp_to_gr | float | 财务费用／营业总收入（单季度，%） | - |
| q_impair_to_gr_ttm | float | 资产减值损失／营业总收入（单季度，%） | - |
| q_gc_to_gr | float | 营业总成本／营业总收入（单季度，%） | - |
| q_op_to_gr | float | 营业利润／营业总收入（单季度，%） | - |
| q_roe | float | 净资产收益率（单季度，%） | - |
| q_dt_roe | float | 净资产收益率（扣除非经常损益，单季度，%） | - |
| q_npta | float | 总资产净利润（单季度，%） | - |
| q_opincome_to_ebt | float | 经营活动净收益／利润总额（单季度，%） | - |
| q_investincome_to_ebt | float | 价值变动净收益／利润总额（单季度，%） | - |
| q_dtprofit_to_profit | float | 扣除非经常损益后的净利润／净利润（单季度，%） | - |
| q_salescash_to_or | float | 销售商品提供劳务收到的现金／营业收入（单季度，%） | - |
| q_ocf_to_sales | float | 经营活动产生的现金流量净额／营业收入（单季度，%） | - |
| q_ocf_to_or | float | 经营活动产生的现金流量净额／经营活动净收益（单季度，%） | - |
| basic_eps_yoy | float | 基本每股收益同比增长率（%） | - |
| dt_eps_yoy | float | 稀释每股收益同比增长率（%） | - |
| cfps_yoy | float | 每股经营活动产生的现金流量净额同比增长率（%） | - |
| op_yoy | float | 营业利润同比增长率（%） | - |
| ebt_yoy | float | 利润总额同比增长率（%） | - |
| netprofit_yoy | float | 归属母公司股东的净利润同比增长率（%） | - |
| dt_netprofit_yoy | float | 归属母公司股东的净利润（扣除非经常损益）同比增长率（%） | - |
| ocf_yoy | float | 经营活动产生的现金流量净额同比增长率（%） | - |
| roe_yoy | float | 净资产收益率（摊薄）同比增长率（%） | - |
| bps_yoy | float | 每股净资产相对年初增长率（%） | - |
| assets_yoy | float | 资产总计相对年初增长率（%） | - |
| eqt_yoy | float | 归属母公司的股东权益相对年初增长率（%） | - |
| tr_yoy | float | 营业总收入同比增长率（%） | - |
| or_yoy | float | 营业收入同比增长率（%） | - |
| q_gr_yoy | float | 营业总收入同比增长率（单季度，%） | - |
| q_gr_qoq | float | 营业总收入环比增长率（单季度，%） | - |
| q_sales_yoy | float | 营业收入同比增长率（单季度，%） | - |
| q_sales_qoq | float | 营业收入环比增长率（单季度，%） | - |
| q_op_yoy | float | 营业利润同比增长率（单季度，%） | - |
| q_op_qoq | float | 营业利润环比增长率（单季度，%） | - |
| q_profit_yoy | float | 净利润同比增长率（单季度，%） | - |
| q_profit_qoq | float | 净利润环比增长率（单季度，%） | - |
| q_netprofit_yoy | float | 归属母公司股东的净利润同比增长率（单季度，%） | - |
| q_netprofit_qoq | float | 归属母公司股东的净利润环比增长率（单季度，%） | - |
| equity_yoy | float | 净资产同比增长率（%） | - |
| rd_exp | float | 研发费用 | - |
| update_flag | string | 更新标识 | - |

### 使用场景
- 获取ROE、ROA等财务指标，用于质量因子计算
- 备用接口，当`daily_basic`接口无法获取质量因子时使用

### 代码示例
```javascript
const data = await tushareService.callApi('fina_indicator', {
  ts_code: '601939.SH',
  period: '20230630'
});
```

---

## API调用统计

| 接口名称 | 调用频率 | 主要用途 | 关键字段 |
|---------|---------|---------|---------|
| fund_portfolio | 低频（季度） | 获取基金持仓 | stk_mkv_ratio |
| fund_nav | 中频（每日） | 获取基金净值 | unit_nav |
| daily | 高频（批量） | 获取股票日线 | close |
| adj_factor | 高频（批量） | 获取复权因子 | adj_factor |
| stock_basic | 低频（批量） | 获取股票名称 | name |
| daily_basic | 中频（单次） | 获取市值/股息率/PE/PB | total_mv, dv_ratio, pe_ttm, pb |
| fina_indicator | 低频（备用） | 获取财务指标 | roe, roa |

---

## 注意事项

### 1. API调用频率限制
- 不同接口有不同的调用频率限制
- 建议在代码中添加延迟（200-500ms）避免触发限制
- 使用数据库缓存减少API调用次数

### 2. 数据完整性
- 部分股票可能缺少市值、股息率等数据
- 新上市股票可能没有历史数据
- 退市股票可能没有最新数据

### 3. 日期格式
- 所有日期字段统一使用YYYYMMDD格式
- 报告期通常是季度末：0331、0630、0930、1231
- 公告日通常晚于报告期2个月

### 4. 复权价格计算
- 必须使用前复权价格计算收益率
- 前复权价格 = 未复权收盘价 × 复权因子
- 确保日线数据和复权因子数据日期对齐

### 5. 批量查询限制
- `daily_basic`接口不支持批量股票查询（用逗号分隔）
- 建议使用指定交易日期查询所有股票，然后筛选需要的股票
- 其他接口（如`stock_basic`）支持批量查询

---

## 更新日志

| 日期 | 版本 | 更新内容 |
|------|------|---------|
| 2025-12-13 | 1.0.0 | 初始版本，记录所有使用的Tushare API接口 |
