// ============================================
// FastShip Global - Session Management
// ============================================
// ملف مشترك لإدارة جلسات المستخدمين في جميع صفحات الموقع

class SessionManager {
    constructor() {
        this.currentUser = null;
        this.isInitialized = false;
        this.initPromise = null;
    }

    // Initialize session management
    async init() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = this._doInit();
        return this.initPromise;
    }

    async _doInit() {
        try {
            // Wait for Supabase to be ready
            if (!window.supabaseClient) {
                await this._waitForSupabase();
            }

            // Wait for session restoration from localStorage
            // Longer wait time to ensure session is properly loaded
            await new Promise(resolve => setTimeout(resolve, 500));

            // Check existing session with retry
            let session = null;
            let sessionError = null;

            // Try up to 3 times to get session (in case of timing issues)
            for (let attempt = 1; attempt <= 3; attempt++) {
                const { data, error } = await window.supabaseClient.auth.getSession();
                sessionError = error;
                session = data?.session;

                if (session) {
                    console.log(`✅ Session found on attempt ${attempt}:`, session.user.email);
                    break;
                } else if (error) {
                    console.error(`Session check error on attempt ${attempt}:`, error);
                } else {
                    console.log(`🔓 No session found on attempt ${attempt}`);
                }

                // Wait before retry
                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }
            
            if (sessionError) {
                console.error('Final session check error:', sessionError);
                this.currentUser = null;
            } else if (session) {
                await this._loadUserProfile(session.user);
                console.log('Session restored successfully, user loaded');
            } else {
                // Try to restore from backup if available
                const backupUser = localStorage.getItem('fastship_user_backup');
                if (backupUser) {
                    try {
                        const userData = JSON.parse(backupUser);
                        console.log('🔄 Attempting to restore from backup:', userData.email);
                        
                        // Check if backup is recent (within last 7 days)
                        const loginTime = new Date(userData.loginTime);
                        const now = new Date();
                        const daysSinceLogin = (now - loginTime) / (1000 * 60 * 60 * 24);
                        
                        if (daysSinceLogin <= 7) {
                            console.log('📦 Using backup user data');
                            this.currentUser = {
                                id: userData.id,
                                email: userData.email,
                                profile: null
                            };
                            
                            // Try to load profile from database
                            await this._loadUserProfile({ 
                                id: userData.id, 
                                email: userData.email 
                            });
                        } else {
                            console.log('⏰ Backup too old, clearing');
                            localStorage.removeItem('fastship_user_backup');
                        }
                    } catch (e) {
                        console.error('❌ Error parsing backup user data:', e);
                        localStorage.removeItem('fastship_user_backup');
                    }
                }
                
                if (!this.currentUser) {
                    console.log('🔓 No persisted session found after all attempts');
                }
            }

            // Listen for auth changes
            window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
                console.log('🔄 Auth state changed:', event, session?.user?.email);
                
                if (event === 'SIGNED_IN' && session) {
                    console.log('✅ User signed in, updating profile');
                    
                    // Store backup information
                    const userInfo = {
                        email: session.user.email,
                        id: session.user.id,
                        loginTime: new Date().toISOString(),
                        user_metadata: session.user.user_metadata || {}
                    };
                    localStorage.setItem('fastship_user_backup', JSON.stringify(userInfo));
                    
                    await this._loadUserProfile(session.user);
                    this._updateAllNavbars();
                    
                } else if (event === 'SIGNED_OUT') {
                    console.log('🔓 User signed out');
                    this.currentUser = null;
                    
                    // Clear backup data
                    localStorage.removeItem('fastship_user_backup');
                    
                    this._updateAllNavbars();
                    
                } else if (event === 'TOKEN_REFRESHED' && session) {
                    console.log('🔄 Token refreshed successfully');
                    
                    // Update backup with new timestamp
                    const userInfo = {
                        email: session.user.email,
                        id: session.user.id,
                        loginTime: new Date().toISOString(),
                        user_metadata: session.user.user_metadata || {}
                    };
                    localStorage.setItem('fastship_user_backup', JSON.stringify(userInfo));
                }
            });

            this.isInitialized = true;
            this._updateAllNavbars();
            console.log('Session manager initialized, final state:', this.currentUser);
            
        } catch (error) {
            console.error('Session initialization error:', error);
            this.currentUser = null;
        }
    }

    // Wait for Supabase to be loaded
    async _waitForSupabase(maxWait = 5000) {
        const startTime = Date.now();
        
        while (!window.supabaseClient && (Date.now() - startTime) < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (!window.supabaseClient) {
            throw new Error('Supabase client not available');
        }
    }

    // Load user profile from database
    async _loadUserProfile(authUser) {
        try {
            const { data: profile, error } = await window.supabaseClient
                .from('users')
                .select('*')
                .eq('auth_user_id', authUser.id)
                .single();

            if (error && error.code !== 'PGRST116') { // Not found error is OK
                console.error('Profile load error:', error);
            }

            this.currentUser = {
                id: authUser.id,
                email: authUser.email,
                profile: profile || null
            };

            console.log('User profile loaded:', this.currentUser);
            // Update UI immediately after loading profile
            this._updateAllNavbars();

        } catch (error) {
            console.error('Error loading user profile:', error);
            this.currentUser = {
                id: authUser.id,
                email: authUser.email,
                profile: null
            };
        }
    }

    // Update all navigation bars on the page
    _updateAllNavbars() {
        // Update main navbar
        this._updateNavbar();
        
        // Update any sidebar navbars (for dashboard pages)
        this._updateSidebarNavbar();
    }

    // Update main navigation bar
    _updateNavbar() {
        const notLoggedInMenu = document.getElementById('notLoggedInMenu');
        const loggedInMenu = document.getElementById('loggedInMenu');
        const userName = document.getElementById('userName');
        const userNameDisplay = document.getElementById('userNameDisplay');

        console.log('Updating navbar, isLoggedIn:', this.isLoggedIn(), 'currentUser:', this.currentUser);

        if (!notLoggedInMenu || !loggedInMenu) {
            console.log('Navbar elements not found');
            return; // Not on a page with these elements
        }

        if (this.isLoggedIn()) {
            console.log('Showing logged in state');
            // Show logged in state
            notLoggedInMenu.classList.add('hidden');
            loggedInMenu.classList.remove('hidden');
            
            const displayName = this.currentUser.profile?.full_name ||
                               this.currentUser.profile?.email?.split('@')[0] ||
                               this.currentUser.email?.split('@')[0] ||
                               'المستخدم';
            
            console.log('Display name:', displayName);
            if (userName) userName.textContent = displayName;
            if (userNameDisplay) userNameDisplay.textContent = displayName;

        } else {
            console.log('Showing logged out state');
            // Show logged out state
            notLoggedInMenu.classList.remove('hidden');
            loggedInMenu.classList.add('hidden');
        }
    }

    // Update sidebar navigation (for dashboard pages)
    _updateSidebarNavbar() {
        const userInfo = document.querySelector('.user-info');
        const userNameSidebar = document.getElementById('userNameSidebar');
        const userEmailSidebar = document.getElementById('userEmailSidebar');

        if (userInfo && this.isLoggedIn()) {
            const displayName = this.currentUser.profile?.full_name || 
                               this.currentUser.email?.split('@')[0] || 
                               'المستخدم';
            
            const email = this.currentUser.email || '';

            if (userNameSidebar) userNameSidebar.textContent = displayName;
            if (userEmailSidebar) userEmailSidebar.textContent = email;
        }
    }

    // Check if user is logged in
    isLoggedIn() {
        return this.currentUser !== null;
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }

    // Get user type (shipper or carrier)
    getUserType() {
        // First try to get from profile
        if (this.currentUser?.profile?.user_type) {
            return this.currentUser.profile.user_type;
        }

        // Fallback: try to get from localStorage (for backwards compatibility)
        try {
            const userData = localStorage.getItem('fastship_user');
            if (userData) {
                const user = JSON.parse(userData);
                return user.user_metadata?.user_type || null;
            }
        } catch (e) {}

        return null;
    }

    // Wait for user profile to be loaded (with timeout)
    async waitForUserProfile(maxWait = 5000) {
        const startTime = Date.now();

        while (!this.currentUser?.profile?.user_type && (Date.now() - startTime) < maxWait) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return this.getUserType();
    }

    // Logout user
    async logout() {
        try {
            if (window.supabaseClient) {
                await window.supabaseClient.auth.signOut();
            }
            
            this.currentUser = null;
            
            // Clear specific auth-related items (safer than clearing all localStorage)
            localStorage.removeItem('fastship_user_backup');
            localStorage.removeItem('fastship_user');
            
            // Clear any Supabase auth tokens
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('sb-') || key.includes('supabase') || key.includes('auth')) {
                    localStorage.removeItem(key);
                }
            });
            
            sessionStorage.clear();
            
            // Update UI
            this._updateAllNavbars();
            
            // Redirect to home page
            if (window.location.pathname !== '/index.html' && !window.location.pathname.endsWith('/public/')) {
                window.location.href = this._getHomePath();
            }
            
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            return false;
        }
    }

    // Go to appropriate dashboard
    async goToDashboard() {
        if (!this.isLoggedIn()) {
            window.location.href = this._getAuthPath('login.html');
            return;
        }
        // إذا لم يوجد صف للمستخدم في جدول users، أنشئه تلقائياً
        if (!this.currentUser?.profile) {
            // جلب بيانات المستخدم من Supabase Auth/localStorage
            let userType = null;
            let fullName = null;
            let phone = null;
            let email = this.currentUser?.email;
            try {
                const userData = localStorage.getItem('fastship_user');
                if (userData) {
                    const user = JSON.parse(userData);
                    userType = user.user_metadata?.user_type;
                    fullName = user.user_metadata?.full_name || '';
                    phone = user.user_metadata?.phone || '';
                }
            } catch (e) {}
            if (!userType) userType = 'carrier'; // fallback
            // محاولة إنشاء صف users
            try {
                const { data: userData, error: userError } = await window.supabaseClient
                    .from('users')
                    .insert([
                        {
                            auth_user_id: this.currentUser.id,
                            email: email,
                            full_name: fullName || email,
                            phone: phone || '',
                            user_type: userType
                        }
                    ])
                    .select()
                    .single();

                if (userError) {
                    alert('تعذر إنشاء بياناتك تلقائياً. يرجى التواصل مع الدعم.');
                    window.location.href = this._getAuthPath('register.html');
                    return;
                }

                // إنشاء سجل في جدول shippers أو carriers حسب نوع المستخدم
                if (userType === 'carrier') {
                    const { error: shipperError } = await window.supabaseClient
                        .from('carriers')
                        .insert([
                            {
                                user_id: userData.id,
                                company_name: fullName || email,
                                status: 'active'
                            }
                        ]);

                    if (shipperError) {
                        console.error('Error creating shipper record:', shipperError);
                        // لا تفشل العملية بالكامل إذا فشل إنشاء سجل shipper
                    } else {
                        console.log('Shipper record created successfully for user:', userData.id);
                    }
                } else if (userType === 'carrier') {
                    const { error: carrierError } = await window.supabaseClient
                        .from('carriers')
                        .insert([
                            {
                                user_id: userData.id,
                                vehicle_type: 'any',
                                status: 'active'
                            }
                        ]);

                    if (carrierError) {
                        console.error('Error creating carrier record:', carrierError);
                        // لا تفشل العملية بالكامل إذا فشل إنشاء سجل carrier
                    }
                }

                // إعادة تحميل بيانات المستخدم بعد الإنشاء
                await this._loadUserProfile({ id: this.currentUser.id, email });
            } catch (e) {
                console.error('Error creating user profile:', e);
                alert('حدث خطأ أثناء إنشاء بياناتك. يرجى التواصل مع الدعم.');
                window.location.href = this._getAuthPath('register.html');
                return;
            }
        }
        // تصحيح التوجيه حسب نوع المستخدم
        let userType = this.getUserType();
        // fallback: إذا كان userType غير موجود، جرب جلبه من localStorage
        if (!userType) {
            try {
                const userData = localStorage.getItem('fastship_user');
                if (userData) {
                    const user = JSON.parse(userData);
                    userType = user.user_metadata?.user_type;
                }
            } catch (e) {}
        }
        if (userType === 'carrier') {
            window.location.href = 'shipper-home.html';
        } else if (userType === 'carrier') {
            // إذا كان ناقل، وجهه للصفحة الرئيسية لأنه لا يوجد قسم ناقل
            alert('قسم الناقل غير متوفر حالياً');
            window.location.href = '../index.html';
        } else {
            alert('نوع المستخدم غير معروف. يرجى إكمال بياناتك أو التواصل مع الدعم.');
            window.location.href = 'register.html';
        }
    }

    // Helper to get correct path based on current location
    _getHomePath() {
        // من مجلد shipper-app، نحتاج للعودة للمجلد الأساسي
        return '../index.html';
    }

    _getAuthPath(page) {
        // بما أننا في مجلد shipper-app، نوجه للمسار النسبي
        return page;
    }

    _getDashboardPath(page) {
        // بما أننا في قسم الناقل فقط، نوجه دائماً للمسار النسبي
        return page;
    }

    // Require authentication (redirect to login if not logged in)
    requireAuth() {
        if (!this.isLoggedIn()) {
            window.location.href = this._getAuthPath('login.html');
            return false;
        }
        return true;
    }

    // Require specific user type (shipper or carrier)
    requireUserType(requiredType) {
        if (requiredType !== 'carrier' && requiredType !== 'carrier') {
            throw new Error('Invalid user type. Only shipper or carrier is supported.');
        }

        if (!this.requireAuth()) return false;

        const userType = this.getUserType();
        if (userType !== requiredType) {
            alert('غير مصرح لك بالوصول إلى هذه الصفحة');
            this.goToDashboard();
            return false;
        }
        return true;
    }

    // Create a notification for a user
    async createNotification(userId, type, title, message, relatedId = null) {
        try {
            if (!window.supabaseClient) {
                throw new Error('Supabase client not available');
            }

            const { data, error } = await window.supabaseClient
                .from('notifications')
                .insert([{
                    user_id: userId,
                    type: type,
                    title: title,
                    message: message,
                    related_id: relatedId,
                    is_read: false
                }])
                .select()
                .single();

            if (error) throw error;

            console.log('Notification created:', data);
            return data;
        } catch (error) {
            console.error('Error creating notification:', error);
            return null;
        }
    }

    // Create a system notification for current user
    async createSystemNotification(title, message, relatedId = null) {
        if (!this.currentUser) return null;
        return this.createNotification(this.currentUser.id, 'system', title, message, relatedId);
    }

    // Create a shipment notification for current user
    async createShipmentNotification(title, message, shipmentId) {
        if (!this.currentUser) return null;
        return this.createNotification(this.currentUser.id, 'shipment', title, message, shipmentId);
    }

    // Create a message notification for current user
    async createMessageNotification(title, message, messageId) {
        if (!this.currentUser) return null;
        return this.createNotification(this.currentUser.id, 'message', title, message, messageId);
    }

    // Ensure shipper record exists for current user
    async ensureCarrierRecord() {
        if (!this.isLoggedIn()) {
            throw new Error('المستخدم غير مسجل دخول');
        }

        try {
            // Check if shipper record exists
            const { data: shipperData, error: shipperError } = await window.supabaseClient
                .from('carriers')
                .select('id')
                .eq('user_id', this.currentUser.profile?.id)
                .single();

            if (shipperData) {
                return shipperData.id; // Shipper record exists
            }

            // If not found (PGRST116 error), create it
            if (shipperError && shipperError.code === 'PGRST116') {
                console.log('Creating shipper record for user...');
                
                const { data: newShipperData, error: createError } = await window.supabaseClient
                    .from('carriers')
                    .insert([{
                        user_id: this.currentUser.profile.id,
                        company_name: this.currentUser.profile?.full_name || this.currentUser.email || 'ناقل',
                        status: 'active'
                    }])
                    .select('id')
                    .single();

                if (createError) {
                    console.error('Error creating shipper record:', createError);
                    throw new Error('فشل في إنشاء سجل الناقل');
                }

                console.log('Shipper record created successfully');
                return newShipperData.id;
            }

            // Other errors
            throw shipperError;

        } catch (error) {
            console.error('Error ensuring shipper record:', error);
            throw error;
        }
    }
}

