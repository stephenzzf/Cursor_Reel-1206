#!/bin/bash
# 修复 Cloud Run 服务账户访问 Secret 的权限问题

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# 配置
PROJECT_ID="ethereal-shine-436906-r5"
SECRET_NAME="firebase-credentials-json"
SERVICE_NAME="demo-reel"  # 根据错误信息中的服务名称

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}修复 Secret Manager 权限问题${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 获取项目号
echo -e "${YELLOW}1. 获取项目信息...${NC}"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
echo -e "${GREEN}✅ 项目号: $PROJECT_NUMBER${NC}"

# 获取 Cloud Run 服务账户
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo -e "${GREEN}✅ 服务账户: $SERVICE_ACCOUNT${NC}"
echo ""

# 检查 Secret 是否存在
echo -e "${YELLOW}2. 检查 Secret...${NC}"
if ! gcloud secrets describe $SECRET_NAME &>/dev/null; then
    echo -e "${RED}错误: Secret '$SECRET_NAME' 不存在${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Secret 存在: $SECRET_NAME${NC}"
echo ""

# 检查当前权限
echo -e "${YELLOW}3. 检查当前权限...${NC}"
gcloud secrets get-iam-policy $SECRET_NAME
echo ""

# 授予权限
echo -e "${YELLOW}4. 授予 Secret Manager Secret Accessor 权限...${NC}"
gcloud secrets add-iam-policy-binding $SECRET_NAME \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None

echo -e "${GREEN}✅ 权限已授予${NC}"
echo ""

# 验证权限
echo -e "${YELLOW}5. 验证权限...${NC}"
gcloud secrets get-iam-policy $SECRET_NAME \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:${SERVICE_ACCOUNT}"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ 权限修复完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${YELLOW}下一步:${NC}"
echo "1. 在 Cloud Run Console 中重新部署服务"
echo "2. 或运行: gcloud run services update $SERVICE_NAME --region us-central1"
echo ""
