// ============================================
// FastShip Enhanced Messaging System v2.0
// نظام الرسائل المحسّن مع دعم المطابقات وطلبات التواصل
// ============================================

class EnhancedMessagingSystem {
    constructor() {
        this.supabase = window.supabaseClient;
        this.currentUser = null;
    }

    // تهيئة النظام
    async init(user) {
        this.currentUser = user;
        
        // الاشتراك في التحديثات المباشرة
        this.subscribeToRealTimeUpdates();
    }

    // ============================================
    // إرسال الرسائل
    // ============================================

    /**
     * إرسال رسالة عادية
     * @param {string} receiverId - معرف المستلم
     * @param {string} subject - موضوع الرسالة
     * @param {string} content - محتوى الرسالة
     * @param {Object} options - خيارات إضافية
     */
    async sendMessage(receiverId, subject, content, options = {}) {
        if (!this.currentUser) {
            throw new Error('المستخدم غير مسجل الدخول');
        }

        const messageData = {
            sender_id: this.currentUser.id,
            receiver_id: receiverId,
            subject: subject,
            content: content,
            message_type: options.type || 'general',
            priority: options.priority || 'normal',
            related_shipment_id: options.shipmentId || null,
            related_trip_id: options.tripId || null,
            is_read: false
        };

        const { data, error } = await this.supabase
            .from('messages')
            .insert([messageData])
            .select()
            .single();

        if (error) throw error;

        // إنشاء إشعار للمستلم
        await this.createNotificationForMessage(data);

        return data;
    }

    /**
     * إرسال رسالة طلب تواصل للمطابقة
     * @param {Object} matchData - بيانات المطابقة
     * @param {string} message - رسالة التواصل
     * @param {number} offeredPrice - السعر المقترح (اختياري)
     */
    async sendMatchContactRequest(matchData, message, offeredPrice = null) {
        const { match, isCarrier } = matchData;
        
        // تحديد المرسل والمستقبل
        const senderId = this.currentUser.id;
        let receiverId, subject, content;

        if (isCarrier) {
            // الناقل يرسل للشاحن
            receiverId = match.shipments.shippers.user_id;
            subject = `عرض نقل لشحنة: ${match.shipments.title}`;
            content = `مرحباً،\n\nأنا ناقل لدي رحلة متطابقة مع شحنتك وأود عرض خدمة النقل.\n\n`;
            content += `تفاصيل الرحلة:\n`;
            content += `- المسار: ${match.trips.origin} → ${match.trips.destination}\n`;
            content += `- التاريخ: ${new Date(match.trips.travel_date).toLocaleDateString('ar-SA')}\n`;
            content += `- السعة المتاحة: ${match.trips.capacity} كجم\n`;
            
            if (offeredPrice) {
                content += `- السعر المقترح: ${offeredPrice} ريال/كجم\n`;
            }
            
            content += `\nرسالتي لك:\n${message}\n\n`;
            content += `نقاط التوافق: ${match.match_score}%`;
        } else {
            // الشاحن يرسل للناقل
            receiverId = match.trips.carriers.user_id;
            subject = `طلب نقل شحنة: ${match.shipments.title}`;
            content = `مرحباً،\n\nأنا بحاجة لنقل شحنة وأرى أن رحلتك متطابقة معها.\n\n`;
            content += `تفاصيل الشحنة:\n`;
            content += `- النوع: ${match.shipments.title}\n`;
            content += `- المسار: ${match.shipments.pickup_location} → ${match.shipments.delivery_location}\n`;
            content += `- الوزن: ${match.shipments.weight} كجم\n`;
            content += `- التاريخ المفضل: ${new Date(match.shipments.preferred_date).toLocaleDateString('ar-SA')}\n`;
            
            content += `\nرسالتي لك:\n${message}\n\n`;
            content += `نقاط التوافق: ${match.match_score}%`;
        }

        // إرسال الرسالة
        const messageData = await this.sendMessage(receiverId, subject, content, {
            type: 'contact_request',
            priority: match.match_score >= 80 ? 'high' : 'normal',
            shipmentId: match.shipment_id,
            tripId: match.trip_id
        });

        // إنشاء طلب تواصل في جدول contact_requests
        await this.createContactRequest({
            senderId,
            receiverId,
            matchId: match.id,
            shipmentId: match.shipment_id,
            tripId: match.trip_id,
            message,
            offeredPrice,
            isCarrier
        });

        // تحديث حالة المطابقة
        await this.updateMatchStatus(match.id, 'contacted');

        return messageData;
    }

