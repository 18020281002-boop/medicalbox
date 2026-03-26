/**
 * 药匣子 MedBox AI - Node.js 后端服务
 */
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const WebSocket = require('ws');

const app = express();
const PORT = 3000;

// WebSocket TTS 服务配置
const TTS_WS_URL = 'ws://localhost:8765';
let ttsWs = null;
let ttsReconnectInterval = null;

// 连接到 TTS WebSocket 服务
function connectTTS() {
  console.log('正在连接 TTS WebSocket 服务...');
  
  ttsWs = new WebSocket(TTS_WS_URL);
  
  ttsWs.on('open', () => {
    console.log('✅ 已连接到 TTS WebSocket 服务');
    if (ttsReconnectInterval) {
      clearInterval(ttsReconnectInterval);
      ttsReconnectInterval = null;
    }
  });
  
  ttsWs.on('close', () => {
    console.log('⚠️ TTS WebSocket 连接已断开，尝试重连...');
    ttsWs = null;
    if (!ttsReconnectInterval) {
      ttsReconnectInterval = setInterval(connectTTS, 5000);
    }
  });
  
  ttsWs.on('error', (err) => {
    console.error('TTS WebSocket 错误:', err.message);
    ttsWs = null;
  });
}

// 将分析结果分段处理，去除 emoji
function splitAnalysisForTTS(analysis) {
  // 去除 emoji 表情
  const removeEmoji = (text) => {
    return text
      .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // 表情符号
      .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // 符号和象形文字
      .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // 交通和地图符号
      .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // 国旗
      .replace(/[\u{2600}-\u{26FF}]/gu, '')   // 杂项符号
      .replace(/[\u{2700}-\u{27BF}]/gu, '')   // 装饰符号
      .trim();
  };
  
  // 按段落分割
  const paragraphs = analysis.split('\n\n').filter(p => p.trim());
  const segments = [];
  
  for (const paragraph of paragraphs) {
    // 去除 markdown 标记
    let cleanText = paragraph
      .replace(/^##\s*/, '')  // 去除 ## 标题标记
      .replace(/\n/g, ' ')     // 换行转空格
      .trim();
    
    // 去除 emoji
    cleanText = removeEmoji(cleanText);
    
    // 只保留有内容的段落
    if (cleanText && cleanText.length > 5) {
      segments.push(cleanText);
    }
  }
  
  return segments.length > 0 ? segments : ['药品信息识别完成，请查看详细说明。'];
}

// 发送文本到 TTS 服务（使用 HTTP 方式作为备选）
async function sendToTTS(text) {
  return new Promise((resolve, reject) => {
    if (!ttsWs || ttsWs.readyState !== WebSocket.OPEN) {
      reject(new Error('TTS 服务未连接'));
      return;
    }
    
    const message = JSON.stringify({ text });
    
    // 使用一次性消息监听器
    const messageHandler = (data) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'TTS 处理失败'));
        }
      } catch (e) {
        reject(new Error('解析响应失败: ' + e.message));
      }
    };
    
    // 设置一次性监听器
    ttsWs.once('message', messageHandler);
    
    // 发送消息
    ttsWs.send(message, (err) => {
      if (err) {
        ttsWs.removeListener('message', messageHandler);
        reject(new Error('发送失败: ' + err.message));
      }
    });
    
    // 超时处理
    setTimeout(() => {
      ttsWs.removeListener('message', messageHandler);
      reject(new Error('TTS 请求超时'));
    }, 30000);
  });
}

// Kimi API 配置
const KIMI_API_KEY = 'sk-Qgqld7B46jmaFMjMYPu7DIiIZfKnNq0xjq1GGuUXlZGQU6DY';
const KIMI_API_URL = 'https://api.moonshot.cn/v1/chat/completions';

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB限制
});

// 模拟药品数据（简化版）
const mockMedicineInfo = {
  name: "示例药品",
  usage: "口服，一次1片，一日3次",
  indications: "用于缓解轻至中度疼痛，如头痛、关节痛、偏头痛、牙痛、肌肉痛、神经痛、痛经",
  contraindications: "孕妇、哺乳期妇女禁用；对阿司匹林过敏者禁用",
  sideEffects: "可能出现恶心、呕吐、胃烧灼感或消化不良等"
};

// API路由

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '药匣子 MedBox AI 服务运行中' });
});

