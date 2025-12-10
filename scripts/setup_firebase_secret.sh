#!/bin/bash
# 设置 Firebase 凭证到 Google Cloud Secret Manager
# 用于 Cloud Run 部署

set -e  # 遇到错误立即退出

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 配置
PROJECT_ID="ethereal-shine-436906-r5"
SECRET_NAME="firebase-credentials-json"
CREDENTIALS_FILE="backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json"
SERVICE_NAME="ais-reel"
REGION="us-central1"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Firebase 凭证 Secret Manager 设置脚本${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# 检查文件是否存在
if [ ! -f "$CREDENTIALS_FILE" ]; then
    echo -e "${RED}错误: 找不到凭证文件: $CREDENTIALS_FILE${NC}"
    echo -e "${RED}当前目录: $(pwd)${NC}"
    echo -e "${RED}请确保在项目根目录运行此脚本${NC}"
    exit 1
fi

# 检查文件是否为空
if [ ! -s "$CREDENTIALS_FILE" ]; then
    echo -e "${RED}错误: 凭证文件为空: $CREDENTIALS_FILE${NC}"
    exit 1
fi

# 验证 JSON 格式
if ! python3 -m json.tool "$CREDENTIALS_FILE" > /dev/null 2>&1; then
    echo -e "${RED}错误: 凭证文件不是有效的 JSON 格式: $CREDENTIALS_FILE${NC}"
    exit 1
fi

# 设置项目
echo -e "${YELLOW}1. 设置 GCP 项目...${NC}"
gcloud config set project $PROJECT_ID
echo -e "${GREEN}✅ 项目已设置为: $PROJECT_ID${NC}"
echo ""

# 检查 Secret 是否已存在
echo -e "${YELLOW}2. 检查 Secret 是否已存在...${NC}"
if gcloud secrets describe $SECRET_NAME &>/dev/null; then
    echo -e "${YELLOW}Secret 已存在，将添加新版本...${NC}"
    # 添加新版本（使用临时文件更可靠）
    gcloud secrets versions add $SECRET_NAME --data-file="$CREDENTIALS_FILE"
    echo -e "${GREEN}✅ Secret 版本已更新${NC}"
else
    echo -e "${YELLOW}创建新 Secret...${NC}"
    # 创建新 Secret（直接使用文件路径）
    gcloud secrets create $SECRET_NAME \
      --data-file="$CREDENTIALS_FILE" \
      --replication-policy="automatic"
    echo -e "${GREEN}✅ Secret 已创建${NC}"
fi
echo ""

# 获取服务账户
echo -e "${YELLOW}3. 获取 Cloud Run 服务账户...${NC}"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
SERVICE_ACCOUNT="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
echo -e "${GREEN}✅ 服务账户: $SERVICE_ACCOUNT${NC}"
echo ""

# 授予权限
echo -e "${YELLOW}4. 授予 Secret Manager 访问权限...${NC}"
gcloud secrets add-iam-policy-binding $SECRET_NAME \
  --member="serviceAccount:${SERVICE_ACCOUNT}" \
  --role="roles/secretmanager.secretAccessor" \
  --quiet
echo -e "${GREEN}✅ 权限已授予${NC}"
echo ""

# 检查 Cloud Run 服务是否存在
echo -e "${YELLOW}5. 检查 Cloud Run 服务...${NC}"
if gcloud run services describe $SERVICE_NAME --region $REGION &>/dev/null; then
    echo -e "${YELLOW}服务已存在，更新配置...${NC}"
    # 更新服务以使用 Secret
    gcloud run services update $SERVICE_NAME \
      --region $REGION \
      --update-secrets FIREBASE_CREDENTIALS_JSON=$SECRET_NAME:latest \
      --set-env-vars FIREBASE_STORAGE_BUCKET=ethereal-shine-436906-r5.appspot.com \
      --quiet
    echo -e "${GREEN}✅ 服务配置已更新${NC}"
else
    echo -e "${YELLOW}服务不存在，请先创建服务${NC}"
    echo -e "${YELLOW}创建服务后，运行以下命令：${NC}"
    echo ""
    echo "gcloud run services update $SERVICE_NAME \\"
    echo "  --region $REGION \\"
    echo "  --update-secrets FIREBASE_CREDENTIALS_JSON=$SECRET_NAME:latest \\"
    echo "  --set-env-vars FIREBASE_STORAGE_BUCKET=ethereal-shine-436906-r5.appspot.com"
    echo ""
fi
echo ""

# 验证
echo -e "${YELLOW}6. 验证配置...${NC}"
echo -e "${GREEN}✅ Secret 名称: $SECRET_NAME${NC}"
echo -e "${GREEN}✅ 服务账户: $SERVICE_ACCOUNT${NC}"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Firebase 凭证配置完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "下一步："
echo "1. 如果服务已存在，配置已自动更新"
echo "2. 如果服务不存在，请先创建 Cloud Run 服务"
echo "3. 查看服务日志验证 Firebase 初始化："
echo "   gcloud run services logs tail $SERVICE_NAME --region $REGION"
echo ""