    /**
     * إرسال رد على رسالة
     * @param {string} originalMessageId - معرف الرسالة الأصلية
     * @param {string} content - محتوى الرد
     */
    async sendReply(originalMessageId, content) {
        // الحصول على الرسالة الأصلية
        const { data: originalMessage, error } = await this.supabase
            .from('messages')
            .select('*')
            .eq('id', originalMessageId)
            .single();

        if (error) throw error;

        // تحديد المستقبل (إذا كنت المرسل الأصلي، فالمستقبل هو المستلم الأصلي والعكس)
        const receiverId = originalMessage.sender_id === this.currentUser.id 
            ? originalMessage.receiver_id 
            : originalMessage.sender_id;

        const subject = originalMessage.subject.startsWith('Re: ') 
            ? originalMessage.subject 
            : `Re: ${originalMessage.subject}`;

        const replyContent = `${content}\n\n--- رد على رسالة ---\nالرسالة الأصلية: ${originalMessage.content}`;

        return await this.sendMessage(receiverId, subject, replyContent, {
            type: originalMessage.message_type,
            priority: originalMessage.priority,
            shipmentId: originalMessage.related_shipment_id,
            tripId: originalMessage.related_trip_id
        });
    }

    // ============================================
    // إدارة طلبات التواصل
    // ============================================

