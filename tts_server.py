"""
WebSocket TTS 服务 - 使用 edge-tts 将文本转为微软晓晓温柔女声
"""
import asyncio
import websockets
import json
import os
import uuid
import edge_tts
from datetime import datetime

# 配置
VOICE = "zh-CN-XiaoxiaoNeural"  # 微软晓晓温柔女声
OUTPUT_DIR = r"D:\电脑管家迁移文件\xwechat_files\wxid_c8bxhx52w0ii22_8a24\msg\file\2026-03\day4\voice"
WS_PORT = 8765

# 确保输出目录存在
os.makedirs(OUTPUT_DIR, exist_ok=True)


async def text_to_speech(text: str, output_path: str):
    """使用 edge-tts 将文本转换为语音"""
    communicate = edge_tts.Communicate(text, VOICE)
    await communicate.save(output_path)


async def handle_client(websocket):
    """处理 WebSocket 客户端连接"""
    client_addr = websocket.remote_address
    print(f"[{datetime.now()}] 客户端连接: {client_addr}")
    
    try:
        async for message in websocket:
            try:
                # 解析 JSON 消息
                data = json.loads(message)
                text = data.get("text", "").strip()
                
                if not text:
                    await websocket.send(json.dumps({
                        "success": False,
                        "error": "文本内容不能为空"
                    }))
                    continue
                
                print(f"[{datetime.now()}] 收到文本: {text[:50]}...")
                
                # 生成唯一文件名
                filename = f"{uuid.uuid4().hex}.mp3"
                output_path = os.path.join(OUTPUT_DIR, filename)
                
                # 转换文本为语音
                await text_to_speech(text, output_path)
                
                # 获取文件大小
                file_size = os.path.getsize(output_path)
                
                print(f"[{datetime.now()}] 生成音频: {filename} ({file_size} bytes)")
                
                # 读取音频文件并转为 base64
                import base64
                with open(output_path, "rb") as f:
                    audio_base64 = base64.b64encode(f.read()).decode("utf-8")
                
                # 返回成功响应
                response = {
                    "success": True,
                    "filename": filename,
                    "fileSize": file_size,
                    "audioData": audio_base64,
                    "voice": VOICE,
                    "textLength": len(text)
                }
                
                await websocket.send(json.dumps(response))
                print(f"[{datetime.now()}] 音频已发送给客户端")
                
            except json.JSONDecodeError:
                await websocket.send(json.dumps({
                    "success": False,
                    "error": "无效的 JSON 格式"
                }))
            except Exception as e:
                print(f"[{datetime.now()}] 处理错误: {str(e)}")
                await websocket.send(json.dumps({
                    "success": False,
                    "error": f"处理失败: {str(e)}"
                }))
                
    except websockets.exceptions.ConnectionClosed:
        print(f"[{datetime.now()}] 客户端断开连接: {client_addr}")
    except Exception as e:
        print(f"[{datetime.now()}] 连接错误: {str(e)}")


async def main():
    """启动 WebSocket 服务器"""
    print("=" * 50)
    print("🎙️  WebSocket TTS 服务启动")
    print("=" * 50)
    print(f"📍 输出目录: {OUTPUT_DIR}")
    print(f"🔊 语音角色: {VOICE} (微软晓晓温柔女声)")
    print(f"🌐 WebSocket 地址: ws://localhost:{WS_PORT}")
    print("=" * 50)
    print("等待客户端连接...")
    
    async with websockets.serve(handle_client, "localhost", WS_PORT):
        await asyncio.Future()  # 永久运行


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n服务已停止")
