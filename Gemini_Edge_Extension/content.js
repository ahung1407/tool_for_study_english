let icon = null;
let speakerIconReadSelection = null; // Icon đọc cụm từ
let speakerIconReadFull = null;      // Icon đọc tới cuối trang
let tooltip = null;
let playerUI = null;
let activeUtterances = []; 
let currentSelectionText = ""; // Lưu text bôi đen thuần

// Initialize elements
function createElements() {
  // Create Translate Icon
  icon = document.createElement('div');
  icon.id = 'gemini-helper-icon';
  icon.innerHTML = '✨'; 
  icon.title = 'Dịch / Giải thích';
  icon.style.display = 'none';
  document.body.appendChild(icon);

  // Create Speaker Icon (Read Selection Only)
  speakerIconReadSelection = document.createElement('div');
  speakerIconReadSelection.id = 'gemini-speaker-selection';
  speakerIconReadSelection.className = 'gemini-speaker-icon';
  speakerIconReadSelection.innerHTML = '🔊'; 
  speakerIconReadSelection.title = 'Đọc phần bôi đen';
  speakerIconReadSelection.style.display = 'none';
  document.body.appendChild(speakerIconReadSelection);

  // Create Speaker Icon (Read to End)
  speakerIconReadFull = document.createElement('div');
  speakerIconReadFull.id = 'gemini-speaker-full';
  speakerIconReadFull.className = 'gemini-speaker-icon';
  speakerIconReadFull.innerHTML = '📑';  // Hoặc dùng SVG khác
  speakerIconReadFull.title = 'Đọc tới cuối trang';
  speakerIconReadFull.style.display = 'none';
  document.body.appendChild(speakerIconReadFull);

  // Create Tooltip
  tooltip = document.createElement('div');
  tooltip.id = 'gemini-helper-tooltip';
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);

  // Create Player UI
  playerUI = document.createElement('div');
  playerUI.id = 'gemini-tts-player';
  playerUI.style.display = 'none';
  playerUI.innerHTML = `
    <button id="gemini-tts-playpause" title="Tạm dừng / Tiếp tục">⏸️</button>
    <button id="gemini-tts-stop" title="Dừng đọc">⏹️</button>
  `;
  document.body.appendChild(playerUI);
  
  document.getElementById('gemini-tts-playpause').addEventListener('mousedown', (e) => {
    e.preventDefault(); e.stopPropagation();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      document.getElementById('gemini-tts-playpause').innerHTML = '⏸️';
    } else if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      document.getElementById('gemini-tts-playpause').innerHTML = '▶️';
    }
  });

  document.getElementById('gemini-tts-stop').addEventListener('mousedown', (e) => {
    e.preventDefault(); e.stopPropagation();
    stopReading();
  });

  // Event: Read Selection Only
  speakerIconReadSelection.addEventListener('mousedown', (e) => {
    e.preventDefault(); e.stopPropagation();
    stopReading(); 
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      // Đọc nguyên vùng chọn, KHÔNG highlight từ để giữ nguyên selection cho user bôi đi bôi lại
      startReading(range, false); 
    }
    // Cố tình KHÔNG ẩn các icon đi để user có thể bấm nút loa nhiều lần liên tiếp
  });

  // Event: Read Full Page
  speakerIconReadFull.addEventListener('mousedown', (e) => {
    e.preventDefault(); e.stopPropagation();
    stopReading(); 
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      // Tạo range chạy tới cuối trang
      const endRange = document.createRange();
      endRange.selectNodeContents(document.body);
      endRange.setStart(range.startContainer, range.startOffset);
      startReading(endRange, true); // Bật highlight
    }
    hideAllIcons();
  });

  // Icon Click Event
  icon.addEventListener('mousedown', (e) => {
    e.preventDefault(); // Prevent losing selection
    e.stopPropagation();
    const selection = window.getSelection();
    const text = selection.toString().trim();
    
    if (text) {
      showTooltipLoading();
      try {
        chrome.runtime.sendMessage({ action: 'generateContent', text: text }, (response) => {
          if (chrome.runtime.lastError) {
             // Often occurs if extension was reloaded but page wasn't
             showTooltipContent(`<b>Lỗi kết nối:</b> ${chrome.runtime.lastError.message}.<br><br>Hãy thử reload (F5) lại trang web này.`);
          } else if (response && response.error) {
             showTooltipContent(`<b>Lỗi từ AI:</b> ${response.error}`);
          } else if (response && response.result) {
             showTooltipContent(response.result);
          } else {
             showTooltipContent('Lỗi không xác định.');
          }
        });
      } catch (e) {
        showTooltipContent(`Lỗi: Extension đã bị thay đổi. Vui lòng F5 lại trang.`);
      }
    }
  });
}

