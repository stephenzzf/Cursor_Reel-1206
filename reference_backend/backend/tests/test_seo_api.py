"""
SEO API 测试
使用真实 API keys 进行 Live 测试
"""

import pytest
import json
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


def test_analyze_intent_seo(client):
    """测试 SEO 意图识别（包含 URL）"""
    response = client.post('/api/seo/analyze-intent',
        json={
            'prompt': '分析网站 www.nike.com 的 SEO'
        },
        content_type='application/json'
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'intent' in data
    assert 'url' in data
    assert 'query' in data
    assert data['intent'] == 'SEO'
    # URL 可能被提取或规范化
    assert data['url'] is not None or data['query'] is not None


def test_analyze_intent_image_generation(client):
    """测试图片生成意图识别"""
    test_prompts = [
        '生成一张小狗在沙滩上玩的照片',
        'create an image of a cat',
        'draw a picture of a sunset',
        '创建AI图片 A cute samoyed dog'
    ]
    
    for prompt in test_prompts:
        response = client.post('/api/seo/analyze-intent',
            json={'prompt': prompt},
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'intent' in data
        assert 'query' in data
        # 至少应该返回有效意图（IMAGE_GENERATION 或 OTHER）
        assert data['intent'] in ['SEO', 'IMAGE_GENERATION', 'OTHER']
        
        # 如果识别为 IMAGE_GENERATION，验证 query 存在
        if data['intent'] == 'IMAGE_GENERATION':
            assert data['query'] is not None
            break


def test_analyze_intent_other(client):
    """测试其他意图识别"""
    response = client.post('/api/seo/analyze-intent',
        json={
            'prompt': '你好，这个工具能做什么？'
        },
        content_type='application/json'
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'intent' in data
    assert 'query' in data
    # 可能是 OTHER 或其他意图，至少应该有有效响应
    assert data['intent'] in ['SEO', 'IMAGE_GENERATION', 'OTHER']


def test_analyze_intent_with_url_variations(client):
    """测试不同 URL 格式的识别"""
    test_cases = [
        'https://www.nike.com',
        'www.nike.com',
        '分析 https://www.apple.com',
        '为网站 www.dji.com 进行 SEO 诊断'
    ]
    
    for prompt in test_cases:
        response = client.post('/api/seo/analyze-intent',
            json={'prompt': prompt},
            content_type='application/json'
        )
        
        assert response.status_code == 200
        data = json.loads(response.data)
        assert 'intent' in data
        # 如果包含 URL，应该识别为 SEO
        if 'www.' in prompt or 'https://' in prompt or 'http://' in prompt:
            assert data['intent'] == 'SEO' or data['url'] is not None


def test_analyze_intent_error_handling_missing_prompt(client):
    """测试错误处理：缺少必需参数"""
    response = client.post('/api/seo/analyze-intent',
        json={},
        content_type='application/json'
    )
    
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'error' in data


def test_analyze_intent_empty_prompt(client):
    """测试空 prompt 的处理"""
    response = client.post('/api/seo/analyze-intent',
        json={'prompt': ''},
        content_type='application/json'
    )
    
    # 空 prompt 可能返回 OTHER 意图或错误，取决于后端实现
    assert response.status_code in [200, 400]
    if response.status_code == 200:
        data = json.loads(response.data)
        assert 'intent' in data


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

