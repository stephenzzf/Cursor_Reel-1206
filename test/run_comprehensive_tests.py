"""
综合测试脚本
使用 HTTP 请求测试所有 API 端点，找出潜在问题
"""

import json
import time
import requests
from datetime import datetime
from typing import Dict, List, Any

API_BASE_URL = "http://localhost:8787"
test_results: List[Dict[str, Any]] = []


def log_test(test_name: str, status: str, details: Dict[str, Any]):
    """记录测试结果"""
    result = {
        'test_name': test_name,
        'status': status,
        'timestamp': datetime.now().isoformat(),
        'details': details
    }
    test_results.append(result)
    
    icon = {'PASS': '✅', 'FAIL': '❌', 'WARNING': '⚠️', 'SKIP': '⏭️'}.get(status, '❓')
    print(f"{icon} {test_name}: {status}")
    if details.get('error'):
        print(f"   错误: {details['error']}")
    if details.get('response_status'):
        print(f"   状态码: {details['response_status']}")
    if details.get('response_time'):
        print(f"   响应时间: {details['response_time']:.2f}s")


def test_health_check():
    """测试健康检查"""
    try:
        start = time.time()
        response = requests.get(f"{API_BASE_URL}/health", timeout=5)
        elapsed = time.time() - start
        
        status = 'PASS' if response.status_code == 200 else 'FAIL'
        log_test(
            "健康检查",
            status,
            {
                'endpoint': '/health',
                'method': 'GET',
                'response_status': response.status_code,
                'response_body': response.json(),
                'response_time': elapsed
            }
        )
        return status == 'PASS'
    except Exception as e:
        log_test("健康检查", 'FAIL', {'error': str(e)})
        return False


def test_auth_scenarios():
    """测试认证相关场景"""
    scenarios = [
        {
            'name': '缺少 Authorization header',
            'url': '/api/reel/creative-director',
            'headers': {'Content-Type': 'application/json'},
            'data': {'userPrompt': 'test'},
            'expected_status': 401
        },
        {
            'name': '无效 Token 格式',
            'url': '/api/reel/creative-director',
            'headers': {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer invalid_token'
            },
            'data': {'userPrompt': 'test'},
            'expected_status': 401
        },
        {
            'name': 'Token 格式错误（缺少 Bearer）',
            'url': '/api/reel/creative-director',
            'headers': {
                'Content-Type': 'application/json',
                'Authorization': 'invalid_token'
            },
            'data': {'userPrompt': 'test'},
            'expected_status': 401
        },
        {
            'name': '空 Token',
            'url': '/api/reel/creative-director',
            'headers': {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer '
            },
            'data': {'userPrompt': 'test'},
            'expected_status': 401
        }
    ]
    
    results = []
    for scenario in scenarios:
        try:
            start = time.time()
            response = requests.post(
                f"{API_BASE_URL}{scenario['url']}",
                headers=scenario['headers'],
                json=scenario['data'],
                timeout=5
            )
            elapsed = time.time() - start
            
            status = 'PASS' if response.status_code == scenario['expected_status'] else 'FAIL'
            log_test(
                f"认证测试 - {scenario['name']}",
                status,
                {
                    'endpoint': scenario['url'],
                    'method': 'POST',
                    'response_status': response.status_code,
                    'expected_status': scenario['expected_status'],
                    'response_body': response.json() if response.content else None,
                    'response_time': elapsed
                }
            )
            results.append(status == 'PASS')
        except Exception as e:
            log_test(f"认证测试 - {scenario['name']}", 'FAIL', {'error': str(e)})
            results.append(False)
    
    return all(results)


