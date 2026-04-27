chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateContent') {
    handleGeminiRequest(request.text, sendResponse);
    return true; // Keep the message channel open for async response
  }
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGeminiModel(apiKey, modelName, payload, maxRetries = 2) {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    let response;
    let errorData = null;

    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
    } catch (networkError) {
      if (attempt < maxRetries) {
        await sleep(500 * (attempt + 1));
        continue;
      }

      const error = new Error('Không thể kết nối tới Gemini. Hãy kiểm tra mạng và thử lại.');
      error.status = 0;
      error.transient = true;
      throw error;
    }

    if (response.ok) {
      return response.json();
    }

    try {
      errorData = await response.json();
    } catch (parseError) {
      errorData = null;
    }

    const message = errorData?.error?.message || `Gemini API error ${response.status}`;
    const transient = [429, 500, 503].includes(response.status) || /high demand|temporar|try again later/i.test(message);

    if (transient && attempt < maxRetries) {
      await sleep(600 * (attempt + 1));
      continue;
    }

    const error = new Error(message);
    error.status = response.status;
    error.transient = transient;
    throw error;
  }

  const unknownError = new Error('Không nhận được phản hồi hợp lệ từ Gemini.');
  unknownError.status = 0;
  unknownError.transient = true;
  throw unknownError;
}

async function fetchAvailableGenerateModels(apiKey) {
  const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  let response;
  try {
    response = await fetch(listUrl, { method: 'GET' });
  } catch (networkError) {
    const error = new Error('Không thể kết nối để lấy danh sách model.');
    error.status = 0;
    throw error;
  }

  if (!response.ok) {
    let errorData = null;
    try {
      errorData = await response.json();
    } catch (parseError) {
      errorData = null;
    }

    const error = new Error(errorData?.error?.message || `Gemini API error ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const models = Array.isArray(data?.models) ? data.models : [];

  return models
    .filter((m) => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => String(m.name || '').replace('models/', ''))
    .filter((name) => Boolean(name));
}

function buildModelCandidates(availableModels) {
  const preferredModels = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
  ];

  if (!Array.isArray(availableModels) || availableModels.length === 0) {
    return [];
  }

  const availableSet = new Set(availableModels);
  const candidates = [];

  preferredModels.forEach((name) => {
    if (availableSet.has(name)) {
      candidates.push(name);
    }
  });

  if (candidates.length > 0) {
    return candidates;
  }

  const flashLike = availableModels.filter((name) => /^gemini/i.test(name) && /flash|pro/i.test(name));
  return flashLike.length > 0 ? flashLike.slice(0, 5) : availableModels.slice(0, 5);
}

function toUserError(error) {
  const message = String(error?.message || '');
  const status = error?.status;

  if (/high demand|temporar|try again later/i.test(message) || status === 503) {
    return 'Model đang quá tải tạm thời. Extension đã tự thử lại và đổi model dự phòng nhưng chưa thành công. Vui lòng thử lại sau 1-2 phút.';
  }

  if (status === 429 || /rate limit|quota/i.test(message)) {
    return 'Bạn đã chạm giới hạn tần suất hoặc quota API. Hãy đợi một lúc hoặc kiểm tra quota/billing của API key.';
  }

  if (status === 401 || status === 403 || /api key|permission|unauth/i.test(message)) {
    return 'API key không hợp lệ hoặc chưa có quyền dùng model này. Hãy kiểm tra lại API key trong popup extension.';
  }

  if (status === 404 || /not found/i.test(message)) {
    return 'Model hiện không khả dụng cho API key hoặc khu vực của bạn. Hãy thử lại sau.';
  }

  if (status === 400) {
    return `Yêu cầu không hợp lệ: ${message}`;
  }

  return message || 'Có lỗi khi gọi Gemini API.';
}

async function handleGeminiRequest(text, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['geminiApiKey']);
    const apiKey = result.geminiApiKey;

    if (!apiKey) {
      sendResponse({ error: 'Chưa có API Key. Vui lòng cài đặt trong icon tiện ích.' });
      return;
    }
    
    // Prompt được tối ưu cho việc giải thích chi tiết/dịch
    const systemPrompt = `Bạn là một từ điển công nghệ và trợ lý ngôn ngữ xuất sắc. Hãy xử lý đoạn text người dùng chọn theo quy tắc sau:
1. Nếu là MỘT TỪ hoặc CỤM TỪ ngắn:
   - Cung cấp các tầng nghĩa ngắn gọn.
   - Kèm theo phiên âm (nếu có).
   - Đưa ra 1-2 ví dụ cách dùng trong câu (kèm dịch).
2. Nếu là MỘT CÂU hoặc ĐOẠN VĂN:
   - Dịch sang tiếng Việt sát nghĩa và tự nhiên nhất.
   - Trích xuất 2-3 từ vựng/cấu trúc quan trọng nhất trong đoạn đó và giải thích ngắn gọn.
Trình bày kết quả trực tiếp bằng HTML siêu gọn gàng (dùng <b>, <i>, <br>, <ul>, <li>). Không dùng Markdown. Không cần lời chào hỏi.`;
    
    const payload = {
      contents: [{
        parts: [{
          text: `${systemPrompt}\n\nText cần xử lý:\n"${text}"`
        }]
      }]
    };

    let availableModels = [];
    try {
      availableModels = await fetchAvailableGenerateModels(apiKey);
    } catch (listError) {
      // Nếu không lấy được danh sách model, vẫn thử các model phổ biến.
      if ([401, 403].includes(listError.status)) {
        throw listError;
      }
    }

    const fallbackModels = buildModelCandidates(availableModels);

    if (availableModels.length > 0 && fallbackModels.length === 0) {
      throw new Error('API key hiện tại không có model generateContent khả dụng ở khu vực này.');
    }

    const modelsToTry = fallbackModels.length > 0
      ? fallbackModels
      : ['gemini-2.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash'];

    let data = null;
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        data = await callGeminiModel(apiKey, model, payload, 2);
        break;
      } catch (modelError) {
        lastError = modelError;

        // Không cần thử model khác nếu key/quyền sai.
        if ([400, 401, 403].includes(modelError.status)) {
          break;
        }
      }
    }

    if (!data) {
      throw lastError || new Error('Không thể lấy phản hồi từ Gemini.');
    }

    const generatedText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('Gemini trả về phản hồi rỗng.');
    }
    
    sendResponse({ result: generatedText });

  } catch (error) {
    sendResponse({ error: toUserError(error) });
  }
}
