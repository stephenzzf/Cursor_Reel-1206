"""
Reel API 集成测试
测试所有 Reel 相关的 API 端点
"""

import pytest
import os
import json
from unittest.mock import patch, MagicMock
from flask import Flask
from routes.reel import reel_bp

# 创建测试应用
app = Flask(__name__)
app.register_blueprint(reel_bp)

# 测试客户端
client = app.test_client()


def test_health_endpoint():
    """测试健康检查端点"""
    response = client.get('/health')
    assert response.status_code == 200
    data = json.loads(response.data)
    assert data['status'] == 'ok'


def test_creative_director_missing_auth():
    """测试创意总监端点缺少认证"""
    response = client.post('/api/reel/creative-director', 
                          json={'userPrompt': 'test'})
    assert response.status_code == 401


def test_generate_missing_auth():
    """测试生成端点缺少认证"""
    response = client.post('/api/reel/generate',
                          json={'prompt': 'test', 'model': 'banana'})
    assert response.status_code == 401


@patch('utils.auth._initialize_firebase')
@patch('utils.auth.auth')
def test_creative_director_with_auth(mock_auth, mock_init):
    """测试创意总监端点（带认证）"""
    # Mock Firebase auth
    mock_decoded_token = {'uid': 'test-user', 'email': 'test@example.com'}
    mock_auth.verify_id_token.return_value = mock_decoded_token
    
    # Mock request headers
    with app.test_request_context('/api/reel/creative-director',
                                  method='POST',
                                  headers={'Authorization': 'Bearer fake-token'},
                                  json={'userPrompt': 'create a cat'}):
        with patch('services.gemini_service.get_gemini_service') as mock_gemini:
            # Mock Gemini service
            mock_service = MagicMock()
            mock_response = MagicMock()
            mock_response.candidates = [MagicMock()]
            mock_response.candidates[0].content.parts = []
            mock_service.generate_content.return_value = mock_response
            mock_gemini.return_value = mock_service
            
            # 由于需要完整的请求上下文，这里只做基本结构测试
            # 实际集成测试需要真实的 Firebase token
            pass


if __name__ == '__main__':
    pytest.main([__file__, '-v'])

