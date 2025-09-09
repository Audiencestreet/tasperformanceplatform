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
                <div class="text-center py-12 text-gray-500">
                    <i class="fas fa-bullhorn text-6xl mb-6 text-gray-400"></i>
                    <h3 class="text-xl font-medium mb-3 text-gray-700">No Campaigns Found</h3>
                    <p class="text-gray-500 mb-6 max-w-md mx-auto">Get started by creating your first campaign. Set up tracking links, configure payouts, and start generating leads!</p>
                    <button onclick="campaignManager.showCreateCampaignModal()" 
                            class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 inline-flex items-center text-lg font-medium">
                        <i class="fas fa-plus mr-2"></i>Create Your First Campaign
                    </button>
                    <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto text-sm">
                        <div class="bg-blue-50 p-4 rounded-lg">
                            <i class="fas fa-link text-blue-600 text-lg mb-2"></i>
                            <h4 class="font-medium text-blue-900">Tracking Links</h4>
                            <p class="text-blue-700">Generate unique tracking URLs for each campaign</p>
                        </div>
                        <div class="bg-green-50 p-4 rounded-lg">
                            <i class="fas fa-dollar-sign text-green-600 text-lg mb-2"></i>
                            <h4 class="font-medium text-green-900">Payout Management</h4>
                            <p class="text-green-700">Configure commission rates and payment terms</p>
                        </div>
                        <div class="bg-purple-50 p-4 rounded-lg">
                            <i class="fas fa-chart-bar text-purple-600 text-lg mb-2"></i>
                            <h4 class="font-medium text-purple-900">Performance Analytics</h4>
                            <p class="text-purple-700">Monitor clicks, conversions, and revenue</p>
                        </div>
                    </div>
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
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900">${campaign.name}</h3>
                        ${campaign.affiliate_name ? `
                            <p class="text-sm text-gray-600 mt-1">
                                <i class="fas fa-user text-blue-600 mr-1"></i>
                                <strong>Affiliate:</strong> ${campaign.affiliate_name}
                                <span class="text-gray-400">•</span>
                                <span class="text-xs ${campaign.affiliate_status === 'active' ? 'text-green-600' : 'text-red-600'}">
                                    ${campaign.affiliate_status}
                                </span>
                            </p>
                        ` : `
                            <p class="text-sm text-red-600 mt-1">
                                <i class="fas fa-exclamation-triangle mr-1"></i>
                                <strong>No affiliate linked</strong>
                            </p>
                        `}
                    </div>
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
                    <div class="flex flex-wrap gap-2">
                        <button onclick="campaignManager.viewCampaignStats(${campaign.id})" 
                                class="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                            <i class="fas fa-chart-bar mr-1"></i>Stats
                        </button>
                        <button onclick="campaignManager.generateTrackingLink(${campaign.id})" 
                                class="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200">
                            <i class="fas fa-link mr-1"></i>Tracking Link
                        </button>
                        <button onclick="campaignManager.linkAffiliate(${campaign.id})" 
                                class="px-3 py-1 text-sm bg-cyan-100 text-cyan-700 rounded hover:bg-cyan-200">
                            <i class="fas fa-user-plus mr-1"></i>Link Affiliate
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
    
    async generateTrackingLink(campaignId) {
        try {
            // Get campaign details and affiliates for selection
            const [campaignResponse, affiliatesResponse] = await Promise.all([
                axios.get(`/api/campaigns/${campaignId}`),
                axios.get('/api/affiliates')
            ]);
            
            if (campaignResponse.data.success && affiliatesResponse.data.success) {
                const campaign = campaignResponse.data.data;
                const affiliates = affiliatesResponse.data.data;
                this.showTrackingLinkGenerator(campaign, affiliates);
            } else {
                this.showNotification('Failed to load campaign or affiliate data', 'error');
            }
        } catch (error) {
            console.error('Error loading data for tracking link:', error);
            this.showNotification('Network error loading data', 'error');
        }
    }
    
    showTrackingLinkGenerator(campaign, affiliates) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-10 mx-auto p-6 border w-full max-w-2xl shadow-lg rounded-md bg-white">
                <div class="mb-4">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-medium text-gray-900">
                            <i class="fas fa-link mr-2"></i>Generate Tracking Link - ${campaign.name}
                        </h3>
                        <button onclick="this.parentElement.parentElement.parentElement.parentElement.remove()" 
                                class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <form id="tracking-link-form-${campaign.id}" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Select Affiliate *</label>
                            <select name="affiliate_id" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                                <option value="">Choose an affiliate...</option>
                                ${affiliates.map(affiliate => `
                                    <option value="${affiliate.id}" ${affiliate.id === campaign.affiliate_id ? 'selected' : ''}>
                                        ${affiliate.name} (${affiliate.email})
                                    </option>
                                `).join('')}
                            </select>
                            <p class="text-xs text-gray-500 mt-1">This identifies which affiliate is promoting this campaign</p>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">UTM Source</label>
                                <input type="text" name="utm_source" value="affiliate" 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">UTM Medium</label>
                                <select name="utm_medium" class="w-full px-3 py-2 border border-gray-300 rounded-md">
                                    <option value="email">Email</option>
                                    <option value="social">Social Media</option>
                                    <option value="display">Display Ads</option>
                                    <option value="search">Search</option>
                                    <option value="direct">Direct</option>
                                    <option value="referral">Referral</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">UTM Campaign</label>
                                <input type="text" name="utm_campaign" placeholder="e.g., summer-promo" 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">UTM Content</label>
                                <input type="text" name="utm_content" placeholder="e.g., banner-top" 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md">
                            </div>
                        </div>
                        
                        <div class="bg-blue-50 p-4 rounded-lg">
                            <h4 class="font-medium text-blue-900 mb-2">
                                <i class="fas fa-info-circle mr-1"></i>Generated Tracking URL
                            </h4>
                            <div id="generated-url-${campaign.id}" class="bg-white p-3 rounded border text-sm font-mono break-all">
                                <span class="text-gray-500">Select an affiliate to generate URL...</span>
                            </div>
                            <div class="flex space-x-2 mt-3">
                                <button type="button" onclick="campaignManager.copyTrackingUrl('generated-url-${campaign.id}')" 
                                        class="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
                                    <i class="fas fa-copy mr-1"></i>Copy URL
                                </button>
                                <button type="button" onclick="campaignManager.generatePreview(${campaign.id})" 
                                        class="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                                    <i class="fas fa-refresh mr-1"></i>Update Preview
                                </button>
                            </div>
                        </div>
                        
                        <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                            <button type="button" 
                                    onclick="this.closest('.fixed').remove()" 
                                    class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
                                Close
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Setup form change listener for live preview
        const form = document.getElementById(`tracking-link-form-${campaign.id}`);
        form.addEventListener('change', () => this.generatePreview(campaign.id));
        form.addEventListener('input', () => this.generatePreview(campaign.id));
        
        // Generate initial preview
        setTimeout(() => this.generatePreview(campaign.id), 100);
    }
    
    generatePreview(campaignId) {
        const form = document.getElementById(`tracking-link-form-${campaignId}`);
        if (!form) return;
        
        const formData = new FormData(form);
        const affiliateId = formData.get('affiliate_id');
        
        if (!affiliateId) {
            const urlElement = document.getElementById(`generated-url-${campaignId}`);
            urlElement.innerHTML = '<span class="text-gray-500">Select an affiliate to generate URL...</span>';
            return;
        }
        
        const baseUrl = window.location.origin;
        const params = new URLSearchParams();
        
        // Add required parameters
        params.append('campaign_id', campaignId);
        params.append('affiliate_id', affiliateId);
        
        // Add UTM parameters if provided
        if (formData.get('utm_source')) params.append('utm_source', formData.get('utm_source'));
        if (formData.get('utm_medium')) params.append('utm_medium', formData.get('utm_medium'));
        if (formData.get('utm_campaign')) params.append('utm_campaign', formData.get('utm_campaign'));
        if (formData.get('utm_content')) params.append('utm_content', formData.get('utm_content'));
        
        // Generate unique click ID for this link
        const clickId = 'click_' + Math.random().toString(36).substring(2, 15);
        params.append('click_id', clickId);
        
        const trackingUrl = `${baseUrl}/?${params.toString()}`;
        
        const urlElement = document.getElementById(`generated-url-${campaignId}`);
        urlElement.innerHTML = trackingUrl;
    }
    
    async copyTrackingUrl(elementId) {
        const urlElement = document.getElementById(elementId);
        if (!urlElement) return;
        
        const url = urlElement.textContent.trim();
        if (!url || url.includes('Select an affiliate')) {
            this.showNotification('Please generate a URL first', 'error');
            return;
        }
        
        try {
            await navigator.clipboard.writeText(url);
            this.showNotification('Tracking URL copied to clipboard!', 'success');
        } catch (error) {
            console.error('Failed to copy:', error);
            this.showTrackingLinkFallback(url);
        }
    }
    
    showTrackingLinkFallback(url) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
                <div class="mt-3">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-medium text-gray-900">Copy Tracking URL</h3>
                        <button onclick="this.parentElement.parentElement.parentElement.parentElement.remove()" 
                                class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700 mb-2">Tracking URL:</label>
                        <textarea readonly class="w-full p-3 border border-gray-300 rounded text-sm font-mono" 
                                  rows="4" onclick="this.select()">${url}</textarea>
                    </div>
                    
                    <div class="flex space-x-2">
                        <button onclick="this.previousElementSibling.previousElementSibling.querySelector('textarea').select(); document.execCommand('copy'); this.textContent = 'Copied!'" 
                                class="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                            <i class="fas fa-copy mr-1"></i>Select & Copy
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
    
    async linkAffiliate(campaignId) {
        try {
            // Get both campaign and affiliates data
            const [campaignResponse, affiliatesResponse] = await Promise.all([
                axios.get(`/api/campaigns/${campaignId}`),
                axios.get('/api/affiliates')
            ]);
            
            if (campaignResponse.data.success && affiliatesResponse.data.success) {
                const campaign = campaignResponse.data.data;
                const affiliates = affiliatesResponse.data.data;
                this.showLinkAffiliateModal(campaign, affiliates);
            } else {
                this.showNotification('Failed to load campaign or affiliate data', 'error');
            }
        } catch (error) {
            console.error('Error loading data for affiliate linking:', error);
            this.showNotification('Network error loading data', 'error');
        }
    }
    
    showLinkAffiliateModal(campaign, affiliates) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-20 mx-auto p-6 border w-full max-w-lg shadow-lg rounded-md bg-white">
                <div class="mb-4">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-medium text-gray-900">
                            <i class="fas fa-user-plus mr-2"></i>Link Affiliate - ${campaign.name}
                        </h3>
                        <button onclick="this.parentElement.parentElement.parentElement.parentElement.remove()" 
                                class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <form id="link-affiliate-form-${campaign.id}" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Select Affiliate *</label>
                            <select name="affiliate_id" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                                <option value="">Choose an affiliate...</option>
                                ${affiliates.map(affiliate => `
                                    <option value="${affiliate.id}" ${affiliate.id === campaign.affiliate_id ? 'selected' : ''}>
                                        ${affiliate.name} (${affiliate.email}) - ${affiliate.status}
                                    </option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="bg-blue-50 p-4 rounded-lg">
                            <h4 class="font-medium text-blue-900 mb-2">
                                <i class="fas fa-info-circle mr-1"></i>Linking Campaign to Affiliate
                            </h4>
                            <ul class="text-sm text-blue-800 space-y-1">
                                <li>• The selected affiliate will be associated with this campaign</li>
                                <li>• All tracking links will identify this affiliate</li>
                                <li>• Postback URLs can be configured for this affiliate</li>
                                <li>• Lead attribution will be tracked to this affiliate</li>
                            </ul>
                        </div>
                        
                        <div class="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                            <button type="button" 
                                    onclick="this.closest('.fixed').remove()" 
                                    class="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
                                Cancel
                            </button>
                            <button type="submit" 
                                    class="px-4 py-2 bg-cyan-600 text-white rounded-md hover:bg-cyan-700">
                                <i class="fas fa-link mr-1"></i>Link Affiliate
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Setup form submission
        const form = document.getElementById(`link-affiliate-form-${campaign.id}`);
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.updateCampaignAffiliate(campaign.id, form, modal);
        });
    }
    
    async updateCampaignAffiliate(campaignId, form, modal) {
        const formData = new FormData(form);
        const data = {
            affiliate_id: parseInt(formData.get('affiliate_id'))
        };
        
        try {
            const response = await axios.put(`/api/campaigns/${campaignId}`, data);
            if (response.data.success) {
                this.showNotification('Affiliate linked successfully!', 'success');
                modal.remove();
                
                // Reload campaigns to show updated affiliate linkage
                await this.loadCampaigns();
            } else {
                this.showNotification(response.data.error || 'Failed to link affiliate', 'error');
            }
        } catch (error) {
            console.error('Error linking affiliate:', error);
            this.showNotification('Network error linking affiliate', 'error');
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

    showCreateCampaignModal() {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50';
        modal.innerHTML = `
            <div class="relative top-10 mx-auto p-6 border w-full max-w-2xl shadow-lg rounded-md bg-white">
                <div class="mb-4">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-medium text-gray-900">
                            <i class="fas fa-plus mr-2"></i>Create New Campaign
                        </h3>
                        <button onclick="this.parentElement.parentElement.parentElement.parentElement.remove()" 
                                class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <form id="create-campaign-form" class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Campaign Name *</label>
                                <input type="text" name="name" placeholder="e.g. Facebook Solar Campaign" 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                                <select name="status" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                                    <option value="active">Active</option>
                                    <option value="paused">Paused</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Traffic Type *</label>
                                <select name="traffic_type" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                                    <option value="">Select Traffic Type</option>
                                    <option value="Email">Email</option>
                                    <option value="Facebook">Facebook</option>
                                    <option value="Instagram">Instagram</option>
                                    <option value="TikTok">TikTok</option>
                                    <option value="Twitter">Twitter</option>
                                    <option value="Taboola">Taboola</option>
                                    <option value="Outbrain">Outbrain</option>
                                    <option value="GoogleAds">Google Ads</option>
                                    <option value="Display">Display</option>
                                    <option value="Native">Native</option>
                                    <option value="Search">Search</option>
                                    <option value="Direct">Direct</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Sub ID *</label>
                                <select name="sub_id" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                                    <option value="">Select Sub ID</option>
                                    <option value="EM01">EM01 - Email #1</option>
                                    <option value="EM02">EM02 - Email #2</option>
                                    <option value="FB01">FB01 - Facebook #1</option>
                                    <option value="IG01">IG01 - Instagram #1</option>
                                    <option value="TT01">TT01 - TikTok #1</option>
                                    <option value="TW01">TW01 - Twitter #1</option>
                                    <option value="TB01">TB01 - Taboola #1</option>
                                    <option value="OB01">OB01 - Outbrain #1</option>
                                    <option value="GG01">GG01 - Google Ads #1</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Offer ID *</label>
                                <input type="text" name="offer_id" placeholder="e.g. 122, 477" 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Payout Amount ($) *</label>
                                <input type="number" name="payout_amount" placeholder="25.00" 
                                       step="0.01" min="0" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Affiliate ID *</label>
                                <select name="affiliate_id" class="w-full px-3 py-2 border border-gray-300 rounded-md" required>
                                    <option value="">Select Affiliate</option>
                                    <option value="1">Default Affiliate (ID: 1)</option>
                                    <option value="2">Partner Affiliate (ID: 2)</option>
                                    <option value="3">Premium Affiliate (ID: 3)</option>
                                </select>
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                            <textarea name="description" rows="3" 
                                      class="w-full px-3 py-2 border border-gray-300 rounded-md" 
                                      placeholder="Campaign description and notes..."></textarea>
                        </div>
                        
                        <div class="bg-blue-50 p-4 rounded-lg">
                            <h4 class="font-medium text-blue-900 mb-2">
                                <i class="fas fa-info-circle mr-1"></i>Quick Campaign Setup Tips
                            </h4>
                            <ul class="text-sm text-blue-800 space-y-1">
                                <li>• <strong>Sub ID Strategy:</strong> Use EM01/EM02 for Email, FB01 for Facebook, GG01 for Google Ads</li>
                                <li>• <strong>Common Offer IDs:</strong> 122 (Solar), 477 (ADT Home Security)</li>
                                <li>• <strong>Payout Ranges:</strong> Solar: $20-30, Security: $40-60, Health: $15-25</li>
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
                                <i class="fas fa-plus mr-1"></i>Create Campaign
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Setup form submission
        const form = document.getElementById('create-campaign-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.createCampaign(form, modal);
        });
    }
    
    async createCampaign(form, modal) {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Convert payout_amount to number
        data.payout_amount = parseFloat(data.payout_amount);
        data.affiliate_id = parseInt(data.affiliate_id);
        
        try {
            const response = await axios.post('/api/campaigns', data);
            if (response.data.success) {
                this.showNotification('Campaign created successfully!', 'success');
                modal.remove();
                
                // Reload campaigns to show new campaign
                await this.loadCampaigns();
            } else {
                this.showNotification(response.data.error || 'Failed to create campaign', 'error');
            }
        } catch (error) {
            console.error('Error creating campaign:', error);
            this.showNotification('Network error creating campaign', 'error');
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