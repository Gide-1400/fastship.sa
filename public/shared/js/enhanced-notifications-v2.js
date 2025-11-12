// ============================================
// FastShip - نظام الإشعارات المحسّن والمتقدم
// يضمن وصول الإشعارات لكلا القسمين مع قوالب
// ============================================

class EnhancedNotificationSystemV2 {
  constructor() {
    this.supabase = window.supabaseClient;
    this.currentUser = null;
    this.notificationPermission = 'default';
    this.soundEnabled = true;
    this.templates = new Map();
  }

  // ============================================
  // التهيئة
  // ============================================

  /**
   * تهيئة نظام الإشعارات المحسّن
   */
  async init(user) {
    this.currentUser = user;
    
    // طلب إذن الإشعارات
    await this.requestNotificationPermission();
    
    // تحميل قوالب الإشعارات
    await this.loadNotificationTemplates();
    
    // الاشتراك في التحديثات المباشرة
    this.subscribeToRealTimeUpdates();
  }

  /**
   * طلب إذن الإشعارات من المتصفح
   */
  async requestNotificationPermission() {
    if ('Notification' in window) {
      this.notificationPermission = await Notification.requestPermission();
      console.log('إذن الإشعارات:', this.notificationPermission);
    }
  }

  /**
   * تحميل قوالب الإشعارات من قاعدة البيانات
   */
  async loadNotificationTemplates() {
    try {
      const { data, error } = await this.supabase
        .from('notification_templates')
        .select('*');

      if (error) throw error;

      // تخزين القوالب في الذاكرة
      data.forEach(template => {
        this.templates.set(template.template_code, template);
      });

      console.log(`تم تحميل ${data.length} قالب إشعار`);
    } catch (error) {
      console.error('خطأ في تحميل قوالب الإشعارات:', error);
    }
  }

  // ============================================
  // إنشاء الإشعارات
  // ============================================

