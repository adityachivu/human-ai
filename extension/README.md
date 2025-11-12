# History Feed - Chrome Extension

A Chrome extension that displays your browsing history as a social media-style feed with AI-powered chat capabilities and analytics.

## Features

- **📱 Social Media-Style Feed**: Scroll through your browsing history as beautiful cards, similar to Instagram or TikTok
- **💬 AI Chat Interface**: Chat with webpage content using multiple LLM providers (OpenAI, Anthropic Claude, Google Gemini)
- **📊 Statistics Dashboard**: Visualize your browsing patterns with interactive charts
- **🚫 Blacklist Filtering**: Filter out unwanted domains and URL patterns
- **🔍 Infinite Scroll**: Seamlessly load more history as you scroll
- **💾 Chat Persistence**: Conversations persist per URL within your session

## Installation (Developer Mode)

### Prerequisites

- **Google Chrome** (or any Chromium-based browser like Brave, Edge, Vivaldi)
- **Minimum Chrome Version**: 88 or higher (Manifest V3 support)

### Step 1: Download the Extension

1. Navigate to the extension folder on your computer:
   ```
   /human-ai/extension
   ```

2. Or clone/download the repository if accessing remotely

### Step 2: Open Chrome Extensions Page

1. Open Google Chrome
2. Navigate to the extensions page using one of these methods:
   - Type `chrome://extensions/` in the address bar and press Enter
   - Click the three dots menu (⋮) → **More tools** → **Extensions**
   - Use keyboard shortcut: `Cmd+Option+E` (Mac) or `Ctrl+Shift+E` (Windows/Linux)

### Step 3: Enable Developer Mode

1. Look for the **Developer mode** toggle in the top-right corner
2. Click the toggle to turn it **ON** (it should turn blue/enabled)

### Step 4: Load the Extension

1. Click the **"Load unpacked"** button (appears after enabling Developer mode)
2. In the file picker dialog, navigate to:
   ```
   /human-ai/extension
   ```
3. Select the **extension** folder and click **"Select"** or **"Open"**

### Step 5: Verify Installation

You should now see the extension card with:
- **Name**: History Feed
- **Description**: View your browsing history as a social media-style feed
- **Version**: 1.0
- **Extension ID**: (a unique identifier)
- **Enabled toggle**: Should be ON

### Step 6: Pin the Extension (Optional but Recommended)

1. Click the **puzzle piece icon** (🧩) in Chrome's toolbar
2. Find **"History Feed"** in the list
3. Click the **pin icon** (📌) next to it
4. The extension icon will now appear in your toolbar

## Configuration

### Setting Up AI Chat (Optional)

To use the chat feature with webpage content, you need to configure an LLM API:

#### Option 1: Google Gemini (Recommended - Free Tier Available)

1. Get an API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Open the History Feed page
3. Open browser console (F12 or Right-click → Inspect)
4. Run this command:
   ```javascript
   Config.save({
     apiKey: 'YOUR_GEMINI_API_KEY_HERE',
     provider: 'gemini',
     model: 'gemini-1.5-flash'
   })
   ```

#### Option 2: OpenAI (ChatGPT)

1. Get an API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Open browser console on the feed page and run:
   ```javascript
   Config.save({
     apiKey: 'sk-...',
     provider: 'openai',
     model: 'gpt-3.5-turbo'
   })
   ```

#### Option 3: Anthropic (Claude)

