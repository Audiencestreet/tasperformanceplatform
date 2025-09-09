// PX Direct Post Test Interface
document.addEventListener('DOMContentLoaded', function() {
    // Show/hide vertical-specific fields
    const verticalSelect = document.getElementById('vertical');
    const solarFields = document.getElementById('solar-fields');
    const healthFields = document.getElementById('health-fields');
    
    verticalSelect.addEventListener('change', function() {
        const vertical = this.value;
        
        if (vertical === 'Solar') {
            solarFields.classList.remove('hidden');
            healthFields.classList.add('hidden');
        } else if (vertical === 'Health') {
            healthFields.classList.remove('hidden');
            solarFields.classList.add('hidden');
        } else {
            solarFields.classList.add('hidden');
            healthFields.classList.add('hidden');
        }
    });
    
    // Form submission
    const form = document.getElementById('px-test-form');
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const submitBtn = form.querySelector('button[type="submit"]');
        const submitText = document.getElementById('submit-text');
        const resultsDiv = document.getElementById('results');
        const responseContent = document.getElementById('response-content');
        
        // Disable submit button
        submitBtn.disabled = true;
        submitText.textContent = 'Sending...';
        
        try {
            // Collect form data
            const formData = {
                vertical: document.getElementById('vertical').value,
                subId: document.getElementById('subId').value,
                source: document.getElementById('source').value || undefined,
                contact: {
                    firstName: document.getElementById('firstName').value,
                    lastName: document.getElementById('lastName').value,
                    email: document.getElementById('email').value,
                    phone: document.getElementById('phone').value,
                    zipCode: document.getElementById('zipCode').value,
                    state: document.getElementById('state').value || undefined
                },
                context: {
                    sessionLength: 180 // 3 minutes default
                },
                extras: {}
            };
            
            // Add vertical-specific data
            if (formData.vertical === 'Solar') {
                const ownership = document.getElementById('ownership').value;
                const roofshade = document.getElementById('roofshade').value;
                const electricityBill = document.getElementById('electricityBill').value;
                
                if (ownership) formData.extras.Ownership = ownership;
                if (roofshade) formData.extras.Roofshade = roofshade;
                if (electricityBill) formData.extras.ElectricityBill = electricityBill;
            } else if (formData.vertical === 'Health') {
                const dateOfBirth = document.getElementById('dateOfBirth').value;
                const gender = document.getElementById('gender').value;
                const height = document.getElementById('height').value;
                const weight = document.getElementById('weight').value;
                
                if (dateOfBirth) formData.extras.DateOfBirth = dateOfBirth;
                if (gender) formData.extras.Gender = gender;
                if (height) formData.extras.Height = height;
                if (weight) formData.extras.Weight = weight;
            }
            
            // Send to PX API
            const response = await axios.post('/api/px/direct-post', formData);
            
            // Display results
            displayResults(response.data, true);
            
        } catch (error) {
            console.error('Error sending to PX API:', error);
            let errorData = error.response?.data || { success: false, error: 'Network error' };
            displayResults(errorData, false);
        } finally {
            // Re-enable submit button
            submitBtn.disabled = false;
            submitText.textContent = 'Send Direct Post';
        }
    });
});

// SubId Generation Functions
async function generateSubId() {
    const trafficType = document.getElementById('traffic-type').value;
    const campaignNumber = document.getElementById('campaign-number').value;
    
    if (!trafficType) {
        alert('Please select a traffic type');
        return;
    }
    
    try {
        const response = await axios.post('/api/px/subid/generate', {
            trafficType: trafficType,
            campaignNumber: campaignNumber ? parseInt(campaignNumber) : undefined
        });
        
        if (response.data.success) {
            const resultDiv = document.getElementById('subid-result');
            const subidSpan = document.getElementById('generated-subid');
            
            subidSpan.textContent = response.data.data.generated_subid;
            resultDiv.classList.remove('hidden');
            
            // Auto-populate the form field
            document.getElementById('subId').value = response.data.data.generated_subid;
        } else {
            alert('Error generating SubId: ' + response.data.error);
        }
    } catch (error) {
        console.error('Error generating SubId:', error);
        alert('Failed to generate SubId');
    }
}

