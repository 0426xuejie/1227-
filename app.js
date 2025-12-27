// Supabase 配置 - 用户需要自己配置这些值
const SUPABASE_URL = 'https://psnhcdvfpgypntoglvkx.supabase.com'; // 用户需要填入 Project URL
const SUPABASE_KEY = 'sb_publishable_eJ4i6EsKcGiQeM6QKQd7kA_QquTlPVI'; // 用户需要填入 Publishable key

// 初始化 Supabase 客户端
let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

// DOM 元素
const chatContainer = document.getElementById('chatContainer');
const settingsPanel = document.getElementById('settingsPanel');
const settingsBtn = document.getElementById('settingsBtn');
const backToChatBtn = document.getElementById('backToChatBtn');
const saveConfigBtn = document.getElementById('saveConfigBtn');
const chatMessages = document.getElementById('chatMessages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const statusMessage = document.getElementById('statusMessage');
const configHint = document.getElementById('configHint');

// API 配置
let apiConfig = {
    apiUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    apiKey: 'bb2d566b7dca4025b1034ded1d6ebed4.Zc75wkPFt2W4Smoi',
    modelName: 'glm-4.7'
};

// 对话历史
let conversationHistory = [];

// 系统提示词 - P人变J计划小帮手
const SYSTEM_PROMPT = `你是一个专业的任务管理和计划制定助手，专门帮助P型人格的人转变为更有计划性的J型人格。你的名字是"P人变J计划小帮手"。

你的核心职责：
1. **接收任务**：当用户告诉你近期需要做的任务时，仔细倾听并理解任务内容
2. **任务拆解**：将大任务拆解成具体、可执行的小步骤
3. **制定计划**：为每个任务制定详细的时间表和执行计划
4. **进度跟踪**：每天与用户沟通，了解任务完成情况
5. **鼓励支持**：当用户完成任务时，给予真诚的鼓励和肯定
6. **计划调整**：如果任务未完成，帮助用户分析原因并更新计划

你的沟通风格：
- 温暖、鼓励、支持
- 专业但不死板
- 理解P型人格的特点，耐心引导
- 用emoji让对话更生动
- 给出具体可执行的建议

当用户说"添加新任务"、"今日汇报"或"查看计划"时，主动引导对话流程。`;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    // 检查是否已配置 Supabase
    if (!supabase) {
        showStatus('请先配置 SupABASE_URL 和 SUPABASE_KEY', 'error');
        showSettings();
        return;
    }

    // 加载配置
    await loadConfig();
    
    // 如果配置不存在，显示设置面板
    if (!apiConfig.apiKey) {
        showSettings();
        configHint.textContent = '首次使用需要配置 API 信息';
    } else {
        showChat();
        configHint.textContent = '配置已保存，如需修改请在此更新';
    }

    // 绑定事件
    settingsBtn.addEventListener('click', showSettings);
    backToChatBtn.addEventListener('click', showChat);
    saveConfigBtn.addEventListener('click', saveConfig);
    sendBtn.addEventListener('click', sendMessage);
    
    // 快捷按钮事件
    const quickActions = document.getElementById('quickActions');
    quickActions.addEventListener('click', (e) => {
        if (e.target.classList.contains('quick-btn')) {
            const action = e.target.dataset.action;
            handleQuickAction(action);
        }
    });
    
    // 回车发送消息（Shift+Enter 换行）
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 自动调整输入框高度
    messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
    });
});

// 显示聊天界面
function showChat() {
    chatContainer.style.display = 'flex';
    settingsPanel.style.display = 'none';
}

// 显示设置面板
function showSettings() {
    chatContainer.style.display = 'none';
    settingsPanel.style.display = 'block';
    
    // 填充当前配置
    document.getElementById('apiUrl').value = apiConfig.apiUrl;
    document.getElementById('apiKey').value = apiConfig.apiKey;
    document.getElementById('modelName').value = apiConfig.modelName;
}

// 加载配置
async function loadConfig() {
    if (!supabase) return;

    try {
        const { data, error } = await supabase
            .from('api_config')
            .select('*')
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 表示没有找到记录
            console.error('加载配置失败:', error);
            return;
        }

        if (data) {
            apiConfig = {
                apiUrl: data.api_url || apiConfig.apiUrl,
                apiKey: data.api_key || '',
                modelName: data.model_name || apiConfig.modelName
            };
        }
    } catch (error) {
        console.error('加载配置时出错:', error);
    }
}

