// main.js - الملف الرئيسي لوظائف الموقع (محدث)

// تهيئة الموقع عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', function() {
    // تهيئة نظام المصادقة
    if (window.authManager) {
        window.authManager.updateUI();
    }
    
    // تهيئة القوائم المنسدلة
    initializeDropdowns();
    
    // تهيئة شرائح الصور
    initializeSliders();
    
    // تهيئة نماذج الاتصال
    initializeForms();
    
    // تهيئة التصميم المتجاوب
    initializeResponsive();
    
    // تهيئة نظام الإشعارات
    initializeNotifications();
});

// تهيئة القوائم المنسدلة
function initializeDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown');
    
    dropdowns.forEach(dropdown => {
        const toggle = dropdown.querySelector('.dropdown-toggle');
        const menu = dropdown.querySelector('.dropdown-menu');
        
        if (toggle && menu) {
            toggle.addEventListener('click', function(e) {
                e.stopPropagation();
                menu.classList.toggle('hidden');
            });
        }
    });
    
    // إغلاق القوائم المنسدلة عند النقر خارجها
    document.addEventListener('click', function() {
        dropdowns.forEach(dropdown => {
            const menu = dropdown.querySelector('.dropdown-menu');
            if (menu && !menu.classList.contains('hidden')) {
                menu.classList.add('hidden');
            }
        });
    });
}

// تهيئة شرائح الصور
function initializeSliders() {
    const sliders = document.querySelectorAll('.slider');
    
    sliders.forEach(slider => {
        const slides = slider.querySelectorAll('.slide');
        const prevBtn = slider.querySelector('.slider-prev');
        const nextBtn = slider.querySelector('.slider-next');
        const dots = slider.querySelectorAll('.slider-dot');
        
        let currentSlide = 0;
        
        function showSlide(index) {
            slides.forEach((slide, i) => {
                slide.classList.toggle('hidden', i !== index);
            });
            
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === index);
            });
            
            currentSlide = index;
        }
        
        if (prevBtn) {
            prevBtn.addEventListener('click', function() {
                let newIndex = currentSlide - 1;
                if (newIndex < 0) newIndex = slides.length - 1;
                showSlide(newIndex);
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', function() {
                let newIndex = currentSlide + 1;
                if (newIndex >= slides.length) newIndex = 0;
                showSlide(newIndex);
            });
        }
        
        dots.forEach((dot, index) => {
            dot.addEventListener('click', function() {
                showSlide(index);
            });
        });
        
        // التمرير التلقائي
        setInterval(() => {
            let newIndex = currentSlide + 1;
            if (newIndex >= slides.length) newIndex = 0;
            showSlide(newIndex);
        }, 5000);
    });
}

// تهيئة النماذج
function initializeForms() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn?.textContent;
            
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'جاري الإرسال...';
            }
            
            // محاكاة إرسال النموذج
            setTimeout(() => {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalText;
                }
                
                showNotification('تم إرسال النموذج بنجاح!', 'success');
            }, 2000);
        });
    });
}

// تهيئة التصميم المتجاوب
function initializeResponsive() {
    // إضافة حدث تغيير حجم الشاشة
    window.addEventListener('resize', function() {
        // تحديث أي عناصر تحتاج إلى تعديل حسب حجم الشاشة
        updateResponsiveElements();
    });
}

// تحديث العناصر المتجاوبة
function updateResponsiveElements() {
    const screenWidth = window.innerWidth;
    const elements = document.querySelectorAll('[data-responsive]');
    
    elements.forEach(element => {
        const config = JSON.parse(element.dataset.responsive);
        
        for (const breakpoint in config) {
            if (screenWidth >= parseInt(breakpoint)) {
                Object.assign(element.style, config[breakpoint]);
            }
        }
    });
}

// تهيئة نظام الإشعارات
function initializeNotifications() {
    // يمكن إضافة المزيد من وظائف الإشعارات هنا
}

