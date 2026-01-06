# 策略分离修改总结

## 修改概述

根据用户需求，将原有的风险平价策略分离为两个独立的策略选项：

1. **风险平价策略** - 还原到v8.0.0版本的功能（不带市场温度调整）
2. **自适应策略** ⭐ - 当前的根据市场温度动态调整参数的策略

---

## 前端修改

### 1. 策略选项修改 (`public/index.html`)

**修改位置**：第75-95行

**修改内容**：
```html
<div class="config-section">
    <h3>策略类型</h3>
    <div class="strategy-selector">
        <label>
            <input type="radio" name="strategy" value="marketValue">
            市值加权策略
        </label>
        <label>
            <input type="radio" name="strategy" value="composite">
            综合得分策略
        </label>
        <label>
            <input type="radio" name="strategy" value="riskParity">
            风险平价策略
        </label>
        <label>
            <input type="radio" name="strategy" value="adaptive" checked>
            自适应策略 ⭐
        </label>
    </div>
</div>
```

### 2. 风险平价策略配置 (`public/index.html`)

**修改位置**：第166-246行

**主要变化**：
- 移除了自适应策略相关的说明
- 移除了股票池筛选功能
- 保留了v8.0.0版本的核心参数：
  - 波动率窗口
  - EWMA衰减系数
  - 调仓频率
  - 交易成本
  - 单只股票最大权重
  - 协方差矩阵优化
  - 市值加权比例

### 3. 自适应策略配置 (`public/index.html`)

**新增位置**：第248-367行

**包含功能**：
- 基础参数配置（波动率窗口、EWMA衰减系数等）
- 股票池筛选功能（ROE、负债率、动量、质量得分）
- 市场温度自适应调整说明

### 4. JavaScript逻辑修改 (`public/app.js`)

**主要修改**：

1. **显示控制函数** (第428-455行)
```javascript
function updateStrategyDisplay(strategy) {
    const compositeWeights = document.getElementById('compositeWeights');
    const marketValueConfig = document.getElementById('marketValueConfig');
    const riskParityConfig = document.getElementById('riskParityConfig');
    const adaptiveConfig = document.getElementById('adaptiveConfig');
    
    if (strategy === 'composite') {
        // 显示综合得分配置
    } else if (strategy === 'riskParity') {
        // 显示风险平价配置
    } else if (strategy === 'adaptive') {
        // 显示自适应配置
    } else {
        // 显示市值加权配置
    }
}
```

2. **配置读取** (第494-570行)
```javascript
const strategy = document.querySelector('input[name="strategy"]:checked').value;
const useCompositeScore = strategy === 'composite';
const useRiskParity = strategy === 'riskParity';
const useAdaptive = strategy === 'adaptive';

// 风险平价策略参数
if (useRiskParity) {
    riskParityParams = {
        volatilityWindow: ...,
        ewmaDecay: ...,
        maxWeight: maxWeight,
        useCovariance: document.getElementById('enableCovariance').checked,
        hybridRatio: parseInt(document.getElementById('hybridRatioSlider').value) / 100,
        enableStockFilter: false  // 不启用股票筛选
    };
}

// 自适应策略参数
else if (useAdaptive) {
    riskParityParams = {
        volatilityWindow: ...,
        ewmaDecay: ...,
        enableStockFilter: true,  // 启用股票筛选
        stockFilterParams: { ... }
    };
}
```

3. **API调用** (第156-179行)
```javascript
if (config.useRiskParity || config.useAdaptive) {
    params.append('strategyType', 'riskParity');
    params.append('useAdaptive', config.useAdaptive ? 'true' : 'false');
    // ...其他参数
}
```

---

## 后端修改

### 路由处理 (`routes/data.js`)

后端已经支持`useAdaptive`参数，无需修改。

**关键逻辑**：
```javascript
const config = {
    startDate: startDate || '',
    endDate: endDate || '',
    maxWeight: effectiveMaxWeight,
    useCompositeScore: false,
    useRiskParity: false,
    useAdaptive: useAdaptive === 'true'  // 自适应策略开关
};
```

当`useAdaptive=true`时，后端会启用市场温度调整逻辑。
当`useAdaptive=false`时，后端使用固定参数，不进行温度调整。

---

## 测试结果

### 测试环境
- 时间范围：2020-07-10 至 2025-07-10
- 调仓频率：季度
- 基础波动率窗口：6个月
- EWMA衰减系数：0.91

### 风险平价策略（v8.0.0版本）

| 指标 | 数值 |
|-----|------|
| 累计收益率 | 65.38% |
| 年化收益率 | 10.58% |
| 夏普比率 | 0.56 |
| 最大回撤 | 13.15% |
| 第1期持仓数 | 50只 |

**特点**：
- 使用全部50只成分股
- 不进行股票筛选
- 参数固定，不随市场变化

### 自适应策略

| 指标 | 数值 |
|-----|------|
| 累计收益率 | 102.33% |
| 年化收益率 | 15.13% |
| 夏普比率 | 0.80 |
| 最大回撤 | 13.14% |
| 第1期持仓数 | 40只 |

**特点**：
- 根据市场温度筛选股票
- 动态调整maxWeight、波动率窗口等参数
- 低估时进攻，高估时防守

---

## 文件清单

### 修改的文件
1. `public/index.html` - 前端页面结构
2. `public/app.js` - 前端JavaScript逻辑

### 新增的文件
1. `test-strategy-comparison.js` - 策略对比测试脚本

### 未修改的文件
1. `routes/data.js` - 后端路由（已支持useAdaptive参数）
2. `services/indexPortfolioService.js` - 核心服务逻辑
3. `services/marketThermometerService.js` - 市场温度服务

---

## 使用说明

### 风险平价策略

1. 选择"风险平价策略"单选按钮
2. 配置参数：
   - 波动率窗口（默认6个月）
   - EWMA衰减系数（默认0.91）
   - 调仓频率（默认季度）
   - 单只股票最大权重（默认13%）
   - 可选：协方差矩阵优化
   - 可选：市值加权比例
3. 点击"应用配置并计算"

### 自适应策略

1. 选择"自适应策略 ⭐"单选按钮
2. 配置基础参数：
   - 基础波动率窗口（默认6个月）
   - EWMA衰减系数（默认0.91）
   - 调仓频率（默认季度）
3. 可选：启用股票池筛选
   - ROE筛选
   - 负债率筛选
   - 动量筛选
   - 质量得分筛选
4. 点击"应用配置并计算"

---

## 注意事项

1. **风险平价策略**不会根据市场温度调整参数，适合希望使用固定策略的用户
2. **自适应策略**会根据市场温度（基于沪深300 PE/PB估值）动态调整参数
3. 两种策略的收益率差异主要来自：
   - 股票筛选（自适应策略会筛选掉部分股票）
   - 参数动态调整（自适应策略会根据市场状态调整maxWeight等）
4. 建议先使用风险平价策略了解基础逻辑，再尝试自适应策略

---

## 后续优化建议

1. 在前端显示当前市场温度和对应的参数调整
2. 添加调仓详情表格，显示每期的温度和调整逻辑
3. 支持自定义温度阈值和参数调整规则
4. 添加策略对比图表，直观展示两种策略的差异

---

**修改完成时间**：2026-01-06
**测试状态**：✅ 通过
**浏览器预览**：http://127.0.0.1:57589
