# Firestore 安全规则配置指南

## visual_profiles 集合规则

在 Firebase Console 中配置以下 Firestore 安全规则，为 `visual_profiles` 集合添加读写权限，并限制每个用户最多 2 个 Brand DNA。

### 规则配置

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 现有规则...
    
    // Brand Visual Profiles (Brand DNA) 集合
    match /visual_profiles/{profileId} {
      // 允许用户读取自己的 profiles
      allow read: if request.auth != null && request.auth.uid == resource.data.uid;
      
      // 允许用户创建自己的 profile（限制最多 2 个）
      allow create: if request.auth != null 
        && request.auth.uid == request.resource.data.uid
        && request.resource.data.name is string
        && request.resource.data.description is string
        && request.resource.data.visualStyle is string
        && request.resource.data.colorPalette is string
        && request.resource.data.mood is string
        && request.resource.data.negativeConstraint is string
        && request.resource.data.isActive is bool
        && request.resource.data.createdAt is number
        && (!exists(/databases/$(database)/documents/visual_profiles/$(profileId))
            || get(/databases/$(database)/documents/visual_profiles/$(profileId)).data.uid == request.auth.uid)
        && getAfter(/databases/$(database)/documents/visual_profiles/$(profileId)).data.uid == request.auth.uid
        && // 限制：检查用户是否已有 2 个 profiles
          (size(get(/databases/$(database)/documents/visual_profiles).where('uid', '==', request.auth.uid).get().data) < 2);
      
      // 允许用户更新自己的 profile
      allow update: if request.auth != null 
        && request.auth.uid == resource.data.uid
        && request.auth.uid == request.resource.data.uid; // 确保 uid 不会被修改
      
      // 允许用户删除自己的 profile
      allow delete: if request.auth != null && request.auth.uid == resource.data.uid;
    }
  }
}
```

### 简化版规则（推荐）

由于 Firestore Rules 的限制，无法在规则中直接检查集合大小。建议在前端和后端都添加限制检查，规则只负责基本权限验证：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 现有规则...
    
    // Brand Visual Profiles (Brand DNA) 集合
    match /visual_profiles/{profileId} {
      // 读取：用户只能读取自己的 profiles
      allow read: if request.auth != null && request.auth.uid == resource.data.uid;
      
      // 创建：用户只能创建自己的 profile
      allow create: if request.auth != null 
        && request.auth.uid == request.resource.data.uid
        && request.resource.data.name is string
        && request.resource.data.createdAt is number;
      
      // 更新：用户只能更新自己的 profile，且不能修改 uid
      allow update: if request.auth != null 
        && request.auth.uid == resource.data.uid
        && request.auth.uid == request.resource.data.uid;
      
      // 删除：用户只能删除自己的 profile
      allow delete: if request.auth != null && request.auth.uid == resource.data.uid;
    }
  }
}
```

**注意**: 数量限制（最多 2 个）在前端 `brandProfileService.ts` 的 `createVisualProfile` 函数中已实现，Firestore 规则主要负责权限验证。

### 配置步骤

1. 打开 Firebase Console: https://console.firebase.google.com
2. 选择项目: `ethereal-shine-436906-r5`
3. 进入 **Firestore Database** → **规则**
4. 将上述规则添加到现有规则文件中
5. 点击 **发布**

### 验证

配置完成后，可以通过以下方式验证：

1. **前端验证**: 尝试创建第 3 个 Brand DNA，应该看到 "Brand DNA 数量已达上限 (2个)" 的错误提示
2. **权限验证**: 使用不同的用户账号，尝试访问其他用户的 Brand DNA，应该被拒绝

### 现有集合规则

如果项目中已有其他集合规则，请确保将它们合并到同一个 `rules_version = '2';` 块中，例如：

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 现有规则（profiles, gallery_items 等）
    match /profiles/{profileId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;
    }
    
    match /gallery_items/{itemId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;
    }
    
    // Brand Visual Profiles 规则（新增）
    match /visual_profiles/{profileId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.uid;
      allow create: if request.auth != null 
        && request.auth.uid == request.resource.data.uid;
      allow update: if request.auth != null 
        && request.auth.uid == resource.data.uid
        && request.auth.uid == request.resource.data.uid;
      allow delete: if request.auth != null && request.auth.uid == resource.data.uid;
    }
  }
}
```
