// Campaign management JavaScript
class CampaignManager {
    constructor() {
        this.init();
    }
    
    init() {
        this.loadCampaigns();
    }
    
    async loadCampaigns() {
        try {
            const response = await axios.get('/api/campaigns');
            if (response.data.success) {
                const campaigns = response.data.data;
                this.displayCampaigns(campaigns);
            } else {
                this.showError('Failed to load campaigns');
            }
        } catch (error) {
            console.error('Error loading campaigns:', error);
            this.showError('Network error loading campaigns');
        }
    }
    
    displayCampaigns(campaigns) {
        const container = document.getElementById('campaigns-list');
        
        if (!campaigns || campaigns.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-bullhorn text-4xl mb-4"></i>
                    <h3 class="text-lg font-medium mb-2">No Campaigns Found</h3>
                    <p>There are no campaigns configured yet.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="space-y-4">
                ${campaigns.map(campaign => this.renderCampaignCard(campaign)).join('')}
            </div>
        `;
    }
    
    renderCampaignCard(campaign) {
        const statusColor = campaign.status === 'active' ? 'text-green-600 bg-green-100' : 
                           campaign.status === 'paused' ? 'text-yellow-600 bg-yellow-100' : 
                           'text-red-600 bg-red-100';
        
        return `
            <div class="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold text-gray-900">${campaign.name}</h3>
                    <span class="px-2 py-1 text-xs rounded-full ${statusColor} font-medium">
                        ${campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                    </span>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                        <p class="text-sm text-gray-500">Traffic Type</p>
                        <p class="font-medium">${campaign.traffic_type}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">Sub ID</p>
                        <p class="font-medium font-mono">${campaign.sub_id}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">Offer ID</p>
                        <p class="font-medium font-mono">${campaign.offer_id}</p>
                    </div>
                    <div>
                        <p class="text-sm text-gray-500">Payout</p>
                        <p class="font-medium text-green-600">$${campaign.payout_amount}</p>
                    </div>
                </div>
                
                ${campaign.description ? `
                    <div class="mb-4">
                        <p class="text-sm text-gray-500">Description</p>
                        <p class="text-gray-700">${campaign.description}</p>
                    </div>
                ` : ''}
                
                <div class="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div class="text-sm text-gray-500">
                        Created: ${this.formatDate(campaign.created_at)}
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="campaignManager.viewCampaignStats(${campaign.id})" 
                                class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                            <i class="fas fa-chart-bar mr-1"></i>Stats
                        </button>
                        <button onclick="campaignManager.generateTrackingLink(${campaign.id})" 
                                class="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200">
                            <i class="fas fa-link mr-1"></i>Tracking Link
                        </button>
                        <button onclick="campaignManager.editCampaign(${campaign.id})" 
                                class="px-3 py-1 text-sm bg-orange-100 text-orange-700 rounded hover:bg-orange-200">
                            <i class="fas fa-edit mr-1"></i>Edit
                        </button>
                        <button onclick="campaignManager.managePostbackParams(${campaign.id})" 
                                class="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded hover:bg-purple-200">
                            <i class="fas fa-cog mr-1"></i>Postback Config
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
    
    async viewCampaignStats(campaignId) {
        try {
            const response = await axios.get(`/api/dashboard/stats?campaign_id=${campaignId}`);
            if (response.data.success) {
                const stats = response.data.data;
                this.showStatsModal(campaignId, stats);
            }
        } catch (error) {
            console.error('Error loading campaign stats:', error);
            this.showError('Failed to load campaign statistics');
        }
    }
    
    showStatsModal(campaignId, stats) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div class="mt-3">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-medium text-gray-900">Campaign Statistics</h3>
                        <button onclick="this.parentElement.parentElement.parentElement.parentElement.remove()" 
                                class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="space-y-3">
                        <div class="flex justify-between">
                            <span class="text-gray-600">Total Leads:</span>
                            <span class="font-semibold">${stats.total_leads}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Accepted Leads:</span>
                            <span class="font-semibold text-green-600">${stats.accepted_leads}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Successful Posts:</span>
                            <span class="font-semibold text-blue-600">${stats.successful_posts}</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Acceptance Rate:</span>
                            <span class="font-semibold">${stats.acceptance_rate.toFixed(1)}%</span>
                        </div>
                        <div class="flex justify-between">
                            <span class="text-gray-600">Success Rate:</span>
                            <span class="font-semibold">${stats.success_rate.toFixed(1)}%</span>
                        </div>
                        <div class="flex justify-between border-t pt-3">
                            <span class="text-gray-600">Estimated Revenue:</span>
                            <span class="font-semibold text-green-600">$${stats.total_revenue.toFixed(2)}</span>
                        </div>
                    </div>
                    
                    <div class="mt-6 text-center">
                        <button onclick="this.parentElement.parentElement.parentElement.parentElement.remove()" 
                                class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            Close
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    generateTrackingLink(campaignId) {
        const baseUrl = window.location.origin;
        const trackingUrl = `${baseUrl}/?campaign_id=${campaignId}&utm_source=affiliate&utm_medium=direct`;
        
        // Copy to clipboard
        navigator.clipboard.writeText(trackingUrl).then(() => {
            this.showNotification('Tracking link copied to clipboard!', 'success');
        }).catch(() => {
            // Fallback: show the link in a modal
            this.showTrackingLinkModal(trackingUrl);
        });
    }
    
    showTrackingLinkModal(url) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                <div class="mt-3">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-medium text-gray-900">Tracking Link</h3>
                        <button onclick="this.parentElement.parentElement.parentElement.parentElement.remove()" 
                                class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Campaign Tracking URL:</label>
                        <textarea readonly class="w-full p-2 border border-gray-300 rounded text-sm" rows="3">${url}</textarea>
                    </div>
                    
                    <div class="flex space-x-2">
                        <button onclick="navigator.clipboard.writeText('${url}').then(() => this.textContent = 'Copied!')" 
                                class="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                            <i class="fas fa-copy mr-1"></i>Copy Link
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
    
    async managePostbackParams(campaignId) {
        try {
            const [campaignResponse, paramsResponse] = await Promise.all([
                axios.get(`/api/campaigns/${campaignId}`),
                axios.get(`/api/campaigns/${campaignId}/postback-params`)
            ]);
            
            if (campaignResponse.data.success && paramsResponse.data.success) {
                this.showPostbackParamsModal(campaignId, campaignResponse.data.data, paramsResponse.data.data);
            }
        } catch (error) {
            console.error('Error loading postback parameters:', error);
            this.showNotification('Failed to load postback configuration', 'error');
        }
    }
    
    showPostbackParamsModal(campaignId, campaign, params) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-10 mx-auto p-6 border w-full max-w-2xl shadow-lg rounded-md bg-white">
                <div class="mb-4">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-medium text-gray-900">
                            <i class="fas fa-cog mr-2"></i>Postback Parameters - ${campaign.name}
                        </h3>
                        <button onclick="this.parentElement.parentElement.parentElement.parentElement.remove()" 
                                class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <!-- Add Parameter Form -->
                    <div class="bg-gray-50 p-4 rounded-lg mb-4">
                        <h4 class="font-medium text-gray-900 mb-3">Add New Parameter</h4>
                        <form id="postback-param-form-${campaignId}" class="space-y-3">
                            <div class="grid grid-cols-2 gap-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Parameter Name</label>
                                    <input type="text" name="parameter_name" placeholder="e.g., click_id, sub_id" 
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Parameter Value</label>
                                    <input type="text" name="parameter_value" placeholder="e.g., {click_id}, {sub_id}" 
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                                <input type="text" name="description" placeholder="What this parameter is used for" 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                            </div>
                            <button type="submit" class="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm">
                                <i class="fas fa-plus mr-1"></i>Add Parameter
                            </button>
                        </form>
                    </div>
                    
                    <!-- Existing Parameters -->
                    <div>
                        <h4 class="font-medium text-gray-900 mb-3">Configured Parameters</h4>
                        <div id="postback-params-list-${campaignId}" class="space-y-2">
                            ${params.length > 0 ? 
                                params.map(param => this.renderPostbackParam(campaignId, param)).join('') :
                                '<p class="text-gray-500 text-sm">No parameters configured yet.</p>'
                            }
                        </div>
                    </div>
                    
                    <!-- Example Postback URLs -->
                    <div class="mt-6 p-4 bg-blue-50 rounded-lg">
                        <h4 class="font-medium text-blue-900 mb-2">
                            <i class="fas fa-info-circle mr-1"></i>Example Postback URL Format
                        </h4>
                        <p class="text-sm text-blue-800 mb-2">Configure parameters above, then use them in your postback URLs like this:</p>
                        <code class="text-xs bg-blue-100 text-blue-900 p-2 rounded block">
                            https://your-network.com/postback?${params.length > 0 ? 
                                params.map(p => `${p.parameter_name}=${p.parameter_value}`).join('&') : 
                                'click_id={click_id}&payout={payout}&status={status}'
                            }
                        </code>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Setup form submission
        const form = document.getElementById(`postback-param-form-${campaignId}`);
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createPostbackParam(campaignId, form);
        });
    }
    
    renderPostbackParam(campaignId, param) {
        return `
            <div class="flex items-center justify-between p-3 bg-white border border-gray-200 rounded">
                <div class="flex-1">
                    <div class="flex items-center space-x-3">
                        <span class="font-medium text-sm">${param.parameter_name}</span>
                        <span class="text-gray-400">→</span>
                        <span class="text-sm font-mono bg-gray-100 px-2 py-1 rounded">${param.parameter_value}</span>
                    </div>
                    ${param.description ? `<p class="text-xs text-gray-500 mt-1">${param.description}</p>` : ''}
                </div>
                <button onclick="campaignManager.deletePostbackParam(${campaignId}, ${param.id})" 
                        class="text-red-600 hover:text-red-800 text-sm">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }
    
    async createPostbackParam(campaignId, form) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        if (!data.parameter_name || !data.parameter_value) {
            this.showNotification('Parameter name and value are required', 'error');
            return;
        }
        
        try {
            const response = await axios.post(`/api/campaigns/${campaignId}/postback-params`, data);
            if (response.data.success) {
                this.showNotification('Parameter added successfully', 'success');
                
                // Refresh the parameter list
                const paramsResponse = await axios.get(`/api/campaigns/${campaignId}/postback-params`);
                if (paramsResponse.data.success) {
                    const listContainer = document.getElementById(`postback-params-list-${campaignId}`);
                    const params = paramsResponse.data.data;
                    listContainer.innerHTML = params.length > 0 ? 
                        params.map(param => this.renderPostbackParam(campaignId, param)).join('') :
                        '<p class="text-gray-500 text-sm">No parameters configured yet.</p>';
                }
                
                // Clear form
                form.reset();
            }
        } catch (error) {
            console.error('Error creating postback parameter:', error);
            this.showNotification('Failed to add parameter', 'error');
        }
    }
    
    async deletePostbackParam(campaignId, paramId) {
        if (!confirm('Are you sure you want to delete this parameter?')) {
            return;
        }
        
        try {
            const response = await axios.delete(`/api/campaigns/${campaignId}/postback-params/${paramId}`);
            if (response.data.success) {
                this.showNotification('Parameter deleted successfully', 'success');
                
                // Refresh the parameter list
                const paramsResponse = await axios.get(`/api/campaigns/${campaignId}/postback-params`);
                if (paramsResponse.data.success) {
                    const listContainer = document.getElementById(`postback-params-list-${campaignId}`);
                    const params = paramsResponse.data.data;
                    listContainer.innerHTML = params.length > 0 ? 
                        params.map(param => this.renderPostbackParam(campaignId, param)).join('') :
                        '<p class="text-gray-500 text-sm">No parameters configured yet.</p>';
                }
            }
        } catch (error) {
            console.error('Error deleting postback parameter:', error);
            this.showNotification('Failed to delete parameter', 'error');
        }
    }
    
    async editCampaign(campaignId) {
        try {
            const response = await axios.get(`/api/campaigns/${campaignId}`);
            if (response.data.success) {
                const campaign = response.data.data;
                this.showEditCampaignModal(campaign);
            } else {
                this.showNotification('Failed to load campaign details', 'error');
            }
        } catch (error) {
            console.error('Error loading campaign for edit:', error);
            this.showNotification('Network error loading campaign', 'error');
        }
    }
    
    showEditCampaignModal(campaign) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-10 mx-auto p-6 border w-full max-w-2xl shadow-lg rounded-md bg-white">
                <div class="mb-4">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-medium text-gray-900">
                            <i class="fas fa-edit mr-2"></i>Edit Campaign - ${campaign.name}
                        </h3>
                        <button onclick="this.parentElement.parentElement.parentElement.parentElement.remove()" 
                                class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <form id="edit-campaign-form-${campaign.id}" class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
                                <input type="text" name="name" value="${campaign.name}" 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select name="status" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                                    <option value="active" ${campaign.status === 'active' ? 'selected' : ''}>Active</option>
                                    <option value="paused" ${campaign.status === 'paused' ? 'selected' : ''}>Paused</option>
                                    <option value="inactive" ${campaign.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Traffic Type</label>
                                <select name="traffic_type" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                                    <option value="Email" ${campaign.traffic_type === 'Email' ? 'selected' : ''}>Email</option>
                                    <option value="Facebook" ${campaign.traffic_type === 'Facebook' ? 'selected' : ''}>Facebook</option>
                                    <option value="Instagram" ${campaign.traffic_type === 'Instagram' ? 'selected' : ''}>Instagram</option>
                                    <option value="TikTok" ${campaign.traffic_type === 'TikTok' ? 'selected' : ''}>TikTok</option>
                                    <option value="Twitter" ${campaign.traffic_type === 'Twitter' ? 'selected' : ''}>Twitter</option>
                                    <option value="Taboola" ${campaign.traffic_type === 'Taboola' ? 'selected' : ''}>Taboola</option>
                                    <option value="Outbrain" ${campaign.traffic_type === 'Outbrain' ? 'selected' : ''}>Outbrain</option>
                                    <option value="GoogleAds" ${campaign.traffic_type === 'GoogleAds' ? 'selected' : ''}>Google Ads</option>
                                    <option value="Display" ${campaign.traffic_type === 'Display' ? 'selected' : ''}>Display</option>
                                    <option value="Native" ${campaign.traffic_type === 'Native' ? 'selected' : ''}>Native</option>
                                    <option value="Search" ${campaign.traffic_type === 'Search' ? 'selected' : ''}>Search</option>
                                    <option value="Direct" ${campaign.traffic_type === 'Direct' ? 'selected' : ''}>Direct</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Sub ID</label>
                                <select name="sub_id" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                                    <option value="EM01" ${campaign.sub_id === 'EM01' ? 'selected' : ''}>EM01 - Email #1</option>
                                    <option value="EM02" ${campaign.sub_id === 'EM02' ? 'selected' : ''}>EM02 - Email #2</option>
                                    <option value="FB01" ${campaign.sub_id === 'FB01' ? 'selected' : ''}>FB01 - Facebook #1</option>
                                    <option value="IG01" ${campaign.sub_id === 'IG01' ? 'selected' : ''}>IG01 - Instagram #1</option>
                                    <option value="TT01" ${campaign.sub_id === 'TT01' ? 'selected' : ''}>TT01 - TikTok #1</option>
                                    <option value="TW01" ${campaign.sub_id === 'TW01' ? 'selected' : ''}>TW01 - Twitter #1</option>
                                    <option value="TB01" ${campaign.sub_id === 'TB01' ? 'selected' : ''}>TB01 - Taboola #1</option>
                                    <option value="OB01" ${campaign.sub_id === 'OB01' ? 'selected' : ''}>OB01 - Outbrain #1</option>
                                    <option value="GG01" ${campaign.sub_id === 'GG01' ? 'selected' : ''}>GG01 - Google Ads #1</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Offer ID</label>
                                <input type="text" name="offer_id" value="${campaign.offer_id}" 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Payout Amount ($)</label>
                            <input type="number" name="payout_amount" value="${campaign.payout_amount}" 
                                   step="0.01" min="0" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                            <textarea name="description" rows="3" 
                                      class="w-full px-3 py-2 border border-gray-300 rounded-md" 
                                      placeholder="Campaign description and notes...">${campaign.description || ''}</textarea>
                        </div>
                        
                        <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                            <button type="button" 
                                    onclick="this.closest('.fixed').remove()" 
                                    class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
                                Cancel
                            </button>
                            <button type="submit" 
                                    class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                                <i class="fas fa-save mr-1"></i>Update Campaign
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Setup form submission
        const form = document.getElementById(`edit-campaign-form-${campaign.id}`);
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.updateCampaign(campaign.id, form, modal);
        });
    }
    
    async updateCampaign(campaignId, form, modal) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Convert payout_amount to number
        data.payout_amount = parseFloat(data.payout_amount);
        
        try {
            const response = await axios.put(`/api/campaigns/${campaignId}`, data);
            if (response.data.success) {
                this.showNotification('Campaign updated successfully!', 'success');
                modal.remove();
                
                // Reload campaigns to show updated data
                await this.loadCampaigns();
            } else {
                this.showNotification(response.data.message || 'Failed to update campaign', 'error');
            }
        } catch (error) {
            console.error('Error updating campaign:', error);
            this.showNotification('Network error updating campaign', 'error');
        }
    }

    showError(message) {
        const container = document.getElementById('campaigns-list');
        container.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <i class="fas fa-exclamation-triangle text-4xl mb-4"></i>
                <h3 class="text-lg font-medium mb-2">Error</h3>
                <p>${message}</p>
                <button onclick="campaignManager.loadCampaigns()" 
                        class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    Try Again
                </button>
            </div>
        `;
    }
}

// Initialize when page loads
let campaignManager;
document.addEventListener('DOMContentLoaded', () => {
    campaignManager = new CampaignManager();
});