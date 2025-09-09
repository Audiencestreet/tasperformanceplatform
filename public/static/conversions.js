// Conversion analytics JavaScript
class ConversionAnalytics {
    constructor() {
        this.init();
    }
    
    init() {
        this.loadConversionStats();
        this.loadConversionAnalytics();
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        document.getElementById('google-sync-btn').addEventListener('click', () => {
            this.showGoogleSetupModal();
        });
        
        document.getElementById('facebook-sync-btn').addEventListener('click', () => {
            this.showFacebookSetupModal();
        });
    }
    
    async loadConversionStats() {
        try {
            // Load dashboard stats with conversion data
            const statsResponse = await axios.get('/api/dashboard/stats');
            if (statsResponse.data.success) {
                const stats = statsResponse.data.data;
                this.updateStatsDisplay(stats);
            }
            
            // Load conversion analytics
            const analyticsResponse = await axios.get('/api/conversions/analytics');
            if (analyticsResponse.data.success) {
                const analytics = analyticsResponse.data.data;
                this.updateConversionStats(analytics);
            }
        } catch (error) {
            console.error('Error loading conversion stats:', error);
        }
    }
    
    updateStatsDisplay(stats) {
        document.getElementById('total-conversions').textContent = stats.successful_posts || 0;
        document.getElementById('conversion-rate').textContent = `${(stats.success_rate || 0).toFixed(1)}%`;
        
        // Calculate conversion rate based on leads vs conversions
        const conversionRate = stats.total_leads > 0 ? 
            ((stats.successful_posts || 0) / stats.total_leads * 100).toFixed(1) : 0;
        document.getElementById('conversion-rate').textContent = `${conversionRate}%`;
    }
    
    updateConversionStats(analytics) {
        if (!analytics || analytics.length === 0) return;
        
        // Calculate totals
        const totalValue = analytics.reduce((sum, item) => sum + (item.total_value || 0), 0);
        const totalCount = analytics.reduce((sum, item) => sum + (item.count || 0), 0);
        const avgTime = analytics.reduce((sum, item) => sum + (item.avg_time_to_conversion || 0), 0) / analytics.length;
        
        document.getElementById('total-value').textContent = `$${totalValue.toFixed(2)}`;
        document.getElementById('total-conversions').textContent = totalCount;
        document.getElementById('avg-time').textContent = `${Math.round(avgTime)}h`;
        
        // Update charts
        this.createPlatformChart(analytics);
        this.createTimelineChart(analytics);
    }
    
    async loadConversionAnalytics() {
        try {
            const response = await axios.get('/api/conversions/analytics');
            if (response.data.success) {
                this.displayConversions(response.data.data);
            }
        } catch (error) {
            console.error('Error loading conversion analytics:', error);
            document.getElementById('conversions-list').innerHTML = `
                <div class="text-center py-8 text-red-500">
                    <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                    <p>Error loading conversion data</p>
                </div>
            `;
        }
    }
    
