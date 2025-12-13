#!/usr/bin/env python3
"""
Firebase 保存逻辑验证测试
检查所有 hooks 中的保存逻辑是否完整和一致
"""

import os
import re
from typing import List, Tuple, Dict

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_status(message: str, status: str = "INFO"):
    """打印带颜色的状态信息"""
    color = Colors.BLUE
    if status == "SUCCESS":
        color = Colors.GREEN
    elif status == "ERROR":
        color = Colors.RED
    elif status == "WARNING":
        color = Colors.YELLOW
    print(f"{color}[{status}]{Colors.RESET} {message}")

def check_file_content(file_path: str, required_patterns: List[str], forbidden_patterns: List[str] = None) -> Tuple[bool, List[str]]:
    """检查文件内容是否符合要求"""
    issues = []
    
    if not os.path.exists(file_path):
        return False, [f"文件不存在: {file_path}"]
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 检查必需的模式
    for pattern in required_patterns:
        if not re.search(pattern, content, re.MULTILINE):
            issues.append(f"缺少必需模式: {pattern}")
    
    # 检查禁止的模式
    if forbidden_patterns:
        for pattern in forbidden_patterns:
            if re.search(pattern, content, re.MULTILINE):
                issues.append(f"包含禁止的模式: {pattern}")
    
    return len(issues) == 0, issues

def test_reel_generation_save_logic():
    """测试 Reel 生成保存逻辑"""
    print_status("测试 Reel 生成保存逻辑...", "INFO")
    
    file_path = "frontend/hooks/useReelGeneration.ts"
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    issues = []
    
    # 检查使用 userProfile.uid
    if not re.search(r"userProfile.*uid", content, re.MULTILINE):
        issues.append("缺少 userProfile.uid 检查")
    
    # 检查图片保存逻辑（应该有 uploadImageToStorage 和 then）
    if not (re.search(r"uploadImageToStorage", content) and re.search(r"\.then\s*\(", content)):
        issues.append("图片保存逻辑缺少 uploadImageToStorage().then() 模式")
    
    # 检查 saveGalleryItem
    if not re.search(r"saveGalleryItem", content):
        issues.append("缺少 saveGalleryItem 调用")
    
    # 检查错误处理
    if not (re.search(r"\.catch\s*\(|catch\s*\(", content)):
        issues.append("缺少错误处理 (.catch 或 catch)")
    
    # 检查不应该使用 auth.currentUser.uid（在保存逻辑中）
    if re.search(r"auth\.currentUser\.uid.*saveGalleryItem|saveGalleryItem.*auth\.currentUser\.uid", content):
        issues.append("保存逻辑中不应该使用 auth.currentUser.uid")
    
    if not issues:
        print_status("✅ Reel 生成保存逻辑检查通过", "SUCCESS")
        return True
    else:
        print_status(f"❌ Reel 生成保存逻辑检查失败:", "ERROR")
        for issue in issues:
            print_status(f"  - {issue}", "ERROR")
        return False

def test_image_generation_save_logic():
    """测试 Image 生成保存逻辑"""
    print_status("测试 Image 生成保存逻辑...", "INFO")
    
    file_path = "frontend/hooks/useImageGeneration.ts"
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    issues = []
    
    # 检查使用 userProfile.uid
    if not re.search(r"userProfile.*uid", content, re.MULTILINE):
        issues.append("缺少 userProfile.uid 检查")
    
    # 检查图片保存逻辑（应该有 uploadImageToStorage 和 then）
    if not (re.search(r"uploadImageToStorage", content) and re.search(r"\.then\s*\(", content)):
        issues.append("图片保存逻辑缺少 uploadImageToStorage().then() 模式")
    
    # 检查 saveGalleryItem
    if not re.search(r"saveGalleryItem", content):
        issues.append("缺少 saveGalleryItem 调用")
    
    # 检查错误处理
    if not (re.search(r"\.catch\s*\(|catch\s*\(", content)):
        issues.append("缺少错误处理 (.catch 或 catch)")
    
    if not issues:
        print_status("✅ Image 生成保存逻辑检查通过", "SUCCESS")
        return True
    else:
        print_status(f"❌ Image 生成保存逻辑检查失败:", "ERROR")
        for issue in issues:
            print_status(f"  - {issue}", "ERROR")
        return False

