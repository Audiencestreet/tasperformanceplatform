// Affiliate management JavaScript
class AffiliateManager {
    constructor() {
        this.init();
    }
    
    init() {
        this.loadAffiliates();
    }
    
    async loadAffiliates() {
        try {
            const response = await axios.get('/api/affiliates');
            if (response.data.success) {
                const affiliates = response.data.data;
                this.displayAffiliates(affiliates);
            } else {
                this.showError('Failed to load affiliates');
            }
        } catch (error) {
            console.error('Error loading affiliates:', error);
            this.showError('Network error loading affiliates');
        }
    }
    
    displayAffiliates(affiliates) {
        const container = document.getElementById('affiliates-list');
        
        if (!affiliates || affiliates.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12 text-gray-500">
                    <i class="fas fa-users text-6xl mb-6 text-gray-400"></i>
                    <h3 class="text-xl font-medium mb-3 text-gray-700">No Affiliates Found</h3>
                    <p class="text-gray-500 mb-6 max-w-md mx-auto">Create your first affiliate account to start tracking campaigns and managing postbacks.</p>
                    <button onclick="affiliateManager.showCreateAffiliateModal()" 
                            class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 inline-flex items-center text-lg font-medium">
                        <i class="fas fa-plus mr-2"></i>Create Your First Affiliate
                    </button>
                    <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto text-sm">
                        <div class="bg-blue-50 p-4 rounded-lg">
                            <i class="fas fa-key text-blue-600 text-lg mb-2"></i>
                            <h4 class="font-medium text-blue-900">API Keys</h4>
                            <p class="text-blue-700">Auto-generated secure API keys for each affiliate</p>
                        </div>
                        <div class="bg-green-50 p-4 rounded-lg">
                            <i class="fas fa-webhook text-green-600 text-lg mb-2"></i>
                            <h4 class="font-medium text-green-900">Postback URLs</h4>
                            <p class="text-green-700">Configure global and campaign-specific postbacks</p>
                        </div>
                        <div class="bg-purple-50 p-4 rounded-lg">
                            <i class="fas fa-chart-line text-purple-600 text-lg mb-2"></i>
                            <h4 class="font-medium text-purple-900">Performance Tracking</h4>
                            <p class="text-purple-700">Monitor affiliate performance and commissions</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="space-y-6">
                ${affiliates.map(affiliate => this.renderAffiliateCard(affiliate)).join('')}
            </div>
        `;
    }
    
    renderAffiliateCard(affiliate) {
        const statusColor = affiliate.status === 'active' ? 'text-green-600 bg-green-100' : 
                           affiliate.status === 'paused' ? 'text-yellow-600 bg-yellow-100' : 
                           'text-red-600 bg-red-100';
        
        return `
            <div class="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center space-x-4">
                        <div class="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                            <i class="fas fa-user text-blue-600 text-lg"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900">${affiliate.name}</h3>
                            <p class="text-sm text-gray-600">${affiliate.email}</p>
                        </div>
                    </div>
                    <span class="px-3 py-1 text-xs rounded-full ${statusColor} font-medium">
                        ${affiliate.status.charAt(0).toUpperCase() + affiliate.status.slice(1)}
                    </span>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div class="bg-gray-50 p-3 rounded-lg">
                        <p class="text-xs text-gray-500 mb-1">Affiliate ID</p>
                        <p class="font-mono text-sm font-medium">#${affiliate.id}</p>
                    </div>
                    <div class="bg-gray-50 p-3 rounded-lg">
                        <p class="text-xs text-gray-500 mb-1">API Key</p>
                        <div class="flex items-center space-x-2">
                            <p class="font-mono text-sm font-medium truncate" id="api-key-${affiliate.id}">
                                ${affiliate.api_key ? affiliate.api_key.substring(0, 8) + '••••••••' : 'Not set'}
                            </p>
                            <button onclick="affiliateManager.toggleApiKey(${affiliate.id}, '${affiliate.api_key || ''}')" 
                                    class="text-gray-400 hover:text-gray-600">
                                <i class="fas fa-eye" id="eye-${affiliate.id}"></i>
                            </button>
                        </div>
                    </div>
                    <div class="bg-gray-50 p-3 rounded-lg">
                        <p class="text-xs text-gray-500 mb-1">Created</p>
                        <p class="text-sm font-medium">${this.formatDate(affiliate.created_at)}</p>
                    </div>
                </div>
                
                ${affiliate.company ? `
                    <div class="mb-4 p-3 bg-blue-50 rounded-lg">
                        <p class="text-xs text-blue-600 mb-1">Company</p>
                        <p class="text-sm font-medium text-blue-900">${affiliate.company}</p>
                    </div>
                ` : ''}
                
                <div class="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div class="text-sm text-gray-500">
                        Last updated: ${this.formatDate(affiliate.updated_at)}
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="affiliateManager.editAffiliate(${affiliate.id})" 
                                class="px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded hover:bg-orange-200">
                            <i class="fas fa-edit mr-1"></i>Edit
                        </button>
                        <button onclick="affiliateManager.managePostbacks(${affiliate.id})" 
                                class="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200">
                            <i class="fas fa-webhook mr-1"></i>Postbacks
                        </button>
                        <button onclick="affiliateManager.viewStats(${affiliate.id})" 
                                class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                            <i class="fas fa-chart-bar mr-1"></i>Stats
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    toggleApiKey(affiliateId, apiKey) {
        const keyElement = document.getElementById(`api-key-${affiliateId}`);
        const eyeElement = document.getElementById(`eye-${affiliateId}`);
        
        if (keyElement.textContent.includes('••••')) {
            keyElement.textContent = apiKey || 'Not set';
            eyeElement.className = 'fas fa-eye-slash';
        } else {
            keyElement.textContent = apiKey ? apiKey.substring(0, 8) + '••••••••' : 'Not set';
            eyeElement.className = 'fas fa-eye';
        }
    }
    
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }
    
    showCreateAffiliateModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-10 mx-auto p-6 border w-full max-w-2xl shadow-lg rounded-md bg-white">
                <div class="mb-4">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-medium text-gray-900">
                            <i class="fas fa-plus mr-2"></i>Create New Affiliate
                        </h3>
                        <button onclick="this.parentElement.parentElement.parentElement.parentElement.remove()" 
                                class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <form id="create-affiliate-form" class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                                <input type="text" name="name" placeholder="John Doe" 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                                <input type="email" name="email" placeholder="john@example.com" 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Company (Optional)</label>
                                <input type="text" name="company" placeholder="ABC Marketing Inc." 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Phone (Optional)</label>
                                <input type="tel" name="phone" placeholder="+1 (555) 123-4567" 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md">
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select name="status" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                                <option value="active">Active</option>
                                <option value="paused">Paused</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                            <textarea name="notes" rows="3" placeholder="Additional notes about this affiliate..." 
                                      class="w-full px-3 py-2 border border-gray-300 rounded-md"></textarea>
                        </div>
                        
                        <div class="bg-blue-50 p-4 rounded-lg">
                            <h4 class="font-medium text-blue-900 mb-2">
                                <i class="fas fa-key mr-1"></i>API Key Generation
                            </h4>
                            <p class="text-sm text-blue-800 mb-3">A unique API key will be automatically generated for this affiliate. This key is used for:</p>
                            <ul class="text-sm text-blue-700 space-y-1">
                                <li>• API authentication and tracking</li>
                                <li>• Postback URL parameter replacement</li>
                                <li>• Campaign attribution and commission calculation</li>
                            </ul>
                        </div>
                        
                        <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                            <button type="button" 
                                    onclick="this.closest('.fixed').remove()" 
                                    class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
                                Cancel
                            </button>
                            <button type="submit" 
                                    class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                                <i class="fas fa-plus mr-1"></i>Create Affiliate
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Setup form submission
        const form = document.getElementById('create-affiliate-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createAffiliate(form, modal);
        });
    }
    
    async createAffiliate(form, modal) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        try {
            const response = await axios.post('/api/affiliates', data);
            if (response.data.success) {
                this.showNotification('Affiliate created successfully!', 'success');
                modal.remove();
                
                // Reload affiliates to show new affiliate
                await this.loadAffiliates();
            } else {
                this.showNotification(response.data.error || 'Failed to create affiliate', 'error');
            }
        } catch (error) {
            console.error('Error creating affiliate:', error);
            this.showNotification('Network error creating affiliate', 'error');
        }
    }
    
    async managePostbacks(affiliateId) {
        try {
            const [affiliateResponse, postbacksResponse] = await Promise.all([
                axios.get(`/api/affiliates/${affiliateId}`),
                axios.get(`/api/affiliates/${affiliateId}/postbacks`)
            ]);
            
            if (affiliateResponse.data.success) {
                this.showPostbacksModal(affiliateId, affiliateResponse.data.data, postbacksResponse.data.data || []);
            }
        } catch (error) {
            console.error('Error loading postbacks:', error);
            this.showNotification('Failed to load postback configuration', 'error');
        }
    }
    
    showPostbacksModal(affiliateId, affiliate, postbacks) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-5 mx-auto p-6 border w-full max-w-4xl shadow-lg rounded-md bg-white">
                <div class="mb-6">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-medium text-gray-900">
                            <i class="fas fa-webhook mr-2"></i>Postback Configuration - ${affiliate.name}
                        </h3>
                        <button onclick="this.parentElement.parentElement.parentElement.parentElement.remove()" 
                                class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <!-- Global Postback Section -->
                    <div class="bg-blue-50 p-4 rounded-lg mb-6">
                        <h4 class="font-medium text-blue-900 mb-3">
                            <i class="fas fa-globe mr-1"></i>Global Postback URL
                        </h4>
                        <form id="global-postback-form-${affiliateId}" class="space-y-3">
                            <div>
                                <label class="block text-sm font-medium text-blue-900 mb-1">Postback URL Template</label>
                                <input type="text" name="url_template" 
                                       placeholder="https://tracking.icubeswire.co/aff_iwr?transaction_id={transaction_id}&adv_sub1={affiliate_id}"
                                       class="w-full px-3 py-2 border border-blue-200 rounded-md text-sm font-mono">
                                <p class="text-xs text-blue-700 mt-1">Use variables like {transaction_id}, {affiliate_id}, {campaign_id}, {click_id}, {status}</p>
                            </div>
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-medium text-blue-900 mb-1">Postback Name</label>
                                    <input type="text" name="name" placeholder="ICubesWire Global Postback" 
                                           class="w-full px-3 py-2 border border-blue-200 rounded-md text-sm">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-blue-900 mb-1">HTTP Method</label>
                                    <select name="http_method" class="w-full px-3 py-2 border border-blue-200 rounded-md text-sm">
                                        <option value="GET">GET</option>
                                        <option value="POST">POST</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-blue-900 mb-1">Trigger Events</label>
                                <div class="grid grid-cols-3 gap-2 text-sm">
                                    <label class="flex items-center space-x-2">
                                        <input type="checkbox" name="trigger_events" value="lead_created" class="rounded">
                                        <span>Lead Created</span>
                                    </label>
                                    <label class="flex items-center space-x-2">
                                        <input type="checkbox" name="trigger_events" value="lead_accepted" class="rounded" checked>
                                        <span>Lead Accepted</span>
                                    </label>
                                    <label class="flex items-center space-x-2">
                                        <input type="checkbox" name="trigger_events" value="conversion" class="rounded">
                                        <span>Conversion</span>
                                    </label>
                                </div>
                            </div>
                            <button type="submit" class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">
                                <i class="fas fa-save mr-1"></i>Save Global Postback
                            </button>
                        </form>
                    </div>
                    
                    <!-- Available Variables Reference -->
                    <div class="bg-gray-50 p-4 rounded-lg mb-6">
                        <h4 class="font-medium text-gray-900 mb-3">
                            <i class="fas fa-code mr-1"></i>Available Postback Variables
                        </h4>
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div class="bg-white p-2 rounded border">
                                <code class="text-blue-600">{transaction_id}</code>
                                <p class="text-xs text-gray-600 mt-1">Lead UUID</p>
                            </div>
                            <div class="bg-white p-2 rounded border">
                                <code class="text-blue-600">{affiliate_id}</code>
                                <p class="text-xs text-gray-600 mt-1">Affiliate ID</p>
                            </div>
                            <div class="bg-white p-2 rounded border">
                                <code class="text-blue-600">{campaign_id}</code>
                                <p class="text-xs text-gray-600 mt-1">Campaign ID</p>
                            </div>
                            <div class="bg-white p-2 rounded border">
                                <code class="text-blue-600">{click_id}</code>
                                <p class="text-xs text-gray-600 mt-1">Click ID</p>
                            </div>
                            <div class="bg-white p-2 rounded border">
                                <code class="text-blue-600">{status}</code>
                                <p class="text-xs text-gray-600 mt-1">Lead Status</p>
                            </div>
                            <div class="bg-white p-2 rounded border">
                                <code class="text-blue-600">{lead_id}</code>
                                <p class="text-xs text-gray-600 mt-1">Internal Lead ID</p>
                            </div>
                            <div class="bg-white p-2 rounded border">
                                <code class="text-blue-600">{timestamp}</code>
                                <p class="text-xs text-gray-600 mt-1">Event Time</p>
                            </div>
                            <div class="bg-white p-2 rounded border">
                                <code class="text-blue-600">{payout}</code>
                                <p class="text-xs text-gray-600 mt-1">Payout Amount</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Existing Postbacks List -->
                    <div>
                        <h4 class="font-medium text-gray-900 mb-3">Configured Postbacks</h4>
                        <div id="postbacks-list-${affiliateId}" class="space-y-3">
                            ${postbacks.length > 0 ? 
                                postbacks.map(postback => this.renderPostbackItem(affiliateId, postback)).join('') :
                                '<p class="text-gray-500 text-sm">No postbacks configured yet.</p>'
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Setup form submission
        const form = document.getElementById(`global-postback-form-${affiliateId}`);
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createPostback(affiliateId, form);
        });
    }
    
    renderPostbackItem(affiliateId, postback) {
        return `
            <div class="bg-white border border-gray-200 rounded p-4">
                <div class="flex items-center justify-between mb-2">
                    <h5 class="font-medium text-gray-900">${postback.name}</h5>
                    <span class="px-2 py-1 text-xs rounded ${postback.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                        ${postback.status}
                    </span>
                </div>
                <p class="text-sm text-gray-600 font-mono mb-2">${postback.url_template}</p>
                <div class="flex items-center justify-between text-sm text-gray-500">
                    <span>Method: ${postback.http_method} | Events: ${JSON.parse(postback.trigger_events).join(', ')}</span>
                    <button onclick="affiliateManager.deletePostback(${affiliateId}, ${postback.id})" 
                            class="text-red-600 hover:text-red-800">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }
    
    async createPostback(affiliateId, form) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Handle checkbox array for trigger_events
        const triggerEvents = Array.from(form.querySelectorAll('input[name="trigger_events"]:checked'))
                                   .map(cb => cb.value);
        
        data.trigger_events = triggerEvents;
        data.affiliate_id = affiliateId;
        data.status = 'active';
        
        if (!data.url_template || !data.name) {
            this.showNotification('URL template and name are required', 'error');
            return;
        }
        
        try {
            const response = await axios.post('/api/postbacks', data);
            if (response.data.success) {
                this.showNotification('Postback created successfully!', 'success');
                
                // Refresh postback list
                const postbacksResponse = await axios.get(`/api/affiliates/${affiliateId}/postbacks`);
                const listContainer = document.getElementById(`postbacks-list-${affiliateId}`);
                const postbacks = postbacksResponse.data.data || [];
                listContainer.innerHTML = postbacks.length > 0 ? 
                    postbacks.map(postback => this.renderPostbackItem(affiliateId, postback)).join('') :
                    '<p class="text-gray-500 text-sm">No postbacks configured yet.</p>';
                
                // Clear form
                form.reset();
                // Re-check default trigger event
                form.querySelector('input[value="lead_accepted"]').checked = true;
            }
        } catch (error) {
            console.error('Error creating postback:', error);
            this.showNotification('Failed to create postback', 'error');
        }
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
        const container = document.getElementById('affiliates-list');
        container.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                <h3 class="text-lg font-medium mb-2">Error</h3>
                <p>${message}</p>
                <button onclick="affiliateManager.loadAffiliates()" 
                        class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Try Again
                </button>
            </div>
        `;
    }
}

// Initialize when page loads
let affiliateManager;
document.addEventListener('DOMContentLoaded', () => {
    affiliateManager = new AffiliateManager();
});