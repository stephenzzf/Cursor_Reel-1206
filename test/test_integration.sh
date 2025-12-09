#!/bin/bash

# 集成测试脚本
# 快速验证后端和前端配置

echo "=========================================="
echo "集成测试脚本"
echo "=========================================="
echo ""

# 检查后端服务
echo "1. 检查后端服务..."
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/health)
if [ "$BACKEND_STATUS" = "200" ]; then
    echo "   ✅ 后端服务运行正常 (http://localhost:8787)"
else
    echo "   ❌ 后端服务未运行或无法访问"
    echo "   请运行: cd backend && python app.py"
    exit 1
fi

# 检查前端依赖
echo ""
echo "2. 检查前端依赖..."
if [ -d "frontend/node_modules" ]; then
    echo "   ✅ 前端依赖已安装"
else
    echo "   ⚠️  前端依赖未安装"
    echo "   请运行: cd frontend && npm install"
fi

# 检查环境变量
echo ""
echo "3. 检查后端环境变量..."
if [ -f "backend/.env" ]; then
    echo "   ✅ backend/.env 文件存在"
    
    # 检查关键变量（不显示值）
    if grep -q "GEMINI_API_KEY" backend/.env; then
        echo "   ✅ GEMINI_API_KEY 已设置"
    else
        echo "   ⚠️  GEMINI_API_KEY 未设置"
    fi
    
    if grep -q "FIREBASE" backend/.env; then
        echo "   ✅ Firebase 配置已设置"
    else
        echo "   ⚠️  Firebase 配置未设置（Auth 验证将失败）"
    fi
else
    echo "   ❌ backend/.env 文件不存在"
fi

# 测试 API 端点（无认证）
echo ""
echo "4. 测试 API 端点（无认证，应返回 401）..."
API_TEST=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8787/api/reel/creative-director \
  -H "Content-Type: application/json" \
  -d '{"userPrompt": "test"}')
if [ "$API_TEST" = "401" ]; then
    echo "   ✅ API 端点正常（需要认证）"
else
    echo "   ⚠️  API 端点返回状态码: $API_TEST"
fi

echo ""
echo "=========================================="
echo "测试完成！"
echo "=========================================="
echo ""
echo "下一步："
echo "1. 启动前端: cd frontend && npm run dev"
echo "2. 访问 http://localhost:3000"
echo "3. 登录并验证自动跳转到 Reel 页面"
echo "4. 测试 Reel 生成功能"
echo ""

