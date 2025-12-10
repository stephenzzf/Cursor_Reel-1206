#!/bin/bash
# 修复 Cloud Run 服务的 Firebase 配置
# 针对 demo-reel 服务在 asia-east1 区域

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 配置
PROJECT_ID="ethereal-shine-436906-r5"
SERVICE_NAME="demo-reel"
REGION="asia-east1"
SECRET_NAME="firebase-credentials-json"
CREDENTIALS_FILE="backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}修复 Cloud Run Firebase 配置${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}服务: ${SERVICE_NAME}${NC}"
echo -e "${YELLOW}区域: ${REGION}${NC}"
echo -e "${YELLOW}项目: ${PROJECT_ID}${NC}"
echo ""

# 设置项目
echo -e "${YELLOW}1. 设置 GCP 项目...${NC}"
gcloud config set project $PROJECT_ID
echo -e "${GREEN}✅ 项目已设置为: ${PROJECT_ID}${NC}"
echo ""

# 检查凭证文件
if [ ! -f "$CREDENTIALS_FILE" ]; then
    echo -e "${RED}❌ 错误: 找不到凭证文件: ${CREDENTIALS_FILE}${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 凭证文件存在${NC}"
echo ""

# 检查/创建 Secret
echo -e "${YELLOW}2. 检查 Secret Manager...${NC}"
if gcloud secrets describe $SECRET_NAME &>/dev/null; then
    echo -e "${YELLOW}Secret 已存在，添加新版本...${NC}"
    gcloud secrets versions add $SECRET_NAME --data-file="$CREDENTIALS_FILE"
    echo -e "${GREEN}✅ Secret 版本已更新${NC}"
else
    echo -e "${YELLOW}创建新 Secret...${NC}"
    gcloud secrets create $SECRET_NAME \
      --data-file="$CREDENTIALS_FILE" \
      --replication-policy="automatic"
    echo -e "${GREEN}✅ Secret 已创建${NC}"
fi
echo ""

# 授予权限
echo -e "${YELLOW}3. 授予 Secret Manager 访问权限...${NC}"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo -e "${YELLOW}服务账户: ${SERVICE_ACCOUNT}${NC}"

gcloud secrets add-iam-policy-binding $SECRET_NAME \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet
echo -e "${GREEN}✅ 权限已授予${NC}"
echo ""

# 更新 Cloud Run 服务
echo -e "${YELLOW}4. 更新 Cloud Run 服务配置...${NC}"
echo -e "${YELLOW}这将配置以下环境变量：${NC}"
echo -e "  - FIREBASE_CREDENTIALS_JSON (从 Secret Manager)"
echo -e "  - FIREBASE_STORAGE_BUCKET=${PROJECT_ID}.appspot.com"
echo ""

# 尝试更新服务
if gcloud run services update $SERVICE_NAME \
  --region $REGION \
  --update-secrets FIREBASE_CREDENTIALS_JSON=$SECRET_NAME:latest \
  --set-env-vars FIREBASE_STORAGE_BUCKET=${PROJECT_ID}.appspot.com \
  2>&1; then
    echo -e "${GREEN}✅ 服务配置已更新${NC}"
else
    echo -e "${RED}❌ 更新服务失败，可能的原因：${NC}"
    echo -e "  1. 服务不存在或名称不正确"
    echo -e "  2. 权限不足"
    echo -e "  3. 区域不正确"
    echo ""
    echo -e "${YELLOW}请手动在 GCP Console 中配置：${NC}"
    echo -e "1. 访问: https://console.cloud.google.com/run?project=${PROJECT_ID}"
    echo -e "2. 选择服务: ${SERVICE_NAME}"
    echo -e "3. 点击 'EDIT & DEPLOY NEW REVISION'"
    echo -e "4. 在 'Variables & Secrets' 部分："
    echo -e "   - 点击 'REFERENCE A SECRET'"
    echo -e "   - Secret: ${SECRET_NAME}"
    echo -e "   - Version: latest"
    echo -e "   - Variable name: FIREBASE_CREDENTIALS_JSON"
    echo -e "5. 添加环境变量："
    echo -e "   - Name: FIREBASE_STORAGE_BUCKET"
    echo -e "   - Value: ${PROJECT_ID}.appspot.com"
    echo -e "6. 点击 'DEPLOY'"
    exit 1
fi
echo ""

# 验证
echo -e "${YELLOW}5. 等待服务更新完成...${NC}"
sleep 5

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ 配置完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}下一步：${NC}"
echo -e "1. 查看服务日志验证 Firebase 初始化："
echo -e "   ${GREEN}gcloud run services logs tail ${SERVICE_NAME} --region ${REGION}${NC}"
echo ""
echo -e "2. 测试服务："
echo -e "   ${GREEN}curl https://${SERVICE_NAME}-${PROJECT_NUMBER}.${REGION}.run.app/health${NC}"
echo ""
echo -e "3. 如果仍有错误，检查日志中的 Firebase 初始化消息"
echo ""
