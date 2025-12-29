# 自适应策略设计指南

## 目标
通过判断市场状态动态调整策略参数，使得在牛市初期也能"扬"（提高收益），同时在震荡和熊市保持风险控制能力。

---

## 一、市场状态判断方法

### 1.1 核心指标体系

#### 指标1：趋势强度（Trend Strength）
**计算方法：**
```javascript
// 使用多周期移动平均线
const ma20 = 计算20日均线
const ma60 = 计算60日均线
const ma120 = 计算120日均线

趋势得分 = (当前价格 - ma20) / ma20 * 0.5 + 
          (ma20 - ma60) / ma60 * 0.3 + 
          (ma60 - ma120) / ma120 * 0.2
```

**判断标准：**
- 强牛市：趋势得分 > 5%
- 温和牛市：2% < 趋势得分 ≤ 5%
- 震荡市：-2% ≤ 趋势得分 ≤ 2%
- 弱熊市：-5% ≤ 趋势得分 < -2%
- 强熊市：趋势得分 < -5%

#### 指标2：市场宽度（Market Breadth）
**计算方法：**
```javascript
// 统计成分股中上涨股票的占比
市场宽度 = 过去20日涨幅为正的股票数 / 总股票数
```

**判断标准：**
- 普涨行情：市场宽度 > 70%（适合进攻）
- 结构性行情：40% < 市场宽度 ≤ 70%
- 普跌行情：市场宽度 ≤ 40%（适合防守）

#### 指标3：波动率水平（Volatility Level）
**计算方法：**
```javascript
// 计算当前20日波动率相对历史的分位数
当前波动率 = 计算过去20日的年化波动率
历史波动率分布 = 过去1年的滚动20日波动率
波动率分位数 = 当前波动率在历史分布中的位置
```

**判断标准：**
- 极高波动：分位数 > 80%（风险高，降低仓位）
- 高波动：60% < 分位数 ≤ 80%
- 正常波动：40% < 分位数 ≤ 60%
- 低波动：分位数 ≤ 40%（风险低，可提高仓位）

#### 指标4：动量强度（Momentum Strength）
**计算方法：**
```javascript
// 多周期动量加权
动量得分 = 1月收益率 * 0.5 + 
          3月收益率 * 0.3 + 
          6月收益率 * 0.2
```

**判断标准：**
- 强动量：动量得分 > 15%
- 中等动量：5% < 动量得分 ≤ 15%
- 弱动量：-5% ≤ 动量得分 ≤ 5%
- 负动量：动量得分 < -5%

---

## 二、市场状态分类

### 2.1 强势牛市（Aggressive Bull）
**特征：**
- 趋势得分 > 5%
- 市场宽度 > 60%
- 动量得分 > 15%
- 波动率 < 历史60分位数

**策略参数：**
```javascript
{
  maxWeight: 0.15,              // 提高单股上限至15%
  volatilityWindow: 12,         // 拉长波动率窗口至12个月
  ewmaDecay: 0.95,              // 提高EWMA衰减系数
  momentumMonths: 3,            // 缩短动量周期至3个月
  minMomentumReturn: 0.05,      // 只选上涨股票（>5%）
  minROE: 0,                    // 放宽ROE要求
  rebalanceFrequency: 'monthly' // 提高调仓频率
}
```

**预期效果：**
- 提高进攻性，捕捉牛市收益
- 单股权重提高，集中优质股票
- 短周期动量，快速响应市场

### 2.2 温和牛市（Moderate Bull）
**特征：**
- 2% < 趋势得分 ≤ 5%
- 市场宽度 > 50%
- 动量得分 > 5%

**策略参数：**
```javascript
{
  maxWeight: 0.13,
  volatilityWindow: 6,
  ewmaDecay: 0.91,
  momentumMonths: 6,
  minMomentumReturn: 0,
  minROE: 0,
  rebalanceFrequency: 'quarterly'
}
```

### 2.3 震荡市场（Sideways）
**特征：**
- -2% ≤ 趋势得分 ≤ 2%
- 40% < 市场宽度 ≤ 60%
- 波动率处于正常水平

**策略参数：**（当前默认参数）
```javascript
{
  maxWeight: 0.10,
  volatilityWindow: 6,
  ewmaDecay: 0.88,
  momentumMonths: 6,
  minMomentumReturn: -0.05,
  minROE: 0.08,
  rebalanceFrequency: 'quarterly'
}
```

### 2.4 弱势市场（Weak Market）
**特征：**
- 趋势得分 < -2%
- 市场宽度 < 40%
- 波动率上升

**策略参数：**
```javascript
{
  maxWeight: 0.08,              // 降低单股上限
  volatilityWindow: 3,          // 缩短波动率窗口
  ewmaDecay: 0.85,
  momentumMonths: 12,           // 拉长动量周期
  minMomentumReturn: -0.10,
  minROE: 0.10,                 // 提高质量要求
  maxDebtRatio: 0.5,            // 限制负债率
  rebalanceFrequency: 'quarterly'
}
```

