#!/bin/bash
# 更新 Cloud Run 服务配置，添加 Firebase 凭证和其他环境变量
# 用于在脚本运行后快速更新服务配置

set -e  # 遇到错误立即退出

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
PROJECT_ID="ethereal-shine-436906-r5"
SERVICE_NAME="ais-reel"
REGION="us-central1"
SECRET_NAME="firebase-credentials-json"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Cloud Run 服务配置更新脚本${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 检查服务是否存在
echo -e "${YELLOW}检查 Cloud Run 服务...${NC}"
if ! gcloud run services describe $SERVICE_NAME --region $REGION &>/dev/null; then
    echo -e "${YELLOW}服务 '$SERVICE_NAME' 不存在，将创建新服务...${NC}"
    echo ""
    read -p "请输入 Gemini API Key (必需): " GEMINI_KEY
    if [ -z "$GEMINI_KEY" ]; then
        echo -e "${RED}错误: Gemini API Key 是必需的${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}从源代码创建服务（这将需要几分钟）...${NC}"
    gcloud run deploy $SERVICE_NAME \
      --source . \
      --region $REGION \
      --platform managed \
      --allow-unauthenticated \
      --update-secrets FIREBASE_CREDENTIALS_JSON=$SECRET_NAME:latest \
      --set-env-vars \
        FIREBASE_STORAGE_BUCKET=ethereal-shine-436906-r5.appspot.com,\
        PORT=8080,\
        FLASK_DEBUG=false,\
        GEMINI_API_KEY="$GEMINI_KEY" \
      --memory 1Gi \
      --cpu 1 \
      --timeout 600 \
      --max-instances 10 \
      --min-instances 0
    
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}✅ 服务已创建并配置完成！${NC}"
    echo -e "${GREEN}========================================${NC}"
    
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)")
    echo -e "服务 URL: ${GREEN}$SERVICE_URL${NC}"
    echo ""
    echo -e "${YELLOW}下一步:${NC}"
    echo "1. 查看服务日志: gcloud run services logs tail $SERVICE_NAME --region $REGION"
    echo "2. 测试健康检查: curl $SERVICE_URL/health"
    exit 0
fi
echo -e "${GREEN}✅ 服务存在: $SERVICE_NAME${NC}"
echo ""

# 检查 Secret 是否存在
echo -e "${YELLOW}检查 Secret Manager Secret...${NC}"
if ! gcloud secrets describe $SECRET_NAME &>/dev/null; then
    echo -e "${RED}错误: Secret '$SECRET_NAME' 不存在${NC}"
    echo -e "${YELLOW}请先运行: ./scripts/setup_firebase_secret.sh${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Secret 存在: $SECRET_NAME${NC}"
echo ""

# 提示用户输入 Gemini API Key
echo -e "${YELLOW}配置 Gemini API Key...${NC}"
read -p "请输入 Gemini API Key (或按 Enter 跳过，稍后手动配置): " GEMINI_KEY

# 构建更新命令
UPDATE_CMD="gcloud run services update $SERVICE_NAME --region $REGION"

# 添加 Secret 引用
UPDATE_CMD="$UPDATE_CMD --update-secrets FIREBASE_CREDENTIALS_JSON=$SECRET_NAME:latest"

# 添加环境变量
ENV_VARS="FIREBASE_STORAGE_BUCKET=ethereal-shine-436906-r5.appspot.com,PORT=8080,FLASK_DEBUG=false"

# 如果提供了 Gemini API Key，添加到环境变量
if [ -n "$GEMINI_KEY" ]; then
    ENV_VARS="$ENV_VARS,GEMINI_API_KEY=$GEMINI_KEY"
    echo -e "${GREEN}✅ 将添加 GEMINI_API_KEY 环境变量${NC}"
else
    echo -e "${YELLOW}⚠️  跳过 GEMINI_API_KEY，请稍后手动配置${NC}"
fi

UPDATE_CMD="$UPDATE_CMD --set-env-vars $ENV_VARS"

# 显示将要执行的命令
echo ""
echo -e "${BLUE}将要执行的命令:${NC}"
echo "$UPDATE_CMD"
echo ""

# 确认
read -p "是否继续? (y/N): " CONFIRM
if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}已取消${NC}"
    exit 0
fi

# 执行更新
echo ""
echo -e "${YELLOW}更新服务配置...${NC}"
eval $UPDATE_CMD

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ 服务配置已更新！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 显示服务信息
echo -e "${BLUE}服务信息:${NC}"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)")
echo -e "服务 URL: ${GREEN}$SERVICE_URL${NC}"
echo ""

# 显示环境变量
echo -e "${BLUE}当前环境变量配置:${NC}"
gcloud run services describe $SERVICE_NAME --region $REGION \
  --format="table(spec.template.spec.containers[0].env[].name,spec.template.spec.containers[0].env[].value,spec.template.spec.containers[0].env[].valueFrom.secretKeyRef.name)"

echo ""
echo -e "${YELLOW}下一步:${NC}"
echo "1. 查看服务日志: gcloud run services logs tail $SERVICE_NAME --region $REGION"
echo "2. 测试健康检查: curl $SERVICE_URL/health"
echo "3. 访问服务: $SERVICE_URL"
echo ""
