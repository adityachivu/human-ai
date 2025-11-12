// Configuration management for LLM API
class Config {
  static STORAGE_KEYS = {
    API_KEY: 'llm_api_key',
    PROVIDER: 'llm_provider',
    ENDPOINT: 'llm_endpoint',
    MODEL: 'llm_model',
  };

  static PROVIDERS = {
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
    GEMINI: 'gemini',
    CUSTOM: 'custom',
  };

  static DEFAULT_SETTINGS = {
    provider: Config.PROVIDERS.OPENAI,
    temperature: 0.7,
    maxTokens: 2000,
  };

  // Load configuration from Chrome storage
  static async load() {
    return new Promise((resolve) => {
      chrome.storage.local.get(
        [
          Config.STORAGE_KEYS.API_KEY,
          Config.STORAGE_KEYS.PROVIDER,
          Config.STORAGE_KEYS.ENDPOINT,
          Config.STORAGE_KEYS.MODEL,
        ],
        (result) => {
          resolve({
            apiKey: result[Config.STORAGE_KEYS.API_KEY] || '',
            provider: result[Config.STORAGE_KEYS.PROVIDER] || Config.DEFAULT_SETTINGS.provider,
            endpoint: result[Config.STORAGE_KEYS.ENDPOINT] || '',
            model: result[Config.STORAGE_KEYS.MODEL] || '',
          });
        }
      );
    });
  }

  // Save configuration to Chrome storage
  static async save(config) {
    return new Promise((resolve) => {
      const data = {};
      if (config.apiKey !== undefined) data[Config.STORAGE_KEYS.API_KEY] = config.apiKey;
      if (config.provider !== undefined) data[Config.STORAGE_KEYS.PROVIDER] = config.provider;
      if (config.endpoint !== undefined) data[Config.STORAGE_KEYS.ENDPOINT] = config.endpoint;
      if (config.model !== undefined) data[Config.STORAGE_KEYS.MODEL] = config.model;

      chrome.storage.local.set(data, resolve);
    });
  }
}

// Abstract LLM Service with provider implementations
class LLMService {
  constructor(config) {
    this.config = config;
  }