// Create global session manager instance
window.sessionManager = new SessionManager();

// Global functions for backwards compatibility
window.toggleAccountMenu = function() {
    const menu = document.getElementById('accountMenu');
    const userMenu = document.getElementById('userMenu');
    if (menu) {
        menu.classList.toggle('hidden');
        if (userMenu) userMenu.classList.add('hidden');
    }
};

window.toggleUserMenu = function() {
    const menu = document.getElementById('userMenu');
    const accountMenu = document.getElementById('accountMenu');
    if (menu) {
        menu.classList.toggle('hidden');
        if (accountMenu) accountMenu.classList.add('hidden');
    }
};

window.goToDashboard = function() {
    window.sessionManager.goToDashboard();
};

window.logout = async function() {
    const success = await window.sessionManager.logout();
    if (success) {
        alert('تم تسجيل الخروج بنجاح');
    } else {
        alert('حدث خطأ أثناء تسجيل الخروج');
    }
};

window.viewProfile = function() {
    alert('صفحة الملف الشخصي قيد التطوير');
};

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // Initialize session manager with more time for session restoration
    setTimeout(() => {
        window.sessionManager.init().catch(error => {
            console.error('Session manager initialization failed:', error);
        });
    }, 100);
});

// Also check on page visibility change (when returning to tab)
document.addEventListener('visibilitychange', function() {
    if (!document.hidden && window.sessionManager.isInitialized) {
        // Check if session is still valid when user returns to tab
        setTimeout(() => {
            window.sessionManager._doInit();
        }, 100);
    }
});

// Check session on page focus
window.addEventListener('focus', function() {
    if (window.sessionManager.isInitialized) {
        setTimeout(() => {
            window.sessionManager._doInit();
        }, 100);
    }
});

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionManager;
}