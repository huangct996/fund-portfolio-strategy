# 从ETF持仓到指数成分股的重构总结

## 重构概述

本次重构将回测系统从基于**红利低波ETF(512890.SH)持仓**改为基于**中证红利低波100指数(h30269.CSI)成分股**。

## 核心变更

### 1. 数据源变更
- **原来**: 从Tushare API的`fund_portfolio`接口获取ETF持仓数据
- **现在**: 从Tushare API的`index_weight`接口获取指数成分股权重数据

### 2. 调仓时机变更
- **原来**: 按基金报告期披露日调仓（一季报/中报/三季报/年报）
- **现在**: 按h30269.CSI指数的实际调仓日期调仓（来自`trade_date`字段）

### 3. 策略对比变更
- **原来**: 自定义策略 vs 原策略（基金持仓权重） vs 基金净值
- **现在**: 自定义策略 vs h30269.CSI指数 vs 512890.SH基金净值

## 已完成的工作

### 后端修改

#### 1. 数据库层 (`services/dbService.js`)
- ✅ 新增`index_weight`表，存储指数成分股权重数据
- ✅ 新增`getIndexWeight()`方法，获取指数成分股权重
- ✅ 新增`getIndexWeightDates()`方法，获取指数所有调仓日期
- ✅ 新增`saveIndexWeight()`方法，保存指数成分股权重到数据库

#### 2. Tushare服务层 (`services/tushareService.js`)
- ✅ 新增`getIndexWeight()`方法，调用Tushare API获取指数成分股权重
- ✅ 新增`getIndexWeightDates()`方法，获取指数调仓日期列表
- ✅ 新增`getIndexWeightByDate()`方法，获取指定日期的成分股权重

#### 3. 新增指数回测服务 (`services/indexPortfolioService.js`)
- ✅ `calculateIndexBasedReturns()`: 计算基于指数成分股的回测收益率
- ✅ `calculatePeriodReturns()`: 计算单个调仓期的收益率
- ✅ `enrichStockData()`: 丰富股票数据（市值、股息率等）
- ✅ `calculateCustomWeights()`: 计算自定义策略权重
- ✅ `calculatePortfolioReturns()`: 计算投资组合收益率
- ✅ `calculateCumulativeReturns()`: 计算累计收益率
- ✅ `calculateRiskMetrics()`: 计算风险指标
- ✅ `calculateTrackingError()`: 计算跟踪误差

#### 4. 路由层 (`routes/data.js`)
- ✅ 添加`INDEX_CODE`配置（h30269.CSI）
- ✅ 修改`FUND_CODE`默认值为512890.SH
- ✅ 新增`/api/rebalance-dates`接口，获取指数调仓日期
- ✅ 新增`/api/index-returns`接口，计算指数回测收益率

### 前端修改

#### 1. API调用 (`public/app.js`)
- ✅ 将API调用从`/all-returns`改为`/index-returns`
- ✅ 更新数据结构以适配新的返回格式

#### 2. 图表显示 (`public/app.js`)
- ✅ 横轴从`disclosureDate`改为`rebalanceDate`
- ✅ 将`originalData`改为`indexData`（指数数据）
- ✅ 图表标签：自定义策略、h30269.CSI指数、512890.SH基金净值
- ✅ 修复0值显示问题（使用`!== undefined`而不是`||`运算符）

#### 3. 风险指标显示 (`public/app.js`)
- ✅ 将`originalRisk`改为`indexRisk`
- ✅ 添加`trackingError`（跟踪误差）显示
- ✅ 更新`displayRiskMetrics()`函数以显示3列：自定义策略、指数、跟踪误差

#### 4. 持仓明细显示 (`public/app.js`)
- ✅ 将`originalHoldingsTable`改为`indexHoldingsTable`
- ✅ 数据源从`adjustedHoldings`改为`holdings`
- ✅ 权重字段从`originalWeight/adjustedWeight`改为`indexWeight/customWeight`