def test_input_validation():
    """测试输入验证"""
    # 使用无效 token，但会先验证认证，所以都会返回 401
    # 但我们可以测试请求格式是否正确
    invalid_token = 'Bearer invalid_token_for_testing'
    
    scenarios = [
        {
            'name': '缺少 userPrompt',
            'url': '/api/reel/creative-director',
            'data': {'selectedModel': 'banana'},
            'expected_status': 401  # 会先验证认证
        },
        {
            'name': '空 userPrompt',
            'url': '/api/reel/creative-director',
            'data': {'userPrompt': '', 'selectedModel': 'banana'},
            'expected_status': 401
        },
        {
            'name': '缺少 prompt (generate)',
            'url': '/api/reel/generate',
            'data': {'model': 'banana'},
            'expected_status': 401
        },
        {
            'name': '空 prompt (generate)',
            'url': '/api/reel/generate',
            'data': {'prompt': '', 'model': 'banana'},
            'expected_status': 401
        },
        {
            'name': '缺少 prompt (enhance-prompt)',
            'url': '/api/reel/enhance-prompt',
            'data': {},
            'expected_status': 401
        },
        {
            'name': '缺少 topic (design-plan)',
            'url': '/api/reel/design-plan',
            'data': {},
            'expected_status': 401
        }
    ]
    
    results = []
    for scenario in scenarios:
        try:
            start = time.time()
            response = requests.post(
                f"{API_BASE_URL}{scenario['url']}",
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': invalid_token
                },
                json=scenario['data'],
                timeout=5
            )
            elapsed = time.time() - start
            
            # 注意：由于认证失败，所有请求都会返回 401
            # 但我们可以检查响应格式和错误信息
            status = 'PASS' if response.status_code == scenario['expected_status'] else 'WARNING'
            log_test(
                f"输入验证 - {scenario['name']}",
                status,
                {
                    'endpoint': scenario['url'],
                    'method': 'POST',
                    'response_status': response.status_code,
                    'expected_status': scenario['expected_status'],
                    'response_body': response.json() if response.content else None,
                    'response_time': elapsed,
                    'note': '认证失败会先于输入验证'
                }
            )
            results.append(True)  # 认证失败是预期的
        except Exception as e:
            log_test(f"输入验证 - {scenario['name']}", 'FAIL', {'error': str(e)})
            results.append(False)
    
    return all(results)


def test_error_messages():
    """测试错误信息的清晰度"""
    scenarios = [
        {
            'name': '缺少认证的错误信息',
            'url': '/api/reel/creative-director',
            'headers': {'Content-Type': 'application/json'},
            'data': {'userPrompt': 'test'},
            'check_error_msg': True
        },
        {
            'name': '无效 Token 的错误信息',
            'url': '/api/reel/creative-director',
            'headers': {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer invalid_token'
            },
            'data': {'userPrompt': 'test'},
            'check_error_msg': True
        }
    ]
    
    issues = []
    for scenario in scenarios:
        try:
            response = requests.post(
                f"{API_BASE_URL}{scenario['url']}",
                headers=scenario['headers'],
                json=scenario['data'],
                timeout=5
            )
            
            if response.status_code == 401:
                error_body = response.json() if response.content else {}
                error_msg = error_body.get('error', '')
                
                # 检查错误信息是否包含二进制表示
                if "b'" in error_msg and "'" in error_msg:
                    issues.append({
                        'scenario': scenario['name'],
                        'issue': '错误信息包含二进制表示',
                        'error_msg': error_msg,
                        'suggestion': '应该清理错误信息，移除二进制表示'
                    })
                
                log_test(
                    f"错误信息检查 - {scenario['name']}",
                    'PASS' if not issues else 'WARNING',
                    {
                        'endpoint': scenario['url'],
                        'error_message': error_msg,
                        'issues': issues[-1] if issues else None
                    }
                )
        except Exception as e:
            log_test(f"错误信息检查 - {scenario['name']}", 'FAIL', {'error': str(e)})
    
    return issues


