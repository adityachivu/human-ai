// Configuration
const CONFIG = {
  batchSize: 20,
  maxResults: 1000,
};

// State management
let state = {
  currentOffset: 0,
  isLoading: false,
  hasMore: true,
  allHistory: [],
  filteredCount: 0,
};

// Chat state
let chatState = {
  currentPage: null,
  pageContent: null,
  messages: [],
  isTyping: false,
};

// Chat history storage (persists within session, organized by URL)
let chatHistories = {};

// Blacklist instance
let blacklist = null;

// DOM elements
const feedElement = document.getElementById('feed');
const loadingElement = document.getElementById('loading');
const sentinelElement = document.getElementById('sentinel');

// Initialize the feed
async function init() {
  // Initialize blacklist
  blacklist = new Blacklist();
  await blacklist.load();

  // Load and filter all history once
  await loadAllHistory();

  // Start rendering first batch
  await loadMoreHistory();
  setupInfiniteScroll();
}

// Load and filter all history from Chrome API (called once on init)
async function loadAllHistory() {
  try {
    const endTime = Date.now();
    const startTime = 0; // Get all history

    const historyItems = await chrome.history.search({
      text: '',
      startTime: startTime,
      endTime: endTime,
      maxResults: CONFIG.maxResults,
    });

    // Sort by most recent visit
    historyItems.sort((a, b) => b.lastVisitTime - a.lastVisitTime);

    // Filter out blacklisted items (count filtered items ONCE)
    let filtered = 0;
    state.allHistory = historyItems.filter(item => {
      if (blacklist && blacklist.matches(item.url)) {
        filtered++;
        return false;
      }
      return true;
    });

    // Set filtered count once
    state.filteredCount = filtered;
    updateFilteredCountDisplay();

    console.log(`Loaded ${state.allHistory.length} history items, filtered ${filtered} items`);
  } catch (error) {
    console.error('Error loading history:', error);
    state.allHistory = [];
  }
}

// Get a batch of history items from cached filtered data
function getHistoryBatch(offset, limit) {
  return state.allHistory.slice(offset, offset + limit);
}

// Load more history items from cached filtered data
async function loadMoreHistory() {
  if (state.isLoading || !state.hasMore) return;

  state.isLoading = true;
  showLoading();

  try {
    // Get next batch from cached filtered history
    const historyItems = getHistoryBatch(state.currentOffset, CONFIG.batchSize);

    if (historyItems.length === 0) {
      state.hasMore = false;
      hideLoading();

      if (state.currentOffset === 0) {
        showEmptyState();
      }
      return;
    }

    // Get visit counts for each item
    const itemsWithVisitCount = await Promise.all(
      historyItems.map(async (item) => {
        const visits = await chrome.history.getVisits({ url: item.url });
        return {
          ...item,
          visitCount: visits.length,
        };
      })
    );

    renderCards(itemsWithVisitCount);
    state.currentOffset += historyItems.length;

    // Check if we've reached the end of cached history
    if (state.currentOffset >= state.allHistory.length) {
      state.hasMore = false;
    }
  } catch (error) {
    console.error('Error loading history:', error);
  } finally {
    state.isLoading = false;
    hideLoading();
  }
}

// Render history cards
function renderCards(historyItems) {
  const fragment = document.createDocumentFragment();

  historyItems.forEach((item) => {
    const card = createCard(item);
    fragment.appendChild(card);
  });

  feedElement.appendChild(fragment);
}

// Create a single card element (modular for extensibility)
function createCard(historyItem) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.url = historyItem.url;
  card.dataset.id = historyItem.id;

  // Extract domain for favicon
  const url = new URL(historyItem.url);
  const domain = url.hostname;
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  // Format timestamp
  const timeAgo = formatTimeAgo(historyItem.lastVisitTime);

  // Create card HTML
  card.innerHTML = `
    <div class="card-header">
      <div class="card-favicon">
        <img src="${faviconUrl}" alt="${domain}" onerror="this.parentElement.innerHTML='${domain.charAt(0).toUpperCase()}'">
      </div>
      <div class="card-info">
        <div class="card-title">${escapeHtml(historyItem.title || 'Untitled')}</div>
        <div class="card-url">${escapeHtml(historyItem.url)}</div>
      </div>
      <button class="card-open-button" title="Open in new tab">↗</button>
    </div>
    <div class="card-meta">
      <span class="card-meta-item">${timeAgo}</span>
      <span class="card-meta-item">${historyItem.visitCount} visit${historyItem.visitCount !== 1 ? 's' : ''}</span>
    </div>
  `;

  // Add click handler to open chat modal
  card.addEventListener('click', (e) => {
    // Don't open modal if clicking the open button
    if (!e.target.closest('.card-open-button')) {
      openChatModal(historyItem);
    }
  });

  // Add click handler to open in new tab button
  const openButton = card.querySelector('.card-open-button');
  openButton.addEventListener('click', (e) => {
    e.stopPropagation();
    chrome.tabs.create({ url: historyItem.url });
  });

  return card;
}

