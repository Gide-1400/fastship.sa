// Auth Manager - Simple Session Management
window.AuthManager = {
    // Save user login
    login: function(email, userType = 'carrier') {
        const userData = {
            email: email,
            user_metadata: {
                user_type: userType,
                full_name: email.split('@')[0]
            },
            loginTime: new Date().toISOString()
        };
        localStorage.setItem('fastship_user', JSON.stringify(userData));
        this.updateUI();
    },

    // Check if logged in
    isLoggedIn: function() {
        return localStorage.getItem('fastship_user') !== null;
    },

    // Get user data
    getUser: function() {
        const userData = localStorage.getItem('fastship_user');
        return userData ? JSON.parse(userData) : null;
    },

    // Logout
    logout: function() {
        localStorage.removeItem('fastship_user');
        sessionStorage.removeItem('fastship_user');
        this.updateUI();
        window.location.href = '../index.html';
    },

    // Update UI based on login status
    updateUI: function() {
        const notLoggedIn = document.getElementById('notLoggedInMenu');
        const loggedIn = document.getElementById('loggedInMenu');
        const userName = document.getElementById('userName');
        const userNameDisplay = document.getElementById('userNameDisplay');

        if (this.isLoggedIn()) {
            const user = this.getUser();
            const name = user.user_metadata?.full_name || user.email?.split('@')[0] || 'المستخدم';
            
            if (notLoggedIn) notLoggedIn.style.display = 'none';
            if (loggedIn) loggedIn.style.display = 'flex';
            if (userName) userName.textContent = name;
            if (userNameDisplay) userNameDisplay.textContent = name;
        } else {
            if (notLoggedIn) notLoggedIn.style.display = 'flex';
            if (loggedIn) loggedIn.style.display = 'none';
        }
    },

    // Go to appropriate dashboard
    goToDashboard: function() {
        if (this.isLoggedIn()) {
            const user = this.getUser();
            const userType = user.user_metadata?.user_type || 'carrier';
            if (userType === 'carrier') {
                alert('قسم الناقل غير متوفر حالياً');
                window.location.href = '../index.html';
            } else {
                window.location.href = 'carrier-home.html';
            }
        } else {
            window.location.href = 'login.html';
        }
    }
};

// Auto-update UI when page loads
document.addEventListener('DOMContentLoaded', function() {
    window.AuthManager.updateUI();
});

// Global functions for buttons
window.handleCarrierAction = function() {
    window.AuthManager.goToDashboard();
};

window.handleCarrierAction = function() {
    window.AuthManager.goToDashboard();
};

window.goToDashboard = function() {
    window.AuthManager.goToDashboard();
};

window.logout = function() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        window.AuthManager.logout();
    }
};

window.toggleUserMenu = function() {
    const userMenu = document.getElementById('userMenu');
    if (userMenu) userMenu.classList.toggle('hidden');
};

window.toggleAccountMenu = function() {
    const accountMenu = document.getElementById('accountMenu');
    if (accountMenu) accountMenu.classList.toggle('hidden');
};