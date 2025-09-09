// Postback management JavaScript
class PostbackManager {
    constructor() {
        this.currentAffiliateId = null;
        this.init();
    }
    
    init() {
        // Get affiliate ID from URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        this.currentAffiliateId = urlParams.get('affiliate_id');
        
        if (this.currentAffiliateId) {
            this.loadPostbacksForAffiliate(parseInt(this.currentAffiliateId));
        } else {
            this.showAffiliateSelection();
        }
        
        // Setup create postback button
        const createBtn = document.getElementById('create-postback-btn');
        if (createBtn) {
            createBtn.onclick = () => this.showCreatePostbackModal();
        }
        
        this.loadPostbackLogs();
    }
    
    showAffiliateSelection() {
        const container = document.getElementById('postbacks-list');
        container.innerHTML = `
            <div class="text-center py-12 text-gray-500">
                <i class="fas fa-users text-6xl mb-6 text-gray-400"></i>
                <h3 class="text-xl font-medium mb-3 text-gray-700">Select an Affiliate</h3>
                <p class="text-gray-500 mb-6 max-w-md mx-auto">Choose an affiliate to manage their postback URLs and conversion tracking configuration.</p>
                <button onclick="postbackManager.loadAffiliateSelector()" 
                        class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 inline-flex items-center text-lg font-medium">
                    <i class="fas fa-search mr-2"></i>Select Affiliate
                </button>
            </div>
        `;
    }
    
    async loadAffiliateSelector() {
        try {
            const response = await axios.get('/api/affiliates');
            if (response.data.success) {
                const affiliates = response.data.data;
                this.showAffiliateSelectionModal(affiliates);
            } else {
                this.showError('Failed to load affiliates');
            }
        } catch (error) {
            console.error('Error loading affiliates:', error);
            this.showError('Network error loading affiliates');
        }
    }
    