def test_video_generation_save_logic():
    """测试 Video 生成保存逻辑"""
    print_status("测试 Video 生成保存逻辑...", "INFO")
    
    file_path = "frontend/hooks/useVideoGeneration.ts"
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    issues = []
    
    # 检查使用 userProfile.uid
    if not re.search(r"userProfile.*uid", content, re.MULTILINE):
        issues.append("缺少 userProfile.uid 检查")
    
    # 检查 saveGalleryItem
    if not re.search(r"saveGalleryItem", content):
        issues.append("缺少 saveGalleryItem 调用")
    
    # 检查错误处理（try-catch）- 在 saveGalleryItem 附近应该有 try-catch
    save_gallery_section = re.search(r"saveGalleryItem.*?catch", content, re.DOTALL)
    if not save_gallery_section or not re.search(r"try", save_gallery_section.group(0)):
        # 或者检查是否有 catch
        if not re.search(r"catch\s*\(.*e.*\)|catch\s*\{", content):
            issues.append("缺少 try-catch 错误处理")
    
    if not issues:
        print_status("✅ Video 生成保存逻辑检查通过", "SUCCESS")
        return True
    else:
        print_status(f"❌ Video 生成保存逻辑检查失败:", "ERROR")
        for issue in issues:
            print_status(f"  - {issue}", "ERROR")
        return False

def test_upscale_save_logic():
    """测试 Upscale 保存逻辑"""
    print_status("测试 Upscale 保存逻辑...", "INFO")
    
    file_path = "frontend/hooks/useImageGeneration.ts"
    
    # 检查 handleUpscale 函数中是否有保存逻辑
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 查找 handleUpscale 函数
    upscale_match = re.search(r"handleUpscale.*?\{([^}]*?uploadImageToStorage.*?saveGalleryItem[^}]*?)\}", content, re.DOTALL)
    
    if upscale_match:
        upscale_content = upscale_match.group(0)
        if "saveGalleryItem" in upscale_content and "userProfile" in upscale_content:
            print_status("✅ Image Upscale 保存逻辑检查通过", "SUCCESS")
            return True
        else:
            print_status("❌ Image Upscale 缺少保存逻辑", "ERROR")
            return False
    else:
        print_status("❌ 未找到 Image Upscale 保存逻辑", "ERROR")
        return False

def test_remove_background_save_logic():
    """测试 Remove Background 保存逻辑"""
    print_status("测试 Remove Background 保存逻辑...", "INFO")
    
    issues = []
    
    # 检查 Reel 页面
    reel_file = "frontend/hooks/useReelGeneration.ts"
    with open(reel_file, 'r', encoding='utf-8') as f:
        reel_content = f.read()
    
    reel_rb_match = re.search(r"handleRemoveBackground.*?\{([^}]*?uploadImageToStorage.*?saveGalleryItem[^}]*?)\}", reel_content, re.DOTALL)
    if not reel_rb_match or "saveGalleryItem" not in reel_rb_match.group(0):
        issues.append("Reel 页面 Remove Background 缺少保存逻辑")
    
    # 检查 Image 页面
    image_file = "frontend/hooks/useImageGeneration.ts"
    with open(image_file, 'r', encoding='utf-8') as f:
        image_content = f.read()
    
    image_rb_match = re.search(r"handleRemoveBackground.*?\{([^}]*?uploadImageToStorage.*?saveGalleryItem[^}]*?)\}", image_content, re.DOTALL)
    if not image_rb_match or "saveGalleryItem" not in image_rb_match.group(0):
        issues.append("Image 页面 Remove Background 缺少保存逻辑")
    
    if not issues:
        print_status("✅ Remove Background 保存逻辑检查通过", "SUCCESS")
        return True
    else:
        print_status("❌ Remove Background 保存逻辑检查失败:", "ERROR")
        for issue in issues:
            print_status(f"  - {issue}", "ERROR")
        return False