1. Get an API key from [Anthropic Console](https://console.anthropic.com/)
2. Open browser console and run:
   ```javascript
   Config.save({
     apiKey: 'sk-ant-...',
     provider: 'anthropic',
     model: 'claude-3-5-sonnet-20241022'
   })
   ```

### Configuring Blacklist

To filter domains from your history feed:

1. Open the file: `/extension/blacklist.json`
2. Add domains and URL patterns:
   ```json
   {
     "domains": [
       "example.com",           // Block exact domain
       "*.ads.com",             // Block all subdomains
       "*facebook*"             // Block any domain containing "facebook"
     ],
     "patterns": [
       "/login",                // Block URLs with /login
       "*checkout*",            // Block URLs with "checkout"
       "*?utm_source=*"         // Block URLs with utm_source parameter
     ]
   }
   ```
3. Save the file
4. Go to `chrome://extensions/` and click the **reload button** (🔄) on the extension

## Usage

### Opening the Extension

Click the **History Feed** icon in your Chrome toolbar, then choose:
- **Open History Feed** - Browse your history as cards
- **View Statistics** - See browsing analytics

### History Feed Page

**Features:**
- Scroll through history cards sorted by most recent
- Click any card to open AI chat interface
- Click the **↗ button** on a card to open URL in new tab
- Infinite scroll automatically loads more items

**Card Information:**
- Page title and URL
- Favicon/site icon
- Time since last visit (e.g., "2 hours ago")
- Visit count
- Filtered items counter (if blacklist is active)

### Chat Interface

**To start a conversation:**
1. Click on any history card
2. A modal opens with the page information
3. Click **"Fetch Page Content"** to load the webpage text
4. Type your question in the text field
5. Press **Enter** or click **➤** to send

**Chat Features:**
- Content preview (collapsible)
- Message history persists per URL
- Clear current chat or all chats
- Supports markdown in responses
- Keyboard shortcut: Enter to send, Shift+Enter for new line

### Statistics Page

**Metrics Displayed:**
- **Total Visits** - Number of pages visited in time range
- **Unique Domains** - Number of different domains visited
- **Most Visited** - Your top domain

**Interactive Chart:**
- Bar chart showing top N most visited domains
- Hover over bars for detailed tooltips:
  - Visit count
  - Percentage of total visits
  - Typed vs clicked visits

**Controls:**
- **Show Top**: Select 10, 20, 50, or all domains
- **Time Range**: Last 7, 30, or 90 days
- **Refresh**: Reload the data

## Troubleshooting

### Extension Not Loading

**Problem**: "Manifest file is missing or unreadable"
- **Solution**: Make sure you selected the correct `extension` folder that contains `manifest.json`

**Problem**: "Manifest version 2 is deprecated"
- **Solution**: Update Chrome to version 88 or higher

### Charts Not Displaying

**Problem**: Blank chart panel on statistics page
- **Solution**:
  1. Check browser console (F12) for errors
  2. Reload the extension at `chrome://extensions/`
  3. Ensure `chart.min.js` file exists in the extension folder

### Blacklist Not Working

**Problem**: Blacklisted domains still appear in feed
- **Solution**:
  1. Check `blacklist.json` has valid JSON syntax (no trailing commas)
  2. Reload the extension after making changes
  3. Open console and run: `blacklist.getRules()` to verify rules loaded
  4. Refresh the feed page

### Chat Feature Not Working

**Problem**: "API key not configured" message
- **Solution**: Follow the Configuration steps above to set up your API key

**Problem**: "Chart is not defined" error
- **Solution**: The Chart.js library didn't load. Reload the extension.

**Problem**: "Failed to fetch page content"
- **Solution**: Some websites block content fetching due to CORS. This is a browser security feature and cannot be bypassed.

### History Not Showing

**Problem**: Feed shows "No History Found"
- **Solution**:
  1. Make sure you have browsing history in Chrome
  2. Check if all domains are blacklisted
  3. Try increasing the time range in statistics page

## Updating the Extension

When you make changes to the extension files:

1. Go to `chrome://extensions/`
2. Find the **History Feed** extension
3. Click the **reload button** (🔄 circular arrow)
4. Refresh any open extension pages

## Permissions Explained

The extension requires these permissions:

- **history**: To read your browsing history
- **tabs**: To open new tabs when clicking cards
- **storage**: To save API keys and blacklist preferences
- **host_permissions (all_urls)**: To fetch webpage content for chat feature

## File Structure

```
extension/
├── manifest.json          # Extension configuration
├── hello.html            # Popup interface
├── hello.js              # Popup logic
├── feed.html             # Main history feed page
├── feed.css              # Feed styling
├── feed.js               # Feed functionality
├── stats.html            # Statistics page
├── stats.css             # Statistics styling
├── stats.js              # Statistics logic
├── config.js             # API and blacklist configuration
├── blacklist.json        # Domain filtering rules
├── chart.min.js          # Chart.js library
├── hello_extensions.png  # Extension icon
└── README.md            # This file
```

## Privacy & Data

- **All data stays local**: Your browsing history never leaves your computer
- **API keys stored locally**: Saved in Chrome's local storage (not synced)
- **Chat conversations**: Stored in memory only, cleared when tab closes
- **No tracking**: Extension does not collect or transmit any analytics

## Support & Issues

If you encounter any issues:

1. Check the **Troubleshooting** section above
2. Open browser console (F12) and check for error messages
3. Verify all files are present in the extension folder
4. Try reloading the extension

## Credits

- **Chart.js**: Data visualization library
- **Chrome History API**: Provided by Google Chrome
- **LLM Providers**: OpenAI, Anthropic, Google

## License

This extension is for personal use. Please review the terms of service for each LLM provider before use.

---

**Last Updated**: November 2024
**Version**: 1.0
**Manifest Version**: 3
