"""
Image Generation API 测试
使用真实 API keys 进行 Live 测试
"""

import pytest
import json
import base64
import os
import sys

# 添加 backend 目录到路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app import app


@pytest.fixture
def client():
    """创建测试客户端"""
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def test_creative_director_action(client):
    """测试创意总监动作判断"""
    response = client.post('/api/image/creative-director', 
        json={
            'userPrompt': 'a cat astronaut',
            'selectedImageId': None,
            'lastGeneratedImageId': None,
            'chatHistory': []
        },
        content_type='application/json'
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'action' in data
    assert 'prompt' in data
    assert 'reasoning' in data
    assert data['action'] in ['EDIT_IMAGE', 'NEW_CREATION', 'ANSWER_QUESTION']


def test_generate_image(client):
    """测试图片生成"""
    response = client.post('/api/image/generate',
        json={
            'prompt': 'a simple red circle on white background',
            'images': [],
            'aspectRatio': '1:1',
            'modelLevel': 'banana'
        },
        content_type='application/json'
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'base64Image' in data
    assert len(data['base64Image']) > 0
    
    # 验证 base64 格式
    try:
        base64.b64decode(data['base64Image'])
    except Exception:
        pytest.fail("base64Image is not valid base64")


def test_enhance_prompt(client):
    """测试提示词优化"""
    response = client.post('/api/image/enhance-prompt',
        json={
            'prompt': 'a cat'
        },
        content_type='application/json'
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert isinstance(data, list)
    assert len(data) > 0
    assert 'title' in data[0]
    assert 'description' in data[0]
    assert 'tags' in data[0]
    assert 'fullPrompt' in data[0]


def test_summarize_prompt(client):
    """测试提示词总结"""
    response = client.post('/api/image/summarize-prompt',
        json={
            'prompt': 'A professional e-commerce product shot of a stylish black chronograph watch on a textured dark marble surface, dramatic studio lighting, macro details.'
        },
        content_type='application/json'
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'summary' in data
    assert len(data['summary']) > 0
    assert len(data['summary']) < 100  # 应该是简短标题


def test_reference_image(client):
    """测试参考图片生成"""
    response = client.post('/api/image/reference-image',
        json={
            'prompt': 'a modern minimalist design with blue and white colors'
        },
        content_type='application/json'
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'base64Image' in data
    assert len(data['base64Image']) > 0
    
    # 验证 base64 格式
    try:
        base64.b64decode(data['base64Image'])
    except Exception:
        pytest.fail("base64Image is not valid base64")


def test_upscale_image(client):
    """测试图片高清放大"""
    # 首先生成一张测试图片
    generate_response = client.post('/api/image/generate',
        json={
            'prompt': 'a simple blue square',
            'images': [],
            'aspectRatio': '1:1',
            'modelLevel': 'banana'
        },
        content_type='application/json'
    )
    
    if generate_response.status_code != 200:
        pytest.skip("Cannot generate test image for upscale")
    
    base64_image = json.loads(generate_response.data)['base64Image']
    
    # 测试放大
    response = client.post('/api/image/upscale',
        json={
            'base64Data': base64_image,
            'mimeType': 'image/jpeg',
            'factor': 2,
            'prompt': 'a simple blue square'
        },
        content_type='application/json'
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'base64Image' in data
    assert len(data['base64Image']) > 0


def test_design_plan(client):
    """测试设计灵感方案"""
    response = client.post('/api/image/design-plan',
        json={
            'topic': 'modern minimalist design'
        },
        content_type='application/json'
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert isinstance(data, list)
    # 设计方案可能为空（如果 Google Search 不可用），所以只检查是列表


def test_inspiration_image(client):
    """测试灵感图片生成"""
    response = client.post('/api/image/inspiration',
        json={
            'prompt': 'a beautiful sunset'
        },
        content_type='application/json'
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'base64Image' in data
    assert len(data['base64Image']) > 0


def test_error_handling_missing_prompt(client):
    """测试错误处理：缺少必需参数"""
    response = client.post('/api/image/generate',
        json={},
        content_type='application/json'
    )
    
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'error' in data


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

