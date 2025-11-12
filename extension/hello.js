document.getElementById('openFeed').addEventListener('click', () => {
  chrome.tabs.create({ url: 'feed.html' });
});

document.getElementById('openStats').addEventListener('click', () => {
  chrome.tabs.create({ url: 'stats.html' });
});
