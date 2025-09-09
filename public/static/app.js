// Main dashboard JavaScript
class AffiliateTracker {
    constructor() {
        this.init();
    }
    
    init() {
        this.loadDashboardStats();
        this.loadCampaigns();
        this.loadRecentActivity();
        this.setupForm();
        
        // Refresh data every 30 seconds
        setInterval(() => {
            this.loadDashboardStats();
            this.loadRecentActivity();
        }, 30000);
    }
    
    async loadDashboardStats() {
        try {
            const response = await axios.get('/api/dashboard/stats');
            if (response.data.success) {
                const stats = response.data.data;
                this.updateStatsDisplay(stats);
            }
        } catch (error) {
            console.error('Error loading dashboard stats:', error);
        }
    }
    
    updateStatsDisplay(stats) {
        document.getElementById('total-leads').textContent = stats.total_leads || 0;
        document.getElementById('acceptance-rate').textContent = `${(stats.acceptance_rate || 0).toFixed(1)}%`;
        document.getElementById('success-rate').textContent = `${(stats.success_rate || 0).toFixed(1)}%`;
        document.getElementById('total-revenue').textContent = `$${(stats.total_revenue || 0).toFixed(2)}`;
    }
    
    async loadCampaigns() {
        try {
            const response = await axios.get('/api/campaigns');
            if (response.data.success) {
                const campaigns = response.data.data;
                this.populateCampaignSelect(campaigns);
            }
        } catch (error) {
            console.error('Error loading campaigns:', error);
        }
    }
    
    populateCampaignSelect(campaigns) {
        const select = document.getElementById('campaign-select');
        select.innerHTML = '<option value="">Select Campaign...</option>';
        
        campaigns.forEach(campaign => {
            const option = document.createElement('option');
            option.value = campaign.id;
            option.textContent = `${campaign.name} (${campaign.traffic_type} - $${campaign.payout_amount})`;
            select.appendChild(option);
        });
    }
    
    async loadRecentActivity() {
        try {
            const response = await axios.get('/api/dashboard/activity?limit=10');
            if (response.data.success) {
                const activities = response.data.data;
                this.updateActivityDisplay(activities);
            }
        } catch (error) {
            console.error('Error loading recent activity:', error);
            document.getElementById('recent-activity').innerHTML = `
                <div class="text-center py-8 text-red-500">
                    <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                    <p>Error loading activity</p>
                </div>
            `;
        }
    }
    