  // Main method to send a message to the LLM
  async sendMessage(userMessage, context = null) {
    const { provider, apiKey, endpoint, model } = this.config;

    if (!apiKey && provider !== Config.PROVIDERS.CUSTOM) {
      throw new Error('API key not configured. Please add your API key in settings.');
    }

    switch (provider) {
      case Config.PROVIDERS.OPENAI:
        return await this._sendToOpenAI(userMessage, context, apiKey, model);
      case Config.PROVIDERS.ANTHROPIC:
        return await this._sendToAnthropic(userMessage, context, apiKey, model);
      case Config.PROVIDERS.GEMINI:
        return await this._sendToGemini(userMessage, context, apiKey, model);
      case Config.PROVIDERS.CUSTOM:
        return await this._sendToCustom(userMessage, context, endpoint, apiKey, model);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  // OpenAI API implementation
  async _sendToOpenAI(userMessage, context, apiKey, model = 'gpt-3.5-turbo') {
    const messages = [];

    if (context) {
      messages.push({
        role: 'system',
        content: `You are a helpful assistant. Here is the content of a webpage the user is asking about:\n\n${context}`,
      });
    }

    messages.push({
      role: 'user',
      content: userMessage,
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: Config.DEFAULT_SETTINGS.temperature,
        max_tokens: Config.DEFAULT_SETTINGS.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  // Anthropic Claude API implementation
  async _sendToAnthropic(userMessage, context, apiKey, model = 'claude-3-5-sonnet-20241022') {
    let systemPrompt = 'You are a helpful assistant.';
    let userContent = userMessage;

    if (context) {
      systemPrompt = `You are a helpful assistant. Here is the content of a webpage the user is asking about:\n\n${context}`;
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model,
        max_tokens: Config.DEFAULT_SETTINGS.maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Anthropic API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  // Google Gemini API implementation
  async _sendToGemini(userMessage, context, apiKey, model = 'gemini-1.5-flash') {
    let fullPrompt = userMessage;

    if (context) {
      fullPrompt = `You are a helpful assistant. Here is the content of a webpage the user is asking about:\n\n${context}\n\nUser question: ${userMessage}`;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: fullPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: Config.DEFAULT_SETTINGS.temperature,
          maxOutputTokens: Config.DEFAULT_SETTINGS.maxTokens,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json();

    // Check if response has candidates
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('Gemini API returned no response candidates');
    }

    return data.candidates[0].content.parts[0].text;
  }

  // Custom endpoint implementation (flexible for any API)
  async _sendToCustom(userMessage, context, endpoint, apiKey, model) {
    if (!endpoint) {
      throw new Error('Custom endpoint not configured.');
    }

    // Generic implementation - can be customized based on the API format
    const payload = {
      message: userMessage,
      context: context,
      model: model,
      temperature: Config.DEFAULT_SETTINGS.temperature,
      max_tokens: Config.DEFAULT_SETTINGS.maxTokens,
    };

    const headers = {
      'Content-Type': 'application/json',
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Custom API error: ${response.statusText}`);
    }

    const data = await response.json();
    // Assumes response has a 'response' or 'message' field
    return data.response || data.message || data.content || JSON.stringify(data);
  }
}

// Blacklist management for filtering history items
class Blacklist {
  static STORAGE_KEY = 'history_blacklist';

  constructor() {
    this.rules = {
      domains: [],
      patterns: [],
    };
  }

  // Load blacklist from file and Chrome storage
  async load() {
    try {
      // Load from blacklist.json file using chrome.runtime.getURL
      const url = chrome.runtime.getURL('blacklist.json');
      console.log('Loading blacklist from:', url);

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        this.rules.domains = data.domains || [];
        this.rules.patterns = data.patterns || [];
        console.log('Blacklist loaded successfully:', {
          domains: this.rules.domains.length,
          patterns: this.rules.patterns.length
        });
        console.log('Domains:', this.rules.domains);
        console.log('Patterns:', this.rules.patterns);
      } else {
        console.error('Failed to load blacklist.json:', response.status, response.statusText);
      }

      // Merge with Chrome storage (user additions via console)
      const stored = await this._loadFromStorage();
      if (stored) {
        this.rules.domains = [...new Set([...this.rules.domains, ...(stored.domains || [])])];
        this.rules.patterns = [...new Set([...this.rules.patterns, ...(stored.patterns || [])])];
        console.log('Merged with storage. Final counts:', {
          domains: this.rules.domains.length,
          patterns: this.rules.patterns.length
        });
      }
    } catch (error) {
      console.error('Error loading blacklist:', error);
    }

    return this.rules;
  }

  // Load from Chrome storage
  async _loadFromStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get([Blacklist.STORAGE_KEY], (result) => {
        resolve(result[Blacklist.STORAGE_KEY] || null);
      });
    });
  }

  // Save additional rules to Chrome storage
  async save(rules) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [Blacklist.STORAGE_KEY]: rules }, resolve);
    });
  }

  // Add a domain to blacklist
  async addDomain(domain) {
    const stored = await this._loadFromStorage() || { domains: [], patterns: [] };
    if (!stored.domains.includes(domain)) {
      stored.domains.push(domain);
      await this.save(stored);
      this.rules.domains.push(domain);
    }
  }

  // Add a pattern to blacklist
  async addPattern(pattern) {
    const stored = await this._loadFromStorage() || { domains: [], patterns: [] };
    if (!stored.patterns.includes(pattern)) {
      stored.patterns.push(pattern);
      await this.save(stored);
      this.rules.patterns.push(pattern);
    }
  }

  // Remove a domain from blacklist
  async removeDomain(domain) {
    const stored = await this._loadFromStorage() || { domains: [], patterns: [] };
    stored.domains = stored.domains.filter(d => d !== domain);
    await this.save(stored);
    this.rules.domains = this.rules.domains.filter(d => d !== domain);
  }

  // Remove a pattern from blacklist
  async removePattern(pattern) {
    const stored = await this._loadFromStorage() || { domains: [], patterns: [] };
    stored.patterns = stored.patterns.filter(p => p !== pattern);
    await this.save(stored);
    this.rules.patterns = this.rules.patterns.filter(p => p !== pattern);
  }

  // Check if a URL matches any blacklist rule
  matches(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      const fullUrl = url.toLowerCase();

      // Check domain patterns
      for (const domainPattern of this.rules.domains) {
        if (this._matchDomain(hostname, domainPattern.toLowerCase())) {
          return true;
        }
      }

      // Check URL patterns
      for (const urlPattern of this.rules.patterns) {
        if (this._matchPattern(fullUrl, urlPattern.toLowerCase())) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error matching URL:', url, error);
      return false;
    }
  }

  // Match domain with wildcard support
  _matchDomain(hostname, pattern) {
    // Exact match
    if (hostname === pattern) {
      return true;
    }

    // Wildcard pattern
    if (pattern.includes('*')) {
      // Convert wildcard pattern to regex
      const regexPattern = pattern
        .replace(/\./g, '\\.')  // Escape dots
        .replace(/\*/g, '.*');   // Convert * to .*

      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(hostname);
    }

    return false;
  }

  // Match URL pattern with wildcard support
  _matchPattern(url, pattern) {
    // Simple contains check if no wildcards
    if (!pattern.includes('*')) {
      return url.includes(pattern);
    }

    // Wildcard pattern
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')  // Escape special regex chars except *
      .replace(/\*/g, '.*');                    // Convert * to .*

    const regex = new RegExp(regexPattern);
    return regex.test(url);
  }

  // Get all blacklist rules
  getRules() {
    return { ...this.rules };
  }

  // Clear all storage rules (keeps file rules)
  async clearStorage() {
    await chrome.storage.local.remove(Blacklist.STORAGE_KEY);
    await this.load(); // Reload from file only
  }
}

// Export for use in other scripts
window.Config = Config;
window.LLMService = LLMService;
window.Blacklist = Blacklist;