    /**
     * إنشاء طلب تواصل
     */
    async createContactRequest(requestData) {
        const { senderId, receiverId, matchId, shipmentId, tripId, message, offeredPrice, isCarrier } = requestData;

        const contactRequestData = {
            match_id: matchId,
            shipment_id: shipmentId,
            trip_id: tripId,
            message: message,
            status: 'pending'
        };

        if (isCarrier) {
            // الناقل يرسل للشاحن
            const { data: carrier } = await this.supabase
                .from('carriers')
                .select('id')
                .eq('user_id', senderId)
                .single();

            const { data: shipper } = await this.supabase
                .from('shippers')
                .select('id')
                .eq('user_id', receiverId)
                .single();

            contactRequestData.carrier_id = carrier.id;
            contactRequestData.shipper_id = shipper.id;
            contactRequestData.offered_price = offeredPrice;
        } else {
            // الشاحن يرسل للناقل
            const { data: shipper } = await this.supabase
                .from('shippers')
                .select('id')
                .eq('user_id', senderId)
                .single();

            const { data: carrier } = await this.supabase
                .from('carriers')
                .select('id')
                .eq('user_id', receiverId)
                .single();

            contactRequestData.shipper_id = shipper.id;
            contactRequestData.carrier_id = carrier.id;
        }

        const { data, error } = await this.supabase
            .from('contact_requests')
            .insert([contactRequestData])
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * الرد على طلب تواصل
     * @param {string} contactRequestId - معرف طلب التواصل
     * @param {string} status - حالة الرد (accepted/rejected)
     * @param {string} responseMessage - رسالة الرد
     */
    async respondToContactRequest(contactRequestId, status, responseMessage) {
        // تحديث حالة طلب التواصل
        const { data: updatedRequest, error } = await this.supabase
            .from('contact_requests')
            .update({
                status: status,
                response_message: responseMessage,
                responded_at: new Date().toISOString()
            })
            .eq('id', contactRequestId)
            .select(`
                *,
                matches (*),
                shipments (*, shippers (*, users (*))),
                trips (*, carriers (*, users (*)))
            `)
            .single();

        if (error) throw error;

        // إرسال رسالة رد
        const originalSenderId = status === 'accepted' 
            ? (updatedRequest.carrier_id ? updatedRequest.trips.carriers.user_id : updatedRequest.shipments.shippers.user_id)
            : (updatedRequest.shipper_id ? updatedRequest.shipments.shippers.user_id : updatedRequest.trips.carriers.user_id);

        const subject = status === 'accepted' 
            ? `تم قبول طلب النقل ✅`
            : `تم رفض طلب النقل ❌`;

        const content = `${responseMessage}\n\nحالة الطلب: ${status === 'accepted' ? 'مقبول' : 'مرفوض'}`;

        await this.sendMessage(originalSenderId, subject, content, {
            type: 'contact_response',
            priority: 'high',
            shipmentId: updatedRequest.shipment_id,
            tripId: updatedRequest.trip_id
        });

        // تحديث حالة المطابقة
        if (status === 'accepted') {
            await this.updateMatchStatus(updatedRequest.match_id, 'accepted');
        }

        return updatedRequest;
    }

    // ============================================
    // إدارة الرسائل
    // ============================================

    /**
     * الحصول على الرسائل للمستخدم الحالي
     * @param {Object} filters - فلاتر البحث
     */
    async getMessages(filters = {}) {
        if (!this.currentUser) {
            throw new Error('المستخدم غير مسجل الدخول');
        }

        let query = this.supabase
            .from('messages')
            .select(`
                *,
                sender:users!sender_id(id, full_name, email),
                receiver:users!receiver_id(id, full_name, email),
                related_shipment:shipments(*),
                related_trip:trips(*)
            `)
            .or(`sender_id.eq.${this.currentUser.id},receiver_id.eq.${this.currentUser.id}`)
            .order('created_at', { ascending: false });

        // تطبيق الفلاتر
        if (filters.type) {
            query = query.eq('message_type', filters.type);
        }

        if (filters.unreadOnly) {
            query = query.eq('is_read', false).eq('receiver_id', this.currentUser.id);
        }

        if (filters.relatedToMatch) {
            query = query.or('related_shipment_id.not.is.null,related_trip_id.not.is.null');
        }

        const { data, error } = await query;
        if (error) throw error;

        return data || [];
    }

    /**
     * الحصول على طلبات التواصل
     * @param {string} status - حالة الطلبات (pending/accepted/rejected)
     */
    async getContactRequests(status = null) {
        if (!this.currentUser) {
            throw new Error('المستخدم غير مسجل الدخول');
        }

        let query = this.supabase
            .from('contact_requests')
            .select(`
                *,
                matches (*),
                shipments (*, shippers (*, users (*))),
                trips (*, carriers (*, users (*)))
            `)
            .or(`
                shipper_id.in.(select id from shippers where user_id = ${this.currentUser.id}),
                carrier_id.in.(select id from carriers where user_id = ${this.currentUser.id})
            `)
            .order('created_at', { ascending: false });

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) throw error;

        return data || [];
    }

    /**
     * تحديد الرسالة كمقروءة
     * @param {string} messageId - معرف الرسالة
     */
    async markAsRead(messageId) {
        const { error } = await this.supabase
            .from('messages')
            .update({ is_read: true, updated_at: new Date().toISOString() })
            .eq('id', messageId)
            .eq('receiver_id', this.currentUser.id);

        if (error) throw error;
    }

    /**
     * تحديد جميع الرسائل كمقروءة
     */
    async markAllAsRead() {
        const { error } = await this.supabase
            .from('messages')
            .update({ is_read: true, updated_at: new Date().toISOString() })
            .eq('receiver_id', this.currentUser.id)
            .eq('is_read', false);

        if (error) throw error;
    }

    /**
     * حذف رسالة
     * @param {string} messageId - معرف الرسالة
     */
    async deleteMessage(messageId) {
        const { error } = await this.supabase
            .from('messages')
            .delete()
            .eq('id', messageId)
            .eq('sender_id', this.currentUser.id);

        if (error) throw error;
    }

    // ============================================
    // الإحصائيات والعدادات
    // ============================================

    /**
     * الحصول على عدد الرسائل غير المقروءة
     */
    async getUnreadCount() {
        if (!this.currentUser) return 0;

        const { count, error } = await this.supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('receiver_id', this.currentUser.id)
            .eq('is_read', false);

        if (error) {
            console.error('خطأ في الحصول على عدد الرسائل غير المقروءة:', error);
            return 0;
        }

        return count || 0;
    }

