// ============================================
// FastShip Global - Supabase Configuration
// ============================================
//
// هذا الملف يحتوي على إعدادات Supabase
// تأكد من عدم مشاركة هذه المعلومات علنا
//
// ============================================

const SUPABASE_URL = 'https://moxpokcjdmnrlbywmszw.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1veHBva2NqZG1ucmxieXdtc3p3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MjIzMTgsImV4cCI6MjA3ODA5ODMxOH0.XNjV8YSDpE9K1JBulUFGmWpkpZTFmAv5LO7k-byK_GE';

// التحقق من أن المكتبة محملة
if (typeof window.supabase === 'undefined') {
    console.error('❌ Supabase library not loaded! Include CDN first.');
    alert('خطأ: مكتبة Supabase غير محملة');
}

// إنشاء Supabase client
try {
    window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
            storageKey: 'fastship-auth-token'
        },
        db: {
            schema: 'public'
        }
    });
    
    // إنشاء client مع alias للتوافق
    window.supabase = window.supabaseClient;
    
    console.log('✅ Supabase initialized successfully');
    
    // التحقق من الجلسة الحالية
    window.supabaseClient.auth.getSession().then(({ data, error }) => {
        if (error) {
            console.error('Session error:', error);
        } else if (data.session) {
            console.log('👤 User logged in:', data.session.user.email);
        } else {
            console.log('🔓 No active session');
        }
    });
    
} catch (error) {
    console.error('❌ Failed to initialize Supabase:', error);
    alert('فشل الاتصال بقاعدة البيانات');
}

// تصدير للاستخدام
window.SUPABASE_URL = SUPABASE_URL;
window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
