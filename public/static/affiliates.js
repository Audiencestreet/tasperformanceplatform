// Affiliate Management JavaScript
class AffiliateManager {
    constructor() {
        this.init();
    }
    
    init() {
        this.loadAffiliates();
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Create affiliate button
        document.getElementById('create-affiliate-btn').addEventListener('click', () => {
            this.openModal();
        });
        
        // Close modal buttons
        document.getElementById('close-modal').addEventListener('click', () => {
            this.closeModal();
        });
        
        document.getElementById('cancel-affiliate').addEventListener('click', () => {
            this.closeModal();
        });
        
        // Form submission
        document.getElementById('affiliate-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveAffiliate();
        });
        
        // Close modal on backdrop click
        document.getElementById('affiliate-modal').addEventListener('click', (e) => {
            if (e.target.id === 'affiliate-modal') {
                this.closeModal();
            }
        });
    }
    
    async loadAffiliates() {
        try {
            const response = await axios.get('/api/affiliates');
            if (response.data.success) {
                this.displayAffiliates(response.data.data);
            }
        } catch (error) {
            console.error('Error loading affiliates:', error);
            document.getElementById('affiliates-list').innerHTML = `
                <div class="text-center py-8 text-red-500">
                    <i class="fas fa-exclamation-triangle text-2xl mb-2"></i>
                    <p>Error loading affiliates</p>
                </div>
            `;
        }
    }
    
    displayAffiliates(affiliates) {
        const container = document.getElementById('affiliates-list');
        
        if (!affiliates || affiliates.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i class="fas fa-user-plus text-2xl mb-2"></i>
                    <p>No affiliates yet</p>
                    <button onclick="affiliateManager.openModal()" class="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                        <i class="fas fa-plus mr-2"></i>Create Your First Affiliate
                    </button>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">API Key</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${affiliates.map(affiliate => this.renderAffiliateRow(affiliate)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    renderAffiliateRow(affiliate) {
        const statusColors = {
            'active': 'bg-green-100 text-green-800',
            'suspended': 'bg-yellow-100 text-yellow-800',
            'inactive': 'bg-gray-100 text-gray-800'
        };
        
        const statusColor = statusColors[affiliate.status] || 'bg-gray-100 text-gray-800';
        
        return `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-8 w-8">
                            <div class="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                <i class="fas fa-user text-blue-600 text-sm"></i>
                            </div>
                        </div>
                        <div class="ml-4">
                            <div class="text-sm font-medium text-gray-900">${affiliate.name}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${affiliate.email}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <code class="bg-gray-100 px-2 py-1 rounded text-xs">${affiliate.api_key.substring(0, 8)}...</code>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">
                        ${affiliate.status}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${new Date(affiliate.created_at).toLocaleDateString()}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-2">
                        <button onclick="affiliateManager.editAffiliate(${affiliate.id})" 
                                class="text-blue-600 hover:text-blue-900">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="affiliateManager.viewCampaigns(${affiliate.id})" 
                                class="text-green-600 hover:text-green-900">
                            <i class="fas fa-bullhorn" title="View Campaigns"></i>
                        </button>
                        <button onclick="affiliateManager.copyApiKey('${affiliate.api_key}')" 
                                class="text-gray-600 hover:text-gray-900">
                            <i class="fas fa-copy" title="Copy API Key"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }
    
    openModal(affiliate = null) {
        const modal = document.getElementById('affiliate-modal');
        const form = document.getElementById('affiliate-form');
        const title = document.getElementById('modal-title');
        
        if (affiliate) {
            // Edit mode
            title.textContent = 'Edit Affiliate';
            form.elements.id.value = affiliate.id;
            form.elements.name.value = affiliate.name;
            form.elements.email.value = affiliate.email;
            form.elements.api_key.value = affiliate.api_key;
            form.elements.status.value = affiliate.status;
        } else {
            // Create mode
            title.textContent = 'New Affiliate';
            form.reset();
        }
        
        modal.classList.remove('hidden');
    }
    
    closeModal() {
        document.getElementById('affiliate-modal').classList.add('hidden');
        document.getElementById('affiliate-form').reset();
    }
    
    async saveAffiliate() {
        const form = document.getElementById('affiliate-form');
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        
        // Remove empty values
        Object.keys(data).forEach(key => {
            if (data[key] === '') {
                delete data[key];
            }
        });
        
        const submitButton = form.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;
        submitButton.textContent = 'Saving...';
        submitButton.disabled = true;
        
        try {
            let response;
            if (data.id) {
                // Update existing affiliate
                const id = data.id;
                delete data.id;
                response = await axios.put(`/api/affiliates/${id}`, data);
            } else {
                // Create new affiliate
                delete data.id;
                response = await axios.post('/api/affiliates', data);
            }
            
            if (response.data.success) {
                this.closeModal();
                this.loadAffiliates();
                this.showSuccess(data.id ? 'Affiliate updated successfully!' : 'Affiliate created successfully!');
            } else {
                this.showError(response.data.error || 'Failed to save affiliate');
            }
        } catch (error) {
            console.error('Error saving affiliate:', error);
            this.showError('Network error occurred');
        } finally {
            submitButton.textContent = originalText;
            submitButton.disabled = false;
        }
    }
    
    async editAffiliate(id) {
        try {
            const response = await axios.get(`/api/affiliates/${id}`);
            if (response.data.success) {
                this.openModal(response.data.data);
            }
        } catch (error) {
            console.error('Error loading affiliate:', error);
            this.showError('Failed to load affiliate details');
        }
    }
    
    viewCampaigns(affiliateId) {
        window.location.href = `/campaigns?affiliate_id=${affiliateId}`;
    }
    
    copyApiKey(apiKey) {
        navigator.clipboard.writeText(apiKey).then(() => {
            this.showSuccess('API key copied to clipboard!');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = apiKey;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showSuccess('API key copied to clipboard!');
        });
    }
    
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    showError(message) {
        this.showNotification(message, 'error');
    }
    
    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 px-4 py-2 rounded-md text-white z-50 ${
            type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Global instance
let affiliateManager;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    affiliateManager = new AffiliateManager();
});