"""
WebSocket TTS 客户端示例 - 测试文本转语音服务
"""
import asyncio
import websockets
import json
import base64
import os

WS_URL = "ws://localhost:8765"
OUTPUT_DIR = r"D:\电脑管家迁移文件\xwechat_files\wxid_c8bxhx52w0ii22_8a24\msg\file\2026-03\day4\voice"


async def test_tts():
    """测试 TTS 服务"""
    print("🎙️  WebSocket TTS 客户端测试")
    print("=" * 50)
    
    # 测试文本
    test_texts = [
        "你好，我是微软晓晓，很高兴为你服务。",
        "这是一段温柔的女声测试，希望你喜欢。",
        "欢迎使用文本转语音服务，祝你有美好的一天！"
    ]
    
    try:
        async with websockets.connect(WS_URL) as websocket:
            print(f"✅ 已连接到服务器: {WS_URL}\n")
            
            for i, text in enumerate(test_texts, 1):
                print(f"[{i}/{len(test_texts)}] 发送文本: {text}")
                
                # 发送文本
                request = {"text": text}
                await websocket.send(json.dumps(request))
                
                # 接收响应
                response = await websocket.recv()
                data = json.loads(response)
                
                if data.get("success"):
                    filename = data["filename"]
                    audio_data = base64.b64decode(data["audioData"])
                    
                    # 保存音频文件
                    output_path = os.path.join(OUTPUT_DIR, f"test_{i}_{filename}")
                    with open(output_path, "wb") as f:
                        f.write(audio_data)
                    
                    print(f"✅ 音频已保存: {output_path}")
                    print(f"   文件大小: {data['fileSize']} bytes")
                    print(f"   文本长度: {data['textLength']} 字符\n")
                else:
                    print(f"❌ 错误: {data.get('error', '未知错误')}\n")
                
                # 等待一下再发送下一个
                await asyncio.sleep(1)
            
            print("=" * 50)
            print("🎉 所有测试完成！")
            
    except ConnectionRefusedError:
        print("❌ 无法连接到服务器，请确保服务已启动")
    except Exception as e:
        print(f"❌ 错误: {str(e)}")


if __name__ == "__main__":
    asyncio.run(test_tts())
