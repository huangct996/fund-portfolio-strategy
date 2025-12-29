# 自适应策略配置逻辑和回测流程

## 一、配置来源（混合模式）

### 1. 代码硬编码配置（自适应策略核心）

**位置：** `services/marketRegimeService.js` 的 `getRegimeParams()` 方法

**配置内容：** 根据市场状态动态设置参数

```javascript
// 强势牛市（市场宽度>52%）
AGGRESSIVE_BULL: {
  maxWeight: 0.20,
  filterByQuality: false,    // 代码设置：禁用质量筛选
  hybridRatio: 0.2,
  enableStockFilter: true
}

// 温和牛市（市场宽度42-52%）
MODERATE_BULL: {
  maxWeight: 0.18,
  filterByQuality: false,    // 代码设置：禁用质量筛选
  hybridRatio: 0.15,
  enableStockFilter: true
}

// 震荡市场（市场宽度32-42%）
SIDEWAYS: {
  maxWeight: 0.15,
  filterByQuality: true,     // 代码设置：启用质量筛选
  hybridRatio: 0.1,
  enableStockFilter: true
}

// 弱势市场（市场宽度<32%）
WEAK_BEAR: {
  maxWeight: 0.13,
  filterByQuality: true,     // 代码设置：启用质量筛选
  hybridRatio: 0,
  enableStockFilter: true
}

// 恐慌市场
PANIC: {
  maxWeight: 0.10,
  filterByQuality: true,     // 代码设置：启用质量筛选
  hybridRatio: 0,
  enableStockFilter: true
}
```

### 2. 页面用户配置

**位置：** `public/index.html` 和 `public/app.js`

**配置内容：** 用户可以在前端页面设置的参数

- `volatilityWindow`：波动率窗口（默认6个月）
- `ewmaDecay`：EWMA衰减系数（默认0.91）
- `enableStockFilter`：是否启用股票筛选
- `minROE`：最低ROE要求
- `maxDebtRatio`：最大负债率
- `momentumMonths`：动量计算周期
- `minMomentumReturn`：最低动量收益率
- `filterByQuality`：是否启用质量筛选（**关键参数**）

### 3. 参数合并逻辑

**位置：** `services/indexPortfolioService.js` 第520-528行

```javascript
// 如果启用自适应策略，需要合并stockFilterParams
let finalStockFilterParams = riskParityParams.stockFilterParams || null;
if (config.useAdaptive && riskParityParams.filterByQuality !== undefined) {
  // 自适应策略的filterByQuality参数优先级更高
  finalStockFilterParams = {
    ...(riskParityParams.stockFilterParams || {}),
    filterByQuality: riskParityParams.filterByQuality  // 代码设置覆盖页面设置
  };
}
```

**优先级规则：**
1. 如果启用自适应策略（`useAdaptive=true`）
2. 自适应策略的`filterByQuality`参数会**覆盖**用户在页面设置的值
3. 其他参数（minROE、maxDebtRatio等）仍从页面读取

## 二、完整回测流程

### 1. 初始化阶段

```
用户在页面设置参数
    ↓
前端发送请求到 /api/index-returns
    ↓
后端接收参数：
  - startDate, endDate（回测时间范围）
  - strategyType（策略类型，如riskParity）
  - useAdaptive（是否启用自适应策略）
  - enableStockFilter（是否启用股票筛选）
  - filterByQuality（用户设置的质量筛选开关）
  - 其他参数...
```

### 2. 回测循环（每个调仓期）