    showAffiliateSelectionModal(affiliates) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-10 mx-auto p-6 border w-full max-w-2xl shadow-lg rounded-md bg-white">
                <div class="mb-4">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-medium text-gray-900">
                            <i class="fas fa-users mr-2"></i>Select Affiliate for Postback Management
                        </h3>
                        <button onclick="this.parentElement.parentElement.parentElement.parentElement.remove()" 
                                class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="space-y-2 max-h-96 overflow-y-auto">
                        ${affiliates.map(affiliate => `
                            <div class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                                 onclick="postbackManager.selectAffiliate(${affiliate.id}, '${affiliate.name}'); this.closest('.fixed').remove();">
                                <div class="flex items-center justify-between">
                                    <div>
                                        <h4 class="font-medium text-gray-900">${affiliate.name}</h4>
                                        <p class="text-sm text-gray-600">${affiliate.email}</p>
                                    </div>
                                    <span class="px-2 py-1 text-xs rounded-full ${affiliate.status === 'active' ? 'text-green-600 bg-green-100' : 'text-gray-600 bg-gray-100'}">
                                        ${affiliate.status}
                                    </span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    selectAffiliate(affiliateId, affiliateName) {
        this.currentAffiliateId = affiliateId;
        
        // Update page title and URL
        document.title = `Postback Management - ${affiliateName}`;
        window.history.pushState({}, '', `/postbacks?affiliate_id=${affiliateId}`);
        
        // Update page header
        const headerTitle = document.querySelector('h1');
        if (headerTitle) {
            headerTitle.innerHTML = `<i class="fas fa-webhook text-green-600 text-2xl mr-3"></i>Postback Management - ${affiliateName}`;
        }
        
        this.loadPostbacksForAffiliate(affiliateId);
    }
    
    async loadPostbacksForAffiliate(affiliateId) {
        try {
            const response = await axios.get(`/api/postbacks?affiliate_id=${affiliateId}`);
            if (response.data.success) {
                const postbacks = response.data.data;
                this.displayPostbacks(postbacks);
            } else {
                this.showError('Failed to load postback URLs');
            }
        } catch (error) {
            console.error('Error loading postbacks:', error);
            this.showError('Network error loading postback URLs');
        }
    }
    
    displayPostbacks(postbacks) {
        const container = document.getElementById('postbacks-list');
        
        if (!postbacks || postbacks.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12 text-gray-500">
                    <i class="fas fa-webhook text-6xl mb-6 text-gray-400"></i>
                    <h3 class="text-xl font-medium mb-3 text-gray-700">No Postback URLs Configured</h3>
                    <p class="text-gray-500 mb-6 max-w-md mx-auto">Set up postback URLs to receive conversion notifications from this affiliate network.</p>
                    <button onclick="postbackManager.showCreatePostbackModal()" 
                            class="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 inline-flex items-center text-lg font-medium">
                        <i class="fas fa-plus mr-2"></i>Create Your First Postback URL
                    </button>
                    <div class="mt-8 p-4 bg-blue-50 rounded-lg max-w-2xl mx-auto text-left">
                        <h4 class="font-medium text-blue-900 mb-2">Example: ICubesWire Postback</h4>
                        <code class="text-xs bg-blue-100 text-blue-900 p-2 rounded block break-all">
                            https://tracking.icubeswire.co/aff_iwr?transaction_id={transaction_id}&adv_sub1={affiliate_id}
                        </code>
                        <p class="text-sm text-blue-800 mt-2">
                            The system will automatically replace {transaction_id} and {affiliate_id} with actual values.
                        </p>
                    </div>
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
        
        const triggerEvents = Array.isArray(postback.trigger_events) ? 
            postback.trigger_events : JSON.parse(postback.trigger_events || '[]');
        
        return `
            <div class="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center">
                        <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
                            <i class="fas fa-webhook text-green-600 text-lg"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900">${postback.name}</h3>
                            <p class="text-sm text-gray-600">${postback.http_method} Request</p>
                        </div>
                    </div>
                    <span class="px-3 py-1 text-xs rounded-full ${statusColor} font-medium">
                        ${postback.status.charAt(0).toUpperCase() + postback.status.slice(1)}
                    </span>
                </div>
                
                <div class="mb-4">
                    <p class="text-sm text-gray-500 mb-1">Postback URL Template:</p>
                    <code class="text-sm bg-gray-100 p-2 rounded block break-all font-mono">${postback.url_template}</code>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <p class="text-sm text-gray-500">Trigger Events</p>
                        <div class="flex flex-wrap gap-1 mt-1">
                            ${triggerEvents.map(event => `
                                <span class="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded">${event}</span>
                            `).join('')}
                        </div>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">Created</p>
                        <p class="text-sm font-medium">${this.formatDate(postback.created_at)}</p>
                    </div>
                </div>
                
                <div class="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div class="text-sm text-gray-500">
                        ID: ${postback.id}
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="postbackManager.editPostback(${postback.id})" 
                                class="px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded hover:bg-orange-200">
                            <i class="fas fa-edit mr-1"></i>Edit
                        </button>
                        <button onclick="postbackManager.testPostback(${postback.id})" 
                                class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                            <i class="fas fa-test-tube mr-1"></i>Test
                        </button>
                        <button onclick="postbackManager.deletePostback(${postback.id})" 
                                class="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200">
                            <i class="fas fa-trash mr-1"></i>Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    showCreatePostbackModal() {
        if (!this.currentAffiliateId) {
            this.showNotification('Please select an affiliate first', 'error');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-5 mx-auto p-6 border w-full max-w-4xl shadow-lg rounded-md bg-white">
                <div class="mb-4">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-medium text-gray-900">
                            <i class="fas fa-plus mr-2"></i>Create New Postback URL
                        </h3>
                        <button onclick="this.parentElement.parentElement.parentElement.parentElement.remove()" 
                                class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <form id="create-postback-form" class="space-y-6">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Postback Name *</label>
                                <input type="text" name="name" placeholder="e.g. ICubesWire Conversion Tracking" 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">HTTP Method</label>
                                <select name="http_method" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                                    <option value="GET">GET</option>
                                    <option value="POST">POST</option>
                                </select>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Postback URL Template *</label>
                            <input type="url" name="url_template" 
                                   placeholder="https://tracking.icubeswire.co/aff_iwr?transaction_id={transaction_id}&adv_sub1={affiliate_id}" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm" required>
                            <p class="text-xs text-gray-500 mt-1">Use variables like {transaction_id}, {affiliate_id}, {campaign_id}, {click_id}, {status}</p>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-2">Trigger Events *</label>
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                                <label class="flex items-center">
                                    <input type="checkbox" name="trigger_events" value="lead_created" class="mr-2">
                                    <span class="text-sm">Lead Created</span>
                                </label>
                                <label class="flex items-center">
                                    <input type="checkbox" name="trigger_events" value="lead_accepted" class="mr-2">
                                    <span class="text-sm">Lead Accepted</span>
                                </label>
                                <label class="flex items-center">
                                    <input type="checkbox" name="trigger_events" value="lead_rejected" class="mr-2">
                                    <span class="text-sm">Lead Rejected</span>
                                </label>
                                <label class="flex items-center">
                                    <input type="checkbox" name="trigger_events" value="conversion" class="mr-2">
                                    <span class="text-sm">Conversion</span>
                                </label>
                                <label class="flex items-center">
                                    <input type="checkbox" name="trigger_events" value="click_tracked" class="mr-2">
                                    <span class="text-sm">Click Tracked</span>
                                </label>
                                <label class="flex items-center">
                                    <input type="checkbox" name="trigger_events" value="test_event" class="mr-2">
                                    <span class="text-sm">Test Event</span>
                                </label>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select name="status" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                                    <option value="active">Active</option>
                                    <option value="paused">Paused</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Campaign (Optional)</label>
                                <select name="campaign_id" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                                    <option value="">All Campaigns</option>
                                    <!-- Campaign options will be loaded dynamically -->
                                </select>
                            </div>
                        </div>
                        
                        <div class="bg-yellow-50 p-4 rounded-lg">
                            <h4 class="font-medium text-yellow-900 mb-2">
                                <i class="fas fa-lightbulb mr-1"></i>Available Variables
                            </h4>
                            <div class="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm text-yellow-800">
                                <code>{transaction_id}</code>
                                <code>{affiliate_id}</code>
                                <code>{campaign_id}</code>
                                <code>{click_id}</code>
                                <code>{lead_id}</code>
                                <code>{lead_uuid}</code>
                                <code>{status}</code>
                                <code>{timestamp}</code>
                                <code>{conversion_value}</code>
                            </div>
                            <p class="text-sm text-yellow-800 mt-2">These will be automatically replaced with actual values when postbacks are sent.</p>
                        </div>
                        
                        <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                            <button type="button" 
                                    onclick="this.closest('.fixed').remove()" 
                                    class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
                                Cancel
                            </button>
                            <button type="submit" 
                                    class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
                                <i class="fas fa-plus mr-1"></i>Create Postback URL
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Load campaigns for the select dropdown
        this.loadCampaignsForSelect(modal.querySelector('select[name="campaign_id"]'));
        
        // Setup form submission
        const form = document.getElementById('create-postback-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createPostback(form, modal);
        });
    }
    
    async loadCampaignsForSelect(selectElement) {
        try {
            const response = await axios.get('/api/campaigns');
            if (response.data.success) {
                const campaigns = response.data.data;
                campaigns.forEach(campaign => {
                    const option = document.createElement('option');
                    option.value = campaign.id;
                    option.textContent = campaign.name;
                    selectElement.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error loading campaigns:', error);
        }
    }
    
    async createPostback(form, modal) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Convert trigger events to array
        const triggerEvents = formData.getAll('trigger_events');
        if (triggerEvents.length === 0) {
            this.showNotification('Please select at least one trigger event', 'error');
            return;
        }
        
        data.affiliate_id = this.currentAffiliateId;
        data.trigger_events = triggerEvents;
        
        // Remove campaign_id if empty
        if (!data.campaign_id) {
            delete data.campaign_id;
        } else {
            data.campaign_id = parseInt(data.campaign_id);
        }
        
        try {
            const response = await axios.post('/api/postbacks', data);
            if (response.data.success) {
                this.showNotification('Postback URL created successfully!', 'success');
                modal.remove();
                
                // Reload postbacks to show new postback
                await this.loadPostbacksForAffiliate(this.currentAffiliateId);
            } else {
                this.showNotification(response.data.error || 'Failed to create postback URL', 'error');
            }
        } catch (error) {
            console.error('Error creating postback URL:', error);
            this.showNotification('Network error creating postback URL', 'error');
        }
    }
    
    async loadPostbackLogs() {
        try {
            const params = this.currentAffiliateId ? `?affiliate_id=${this.currentAffiliateId}` : '';
            const response = await axios.get(`/api/postbacks/logs${params}`);
            if (response.data.success) {
                const logs = response.data.data;
                this.displayPostbackLogs(logs);
            }
        } catch (error) {
            console.error('Error loading postback logs:', error);
        }
    }
    
    displayPostbackLogs(logs) {
        const container = document.getElementById('postback-logs');
        
        if (!logs || logs.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-list text-4xl mb-4"></i>
                    <h3 class="text-lg font-medium mb-2">No Recent Activity</h3>
                    <p>Postback logs will appear here once URLs are triggered.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Postback</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Response Time</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${logs.map(log => `
                            <tr class="hover:bg-gray-50">
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    ${this.formatDateTime(log.created_at)}
                                </td>
                                <td class="px-6 py-4 text-sm text-gray-900">
                                    ${log.postback_name || `ID: ${log.postback_url_id}`}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm">
                                    <span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                                        ${log.event_type}
                                    </span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm">
                                    <span class="px-2 py-1 text-xs rounded-full ${log.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                                        ${log.success ? 'Success' : 'Failed'}
                                    </span>
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    ${log.response_time_ms}ms
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }
    
    formatDateTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
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
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 3000);
    }
    
    showError(message) {
        const container = document.getElementById('postbacks-list');
        container.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                <h3 class="text-lg font-medium mb-2">Error</h3>
                <p>${message}</p>
                <button onclick="postbackManager.loadPostbacksForAffiliate(postbackManager.currentAffiliateId)" 
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