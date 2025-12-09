"""
MCP Playwright 测试执行器
使用 MCP Playwright 工具执行自动化测试

使用方法：
1. 确保后端服务正在运行（http://localhost:8787）
2. 确保前端服务正在运行（http://localhost:5173）
3. 运行此脚本：python test/mcp_playwright_executor.py
"""

import os
import json
import time
import base64
from datetime import datetime
from typing import Dict, List, Any, Optional

# 测试配置
API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:8787')
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5173')
TEST_EMAIL = os.getenv('TEST_EMAIL', 'test@example.com')
TEST_PASSWORD = os.getenv('TEST_PASSWORD', 'testpassword123')

# 测试结果存储
test_results: List[Dict[str, Any]] = []


def log_test_result(test_name: str, status: str, details: Dict[str, Any]):
    """记录测试结果"""
    result = {
        'test_name': test_name,
        'status': status,  # 'PASS', 'FAIL', 'WARNING'
        'timestamp': datetime.now().isoformat(),
        'details': details
    }
    test_results.append(result)
    
    status_icon = {
        'PASS': '✅',
        'FAIL': '❌',
        'WARNING': '⚠️',
        'PENDING': '⏳'
    }.get(status, '❓')
    
    print(f"\n{status_icon} {test_name} - {status}")
    if details.get('error'):
        print(f"   错误: {details['error']}")
    if details.get('response_status'):
        print(f"   响应状态: {details['response_status']}")
    if details.get('response_time'):
        print(f"   响应时间: {details['response_time']:.2f}s")


def execute_http_request(method: str, url: str, headers: Dict = None, body: Dict = None) -> Dict:
    """
    执行 HTTP 请求
    注意：这需要使用 MCP Playwright 的 HTTP 工具
    实际执行时，应该调用相应的 MCP 工具
    """
    # 这里返回一个占位符结构
    # 实际执行时需要使用 MCP Playwright 的 playwright_get/post/put/delete 工具
    return {
        'status': None,
        'body': None,
        'headers': None,
        'error': None
    }


def test_health_check():
    """测试健康检查端点"""
    test_name = "健康检查端点"
    start_time = time.time()
    
    try:
        # 使用 MCP Playwright 发送 GET 请求
        # 实际执行时：使用 playwright_get(API_BASE_URL + '/health')
        response = execute_http_request('GET', f'{API_BASE_URL}/health')
        
        response_time = time.time() - start_time
        status = 'PASS' if response.get('status') == 200 else 'FAIL'
        
        details = {
            'endpoint': f'{API_BASE_URL}/health',
            'method': 'GET',
            'response_status': response.get('status'),
            'response_time': response_time,
            'response_body': response.get('body')
        }
        
        if response.get('error'):
            details['error'] = response['error']
            status = 'FAIL'
        
        log_test_result(test_name, status, details)
        return status == 'PASS'
    except Exception as e:
        log_test_result(test_name, 'FAIL', {'error': str(e)})
        return False


def test_auth_missing():
    """测试缺少认证的情况"""
    test_name = "认证验证 - 缺少 Token"
    start_time = time.time()
    
    try:
        # 使用 MCP Playwright 发送 POST 请求（无 Authorization header）
        response = execute_http_request(
            'POST',
            f'{API_BASE_URL}/api/reel/creative-director',
            headers={'Content-Type': 'application/json'},
            body={'userPrompt': 'test'}
        )
        
        response_time = time.time() - start_time
        # 应该返回 401
        status = 'PASS' if response.get('status') == 401 else 'FAIL'
        
        details = {
            'endpoint': f'{API_BASE_URL}/api/reel/creative-director',
            'method': 'POST',
            'response_status': response.get('status'),
            'response_time': response_time,
            'expected_status': 401
        }
        
        if response.get('error'):
            details['error'] = response['error']
        
        log_test_result(test_name, status, details)
        return status == 'PASS'
    except Exception as e:
        log_test_result(test_name, 'FAIL', {'error': str(e)})
        return False