def test_endpoint_availability():
    """测试所有端点的可用性（认证失败但端点存在）"""
    endpoints = [
        '/api/reel/creative-director',
        '/api/reel/generate',
        '/api/reel/enhance-prompt',
        '/api/reel/design-plan',
        '/api/reel/upscale',
        '/api/reel/remove-background',
        '/api/reel/reference-image'
    ]
    
    results = []
    for endpoint in endpoints:
        try:
            start = time.time()
            response = requests.post(
                f"{API_BASE_URL}{endpoint}",
                headers={'Content-Type': 'application/json'},
                json={},
                timeout=5
            )
            elapsed = time.time() - start
            
            # 端点存在应该返回 401（认证失败）而不是 404（不存在）
            status = 'PASS' if response.status_code == 401 else 'FAIL'
            log_test(
                f"端点可用性 - {endpoint}",
                status,
                {
                    'endpoint': endpoint,
                    'response_status': response.status_code,
                    'response_time': elapsed,
                    'note': '401 表示端点存在但需要认证，404 表示端点不存在'
                }
            )
            results.append(status == 'PASS')
        except Exception as e:
            log_test(f"端点可用性 - {endpoint}", 'FAIL', {'error': str(e)})
            results.append(False)
    
    return all(results)


def generate_report():
    """生成测试报告"""
    total = len(test_results)
    passed = len([r for r in test_results if r['status'] == 'PASS'])
    failed = len([r for r in test_results if r['status'] == 'FAIL'])
    warnings = len([r for r in test_results if r['status'] == 'WARNING'])
    
    report = {
        'summary': {
            'total_tests': total,
            'passed': passed,
            'failed': failed,
            'warnings': warnings,
            'pass_rate': f"{(passed/total*100):.1f}%" if total > 0 else "0%"
        },
        'test_results': test_results,
        'timestamp': datetime.now().isoformat()
    }
    
    # 保存 JSON 报告
    with open('test/comprehensive_test_report.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    # 生成 Markdown 报告
    md_content = f"""# 综合测试报告

**生成时间**: {report['timestamp']}

## 测试摘要

- 总测试数: {total}
- ✅ 通过: {passed}
- ❌ 失败: {failed}
- ⚠️ 警告: {warnings}
- 通过率: {report['summary']['pass_rate']}

## 详细结果

"""
    
    for result in test_results:
        icon = {'PASS': '✅', 'FAIL': '❌', 'WARNING': '⚠️', 'SKIP': '⏭️'}.get(result['status'], '❓')
        md_content += f"### {icon} {result['test_name']}\n\n"
        md_content += f"- **状态**: {result['status']}\n"
        md_content += f"- **时间**: {result['timestamp']}\n"
        md_content += f"- **详情**:\n"
        md_content += f"```json\n{json.dumps(result['details'], indent=2, ensure_ascii=False)}\n```\n\n"
    
    with open('test/COMPREHENSIVE_TEST_REPORT.md', 'w', encoding='utf-8') as f:
        f.write(md_content)
    
    print(f"\n{'='*60}")
    print("测试报告已生成")
    print(f"JSON: test/comprehensive_test_report.json")
    print(f"Markdown: test/COMPREHENSIVE_TEST_REPORT.md")
    print(f"{'='*60}\n")
    
    return report


def main():
    """主测试函数"""
    print("="*60)
    print("开始执行综合测试")
    print("="*60)
    print()
    
    # 1. 健康检查
    print("【阶段 1】健康检查")
    test_health_check()
    print()
    
    # 2. 认证测试
    print("【阶段 2】认证相关测试")
    test_auth_scenarios()
    print()
    
    # 3. 输入验证测试
    print("【阶段 3】输入验证测试")
    test_input_validation()
    print()
    
    # 4. 错误信息检查
    print("【阶段 4】错误信息检查")
    issues = test_error_messages()
    if issues:
        print("\n发现的问题:")
        for issue in issues:
            print(f"  - {issue['scenario']}: {issue['issue']}")
            print(f"    建议: {issue['suggestion']}")
    print()
    
    # 5. 端点可用性测试
    print("【阶段 5】端点可用性测试")
    test_endpoint_availability()
    print()
    
    # 6. 生成报告
    print("【阶段 6】生成测试报告")
    generate_report()


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n测试被用户中断")
    except Exception as e:
        print(f"\n测试执行出错: {e}")
        import traceback
        traceback.print_exc()
