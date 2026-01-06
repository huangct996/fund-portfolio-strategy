# 问题分析和修复方案

## 问题1: 自定义策略累计收益率过高（238.82%）

### 根本原因

从调试分析发现：
- **所有调仓期的持仓股票数都是0**
- 虽然启用了股票筛选（`enableStockFilter=true`），但筛选后的股票列表没有正确传递给风险平价权重计算
- 当持仓为空时，系统使用了**默认的等权重策略**，导致收益率异常高

### 详细分析

1. **调仓期1（2020-07-10）**：期间收益率 23.61%
2. **调仓期2（2020-12-31）**：期间收益率 22.22%
3. **调仓期3（2021-03-31）**：期间收益率 6.28%
4. **调仓期4（2021-07-01）**：期间收益率 54.59% ⚠️ 异常高！

累计到第21期：238.82%

### 问题定位

检查`services/indexPortfolioService.js`的风险平价权重计算逻辑：

```javascript
// 第1519-1525行
let filteredStocks = stocks;
let removedStocks = [];
if (enableStockFilter && stockFilterParams) {
  const filterResult = await stockFilterService.filterStocks(stocks, stockFilterParams, rebalanceDate);
  filteredStocks = filterResult.filteredStocks;
  removedStocks = filterResult.removedStocks;
}
```

**问题**：筛选后的`filteredStocks`没有被正确使用，后续的权重计算仍然使用了原始的`stocks`列表。

### 修复方案

需要确保筛选后的股票列表被正确传递给权重计算函数。

---

## 问题2: 温度曲线图显示过多圆点

### 问题描述

从用户截图看，温度曲线图上每个数据点都显示了圆点，导致曲线不够柔顺。

### 修复方案

修改前端图表配置，将圆点半径设置为0，但保留鼠标悬停时的交互功能。

**文件**: `public/market-temperature.js`

需要修改Chart.js的配置：

```javascript
{
  type: 'line',
  data: {
    datasets: [{
      label: '市场温度',
      data: temperatureData,
      borderColor: 'rgb(75, 192, 192)',
      backgroundColor: 'rgba(75, 192, 192, 0.1)',
      pointRadius: 0,              // 隐藏所有圆点
      pointHoverRadius: 5,         // 鼠标悬停时显示圆点
      pointHitRadius: 10,          // 增加鼠标感应区域
      tension: 0.4                 // 曲线平滑度
    }]
  },
  options: {
    interaction: {
      mode: 'nearest',
      intersect: false
    },
    plugins: {
      tooltip: {
        enabled: true,
        mode: 'nearest',
        intersect: false
      }
    }
  }
}
```

---

## 修复步骤

### 步骤1: 修复股票筛选后的权重计算

1. 检查`adaptiveRiskParityService.js`中的权重计算逻辑
2. 确保筛选后的股票列表被正确使用
3. 添加日志输出，显示每次调仓的持仓详情

### 步骤2: 修复温度曲线图显示

1. 修改`public/market-temperature.js`
2. 设置`pointRadius: 0`隐藏圆点
3. 设置`pointHoverRadius: 5`保留交互
4. 测试鼠标悬停功能

### 步骤3: 添加调仓详情显示

在前端添加调仓详情表格，显示：
- 调仓日期
- 市场温度
- 调仓逻辑（温度等级、参数调整）
- 持仓股票数
- 期间收益率
- 累计收益率

---

## 预期效果

### 修复后的收益率

根据之前的测试，关闭股票筛选后：
- 累计收益率：68.76%（合理）
- 年化收益率：11.04%
- 夏普比率：0.60

### 修复后的温度曲线

- 平滑的曲线，无圆点
- 鼠标悬停时显示数据点
- 保留完整的交互功能