function hideAllIcons() {
  if (icon) icon.style.display = 'none';
  if (speakerIconReadSelection) speakerIconReadSelection.style.display = 'none';
  if (speakerIconReadFull) speakerIconReadFull.style.display = 'none';
}

// Show icon near the END of selection
function handleSelection(e) {
  const selection = window.getSelection();
  const text = selection.toString().trim();

  if (text.length > 0) {
    currentSelectionText = text; 
    const range = selection.getRangeAt(0);
    const rects = range.getClientRects();
    
    if (rects.length > 0) {
      const lastRect = rects[rects.length - 1]; 
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      
      const baseTop = lastRect.bottom + scrollTop + 5;
      const baseLeft = lastRect.right + scrollLeft;

      // Position Translate Icon
      icon.style.top = `${baseTop}px`;
      icon.style.left = `${baseLeft}px`;
      icon.style.display = 'flex';

      // Position Speaker (Selection)
      speakerIconReadSelection.style.top = `${baseTop}px`;
      speakerIconReadSelection.style.left = `${baseLeft + 36}px`; 
      speakerIconReadSelection.style.display = 'flex';

      // Position Speaker (Full Page)
      speakerIconReadFull.style.top = `${baseTop}px`;
      speakerIconReadFull.style.left = `${baseLeft + 72}px`; 
      speakerIconReadFull.style.display = 'flex';
    }
  } else {
    hideAllIcons();
    currentSelectionText = "";
  }
}

// Show Tooltip in Loading State
function showTooltipLoading() {
  if (!tooltip) return;
  const iconRect = icon.getBoundingClientRect();
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

  // Align tooltip left with the icon, but push it down a bit
  tooltip.style.top = `${iconRect.bottom + scrollTop + 8}px`;
  // Attempt to keep it on screen
  let leftPos = iconRect.left + scrollLeft;
  if (leftPos + 300 > window.innerWidth) {
      leftPos = window.innerWidth - 310;
  }
  tooltip.style.left = `${leftPos}px`;
  
  tooltip.className = 'gemini-tooltip-loading';
  tooltip.innerHTML = '<div class="spinner"></div> <span>Đang suy nghĩ...</span>';
  tooltip.style.display = 'block';
}

// Update Tooltip Content
function showTooltipContent(content) {
  if (!tooltip) return;
  tooltip.className = ''; // Remove loading class
  
  // Gemini trả về HTML theo prompt, ta render trực tiếp
  // Xóa các block markdown ```html dư thừa nếu Gemini trả lầm
  let formattedContent = content
      .replace(/```html/g, "")
      .replace(/```/g, "")
      .trim();

  tooltip.innerHTML = formattedContent;
}

// Text to Speech logic
let highlightSpans = [];

function clearHighlights() {
  highlightSpans.forEach(({span, text}) => { // We store original text now
    if (span.parentNode) {
      const textNode = document.createTextNode(text);
      span.parentNode.replaceChild(textNode, span);
    }
  });
  highlightSpans = [];
}

function stopReading() {
  window.speechSynthesis.cancel();
  activeUtterances = [];
  clearHighlights();
  if (playerUI) playerUI.style.display = 'none';
}

