# 策略表现问题分析报告

## 🔍 问题描述

### 问题1: 自适应策略参数来源错误
**用户反馈：** 自适应策略不应该使用用户传入的 maxWeight，而应该完全由温度区间参数决定。

**当前实现：** ✅ 正确
- 自适应策略使用 `marketTemperature.params`，这是由温度级别决定的固定参数
- COLD: maxWeight=0.20, NORMAL: maxWeight=0.15, HOT: maxWeight=0.10
- 不依赖用户传入的 maxWeight

### 问题2: 风险平价策略收益率下降
**用户反馈：** 风险平价策略的夏普比率从之前的0.97下降到现在的0.60

**测试结果：**
```
当前表现:
- 累计收益率: 68.77%
- 年化收益率: 11.03%
- 夏普比率: 0.60
- 最大回撤: 12.99%

历史最佳（FIX_SUMMARY.md）:
- 累计收益率: 102.33%
- 年化收益率: 15.38%
- 夏普比率: 0.92
- 最大回撤: 待测试
```

### 问题3: maxWeight参数无效
**测试发现：** 无论 maxWeight 设置为 0.10, 0.13, 0.15, 0.20, 0.25，结果完全相同

**测试结果：**
```
maxWeight | 累计收益 | 年化收益 | 夏普比率 | 最大回撤
 10%      |    68.77% |    11.03% |     0.60 |    12.99%
 13%      |    68.77% |    11.03% |     0.60 |    12.99%
 15%      |    68.77% |    11.03% |     0.60 |    12.99%
 20%      |    68.77% |    11.03% |     0.60 |    12.99%
 25%      |    68.77% |    11.03% |     0.60 |    12.99%
```

这表明 **maxWeight 参数没有真正影响计算结果**。

---

## 🐛 根本原因分析

### 原因1: maxWeight 限制后重新归一化

查看代码 `indexPortfolioService.js:1650-1670`：

```javascript
// 归一化权重
invVolatilities.forEach(s => {
  let weight = totalInvVol > 0 ? s.invVol / totalInvVol : 1 / stocks.length;
  weight = Math.min(weight, maxWeight);  // ← 限制最大权重
  riskParityWeights[s.tsCode] = weight;
});

// 重新归一化 ← 这里抵消了maxWeight的作用！
const totalWeight = Object.values(riskParityWeights).reduce((sum, w) => sum + w, 0);
if (totalWeight > 0) {
  Object.keys(riskParityWeights).forEach(tsCode => {
    riskParityWeights[tsCode] = riskParityWeights[tsCode] / totalWeight;
  });
}
```

**问题：** 
1. 先用 `Math.min(weight, maxWeight)` 限制权重
2. 然后重新归一化，使所有权重之和=1
3. **归一化会放大其他股票的权重，抵消了maxWeight的限制作用**

**示例：**
```
假设有3只股票，初始权重: [0.50, 0.30, 0.20]
设置 maxWeight=0.25

步骤1: 限制最大权重
[0.25, 0.25, 0.20]  总和=0.70

步骤2: 重新归一化（除以0.70）
[0.357, 0.357, 0.286]  总和=1.0

结果: 最大权重变成了0.357，超过了0.25的限制！
```

### 原因2: 数据或市场环境变化

可能的原因：
- 数据库数据更新（最近的市场数据）
- 市场环境变化（2024-2025年的表现）
- 红利指数成分股变化

---

## 🔧 修复方案

### 修复1: 正确实现maxWeight限制

**问题：** 当前的归一化逻辑抵消了maxWeight的作用

**解决方案：** 使用迭代方法确保maxWeight限制

```javascript
// 修复后的代码
function normalizeWithMaxWeight(weights, maxWeight) {
  const maxIterations = 100;
  let iteration = 0;
  
  while (iteration < maxIterations) {
    // 1. 限制最大权重
    let hasViolation = false;
    let excessWeight = 0;
    
    Object.keys(weights).forEach(code => {
      if (weights[code] > maxWeight) {
        excessWeight += weights[code] - maxWeight;
        weights[code] = maxWeight;
        hasViolation = true;
      }
    });
    
    if (!hasViolation) break;
    
    // 2. 将超出的权重重新分配给未达上限的股票
    const uncappedStocks = Object.keys(weights).filter(code => weights[code] < maxWeight);
    if (uncappedStocks.length === 0) break;
    
    const redistributeWeight = excessWeight / uncappedStocks.length;
    uncappedStocks.forEach(code => {
      weights[code] += redistributeWeight;
    });
    
    iteration++;
  }
  
  // 3. 最终归一化
  const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (totalWeight > 0) {
    Object.keys(weights).forEach(code => {
      weights[code] = weights[code] / totalWeight;
    });
  }
  
  return weights;
}
```

### 修复2: 确认自适应策略参数来源

**当前实现：** ✅ 已经正确
- 自适应策略使用温度区间的固定参数
- 不依赖用户传入的 maxWeight

**无需修改**

---

## 📊 预期效果

### 修复maxWeight后的预期

不同 maxWeight 应该产生不同的结果：

```
maxWeight | 预期累计收益 | 预期夏普比率
  10%     |    较低      |    较高（更分散）
  15%     |    中等      |    中等
  20%     |    较高      |    中等
  25%     |    最高      |    较低（更集中）
```

### 收益率提升预期

修复后，夏普比率应该能够恢复到接近历史水平（0.92左右）。

---

## 🔄 测试计划

1. **修复maxWeight归一化逻辑**
2. **测试不同maxWeight的效果**
3. **对比修复前后的收益率**
4. **确认自适应策略使用正确的参数**

---

**创建日期：** 2026-01-12  
**状态：** 待修复