  /**
   * إنشاء إشعار من قالب (محدث للنظام الجديد)
   */
  async createNotificationFromTemplate(templateName, recipientUserId, templateData = {}) {
    try {
      const { data, error } = await this.supabase.rpc('send_templated_notification', {
        p_template_name: templateName,
        p_recipient_user_id: recipientUserId,
        p_template_data: templateData
      });

      if (error) throw error;
      return { success: true, notificationId: data };
    } catch (error) {
      console.error('خطأ في إنشاء الإشعار من القالب:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * إنشاء إشعار مطابقة جديدة للشاحن
   */
  async createShipperMatchNotification(shipmentId, matchesCount = 1) {
    try {
      // الحصول على بيانات الشحنة
      const { data: shipment, error } = await this.supabase
        .from('shipments')
        .select(`
          *,
          shippers (
            user_id,
            users (id, full_name)
          )
        `)
        .eq('id', shipmentId)
        .single();

      if (error) throw error;

      const variables = {
        matches_count: matchesCount.toString(),
        shipment_title: shipment.title,
        action_url: `/shipper-app/matches.html?shipment_id=${shipmentId}`,
        action_text: 'عرض المطابقات'
      };

      // اختيار القالب حسب عدد المطابقات
      const templateCode = matchesCount >= 3 ? 'HIGH_SCORE_MATCH' : 'NEW_MATCH_SHIPPER';
      if (templateCode === 'HIGH_SCORE_MATCH') {
        variables.match_score = '85'; // نقاط افتراضية عالية
      }

      const result = await this.createNotificationFromTemplate(
        templateCode,
        shipment.shippers.user_id,
        variables
      );

      if (result.success) {
        // إرسال إشعار متصفح أيضاً
        await this.sendBrowserNotification({
          title: matchesCount >= 3 ? '🎯 مطابقة ممتازة!' : '📦 مطابقات جديدة',
          message: `تم العثور على ${matchesCount} ناقل متطابق مع شحنتك`,
          icon: 'fas fa-bullseye',
          url: `/shipper-app/matches.html?shipment_id=${shipmentId}`
        });
      }

      return result;
    } catch (error) {
      console.error('خطأ في إنشاء إشعار المطابقة للشاحن:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * إنشاء إشعار مطابقة جديدة للناقل
   */
  async createCarrierMatchNotification(tripId, shipmentId) {
    try {
      // الحصول على بيانات الرحلة والشحنة
      const [tripResult, shipmentResult] = await Promise.all([
        this.supabase
          .from('trips')
          .select(`
            *,
            carriers (
              user_id,
              users (id, full_name)
            )
          `)
          .eq('id', tripId)
          .single(),
        this.supabase
          .from('shipments')
          .select('*')
          .eq('id', shipmentId)
          .single()
      ]);

      if (tripResult.error || shipmentResult.error) {
        throw tripResult.error || shipmentResult.error;
      }

      const trip = tripResult.data;
      const shipment = shipmentResult.data;

      const variables = {
        shipment_title: shipment.title,
        destination: trip.destination,
        action_url: `/carrier-app/matches.html?trip_id=${tripId}`,
        action_text: 'عرض الشحنات المتطابقة'
      };

      const result = await this.createNotificationFromTemplate(
        'NEW_MATCH_CARRIER',
        trip.carriers.user_id,
        variables
      );

      if (result.success) {
        // إرسال إشعار متصفح أيضاً
        await this.sendBrowserNotification({
          title: '🚛 شحنة متطابقة جديدة!',
          message: `شحنة "${shipment.title}" متطابقة مع رحلتك إلى ${trip.destination}`,
          icon: 'fas fa-shipping-fast',
          url: `/carrier-app/matches.html?trip_id=${tripId}`
        });
      }

      return result;
    } catch (error) {
      console.error('خطأ في إنشاء إشعار المطابقة للناقل:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * إرسال إشعار عابر للأقسام (من شاحن لناقل أو العكس)
   */
  async sendCrossSectionNotification(notificationType, recipientUserId, data = {}) {
    try {
      // تحديد اسم القالب المناسب
      let templateName = notificationType;
      
      switch (notificationType) {
        case 'new_match':
          templateName = 'new_match_found';
          break;
        case 'match_for_carrier':
          templateName = 'shipment_match_available';
          break;
        case 'message_from_shipper':
          templateName = 'message_from_shipper';
          break;
        case 'message_from_carrier':
          templateName = 'message_from_carrier';
          break;
        case 'booking_request':
          templateName = 'booking_request_received';
          break;
      }

      const result = await this.createNotificationFromTemplate(
        templateName,
        recipientUserId,
        data
      );

      console.log(`✓ تم إرسال إشعار عابر للأقسام: ${notificationType}`);
      return result;

    } catch (error) {
      console.error('خطأ في إرسال الإشعار العابر للأقسام:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * إنشاء إشعار رسالة جديدة
   */
  async createMessageNotification(messageId) {
    try {
      const { data, error } = await this.supabase.rpc('send_message_notification', {
        message_id: messageId
      });

      if (error) throw error;

      // الحصول على تفاصيل الرسالة للإشعار المتصفح
      const { data: message } = await this.supabase
        .from('messages')
        .select(`
          *,
          sender:users!sender_id(full_name),
          receiver:users!receiver_id(full_name)
        `)
        .eq('id', messageId)
        .single();

      if (message) {
        // إرسال إشعار متصفح
        await this.sendBrowserNotification({
          title: `رسالة جديدة من ${message.sender.full_name}`,
          message: message.subject,
          icon: 'fas fa-envelope',
          url: `/messages.html?message_id=${messageId}`
        });
      }

      return { success: true };
    } catch (error) {
      console.error('خطأ في إنشاء إشعار الرسالة:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * إنشاء إشعار طلب تواصل
   */
  async createContactRequestNotification(contactRequestId) {
    try {
      const { data, error } = await this.supabase.rpc('send_contact_request_notification', {
        contact_request_id: contactRequestId
      });

      if (error) throw error;

      // الحصول على تفاصيل طلب التواصل
      const { data: request } = await this.supabase
        .from('contact_requests')
        .select(`
          *,
          shippers (
            users (full_name)
          ),
          carriers (
            users (full_name)
          ),
          shipments (title)
        `)
        .eq('id', contactRequestId)
        .single();

      if (request) {
        // إرسال إشعار متصفح للناقل
        await this.sendBrowserNotification({
          title: `طلب تواصل جديد من ${request.shippers.users.full_name}`,
          message: `بخصوص شحنة: ${request.shipments.title}`,
          icon: 'fas fa-handshake',
          url: `/carrier-app/messages.html?contact_request_id=${contactRequestId}`
        });
      }

      return { success: true };
    } catch (error) {
      console.error('خطأ في إنشاء إشعار طلب التواصل:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // إشعارات المتصفح
  // ============================================

  /**
   * إرسال إشعار متصفح
   */
  async sendBrowserNotification(notificationData) {
    if (this.notificationPermission !== 'granted') return;

    try {
      const notification = new Notification(notificationData.title, {
        body: notificationData.message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'fastship-notification',
        requireInteraction: false,
        silent: !this.soundEnabled
      });

      // إضافة حدث النقر
      notification.onclick = () => {
        window.focus();
        if (notificationData.url) {
          window.location.href = notificationData.url;
        }
        notification.close();
      };

      // إغلاق تلقائي بعد 5 ثوان
      setTimeout(() => notification.close(), 5000);

      // تشغيل الصوت
      if (this.soundEnabled) {
        this.playNotificationSound();
      }

    } catch (error) {
      console.error('خطأ في إرسال إشعار المتصفح:', error);
    }
  }

  /**
   * تشغيل صوت الإشعار
   */
  playNotificationSound() {
    try {
      // إنشاء صوت إشعار بسيط باستخدام Web Audio API
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.log('لا يمكن تشغيل صوت الإشعار:', error);
    }
  }

  // ============================================
  // إدارة الإشعارات
  // ============================================

  /**
   * الحصول على الإشعارات للمستخدم الحالي
   */
  async getNotifications(filters = {}) {
    if (!this.currentUser?.id) return [];

    try {
      let query = this.supabase
        .from('notifications')
        .select(`
          *,
          sender:users!sender_id(id, full_name)
        `)
        .eq('user_id', this.currentUser.id);

      // تطبيق الفلاتر
      if (filters.isRead !== undefined) {
        query = query.eq('is_read', filters.isRead);
      }

      if (filters.type) {
        query = query.eq('type', filters.type);
      }

      if (filters.category) {
        query = query.eq('notification_category', filters.category);
      }

      if (filters.priority) {
        query = query.eq('priority', filters.priority);
      }

      // استبعاد المنتهية الصلاحية
      if (filters.excludeExpired !== false) {
        query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(filters.limit || 50);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('خطأ في الحصول على الإشعارات:', error);
      return [];
    }
  }

  /**
   * تحديد إشعار كمقروء
   */
  async markAsRead(notificationId) {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({ 
          is_read: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('user_id', this.currentUser.id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('خطأ في تحديد الإشعار كمقروء:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * تحديد جميع الإشعارات كمقروءة
   */
  async markAllAsRead() {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({ 
          is_read: true,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', this.currentUser.id)
        .eq('is_read', false);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('خطأ في تحديد جميع الإشعارات كمقروءة:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * حذف إشعار
   */
  async deleteNotification(notificationId) {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', this.currentUser.id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('خطأ في حذف الإشعار:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * الحصول على عدد الإشعارات غير المقروءة
   */
  async getUnreadCount() {
    if (!this.currentUser?.id) return 0;

    try {
      const { count, error } = await this.supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', this.currentUser.id)
        .eq('is_read', false)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('خطأ في الحصول على عدد الإشعارات غير المقروءة:', error);
      return 0;
    }
  }

  // ============================================
  // التحديثات المباشرة
  // ============================================

  /**
   * الاشتراك في التحديثات المباشرة للإشعارات
   */
  subscribeToRealTimeUpdates() {
    if (!this.currentUser?.id) return;

    this.supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${this.currentUser.id}`
      }, (payload) => {
        console.log('إشعار جديد:', payload.new);
        
        // إرسال إشعار متصفح
        this.sendBrowserNotification({
          title: payload.new.title,
          message: payload.new.message,
          icon: payload.new.icon || 'fas fa-info-circle',
          url: payload.new.action_url
        });
        
        // إطلاق حدث مخصص
        window.dispatchEvent(new CustomEvent('newNotification', { 
          detail: payload.new 
        }));
      })
      .subscribe();
  }

  // ============================================
  // الإعدادات
  // ============================================

  /**
   * تفعيل/إلغاء تفعيل الصوت
   */
  toggleSound(enabled = null) {
    this.soundEnabled = enabled !== null ? enabled : !this.soundEnabled;
    localStorage.setItem('fastship-sound-enabled', this.soundEnabled.toString());
    return this.soundEnabled;
  }

  /**
   * الحصول على حالة الصوت
   */
  isSoundEnabled() {
    const saved = localStorage.getItem('fastship-sound-enabled');
    if (saved !== null) {
      this.soundEnabled = saved === 'true';
    }
    return this.soundEnabled;
  }
}

// إنشاء instance عام
window.enhancedNotificationsV2 = new EnhancedNotificationSystemV2();

// تصدير للاستخدام
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnhancedNotificationSystemV2;
}