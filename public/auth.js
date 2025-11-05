// نظام المصادقة والإدارة للمنصة (محدث مع Firebase)
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        // تحميل بيانات المستخدم من localStorage
        this.loadCurrentUser();
        
        // تحديث واجهة المستخدم بناءً على حالة تسجيل الدخول
        this.updateUI();
    }

    loadCurrentUser() {
        const userData = localStorage.getItem('currentUser');
        if (userData) {
            this.currentUser = JSON.parse(userData);
        }
    }

    saveCurrentUser(user) {
        this.currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(user));
    }

    clearCurrentUser() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
    }

    async login(email, password) {
        try {
            const userCredential = await window.firebaseSignIn(window.firebaseAuth, email, password);
            const user = userCredential.user;
            
            const userData = {
                uid: user.uid,
                email: user.email,
                emailVerified: user.emailVerified,
                displayName: user.displayName,
                photoURL: user.photoURL
            };
            
            this.saveCurrentUser(userData);
            this.updateUI();
            return true;
            
        } catch (error) {
            console.error('خطأ في تسجيل الدخول:', error);
            return false;
        }
    }

    async register(userData) {
        try {
            // إنشاء المستخدم في Firebase Authentication
            const userCredential = await window.firebaseCreateUser(window.firebaseAuth, userData.email, userData.password);
            const user = userCredential.user;

            // تحديث ملف المستخدم
            await window.firebaseUpdateProfile(user, {
                displayName: `${userData.firstName} ${userData.lastName}`,
                photoURL: userData.profileImage
            });

            // حفظ البيانات الإضافية في Firestore
            const userProfile = {
                uid: user.uid,
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
                phone: userData.phone,
                city: userData.city,
                accountType: userData.accountType,
                vehicleType: userData.vehicleType,
                vehicleModel: userData.vehicleModel,
                licenseNumber: userData.licenseNumber,
                createdAt: new Date().toISOString(),
                profileImage: userData.profileImage,
                isActive: true,
                rating: userData.accountType === 'traveler' ? 5.0 : null,
                completedTrips: userData.accountType === 'traveler' ? 0 : null
            };

            // حفظ البيانات في Firestore
            await window.firebaseSetDoc(window.firebaseDoc(window.firebaseDB, "users", user.uid), userProfile);

            // حفظ بيانات المستخدم
            const currentUserData = {
                uid: user.uid,
                email: user.email,
                emailVerified: user.emailVerified,
                displayName: user.displayName,
                photoURL: user.photoURL
            };
            
            this.saveCurrentUser(currentUserData);
            return true;
            
        } catch (error) {
            console.error('خطأ في إنشاء الحساب:', error);
            return false;
        }
    }

    async logout() {
        try {
            await window.firebaseSignOut(window.firebaseAuth);
            this.clearCurrentUser();
            this.updateUI();
            window.location.href = 'index.html';
        } catch (error) {
            console.error('خطأ في تسجيل الخروج:', error);
        }
    }

    updateUI() {
        // تحديث واجهة المستخدم بناءً على حالة تسجيل الدخول
        const loginBtn = document.getElementById('login-btn');
        const registerBtn = document.getElementById('register-btn');
        const userMenu = document.getElementById('user-menu');
        const userName = document.getElementById('user-name');
        const userType = document.getElementById('user-type');

        if (this.currentUser) {
            // إخفاء أزرار تسجيل الدخول والتسجيل
            if (loginBtn) loginBtn.style.display = 'none';
            if (registerBtn) registerBtn.style.display = 'none';
            
            // إظهار قائمة المستخدم
            if (userMenu) userMenu.style.display = 'block';
            if (userName) userName.textContent = this.currentUser.displayName || this.currentUser.email;
            if (userType) {
                userType.textContent = 'مستخدم';
                userType.className = 'bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs';
            }
        } else {
            // إظهار أزرار تسجيل الدخول والتسجيل
            if (loginBtn) loginBtn.style.display = 'block';
            if (registerBtn) registerBtn.style.display = 'block';
            
            // إخفاء قائمة المستخدم
            if (userMenu) userMenu.style.display = 'none';
        }
    }

    isLoggedIn() {
        return this.currentUser !== null;
    }

    getCurrentUser() {
        return this.currentUser;
    }

    async updateProfile(profileData) {
        if (!this.currentUser) return false;

        try {
            // تحديث البيانات في Firebase
            const user = window.firebaseAuth.currentUser;
            if (user) {
                await window.firebaseUpdateProfile(user, {
                    displayName: `${profileData.firstName} ${profileData.lastName}`
                });
            }

            // تحديث البيانات في Firestore
            await window.firebaseSetDoc(
                window.firebaseDoc(window.firebaseDB, "users", this.currentUser.uid),
                {
                    firstName: profileData.firstName,
                    lastName: profileData.lastName,
                    phone: profileData.phone,
                    city: profileData.city
                },
                { merge: true }
            );

            // تحديث البيانات المحلية
            this.currentUser.displayName = `${profileData.firstName} ${profileData.lastName}`;
            this.saveCurrentUser(this.currentUser);
            
            return true;
        } catch (error) {
            console.error('خطأ في تحديث الملف:', error);
            return false;
        }
    }

    async changePassword(currentPassword, newPassword) {
        // في Firebase، تحتاج إلى إعادة المصادقة لتغيير كلمة المرور
        // هذا يتطلب تنفيذ أكثر تعقيداً
        console.log('تغيير كلمة المرور يتطلب تنفيذ إضافي في Firebase');
        return false;
    }

    // الحصول على المسافرين المتاحين
    async getAvailableTravelers() {
        try {
            // هذا يتطلب استعلام Firestore
            console.log('جاري جلب بيانات المسافرين من Firestore');
            return [];
        } catch (error) {
            console.error('خطأ في جلب المسافرين:', error);
            return [];
        }
    }

    // الحصول على إحصائيات المستخدم
    async getUserStats() {
        if (!this.currentUser) return null;

        try {
            // جلب الإحصائيات من Firestore
            // هذا مثال بسيط - في التطبيق الحقيقي تحتاج لجلب البيانات من Firestore
            return {
                completedTrips: 12,
                rating: 5.0,
                earnings: 2450
            };
        } catch (error) {
            console.error('خطأ في جلب الإحصائيات:', error);
            return null;
        }
    }
}

// تهيئة نظام المصادقة
window.authManager = new AuthManager();

// تحديث الواجهة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    window.authManager.updateUI();
    
    // عرض رسالة النجاح إذا كان المستخدم قد سجل للتو
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('registered') === 'true') {
        showNotification('تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.', 'success');
    }
});

// وظيفة لعرض الإشعارات
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg text-white ${
        type === 'success' ? 'bg-green-500' : 
        type === 'error' ? 'bg-red-500' : 
        'bg-blue-500'
    }`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// وظيفة للتحقق من صحة البريد الإلكتروني
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// وظيفة للتحقق من صحة رقم الجوال السعودي
function isValidSaudiPhone(phone) {
    const phoneRegex = /^05\d{8}$/;
    return phoneRegex.test(phone);
}