// 保存配置
async function saveConfig() {
    const apiUrl = document.getElementById('apiUrl').value.trim();
    const apiKey = document.getElementById('apiKey').value.trim();
    const modelName = document.getElementById('modelName').value.trim();

    if (!apiUrl || !apiKey || !modelName) {
        showStatus('请填写所有配置项', 'error');
        return;
    }

    apiConfig = { apiUrl, apiKey, modelName };

    if (!supabase) {
        showStatus('Supabase 未配置', 'error');
        return;
    }

    try {
        // 检查是否已存在配置
        const { data: existing } = await supabase
            .from('api_config')
            .select('id')
            .limit(1)
            .single();

        if (existing) {
            // 更新现有配置
            const { error } = await supabase
                .from('api_config')
                .update({
                    api_url: apiUrl,
                    api_key: apiKey,
                    model_name: modelName,
                    updated_at: new Date().toISOString()
                })
                .eq('id', existing.id);

            if (error) throw error;
        } else {
            // 插入新配置
            const { error } = await supabase
                .from('api_config')
                .insert({
                    api_url: apiUrl,
                    api_key: apiKey,
                    model_name: modelName
                });

            if (error) throw error;
        }

        showStatus('配置保存成功！', 'success');
        
        // 2秒后返回聊天界面
        setTimeout(() => {
            showChat();
            statusMessage.style.display = 'none';
        }, 2000);

    } catch (error) {
        console.error('保存配置失败:', error);
        showStatus('保存配置失败: ' + error.message, 'error');
    }
}

// 显示状态消息
function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 3000);
    }
}

// 处理快捷操作
function handleQuickAction(action) {
    let message = '';
    switch(action) {
        case 'task':
            message = '我有个新任务，请帮我拆解和制定计划：';
            break;
        case 'report':
            message = '今天我来汇报一下任务进度：';
            break;
        case 'plan':
            message = '请帮我查看一下当前的任务计划：';
            break;
    }
    if (message) {
        messageInput.value = message;
        messageInput.focus();
        // 自动发送
        setTimeout(() => sendMessage(), 100);
    }
}

// 发送消息
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    if (!apiConfig.apiKey) {
        showStatus('请先配置 API 密钥', 'error');
        showSettings();
        return;
    }

    // 禁用输入和发送按钮
    messageInput.disabled = true;
    sendBtn.disabled = true;

    // 添加用户消息到界面
    addMessage('user', message);
    messageInput.value = '';
    messageInput.style.height = 'auto';

    // 添加到对话历史
    conversationHistory.push({
        role: 'user',
        content: message
    });
    
    // 构建消息历史（首次添加系统提示词）
    let messagesToSend = [];
    
    // 如果是首次对话，添加系统提示词
    // 智谱API支持system角色，如果不支持会自动忽略
    if (conversationHistory.length === 1) {
        messagesToSend.push({
            role: 'system',
            content: SYSTEM_PROMPT
        });
    }
    
    // 合并对话历史
    messagesToSend = messagesToSend.concat(conversationHistory);

    // 显示加载状态
    const loadingId = addMessage('assistant', '正在思考...', true);

    try {
        // 调用智谱 API
        const response = await fetch(apiConfig.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiConfig.apiKey}`
            },
            body: JSON.stringify({
                model: apiConfig.modelName,
                messages: messagesToSend,
                temperature: 0.8,
                stream: false
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API 请求失败: ${response.status}`);
        }

        const data = await response.json();
        const assistantMessage = data.choices[0]?.message?.content || '抱歉，没有收到回复。';

        // 移除加载消息
        removeMessage(loadingId);

        // 添加助手回复
        addMessage('assistant', assistantMessage);

        // 添加到对话历史
        conversationHistory.push({
            role: 'assistant',
            content: assistantMessage
        });

    } catch (error) {
        console.error('发送消息失败:', error);
        removeMessage(loadingId);
        addMessage('assistant', '抱歉，发生了错误: ' + error.message);
    } finally {
        // 恢复输入和发送按钮
        messageInput.disabled = false;
        sendBtn.disabled = false;
        messageInput.focus();
    }
}

// 添加消息到界面
function addMessage(role, content, isLoading = false) {
    // 移除欢迎消息
    const welcomeMsg = chatMessages.querySelector('.welcome-message');
    if (welcomeMsg) {
        welcomeMsg.remove();
    }

    const messageDiv = document.createElement('div');
    const messageId = 'msg-' + Date.now() + '-' + Math.random();
    messageDiv.id = messageId;
    messageDiv.className = `message ${role}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (isLoading) {
        contentDiv.innerHTML = '<span class="loading"></span> ' + content;
    } else {
        contentDiv.textContent = content;
    }

    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = new Date().toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });

    messageDiv.appendChild(contentDiv);
    messageDiv.appendChild(timeDiv);
    chatMessages.appendChild(messageDiv);

    // 滚动到底部
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return messageId;
}

// 移除消息
function removeMessage(messageId) {
    const message = document.getElementById(messageId);
    if (message) {
        message.remove();
    }
}