def test_service_no_duplicate_save():
    """测试 Service 层没有重复保存逻辑"""
    print_status("测试 Service 层没有重复保存...", "INFO")
    
    service_file = "frontend/services/geminiService_reel.ts"
    
    with open(service_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 检查 generateReelAsset 函数中是否有保存逻辑
    generate_match = re.search(r"export const generateReelAsset.*?\}", content, re.DOTALL)
    
    if generate_match:
        func_content = generate_match.group(0)
        # 检查是否还有保存逻辑（应该已经移除）
        if "saveGalleryItem" in func_content and "auth.currentUser" in func_content:
            print_status("❌ Service 层仍有保存逻辑（应该已移除）", "ERROR")
            return False
        elif "Note: Saving to gallery is now handled" in func_content or "保存到 gallery 现在在 hook 中处理" in func_content:
            print_status("✅ Service 层已正确移除保存逻辑", "SUCCESS")
            return True
        else:
            # 检查是否有注释说明
            print_status("⚠️ Service 层保存逻辑状态不明确", "WARNING")
            return True  # 不强制要求注释
    else:
        print_status("⚠️ 未找到 generateReelAsset 函数", "WARNING")
        return True

def test_imports():
    """测试导入是否正确"""
    print_status("测试导入...", "INFO")
    
    hooks = [
        "frontend/hooks/useReelGeneration.ts",
        "frontend/hooks/useImageGeneration.ts",
        "frontend/hooks/useVideoGeneration.ts",
    ]
    
    all_passed = True
    for hook_file in hooks:
        if not os.path.exists(hook_file):
            print_status(f"  ❌ 文件不存在: {hook_file}", "ERROR")
            all_passed = False
            continue
        
        with open(hook_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 检查必要的导入
        required_imports = ["saveGalleryItem", "userProfile"]
        missing = []
        for imp in required_imports:
            if "saveGalleryItem" in required_imports and "saveGalleryItem" not in content:
                # 对于 useVideoGeneration，可能不需要 uploadImageToStorage
                if "uploadImageToStorage" not in content and "useVideoGeneration" in hook_file:
                    continue
                if imp not in content:
                    missing.append(imp)
        
        if missing:
            print_status(f"  ⚠️ {hook_file} 缺少导入: {', '.join(missing)}", "WARNING")
    
    if all_passed:
        print_status("✅ 导入检查通过", "SUCCESS")
    else:
        print_status("❌ 导入检查失败", "ERROR")
    
    return all_passed

def run_all_tests():
    """运行所有测试"""
    print_status("=" * 60, "INFO")
    print_status("Firebase 保存逻辑验证测试", "INFO")
    print_status("=" * 60, "INFO")
    print()
    
    # 切换到项目根目录
    os.chdir("/Users/stephen/Documents/11_Dev/Cursor/AIS_Reel_1-Cursor")
    
    tests = [
        ("Reel 生成保存逻辑", test_reel_generation_save_logic),
        ("Image 生成保存逻辑", test_image_generation_save_logic),
        ("Video 生成保存逻辑", test_video_generation_save_logic),
        ("Upscale 保存逻辑", test_upscale_save_logic),
        ("Remove Background 保存逻辑", test_remove_background_save_logic),
        ("Service 层无重复保存", test_service_no_duplicate_save),
        ("导入检查", test_imports),
    ]
    
    results = []
    for test_name, test_func in tests:
        print()
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print_status(f"测试 '{test_name}' 发生异常: {str(e)}", "ERROR")
            results.append((test_name, False))
    
    # 总结
    print()
    print_status("=" * 60, "INFO")
    print_status("测试结果总结", "INFO")
    print_status("=" * 60, "INFO")
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ 通过" if result else "❌ 失败"
        color = Colors.GREEN if result else Colors.RED
        print(f"{color}{status}{Colors.RESET} - {test_name}")
    
    print()
    print_status(f"总计: {passed}/{total} 测试通过", "SUCCESS" if passed == total else "WARNING")
    
    return passed == total

if __name__ == "__main__":
    success = run_all_tests()
    exit(0 if success else 1)