    displayConversions(conversions) {
        const container = document.getElementById('conversions-list');
        
        if (!conversions || conversions.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-chart-pie text-4xl mb-4"></i>
                    <h3 class="text-lg font-medium mb-2">No Conversions Yet</h3>
                    <p>Conversions will appear here once leads start converting.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Platform</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Count</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Value</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Value</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Time</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${conversions.map(conversion => this.renderConversionRow(conversion)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    renderConversionRow(conversion) {
        const platformColor = this.getPlatformColor(conversion.source_platform);
        
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${this.formatDate(conversion.date)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${conversion.conversion_type}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs rounded ${platformColor}">
                        ${conversion.source_platform || 'Direct'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${conversion.count}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    $${(conversion.total_value || 0).toFixed(2)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    $${(conversion.avg_value || 0).toFixed(2)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${Math.round(conversion.avg_time_to_conversion || 0)}h
                </td>
            </tr>
        `;
    }
    
    getPlatformColor(platform) {
        const colors = {
            'google': 'bg-red-100 text-red-800',
            'facebook': 'bg-blue-100 text-blue-800',
            'postback': 'bg-green-100 text-green-800',
            'pixel': 'bg-purple-100 text-purple-800'
        };
        return colors[platform] || 'bg-gray-100 text-gray-800';
    }
    
    createPlatformChart(analytics) {
        const ctx = document.getElementById('platform-chart').getContext('2d');
        
        // Aggregate by platform
        const platformData = analytics.reduce((acc, item) => {
            const platform = item.source_platform || 'Direct';
            acc[platform] = (acc[platform] || 0) + item.count;
            return acc;
        }, {});
        
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(platformData),
                datasets: [{
                    data: Object.values(platformData),
                    backgroundColor: [
                        '#3B82F6', // Blue
                        '#EF4444', // Red  
                        '#10B981', // Green
                        '#8B5CF6', // Purple
                        '#F59E0B', // Yellow
                        '#6B7280'  // Gray
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    createTimelineChart(analytics) {
        const ctx = document.getElementById('timeline-chart').getContext('2d');
        
        // Group by date
        const timelineData = analytics.reduce((acc, item) => {
            const date = item.date;
            if (!acc[date]) {
                acc[date] = { count: 0, value: 0 };
            }
            acc[date].count += item.count;
            acc[date].value += item.total_value || 0;
            return acc;
        }, {});
        
        const sortedDates = Object.keys(timelineData).sort();
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedDates.map(date => this.formatDate(date)),
                datasets: [{
                    label: 'Conversions',
                    data: sortedDates.map(date => timelineData[date].count),
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    yAxisID: 'y'
                }, {
                    label: 'Value ($)',
                    data: sortedDates.map(date => timelineData[date].value),
                    borderColor: '#10B981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    yAxisID: 'y1'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Conversions'
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Value ($)'
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }
    
    showGoogleSetupModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div class="mt-3">
                    <div class="flex items-center mb-4">
                        <i class="fab fa-google text-red-600 text-2xl mr-3"></i>
                        <h3 class="text-lg font-medium text-gray-900">Google Ads Integration</h3>
                    </div>
                    
                    <div class="space-y-4">
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 class="font-medium text-blue-800 mb-2">Enhanced Conversions Setup</h4>
                            <p class="text-sm text-blue-700">
                                Configure Google Ads Enhanced Conversions to send conversion data with hashed customer information for improved attribution.
                            </p>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Customer ID</label>
                            <input type="text" placeholder="123-456-7890" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Conversion Action ID</label>
                            <input type="text" placeholder="AW-123456789/AbCdEfGhIj" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Developer Token</label>
                            <input type="password" placeholder="Your Google Ads Developer Token" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                        </div>
                        
                        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <p class="text-sm text-yellow-800">
                                <strong>Note:</strong> In production, tokens should be stored securely using Cloudflare secrets.
                            </p>
                        </div>
                        
                        <div class="flex space-x-2">
                            <button class="flex-1 bg-red-600 text-white py-2 rounded-md hover:bg-red-700">
                                <i class="fab fa-google mr-2"></i>Connect Google Ads
                            </button>
                            <button onclick="this.closest('.fixed').remove()" 
                                    class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    showFacebookSetupModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div class="mt-3">
                    <div class="flex items-center mb-4">
                        <i class="fab fa-facebook text-blue-600 text-2xl mr-3"></i>
                        <h3 class="text-lg font-medium text-gray-900">Facebook Conversions API</h3>
                    </div>
                    
                    <div class="space-y-4">
                        <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h4 class="font-medium text-blue-800 mb-2">Conversions API Setup</h4>
                            <p class="text-sm text-blue-700">
                                Configure Facebook Conversions API to send server-side conversion events for improved tracking and attribution.
                            </p>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Pixel ID</label>
                            <input type="text" placeholder="123456789012345" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Access Token</label>
                            <input type="password" placeholder="Your Facebook App Access Token" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Test Event Code (Optional)</label>
                            <input type="text" placeholder="TEST12345" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                        </div>
                        
                        <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                            <p class="text-sm text-yellow-800">
                                <strong>Note:</strong> Test events will appear in Facebook Events Manager for verification.
                            </p>
                        </div>
                        
                        <div class="flex space-x-2">
                            <button class="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700">
                                <i class="fab fa-facebook mr-2"></i>Connect Facebook
                            </button>
                            <button onclick="this.closest('.fixed').remove()" 
                                    class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
        });
    }
}

// Initialize when page loads
let conversionAnalytics;
document.addEventListener('DOMContentLoaded', () => {
    conversionAnalytics = new ConversionAnalytics();
});