    /**
     * الحصول على إحصائيات الرسائل
     */
    async getMessageStatistics() {
        if (!this.currentUser) return null;

        const [totalResult, unreadResult, sentResult, receivedResult] = await Promise.all([
            this.supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .or(`sender_id.eq.${this.currentUser.id},receiver_id.eq.${this.currentUser.id}`),
            
            this.supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('receiver_id', this.currentUser.id)
                .eq('is_read', false),
            
            this.supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('sender_id', this.currentUser.id),
            
            this.supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('receiver_id', this.currentUser.id)
        ]);

        return {
            total: totalResult.count || 0,
            unread: unreadResult.count || 0,
            sent: sentResult.count || 0,
            received: receivedResult.count || 0
        };
    }

    // ============================================
    // الدوال المساعدة
    // ============================================

    /**
     * إنشاء إشعار للرسالة
     */
    async createNotificationForMessage(messageData) {
        // تم إلغاء إنشاء الإشعارات للرسائل لأن النظام يعمل في الوقت الفعلي
        // والإشعارات تسبب مشاكل في سياسات RLS
        console.log('تم تجاهل إنشاء إشعار للرسالة - النظام يعمل في الوقت الفعلي');
        return;
    }

    /**
     * تحديث حالة المطابقة
     */
    async updateMatchStatus(matchId, status) {
        const { error } = await this.supabase
            .from('matches')
            .update({ 
                status: status,
                updated_at: new Date().toISOString()
            })
            .eq('id', matchId);

        if (error) {
            console.error('خطأ في تحديث حالة المطابقة:', error);
        }
    }

    /**
     * الاشتراك في التحديثات المباشرة
     */
    subscribeToRealTimeUpdates() {
        if (!this.currentUser) return;

        // الاشتراك في الرسائل الجديدة
        this.supabase
            .channel('messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `receiver_id=eq.${this.currentUser.id}`
            }, (payload) => {
                console.log('رسالة جديدة:', payload.new);
                // إطلاق حدث مخصص للتطبيق
                window.dispatchEvent(new CustomEvent('newMessage', { 
                    detail: payload.new 
                }));
            })
            .subscribe();

        // الاشتراك في طلبات التواصل الجديدة
        this.supabase
            .channel('contact_requests')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'contact_requests'
            }, (payload) => {
                console.log('تحديث في طلبات التواصل:', payload);
                // إطلاق حدث مخصص للتطبيق
                window.dispatchEvent(new CustomEvent('contactRequestUpdate', { 
                    detail: payload 
                }));
            })
            .subscribe();
    }

    /**
     * إلغاء الاشتراك في التحديثات المباشرة
     */
    unsubscribeFromRealTimeUpdates() {
        this.supabase.removeAllChannels();
    }
}

// إنشاء instance عام
window.enhancedMessaging = new EnhancedMessagingSystem();

// الاستماع لأحداث الرسائل الجديدة
window.addEventListener('newMessage', (event) => {
    // تحديث عداد الرسائل في الواجهة
    updateMessageBadge();
    
    // إظهار إشعار في المتصفح (إذا كان مسموح)
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('رسالة جديدة', {
            body: event.detail.subject,
            icon: '/favicon.ico'
        });
    }
});

// دالة لطلب إذن الإشعارات
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// دالة لتحديث عداد الرسائل في الواجهة
async function updateMessageBadge() {
    if (!window.enhancedMessaging.currentUser) return;
    
    try {
        const unreadCount = await window.enhancedMessaging.getUnreadCount();
        
        // البحث عن عناصر عداد الرسائل في الصفحة
        const badges = document.querySelectorAll('.message-badge, #messageBadge, [data-message-count]');
        
        badges.forEach(badge => {
            if (unreadCount > 0) {
                badge.textContent = unreadCount;
                badge.style.display = 'inline-block';
                badge.classList.add('bg-red-500', 'text-white');
            } else {
                badge.style.display = 'none';
            }
        });
    } catch (error) {
        console.error('خطأ في تحديث عداد الرسائل:', error);
    }
}