function copySubId() {
    const subId = document.getElementById('generated-subid').textContent;
    navigator.clipboard.writeText(subId).then(() => {
        // Show copy confirmation
        const button = event.target.closest('button');
        const icon = button.querySelector('i');
        icon.className = 'fas fa-check text-green-600';
        
        setTimeout(() => {
            icon.className = 'fas fa-copy';
        }, 2000);
    });
}

function displayResults(data, isSuccess) {
    const resultsDiv = document.getElementById('results');
    const responseContent = document.getElementById('response-content');
    
    // Create result HTML
    let html = '';
    
    if (isSuccess && data.success) {
        html = `
            <div class="mb-4">
                <div class="flex items-center mb-2">
                    <i class="fas fa-check-circle text-green-600 mr-2"></i>
                    <span class="font-semibold text-green-800">Direct Post Successful</span>
                </div>
                <div class="text-sm text-gray-600">Response Time: ${data.data.response_time_ms}ms</div>
            </div>
            
            <div class="space-y-4">
                <div>
                    <h4 class="font-medium text-gray-900 mb-2">Request Details</h4>
                    <div class="bg-blue-50 p-3 rounded text-sm">
                        <div><strong>Vertical:</strong> ${data.data.vertical}</div>
                        <div><strong>SubId:</strong> ${data.data.subId}</div>
                        ${data.data.source ? `<div><strong>Source:</strong> ${data.data.source}</div>` : ''}
                    </div>
                </div>
                
                ${data.data.px_response ? `
                <div>
                    <h4 class="font-medium text-gray-900 mb-2">PX Response</h4>
                    <div class="bg-green-50 p-3 rounded text-sm">
                        <div><strong>Success:</strong> ${data.data.px_response.Success}</div>
                        ${data.data.px_response.LeadId ? `<div><strong>Lead ID:</strong> ${data.data.px_response.LeadId}</div>` : ''}
                        ${data.data.px_response.Price ? `<div><strong>Price:</strong> $${data.data.px_response.Price}</div>` : ''}
                        ${data.data.px_response.BuyerName ? `<div><strong>Buyer:</strong> ${data.data.px_response.BuyerName}</div>` : ''}
                        ${data.data.px_response.Message ? `<div><strong>Message:</strong> ${data.data.px_response.Message}</div>` : ''}
                    </div>
                </div>
                ` : ''}
                
                <div>
                    <h4 class="font-medium text-gray-900 mb-2">Raw Response</h4>
                    <pre class="bg-gray-100 p-3 rounded text-xs overflow-x-auto">${JSON.stringify(data, null, 2)}</pre>
                </div>
            </div>
        `;
    } else {
        html = `
            <div class="mb-4">
                <div class="flex items-center mb-2">
                    <i class="fas fa-exclamation-circle text-red-600 mr-2"></i>
                    <span class="font-semibold text-red-800">Direct Post Failed</span>
                </div>
            </div>
            
            <div class="space-y-4">
                ${data.data?.px_error ? `
                <div>
                    <h4 class="font-medium text-gray-900 mb-2">PX Error</h4>
                    <div class="bg-red-50 p-3 rounded text-sm">
                        <div><strong>Code:</strong> ${data.data.px_error.code}</div>
                        <div><strong>Message:</strong> ${data.data.px_error.message}</div>
                    </div>
                </div>
                ` : ''}
                
                <div>
                    <h4 class="font-medium text-gray-900 mb-2">Error Details</h4>
                    <div class="bg-red-50 p-3 rounded text-sm">
                        <div><strong>Error:</strong> ${data.error || 'Unknown error'}</div>
                        ${data.message ? `<div><strong>Message:</strong> ${data.message}</div>` : ''}
                    </div>
                </div>
                
                <div>
                    <h4 class="font-medium text-gray-900 mb-2">Raw Response</h4>
                    <pre class="bg-gray-100 p-3 rounded text-xs overflow-x-auto">${JSON.stringify(data, null, 2)}</pre>
                </div>
            </div>
        `;
    }
    
    responseContent.innerHTML = html;
    resultsDiv.classList.remove('hidden');
    resultsDiv.scrollIntoView({ behavior: 'smooth' });
}