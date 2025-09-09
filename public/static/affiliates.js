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
                    <p class="text-gray-500 mb-6 max-w-md mx-auto">Get started by creating your first affiliate partner. Set up their profile, API keys, and postback configurations!</p>
                    <button onclick="affiliateManager.showCreateAffiliateModal()" 
                            class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 inline-flex items-center text-lg font-medium">
                        <i class="fas fa-plus mr-2"></i>Create Your First Affiliate
                    </button>
                    <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto text-sm">
                        <div class="bg-blue-50 p-4 rounded-lg">
                            <i class="fas fa-key text-blue-600 text-lg mb-2"></i>
                            <h4 class="font-medium text-blue-900">API Integration</h4>
                            <p class="text-blue-700">Auto-generated API keys for secure integration</p>
                        </div>
                        <div class="bg-green-50 p-4 rounded-lg">
                            <i class="fas fa-webhook text-green-600 text-lg mb-2"></i>
                            <h4 class="font-medium text-green-900">Postback URLs</h4>
                            <p class="text-green-700">Configure conversion tracking postbacks</p>
                        </div>
                        <div class="bg-purple-50 p-4 rounded-lg">
                            <i class="fas fa-chart-line text-purple-600 text-lg mb-2"></i>
                            <h4 class="font-medium text-purple-900">Performance Analytics</h4>
                            <p class="text-purple-700">Track affiliate performance and payouts</p>
                        </div>
                    </div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="space-y-4">
                ${affiliates.map(affiliate => this.renderAffiliateCard(affiliate)).join('')}
            </div>
        `;
    }
    
    renderAffiliateCard(affiliate) {
        const statusColor = affiliate.status === 'active' ? 'text-green-600 bg-green-100' : 
                           affiliate.status === 'suspended' ? 'text-red-600 bg-red-100' : 
                           'text-gray-600 bg-gray-100';
        
        // Mask API key for display
        const maskedApiKey = affiliate.api_key ? 
            affiliate.api_key.substring(0, 8) + '...' + affiliate.api_key.substring(affiliate.api_key.length - 4) : 
            'Not Set';
        
        return `
            <div class="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center">
                        <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
                            <i class="fas fa-user text-blue-600 text-lg"></i>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold text-gray-900">${affiliate.name}</h3>
                            <p class="text-gray-600">${affiliate.email}</p>
                        </div>
                    </div>
                    <span class="px-3 py-1 text-xs rounded-full ${statusColor} font-medium">
                        ${affiliate.status.charAt(0).toUpperCase() + affiliate.status.slice(1)}
                    </span>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                        <p class="text-sm text-gray-500">API Key</p>
                        <p class="font-mono text-sm bg-gray-100 px-2 py-1 rounded">${maskedApiKey}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">Created</p>
                        <p class="text-sm font-medium">${this.formatDate(affiliate.created_at)}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">Last Updated</p>
                        <p class="text-sm font-medium">${this.formatDate(affiliate.updated_at)}</p>
                    </div>
                </div>
                
                <div class="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div class="text-sm text-gray-500">
                        ID: ${affiliate.id}
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
                        <button onclick="affiliateManager.viewCampaigns(${affiliate.id})" 
                                class="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200">
                            <i class="fas fa-bullhorn mr-1"></i>Campaigns
                        </button>
                        <button onclick="affiliateManager.copyApiKey('${affiliate.api_key}')" 
                                class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                            <i class="fas fa-copy mr-1"></i>Copy API Key
                        </button>
                    </div>
                </div>
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
    
    showCreateAffiliateModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-10 mx-auto p-6 border w-full max-w-lg shadow-lg rounded-md bg-white">
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
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Affiliate Name *</label>
                            <input type="text" name="name" placeholder="e.g. ICubesWire Network" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                            <input type="email" name="email" placeholder="affiliate@network.com" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                            <input type="text" name="api_key" placeholder="Leave empty to auto-generate" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-md">
                            <p class="text-xs text-gray-500 mt-1">Auto-generated secure API key if left empty</p>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select name="status" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                                <option value="active">Active</option>
                                <option value="suspended">Suspended</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                        
                        <div class="bg-blue-50 p-4 rounded-lg">
                            <h4 class="font-medium text-blue-900 mb-2">
                                <i class="fas fa-info-circle mr-1"></i>Next Steps After Creation
                            </h4>
                            <ul class="text-sm text-blue-800 space-y-1">
                                <li>• Configure postback URLs for conversion tracking</li>
                                <li>• Set up campaigns and payout terms</li>
                                <li>• Share API key securely with affiliate partner</li>
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
    
    async editAffiliate(affiliateId) {
        try {
            const response = await axios.get(`/api/affiliates/${affiliateId}`);
            if (response.data.success) {
                const affiliate = response.data.data;
                this.showEditAffiliateModal(affiliate);
            } else {
                this.showNotification('Failed to load affiliate details', 'error');
            }
        } catch (error) {
            console.error('Error loading affiliate for edit:', error);
            this.showNotification('Network error loading affiliate', 'error');
        }
    }
    
    showEditAffiliateModal(affiliate) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-10 mx-auto p-6 border w-full max-w-lg shadow-lg rounded-md bg-white">
                <div class="mb-4">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-medium text-gray-900">
                            <i class="fas fa-edit mr-2"></i>Edit Affiliate - ${affiliate.name}
                        </h3>
                        <button onclick="this.parentElement.parentElement.parentElement.parentElement.remove()" 
                                class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <form id="edit-affiliate-form-${affiliate.id}" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Affiliate Name *</label>
                            <input type="text" name="name" value="${affiliate.name}" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                            <input type="email" name="email" value="${affiliate.email}" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                            <div class="flex space-x-2">
                                <input type="text" name="api_key" value="${affiliate.api_key}" 
                                       class="flex-1 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm">
                                <button type="button" onclick="this.previousElementSibling.value = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)" 
                                        class="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300">
                                    <i class="fas fa-refresh"></i>
                                </button>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                            <select name="status" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                                <option value="active" ${affiliate.status === 'active' ? 'selected' : ''}>Active</option>
                                <option value="suspended" ${affiliate.status === 'suspended' ? 'selected' : ''}>Suspended</option>
                                <option value="inactive" ${affiliate.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                            </select>
                        </div>
                        
                        <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                            <button type="button" 
                                    onclick="this.closest('.fixed').remove()" 
                                    class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
                                Cancel
                            </button>
                            <button type="submit" 
                                    class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                                <i class="fas fa-save mr-1"></i>Update Affiliate
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Setup form submission
        const form = document.getElementById(`edit-affiliate-form-${affiliate.id}`);
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.updateAffiliate(affiliate.id, form, modal);
        });
    }
    
    async updateAffiliate(affiliateId, form, modal) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        try {
            const response = await axios.put(`/api/affiliates/${affiliateId}`, data);
            if (response.data.success) {
                this.showNotification('Affiliate updated successfully!', 'success');
                modal.remove();
                
                // Reload affiliates to show updated data
                await this.loadAffiliates();
            } else {
                this.showNotification(response.data.error || 'Failed to update affiliate', 'error');
            }
        } catch (error) {
            console.error('Error updating affiliate:', error);
            this.showNotification('Network error updating affiliate', 'error');
        }
    }
    
    async managePostbacks(affiliateId) {
        // Redirect to postbacks management with affiliate filter
        window.location.href = `/postbacks?affiliate_id=${affiliateId}`;
    }
    
    async viewCampaigns(affiliateId) {
        // Redirect to campaigns with affiliate filter
        window.location.href = `/campaigns?affiliate_id=${affiliateId}`;
    }
    
    async copyApiKey(apiKey) {
        try {
            await navigator.clipboard.writeText(apiKey);
            this.showNotification('API key copied to clipboard!', 'success');
        } catch (error) {
            // Fallback for browsers that don't support clipboard API
            this.showApiKeyModal(apiKey);
        }
    }
    
    showApiKeyModal(apiKey) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div class="mt-3">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-medium text-gray-900">API Key</h3>
                        <button onclick="this.parentElement.parentElement.parentElement.parentElement.remove()" 
                                class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Full API Key:</label>
                        <textarea readonly class="w-full p-2 border border-gray-300 rounded text-sm font-mono" rows="3">${apiKey}</textarea>
                    </div>
                    
                    <div class="flex space-x-2">
                        <button onclick="navigator.clipboard.writeText('${apiKey}').then(() => this.textContent = 'Copied!')" 
                                class="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            <i class="fas fa-copy mr-1"></i>Copy Key
                        </button>
                        <button onclick="this.parentElement.parentElement.parentElement.parentElement.remove()" 
                                class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
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