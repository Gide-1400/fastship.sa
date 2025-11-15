// ============================================
// FastShip Enhanced Notification System v2.0
// نظام الإشعارات المحسّن مع دعم المطابقات والتحديثات المباشرة
// ============================================

class EnhancedNotificationSystem {
    constructor() {
        this.supabase = window.supabaseClient;
        this.currentUser = null;
        this.subscriptions = [];
    }

    // تهيئة النظام
    async init(user) {
        this.currentUser = user;
        
        // طلب إذن الإشعارات من المتصفح
        await this.requestPermission();
        
        // الاشتراك في التحديثات المباشرة
        this.subscribeToRealTimeUpdates();
    }

    // ============================================
    // إدارة الإشعارات
    // ============================================

    /**
     * إنشاء إشعار جديد
     * @param {Object} notificationData - بيانات الإشعار
     */
    async createNotification(notificationData) {
        // التحقق من أن الإشعار للمستخدم الحالي فقط (بسبب قيود RLS)
        if (!this.currentUser || notificationData.userId !== this.currentUser.id) {
            console.log('تم تجاهل إنشاء إشعار لمستخدم آخر - قيود RLS');
            return null;
        }

        const fullNotificationData = {
            user_id: notificationData.userId,
            type: notificationData.type || 'system',
            title: notificationData.title,
            message: notificationData.message,
            priority: notificationData.priority || 'normal',
            related_id: notificationData.relatedId || null,
            related_type: notificationData.relatedType || null,
            action_url: notificationData.actionUrl || null,
            action_text: notificationData.actionText || null,
            icon: notificationData.icon || 'fas fa-bell',
            is_read: false
        };

        const { data, error } = await this.supabase
            .from('notifications')
            .insert([fullNotificationData])
            .select()
            .single();

        if (error) throw error;

        // إرسال إشعار متصفح إذا كان المستخدم الحالي هو المستلم
        if (this.currentUser && data.user_id === this.currentUser.id) {
            this.showBrowserNotification(data);
        }

        return data;
    }

    /**
     * إنشاء إشعار مطابقة جديدة
     * @param {Object} matchData - بيانات المطابقة
     * @param {string} recipientType - نوع المستلم (shipper/carrier)
     */
    async createMatchNotification(matchData, recipientType) {
        const { match, isHighScore } = matchData;
        
        let userId, title, message, actionUrl;

        if (recipientType === 'shipper') {
            // إشعار للشاحن عن ناقل جديد متطابق
            userId = match.shipments.shippers.user_id;
            title = isHighScore ? '🎯 مطابقة ممتازة!' : '📦 مطابقة جديدة';
            message = `تم العثور على ناقل متطابق مع شحنتك "${match.shipments.title}" بنسبة ${match.match_score}%`;
            actionUrl = `/shipper-app/matches.html?match_id=${match.id}`;
        } else {
            // إشعار للناقل عن شحنة جديدة متطابقة
            userId = match.trips.carriers.user_id;
            title = isHighScore ? '🎯 مطابقة ممتازة!' : '🚛 شحنة متطابقة';
            message = `تم العثور على شحنة متطابقة مع رحلتك "${match.trips.title}" بنسبة ${match.match_score}%`;
            actionUrl = `/carrier-app/matches.html?match_id=${match.id}`;
        }

        return await this.createNotification({
            userId: userId,
            type: 'match',
            title: title,
            message: message,
            priority: isHighScore ? 'high' : 'normal',
            relatedId: match.id,
            relatedType: 'match',
            actionUrl: actionUrl,
            actionText: 'عرض التفاصيل',
            icon: 'fas fa-bullseye'
        });
    }

