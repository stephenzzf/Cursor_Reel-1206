# 脚本修复说明

## 🐛 修复的问题

### 问题: `--data-file is the empty string` 错误

**错误信息**:
```
ERROR: (gcloud.secrets.create) The value provided for --data-file is the empty string.
```

**原因**:
- 原脚本使用管道方式 `cat file | gcloud ... --data-file=-`
- 在某些情况下，管道可能无法正确传递数据
- `--data-file=-` 表示从标准输入读取，但可能在某些 shell 环境中不工作

**修复方案**:
- ✅ 改为直接使用文件路径: `--data-file="$CREDENTIALS_FILE"`
- ✅ 添加文件验证（检查文件是否存在、是否为空、JSON 格式是否有效）
- ✅ 改进错误提示信息

## 🔧 修复内容

### 1. 改进文件验证

```bash
# 检查文件是否存在
if [ ! -f "$CREDENTIALS_FILE" ]; then
    echo -e "${RED}错误: 找不到凭证文件: $CREDENTIALS_FILE${NC}"
    echo -e "${RED}当前目录: $(pwd)${NC}"
    exit 1
fi

# 检查文件是否为空
if [ ! -s "$CREDENTIALS_FILE" ]; then
    echo -e "${RED}错误: 凭证文件为空${NC}"
    exit 1
fi

# 验证 JSON 格式
if ! python3 -m json.tool "$CREDENTIALS_FILE" > /dev/null 2>&1; then
    echo -e "${RED}错误: 凭证文件不是有效的 JSON 格式${NC}"
    exit 1
fi
```

### 2. 修复 Secret 创建命令

**修复前**:
```bash
cat $CREDENTIALS_FILE | gcloud secrets create $SECRET_NAME --data-file= --replication-policy="automatic"
```

**修复后**:
```bash
gcloud secrets create $SECRET_NAME \
  --data-file="$CREDENTIALS_FILE" \
  --replication-policy="automatic"
```

### 3. 修复 Secret 版本添加命令

**修复前**:
```bash
cat $CREDENTIALS_FILE | gcloud secrets versions add $SECRET_NAME --data-file=-
```

**修复后**:
```bash
gcloud secrets versions add $SECRET_NAME --data-file="$CREDENTIALS_FILE"
```

## ✅ 验证修复

运行以下命令验证脚本：

```bash
# 1. 检查文件存在
test -f backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json && echo "✅ 文件存在"

# 2. 检查文件不为空
test -s backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json && echo "✅ 文件不为空"

# 3. 验证 JSON 格式
python3 -m json.tool backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json > /dev/null && echo "✅ JSON 格式有效"

# 4. 运行脚本
./scripts/setup_firebase_secret.sh
```

## 📝 使用说明

修复后的脚本现在：

1. ✅ 在运行前验证文件存在、不为空、JSON 格式有效
2. ✅ 直接使用文件路径而不是管道，更可靠
3. ✅ 提供更清晰的错误信息
4. ✅ 显示当前工作目录，便于调试

## 🔄 如果仍然遇到问题

### 手动创建 Secret

如果脚本仍然失败，可以手动执行：

```bash
# 设置项目
gcloud config set project ethereal-shine-436906-r5

# 创建 Secret（使用文件路径）
gcloud secrets create firebase-credentials-json \
  --data-file=backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json \
  --replication-policy="automatic"

# 或更新现有 Secret
gcloud secrets versions add firebase-credentials-json \
  --data-file=backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json
```

### 检查 gcloud 版本

```bash
gcloud version
# 确保版本 >= 300.0.0
```

### 检查文件权限

```bash
ls -la backend/ethereal-shine-436906-r5-firebase-adminsdk-fbsvc-2e401b6388.json
# 确保文件可读
```

---

**修复日期**: 2024-12-19
**修复版本**: v1.1
