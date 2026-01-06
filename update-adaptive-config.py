#!/usr/bin/env python3
"""
更新自适应策略配置：移除股票筛选，添加温度参数自定义表单
"""

# 读取HTML文件
with open('public/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 找到需要替换的部分（从"启用股票池筛选"到"</div>\n                </div>\n            </div>"）
old_section_start = '''                    <div style="margin-top: 15px;">
                        <label>
                            <input type="checkbox" id="enableStockFilter" checked>
                            <strong>★ 启用股票池筛选（激进配置）</strong>
                        </label>'''

# 新的温度参数配置表单
new_section = '''                    <!-- 温度参数自定义配置 -->
                    <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; border: 1px solid #dee2e6;">
                        <h4 style="margin-top: 0; color: #2196f3;">🌡️ 温度区间参数配置</h4>
                        <p style="font-size: 0.9em; color: #666; margin-bottom: 15px;">
                            根据市场温度自动调整策略参数。温度基于沪深300指数PE/PB估值的历史分位数计算（0-100°）。
                        </p>
                        
                        <!-- 低估区间 (0-30°) -->
                        <div style="margin-bottom: 20px; padding: 12px; background: #e3f2fd; border-left: 4px solid #2196f3; border-radius: 4px;">
                            <h5 style="margin: 0 0 10px 0; color: #1976d2;">
                                <span style="background: #2196f3; color: white; padding: 2px 8px; border-radius: 3px; font-size: 0.85em;">低估 0-30°</span>
                                积极进攻策略
                            </h5>
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                                <div>
                                    <label style="font-size: 0.85em; color: #555;">单只股票最大权重 (%):</label>
                                    <input type="number" id="coldMaxWeight" min="5" max="30" step="1" value="20" 
                                           style="width: 100%; padding: 5px; border: 1px solid #ddd; border-radius: 4px; margin-top: 3px;">
                                </div>
                                <div>
                                    <label style="font-size: 0.85em; color: #555;">波动率窗口 (月):</label>
                                    <input type="number" id="coldVolWindow" min="3" max="24" step="1" value="6" 
                                           style="width: 100%; padding: 5px; border: 1px solid #ddd; border-radius: 4px; margin-top: 3px;">
                                </div>
                                <div>
                                    <label style="font-size: 0.85em; color: #555;">最低ROE (%):</label>
                                    <input type="number" id="coldMinROE" min="0" max="30" step="1" value="0" 
                                           style="width: 100%; padding: 5px; border: 1px solid #ddd; border-radius: 4px; margin-top: 3px;">
                                </div>
                            </div>
                            <div style="margin-top: 8px;">
                                <label style="font-size: 0.85em;">
                                    <input type="checkbox" id="coldFilterByQuality">
                                    启用质量筛选
                                </label>
                            </div>
                        </div>
                        
                        <!-- 中估区间 (30-70°) -->
                        <div style="margin-bottom: 20px; padding: 12px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                            <h5 style="margin: 0 0 10px 0; color: #f57c00;">
                                <span style="background: #ffc107; color: #333; padding: 2px 8px; border-radius: 3px; font-size: 0.85em;">中估 30-70°</span>
                                均衡配置策略
                            </h5>
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                                <div>
                                    <label style="font-size: 0.85em; color: #555;">单只股票最大权重 (%):</label>
                                    <input type="number" id="normalMaxWeight" min="5" max="30" step="1" value="15" 
                                           style="width: 100%; padding: 5px; border: 1px solid #ddd; border-radius: 4px; margin-top: 3px;">
                                </div>
                                <div>
                                    <label style="font-size: 0.85em; color: #555;">波动率窗口 (月):</label>
                                    <input type="number" id="normalVolWindow" min="3" max="24" step="1" value="6" 
                                           style="width: 100%; padding: 5px; border: 1px solid #ddd; border-radius: 4px; margin-top: 3px;">
                                </div>
                                <div>
                                    <label style="font-size: 0.85em; color: #555;">最低ROE (%):</label>
                                    <input type="number" id="normalMinROE" min="0" max="30" step="1" value="0" 
                                           style="width: 100%; padding: 5px; border: 1px solid #ddd; border-radius: 4px; margin-top: 3px;">
                                </div>
                            </div>
                            <div style="margin-top: 8px;">
                                <label style="font-size: 0.85em;">
                                    <input type="checkbox" id="normalFilterByQuality">
                                    启用质量筛选
                                </label>
                            </div>
                        </div>
                        
                        <!-- 高估区间 (70-100°) -->
                        <div style="margin-bottom: 10px; padding: 12px; background: #ffebee; border-left: 4px solid #f44336; border-radius: 4px;">
                            <h5 style="margin: 0 0 10px 0; color: #c62828;">
                                <span style="background: #f44336; color: white; padding: 2px 8px; border-radius: 3px; font-size: 0.85em;">高估 70-100°</span>
                                谨慎防守策略
                            </h5>
                            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
                                <div>
                                    <label style="font-size: 0.85em; color: #555;">单只股票最大权重 (%):</label>
                                    <input type="number" id="hotMaxWeight" min="5" max="30" step="1" value="10" 
                                           style="width: 100%; padding: 5px; border: 1px solid #ddd; border-radius: 4px; margin-top: 3px;">
                                </div>
                                <div>
                                    <label style="font-size: 0.85em; color: #555;">波动率窗口 (月):</label>
                                    <input type="number" id="hotVolWindow" min="3" max="24" step="1" value="12" 
                                           style="width: 100%; padding: 5px; border: 1px solid #ddd; border-radius: 4px; margin-top: 3px;">
                                </div>
                                <div>
                                    <label style="font-size: 0.85em; color: #555;">最低ROE (%):</label>
                                    <input type="number" id="hotMinROE" min="0" max="30" step="1" value="2" 
                                           style="width: 100%; padding: 5px; border: 1px solid #ddd; border-radius: 4px; margin-top: 3px;">
                                </div>
                            </div>
                            <div style="margin-top: 8px;">
                                <label style="font-size: 0.85em;">
                                    <input type="checkbox" id="hotFilterByQuality">
                                    启用质量筛选
                                </label>
                            </div>
                        </div>
                        
                        <div style="margin-top: 15px; padding: 10px; background: #e8f5e9; border-left: 3px solid #4caf50; font-size: 0.85em;">
                            <strong>💡 说明：</strong>
                            <ul style="margin: 5px 0; padding-left: 20px;">
                                <li>系统会根据当前市场温度自动选择对应区间的参数</li>
                                <li>低估时：提高maxWeight，降低筛选标准，积极进攻</li>
                                <li>高估时：降低maxWeight，提高筛选标准，谨慎防守</li>
                                <li>所有参数都会在调仓时动态应用</li>
                            </ul>
                        </div>
                    </div>'''

# 查找并替换
if old_section_start in content:
    # 找到开始位置
    start_pos = content.find(old_section_start)
    # 找到结束位置（查找对应的结束标签）
    # 需要找到包含stockFilterConfig的整个div块的结束
    search_from = start_pos
    # 查找"</div>\n                </div>\n            </div>"这个模式
    end_marker = '''                    </div>
                </div>
            </div>'''
    
    # 从start_pos开始查找，找到第三个这样的结束标记
    temp_pos = search_from
    count = 0
    while count < 3:
        temp_pos = content.find('</div>', temp_pos + 1)
        if temp_pos == -1:
            break
        # 检查是否是我们要找的结束标记
        if content[temp_pos:temp_pos+100].count('</div>') >= 3:
            count += 1
    
    # 更简单的方法：查找"<div class=\"config-actions\">"之前的位置
    config_actions_pos = content.find('<div class="config-actions">', start_pos)
    if config_actions_pos > start_pos:
        # 回退到前一个</div>的位置
        end_pos = content.rfind('</div>', start_pos, config_actions_pos)
        end_pos = content.rfind('</div>', start_pos, end_pos)
        end_pos = content.rfind('</div>', start_pos, end_pos) + len('</div>')
        
        # 替换内容
        new_content = content[:start_pos] + new_section + content[end_pos:]
        
        # 写回文件
        with open('public/index.html', 'w', encoding='utf-8') as f:
            f.write(new_content)
        
        print("✅ 成功更新自适应策略配置")
        print(f"   替换位置: {start_pos} - {end_pos}")
        print(f"   原内容长度: {end_pos - start_pos}")
        print(f"   新内容长度: {len(new_section)}")
    else:
        print("❌ 未找到config-actions标记")
else:
    print("❌ 未找到需要替换的内容")
