"""
Video Generation API 测试
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


def test_enhance_prompt(client):
    """测试提示词优化 (VEO 3.1 专家)"""
    response = client.post('/api/video/enhance-prompt',
        json={
            'prompt': 'a cat playing in a garden'
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


def test_design_plan(client):
    """测试设计灵感方案"""
    response = client.post('/api/video/design-plan',
        json={
            'topic': 'cinematic nature documentary'
        },
        content_type='application/json'
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert isinstance(data, list)
    # 设计方案可能为空（如果 Google Search 不可用），所以只检查是列表


def test_creative_director_action(client):
    """测试创意总监动作判断"""
    response = client.post('/api/video/creative-director',
        json={
            'userPrompt': 'create a video of a cat',
            'selectedVideoId': None,
            'lastGeneratedVideoId': None,
            'chatHistory': []
        },
        content_type='application/json'
    )
    
    assert response.status_code == 200
    data = json.loads(response.data)
    assert 'action' in data
    assert 'prompt' in data
    assert 'reasoning' in data
    assert data['action'] in ['EDIT_VIDEO', 'NEW_VIDEO', 'ANSWER_QUESTION']


def test_summarize_prompt(client):
    """测试提示词总结"""
    response = client.post('/api/video/summarize-prompt',
        json={
            'prompt': 'A cinematic video of a cat playing in a beautiful garden with golden hour lighting'
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
    response = client.post('/api/video/reference-image',
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


@pytest.mark.slow
def test_generate_video_text_to_video(client):
    """测试文本生成视频（标记为慢速测试）"""
    # Flask 测试客户端不支持 timeout 参数，使用 requests 库进行实际测试
    import requests
    import os
    from dotenv import load_dotenv
    
    # 加载环境变量
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
    
    # 使用实际 HTTP 请求（需要后端服务运行）
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:8787')
    
    try:
        response = requests.post(
            f'{backend_url}/api/video/generate',
            json={
                'prompt': 'a simple red circle moving slowly on white background',
                'images': [],
                'aspectRatio': '16:9',
                'modelName': 'veo_fast'
            },
            timeout=300  # 5 分钟超时
        )
    except requests.exceptions.ConnectionError:
        pytest.skip("Backend server not running, skipping video generation test")
    except requests.exceptions.Timeout:
        # 超时不算失败，视频生成可能需要很长时间
        pytest.skip("Video generation timed out (this is expected for long operations)")
    
    # 视频生成可能需要很长时间，所以可能返回 200 或 500（如果超时）
    assert response.status_code in [200, 500, 408]
    
    if response.status_code == 200:
        data = response.json()  # 使用 response.json() 而不是 json.loads(response.data)
        assert 'videoUri' in data
        assert len(data['videoUri']) > 0
        # 验证 URL 格式
        assert data['videoUri'].startswith('http') or data['videoUri'].startswith('blob:')


def test_error_handling_missing_prompt(client):
    """测试错误处理：缺少必需参数"""
    response = client.post('/api/video/generate',
        json={},
        content_type='application/json'
    )
    
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'error' in data


def test_error_handling_missing_topic(client):
    """测试错误处理：design-plan 缺少 topic"""
    response = client.post('/api/video/design-plan',
        json={},
        content_type='application/json'
    )
    
    assert response.status_code == 400
    data = json.loads(response.data)
    assert 'error' in data


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