    updateActivityDisplay(activities) {
        const container = document.getElementById('recent-activity');
        
        if (!activities || activities.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-inbox text-2xl mb-2"></i>
                    <p>No recent activity</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = activities.map(activity => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center">
                    <div class="w-2 h-2 ${this.getStatusColor(activity.ping_status, activity.post_status)} rounded-full mr-3"></div>
                    <div>
                        <p class="text-sm font-medium text-gray-900">${activity.name}</p>
                        <p class="text-xs text-gray-500">${activity.campaign_name} • ${activity.affiliate_name}</p>
                    </div>
                </div>
                <div class="text-right">
                    <p class="text-xs text-gray-500">${this.formatTime(activity.created_at)}</p>
                    <div class="flex space-x-1">
                        ${this.getStatusBadge(activity.ping_status, 'ping')}
                        ${this.getStatusBadge(activity.post_status, 'post')}
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    getStatusColor(pingStatus, postStatus) {
        if (postStatus === 'posted') return 'bg-green-400';
        if (pingStatus === 'accepted') return 'bg-yellow-400';
        if (pingStatus === 'rejected') return 'bg-red-400';
        return 'bg-gray-400';
    }
    
    getStatusBadge(status, type) {
        const colors = {
            'pending': 'bg-gray-100 text-gray-600',
            'accepted': 'bg-green-100 text-green-600',
            'rejected': 'bg-red-100 text-red-600',
            'posted': 'bg-blue-100 text-blue-600',
            'failed': 'bg-red-100 text-red-600'
        };
        
        const color = colors[status] || 'bg-gray-100 text-gray-600';
        
        return `<span class="px-1 py-0.5 text-xs rounded ${color}">${type}</span>`;
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
    
    setupForm() {
        const form = document.getElementById('tracking-form');
        const resultDiv = document.getElementById('tracking-result');
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());
            
            // Show loading state
            const submitButton = form.querySelector('button[type="submit"]');
            const originalText = submitButton.innerHTML;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Generating...';
            submitButton.disabled = true;
            
            resultDiv.classList.add('hidden');
            
            try {
                const response = await axios.post('/api/tracking/generate', data);
                
                if (response.data.success) {
                    const result = response.data.data;
                    
                    resultDiv.innerHTML = `
                        <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                            <div class="flex items-center">
                                <i class="fas fa-link text-green-500 mr-2"></i>
                                <h3 class="font-semibold text-green-800">Tracking Link Generated!</h3>
                            </div>
                            <div class="mt-3 space-y-3">
                                <div>
                                    <label class="block text-xs font-medium text-gray-700 mb-1">Your Tracking Link:</label>
                                    <div class="flex">
                                        <input type="text" id="generated-link" value="${result.tracking_link}" 
                                               class="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-l-md bg-white" readonly>
                                        <button type="button" onclick="this.copyTrackingLink()" 
                                                class="px-4 py-2 bg-blue-600 text-white text-sm rounded-r-md hover:bg-blue-700">
                                            <i class="fas fa-copy"></i>
                                        </button>
                                    </div>
                                </div>
                                <div class="grid grid-cols-2 gap-4 text-xs">
                                    <div>
                                        <span class="font-medium text-gray-700">Campaign:</span>
                                        <span class="text-gray-600">${result.campaign.name}</span>
                                    </div>
                                    <div>
                                        <span class="font-medium text-gray-700">Click ID:</span>
                                        <span class="text-gray-600">${result.click_id}</span>
                                    </div>
                                </div>
                                <div class="bg-blue-50 border border-blue-200 rounded p-3">
                                    <p class="text-xs text-blue-800">
                                        <i class="fas fa-info-circle mr-1"></i>
                                        Use this link in your traffic sources. All clicks will be tracked and attributed to your SubID: <strong>${result.sub_id}</strong>
                                    </p>
                                </div>
                            </div>
                        </div>
                    `;
                    
                    // Add copy functionality
                    window.copyTrackingLink = () => {
                        const linkInput = document.getElementById('generated-link');
                        linkInput.select();
                        document.execCommand('copy');
                        
                        const button = document.querySelector('button[onclick="this.copyTrackingLink()"]');
                        const originalText = button.innerHTML;
                        button.innerHTML = '<i class="fas fa-check"></i>';
                        setTimeout(() => {
                            button.innerHTML = originalText;
                        }, 2000);
                    };
                    
                    // Don't reset form to allow generating multiple links with different SubIDs
                    
                } else {
                    resultDiv.innerHTML = `
                        <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                            <div class="flex items-center">
                                <i class="fas fa-exclamation-triangle text-red-500 mr-2"></i>
                                <h3 class="font-semibold text-red-800">Error</h3>
                            </div>
                            <p class="mt-1 text-sm text-red-700">${response.data.error || 'Unknown error occurred'}</p>
                        </div>
                    `;
                }
                
            } catch (error) {
                console.error('Error generating tracking link:', error);
                resultDiv.innerHTML = `
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div class="flex items-center">
                            <i class="fas fa-exclamation-triangle text-red-500 mr-2"></i>
                            <h3 class="font-semibold text-red-800">Network Error</h3>
                        </div>
                        <p class="mt-1 text-sm text-red-700">Failed to generate tracking link. Please try again.</p>
                    </div>
                `;
            } finally {
                // Restore button
                submitButton.innerHTML = originalText;
                submitButton.disabled = false;
                resultDiv.classList.remove('hidden');
            }
        });
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new AffiliateTracker();
});