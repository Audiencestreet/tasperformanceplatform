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