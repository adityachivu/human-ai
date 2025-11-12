// State management
let state = {
  timeRange: 30,
  topN: 20,
  domainData: [],
  chart: null,
};

// Blacklist instance
let blacklist = null;

// DOM elements
const loadingElement = document.getElementById('loading');
const topNSelector = document.getElementById('topN');
const timeRangeSelector = document.getElementById('timeRange');
const refreshBtn = document.getElementById('refreshBtn');

// Initialize
async function init() {
  console.log('Stats page initializing...');

  // Check if Chart.js is loaded
  if (typeof Chart === 'undefined') {
    console.error('Chart.js is not loaded!');
    alert('Error: Chart.js library failed to load. Please check your internet connection and reload the page.');
    return;
  }
  console.log('Chart.js loaded successfully');

  // Initialize blacklist
  blacklist = new Blacklist();
  await blacklist.load();
  console.log('Blacklist loaded');

  // Setup event listeners
  topNSelector.addEventListener('change', handleTopNChange);
  timeRangeSelector.addEventListener('change', handleTimeRangeChange);
  refreshBtn.addEventListener('click', loadAndRenderData);

  // Load initial data
  console.log('Loading initial data...');
  await loadAndRenderData();
  console.log('Initialization complete');
}

// Handle top N selector change
function handleTopNChange(e) {
  state.topN = e.target.value === 'all' ? Infinity : parseInt(e.target.value);
  renderChart();
}

// Handle time range selector change
async function handleTimeRangeChange(e) {
  state.timeRange = parseInt(e.target.value);
  await loadAndRenderData();
}

// Load and render data
async function loadAndRenderData() {
  console.log(`Loading data for ${state.timeRange} days...`);
  showLoading();

  try {
    // Fetch history for selected time range
    const history = await fetchHistory(state.timeRange);
    console.log(`Fetched ${history.length} history items`);

    // Process domain data (now async to get typed/clicked counts)
    state.domainData = await processDomainData(history);
    console.log(`Processed ${state.domainData.length} unique domains`);
    console.log('Top 5 domains:', state.domainData.slice(0, 5));

    // Update summary stats
    updateSummaryStats(state.domainData, history.length);

    // Render chart
    console.log('Rendering chart...');
    renderChart();
    console.log('Chart rendered successfully');
  } catch (error) {
    console.error('Error loading data:', error);
    alert(`Error loading data: ${error.message}`);
  } finally {
    hideLoading();
  }
}

// Fetch history from Chrome API
async function fetchHistory(days) {
  const endTime = Date.now();
  const startTime = endTime - (days * 24 * 60 * 60 * 1000);

  const historyItems = await chrome.history.search({
    text: '',
    startTime: startTime,
    endTime: endTime,
    maxResults: 100000,
  });

  // Filter out blacklisted items
  return historyItems.filter(item => {
    return !blacklist || !blacklist.matches(item.url);
  });
}

// Extract root domain from URL
function getRootDomain(url) {
  try {
    const hostname = new URL(url).hostname;
    const parts = hostname.split('.');

    // Handle special TLDs (co.uk, github.io, etc.)
    if (parts.length >= 3) {
      const secondLast = parts[parts.length - 2];
      if (['co', 'com', 'org', 'ac', 'gov', 'edu', 'net'].includes(secondLast)) {
        return parts.slice(-3).join('.');
      }
    }

    // Return last two parts (domain.tld)
    return parts.slice(-2).join('.');
  } catch (error) {
    return null;
  }
}

