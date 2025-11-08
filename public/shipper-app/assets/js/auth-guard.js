// نظام حماية الصفحات وإدارة الجلسات
class AuthGuard {
    constructor() {
        this.init();
    }

    init() {
        // فحص الجلسة عند تحميل أي صفحة
        this.checkAuth();
    }

    // فحص تسجيل الدخول
    isLoggedIn() {
        const userData = localStorage.getItem('fastship_user');
        return userData !== null;
    }

    // الحصول على بيانات المستخدم
    getUser() {
        const userData = localStorage.getItem('fastship_user');
        if (userData) {
            try {
                return JSON.parse(userData);
            } catch (error) {
                console.error('Error parsing user data:', error);
                this.logout();
                return null;
            }
        }
        return null;
    }

    // الحصول على نوع المستخدم
    getUserType() {
        const user = this.getUser();
        return user ? (user.user_metadata?.user_type || 'shipper') : null;
    }

    // فحص الجلسة وإعادة التوجيه حسب الحاجة
    checkAuth() {
        const currentPage = window.location.pathname;
        
        // الصفحات التي تحتاج حماية
        const protectedPages = [
            '/pages/shipper/dashboard.html',
            '/pages/shipper/index.html',
            '/pages/carrier/dashboard.html',
            '/pages/carrier/index.html'
        ];

        // الصفحات الخاصة بالشاحنين
        const shipperPages = [
            '/pages/shipper/dashboard.html',
            '/pages/shipper/index.html'
        ];

        // الصفحات الخاصة بالناقلين
        const carrierPages = [
            '/pages/carrier/dashboard.html',
            '/pages/carrier/index.html'
        ];

        // إذا كانت الصفحة محمية
        if (protectedPages.some(page => currentPage.includes(page))) {
            if (!this.isLoggedIn()) {
                alert('يجب تسجيل الدخول أولاً');
                window.location.href = '/pages/auth/login.html';
                return;
            }

            const userType = this.getUserType();
            
            // فحص نوع المستخدم للصفحة المناسبة
            if (shipperPages.some(page => currentPage.includes(page)) && userType !== 'shipper') {
                alert('هذه الصفحة مخصصة للمرسلين فقط');
                window.location.href = '/pages/carrier/dashboard.html';
                return;
            }

            if (carrierPages.some(page => currentPage.includes(page)) && userType !== 'carrier') {
                alert('هذه الصفحة مخصصة للناقلين فقط');
                window.location.href = '/pages/shipper/dashboard.html';
                return;
            }
        }

        // إذا كان في صفحة تسجيل الدخول وهو مسجل دخول، وجهه للداشبورد
        if (currentPage.includes('/pages/auth/login.html') && this.isLoggedIn()) {
            const userType = this.getUserType();
            if (userType === 'carrier') {
                window.location.href = '/pages/carrier/dashboard.html';
            } else {
                window.location.href = '/pages/shipper/dashboard.html';
            }
        }
    }

    // تسجيل الخروج
    logout() {
        localStorage.removeItem('fastship_user');
        sessionStorage.removeItem('fastship_user');
        window.location.href = '/index.html';
    }

    // حفظ بيانات المستخدم
    saveUser(userData) {
        localStorage.setItem('fastship_user', JSON.stringify(userData));
    }
}

// إنشاء نسخة عامة
window.authGuard = new AuthGuard();

// وظائف مساعدة عامة
window.logout = function() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        window.authGuard.logout();
    }
};

window.goToProfile = function() {
    alert('صفحة الملف الشخصي قيد التطوير');
};

window.goHome = function() {
    window.location.href = '/index.html';
};