// Handle card click - open chat modal
function handleCardClick(historyItem) {
  openChatModal(historyItem);
}

// Format timestamp to "X time ago"
function formatTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return `${years} year${years !== 1 ? 's' : ''} ago`;
  if (months > 0) return `${months} month${months !== 1 ? 's' : ''} ago`;
  if (weeks > 0) return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
  if (days > 0) return `${days} day${days !== 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  return 'Just now';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Setup infinite scroll using Intersection Observer
function setupInfiniteScroll() {
  const options = {
    root: null,
    rootMargin: '200px',
    threshold: 0,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !state.isLoading && state.hasMore) {
        loadMoreHistory();
      }
    });
  }, options);

  observer.observe(sentinelElement);
}

// Show loading indicator
function showLoading() {
  loadingElement.classList.add('visible');
}

// Hide loading indicator
function hideLoading() {
  loadingElement.classList.remove('visible');
}

// Show empty state when no history
function showEmptyState() {
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';
  emptyState.innerHTML = `
    <h2>No History Found</h2>
    <p>Start browsing to see your history here!</p>
  `;
  feedElement.appendChild(emptyState);
}

// Update filtered count display
function updateFilteredCountDisplay() {
  const countElement = document.getElementById('filteredCount');
  if (!countElement) return;

  if (state.filteredCount > 0) {
    countElement.textContent = `${state.filteredCount} item${state.filteredCount !== 1 ? 's' : ''} filtered`;
    countElement.style.display = 'block';
  } else {
    countElement.style.display = 'none';
  }
}

// ============================================
// CHAT FUNCTIONALITY
// ============================================

// Open chat modal for a history item
function openChatModal(historyItem) {
  // Set current page
  chatState.currentPage = historyItem;
  chatState.isTyping = false;

  // Load existing chat history if available
  const existingChat = chatHistories[historyItem.url];
  if (existingChat) {
    chatState.messages = existingChat.messages || [];
    chatState.pageContent = existingChat.content || null;
  } else {
    chatState.messages = [];
    chatState.pageContent = null;
  }

  // Create modal backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'chatModal';

  // Extract domain for favicon
  const url = new URL(historyItem.url);
  const domain = url.hostname;
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

  // Create modal HTML
  backdrop.innerHTML = `
    <div class="modal-container">
      <div class="chat-header">
        <div class="card-favicon">
          <img src="${faviconUrl}" alt="${domain}" onerror="this.parentElement.innerHTML='${domain.charAt(0).toUpperCase()}'">
        </div>
        <div class="chat-header-content">
          <div class="chat-title">${escapeHtml(historyItem.title || 'Untitled')}</div>
          <div class="chat-url">${escapeHtml(historyItem.url)}</div>
        </div>
        <div class="chat-header-buttons">
          <button class="chat-clear-button" id="clearCurrentChat" title="Clear this chat">🗑️</button>
          <button class="chat-clear-all-button" id="clearAllChats" title="Clear all chats">🗑️ All</button>
          <button class="chat-close-button" id="closeChatModal">✕</button>
        </div>
      </div>
      <div class="chat-body">
        <div id="chatContentArea">
          <button class="fetch-content-button" id="fetchContentBtn">
            📄 Fetch Page Content
          </button>
        </div>
        <div class="chat-messages" id="chatMessages"></div>
      </div>
      <div class="chat-input-container">
        <div class="chat-input-wrapper">
          <textarea
            class="chat-input"
            id="chatInput"
            placeholder="Ask something about this page..."
            rows="1"
          ></textarea>
          <button class="chat-send-button" id="sendMessageBtn">➤</button>
        </div>
      </div>
    </div>
  `;

  // Add to document
  document.body.appendChild(backdrop);

  // Show modal with animation
  requestAnimationFrame(() => {
    backdrop.classList.add('active');
  });

  // Setup event listeners
  setupChatEventListeners(backdrop);

  // Render existing content if available
  if (chatState.pageContent) {
    renderExistingContent();
  }

  // Render existing messages if available
  if (chatState.messages.length > 0) {
    renderExistingMessages();
  }
}

// Setup event listeners for chat modal
function setupChatEventListeners(backdrop) {
  const closeButton = backdrop.querySelector('#closeChatModal');
  const clearCurrentButton = backdrop.querySelector('#clearCurrentChat');
  const clearAllButton = backdrop.querySelector('#clearAllChats');
  const fetchButton = backdrop.querySelector('#fetchContentBtn');
  const sendButton = backdrop.querySelector('#sendMessageBtn');
  const input = backdrop.querySelector('#chatInput');

  // Close modal
  closeButton.addEventListener('click', () => closeChatModal(backdrop));
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      closeChatModal(backdrop);
    }
  });

  // Clear chat buttons
  clearCurrentButton.addEventListener('click', () => clearCurrentChat());
  clearAllButton.addEventListener('click', () => clearAllChats());

  // Fetch content
  fetchButton.addEventListener('click', () => fetchPageContent());

  // Send message
  sendButton.addEventListener('click', () => sendMessage());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  });
}

// Close chat modal
function closeChatModal(backdrop) {
  backdrop.classList.remove('active');
  setTimeout(() => {
    backdrop.remove();
  }, 200);
}

// Fetch page content
async function fetchPageContent() {
  const button = document.getElementById('fetchContentBtn');
  const contentArea = document.getElementById('chatContentArea');

  if (!chatState.currentPage) return;

  button.disabled = true;
  button.textContent = '⏳ Fetching...';

  try {
    const response = await fetch(chatState.currentPage.url);
    const html = await response.text();

    // Parse HTML and extract text content
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove script, style, and other unwanted elements
    const unwantedElements = doc.querySelectorAll('script, style, noscript, iframe, svg');
    unwantedElements.forEach(el => el.remove());

    // Extract text content
    const textContent = doc.body.innerText || doc.body.textContent;
    const cleanedContent = textContent
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 10000); // Limit to 10k characters

    chatState.pageContent = cleanedContent;

    // Save to chat history
    saveChatHistory();

    // Display content preview
    contentArea.innerHTML = `
      <div class="content-preview">
        <div class="content-preview-header">
          <span class="content-preview-title">Page Content (${cleanedContent.length} characters)</span>
          <button class="content-preview-toggle" id="toggleContent">Expand</button>
        </div>
        <div class="content-preview-text collapsed" id="contentText">${escapeHtml(cleanedContent)}</div>
      </div>
    `;

    // Setup toggle
    const toggleButton = document.getElementById('toggleContent');
    const contentText = document.getElementById('contentText');
    toggleButton.addEventListener('click', () => {
      contentText.classList.toggle('collapsed');
      toggleButton.textContent = contentText.classList.contains('collapsed') ? 'Expand' : 'Collapse';
    });

    addSystemMessage('Page content fetched successfully! You can now ask questions about it.');

  } catch (error) {
    console.error('Error fetching content:', error);
    addErrorMessage(`Failed to fetch page content: ${error.message}. This might be due to CORS restrictions or the page being unavailable.`);
    button.textContent = '📄 Fetch Page Content';
    button.disabled = false;
  }
}

// Send message to LLM
async function sendMessage() {
  const input = document.getElementById('chatInput');
  const sendButton = document.getElementById('sendMessageBtn');
  const message = input.value.trim();

  if (!message || chatState.isTyping) return;

  // Add user message
  addMessage('user', message);
  input.value = '';
  input.style.height = 'auto';

  chatState.isTyping = true;
  sendButton.disabled = true;

  try {
    // Load configuration
    const config = await Config.load();

    // Check if API key is configured
    if (!config.apiKey && config.provider !== Config.PROVIDERS.CUSTOM) {
      addSettingsHint();
      chatState.isTyping = false;
      sendButton.disabled = false;
      return;
    }

    // Initialize LLM service
    const llmService = new LLMService(config);

    // Send message with context
    const response = await llmService.sendMessage(message, chatState.pageContent);

    // Add assistant response
    addMessage('assistant', response);

  } catch (error) {
    console.error('Error sending message:', error);
    addErrorMessage(`Error: ${error.message}`);
  } finally {
    chatState.isTyping = false;
    sendButton.disabled = false;
  }
}

// Add message to chat
function addMessage(role, content) {
  const messagesContainer = document.getElementById('chatMessages');
  const messageElement = document.createElement('div');
  messageElement.className = `message ${role}`;

  const avatar = role === 'user' ? 'U' : 'AI';

  messageElement.innerHTML = `
    <div class="message-avatar">${avatar}</div>
    <div class="message-content">${escapeHtml(content)}</div>
  `;

  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  chatState.messages.push({ role, content });
  saveChatHistory();
}

// Add system message
function addSystemMessage(content) {
  const messagesContainer = document.getElementById('chatMessages');
  const messageElement = document.createElement('div');
  messageElement.className = 'message assistant';

  messageElement.innerHTML = `
    <div class="message-avatar">ℹ️</div>
    <div class="message-content">${escapeHtml(content)}</div>
  `;

  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Add error message
function addErrorMessage(content) {
  const messagesContainer = document.getElementById('chatMessages');
  const messageElement = document.createElement('div');
  messageElement.className = 'message error';

  messageElement.innerHTML = `
    <div class="message-avatar">⚠️</div>
    <div class="message-content">${escapeHtml(content)}</div>
  `;

  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Add settings hint
function addSettingsHint() {
  const messagesContainer = document.getElementById('chatMessages');

  const hintElement = document.createElement('div');
  hintElement.className = 'settings-hint';
  hintElement.innerHTML = `
    <strong>⚙️ API Configuration Required</strong><br>
    To use the chat feature, you need to configure your LLM API settings.
    Open the browser console and run:<br>
    <code>Config.save({ apiKey: 'your-api-key', provider: 'gemini' })</code><br>
    <br>
    Supported providers: 'openai', 'anthropic', 'gemini', 'custom'
  `;

  messagesContainer.appendChild(hintElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ============================================
// CHAT PERSISTENCE HELPERS
// ============================================

// Save current chat state to history storage
function saveChatHistory() {
  if (!chatState.currentPage) return;

  chatHistories[chatState.currentPage.url] = {
    messages: [...chatState.messages],
    content: chatState.pageContent,
  };
}

// Clear current chat history
function clearCurrentChat() {
  if (!chatState.currentPage) return;

  if (confirm('Are you sure you want to clear this chat?')) {
    // Clear from storage
    delete chatHistories[chatState.currentPage.url];

    // Clear current state
    chatState.messages = [];
    chatState.pageContent = null;

    // Clear UI
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
      messagesContainer.innerHTML = '';
    }

    const contentArea = document.getElementById('chatContentArea');
    if (contentArea) {
      contentArea.innerHTML = `
        <button class="fetch-content-button" id="fetchContentBtn">
          📄 Fetch Page Content
        </button>
      `;

      // Re-attach event listener
      const fetchButton = document.getElementById('fetchContentBtn');
      if (fetchButton) {
        fetchButton.addEventListener('click', () => fetchPageContent());
      }
    }

    addSystemMessage('Chat cleared successfully.');
  }
}

// Clear all chat histories
function clearAllChats() {
  const chatCount = Object.keys(chatHistories).length;

  if (chatCount === 0) {
    alert('No chats to clear.');
    return;
  }

  if (confirm(`Are you sure you want to clear all ${chatCount} chat histories?`)) {
    chatHistories = {};
    alert('All chat histories cleared successfully.');
  }
}

// Render existing content when reopening chat
function renderExistingContent() {
  const contentArea = document.getElementById('chatContentArea');
  if (!contentArea || !chatState.pageContent) return;

  const cleanedContent = chatState.pageContent;

  contentArea.innerHTML = `
    <div class="content-preview">
      <div class="content-preview-header">
        <span class="content-preview-title">Page Content (${cleanedContent.length} characters)</span>
        <button class="content-preview-toggle" id="toggleContent">Expand</button>
      </div>
      <div class="content-preview-text collapsed" id="contentText">${escapeHtml(cleanedContent)}</div>
    </div>
  `;

  // Setup toggle
  const toggleButton = document.getElementById('toggleContent');
  const contentText = document.getElementById('contentText');
  if (toggleButton && contentText) {
    toggleButton.addEventListener('click', () => {
      contentText.classList.toggle('collapsed');
      toggleButton.textContent = contentText.classList.contains('collapsed') ? 'Expand' : 'Collapse';
    });
  }
}

// Render existing messages when reopening chat
function renderExistingMessages() {
  const messagesContainer = document.getElementById('chatMessages');
  if (!messagesContainer) return;

  chatState.messages.forEach((msg) => {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${msg.role}`;

    const avatar = msg.role === 'user' ? 'U' : 'AI';

    messageElement.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">${escapeHtml(msg.content)}</div>
    `;

    messagesContainer.appendChild(messageElement);
  });

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Start the application
init();
