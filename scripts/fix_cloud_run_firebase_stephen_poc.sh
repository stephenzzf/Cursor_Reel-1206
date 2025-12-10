#!/bin/bash
# 修复 Cloud Run 服务的 Firebase 配置
# 针对 demo-reel 服务在 stephen-poc 项目中

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置（stephen-poc 项目）
PROJECT_ID="stephen-poc"
SERVICE_NAME="demo-reel"
REGION="asia-east1"
SECRET_NAME="firebase-credentials-json"
CREDENTIALS_FILE="backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}修复 Cloud Run Firebase 配置${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}项目: ${PROJECT_ID} (项目号: 518510771526)${NC}"
echo -e "${YELLOW}服务: ${SERVICE_NAME}${NC}"
echo -e "${YELLOW}区域: ${REGION}${NC}"
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
echo -e "  - FIREBASE_STORAGE_BUCKET=ethereal-shine-436906-r5.appspot.com"
echo ""

# 检查服务是否存在
if ! gcloud run services describe $SERVICE_NAME --region $REGION &>/dev/null; then
    echo -e "${RED}❌ 错误: 找不到服务 ${SERVICE_NAME} 在区域 ${REGION}${NC}"
    echo -e "${YELLOW}请检查服务名称和区域是否正确${NC}"
    echo ""
    echo -e "${YELLOW}可用服务列表:${NC}"
    gcloud run services list --region $REGION
    exit 1
fi

# 更新服务
echo -e "${YELLOW}正在更新服务...${NC}"
if gcloud run services update $SERVICE_NAME \
  --region $REGION \
  --update-secrets FIREBASE_CREDENTIALS_JSON=$SECRET_NAME:latest \
  --set-env-vars FIREBASE_STORAGE_BUCKET=ethereal-shine-436906-r5.appspot.com \
  2>&1; then
    echo -e "${GREEN}✅ 服务配置已更新${NC}"
else
    echo -e "${RED}❌ 更新服务失败${NC}"
    echo -e "${YELLOW}请尝试手动在 GCP Console 中配置${NC}"
    echo -e "${BLUE}Console URL: https://console.cloud.google.com/run?project=${PROJECT_ID}${NC}"
    exit 1
fi
echo ""

# 等待服务更新
echo -e "${YELLOW}5. 等待服务更新完成...${NC}"
sleep 5

# 显示服务信息
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format="value(status.url)")
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ 配置完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}服务 URL: ${SERVICE_URL}${NC}"
echo ""
echo -e "${YELLOW}下一步：${NC}"
echo -e "1. 查看服务日志验证 Firebase 初始化："
echo -e "   ${GREEN}gcloud run services logs tail ${SERVICE_NAME} --region ${REGION} --limit 50${NC}"
echo ""
echo -e "2. 测试健康检查："
echo -e "   ${GREEN}curl ${SERVICE_URL}/health${NC}"
echo ""
echo -e "3. 查看详细日志："
echo -e "   ${GREEN}gcloud run services logs read ${SERVICE_NAME} --region ${REGION} --limit 100 | grep -i firebase${NC}"
echo ""
