#!/usr/bin/env python3
"""
风险平价策略参数组合测试脚本

测试参数：
- 波动率计算窗口：6, 12, 18, 24
- EWMA衰减系数：0.85-0.98，步长0.01
- 调仓频率：每季度（固定）
- 单只股票最大权重：0.05-0.15，步长0.01
- 测试期间：20200710-20250710
- 并发数：15
"""

import requests
import json
import time
from datetime import datetime
from itertools import product
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

# API配置
BASE_URL = "http://localhost:3001"
API_ENDPOINT = f"{BASE_URL}/api/index-returns"

# 固定参数
FIXED_PARAMS = {
    'startDate': '20200710',
    'endDate': '20250710',
    'strategyType': 'riskParity',
    'rebalanceFrequency': 'quarterly',
    'enableTradingCost': 'false',
    'tradingCostRate': '0',
    'riskFreeRate': '0.02'
}

# 测试参数范围
VOLATILITY_WINDOWS = [24, 18, 12, 6]  # 从大到小测试
EWMA_DECAYS = [round(0.85 + i * 0.01, 2) for i in range(14)]  # 0.85-0.98
MAX_WEIGHTS = [round(0.05 + i * 0.01, 2) for i in range(11)]  # 0.05-0.15

# 并发配置
MAX_WORKERS = 15  # 已验证并发安全，使用15线程加速测试

def test_parameter_combination(volatility_window, ewma_decay, max_weight):
    """测试单个参数组合"""
    params = FIXED_PARAMS.copy()
    params.update({
        'volatilityWindow': str(volatility_window),
        'ewmaDecay': str(ewma_decay),
        'maxWeight': str(max_weight)
    })
    
    try:
        response = requests.get(API_ENDPOINT, params=params, timeout=120)
        response.raise_for_status()
        data = response.json()
        
        if data.get('success'):
            custom_risk = data['data']['customRisk']
            index_risk = data['data']['indexRisk']
            tracking_error = data['data'].get('trackingError')
            
            result = {
                'volatilityWindow': volatility_window,
                'ewmaDecay': ewma_decay,
                'maxWeight': max_weight,
                'annualizedReturn': custom_risk['annualizedReturn'],
                'volatility': custom_risk['volatility'],
                'sharpeRatio': custom_risk['sharpeRatio'],
                'sortinoRatio': custom_risk.get('sortinoRatio'),
                'maxDrawdown': custom_risk['maxDrawdown'],
                'indexReturn': index_risk['annualizedReturn'],
                'excessReturn': custom_risk['annualizedReturn'] - index_risk['annualizedReturn'],
                'trackingError': tracking_error['trackingError'] if tracking_error else None,
                'status': 'success'
            }
            return result
        else:
            return {
                'volatilityWindow': volatility_window,
                'ewmaDecay': ewma_decay,
                'maxWeight': max_weight,
                'status': 'failed',
                'error': data.get('error', 'Unknown error')
            }
    except Exception as e:
        return {
            'volatilityWindow': volatility_window,
            'ewmaDecay': ewma_decay,
            'maxWeight': max_weight,
            'status': 'error',
            'error': str(e)
        }

