// Postback management JavaScript
class PostbackManager {
    constructor() {
        this.init();
    }
    
    init() {
        this.loadPostbacks();
        this.loadPostbackLogs();
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        document.getElementById('create-postback-btn').addEventListener('click', () => {
            this.showCreatePostbackModal();
        });
    }
    
    async loadPostbacks() {
        try {
            // Using affiliate_id=1 as default for demo
            const response = await axios.get('/api/postbacks?affiliate_id=1');
            if (response.data.success) {
                this.displayPostbacks(response.data.data);
            } else {
                this.showError('Failed to load postbacks');
            }
        } catch (error) {
            console.error('Error loading postbacks:', error);
            this.showError('Network error loading postbacks');
        }
    }
    
    displayPostbacks(postbacks) {
        const container = document.getElementById('postbacks-list');
        
        if (!postbacks || postbacks.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-webhook text-4xl mb-4"></i>
                    <h3 class="text-lg font-medium mb-2">No Postbacks Configured</h3>
                    <p>Create your first postback URL to start receiving notifications.</p>
                    <button onclick="postbackManager.showCreatePostbackModal()" class="mt-4 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
                        <i class="fas fa-plus mr-2"></i>Create Postback
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="space-y-4">
                ${postbacks.map(postback => this.renderPostbackCard(postback)).join('')}
            </div>
        `;
    }
    
    renderPostbackCard(postback) {
        const statusColor = postback.status === 'active' ? 'text-green-600 bg-green-100' : 
                           postback.status === 'paused' ? 'text-yellow-600 bg-yellow-100' : 
                           'text-red-600 bg-red-100';
        
        return `
            <div class="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-gray-900">${postback.name}</h3>
                    <div class="flex items-center space-x-2">
                        <span class="px-2 py-1 text-xs rounded-full ${statusColor} font-medium">
                            ${postback.status.charAt(0).toUpperCase() + postback.status.slice(1)}
                        </span>
                        <div class="flex space-x-1">
                            <button onclick="postbackManager.testPostback(${postback.id})" 
                                    class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                                <i class="fas fa-play mr-1"></i>Test
                            </button>
                            <button onclick="postbackManager.editPostback(${postback.id})" 
                                    class="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200">
                                <i class="fas fa-edit mr-1"></i>Edit
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <p class="text-sm text-gray-500">URL Template</p>
                        <p class="font-mono text-sm bg-gray-50 p-2 rounded">${postback.url_template}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">HTTP Method</p>
                        <p class="font-medium">${postback.http_method}</p>
                    </div>
                </div>
                
                <div class="mb-4">
                    <p class="text-sm text-gray-500">Trigger Events</p>
                    <div class="flex flex-wrap gap-2 mt-1">
                        ${postback.trigger_events.map(event => 
                            `<span class="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">${event}</span>`
                        ).join('')}
                    </div>
                </div>
                
                <div class="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div class="text-sm text-gray-500">
                        Created: ${this.formatDate(postback.created_at)}
                        ${postback.campaign_id ? `• Campaign: ${postback.campaign_id}` : '• All Campaigns'}
                    </div>
                    <div class="text-sm text-gray-500">
                        ID: ${postback.id}
                    </div>
                </div>
            </div>
        `;
    }
    
    async loadPostbackLogs() {
        try {
            const response = await axios.get('/api/postbacks/logs?limit=20');
            if (response.data.success) {
                this.displayPostbackLogs(response.data.data);
            }
        } catch (error) {
            console.error('Error loading postback logs:', error);
            document.getElementById('postback-logs').innerHTML = `
                <div class="text-center py-8 text-red-500">
                    <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                    <p>Error loading postback logs</p>
                </div>
            `;
        }
    }
    
    displayPostbackLogs(logs) {
        const container = document.getElementById('postback-logs');
        
        if (!logs || logs.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-history text-2xl mb-2"></i>
                    <p>No postback activity yet</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Response Time</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${logs.map(log => this.renderLogRow(log)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    renderLogRow(log) {
        const statusBadge = log.success 
            ? '<span class="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">Success</span>'
            : '<span class="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">Failed</span>';
            
        return `
            <tr class="hover:bg-gray-50">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    ${log.event_type}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    Lead ${log.lead_id}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${statusBadge}
                    ${log.response_status ? `<br><span class="text-xs text-gray-400">HTTP ${log.response_status}</span>` : ''}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${log.response_time_ms}ms
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${this.formatTime(log.created_at)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button onclick="postbackManager.viewLogDetails(${log.id})" 
                            class="text-blue-600 hover:text-blue-900">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `;
    }
    
    showCreatePostbackModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div class="mt-3">
                    <h3 class="text-lg font-medium text-gray-900 mb-4">Create Postback URL</h3>
                    
                    <form id="postback-form" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
                            <input type="text" name="name" required class="w-full px-3 py-2 border border-gray-300 rounded-md">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">URL Template</label>
                            <input type="url" name="url_template" required class="w-full px-3 py-2 border border-gray-300 rounded-md"
                                   placeholder="https://your-domain.com/postback?lead_id={lead_id}&status={status}">
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">HTTP Method</label>
                            <select name="http_method" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                                <option value="GET">GET</option>
                                <option value="POST">POST</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Trigger Events</label>
                            <div class="space-y-2">
                                <label class="flex items-center">
                                    <input type="checkbox" name="events" value="ping_accepted" class="mr-2">
                                    Ping Accepted
                                </label>
                                <label class="flex items-center">
                                    <input type="checkbox" name="events" value="post_successful" class="mr-2">
                                    Post Successful
                                </label>
                                <label class="flex items-center">
                                    <input type="checkbox" name="events" value="conversion" class="mr-2">
                                    Conversion
                                </label>
                            </div>
                        </div>
                        
                        <div class="flex space-x-2 pt-4">
                            <button type="submit" class="flex-1 bg-green-600 text-white py-2 rounded-md hover:bg-green-700">
                                Create
                            </button>
                            <button type="button" onclick="this.closest('.fixed').remove()" 
                                    class="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Handle form submission
        modal.querySelector('#postback-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const data = {
                affiliate_id: 1, // Default for demo
                name: formData.get('name'),
                url_template: formData.get('url_template'),
                http_method: formData.get('http_method'),
                trigger_events: Array.from(formData.getAll('events')),
                status: 'active'
            };
            
            try {
                const response = await axios.post('/api/postbacks', data);
                if (response.data.success) {
                    this.showNotification('Postback URL created successfully!', 'success');
                    modal.remove();
                    this.loadPostbacks();
                } else {
                    this.showNotification('Failed to create postback URL', 'error');
                }
            } catch (error) {
                this.showNotification('Error creating postback URL', 'error');
            }
        });
    }
    
    async testPostback(postbackId) {
        try {
            const response = await axios.post('/api/postbacks/test', {
                postback_url_id: postbackId,
                lead_id: 1 // Test with lead ID 1
            });
            
            if (response.data.success) {
                this.showNotification('Test postback sent successfully!', 'success');
                // Reload logs to show the test
                setTimeout(() => this.loadPostbackLogs(), 1000);
            } else {
                this.showNotification('Test postback failed', 'error');
            }
        } catch (error) {
            this.showNotification('Error sending test postback', 'error');
        }
    }
    
    editPostback(postbackId) {
        this.showNotification('Edit functionality coming soon!', 'info');
    }
    
    viewLogDetails(logId) {
        this.showNotification('Log details view coming soon!', 'info');
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }
    
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    }
    
    showNotification(message, type = 'info') {
        const colors = {
            success: 'bg-green-500',
            error: 'bg-red-500',
            info: 'bg-blue-500'
        };
        
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50`;
        notification.innerHTML = `
            <div class="flex items-center">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-white">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
    
    showError(message) {
        const container = document.getElementById('postbacks-list');
        container.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                <h3 class="text-lg font-medium mb-2">Error</h3>
                <p>${message}</p>
                <button onclick="postbackManager.loadPostbacks()" 
                        class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Try Again
                </button>
            </div>
        `;
    }
}

// Initialize when page loads
let postbackManager;
document.addEventListener('DOMContentLoaded', () => {
    postbackManager = new PostbackManager();
});