# 自适应策略参数配置说明

## 概述

自适应策略通过识别市场状态（5种），动态调整风险平价策略参数，以适应不同市场环境。

**代码位置：**
- 市场状态识别：`services/marketRegimeService.js`
- 参数配置：`services/marketRegimeService.js` 的 `getRegimeParams()` 方法
- 策略集成：`services/indexPortfolioService.js` 第164-196行
- API接口：`routes/data.js` 添加 `useAdaptive` 参数

---

## 市场状态分类（5种）

### 1️⃣ 强势牛市 (AGGRESSIVE_BULL)

**识别条件：**
- 趋势强度 > 5%
- 市场宽度 > 60%
- 动量强度 > 15%
- 波动率 < 60分位数

**市场特征：**
- 指数持续上涨，均线多头排列
- 大部分股票上涨（超过60%）
- 短期动量强劲
- 波动率相对较低

**策略参数配置：**
```javascript
{
  maxWeight: 0.15,              // 单股最大权重15%（高进攻性）
  volatilityWindow: 12,         // 波动率窗口12个月（拉长窗口）
  ewmaDecay: 0.95,              // EWMA衰减系数0.95（更重视近期）
  minROE: 0,                    // ROE要求0%（放宽质量限制）
  maxDebtRatio: 1,              // 负债率上限100%（不限制）
  momentumMonths: 3,            // 动量周期3个月（短周期）
  minMomentumReturn: 0.05,      // 最低动量5%（只选上涨股票）
  filterByQuality: false        // 不启用质量筛选
}
```

**策略逻辑：**
- ✅ 提高单股权重上限，集中优质股票
- ✅ 放宽质量要求，捕捉更多机会
- ✅ 使用短周期动量，快速响应市场
- ✅ 只选择上涨股票，追随趋势

**预期效果：**
- 最大化牛市收益
- 提高组合集中度
- 快速响应市场变化

---

### 2️⃣ 温和牛市 (MODERATE_BULL)

**识别条件：**
- 趋势强度 > 2%
- 市场宽度 > 50%
- 动量强度 > 5%

**市场特征：**
- 指数稳步上涨
- 多数股票上涨（超过50%）
- 动量为正但不强劲

**策略参数配置：**
```javascript
{
  maxWeight: 0.13,              // 单股最大权重13%（中等进攻性）
  volatilityWindow: 6,          // 波动率窗口6个月
  ewmaDecay: 0.91,              // EWMA衰减系数0.91
  minROE: 0,                    // ROE要求0%（放宽）
  maxDebtRatio: 1,              // 负债率上限100%
  momentumMonths: 6,            // 动量周期6个月
  minMomentumReturn: 0,         // 最低动量0%（允许平盘）
  filterByQuality: true         // 启用质量筛选
}
```

**策略逻辑：**
- ✅ 适度提高权重上限
- ✅ 放宽ROE要求，但保留质量筛选
- ✅ 允许平盘股票，不过度激进
- ✅ 平衡进攻性和风险控制

**预期效果：**
- 稳健捕捉牛市收益
- 保持适度分散
- 控制下行风险

---

### 3️⃣ 震荡市场 (SIDEWAYS)

**识别条件：**
- -2% ≤ 趋势强度 ≤ 2%
- 40% < 市场宽度 ≤ 60%
- 波动率正常

**市场特征：**
- 指数无明确方向
- 涨跌股票数量相当
- 波动率处于历史中位数

**策略参数配置：**（默认参数）
```javascript
{
  maxWeight: 0.10,              // 单股最大权重10%（平衡）
  volatilityWindow: 6,          // 波动率窗口6个月
  ewmaDecay: 0.88,              // EWMA衰减系数0.88
  minROE: 0.08,                 // ROE要求8%（中等质量）
  maxDebtRatio: 1,              // 负债率上限100%
  momentumMonths: 6,            // 动量周期6个月
  minMomentumReturn: -0.05,     // 最低动量-5%（允许小幅下跌）
  filterByQuality: true         // 启用质量筛选
}
```

**策略逻辑：**
- ✅ 平衡进攻性和防守性
- ✅ 中等质量要求（ROE 8%）
- ✅ 允许小幅下跌的股票
- ✅ 保持适度分散

**预期效果：**
- 平衡收益和风险
- 适应震荡环境
- 控制回撤

---

### 4️⃣ 弱势市场 (WEAK_BEAR)

**识别条件：**
- 趋势强度 < -2%
- 市场宽度 < 40%

