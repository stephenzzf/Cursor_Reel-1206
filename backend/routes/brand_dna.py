"""
Brand DNA 路由
处理 Brand DNA 相关的 API 端点
"""

from flask import Blueprint, request, jsonify
from services.brand_dna_service import extract_brand_dna
from utils.auth import verify_firebase_token

brand_dna_bp = Blueprint('brand_dna', __name__, url_prefix='/api/brand-dna')


@brand_dna_bp.route('/extract', methods=['POST'])
@verify_firebase_token
def extract():
    """
    提取 Brand DNA
    
    Request: {
        "logoImage"?: {"data": string, "mimeType": string},
        "referenceImages"?: [{"data": string, "mimeType": string}],
        "description": string,
        "videoUrls"?: string[]
    }
    
    Response: {
        "visualStyle": string,
        "colorPalette": string,
        "mood": string,
        "negativeConstraint": string,
        "motionStyle": string
    }
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Missing request body"}), 400
        
        logo_image = data.get('logoImage')
        reference_images = data.get('referenceImages', [])
        description = data.get('description', '')
        video_urls = data.get('videoUrls')
        
        # 验证至少有一个输入
        if not logo_image and not reference_images:
            return jsonify({"error": "At least one image (logo or reference) is required"}), 400
        
        # 调用服务提取 Brand DNA
        result = extract_brand_dna(
            logo_image=logo_image,
            reference_images=reference_images,
            description=description,
            video_urls=video_urls
        )
        
        return jsonify(result)
    
    except ValueError as e:
        print(f"Error in brand DNA extraction: {e}")
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"Error in brand DNA extraction: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