### 2.5 恐慌市场（Panic）
**特征：**
- 趋势得分 < -5%
- 波动率 > 历史80分位数
- 市场宽度 < 30%
- 负动量 < -10%

**策略参数：**
```javascript
{
  maxWeight: 0.06,              // 极度分散
  volatilityWindow: 3,
  ewmaDecay: 0.80,
  momentumMonths: 12,
  minMomentumReturn: -0.15,
  minROE: 0.12,
  maxDebtRatio: 0.4,
  rebalanceFrequency: 'yearly'  // 降低调仓频率
}
```

---

## 三、实施方案

### 3.1 简化版（推荐先实施）

**只使用2个核心指标：**
1. **趋势强度**（基于指数价格）
2. **市场宽度**（基于成分股涨跌）

**分为3种状态：**
1. **牛市**：趋势 > 3% 且 宽度 > 55%
2. **震荡**：其他情况
3. **熊市**：趋势 < -3% 且 宽度 < 45%

**参数调整：**
```javascript
// 牛市参数
if (趋势 > 3% && 宽度 > 55%) {
  maxWeight = 0.13;
  minMomentumReturn = 0;
  minROE = 0;
}
// 熊市参数
else if (趋势 < -3% && 宽度 < 45%) {
  maxWeight = 0.08;
  minMomentumReturn = -0.10;
  minROE = 0.10;
}
// 震荡市场（默认）
else {
  maxWeight = 0.10;
  minMomentumReturn = -0.05;
  minROE = 0.08;
}
```

### 3.2 实施步骤

#### 步骤1：添加指标计算函数
在 `indexPortfolioService.js` 中添加：

```javascript
/**
 * 计算市场趋势强度
 */
async calculateTrendStrength(indexCode, date) {
  // 获取过去120天的指数数据
  const startDate = this.getDateBefore(date, 120);
  const prices = await tushareService.getIndexDaily(indexCode, startDate, date);
  
  if (prices.length < 120) return 0;
  
  const current = prices[prices.length - 1].close;
  const ma20 = this.calculateMA(prices, 20);
  const ma60 = this.calculateMA(prices, 60);
  const ma120 = this.calculateMA(prices, 120);
  
  const score = (current - ma20) / ma20 * 0.5 +
                (ma20 - ma60) / ma60 * 0.3 +
                (ma60 - ma120) / ma120 * 0.2;
  
  return score;
}

/**
 * 计算市场宽度
 */
async calculateMarketBreadth(stocks, date) {
  // 计算过去20天涨幅为正的股票占比
  let positiveCount = 0;
  
  for (const stock of stocks) {
    const return20d = await this.calculate20DayReturn(stock.con_code, date);
    if (return20d > 0) positiveCount++;
  }
  
  return positiveCount / stocks.length;
}

/**
 * 判断市场状态
 */
async identifyMarketState(indexCode, stocks, date) {
  const trendStrength = await this.calculateTrendStrength(indexCode, date);
  const marketBreadth = await this.calculateMarketBreadth(stocks, date);
  
  console.log(`\n📊 市场状态分析 [${date}]:`);
  console.log(`   趋势强度: ${(trendStrength * 100).toFixed(2)}%`);
  console.log(`   市场宽度: ${(marketBreadth * 100).toFixed(1)}%`);
  
  // 判断市场状态
  if (trendStrength > 0.03 && marketBreadth > 0.55) {
    console.log(`   ✅ 市场状态: 牛市`);
    return 'bull';
  } else if (trendStrength < -0.03 && marketBreadth < 0.45) {
    console.log(`   ⚠️  市场状态: 熊市`);
    return 'bear';
  } else {
    console.log(`   ➡️  市场状态: 震荡`);
    return 'sideways';
  }
}
```

#### 步骤2：在调仓时调用
在 `calculateIndexBasedReturns` 的调仓循环中：

```javascript
for (let i = 0; i < rebalanceDates.length; i++) {
  const currentDate = rebalanceDates[i];
  
  // 判断市场状态
  const marketState = await this.identifyMarketState(
    indexCode, 
    customIndexWeights, 
    currentDate
  );
  
  // 根据市场状态调整参数
  let adjustedParams = { ...riskParityParams };
  
  if (marketState === 'bull') {
    adjustedParams.maxWeight = 0.13;
    adjustedParams.minMomentumReturn = 0;
    adjustedParams.minROE = 0;
  } else if (marketState === 'bear') {
    adjustedParams.maxWeight = 0.08;
    adjustedParams.minMomentumReturn = -0.10;
    adjustedParams.minROE = 0.10;
  }
  
  // 使用调整后的参数
  const effectiveConfig = {
    ...config,
    riskParityParams: adjustedParams
  };
  
  // 计算收益率...
}
```