    /**
     * إنشاء إشعار طلب تواصل
     * @param {Object} contactData - بيانات طلب التواصل
     */
    async createContactRequestNotification(contactData) {
        const { request, isFromCarrier } = contactData;
        
        let title, message, actionUrl, icon;

        if (isFromCarrier) {
            // ناقل يرسل طلب للشاحن
            title = '🤝 عرض نقل جديد!';
            message = `${request.trips.carriers.users.full_name} يريد نقل شحنتك "${request.shipments.title}"`;
            actionUrl = `/shipper-app/messages.html?contact_id=${request.id}`;
            icon = 'fas fa-truck';
        } else {
            // شاحن يرسل طلب للناقل
            title = '📦 طلب نقل جديد!';
            message = `${request.shipments.shippers.users.full_name} يريد نقل شحنة "${request.shipments.title}"`;
            actionUrl = `/carrier-app/messages.html?contact_id=${request.id}`;
            icon = 'fas fa-handshake';
        }

        const recipientId = isFromCarrier 
            ? request.shipments.shippers.user_id 
            : request.trips.carriers.user_id;

        return await this.createNotification({
            userId: recipientId,
            type: 'contact_request',
            title: title,
            message: message,
            priority: 'high',
            relatedId: request.id,
            relatedType: 'contact_request',
            actionUrl: actionUrl,
            actionText: 'عرض الطلب',
            icon: icon
        });
    }

    /**
     * إنشاء إشعار حالة الشحنة/الرحلة
     * @param {Object} statusData - بيانات تحديث الحالة
     */
    async createStatusUpdateNotification(statusData) {
        const { item, newStatus, itemType, userId } = statusData;
        
        const statusMessages = {
            'pending': 'في الانتظار',
            'active': 'نشط',
            'matched': 'تم الربط',
            'in_transit': 'في الطريق',
            'delivered': 'تم التسليم',
            'completed': 'مكتمل',
            'cancelled': 'ملغي'
        };

        const title = itemType === 'shipment' ? 'تحديث حالة الشحنة' : 'تحديث حالة الرحلة';
        const message = `تم تحديث حالة ${itemType === 'shipment' ? 'الشحنة' : 'الرحلة'} "${item.title}" إلى: ${statusMessages[newStatus] || newStatus}`;
        const actionUrl = itemType === 'shipment' ? '/shipper-app/shipments.html' : '/carrier-app/trips.html';

        return await this.createNotification({
            userId: userId,
            type: itemType,
            title: title,
            message: message,
            priority: ['delivered', 'completed', 'cancelled'].includes(newStatus) ? 'high' : 'normal',
            relatedId: item.id,
            relatedType: itemType,
            actionUrl: actionUrl,
            actionText: 'عرض التفاصيل',
            icon: itemType === 'shipment' ? 'fas fa-box' : 'fas fa-route'
        });
    }

    /**
     * إنشاء إشعار رسالة جديدة
     * @param {Object} messageData - بيانات الرسالة
     */
    async createMessageNotification(messageData) {
        const { message, senderName } = messageData;
        
        return await this.createNotification({
            userId: message.receiver_id,
            type: 'message',
            title: 'رسالة جديدة 📧',
            message: `من: ${senderName}\nالموضوع: ${message.subject}`,
            priority: message.priority || 'normal',
            relatedId: message.id,
            relatedType: 'message',
            actionUrl: `/messages.html?id=${message.id}`,
            actionText: 'قراءة الرسالة',
            icon: 'fas fa-envelope'
        });
    }

    // ============================================
    // إدارة قراءة الإشعارات
    // ============================================

    /**
     * الحصول على الإشعارات للمستخدم الحالي
     * @param {Object} filters - فلاتر البحث
     */
    async getNotifications(filters = {}) {
        if (!this.currentUser) {
            throw new Error('المستخدم غير مسجل الدخول');
        }

        let query = this.supabase
            .from('notifications')
            .select('*')
            .eq('user_id', this.currentUser.id)
            .order('created_at', { ascending: false });

        // تطبيق الفلاتر
        if (filters.type) {
            query = query.eq('type', filters.type);
        }

        if (filters.unreadOnly) {
            query = query.eq('is_read', false);
        }

        if (filters.priority) {
            query = query.eq('priority', filters.priority);
        }

        if (filters.limit) {
            query = query.limit(filters.limit);
        }

        const { data, error } = await query;
        if (error) throw error;

        return data || [];
    }

    /**
     * تحديد الإشعار كمقروء
     * @param {string} notificationId - معرف الإشعار
     */
    async markAsRead(notificationId) {
        const { error } = await this.supabase
            .from('notifications')
            .update({ 
                is_read: true, 
                updated_at: new Date().toISOString() 
            })
            .eq('id', notificationId)
            .eq('user_id', this.currentUser.id);

        if (error) throw error;

        // تحديث العداد في الواجهة
        this.updateNotificationBadge();
    }