#### 5. 报告期详细信息 (`public/app.js`)
- ✅ 更新`updatePeriodInfo()`函数以使用新的数据结构
- ✅ 使用`rebalanceDate`作为调仓日期
- ✅ 显示指数收益率而不是原策略收益率
- ✅ 添加跟踪误差显示

#### 6. HTML更新 (`public/index.html`)
- ✅ 风险指标部分改为3列布局（自定义策略、指数、跟踪误差）
- ✅ 更新说明文字以反映指数跟踪逻辑
- ✅ 图表标题改为"按指数调仓日期"
- ✅ 持仓明细表格标题改为"h30269.CSI指数持仓"
- ✅ 添加跟踪误差显示元素
- ✅ 更新报告期详细信息说明文字

### 配置文件
- ✅ 添加`INDEX_CODE=h30269.CSI`到`.env`

## 数据结构变更

### 后端返回数据结构（新）
```javascript
{
  periods: [
    {
      rebalanceDate: "20190829",      // 调仓日期
      startDate: "20190829",           // 持有起始日
      endDate: "20191031",             // 持有结束日
      customReturn: 0.15,              // 自定义策略单期收益率
      indexReturn: 0.12,               // 指数单期收益率
      fundReturn: 0.10,                // 基金净值单期收益率
      customCumulativeReturn: 0.15,    // 自定义策略累计收益率
      indexCumulativeReturn: 0.12,     // 指数累计收益率
      fundCumulativeReturn: 0.10,      // 基金净值累计收益率
      trackingError: 0.03,             // 跟踪误差
      stockCount: 100,                 // 成分股数量
      holdings: [                      // 持仓明细
        {
          symbol: "600519.SH",
          name: "贵州茅台",
          indexWeight: 5.5,            // 指数权重（%）
          customWeight: 0.08,          // 自定义策略权重（小数）
          marketValue: 1000000,
          dvRatio: 1.2,
          peTtm: 30.5,
          pb: 10.2
        }
      ]
    }
  ],
  customRisk: { ... },                 // 自定义策略风险指标
  indexRisk: { ... },                  // 指数风险指标
  fundRisk: { ... },                   // 基金净值风险指标
  trackingError: { ... }               // 跟踪误差统计
}
```

## 测试步骤

1. **启动服务器**
   ```bash
   npm start
   ```

2. **访问页面**
   - 打开浏览器访问 http://localhost:3001

3. **测试功能**
   - [ ] 点击"应用配置并计算"按钮
   - [ ] 检查是否能成功获取h30269.CSI指数数据
   - [ ] 检查图表是否显示3条曲线（自定义策略、指数、基金净值）
   - [ ] 检查第一个点是否为0%
   - [ ] 检查风险指标是否正确显示（3列）
   - [ ] 检查持仓明细是否正确显示（指数权重 vs 自定义权重）
   - [ ] 检查跟踪误差是否正确显示

## 已知问题和待解决

### 可能的问题
1. **首次运行需要从Tushare API获取数据**
   - h30269.CSI指数的成分股权重数据需要首次从API获取
   - 可能需要较长时间（取决于数据量）

2. **数据可用性**
   - 需要确认h30269.CSI指数在Tushare中的数据是否完整
   - 如果数据不足，需要调整回测起始日期

3. **前端兼容性**
   - 部分旧的字段引用可能需要进一步调整
   - 需要测试所有交互功能

## 下一步工作

1. **测试验证**
   - 启动服务器并测试基本功能
   - 检查数据是否正确获取和显示
   - 验证计算逻辑是否正确

2. **Bug修复**
   - 根据测试结果修复发现的问题
   - 优化用户体验

3. **文档更新**
   - 更新README.md
   - 添加使用说明

## 技术栈

- **后端**: Node.js + Express
- **数据库**: MySQL
- **数据源**: Tushare Pro API
- **前端**: HTML + CSS + JavaScript + Chart.js

## 版本信息

- **版本**: v3.0.0
- **重构日期**: 2025-12-15
- **重构内容**: 从ETF持仓改为指数成分股跟踪