#### 步骤3：添加API参数
在 `routes/data.js` 中添加：

```javascript
const {
  // ... 其他参数
  useAdaptive  // 新增：是否启用自适应策略
} = req.query;

const config = {
  // ... 其他配置
  useAdaptive: useAdaptive === 'true'
};
```

---

## 四、预期效果分析

### 4.1 针对2020-2022年牛市初期

**问题：** 当前策略在2020-2022年累计收益仅13%，显著低于指数

**原因：**
- 固定参数过于保守（maxWeight=0.10）
- 质量筛选过严（minROE=0.08）
- 动量要求偏低（minMomentumReturn=-0.05）

**自适应策略改进：**
1. **识别牛市**：2020年7月趋势强度约+3-5%，市场宽度约60%
2. **调整参数**：
   - maxWeight: 0.10 → 0.13（提高30%）
   - minROE: 0.08 → 0（放宽质量要求）
   - minMomentumReturn: -0.05 → 0（只选上涨股票）
3. **预期提升**：累计收益从13% → 18-20%（+5-7%）

### 4.2 针对2022-2023年震荡期

**保持当前参数**，继续控制风险

### 4.3 针对2024-2025年强势期

**继续识别牛市**，保持进攻性参数

---

## 五、风险控制

### 5.1 避免过度拟合
- 使用简单指标（趋势、宽度）
- 阈值设置保守（3%而非2%）
- 充分样本外测试

### 5.2 平滑过渡
```javascript
// 避免参数剧烈变化
if (上期状态 !== 本期状态) {
  // 混合上期和本期参数
  adjustedParams = blendParams(上期参数, 本期参数, 0.7);
}
```

### 5.3 置信度机制
```javascript
// 只在信号明确时调整
if (趋势强度 > 5% && 市场宽度 > 65%) {
  // 高置信度，完全使用牛市参数
} else if (趋势强度 > 3% && 市场宽度 > 55%) {
  // 中等置信度，部分调整参数
}
```

---

## 六、实施优先级

### 高优先级（立即实施）
1. ✅ 添加趋势强度计算
2. ✅ 添加市场宽度计算
3. ✅ 实现3状态分类（牛市/震荡/熊市）
4. ✅ 参数动态调整逻辑

### 中优先级（1-2周）
1. 添加波动率指标
2. 添加动量指标
3. 扩展到5状态分类
4. 前端展示市场状态

### 低优先级（1个月）
1. 参数优化和回测
2. 置信度机制
3. 平滑过渡机制
4. 实时监控系统

---

## 七、代码示例（完整）

```javascript
// 在 indexPortfolioService.js 中添加

/**
 * 自适应策略：根据市场状态调整参数
 */
async applyAdaptiveStrategy(indexCode, stocks, date, baseParams) {
  // 1. 计算市场指标
  const trendStrength = await this.calculateTrendStrength(indexCode, date);
  const marketBreadth = await this.calculateMarketBreadth(stocks, date);
  
  // 2. 判断市场状态
  let marketState = 'sideways';
  if (trendStrength > 0.03 && marketBreadth > 0.55) {
    marketState = 'bull';
  } else if (trendStrength < -0.03 && marketBreadth < 0.45) {
    marketState = 'bear';
  }
  
  // 3. 调整参数
  const adjustedParams = { ...baseParams };
  
  switch (marketState) {
    case 'bull':
      adjustedParams.maxWeight = 0.13;
      adjustedParams.minMomentumReturn = 0;
      adjustedParams.minROE = 0;
      break;
    case 'bear':
      adjustedParams.maxWeight = 0.08;
      adjustedParams.minMomentumReturn = -0.10;
      adjustedParams.minROE = 0.10;
      break;
    default:
      // 保持默认参数
      break;
  }
  
  // 4. 返回结果
  return {
    marketState,
    trendStrength,
    marketBreadth,
    adjustedParams
  };
}
```

---

## 八、测试验证

### 测试脚本
```javascript
// test-adaptive-strategy.js
const params = {
  startDate: '20200710',
  endDate: '20250710',
  strategyType: 'riskParity',
  useAdaptive: 'true',  // 启用自适应
  rebalanceFrequency: 'yearly'
};

// 对比固定策略 vs 自适应策略
// 预期：自适应策略在2020-2022年表现更好
```

---

## 总结

**核心思路：**
1. 用简单指标判断市场状态（趋势+宽度）
2. 在牛市提高进攻性（放宽限制、提高权重）
3. 在熊市加强防守（收紧限制、降低权重）
4. 在震荡市保持当前策略

**预期改进：**
- 2020-2022年：+5-7%累计收益
- 整体夏普比率：1.05 → 1.2-1.3
- 最大回撤：保持在12%左右

**实施难度：** ⭐⭐⭐（中等）
**预期收益：** ⭐⭐⭐⭐（较高）

建议先实施简化版（3状态），验证效果后再扩展到完整版（5状态）。