def main():
    print("=" * 80)
    print("风险平价策略参数组合测试（并发版）")
    print("=" * 80)
    print(f"测试时间: {datetime.now().strftime('%Y/%m/%d %H:%M:%S')}")
    print(f"测试期间: {FIXED_PARAMS['startDate']} - {FIXED_PARAMS['endDate']}")
    print()
    print("测试参数范围:")
    print(f"  波动率计算窗口: {VOLATILITY_WINDOWS}")
    print(f"  EWMA衰减系数: {EWMA_DECAYS[0]}-{EWMA_DECAYS[-1]}, 步长0.01 ({len(EWMA_DECAYS)}个值)")
    print(f"  单只股票最大权重: {MAX_WEIGHTS[0]}-{MAX_WEIGHTS[-1]}, 步长0.01 ({len(MAX_WEIGHTS)}个值)")
    print(f"  调仓频率: 每季度（固定）")
    print(f"  并发数: {MAX_WORKERS}")
    print()
    
    total_combinations = len(VOLATILITY_WINDOWS) * len(EWMA_DECAYS) * len(MAX_WEIGHTS)
    print(f"总测试用例数: {total_combinations}")
    print("=" * 80)
    print()
    
    results = []
    success_count = 0
    failed_count = 0
    completed_count = 0
    lock = threading.Lock()
    
    # 生成所有参数组合
    combinations = list(product(VOLATILITY_WINDOWS, EWMA_DECAYS, MAX_WEIGHTS))
    
    start_time = time.time()
    
    # 使用线程池并发执行测试
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        # 提交所有任务
        future_to_params = {
            executor.submit(test_parameter_combination, vol_window, ewma_decay, max_weight): (vol_window, ewma_decay, max_weight)
            for vol_window, ewma_decay, max_weight in combinations
        }
        
        # 处理完成的任务
        for future in as_completed(future_to_params):
            vol_window, ewma_decay, max_weight = future_to_params[future]
            
            try:
                result = future.result()
                
                with lock:
                    results.append(result)
                    completed_count += 1
                    
                    if result['status'] == 'success':
                        success_count += 1
                        status_msg = f"✅ 年化收益={result['annualizedReturn']*100:.2f}%, 夏普={result['sharpeRatio']:.2f}"
                    else:
                        failed_count += 1
                        status_msg = f"❌ {result.get('error', 'Failed')}"
                    
                    # 计算预计剩余时间
                    elapsed_time = time.time() - start_time
                    avg_time_per_test = elapsed_time / completed_count
                    remaining_tests = total_combinations - completed_count
                    estimated_remaining_time = avg_time_per_test * remaining_tests
                    
                    print(f"[{completed_count}/{total_combinations}] 窗口={vol_window}, EWMA={ewma_decay}, 权重={max_weight*100:.0f}% ... {status_msg}", flush=True)
                    
                    # 每50个测试显示一次进度
                    if completed_count % 50 == 0:
                        print(f"\n  📊 进度: {completed_count}/{total_combinations} ({completed_count/total_combinations*100:.1f}%)", flush=True)
                        print(f"  ✅ 成功: {success_count}, ❌ 失败: {failed_count}", flush=True)
                        print(f"  ⏱️  已用时: {elapsed_time/60:.1f}分钟, 预计剩余: {estimated_remaining_time/60:.1f}分钟\n", flush=True)
                    
            except Exception as e:
                with lock:
                    completed_count += 1
                    failed_count += 1
                    print(f"[{completed_count}/{total_combinations}] 窗口={vol_window}, EWMA={ewma_decay}, 权重={max_weight*100:.0f}% ... ❌ 异常: {str(e)}")
    
    print()
    print("=" * 80)
    print("测试完成")
    print(f"成功用例数: {success_count}/{total_combinations}")
    print(f"失败用例数: {failed_count}/{total_combinations}")
    print("=" * 80)
    
    # 保存结果到JSON文件
    output_file = f"risk_parity_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({
            'test_time': datetime.now().isoformat(),
            'test_period': f"{FIXED_PARAMS['startDate']}-{FIXED_PARAMS['endDate']}",
            'total_combinations': total_combinations,
            'success_count': success_count,
            'failed_count': failed_count,
            'results': results
        }, f, indent=2, ensure_ascii=False)
    
    print(f"\n结果已保存到: {output_file}")
    
    # 生成Markdown报告
    generate_markdown_report(results, success_count, failed_count, total_combinations)
    
    return results

