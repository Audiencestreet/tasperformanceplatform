// PX Direct Post and Ping-Post Test Interface
document.addEventListener('DOMContentLoaded', function() {
    // API Method Selection
    const methodRadios = document.querySelectorAll('input[name="api-method"]');
    const directPostForm = document.getElementById('direct-post-form');
    const pingPostForm = document.getElementById('ping-post-form');
    
    methodRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'direct') {
                directPostForm.classList.remove('hidden');
                pingPostForm.classList.add('hidden');
            } else if (this.value === 'ping-post') {
                directPostForm.classList.add('hidden');
                pingPostForm.classList.remove('hidden');
            }
        });
    });
    
    // Show/hide vertical-specific fields for Direct Post
    const verticalSelect = document.getElementById('vertical');
    const solarFields = document.getElementById('solar-fields');
    const healthFields = document.getElementById('health-fields');
    
    if (verticalSelect) {
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
    }
    
    // Direct Post Form submission
    const directForm = document.getElementById('px-test-form');
    if (directForm) {
        directForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = directForm.querySelector('button[type="submit"]');
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
                displayResults(response.data, true, 'direct');
                
            } catch (error) {
                console.error('Error sending to PX API:', error);
                let errorData = error.response?.data || { success: false, error: 'Network error' };
                displayResults(errorData, false, 'direct');
            } finally {
                // Re-enable submit button
                submitBtn.disabled = false;
                submitText.textContent = 'Send Direct Post';
            }
        });
    }
    
    // Ping-Post Form submission
    const pingPostForm = document.getElementById('ping-post-test-form');
    if (pingPostForm) {
        pingPostForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = pingPostForm.querySelector('button[type="submit"]');
            const submitText = document.getElementById('ping-post-submit-text');
            const resultsDiv = document.getElementById('results');
            const responseContent = document.getElementById('response-content');
            
            // Disable submit button
            submitBtn.disabled = true;
            submitText.textContent = 'Processing...';
            
            try {
                // Collect ping-post form data
                const formData = {
                    firstName: document.getElementById('ping-post-firstName').value,
                    lastName: document.getElementById('ping-post-lastName').value,
                    phone: document.getElementById('ping-post-phone').value,
                    zipCode: document.getElementById('ping-post-zipCode').value,
                    ownership: document.getElementById('ping-post-ownership').value,
                    roofshade: document.getElementById('ping-post-roofshade').value,
                    electricityBill: document.getElementById('ping-post-electricityBill').value,
                    subId: document.getElementById('ping-post-subId').value,
                    // Optional fields
                    email: document.getElementById('ping-post-email').value || '',
                    address: document.getElementById('ping-post-address').value || '',
                    city: document.getElementById('ping-post-city').value || '',
                    state: document.getElementById('ping-post-state').value || ''
                };
                
                console.log('Sending Ping-Post request:', formData);
                
                // Send to PX Ping-Post API
                const response = await axios.post('/api/px/ping-post', formData);
                
                // Display results
                displayResults(response.data, true, 'ping-post');
                
            } catch (error) {
                console.error('Error in Ping-Post process:', error);
                let errorData = error.response?.data || { success: false, error: 'Network error' };
                displayResults(errorData, false, 'ping-post');
            } finally {
                // Re-enable submit button
                submitBtn.disabled = false;
                submitText.textContent = 'Start Ping-Post Process';
            }
        });
    }
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

function displayResults(data, isSuccess, method = 'direct') {
    const resultsDiv = document.getElementById('results');
    const responseContent = document.getElementById('response-content');
    
    // Create result HTML
    let html = '';
    
    if (isSuccess && data.success) {
        if (method === 'ping-post') {
            // Ping-Post specific result display
            html = `
                <div class="mb-4">
                    <div class="flex items-center mb-2">
                        <i class="fas fa-check-circle text-green-600 mr-2"></i>
                        <span class="font-semibold text-green-800">Ping-Post Process Completed</span>
                    </div>
                    <div class="text-sm text-gray-600">Step: ${data.step}</div>
                </div>
                
                <div class="space-y-4">
                    ${data.call_id ? `
                    <div>
                        <h4 class="font-medium text-gray-900 mb-2">Call Information</h4>
                        <div class="bg-blue-50 p-3 rounded text-sm">
                            <div><strong>Call ID:</strong> ${data.call_id}</div>
                        </div>
                    </div>
                    ` : ''}
                    
                    ${data.ping_response ? `
                    <div>
                        <h4 class="font-medium text-gray-900 mb-2">PING Response</h4>
                        <div class="bg-blue-50 p-3 rounded text-sm">
                            <div><strong>Status:</strong> ${data.ping_response.Status}</div>
                            <div><strong>Call ID:</strong> ${data.ping_response.CallId}</div>
                            ${data.ping_response.Message ? `<div><strong>Message:</strong> ${data.ping_response.Message}</div>` : ''}
                        </div>
                    </div>
                    ` : ''}
                    
                    ${data.post_response ? `
                    <div>
                        <h4 class="font-medium text-gray-900 mb-2">POST Response</h4>
                        <div class="bg-green-50 p-3 rounded text-sm">
                            <div><strong>Success:</strong> ${data.post_response.Success || 'N/A'}</div>
                            ${data.post_response.LeadId ? `<div><strong>Lead ID:</strong> ${data.post_response.LeadId}</div>` : ''}
                            ${data.post_response.Price ? `<div><strong>Price:</strong> $${data.post_response.Price}</div>` : ''}
                            ${data.post_response.BuyerName ? `<div><strong>Buyer:</strong> ${data.post_response.BuyerName}</div>` : ''}
                            ${data.post_response.Message ? `<div><strong>Message:</strong> ${data.post_response.Message}</div>` : ''}
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
            // Direct Post result display
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
        }
    } else {
        // Error display
        const processType = method === 'ping-post' ? 'Ping-Post Process' : 'Direct Post';
        html = `
            <div class="mb-4">
                <div class="flex items-center mb-2">
                    <i class="fas fa-exclamation-circle text-red-600 mr-2"></i>
                    <span class="font-semibold text-red-800">${processType} Failed</span>
                </div>
                ${data.step ? `<div class="text-sm text-gray-600">Failed at: ${data.step}</div>` : ''}
            </div>
            
            <div class="space-y-4">
                ${data.px_response ? `
                <div>
                    <h4 class="font-medium text-gray-900 mb-2">PX Response</h4>
                    <div class="bg-yellow-50 p-3 rounded text-sm">
                        ${JSON.stringify(data.px_response, null, 2)}
                    </div>
                </div>
                ` : ''}
                
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