    /**
     * تحديد جميع الإشعارات كمقروءة
     */
    async markAllAsRead() {
        const { error } = await this.supabase
            .from('notifications')
            .update({ 
                is_read: true, 
                updated_at: new Date().toISOString() 
            })
            .eq('user_id', this.currentUser.id)
            .eq('is_read', false);

        if (error) throw error;

        // تحديث العداد في الواجهة
        this.updateNotificationBadge();
    }

    /**
     * حذف إشعار
     * @param {string} notificationId - معرف الإشعار
     */
    async deleteNotification(notificationId) {
        const { error } = await this.supabase
            .from('notifications')
            .delete()
            .eq('id', notificationId)
            .eq('user_id', this.currentUser.id);

        if (error) throw error;

        // تحديث العداد في الواجهة
        this.updateNotificationBadge();
    }

    // ============================================
    // الإحصائيات والعدادات
    // ============================================

    /**
     * الحصول على عدد الإشعارات غير المقروءة
     */
    async getUnreadCount() {
        if (!this.currentUser) return 0;

        const { count, error } = await this.supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', this.currentUser.id)
            .eq('is_read', false);

        if (error) {
            console.error('خطأ في الحصول على عدد الإشعارات غير المقروءة:', error);
            return 0;
        }

        return count || 0;
    }

    /**
     * الحصول على إحصائيات الإشعارات
     */
    async getNotificationStatistics() {
        if (!this.currentUser) return null;

        const [totalResult, unreadResult, priorityResult] = await Promise.all([
            this.supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', this.currentUser.id),
            
            this.supabase
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', this.currentUser.id)
                .eq('is_read', false),
            
            this.supabase
                .from('notifications')
                .select('priority')
                .eq('user_id', this.currentUser.id)
                .eq('is_read', false)
        ]);

        const priorityCounts = (priorityResult.data || []).reduce((acc, item) => {
            acc[item.priority] = (acc[item.priority] || 0) + 1;
            return acc;
        }, {});

        return {
            total: totalResult.count || 0,
            unread: unreadResult.count || 0,
            high_priority: priorityCounts.high || 0,
            urgent: priorityCounts.urgent || 0
        };
    }

    // ============================================
    // إشعارات المتصفح
    // ============================================

    /**
     * طلب إذن الإشعارات من المتصفح
     */
    async requestPermission() {
        if ('Notification' in window) {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        }
        return false;
    }