def get_firebase_token_via_browser():
    """
    通过浏览器登录并获取 Firebase token
    使用 MCP Playwright 工具
    """
    print("\n正在通过浏览器获取 Firebase token...")
    
    # 步骤 1: 导航到前端页面
    # 使用: playwright_navigate(FRONTEND_URL)
    
    # 步骤 2: 等待页面加载
    # 使用: playwright_wait_for(time=3)
    
    # 步骤 3: 查找登录表单并填写
    # 使用: playwright_fill(selector='input[type="email"]', value=TEST_EMAIL)
    # 使用: playwright_fill(selector='input[type="password"]', value=TEST_PASSWORD)
    
    # 步骤 4: 点击登录按钮
    # 使用: playwright_click(selector='button[type="submit"]')
    
    # 步骤 5: 等待登录完成
    # 使用: playwright_wait_for(text="登录成功" 或等待特定元素出现)
    
    # 步骤 6: 在浏览器控制台执行 JavaScript 获取 token
    js_code = """
    async () => {
        const user = firebase.auth().currentUser;
        if (user) {
            const token = await user.getIdToken();
            return token;
        }
        return null;
    }
    """
    # 使用: playwright_evaluate(function=js_code)
    
    # 返回 token（实际执行时从 evaluate 结果获取）
    return None


def test_creative_director_with_token(token: str, scenario: Dict):
    """使用 token 测试创意总监 API"""
    test_name = f"创意总监 - {scenario['name']}"
    start_time = time.time()
    
    try:
        response = execute_http_request(
            'POST',
            f'{API_BASE_URL}/api/reel/creative-director',
            headers={
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json'
            },
            body=scenario['body']
        )
        
        response_time = time.time() - start_time
        response_status = response.get('status')
        response_body = response.get('body')
        
        # 验证响应
        status = 'PASS'
        if response_status != 200:
            status = 'FAIL'
        elif 'expected_action' in scenario:
            if isinstance(response_body, dict) and response_body.get('action') != scenario['expected_action']:
                status = 'WARNING'
        
        details = {
            'endpoint': f'{API_BASE_URL}/api/reel/creative-director',
            'method': 'POST',
            'response_status': response_status,
            'response_time': response_time,
            'response_body': response_body,
            'expected_action': scenario.get('expected_action')
        }
        
        if response.get('error'):
            details['error'] = response['error']
            status = 'FAIL'
        
        log_test_result(test_name, status, details)
        return status == 'PASS'
    except Exception as e:
        log_test_result(test_name, 'FAIL', {'error': str(e)})
        return False


def test_generate_with_token(token: str, scenario: Dict):
    """使用 token 测试生成 API"""
    test_name = f"生成资产 - {scenario['name']}"
    start_time = time.time()
    
    try:
        response = execute_http_request(
            'POST',
            f'{API_BASE_URL}/api/reel/generate',
            headers={
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json'
            },
            body=scenario['body']
        )
        
        response_time = time.time() - start_time
        response_status = response.get('status')
        response_body = response.get('body')
        
        # 验证响应
        status = 'PASS' if response_status == 200 else 'FAIL'
        
        details = {
            'endpoint': f'{API_BASE_URL}/api/reel/generate',
            'method': 'POST',
            'response_status': response_status,
            'response_time': response_time,
            'response_body_keys': list(response_body.keys()) if isinstance(response_body, dict) else None
        }
        
        if response.get('error'):
            details['error'] = response['error']
            status = 'FAIL'
        
        log_test_result(test_name, status, details)
        return status == 'PASS'
    except Exception as e:
        log_test_result(test_name, 'FAIL', {'error': str(e)})
        return False