// 图片上传分析 - 使用 Kimi Vision 进行 OCR 识别
app.post('/api/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: '请上传图片' 
      });
    }

    // 读取图片并转换为 base64
    const imagePath = req.file.path;
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype;

    // 使用 Kimi Vision API 进行 OCR 识别
    const ocrPrompt = `请仔细识别这张药品说明书或药盒图片中的文字内容，并提取以下信息：
1. 药品名称
2. 适应症（主治什么病）
3. 用法用量（怎么吃、吃多少）
4. 禁忌（什么人不能吃）
5. 不良反应（副作用）
6. 注意事项

请按以下格式输出识别结果：
【药品名称】xxx
【适应症】xxx
【用法用量】xxx
【禁忌】xxx
【不良反应】xxx
【注意事项】xxx

如果某项信息在图片中没有找到，请标注"未识别到"。

重要：请先输出【原始识别内容】，展示你从图片中识别出的所有原始文字内容，然后再输出上面的结构化信息。`;

    let ocrText = '';
    let medicineData = {
      name: '',
      indications: '',
      usage: '',
      contraindications: '',
      sideEffects: '',
      precautions: ''
    };

    try {
      const visionResponse = await axios.post(KIMI_API_URL, {
        model: 'moonshot-v1-8k-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: ocrPrompt },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64Image}` } }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      }, {
        headers: {
          'Authorization': `Bearer ${KIMI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });

      ocrText = visionResponse.data.choices[0].message.content;

      // 解析 OCR 结果
      const nameMatch = ocrText.match(/【药品名称】(.+)/);
      const indicationsMatch = ocrText.match(/【适应症】(.+)/);
      const usageMatch = ocrText.match(/【用法用量】(.+)/);
      const contraindicationsMatch = ocrText.match(/【禁忌】(.+)/);
      const sideEffectsMatch = ocrText.match(/【不良反应】(.+)/);
      const precautionsMatch = ocrText.match(/【注意事项】(.+)/);

      medicineData = {
        name: nameMatch ? nameMatch[1].trim() : '未识别到',
        indications: indicationsMatch ? indicationsMatch[1].trim() : '未识别到',
        usage: usageMatch ? usageMatch[1].trim() : '未识别到',
        contraindications: contraindicationsMatch ? contraindicationsMatch[1].trim() : '未识别到',
        sideEffects: sideEffectsMatch ? sideEffectsMatch[1].trim() : '未识别到',
        precautions: precautionsMatch ? precautionsMatch[1].trim() : '未识别到'
      };

    } catch (ocrError) {
      console.error('OCR 识别失败:', ocrError.message);
      ocrText = 'OCR 识别失败，请重试';
      medicineData = {
        name: '识别失败',
        indications: '识别失败',
        usage: '识别失败',
        contraindications: '识别失败',
        sideEffects: '识别失败',
        precautions: '识别失败'
      };
    }

    // 使用 Kimi AI 生成分析报告
    const analysisPrompt = `你是一位专业的药师。请根据药品名称"${medicineData.name}"，查询你的医学知识库，提供完整的用药指导。

【从图片中识别到的参考信息】
- 药品名称：${medicineData.name}
- 适应症（图片识别）：${medicineData.indications}
- 用法用量（图片识别）：${medicineData.usage}
- 禁忌（图片识别）：${medicineData.contraindications}
- 不良反应（图片识别）：${medicineData.sideEffects}
- 注意事项（图片识别）：${medicineData.precautions}

【任务要求】
1. 以药品名称"${medicineData.name}"为准，查询该药品的完整信息
2. 如果图片识别到的信息完整且正确，可以使用识别到的信息
3. 如果图片识别到的信息缺失、不完整或显示"未识别到"，请基于你的医学知识补充完整
4. 优先使用你的专业知识库中的标准药品信息

请按以下格式输出完整的用药指导：

## 📋 药品名称
${medicineData.name}

## 💡 这药是治什么的？（适应症）
请基于药品"${medicineData.name}"说明该药品的主要适应症和治疗作用

## 📅 怎么吃？（用法用量）
请基于药品"${medicineData.name}"说明标准用法用量

## ⚠️ 重要提醒（禁忌和注意事项）
请基于药品"${medicineData.name}"列出禁忌人群和注意事项

## 😟 可能的不适（副作用）
请基于药品"${medicineData.name}"列出常见不良反应

## ❓ 其他说明
请补充该药品的其他重要信息，如药物相互作用、储存方法等

要求：
1. 使用通俗易懂的语言
2. 适当使用 emoji 让内容更友好
3. 所有信息必须基于药品"${medicineData.name}"的专业知识
4. 强调遵医嘱的重要性
5. 如果某项信息确实无法确定，请标注"具体请遵医嘱或咨询药师"`;

    console.log('分析提示词已生成，药品名称:', medicineData.name);

    let analysis = '';
    try {
      const analysisResponse = await axios.post(KIMI_API_URL, {
        model: 'moonshot-v1-8k',
        messages: [
          { role: 'system', content: '你是一位专业的药师助手，帮助用户理解药品说明书。' },
          { role: 'user', content: analysisPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1500
      }, {
        headers: {
          'Authorization': `Bearer ${KIMI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      analysis = analysisResponse.data.choices[0].message.content;
    } catch (analysisError) {
      console.error('AI 分析失败:', analysisError.message);
      // 使用模板生成分析
      analysis = `## 📋 药品名称\n${medicineData.name}\n\n## 💡 这药是治什么的？（适应症）\n${medicineData.indications}\n\n## 📅 怎么吃？（用法用量）\n${medicineData.usage}\n\n## ⚠️ 重要提醒（禁忌和注意事项）\n${medicineData.contraindications}\n\n## 😟 可能的不适（副作用）\n${medicineData.sideEffects}\n\n## ❓ 其他说明\n${medicineData.precautions}`;
    }

    // 调用 TTS 服务生成语音（分段处理）
    let ttsAudioSegments = [];
    try {
      if (ttsWs && ttsWs.readyState === WebSocket.OPEN) {
        console.log('正在生成语音...');
        
        // 将分析结果分段，去除 emoji
        const segments = splitAnalysisForTTS(analysis);
        console.log(`分段数量: ${segments.length}`);
        
        // 逐段生成语音
        for (let i = 0; i < segments.length; i++) {
          console.log(`生成第 ${i + 1}/${segments.length} 段语音...`);
          const ttsResponse = await sendToTTS(segments[i]);
          ttsAudioSegments.push({
            index: i,
            text: segments[i],
            audio: ttsResponse.audioData
          });
        }
        
        console.log('语音生成成功');
      }
    } catch (ttsError) {
      console.error('语音生成失败:', ttsError.message);
    }

    res.json({
      success: true,
      ocrText: ocrText,
      medicineData: medicineData,
      analysis: analysis,
      imageUrl: `/uploads/${req.file.filename}`,
      ttsAudioSegments: ttsAudioSegments
    });

  } catch (error) {
    console.error('分析错误:', error);
    res.status(500).json({ 
      success: false, 
      error: '分析失败，请重试' 
    });
  }
});

// 追问接口 - 使用 Kimi AI
app.post('/api/ask', async (req, res) => {
  const { question, medicineData } = req.body;

  if (!question) {
    return res.status(400).json({
      success: false,
      error: '请输入问题'
    });
  }

  try {
    // 构建系统提示词
    const systemPrompt = `你是一位专业的药师助手，帮助用户解答药品相关问题。请根据用户的问题提供准确、有用的用药建议。

重要原则：
1. 回答要简洁明了，使用通俗易懂的语言
2. 对于禁忌人群（孕妇、儿童等）要特别提醒
3. 强调遵医嘱的重要性
4. 不确定的问题要建议咨询医生
5. 使用 emoji 让回答更友好

当前药品信息：
${medicineData ? `
- 药品名称：${medicineData.name || '未知'}
- 用法用量：${medicineData.usage || '未知'}
- 适应症：${medicineData.indications || '未知'}
- 禁忌：${medicineData.contraindications || '未知'}
- 副作用：${medicineData.sideEffects || '未知'}
- 注意事项：${medicineData.precautions || '未知'}
` : '用户尚未上传药品信息，请建议用户先上传药品图片。'}`;

    // 调用 Kimi API
    const response = await axios.post(KIMI_API_URL, {
      model: 'moonshot-v1-8k',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      temperature: 0.7,
      max_tokens: 800,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${KIMI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    const answer = response.data.choices[0].message.content;

    res.json({
      success: true,
      answer: answer,
      source: 'kimi-ai'
    });

  } catch (error) {
    console.error('Kimi API 调用失败:', error.message);
    console.error('错误详情:', error.response ? JSON.stringify(error.response.data) : '无响应详情');

    // API 调用失败时的降级处理 - 使用本地模板回复
    let answer = '';
    const q = question.toLowerCase();

    if (q.includes('孕妇') || q.includes('怀孕') || q.includes('孕期')) {
      answer = '⚠️ **孕妇禁用**\n\n根据药品说明书，此药孕妇禁用。孕期用药需格外谨慎，建议您：\n- 立即咨询产科医生\n- 告知医生您的孕周和身体状况\n- 医生会为您开具孕期安全的替代药物\n\n孕期用药不当可能影响胎儿发育，务必遵医嘱！';
    } else if (q.includes('小孩') || q.includes('儿童') || q.includes('孩子') || q.includes('宝宝') || q.includes('婴儿')) {
      answer = '👶 **儿童用药须知**\n\n关于儿童能否使用此药：\n\n✅ **一般情况**：\n- 12岁以上儿童可在医生指导下减量使用\n- 6-12岁儿童需严格遵医嘱，通常剂量减半\n- 6岁以下儿童不建议自行使用\n\n⚠️ **重要提醒**：\n- 儿童肝肾功能尚未发育完全，代谢能力较弱\n- 建议使用儿童专用剂型（如混悬液、颗粒剂）\n- 必须根据体重精确计算剂量\n\n💡 **建议**：请咨询儿科医生，根据孩子年龄、体重和具体病情确定是否可用及正确剂量。';
    } else if (q.includes('副作用') || q.includes('不良反应') || q.includes('不舒服')) {
      answer = '😟 **可能出现的副作用**\n\n常见不良反应包括：\n• 恶心、呕吐、胃部不适\n• 头晕、嗜睡\n• 皮疹、瘙痒\n• 便秘或腹泻\n\n🩺 **应对措施**：\n- 轻微不适：可继续观察，多饮水\n- 症状持续：减少剂量或停药\n- 严重反应（呼吸困难、严重皮疹）：立即停药并就医\n\n💊 **减副小贴士**：\n饭后服用可减轻胃部刺激，避免空腹服药。';
    } else if (q.includes('用量') || q.includes('怎么吃') || q.includes('服用') || q.includes('吃几')) {
      answer = '📅 **用法用量指南**\n\n**标准用法**：\n口服，一次1片，一日3次\n\n⏰ **最佳服用时间**：\n- 早、中、晚餐后30分钟服用\n- 保持每8小时一次，维持血药浓度稳定\n\n🍽️ **服用建议**：\n- 用温开水送服，避免用茶水、咖啡、牛奶\n- 服药后保持直立姿势15分钟\n- 切勿咀嚼或碾碎药片（除非说明书允许）\n\n⚠️ **漏服处理**：\n如忘记服药，若距下次服药时间尚早可补服；若已接近下次服药时间，跳过本次，勿双倍服用。';
    } else if (q.includes('喝酒') || q.includes('饮酒') || q.includes('酒精')) {
      answer = '🍺 **用药期间严禁饮酒！**\n\n⚠️ **危险警告**：\n- 酒精可能增强药物副作用（头晕、嗜睡）\n- 增加肝脏代谢负担，可能导致肝损伤\n- 某些药物与酒精同服可能引发双硫仑样反应（面部潮红、心悸、呼吸困难）\n\n✅ **安全建议**：\n- 服药期间及停药后3天内避免饮酒\n- 注意含酒精的食品（如酒心巧克力、醉蟹）\n- 使用含酒精的漱口水也需谨慎\n\n🩺 如已饮酒，请密切观察身体反应，不适立即就医。';
    } else {
      answer = `关于您的问题"${question}"，建议您咨询专业医生或药师获取更准确的建议。本工具仅供参考，不能替代医生诊断。`;
    }

    // 返回降级回复，但标记为本地模式
    res.json({
      success: true,
      answer: answer,
      source: 'local-fallback',
      note: 'AI服务暂时不可用，已切换至本地回复模式'
    });
  }
});

// 静态文件访问
app.use('/uploads', express.static('uploads'));

// 启动服务
app.listen(PORT, () => {
  console.log(`💊 药匣子 MedBox AI 服务已启动`);
  console.log(`🌐 访问地址: http://localhost:${PORT}`);
  
  // 连接 TTS WebSocket 服务
  connectTTS();
});
