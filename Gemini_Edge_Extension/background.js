chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateContent') {
    handleGeminiRequest(request.text, sendResponse);
    return true; // Keep the message channel open for async response
  }
});

async function handleGeminiRequest(text, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['geminiApiKey']);
    const apiKey = result.geminiApiKey;

    if (!apiKey) {
      sendResponse({ error: 'Chưa có API Key. Vui lòng cài đặt trong icon tiện ích.' });
      return;
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
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

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Lỗi kết nối đến Gemini.');
    }

    const data = await response.json();
    const generatedText = data.candidates[0].content.parts[0].text;
    
    sendResponse({ result: generatedText });

  } catch (error) {
    sendResponse({ error: error.message });
  }
}
