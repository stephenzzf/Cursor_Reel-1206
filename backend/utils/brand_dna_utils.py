"""
Brand DNA Utilities
从 Firestore 读取 Brand DNA 配置的辅助函数
"""

from typing import Optional, Dict, Any
import firebase_admin
from firebase_admin import firestore


def get_brand_dna_profile(uid: str, profile_id: str) -> Optional[Dict[str, Any]]:
    """
    从 Firestore 读取指定的 Brand DNA 配置
    
    Args:
        uid: 用户 ID
        profile_id: Brand DNA 配置 ID
    
    Returns:
        Brand DNA 配置字典，如果不存在则返回 None
    """
    try:
        if not firebase_admin._apps:
            print("[BrandDNAUtils] Firebase not initialized")
            return None
        
        db = firestore.client()
        doc_ref = db.collection('visual_profiles').document(profile_id)
        doc = doc_ref.get()
        
        if not doc.exists:
            print(f"[BrandDNAUtils] Profile {profile_id} not found")
            return None
        
        data = doc.to_dict()
        
        # 验证所有权
        if data.get('uid') != uid:
            print(f"[BrandDNAUtils] Profile {profile_id} does not belong to user {uid}")
            return None
        
        return data
    
    except Exception as e:
        print(f"[BrandDNAUtils] Error reading Brand DNA profile: {e}")
        import traceback
        traceback.print_exc()
        return None


def inject_brand_dna_to_prompt(
    original_prompt: str,
    brand_dna: Dict[str, Any],
    is_video: bool = False
) -> str:
    """
    将 Brand DNA 约束注入到提示词中
    
    Args:
        original_prompt: 原始用户提示词
        brand_dna: Brand DNA 配置字典
        is_video: 是否为视频生成（决定注入方式）
    
    Returns:
        注入 Brand DNA 后的提示词
    """
    profile_name = brand_dna.get('name', 'Brand DNA')
    visual_style = brand_dna.get('visualStyle', '')
    color_palette = brand_dna.get('colorPalette', '')
    mood = brand_dna.get('mood', '')
    negative_constraint = brand_dna.get('negativeConstraint', '')
    
    if is_video:
        # 视频模式：只注入文本约束（不使用 styleReferenceUrl）
        motion_style = brand_dna.get('motionStyle', 'Stable cinematic movement')
        brand_context = f"""
[BRAND DNA ACTIVE: {profile_name}]
Strictly adhere to these visual and motion constraints:
- Visual Style: {visual_style}
- Color Palette: {color_palette}
- Mood: {mood}
- Motion Style: {motion_style}
- Negative Constraints (AVOID): {negative_constraint}
"""
    else:
        # 图片模式：注入文本约束
        brand_context = f"""
[BRAND DNA ACTIVE: {profile_name}]
- Visual Style: {visual_style}
- Color Palette: {color_palette}
- Mood: {mood}
- Negative Constraints: {negative_constraint}
"""
    
    return f"{original_prompt}\n\n{brand_context}"


def get_brand_dna_style_reference(brand_dna: Dict[str, Any]) -> Optional[str]:
    """
    获取 Brand DNA 的风格参考图片 URL（用于图片生成）
    
    Args:
        brand_dna: Brand DNA 配置字典
    
    Returns:
        风格参考图片 URL，如果不存在则返回 None
    """
    return brand_dna.get('styleReferenceUrl')
