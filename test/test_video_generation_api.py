"""
视频生成 API 集成测试脚本
测试图生视频和首尾帧生视频功能
"""

import requests
import base64
import json
import sys
import time

# 配置
BASE_URL = "http://localhost:8787"
# 注意：需要有效的 Firebase Token
FIREBASE_TOKEN = None  # 需要手动设置或从环境变量获取

# 测试图片（1x1 像素的红色 PNG）
TEST_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="


def test_health_check():
    """测试健康检查端点"""
    print("\n" + "="*60)
    print("测试 1: 健康检查")
    print("="*60)
    
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.json()}")
        
        if response.status_code == 200:
            print("✅ 健康检查通过")
            return True
        else:
            print("❌ 健康检查失败")
            return False
    except Exception as e:
        print(f"❌ 健康检查异常: {e}")
        return False


def test_text_to_video():
    """测试文生视频（验证现有功能不受影响）"""
    print("\n" + "="*60)
    print("测试 2: 文生视频（无图片输入）")
    print("="*60)
    
    if not FIREBASE_TOKEN:
        print("⚠️ 跳过：需要 Firebase Token")
        return None
    
    url = f"{BASE_URL}/api/reel/generate"
    headers = {
        "Authorization": f"Bearer {FIREBASE_TOKEN}",
        "Content-Type": "application/json"
    }
    data = {
        "prompt": "一个美丽的风景视频，缓慢移动的镜头",
        "model": "veo_fast",
        "images": [],
        "aspectRatio": "9:16"
    }
    
    try:
        print("发送请求...")
        print(f"Prompt: {data['prompt']}")
        response = requests.post(url, headers=headers, json=data, timeout=300)
        
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"✅ 文生视频成功")
            print(f"   Asset ID: {result.get('assetId')}")
            print(f"   Type: {result.get('type')}")
            print(f"   视频 URI: {result.get('src', '')[:100]}...")
            return True
        else:
            print(f"❌ 文生视频失败")
            print(f"   错误: {response.text[:200]}")
            return False
    except Exception as e:
        print(f"❌ 文生视频异常: {e}")
        return False


def test_image_to_video():
    """测试图生视频（单张图片）"""
    print("\n" + "="*60)
    print("测试 3: 图生视频（单张图片）")
    print("="*60)
    
    if not FIREBASE_TOKEN:
        print("⚠️ 跳过：需要 Firebase Token")
        return None
    
    url = f"{BASE_URL}/api/reel/generate"
    headers = {
        "Authorization": f"Bearer {FIREBASE_TOKEN}",
        "Content-Type": "application/json"
    }
    data = {
        "prompt": "基于这张图片生成一个动态视频",
        "model": "veo_fast",
        "images": [
            {
                "data": TEST_PNG_BASE64,
                "mimeType": "image/png"
            }
        ],
        "aspectRatio": "9:16"
    }
    
    try:
        print("发送请求...")
        print(f"Prompt: {data['prompt']}")
        print(f"图片数量: {len(data['images'])}")
        print(f"图片大小: {len(TEST_PNG_BASE64)} bytes (base64)")
        
        response = requests.post(url, headers=headers, json=data, timeout=300)
        
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"✅ 图生视频成功")
            print(f"   Asset ID: {result.get('assetId')}")
            print(f"   Type: {result.get('type')}")
            print(f"   视频 URI: {result.get('src', '')[:100]}...")
            return True
        else:
            print(f"❌ 图生视频失败")
            print(f"   错误: {response.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ 图生视频异常: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_first_last_frame_video():
    """测试首尾帧生视频（两张图片）"""
    print("\n" + "="*60)
    print("测试 4: 首尾帧生视频（两张图片）")
    print("="*60)
    
    if not FIREBASE_TOKEN:
        print("⚠️ 跳过：需要 Firebase Token")
        return None
    
    url = f"{BASE_URL}/api/reel/generate"
    headers = {
        "Authorization": f"Bearer {FIREBASE_TOKEN}",
        "Content-Type": "application/json"
    }
    data = {
        "prompt": "从第一张图片平滑过渡到第二张图片",
        "model": "veo_fast",
        "images": [
            {
                "data": TEST_PNG_BASE64,
                "mimeType": "image/png"
            },
            {
                "data": TEST_PNG_BASE64,  # 使用同一张图片作为测试
                "mimeType": "image/png"
            }
        ],
        "aspectRatio": "9:16"
    }
    
    try:
        print("发送请求...")
        print(f"Prompt: {data['prompt']}")
        print(f"图片数量: {len(data['images'])}")
        
        response = requests.post(url, headers=headers, json=data, timeout=300)
        
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            result = response.json()
            print(f"✅ 首尾帧生视频成功")
            print(f"   Asset ID: {result.get('assetId')}")
            print(f"   Type: {result.get('type')}")
            print(f"   视频 URI: {result.get('src', '')[:100]}...")
            return True
        else:
            print(f"❌ 首尾帧生视频失败")
            print(f"   错误: {response.text[:500]}")
            return False
    except Exception as e:
        print(f"❌ 首尾帧生视频异常: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """运行所有测试"""
    print("\n" + "="*60)
    print("视频生成 API 集成测试")
    print("="*60)
    print(f"后端 URL: {BASE_URL}")
    print(f"Firebase Token: {'已设置' if FIREBASE_TOKEN else '未设置（部分测试将跳过）'}")
    
    results = {}
    
    # 测试 1: 健康检查
    results['health'] = test_health_check()
    
    # 测试 2: 文生视频
    results['text_to_video'] = test_text_to_video()
    
    # 测试 3: 图生视频
    results['image_to_video'] = test_image_to_video()
    
    # 测试 4: 首尾帧生视频
    results['first_last_frame'] = test_first_last_frame_video()
    
    # 总结
    print("\n" + "="*60)
    print("测试总结")
    print("="*60)
    for test_name, result in results.items():
        status = "✅ 通过" if result else ("❌ 失败" if result is False else "⏭️  跳过")
        print(f"{test_name}: {status}")
    print("="*60 + "\n")
    
    # 返回退出码
    failed_count = sum(1 for r in results.values() if r is False)
    if failed_count > 0:
        return 1
    return 0


if __name__ == "__main__":
    # 从环境变量或命令行参数获取 Token
    import os
    FIREBASE_TOKEN = os.getenv('FIREBASE_TOKEN') or (sys.argv[1] if len(sys.argv) > 1 else None)
    
    exit(main())
