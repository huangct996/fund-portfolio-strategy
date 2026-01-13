import requests
import json

# 调用API
r = requests.get('http://localhost:3001/api/index-returns', params={
    'startDate': '20200101',
    'endDate': '20241231',
    'strategyType': 'riskParity',
    'useAdaptive': 'false',
    'maxWeight': '0.10',
    'volatilityWindow': '6',
    'ewmaDecay': '0.91',
    'rebalanceFrequency': 'quarterly',
    'enableTradingCost': 'true',
    'tradingCostRate': '0.001',
    'riskFreeRate': '0.02',
    'useQualityTilt': 'false',
    'useCovariance': 'false',
    'hybridRatio': '0',
    'enableStockFilter': 'true',
    'momentumMonths': '6',
    'minMomentumReturn': '-0.10',
    'filterByQuality': 'true'
}, timeout=60)

data = r.json()['data']
fund = data['fundRisk']

print('后端API返回的基金风险指标:')
print(f"  maxDrawdown原始值: {fund['maxDrawdown']}")
print(f"  maxDrawdown * 100: {fund['maxDrawdown'] * 100}")
print(f"  前端显示应该是: {fund['maxDrawdown'] * 100:.2f}%")

print('\nfundRisk所有字段:')
for key, value in fund.items():
    if isinstance(value, float):
        print(f"  {key}: {value:.6f} ({value*100:.2f}%)")
    else:
        print(f"  {key}: {value}")

# 检查是否有0.87%的来源
print(f"\n查找0.87%的可能来源:")
print(f"  0.87 / 100 = {0.87 / 100}")
for key, value in fund.items():
    if isinstance(value, float):
        if abs(value - 0.0087) < 0.001:
            print(f"  找到! {key} = {value} ({value*100:.2f}%)")
        if abs(value * 100 - 0.87) < 0.1:
            print(f"  找到! {key} * 100 = {value * 100:.2f}%")
