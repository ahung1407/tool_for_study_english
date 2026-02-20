document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKey');
  const ttsRateInput = document.getElementById('ttsRate');
  const rateValue = document.getElementById('rateValue');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');

  // Load existing key and settings
  chrome.storage.local.get(['geminiApiKey', 'ttsRate'], (result) => {
    if (result.geminiApiKey) {
      apiKeyInput.value = result.geminiApiKey;
    }
    if (result.ttsRate) {
      ttsRateInput.value = result.ttsRate;
      rateValue.textContent = result.ttsRate;
    }
  });

  // Update label on slide
  ttsRateInput.addEventListener('input', () => {
    rateValue.textContent = ttsRateInput.value;
  });

  saveBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    const rate = parseFloat(ttsRateInput.value);

    if (!key) {
      status.textContent = 'Vui lòng nhập API Key.';
      status.className = 'error';
      return;
    }

    chrome.storage.local.set({ geminiApiKey: key, ttsRate: rate }, () => {
      status.textContent = 'Đã lưu thành công!';
      status.className = 'success';
      setTimeout(() => {
        status.textContent = '';
        status.className = '';
      }, 3000);
    });
  });
});