// وظيفة لعرض الإشعارات
function showNotification(message, type = 'info') {
    // إنشاء عنصر الإشعار
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg text-white transform transition-transform duration-300 ${
        type === 'success' ? 'bg-green-500' : 
        type === 'error' ? 'bg-red-500' : 
        type === 'warning' ? 'bg-yellow-500' : 
        'bg-blue-500'
    }`;
    
    notification.innerHTML = `
        <div class="flex items-center justify-between">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" class="mr-2 text-white hover:text-gray-200">
                ✕
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // إزالة الإشعار تلقائياً بعد 5 ثوانٍ
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

// وظيفة لتنسيق الأرقام
function formatNumber(number) {
    return new Intl.NumberFormat('ar-SA').format(number);
}

// وظيفة لتنسيق التاريخ
function formatDate(date) {
    return new Intl.DateTimeFormat('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(new Date(date));
}

// وظيفة لإضافة تأثير التحميل
function showLoading(element) {
    const originalContent = element.innerHTML;
    element.innerHTML = `
        <div class="flex items-center justify-center">
            <div class="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
            <span class="mr-2">جاري التحميل...</span>
        </div>
    `;
    element.disabled = true;
    
    return function() {
        element.innerHTML = originalContent;
        element.disabled = false;
    };
}

// وظيفة للانتقال السلس إلى الأقسام
function smoothScrollTo(target) {
    const element = document.querySelector(target);
    if (element) {
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// إضافة تأثيرات عند التمرير
window.addEventListener('scroll', function() {
    const elements = document.querySelectorAll('.fade-in-on-scroll');
    
    elements.forEach(element => {
        const elementTop = element.getBoundingClientRect().top;
        const windowHeight = window.innerHeight;
        
        if (elementTop < windowHeight - 100) {
            element.classList.add('opacity-100', 'translate-y-0');
            element.classList.remove('opacity-0', 'translate-y-4');
        }
    });
});

// تهيئة خرائط Google (إذا كانت مستخدمة)
function initMap() {
    // يمكن إضافة تهيئة الخرائط هنا
}

// إدارة حالة التطبيق
const appState = {
    currentPage: window.location.pathname,
    user: null,
    settings: {
        theme: 'light',
        language: 'ar'
    },
    
    setUser(user) {
        this.user = user;
        this.updateUI();
    },
    
    updateUI() {
        // تحديث الواجهة بناءً على حالة المستخدم
        const authElements = document.querySelectorAll('[data-auth]');
        
        authElements.forEach(element => {
            const authType = element.dataset.auth;
            
            if (authType === 'required' && !this.user) {
                element.style.display = 'none';
            } else if (authType === 'optional' && this.user) {
                element.style.display = 'none';
            } else {
                element.style.display = 'block';
            }
        });
    },
    
    toggleTheme() {
        this.settings.theme = this.settings.theme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', this.settings.theme);
        localStorage.setItem('theme', this.settings.theme);
    },
    
    setLanguage(lang) {
        this.settings.language = lang;
        document.documentElement.setAttribute('lang', lang);
        document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
        localStorage.setItem('language', lang);
    }
};

// تحميل الإعدادات المحفوظة
const savedTheme = localStorage.getItem('theme');
const savedLanguage = localStorage.getItem('language');

if (savedTheme) {
    appState.settings.theme = savedTheme;
    document.documentElement.setAttribute('data-theme', savedTheme);
}

if (savedLanguage) {
    appState.settings.language = savedLanguage;
    document.documentElement.setAttribute('lang', savedLanguage);
    document.documentElement.setAttribute('dir', savedLanguage === 'ar' ? 'rtl' : 'ltr');
}

// جعل الدوال متاحة عالمياً
window.showNotification = showNotification;
window.smoothScrollTo = smoothScrollTo;
window.showLoading = showLoading;
window.appState = appState;