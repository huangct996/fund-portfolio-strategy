# Tushare股票公告接口文档

## 📋 接口概览

Tushare提供了多个与股票公告相关的接口，可以查询单个股票或全市场的公告信息。

---

## 🔍 主要公告接口

### **1. anns_d - 全量公告数据**

**接口名称**: `anns_d`  
**描述**: 获取全量公告数据，提供PDF下载URL  
**权限**: 单独权限，需要特殊申请  
**限量**: 单次最大2000条

#### **输入参数**
| 参数名 | 类型 | 必选 | 描述 |
|--------|------|------|------|
| ann_date | str | 是 | 公告日期（YYYYMMDD） |
| ts_code | str | 否 | 股票代码（可选，用于筛选单个股票） |
| start_date | str | 否 | 开始日期 |
| end_date | str | 否 | 结束日期 |

#### **输出字段**
| 字段名 | 类型 | 描述 |
|--------|------|------|
| ann_date | str | 公告日期 |
| ts_code | str | 股票代码 |
| name | str | 股票名称 |
| title | str | 公告标题 |
| url | str | 公告PDF下载链接 |

#### **调用示例**
```python
import tushare as ts

pro = ts.pro_api('your_token')

# 获取某日全部公告
df = pro.anns_d(ann_date='20230621')

# 获取单个股票的公告
df = pro.anns_d(ts_code='600000.SH', start_date='20230101', end_date='20230630')
```

#### **数据样例**
```
   ann_date      ts_code    name                              title
0  20230621  600590.SH  泰豪科技  第八届董事会第十五次会议决议公告
1  20230621  300504.SZ  天邑股份  天邑股份：关于回购注销部分限制性股票的公告
2  20230621  002815.SZ  崇达技术  崇达技术：中信建投证券股份有限公司关于...
```

---

### **2. 其他相关接口**

#### **2.1 财务报告公告日期**
通过财务报表接口可以获取公告日期：

**接口**: `income`（利润表）、`balancesheet`（资产负债表）、`cashflow`（现金流量表）

**字段**:
- `ann_date`: 公告日期
- `f_ann_date`: 实际公告日期
- `end_date`: 报告期
- `report_type`: 报告类型（1-合并报表，2-单季合并，3-调整单季合并表，4-调整合并报表）

**示例**:
```python
# 获取财务报表及公告日期
df = pro.income(
    ts_code='600000.SH',
    start_date='20230101',
    end_date='20230630',
    fields='ts_code,ann_date,f_ann_date,end_date,report_type'
)
```

#### **2.2 分红送股公告**
**接口**: `dividend`

**字段**:
- `ann_date`: 预案公告日
- `record_date`: 股权登记日
- `ex_date`: 除权除息日
- `pay_date`: 派息日
- `div_proc`: 分红进度

**示例**:
```python
# 获取分红公告
df = pro.dividend(ts_code='600000.SH')
```

#### **2.3 股本变动公告**
**接口**: `share_float`

**字段**:
- `ann_date`: 公告日期
- `float_date`: 流通日期
- `float_share`: 流通股份
- `float_ratio`: 流通比例

**示例**:
```python
# 获取股本变动公告
df = pro.share_float(ts_code='600000.SH')
```

#### **2.4 业绩预告**
**接口**: `forecast`

**字段**:
- `ann_date`: 公告日期
- `end_date`: 报告期
- `type`: 业绩预告类型（预增/预减/扭亏/首亏等）
- `p_change_min`: 预告净利润变动幅度下限
- `p_change_max`: 预告净利润变动幅度上限

**示例**:
```python
# 获取业绩预告
df = pro.forecast(ts_code='600000.SH', start_date='20230101', end_date='20231231')
```

#### **2.5 业绩快报**
**接口**: `express`

**字段**:
- `ann_date`: 公告日期
- `end_date`: 报告期
- `revenue`: 营业收入
- `operate_profit`: 营业利润
- `total_profit`: 利润总额
- `n_income`: 净利润

**示例**:
```python
# 获取业绩快报
df = pro.express(ts_code='600000.SH', start_date='20230101', end_date='20231231')
```

---

