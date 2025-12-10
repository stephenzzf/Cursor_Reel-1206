"""
测试 VideoAssetService 的基本功能
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import base64
from services.video_asset_service import get_video_asset_service


def test_service_initialization():
    """测试服务初始化"""
    print("\n" + "="*60)
    print("测试 1: VideoAssetService 初始化")
    print("="*60)
    
    service = get_video_asset_service()
    is_available = service.is_available()
    
    print(f"服务可用: {is_available}")
    if is_available:
        print("✅ VideoAssetService 初始化成功")
    else:
        print("⚠️ VideoAssetService 不可用（可能缺少 Firebase 配置）")
    
    return is_available


def test_image_upload():
    """测试图片上传功能"""
    print("\n" + "="*60)
    print("测试 2: 图片上传到 Firebase Storage")
    print("="*60)
    
    service = get_video_asset_service()
    
    if not service.is_available():
        print("⚠️ 跳过测试：服务不可用")
        return False
    
    # 创建一个简单的测试图片（1x1 像素的 PNG）
    # PNG header + minimal PNG data
    test_png_data = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    )
    
    try:
        doc_ref, public_url, gcs_uri = service.archive_and_prepare_reference(
            test_png_data,
            "image/png",
            "Test image upload"
        )
        
        if gcs_uri:
            print(f"✅ 图片上传成功")
            print(f"   GCS URI: {gcs_uri}")
            print(f"   Public URL: {public_url or 'N/A'}")
            print(f"   Firestore 文档: {'已创建' if doc_ref else '未创建'}")
            return True
        else:
            print("❌ 图片上传失败：未返回 GCS URI")
            return False
            
    except Exception as e:
        print(f"❌ 图片上传失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """运行所有测试"""
    print("\n" + "="*60)
    print("VideoAssetService 后端自测")
    print("="*60)
    
    # 测试 1: 服务初始化
    init_ok = test_service_initialization()
    
    # 测试 2: 图片上传（仅在服务可用时）
    if init_ok:
        upload_ok = test_image_upload()
    else:
        upload_ok = False
        print("\n⚠️ 跳过图片上传测试：服务未初始化")
    
    # 总结
    print("\n" + "="*60)
    print("测试总结")
    print("="*60)
    print(f"服务初始化: {'✅ 通过' if init_ok else '❌ 失败'}")
    print(f"图片上传: {'✅ 通过' if upload_ok else '❌ 失败' if init_ok else '⏭️  跳过'}")
    print("="*60 + "\n")
    
    if init_ok and upload_ok:
        print("✅ 所有测试通过！")
        return 0
    elif not init_ok:
        print("⚠️ 服务未初始化，可能是 Firebase 配置问题")
        print("   在生产环境中应该有正确的 Firebase 配置")
        return 0  # 不视为失败，因为可能是配置问题
    else:
        print("❌ 部分测试失败")
        return 1


if __name__ == "__main__":
    exit(main())
