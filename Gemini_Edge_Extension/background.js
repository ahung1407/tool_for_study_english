chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'generateContent') {
    handleGoogleTranslateRequest(request.text, sendResponse);
    return true; 
  }
});

async function handleGoogleTranslateRequest(text, sendResponse) {
  try {
    // Sử dụng public Google Translate API (không cần API key)
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=vi&dt=t&q=${encodeURIComponent(text)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Không thể kết nối với dịch vụ Google Dịch.');
    }

    const data = await response.json();
    
    // Response từ Google Translate API thường là mảng các mảng
    let translatedText = '';
    if (data[0] && Array.isArray(data[0])) {
        data[0].forEach(item => {
            if (item[0]) translatedText += item[0];
        });
    }

    if (!translatedText) {
        throw new Error('Dữ liệu dịch trống.');
    }
    
    // Trình bày kết quả gọn gàng
    const htmlResult = `
      <div style="margin-bottom: 5px; color: #666; font-size: 0.9em; font-style: italic;">
        "${text}" 
        <span style="background: #eef2ff; color: #4338ca; padding: 2px 6px; border-radius: 10px; font-size: 0.8em; margin-left: 5px;">
          Google Dịch
        </span>
      </div>
      <div style="font-weight: 500; font-size: 1.05em; color: #333;">
        ${translatedText}
      </div>
    `;
    
    sendResponse({ result: htmlResult });

  } catch (error) {
    console.error("Translate Error:", error);
    sendResponse({ error: error.message });
  }
}