## 📊 单个股票可查询的信息汇总

### **基本信息**
- ✅ 股票基本资料（`stock_basic`）
- ✅ 上市公司基本信息（`stock_company`）
- ✅ IPO新股列表（`new_share`）

### **交易数据**
- ✅ 日线行情（`daily`）
- ✅ 周线行情（`weekly`）
- ✅ 月线行情（`monthly`）
- ✅ 复权因子（`adj_factor`）
- ✅ 停复牌信息（`suspend_d`）
- ✅ 每日指标（`daily_basic`）：PE、PB、PS、总市值、流通市值等

### **财务数据**
- ✅ 利润表（`income`）
- ✅ 资产负债表（`balancesheet`）
- ✅ 现金流量表（`cashflow`）
- ✅ 业绩预告（`forecast`）
- ✅ 业绩快报（`express`）
- ✅ 财务指标（`fina_indicator`）：ROE、ROA、毛利率等

### **公司治理**
- ✅ 管理层薪酬（`stk_rewards`）
- ✅ 管理层持股（`stk_holdertrade`）
- ✅ 股东人数（`stk_holdernumber`）
- ✅ 十大股东（`top10_holders`）
- ✅ 十大流通股东（`top10_floatholders`）

### **资本运作**
- ✅ 分红送股（`dividend`）
- ✅ 增发（`share_float`）
- ✅ 股权质押（`pledge_stat`）
- ✅ 股权质押明细（`pledge_detail`）
- ✅ 股份回购（`repurchase`）

### **公告信息**
- ✅ 全量公告（`anns_d`）：需要特殊权限
- ✅ 财务报告公告日期：通过财务报表接口获取
- ✅ 分红公告：通过`dividend`接口获取
- ✅ 业绩预告：通过`forecast`接口获取
- ✅ 业绩快报：通过`express`接口获取

### **市场参考**
- ✅ 融资融券交易明细（`margin_detail`）
- ✅ 前十大股东增减持（`top_inst`）
- ✅ 限售股解禁（`share_float`）
- ✅ 大宗交易（`block_trade`）
- ✅ 股票回购（`repurchase`）

---

## 💡 使用建议

### **1. 获取单个股票的完整公告信息**
```python
import tushare as ts

pro = ts.pro_api('your_token')
ts_code = '600000.SH'

# 1. 财务报告公告
income_df = pro.income(ts_code=ts_code, fields='ann_date,f_ann_date,end_date')

# 2. 分红公告
dividend_df = pro.dividend(ts_code=ts_code)

# 3. 业绩预告
forecast_df = pro.forecast(ts_code=ts_code, start_date='20230101')

# 4. 业绩快报
express_df = pro.express(ts_code=ts_code, start_date='20230101')

# 5. 全量公告（需要特殊权限）
# anns_df = pro.anns_d(ts_code=ts_code, start_date='20230101')
```

### **2. 权限要求**
- **基础接口**（如财务报表、分红等）：需要2000-5000积分
- **全量公告接口**（`anns_d`）：需要单独申请权限

### **3. 调用频率限制**
- 普通用户：200次/分钟
- 高级用户：根据积分等级不同

---

## 📝 注意事项

1. **公告日期字段**:
   - `ann_date`: 预案公告日期
   - `f_ann_date`: 实际公告日期（财务报表）
   - 建议使用`f_ann_date`作为实际公告日期

2. **数据完整性**:
   - 全量公告接口需要特殊权限
   - 可以通过各类专项接口组合获取大部分公告信息

3. **PDF下载**:
   - `anns_d`接口提供PDF下载URL
   - 其他接口主要提供结构化数据

4. **历史数据**:
   - 大部分接口支持历史数据查询
   - 建议按日期范围分批获取

---

## 🔗 参考链接

- [Tushare官方文档](https://tushare.pro/document/2)
- [全量公告接口](https://tushare.pro/document/2?doc_id=176)
- [财务数据接口](https://tushare.pro/document/2?doc_id=33)
- [权限说明](https://tushare.pro/document/1?doc_id=290)

---

**文档版本**: V1.0  
**更新日期**: 2026-01-06  
**维护者**: Cascade AI