**市场特征：**
- 指数下跌趋势
- 多数股票下跌（超过60%）
- 市场情绪偏弱

**策略参数配置：**
```javascript
{
  maxWeight: 0.08,              // 单股最大权重8%（防守）
  volatilityWindow: 3,          // 波动率窗口3个月（短窗口）
  ewmaDecay: 0.85,              // EWMA衰减系数0.85
  minROE: 0.10,                 // ROE要求10%（提高质量）
  maxDebtRatio: 0.60,           // 负债率上限60%（限制高杠杆）
  momentumMonths: 12,           // 动量周期12个月（长周期）
  minMomentumReturn: -0.10,     // 最低动量-10%
  filterByQuality: true         // 启用质量筛选
}
```

**策略逻辑：**
- ✅ 降低单股权重，提高分散度
- ✅ 提高质量要求（ROE 10%）
- ✅ 限制高负债率股票
- ✅ 使用长周期动量，避免追跌

**预期效果：**
- 防守为主，控制回撤
- 选择高质量股票
- 降低组合波动

---

### 5️⃣ 恐慌市场 (PANIC)

**识别条件：**
- 趋势强度 < -5%
- 波动率 > 80分位数
- 市场宽度 < 30%
- 动量强度 < -10%

**市场特征：**
- 指数大幅下跌
- 波动率极高
- 绝大多数股票下跌
- 市场恐慌情绪

**策略参数配置：**
```javascript
{
  maxWeight: 0.06,              // 单股最大权重6%（极度分散）
  volatilityWindow: 3,          // 波动率窗口3个月
  ewmaDecay: 0.80,              // EWMA衰减系数0.80
  minROE: 0.12,                 // ROE要求12%（最高质量）
  maxDebtRatio: 0.40,           // 负债率上限40%（严格限制）
  momentumMonths: 12,           // 动量周期12个月
  minMomentumReturn: -0.15,     // 最低动量-15%
  filterByQuality: true         // 启用质量筛选
}
```

**策略逻辑：**
- ✅ 极度分散，降低单股风险
- ✅ 最高质量要求（ROE 12%）
- ✅ 严格限制高负债率股票
- ✅ 降低调仓频率，减少交易

**预期效果：**
- 极度防守，保护资本
- 只持有最优质股票
- 最小化回撤

---

## 参数调整位置

### 1. 修改市场状态识别阈值

**文件：** `services/marketRegimeService.js`

**方法：** `classifyRegime(trend, breadth, volatility, momentum)`

**位置：** 第199-222行

```javascript
classifyRegime(trend, breadth, volatility, momentum) {
  // 强势牛市：趋势强+宽度高+动量强+波动低
  if (trend > 0.05 && breadth > 0.60 && momentum > 0.15 && volatility < 0.60) {
    return 'AGGRESSIVE_BULL';
  }
  
  // 温和牛市：趋势正+宽度中等+动量正
  if (trend > 0.02 && breadth > 0.50 && momentum > 0.05) {
    return 'MODERATE_BULL';
  }
  
  // 恐慌市场：趋势负+波动极高+宽度低+动量负
  if (trend < -0.05 && volatility > 0.80 && breadth < 0.30 && momentum < -0.10) {
    return 'PANIC';
  }
  
  // 弱势市场：趋势负+宽度低
  if (trend < -0.02 && breadth < 0.40) {
    return 'WEAK_BEAR';
  }
  
  // 震荡市场：其他情况
  return 'SIDEWAYS';
}
```

**可调整参数：**
- `trend` 阈值：调整趋势判断的敏感度
- `breadth` 阈值：调整市场宽度的要求
- `volatility` 阈值：调整波动率的判断标准
- `momentum` 阈值：调整动量的要求

### 2. 修改策略参数配置

**文件：** `services/marketRegimeService.js`

**方法：** `getRegimeParams(regime)`

**位置：** 第227-290行

```javascript
getRegimeParams(regime) {
  const paramsMap = {
    AGGRESSIVE_BULL: {
      maxWeight: 0.15,          // 👈 在这里修改强势牛市参数
      volatilityWindow: 12,
      ewmaDecay: 0.95,
      // ... 其他参数
    },
    
    MODERATE_BULL: {
      maxWeight: 0.13,          // 👈 在这里修改温和牛市参数
      // ...
    },
    
    SIDEWAYS: {
      maxWeight: 0.10,          // 👈 在这里修改震荡市场参数
      // ...
    },
    
    WEAK_BEAR: {
      maxWeight: 0.08,          // 👈 在这里修改弱势市场参数
      // ...
    },
    
    PANIC: {
      maxWeight: 0.06,          // 👈 在这里修改恐慌市场参数
      // ...
    }
  };
  
  return paramsMap[regime] || paramsMap.SIDEWAYS;
}
```