function startReading(rangeBase, enableHighlight = true) {
  chrome.storage.local.get(['ttsRate'], (res) => {
    const rate = parseFloat(res.ttsRate) || 1.0;
    
    stopReading(); 
    
    // Khôi phục cách cũ cho ổn định: Lấy text thuần túy
    const textToRead = rangeBase.toString().trim();
    if (!textToRead) return;

    // Tách câu để khỏi bị quá giới hạn ký tự (250 chars)
    const chunks = textToRead.split(/(?<=[.!?\n])\s+/);
    let validChunks = chunks.filter(c => c.trim().length > 0);
    
    if (validChunks.length === 0) return;

    if (playerUI) {
      playerUI.style.display = 'flex';
      document.getElementById('gemini-tts-playpause').innerHTML = '⏸️';
    }

    // Biến để theo dõi node đang bôi đen hiện tại
    let currentHighlightTuple = null;

    validChunks.forEach((chunk, index) => {
        const u = new SpeechSynthesisUtterance(chunk.trim());
        u.lang = /[a-zA-Z]/.test(chunk) ? 'en-US' : 'vi-VN';
        u.rate = rate;
        
        // Dùng onboundary để bắt từng từ đang đọc (Chỉ khi bật)
        if (enableHighlight) {
            u.onboundary = (event) => {
                if (event.name !== 'word') return;
                
                const wordStart = event.charIndex;
                let wordLength = event.charLength;
                
                // Một số engine (như vi-VN trên Edge) không trả về charLength, ta phải tự đoán từ tiếp theo
                if (!wordLength || wordLength === 0) {
                     const remainingText = chunk.substring(wordStart);
                     const match = remainingText.match(/^[^\s.,!?]+/);
                     if (match) wordLength = match[0].length;
                     else wordLength = 1;
                }
                
                const word = chunk.substring(wordStart, wordStart + wordLength);
                
                // Xóa highlight cũ
                if (currentHighlightTuple) {
                     clearHighlights();
                }

                // Dùng Window API để tìm từ đó trên web và highlight mộc
                if (window.find && word.trim().length > 0) {
                    // CẢNH BÁO: Việc tìm kiếm này làm thay đổi Select Range của người dùng
                    const sel = window.getSelection();
                    sel.collapseToEnd();

                    // Lấy vị trí bắt đầu tìm kiếm
                    if (window.find(word, false, false, true, false, true, false)) {
                         const matchRange = window.getSelection().getRangeAt(0);
                         
                         // Chỉ bôi đen nếu nó nằm trong phạm vi ban đầu ta muốn đọc
                         if (rangeBase.compareBoundaryPoints(Range.START_TO_START, matchRange) <= 0 &&
                             rangeBase.compareBoundaryPoints(Range.END_TO_END, matchRange) >= 0) {
                             
                             const span = document.createElement('span');
                             span.className = 'gemini-tts-highlight';
                             
                             const extracted = matchRange.extractContents();
                             const textContent = extracted.textContent;
                             span.appendChild(extracted);
                             matchRange.insertNode(span);
                             
                             currentHighlightTuple = {span: span, text: textContent};
                             highlightSpans.push(currentHighlightTuple);
                             
                             // Scroll mượt
                             span.scrollIntoView({ behavior: 'smooth', block: 'center' });
                         }
                    }
                }
            };
        }

        if (index === validChunks.length - 1) {
            u.onend = () => { stopReading(); };
        }
        
        activeUtterances.push(u);
        window.speechSynthesis.speak(u);
    });
  });
}

// Event Listeners
document.addEventListener('DOMContentLoaded', createElements);
// In case DOMContentLoaded already fired
if (document.body) createElements();

document.addEventListener('mouseup', (e) => {
  // Delay slightly to let selection settle
  setTimeout(() => handleSelection(e), 10);
});

// Hide click outside
document.addEventListener('mousedown', (e) => {
  const isClickOnIcons = (e.target === icon) || 
                         (e.target === speakerIconReadSelection) || 
                         (e.target === speakerIconReadFull);

  if (tooltip && tooltip.style.display === 'block') {
    if (!tooltip.contains(e.target) && !isClickOnIcons && (!playerUI || !playerUI.contains(e.target))) {
      tooltip.style.display = 'none';
      stopReading(); 
    }
  }
  
  if (!isClickOnIcons && (!playerUI || !playerUI.contains(e.target))) {
     setTimeout(() => {
        if (window.getSelection().toString().trim().length === 0) {
            hideAllIcons();
        }
     }, 100);
  }
});
