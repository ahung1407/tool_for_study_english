document.addEventListener('DOMContentLoaded', () => {
  const ttsRateInput = document.getElementById('ttsRate');
  const rateValue = document.getElementById('rateValue');

  // Khôi phục settings Offline
  chrome.storage.local.get(['ttsRate'], (result) => {
    if (result.ttsRate) {
      ttsRateInput.value = result.ttsRate;
      rateValue.textContent = result.ttsRate;
    }
  });

  // Tự động lưu ngay khi kéo thanh trượt, không cần nút
  ttsRateInput.addEventListener('input', () => {
    rateValue.textContent = ttsRateInput.value;
    const rate = parseFloat(ttsRateInput.value);
    chrome.storage.local.set({ ttsRate: rate });
  });
});