def run_all_tests():
    """运行所有测试"""
    print("="*60)
    print("开始执行 MCP Playwright 自动化测试")
    print("="*60)
    
    # 1. 基础测试（不需要认证）
    print("\n【阶段 1】基础测试（无需认证）")
    test_health_check()
    test_auth_missing()
    
    # 2. 获取 Firebase token
    print("\n【阶段 2】获取 Firebase Token")
    token = get_firebase_token_via_browser()
    
    if not token:
        print("❌ 无法获取 Firebase token，跳过需要认证的测试")
        generate_test_report()
        return
    
    print(f"✅ 成功获取 Firebase token (长度: {len(token)})")
    
    # 3. 创意总监 API 测试
    print("\n【阶段 3】创意总监 API 测试")
    creative_director_scenarios = [
        {
            'name': '创建新图片',
            'body': {
                'userPrompt': '一只可爱的小猫',
                'selectedModel': 'banana',
                'assets': {},
                'selectedAssetId': None,
                'lastGeneratedAssetId': None,
                'messages': [],
                'hasUploadedFiles': False
            },
            'expected_action': 'NEW_ASSET'
        },
        {
            'name': '编辑现有图片',
            'body': {
                'userPrompt': '把背景改成蓝色',
                'selectedModel': 'banana',
                'assets': {'img-1': {'type': 'image', 'id': 'img-1'}},
                'selectedAssetId': 'img-1',
                'lastGeneratedAssetId': 'img-1',
                'messages': [{'role': 'user', 'content': '一只小猫'}],
                'hasUploadedFiles': False
            },
            'expected_action': 'EDIT_ASSET'
        },
        {
            'name': '回答问题',
            'body': {
                'userPrompt': '你能做什么？',
                'selectedModel': 'banana',
                'assets': {},
                'selectedAssetId': None,
                'lastGeneratedAssetId': None,
                'messages': [],
                'hasUploadedFiles': False
            },
            'expected_action': 'ANSWER_QUESTION'
        }
    ]
    
    for scenario in creative_director_scenarios:
        test_creative_director_with_token(token, scenario)
        time.sleep(1)  # 避免请求过快
    
    # 4. 生成 API 测试（图片）
    print("\n【阶段 4】生成图片 API 测试")
    generate_image_scenarios = [
        {
            'name': '纯文本生成图片',
            'body': {
                'prompt': '一只可爱的小猫，坐在窗台上，阳光洒进来',
                'model': 'banana',
                'images': [],
                'aspectRatio': '9:16'
            }
        }
    ]
    
    for scenario in generate_image_scenarios:
        test_generate_with_token(token, scenario)
        time.sleep(2)  # 生成可能需要时间
    
    # 5. 其他 API 测试
    print("\n【阶段 5】其他 API 测试")
    # 可以继续添加其他 API 的测试...
    
    # 6. 生成测试报告
    print("\n【阶段 6】生成测试报告")
    generate_test_report()


def generate_test_report():
    """生成测试报告"""
    report = {
        'summary': {
            'total_tests': len(test_results),
            'passed': len([r for r in test_results if r['status'] == 'PASS']),
            'failed': len([r for r in test_results if r['status'] == 'FAIL']),
            'warnings': len([r for r in test_results if r['status'] == 'WARNING']),
            'pending': len([r for r in test_results if r['status'] == 'PENDING'])
        },
        'test_results': test_results,
        'timestamp': datetime.now().isoformat()
    }
    
    report_dir = os.path.dirname(__file__)
    report_path = os.path.join(report_dir, 'mcp_test_report.json')
    
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    # 生成 Markdown 报告
    md_report_path = os.path.join(report_dir, 'MCP_TEST_REPORT.md')
    with open(md_report_path, 'w', encoding='utf-8') as f:
        f.write("# MCP Playwright 自动化测试报告\n\n")
        f.write(f"生成时间: {report['timestamp']}\n\n")
        f.write("## 测试摘要\n\n")
        f.write(f"- 总测试数: {report['summary']['total_tests']}\n")
        f.write(f"- ✅ 通过: {report['summary']['passed']}\n")
        f.write(f"- ❌ 失败: {report['summary']['failed']}\n")
        f.write(f"- ⚠️ 警告: {report['summary']['warnings']}\n")
        f.write(f"- ⏳ 待执行: {report['summary']['pending']}\n\n")
        f.write("## 详细结果\n\n")
        
        for result in test_results:
            status_icon = {
                'PASS': '✅',
                'FAIL': '❌',
                'WARNING': '⚠️',
                'PENDING': '⏳'
            }.get(result['status'], '❓')
            
            f.write(f"### {status_icon} {result['test_name']}\n\n")
            f.write(f"- 状态: {result['status']}\n")
            f.write(f"- 时间: {result['timestamp']}\n")
            f.write(f"- 详情:\n")
            f.write(f"```json\n{json.dumps(result['details'], indent=2, ensure_ascii=False)}\n```\n\n")
    
    print(f"\n{'='*60}")
    print("测试报告已生成")
    print(f"JSON 报告: {report_path}")
    print(f"Markdown 报告: {md_report_path}")
    print(f"总测试数: {report['summary']['total_tests']}")
    print(f"✅ 通过: {report['summary']['passed']}")
    print(f"❌ 失败: {report['summary']['failed']}")
    print(f"⚠️ 警告: {report['summary']['warnings']}")
    print(f"⏳ 待执行: {report['summary']['pending']}")
    print(f"{'='*60}\n")
    
    return report


if __name__ == '__main__':
    print("\n注意：此脚本需要使用 MCP Playwright 工具来实际执行")
    print("当前版本只是定义了测试结构，实际执行需要使用 MCP 工具调用\n")
    
    # 实际执行时，应该调用 run_all_tests()
    # 但这里我们只打印说明
    print("请使用 MCP Playwright 工具来执行测试")
    print("参考 test/mcp_playwright_test_scenarios.md 查看测试场景定义")
