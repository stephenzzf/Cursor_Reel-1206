#!/bin/bash

# 自动化测试脚本
# 测试前后端服务和 API 端点

echo "=========================================="
echo "自动化测试脚本"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数
PASSED=0
FAILED=0

# 测试函数
test_endpoint() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    local expected_status=${4:-200}
    local data=$5
    
    echo -n "测试: $name ... "
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $http_code)"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (期望: HTTP $expected_status, 实际: HTTP $http_code)"
        echo "  响应: $body"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# 1. 测试后端健康检查
echo "1. 测试后端服务..."
test_endpoint "后端健康检查" "http://localhost:8787/health" "GET" "200"

# 2. 测试 API 端点（无认证，应返回 401）
echo ""
echo "2. 测试 API 端点（无认证）..."
test_endpoint "创意总监端点（无认证）" \
    "http://localhost:8787/api/reel/creative-director" \
    "POST" "401" \
    '{"userPrompt":"test","selectedModel":"banana","assets":{},"selectedAssetId":null,"lastGeneratedAssetId":null,"messages":[],"hasUploadedFiles":false}'

test_endpoint "生成端点（无认证）" \
    "http://localhost:8787/api/reel/generate" \
    "POST" "401" \
    '{"prompt":"test","model":"banana","images":[],"aspectRatio":"9:16"}'

test_endpoint "提示词优化端点（无认证）" \
    "http://localhost:8787/api/reel/enhance-prompt" \
    "POST" "401" \
    '{"prompt":"test","model":"banana"}'

# 3. 检查前端服务
echo ""
echo "3. 测试前端服务..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "前端服务: ${GREEN}✅ 运行中${NC} (http://localhost:3000)"
    PASSED=$((PASSED + 1))
else
    echo -e "前端服务: ${RED}❌ 未运行${NC}"
    FAILED=$((FAILED + 1))
fi

# 4. 检查后端日志
echo ""
echo "4. 检查后端日志..."
if [ -f /tmp/backend.log ]; then
    log_size=$(wc -l < /tmp/backend.log)
    echo "   日志文件: /tmp/backend.log ($log_size 行)"
    
    # 检查最近的错误
    recent_errors=$(tail -50 /tmp/backend.log | grep -i "error\|exception\|failed" | wc -l)
    if [ "$recent_errors" -gt 0 ]; then
        echo -e "   ${YELLOW}⚠️  发现 $recent_errors 个错误/异常${NC}"
    else
        echo -e "   ${GREEN}✅ 无错误${NC}"
    fi
    PASSED=$((PASSED + 1))
else
    echo -e "   ${RED}❌ 日志文件不存在${NC}"
    FAILED=$((FAILED + 1))
fi

# 5. 检查进程
echo ""
echo "5. 检查服务进程..."
backend_pid=$(lsof -ti:8787 2>/dev/null)
frontend_pid=$(lsof -ti:3000 2>/dev/null)

if [ -n "$backend_pid" ]; then
    echo -e "   后端进程: ${GREEN}✅ 运行中${NC} (PID: $backend_pid)"
    PASSED=$((PASSED + 1))
else
    echo -e "   后端进程: ${RED}❌ 未运行${NC}"
    FAILED=$((FAILED + 1))
fi

if [ -n "$frontend_pid" ]; then
    echo -e "   前端进程: ${GREEN}✅ 运行中${NC} (PID: $frontend_pid)"
    PASSED=$((PASSED + 1))
else
    echo -e "   前端进程: ${RED}❌ 未运行${NC}"
    FAILED=$((FAILED + 1))
fi

# 总结
echo ""
echo "=========================================="
echo "测试总结"
echo "=========================================="
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ 所有测试通过！${NC}"
    exit 0
else
    echo -e "${RED}❌ 部分测试失败${NC}"
    exit 1
fi

