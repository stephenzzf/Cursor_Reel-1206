#!/usr/bin/env python3
"""
快速测试脚本：验证后端服务是否正常启动
"""

import sys
import os

# 添加当前目录到路径
sys.path.insert(0, os.path.dirname(__file__))

def test_imports():
    """测试所有模块是否能正常导入"""
    print("=" * 60)
    print("测试模块导入...")
    print("=" * 60)
    
    try:
        from app import app
        print("✅ app.py 导入成功")
    except Exception as e:
        print(f"❌ app.py 导入失败: {e}")
        return False
    
    try:
        from routes.reel import reel_bp
        print("✅ routes.reel 导入成功")
    except Exception as e:
        print(f"❌ routes.reel 导入失败: {e}")
        return False
    
    try:
        from services.gemini_service import get_gemini_service
        print("✅ services.gemini_service 导入成功")
    except Exception as e:
        print(f"❌ services.gemini_service 导入失败: {e}")
        return False
    
    try:
        from utils.auth import verify_firebase_token
        print("✅ utils.auth 导入成功")
    except Exception as e:
        print(f"❌ utils.auth 导入失败: {e}")
        return False
    
    return True


def test_gemini_service():
    """测试 Gemini 服务初始化"""
    print("\n" + "=" * 60)
    print("测试 Gemini 服务...")
    print("=" * 60)
    
    try:
        from services.gemini_service import get_gemini_service
        service = get_gemini_service()
        print("✅ Gemini 服务初始化成功")
        return True
    except ValueError as e:
        print(f"⚠️  Gemini 服务初始化失败（可能是 API Key 未设置）: {e}")
        print("   请检查 .env 文件中的 GEMINI_API_KEY")
        return False
    except Exception as e:
        print(f"❌ Gemini 服务初始化失败: {e}")
        return False


def test_flask_app():
    """测试 Flask 应用"""
    print("\n" + "=" * 60)
    print("测试 Flask 应用...")
    print("=" * 60)
    
    try:
        from app import app
        
        # 测试健康检查端点
        with app.test_client() as client:
            response = client.get('/health')
            if response.status_code == 200:
                print("✅ /health 端点正常")
                data = response.get_json()
                print(f"   响应: {data}")
            else:
                print(f"❌ /health 端点返回状态码: {response.status_code}")
                return False
            
            # 测试 API 端点（应该返回 401，因为没有认证）
            response = client.post('/api/reel/creative-director', 
                                 json={'userPrompt': 'test'})
            if response.status_code == 401:
                print("✅ /api/reel/creative-director 端点正常（需要认证）")
            else:
                print(f"⚠️  /api/reel/creative-director 返回状态码: {response.status_code}")
        
        return True
    except Exception as e:
        print(f"❌ Flask 应用测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_environment():
    """测试环境变量"""
    print("\n" + "=" * 60)
    print("测试环境变量...")
    print("=" * 60)
    
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    
    if os.path.exists(env_path):
        print(f"✅ .env 文件存在: {env_path}")
        load_dotenv(env_path)
    else:
        print(f"⚠️  .env 文件不存在: {env_path}")
        load_dotenv()
    
    gemini_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
    if gemini_key:
        print(f"✅ GEMINI_API_KEY 已设置 (长度: {len(gemini_key)})")
    else:
        print("❌ GEMINI_API_KEY 未设置")
    
    firebase_creds = os.getenv('FIREBASE_CREDENTIALS_PATH') or os.getenv('FIREBASE_CREDENTIALS_JSON')
    if firebase_creds:
        print(f"✅ Firebase 凭证已配置")
    else:
        print("⚠️  Firebase 凭证未配置（Auth 验证将失败）")
    
    return True


if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("后端服务测试")
    print("=" * 60 + "\n")
    
    all_passed = True
    
    # 测试环境变量
    all_passed = test_environment() and all_passed
    
    # 测试模块导入
    all_passed = test_imports() and all_passed
    
    # 测试 Gemini 服务
    all_passed = test_gemini_service() and all_passed
    
    # 测试 Flask 应用
    all_passed = test_flask_app() and all_passed
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ 所有基础测试通过！")
        print("\n下一步：")
        print("1. 启动后端: cd backend && python app.py")
        print("2. 启动前端: cd frontend && npm run dev")
        print("3. 访问 http://localhost:3000 进行完整测试")
    else:
        print("⚠️  部分测试未通过，请检查上述错误信息")
    print("=" * 60 + "\n")