def generate_markdown_report(results, success_count, failed_count, total_combinations):
    """生成Markdown格式的测试报告"""
    
    # 过滤成功的结果
    success_results = [r for r in results if r['status'] == 'success']
    
    if not success_results:
        print("没有成功的测试结果，无法生成报告")
        return
    
    # 按夏普比率排序
    success_results.sort(key=lambda x: x['sharpeRatio'], reverse=True)
    
    output_file = f"docs/risk_parity_test_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("# 风险平价策略参数组合测试报告\n\n")
        f.write(f"测试时间: {datetime.now().strftime('%Y/%m/%d %H:%M:%S')}\n")
        f.write(f"测试期间: {FIXED_PARAMS['startDate']} - {FIXED_PARAMS['endDate']}\n")
        f.write(f"总测试用例数: {total_combinations}\n")
        f.write(f"成功用例数: {success_count}\n\n")
        
        f.write("## 测试参数范围\n\n")
        f.write(f"- 波动率计算窗口: {VOLATILITY_WINDOWS}\n")
        f.write(f"- EWMA衰减系数: {EWMA_DECAYS[0]}-{EWMA_DECAYS[-1]}, 步长0.01\n")
        f.write(f"- 单只股票最大权重: {MAX_WEIGHTS[0]*100:.0f}%-{MAX_WEIGHTS[-1]*100:.0f}%, 步长1%\n")
        f.write(f"- 调仓频率: 每季度（固定）\n")
        f.write(f"- 测试期间: {FIXED_PARAMS['startDate']} - {FIXED_PARAMS['endDate']}\n\n")
        
        f.write("## Top 20 最优参数组合（按夏普比率排序）\n\n")
        f.write("| 序号 | 波动率窗口 | EWMA衰减 | 最大权重 | 年化收益率 | 波动率 | 夏普比率 | 索提诺比率 | 最大回撤 | 超额收益 | 跟踪误差 |\n")
        f.write("|------|------------|----------|----------|------------|--------|----------|------------|----------|----------|----------|\n")
        
        for idx, result in enumerate(success_results[:20], 1):
            f.write(f"| {idx} | {result['volatilityWindow']} | {result['ewmaDecay']:.2f} | {result['maxWeight']*100:.0f}% | ")
            f.write(f"{result['annualizedReturn']*100:.2f}% | {result['volatility']*100:.2f}% | ")
            f.write(f"{result['sharpeRatio']:.2f} | ")
            f.write(f"{result['sortinoRatio']:.2f} | " if result.get('sortinoRatio') else "- | ")
            f.write(f"{result['maxDrawdown']*100:.2f}% | ")
            f.write(f"{result['excessReturn']*100:+.2f}% | ")
            f.write(f"{result['trackingError']*100:.2f}% |\n" if result.get('trackingError') else "- |\n")
        
        f.write("\n## 完整测试结果\n\n")
        f.write("| 序号 | 波动率窗口 | EWMA衰减 | 最大权重 | 年化收益率 | 波动率 | 夏普比率 | 索提诺比率 | 最大回撤 | 超额收益 | 跟踪误差 | 状态 |\n")
        f.write("|------|------------|----------|----------|------------|--------|----------|------------|----------|----------|----------|------|\n")
        
        for idx, result in enumerate(success_results, 1):
            status = "✅" if result['status'] == 'success' else "❌"
            f.write(f"| {idx} | {result['volatilityWindow']} | {result['ewmaDecay']:.2f} | {result['maxWeight']*100:.0f}% | ")
            f.write(f"{result['annualizedReturn']*100:.2f}% | {result['volatility']*100:.2f}% | ")
            f.write(f"{result['sharpeRatio']:.2f} | ")
            f.write(f"{result['sortinoRatio']:.2f} | " if result.get('sortinoRatio') else "- | ")
            f.write(f"{result['maxDrawdown']*100:.2f}% | ")
            f.write(f"{result['excessReturn']*100:+.2f}% | ")
            f.write(f"{result['trackingError']*100:.2f}% | " if result.get('trackingError') else "- | ")
            f.write(f"{status} |\n")
        
        # 添加参数分析
        f.write("\n## 参数影响分析\n\n")
        
        # 按波动率窗口分组统计
        f.write("### 波动率窗口影响\n\n")
        f.write("| 波动率窗口 | 平均夏普比率 | 最高夏普比率 | 平均年化收益 | 平均波动率 |\n")
        f.write("|------------|--------------|--------------|--------------|------------|\n")
        for window in VOLATILITY_WINDOWS:
            window_results = [r for r in success_results if r['volatilityWindow'] == window]
            if window_results:
                avg_sharpe = sum(r['sharpeRatio'] for r in window_results) / len(window_results)
                max_sharpe = max(r['sharpeRatio'] for r in window_results)
                avg_return = sum(r['annualizedReturn'] for r in window_results) / len(window_results)
                avg_vol = sum(r['volatility'] for r in window_results) / len(window_results)
                f.write(f"| {window} | {avg_sharpe:.3f} | {max_sharpe:.3f} | {avg_return*100:.2f}% | {avg_vol*100:.2f}% |\n")
        
        # 按EWMA衰减系数分组统计
        f.write("\n### EWMA衰减系数影响\n\n")
        f.write("| EWMA衰减 | 平均夏普比率 | 最高夏普比率 | 平均年化收益 | 平均波动率 |\n")
        f.write("|----------|--------------|--------------|--------------|------------|\n")
        for decay in EWMA_DECAYS:
            decay_results = [r for r in success_results if r['ewmaDecay'] == decay]
            if decay_results:
                avg_sharpe = sum(r['sharpeRatio'] for r in decay_results) / len(decay_results)
                max_sharpe = max(r['sharpeRatio'] for r in decay_results)
                avg_return = sum(r['annualizedReturn'] for r in decay_results) / len(decay_results)
                avg_vol = sum(r['volatility'] for r in decay_results) / len(decay_results)
                f.write(f"| {decay:.2f} | {avg_sharpe:.3f} | {max_sharpe:.3f} | {avg_return*100:.2f}% | {avg_vol*100:.2f}% |\n")
        
        # 按最大权重分组统计
        f.write("\n### 最大权重影响\n\n")
        f.write("| 最大权重 | 平均夏普比率 | 最高夏普比率 | 平均年化收益 | 平均波动率 |\n")
        f.write("|----------|--------------|--------------|--------------|------------|\n")
        for weight in MAX_WEIGHTS:
            weight_results = [r for r in success_results if r['maxWeight'] == weight]
            if weight_results:
                avg_sharpe = sum(r['sharpeRatio'] for r in weight_results) / len(weight_results)
                max_sharpe = max(r['sharpeRatio'] for r in weight_results)
                avg_return = sum(r['annualizedReturn'] for r in weight_results) / len(weight_results)
                avg_vol = sum(r['volatility'] for r in weight_results) / len(weight_results)
                f.write(f"| {weight*100:.0f}% | {avg_sharpe:.3f} | {max_sharpe:.3f} | {avg_return*100:.2f}% | {avg_vol*100:.2f}% |\n")
    
    print(f"Markdown报告已保存到: {output_file}")

if __name__ == "__main__":
    try:
        results = main()
        print("\n测试完成！")
    except KeyboardInterrupt:
        print("\n\n测试被用户中断")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n测试出错: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