    /**
     * إظهار إشعار في المتصفح
     * @param {Object} notificationData - بيانات الإشعار
     */
    showBrowserNotification(notificationData) {
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(notificationData.title, {
                body: notificationData.message,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                tag: notificationData.id,
                requireInteraction: notificationData.priority === 'high' || notificationData.priority === 'urgent',
                actions: notificationData.action_url ? [{
                    action: 'view',
                    title: notificationData.action_text || 'عرض'
                }] : []
            });

            // التعامل مع النقر على الإشعار
            notification.onclick = () => {
                window.focus();
                if (notificationData.action_url) {
                    window.location.href = notificationData.action_url;
                }
                notification.close();
                this.markAsRead(notificationData.id);
            };

            // إغلاق الإشعار تلقائياً بعد 5 ثواني (إلا إذا كان عالي الأولوية)
            if (notificationData.priority !== 'high' && notificationData.priority !== 'urgent') {
                setTimeout(() => {
                    notification.close();
                }, 5000);
            }
        }
    }

    // ============================================
    // التحديثات المباشرة
    // ============================================

    /**
     * الاشتراك في التحديثات المباشرة
     */
    subscribeToRealTimeUpdates() {
        if (!this.currentUser) return;

        // الاشتراك في الإشعارات الجديدة
        const notificationChannel = this.supabase
            .channel('notifications')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${this.currentUser.id}`
            }, (payload) => {
                console.log('إشعار جديد:', payload.new);
                
                // إظهار إشعار المتصفح
                this.showBrowserNotification(payload.new);
                
                // تحديث العداد
                this.updateNotificationBadge();
                
                // إطلاق حدث مخصص
                window.dispatchEvent(new CustomEvent('newNotification', { 
                    detail: payload.new 
                }));
            })
            .subscribe();

        this.subscriptions.push(notificationChannel);

        // الاشتراك في تحديثات المطابقات
        const matchChannel = this.supabase
            .channel('matches')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'matches'
            }, (payload) => {
                console.log('مطابقة جديدة:', payload.new);
                
                // إطلاق حدث مخصص
                window.dispatchEvent(new CustomEvent('newMatch', { 
                    detail: payload.new 
                }));
            })
            .subscribe();

        this.subscriptions.push(matchChannel);
    }

    /**
     * إلغاء الاشتراك في التحديثات المباشرة
     */
    unsubscribeFromRealTimeUpdates() {
        this.subscriptions.forEach(subscription => {
            this.supabase.removeChannel(subscription);
        });
        this.subscriptions = [];
    }

    // ============================================
    // تحديث واجهة المستخدم
    // ============================================

    /**
     * تحديث عداد الإشعارات في الواجهة
     */
    async updateNotificationBadge() {
        if (!this.currentUser) return;
        
        try {
            const unreadCount = await this.getUnreadCount();
            
            // البحث عن عناصر عداد الإشعارات في الصفحة
            const badges = document.querySelectorAll('.notification-badge, #notificationBadge, [data-notification-count]');
            
            badges.forEach(badge => {
                if (unreadCount > 0) {
                    badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
                    badge.style.display = 'inline-block';
                    badge.classList.add('bg-red-500', 'text-white');
                } else {
                    badge.style.display = 'none';
                }
            });

            // تحديث عنوان الصفحة
            if (unreadCount > 0) {
                document.title = `(${unreadCount}) ${document.title.replace(/^\(\d+\)\s*/, '')}`;
            } else {
                document.title = document.title.replace(/^\(\d+\)\s*/, '');
            }
        } catch (error) {
            console.error('خطأ في تحديث عداد الإشعارات:', error);
        }
    }

    /**
     * إظهار إشعار داخل الصفحة (toast)
     * @param {Object} notificationData - بيانات الإشعار
     */
    showToastNotification(notificationData) {
        // إنشاء عنصر الإشعار
        const toast = document.createElement('div');
        toast.className = `
            fixed top-4 right-4 z-50 max-w-sm w-full bg-white rounded-lg shadow-lg border-l-4 
            ${notificationData.priority === 'high' || notificationData.priority === 'urgent' ? 'border-red-500' : 'border-blue-500'}
            transform translate-x-full transition-transform duration-300 ease-in-out
        `;
        
        toast.innerHTML = `
            <div class="p-4">
                <div class="flex items-start">
                    <div class="flex-shrink-0">
                        <i class="${notificationData.icon} text-lg ${
                            notificationData.priority === 'high' || notificationData.priority === 'urgent' 
                                ? 'text-red-500' : 'text-blue-500'
                        }"></i>
                    </div>
                    <div class="mr-3 flex-1">
                        <p class="text-sm font-medium text-gray-900">${notificationData.title}</p>
                        <p class="text-sm text-gray-500 mt-1">${notificationData.message}</p>
                        ${notificationData.action_url ? `
                            <div class="mt-2">
                                <a href="${notificationData.action_url}" class="text-sm text-blue-600 hover:text-blue-500">
                                    ${notificationData.action_text || 'عرض'}
                                </a>
                            </div>
                        ` : ''}
                    </div>
                    <div class="mr-4 flex-shrink-0 flex">
                        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // إضافة الإشعار للصفحة
        document.body.appendChild(toast);

        // إظهار الإشعار
        setTimeout(() => {
            toast.classList.remove('translate-x-full');
        }, 100);

        // إزالة الإشعار تلقائياً
        setTimeout(() => {
            toast.classList.add('translate-x-full');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, notificationData.priority === 'high' || notificationData.priority === 'urgent' ? 8000 : 5000);
    }
}

// إنشاء instance عام
window.enhancedNotifications = new EnhancedNotificationSystem();

// الاستماع لأحداث الإشعارات الجديدة
window.addEventListener('newNotification', (event) => {
    console.log('إشعار جديد وصل:', event.detail);
    
    // إظهار إشعار toast داخل الصفحة
    window.enhancedNotifications.showToastNotification(event.detail);
});

// الاستماع لأحداث المطابقات الجديدة
window.addEventListener('newMatch', (event) => {
    console.log('مطابقة جديدة:', event.detail);
    
    // يمكن إضافة منطق إضافي هنا
});

// تحديث العدادات عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    if (window.enhancedNotifications.currentUser) {
        window.enhancedNotifications.updateNotificationBadge();
    }
});