// Process domain data with typed/clicked tracking
async function processDomainData(historyItems) {
  const domainMap = new Map();
  const totalVisits = historyItems.length;

  // Group by domain and collect URLs
  historyItems.forEach(item => {
    const domain = getRootDomain(item.url);
    if (!domain) return;

    if (!domainMap.has(domain)) {
      domainMap.set(domain, {
        domain: domain,
        visitCount: 0,
        urls: new Set(),
        typedCount: 0,
        clickedCount: 0,
      });
    }

    const domainData = domainMap.get(domain);
    domainData.visitCount++;
    domainData.urls.add(item.url);
  });

  // Get typed vs clicked details for each domain
  console.log('Fetching visit details for typed vs clicked counts...');
  const domainEntries = Array.from(domainMap.entries());

  for (const [domain, data] of domainEntries) {
    let typedCount = 0;
    let clickedCount = 0;

    // Get visit details for each URL in this domain
    for (const url of data.urls) {
      try {
        const visits = await chrome.history.getVisits({ url });
        visits.forEach(visit => {
          if (visit.transition === 'typed') {
            typedCount++;
          } else {
            clickedCount++;
          }
        });
      } catch (error) {
        console.error(`Error getting visits for ${url}:`, error);
      }
    }

    data.typedCount = typedCount;
    data.clickedCount = clickedCount;
    data.percentage = ((data.visitCount / totalVisits) * 100).toFixed(1);
    delete data.urls; // Clean up, don't need this anymore
  }

  // Convert to array and sort by visit count
  const sortedData = Array.from(domainMap.values())
    .sort((a, b) => b.visitCount - a.visitCount);

  console.log('Domain data processed with typed/clicked counts');
  return sortedData;
}

// Update summary statistics
function updateSummaryStats(domainData, totalVisits) {
  document.getElementById('totalVisits').textContent = totalVisits.toLocaleString();
  document.getElementById('uniqueDomains').textContent = domainData.length.toLocaleString();

  if (domainData.length > 0) {
    document.getElementById('topDomain').textContent = domainData[0].domain;
  } else {
    document.getElementById('topDomain').textContent = 'N/A';
  }
}

// Render chart
function renderChart() {
  console.log('renderChart called');
  console.log('state.topN:', state.topN);
  console.log('state.domainData.length:', state.domainData.length);

  // Get top N domains
  const topDomains = state.domainData.slice(0, state.topN);
  console.log(`Rendering ${topDomains.length} domains`);

  if (topDomains.length === 0) {
    // No data to display
    console.warn('No domains to display');
    if (state.chart) {
      state.chart.destroy();
      state.chart = null;
    }
    const chartContainer = document.querySelector('.chart-container');
    chartContainer.innerHTML = '<p style="text-align: center; padding: 40px; color: #666;">No data available for the selected time range.</p><canvas id="histogramChart"></canvas>';
    return;
  }

  // Prepare data for chart
  const labels = topDomains.map(d => d.domain);
  const visitCounts = topDomains.map(d => d.visitCount);

  console.log('Chart data prepared:', { labels, visitCounts });

  // Destroy existing chart if any
  if (state.chart) {
    console.log('Destroying existing chart');
    state.chart.destroy();
  }

  // Create new chart
  try {
    const canvas = document.getElementById('histogramChart');
    if (!canvas) {
      console.error('Canvas element not found!');
      return;
    }
    console.log('Canvas found, creating chart...');

    const ctx = canvas.getContext('2d');
    state.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Visit Count',
            data: visitCounts,
            backgroundColor: 'rgba(102, 126, 234, 0.8)',
            borderColor: 'rgba(102, 126, 234, 1)',
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          title: {
            display: true,
            text: `Top ${topDomains.length} Most Visited Domains`,
            font: {
              size: 18,
              weight: 'bold',
            },
            padding: {
              bottom: 20,
            },
          },
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const domainData = topDomains[context.dataIndex];
                const lines = [];

                // Visit count
                lines.push(`Visits: ${context.parsed.y.toLocaleString()}`);

                // Percentage of total
                lines.push(`Percentage: ${domainData.percentage}% of total`);

                // Typed vs clicked
                if (domainData.typedCount > 0 || domainData.clickedCount > 0) {
                  lines.push(`Typed: ${domainData.typedCount.toLocaleString()}`);
                  lines.push(`Clicked: ${domainData.clickedCount.toLocaleString()}`);
                }

                return lines;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Number of Visits',
              font: {
                weight: 'bold',
                size: 14,
              },
            },
            ticks: {
              precision: 0,
            },
          },
          x: {
            title: {
              display: true,
              text: 'Domain',
              font: {
                weight: 'bold',
                size: 14,
              },
            },
          },
        },
      },
    });
    console.log('Chart created successfully');
  } catch (error) {
    console.error('Error creating chart:', error);
    alert(`Error creating chart: ${error.message}`);
  }
}

// Show loading indicator
function showLoading() {
  loadingElement.classList.add('visible');
}

// Hide loading indicator
function hideLoading() {
  loadingElement.classList.remove('visible');
}

// Start the application
init();