```
for (每个调仓期 rebalanceDate) {
  
  1. 获取成分股数据
     ↓
  2. 【自适应策略】识别市场状态
     调用 marketRegimeService.identifyMarketRegime()
     ├─ 计算市场宽度（marketBreadth）
     ├─ 计算趋势强度（trendStrength）
     ├─ 计算波动率（volatilityLevel）
     └─ 根据指标分类市场状态：
        AGGRESSIVE_BULL / MODERATE_BULL / SIDEWAYS / WEAK_BEAR / PANIC
     ↓
  3. 【自适应策略】获取状态对应的参数
     调用 getRegimeParams(marketState)
     返回该状态的配置：
     - maxWeight
     - filterByQuality（代码硬编码）
     - hybridRatio
     - enableStockFilter
     - 等等...
     ↓
  4. 合并参数
     effectiveRiskParityParams = {
       ...用户页面设置的参数,
       ...自适应策略返回的参数  // 自适应参数优先级更高
     }
     ↓
  5. 【关键】处理filterByQuality参数
     if (useAdaptive && 自适应策略有filterByQuality) {
       使用自适应策略的filterByQuality  // 覆盖用户设置
     } else {
       使用用户页面设置的filterByQuality
     }
     ↓
  6. 股票筛选（如果enableStockFilter=true）
     调用 stockFilterService.filterStocks()
     根据以下条件筛选：
     - minROE（最低ROE）
     - maxDebtRatio（最大负债率）
     - momentumMonths（动量周期）
     - minMomentumReturn（最低动量收益）
     - filterByQuality（质量筛选开关）
       ├─ true：筛选掉ROE<minROE或负债率>maxDebtRatio的股票
       └─ false：只筛选动量，不筛选质量指标
     ↓
  7. 计算风险平价权重
     调用 calculateRiskParityWeights()
     - 计算每只股票的波动率
     - 根据波动率倒数分配权重
     - 应用maxWeight限制
     - 应用hybridRatio（市值加权混合）
     ↓
  8. 计算该调仓期的收益
     - 持有到下一个调仓期
     - 计算期间收益率
     ↓
  9. 记录调仓信息
     - 市场状态
     - 应用的参数
     - 筛选掉的股票
     - 权重分配
}
```

### 3. 结果汇总

```
计算整个回测期间的：
  - 累计收益率
  - 年化收益率
  - 波动率
  - 夏普比率
  - 最大回撤
  - 索提诺比率
```

## 三、当前配置状态

### 实际生效的配置

**牛市期间（AGGRESSIVE_BULL、MODERATE_BULL）：**
- `filterByQuality = false`（代码硬编码，覆盖页面设置）
- `enableStockFilter = true`（启用筛选）
- 只筛选动量，不筛选质量指标
- 保留更多股票，捕捉牛市收益

**熊市/震荡期间（SIDEWAYS、WEAK_BEAR、PANIC）：**
- `filterByQuality = true`（代码硬编码，覆盖页面设置）
- `enableStockFilter = true`（启用筛选）
- 同时筛选动量和质量指标
- 过滤掉低质量股票，防守为主

### 用户页面设置的作用

**仍然生效的参数：**
- `volatilityWindow`：波动率计算窗口
- `ewmaDecay`：EWMA衰减系数
- `minROE`：质量筛选的ROE阈值（当filterByQuality=true时生效）
- `maxDebtRatio`：质量筛选的负债率阈值（当filterByQuality=true时生效）
- `momentumMonths`：动量计算周期
- `minMomentumReturn`：动量筛选阈值

**被覆盖的参数：**
- `filterByQuality`：在启用自适应策略时，由代码根据市场状态动态设置

## 四、测试验证结果

### 当前配置表现（filterByQuality由代码动态控制）

```
2020年下半年：-3.09%（改善+8.79%）
2021年：-3.03%（改善+2.68%）
2022年：+2.33% ✅
2023年：+6.01% ✅
2024年：+5.59% ✅
全周期：+5.98%（年化14.51%，夏普0.82）✅
```

### 关键发现

1. **牛市禁用质量筛选**能显著改善前期表现
2. **熊市启用质量筛选**能提供更好的防守
3. **动态调整策略**是最优方案

## 五、建议使用方式

### 页面配置建议

```
✅ 启用自适应策略（useAdaptive=true）
✅ 启用股票筛选（enableStockFilter=true）
✅ filterByQuality=false（会被自适应策略覆盖，但建议设为false）
✅ minROE=0（不过度限制）
✅ maxDebtRatio=1（不过度限制）
✅ momentumMonths=6
✅ minMomentumReturn=-0.1
✅ 季度调仓
```

### 预期效果

- 全周期跑赢指数约+6%
- 年化收益14.5%
- 夏普比率0.82
- 自动根据市场状态调整筛选策略
