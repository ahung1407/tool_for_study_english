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
const HIGHLIGHT_NAME = 'gemini-tts-active';
const highlightApiSupported =
  typeof CSS !== 'undefined' &&
  CSS.highlights &&
  typeof Highlight !== 'undefined';

let highlightSpans = [];
let availableVoices = []; // Cache dọc theo trang báo để đọc là lên luôn

// Lấy danh sách giọng đọc xịn ngay từ lúc web vừa load xong
function loadVoices() {
    availableVoices = window.speechSynthesis.getVoices();
}
// Trình duyệt đôi khi tải voice chậm hơn cả script, cần lắng nghe event này
if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
}
// Chạy trước 1 lần đề phòng nó đã tải xong
loadVoices();

function clearHighlights() {
  if (highlightApiSupported) {
    CSS.highlights.delete(HIGHLIGHT_NAME);
  }

  highlightSpans.forEach(({span}) => {
    if (span && span.parentNode) {
      const textNode = document.createTextNode(span.textContent || '');
      span.parentNode.replaceChild(textNode, span);
    }
  });
  highlightSpans = [];
}

function buildRangeTextIndex(rangeBase) {
  const segments = [];
  const treeWalker = document.createTreeWalker(
    rangeBase.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    null
  );

  let node;
  let cursor = 0;

  while ((node = treeWalker.nextNode())) {
    if (!rangeBase.intersectsNode(node)) continue;

    const textLength = node.textContent.length;
    if (textLength === 0) continue;

    let startOffset = 0;
    let endOffset = textLength;

    if (node === rangeBase.startContainer) startOffset = rangeBase.startOffset;
    if (node === rangeBase.endContainer) endOffset = rangeBase.endOffset;
    if (rangeBase.startContainer === rangeBase.endContainer) {
      startOffset = rangeBase.startOffset;
      endOffset = rangeBase.endOffset;
    }

    if (endOffset <= startOffset) continue;

    const length = endOffset - startOffset;
    segments.push({
      node,
      nodeStart: startOffset,
      length,
      globalStart: cursor
    });
    cursor += length;
  }

  return { segments, total: cursor };
}

function rangeFromOffsets(startIndex, length, textIndex) {
  if (!textIndex || !textIndex.segments || length <= 0) return null;

  const endIndex = startIndex + length;
  let startNode = null;
  let startOffset = 0;
  let endNode = null;
  let endOffset = 0;

  for (const seg of textIndex.segments) {
    const segStart = seg.globalStart;
    const segEnd = seg.globalStart + seg.length;

    if (!startNode && startIndex >= segStart && startIndex < segEnd) {
      startNode = seg.node;
      startOffset = seg.nodeStart + (startIndex - segStart);
    }

    if (startNode && endIndex <= segEnd) {
      endNode = seg.node;
      endOffset = seg.nodeStart + (endIndex - segStart);
      break;
    }
  }

  if (!startNode || !endNode) return null;

  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

function applyHighlightRange(range, state) {
  if (!range) return;

  if (highlightApiSupported) {
    const highlight = new Highlight();
    highlight.add(range);
    CSS.highlights.set(HIGHLIGHT_NAME, highlight);
    return;
  }

  if (state.lastSpan && state.lastSpan.parentNode) {
    const textNode = document.createTextNode(state.lastSpan.textContent || '');
    state.lastSpan.parentNode.replaceChild(textNode, state.lastSpan);
  }

  const span = document.createElement('span');
  span.className = 'gemini-tts-highlight';
  const contents = range.extractContents();
  span.appendChild(contents);
  range.insertNode(span);
  highlightSpans.push({ span });
  state.lastSpan = span;
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

    const rangeText = rangeBase.toString();
    if (!rangeText.trim()) return;

    const sentences = rangeText.split(/(?<=[.!?\n])\s+/).filter(c => c.trim().length > 0);
    const maxChunkLength = 600;
    const chunks = [];
    let buffer = '';

    sentences.forEach((sentence) => {
      if ((buffer + ' ' + sentence).trim().length > maxChunkLength) {
        if (buffer.trim().length > 0) {
          chunks.push(buffer.trim());
        }
        buffer = sentence;
      } else {
        buffer = buffer ? `${buffer} ${sentence}` : sentence;
      }
    });

    if (buffer.trim().length > 0) {
      chunks.push(buffer.trim());
    }

    let validChunks = chunks;

    if (validChunks.length === 0) return;

    if (playerUI) {
      playerUI.style.display = 'flex';
      document.getElementById('gemini-tts-playpause').innerHTML = '⏸️';
    }

    const highlightState = {
      lastSpan: null,
      searchIndex: 0,
      textLower: rangeText.toLowerCase(),
      textIndex: highlightApiSupported ? buildRangeTextIndex(rangeBase) : null
    };

    validChunks.forEach((chunk, index) => {
      const u = new SpeechSynthesisUtterance(chunk.trim());

      const isEnglish = /[a-zA-Z]/.test(chunk);
      const targetLang = isEnglish ? 'en-US' : 'vi-VN';
      u.lang = targetLang;
      u.rate = rate;

      if (availableVoices.length > 0) {
        let bestVoice = availableVoices.find(v =>
          v.lang.startsWith(targetLang.substring(0, 2)) &&
          (v.name.includes('Natural') || v.name.includes('Online'))
        );

        if (!bestVoice) {
          bestVoice = availableVoices.find(v => v.lang.startsWith(targetLang.substring(0, 2)));
        }

        if (bestVoice) {
          u.voice = bestVoice;
        }
      }

      if (enableHighlight) {
        let lastWordHighlighted = null;

        u.onboundary = (event) => {
          if (event.name !== 'word') return;

          const wordStart = event.charIndex;
          let wordLength = event.charLength;

          if (!wordLength || wordLength === 0) {
            const remainingText = chunk.substring(wordStart);
            const match = remainingText.match(/^\S+/);
            if (match) wordLength = match[0].length;
            else wordLength = 1;
          }

          const word = chunk.substring(wordStart, wordStart + wordLength).trim();

          // Skip nếu từ rỗng hoặc từ này đã highlight
          if (word.length === 0 || word === lastWordHighlighted) return;
          lastWordHighlighted = word;

          const wordLower = word.toLowerCase();
          const matchIndex = highlightState.textLower.indexOf(wordLower, highlightState.searchIndex);

          if (matchIndex === -1) return;
          highlightState.searchIndex = matchIndex + wordLower.length;

          const textIndex = highlightApiSupported
            ? highlightState.textIndex
            : buildRangeTextIndex(rangeBase);

          const matchRange = rangeFromOffsets(matchIndex, word.length, textIndex);
          applyHighlightRange(matchRange, highlightState);
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