### 3. 启用自适应策略

**API调用：**
```javascript
// 在API请求中添加 useAdaptive=true 参数
const params = {
  startDate: '20200710',
  endDate: '20250710',
  strategyType: 'riskParity',
  useAdaptive: 'true',  // 👈 启用自适应策略
  // ... 其他参数
};
```

**前端调用示例：**
```javascript
fetch('/api/index-returns?useAdaptive=true&strategyType=riskParity&...')
```

---

## 参数优化建议

### 优化流程

1. **单状态优化**
   - 识别历史上某个时期的主要市场状态
   - 针对该状态单独测试不同参数组合
   - 选择夏普比率最高的参数

2. **全周期验证**
   - 使用优化后的参数运行完整回测
   - 对比固定策略和自适应策略
   - 确保整体表现提升

3. **稳健性测试**
   - 测试不同时间段
   - 测试不同调仓频率
   - 确保参数不过度拟合

### 关键参数说明

| 参数 | 说明 | 调整建议 |
|------|------|----------|
| `maxWeight` | 单股最大权重 | 牛市↑ 熊市↓ |
| `minROE` | 最低ROE要求 | 牛市↓ 熊市↑ |
| `maxDebtRatio` | 最高负债率 | 牛市放宽 熊市收紧 |
| `momentumMonths` | 动量周期 | 牛市短 熊市长 |
| `minMomentumReturn` | 最低动量 | 牛市↑ 熊市↓ |
| `volatilityWindow` | 波动率窗口 | 牛市长 熊市短 |
| `ewmaDecay` | EWMA衰减 | 牛市↑ 熊市↓ |

---

## 使用示例

### 命令行测试

```bash
# 启动服务器
npm start

# 运行自适应策略测试
node test-adaptive-strategy.js
```

### API调用示例

```bash
# 固定策略
curl "http://localhost:3001/api/index-returns?startDate=20200710&endDate=20250710&strategyType=riskParity&useAdaptive=false&..."

# 自适应策略
curl "http://localhost:3001/api/index-returns?startDate=20200710&endDate=20250710&strategyType=riskParity&useAdaptive=true&..."
```

---

## 预期效果

### 整体表现

| 指标 | 固定策略 | 自适应策略 | 改进 |
|------|----------|------------|------|
| 累计收益 | 136.54% | 预计145-150% | +8-13% |
| 夏普比率 | 1.05 | 预计1.15-1.25 | +0.10-0.20 |
| 最大回撤 | 12.08% | 预计10-12% | -0-2% |

### 分阶段表现

**2020-2021（牛市初期）：**
- 固定策略：13%
- 自适应策略：预计18-22%
- 改进：+5-9%

**2022-2023（震荡调整）：**
- 固定策略：34%
- 自适应策略：预计32-36%
- 改进：-2% ~ +2%

**2024-2025（强势反弹）：**
- 固定策略：42%
- 自适应策略：预计45-50%
- 改进：+3-8%

---

## 注意事项

1. **避免过度拟合**
   - 使用简单的市场指标
   - 参数阈值设置保守
   - 充分的样本外测试

2. **市场状态切换**
   - 状态切换时可能产生参数跳变
   - 建议添加平滑过渡机制
   - 或使用置信度加权

3. **数据质量**
   - 确保指数数据完整
   - 成分股数据充足
   - API调用稳定

4. **性能监控**
   - 定期检查市场状态识别准确性
   - 监控各状态下的策略表现
   - 及时调整参数

---

## 后续优化方向

1. **参数自动优化**
   - 使用网格搜索或贝叶斯优化
   - 针对每种市场状态优化参数
   - 定期重新优化

2. **置信度机制**
   - 根据识别置信度调整参数
   - 低置信度时使用混合参数
   - 避免频繁切换

3. **更多市场指标**
   - 加入成交量指标
   - 加入行业轮动指标
   - 加入宏观经济指标

4. **机器学习**
   - 使用ML模型预测市场状态
   - 自动学习最优参数
   - 持续优化策略

---

**文档版本：** v1.0  
**最后更新：** 2025-12-25  
**维护者：** Cascade AI
