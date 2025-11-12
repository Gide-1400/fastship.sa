// ============================================
// FastShip Shared - Utility Functions
// دوال مساعدة مشتركة
// ============================================

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Format date and time
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('ar-SA', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('ar-SA', {
        style: 'currency',
        currency: 'SAR'
    }).format(amount);
}

// Format weight
function formatWeight(weight) {
    return `${weight} كجم`;
}

// Get status text in Arabic
function getStatusText(status) {
    const statuses = {
        'pending': 'في الانتظار',
        'matched': 'تم الربط',
        'in_transit': 'في النقل',
        'delivered': 'تم التسليم',
        'cancelled': 'ملغي'
    };
    return statuses[status] || status;
}

// Get shipment type text in Arabic
function getShipmentTypeText(type) {
    const types = {
        'documents': 'وثائق',
        'electronics': 'إلكترونيات',
        'furniture': 'أثاث',
        'clothing': 'ملابس',
        'food': 'طعام',
        'other': 'أخرى'
    };
    return types[type] || type;
}

// Validate email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Validate phone number (Saudi format)
function isValidPhone(phone) {
    const phoneRegex = /^(\+966|0)?[5][0-9]{8}$/;
    return phoneRegex.test(phone);
}

// Show loading spinner
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '<div class="text-center"><div class="spinner-border" role="status"><span class="sr-only">جاري التحميل...</span></div></div>';
    }
}

// Hide loading spinner
function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '';
    }
}

// Show alert message
function showAlert(message, type = 'info') {
    const alertClass = {
        'success': 'bg-green-100 border-green-500 text-green-700',
        'error': 'bg-red-100 border-red-500 text-red-700',
        'warning': 'bg-yellow-100 border-yellow-500 text-yellow-700',
        'info': 'bg-blue-100 border-blue-500 text-blue-700'
    };

    const alertHtml = `
        <div class="fixed top-4 right-4 z-50 p-4 rounded-lg border-l-4 ${alertClass[type]} shadow-lg max-w-sm">
            <div class="flex items-center">
                <div class="flex-1">${message}</div>
                <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-gray-500 hover:text-gray-700">&times;</button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', alertHtml);

    // Auto remove after 5 seconds
    setTimeout(() => {
        const alert = document.querySelector('.fixed.top-4.right-4');
        if (alert) alert.remove();
    }, 5000);
}

// Confirm dialog
function confirmDialog(message) {
    return window.confirm(message);
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showAlert('تم نسخ النص إلى الحافظة', 'success');
    } catch (err) {
        showAlert('فشل في نسخ النص', 'error');
    }
}

// Generate WhatsApp link
function generateWhatsAppLink(phone, message = '') {
    const cleanPhone = phone.replace(/\D/g, '');
    return `https://wa.me/966${cleanPhone}?text=${encodeURIComponent(message)}`;
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle function
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// Export functions for use in other scripts
window.FastShipUtils = {
    formatDate,
    formatDateTime,
    formatCurrency,
    formatWeight,
    getStatusText,
    getShipmentTypeText,
    isValidEmail,
    isValidPhone,
    showLoading,
    hideLoading,
    showAlert,
    confirmDialog,
    copyToClipboard,
    generateWhatsAppLink,
    debounce,
    throttle
};