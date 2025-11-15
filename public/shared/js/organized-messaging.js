// ============================================
// FastShip - نظام الرسائل المرتب المحسّن
// يدعم البريد الوارد والمرسل والمحذوف
// ============================================

class OrganizedMessagingSystem {
  constructor() {
    this.supabase = window.supabaseClient;
    this.currentUser = null;
    this.currentFolder = 'inbox';
    this.folders = {
      'inbox': { name: 'البريد الوارد', icon: 'fas fa-inbox', count: 0 },
      'sent': { name: 'الرسائل المرسلة', icon: 'fas fa-paper-plane', count: 0 },
      'draft': { name: 'المسودات', icon: 'fas fa-edit', count: 0 },
      'trash': { name: 'سلة المحذوفات', icon: 'fas fa-trash', count: 0 },
      'archive': { name: 'الأرشيف', icon: 'fas fa-archive', count: 0 }
    };
  }

  // ============================================
  // التهيئة
  // ============================================

  /**
   * تهيئة نظام الرسائل المرتب
   */
  async init(user) {
    this.currentUser = user;
    await this.updateFolderCounts();
    this.subscribeToRealTimeUpdates();
  }

  // ============================================
  // إدارة المجلدات
  // ============================================

  /**
   * الحصول على رسائل مجلد معين
   */
  async getFolderMessages(folderName = 'inbox', limit = 50, offset = 0) {
    if (!this.currentUser?.id) {
      throw new Error('المستخدم غير مسجل الدخول');
    }

    try {
      // استخدام get_folder_messages الموجودة فعلاً في قاعدة البيانات
      const { data, error } = await this.supabase.rpc('get_folder_messages', {
        user_auth_id: this.currentUser.id,
        folder_name: folderName,
        limit_count: limit,
        offset_count: offset
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('خطأ في الحصول على رسائل المجلد:', error);
      return [];
    }
  }

  /**
   * تحديث عدادات المجلدات
   */
  async updateFolderCounts() {
    if (!this.currentUser?.id) return;

    try {
      // استخدام get_message_statistics الموجودة فعلاً في قاعدة البيانات
      const { data, error } = await this.supabase.rpc('get_message_statistics', {
        user_auth_id: this.currentUser.id
      });

      if (error) throw error;

      if (data) {
        this.folders.inbox.count = data.total_messages || 0;
        this.folders.inbox.unread = data.unread_messages || 0;
        this.folders.sent.count = data.sent_messages || 0;
        this.folders.trash.count = data.trash_messages || 0;
        this.folders.archive.count = data.archived_messages || 0;
        this.folders.draft.count = 0; // لا يوجد في قاعدة البيانات حالياً
      }

      // إطلاق حدث تحديث العدادات
      window.dispatchEvent(new CustomEvent('folderCountsUpdated', {
        detail: this.folders
      }));

    } catch (error) {
      console.error('خطأ في تحديث عدادات المجلدات:', error);
    }
  }

  /**
   * الحصول على عدادات المجلدات
   */
  getFolderCounts() {
    return this.folders;
  }

  // ============================================
  // إرسال الرسائل
  // ============================================

  /**
   * إرسال رسالة جديدة
   */
  async sendMessage(recipientUserId, subject, content, options = {}) {
    if (!this.currentUser?.id) {
      throw new Error('المستخدم غير مسجل الدخول');
    }

    try {
      // إرسال الرسالة مباشرة إلى جدول messages
      const { data, error } = await this.supabase
        .from('messages')
        .insert({
          sender_id: this.currentUser.id,
          receiver_id: recipientUserId,
          subject: subject,
          content: content,
          message_type: options.messageType || 'general',
          shipment_id: options.shipmentId || null,
          trip_id: options.tripId || null,
          match_id: options.matchId || null,
          is_read: false,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // تحديث العدادات
      await this.updateFolderCounts();

      return { success: true, data };
    } catch (error) {
      console.error('خطأ في إرسال الرسالة:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * إرسال رسالة طلب تواصل للمطابقة
   */
  async sendMatchContactMessage(matchData, message, offeredPrice = null) {
    const { match, isCarrier } = matchData;
    
    let receiverId, subject, content;
    let messageType = 'match_request';

    if (isCarrier) {
      // الناقل يرسل للشاحن
      receiverId = match.shipments?.shippers?.user_id;
      subject = `عرض نقل لشحنة: ${match.shipments?.title}`;
      content = `مرحباً،\n\nأنا ناقل لدي رحلة متطابقة مع شحنتك وأود عرض خدمة النقل.\n\n`;
      content += `تفاصيل الرحلة:\n`;
      content += `- من: ${match.trips?.origin}\n`;
      content += `- إلى: ${match.trips?.destination}\n`;
      content += `- تاريخ السفر: ${match.trips?.travel_date}\n`;
      content += `- السعة المتاحة: ${match.trips?.capacity} كيلو\n\n`;
      
      if (offeredPrice) {
        content += `السعر المقترح: ${offeredPrice} ريال\n\n`;
      }
      
      content += `رسالتك:\n${message}\n\n`;
      content += `نقاط التوافق: ${match.match_score}%`;
      messageType = 'match_offer';
    } else {
      // الشاحن يرسل للناقل  
      receiverId = match.trips?.carriers?.user_id;
      subject = `طلب نقل شحنة: ${match.shipments?.title}`;
      content = `مرحباً،\n\nلدي شحنة متطابقة مع رحلتك وأود طلب خدمة النقل.\n\n`;
      content += `تفاصيل الشحنة:\n`;
      content += `- العنوان: ${match.shipments?.title}\n`;
      content += `- الوزن: ${match.shipments?.weight} كيلو\n`;
      content += `- من: ${match.shipments?.pickup_location}\n`;
      content += `- إلى: ${match.shipments?.delivery_location}\n`;
      content += `- التاريخ المطلوب: ${match.shipments?.preferred_date}\n\n`;
      
      if (offeredPrice) {
        content += `السعر المقترح: ${offeredPrice} ريال\n\n`;
      }
      
      content += `رسالتي:\n${message}\n\n`;
      content += `نقاط التوافق: ${match.match_score}%`;
    }

    return await this.sendMessage(receiverId, subject, content, {
      messageType,
      priority: match.match_score >= 80 ? 'high' : 'normal',
      shipmentId: match.shipments?.id,
      tripId: match.trips?.id,
      matchId: match.id
    });
  }

  // ============================================
  // إدارة الرسائل
  // ============================================

  /**
   * تحديد رسالة كمقروءة
   */
  async markAsRead(messageId) {
    if (!this.currentUser?.id) return false;

    try {
      const { error } = await this.supabase
        .from('messages')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', messageId)
        .eq('receiver_id', this.currentUser.id);

      if (error) throw error;

      // تحديث العدادات
      await this.updateFolderCounts();
      
      return true;
    } catch (error) {
      console.error('خطأ في تحديد الرسالة كمقروءة:', error);
      return false;
    }
  }

  /**
   * تحديد جميع الرسائل كمقروءة
   */
  async markAllAsRead(folderName = 'inbox') {
    if (!this.currentUser?.id) return false;

    try {
      let query = this.supabase
        .from('messages')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('receiver_id', this.currentUser.id)
        .eq('is_read', false);

      if (folderName === 'inbox') {
        query = query.eq('receiver_deleted', false);
      }

      const { error } = await query;
      if (error) throw error;

      // تحديث العدادات
      await this.updateFolderCounts();
      
      return true;
    } catch (error) {
      console.error('خطأ في تحديد جميع الرسائل كمقروءة:', error);
      return false;
    }
  }

  /**
   * نقل رسالة إلى سلة المحذوفات
   */
  async moveToTrash(messageId) {
    if (!this.currentUser?.id) return false;

    try {
      const { data, error } = await this.supabase.rpc('move_message_to_trash', {
        message_id: messageId,
        user_auth_id: this.currentUser.id
      });

      if (error) throw error;

      // تحديث العدادات
      await this.updateFolderCounts();
      
      return true;
    } catch (error) {
      console.error('خطأ في نقل الرسالة إلى سلة المحذوفات:', error);
      return false;
    }
  }

  /**
   * استعادة رسالة من سلة المحذوفات
   */
  async restoreFromTrash(messageId) {
    if (!this.currentUser?.auth_user_id) return false;

    try {
      const { data, error } = await this.supabase.rpc('restore_message_from_trash', {
        message_id: messageId,
        user_auth_id: this.currentUser.auth_user_id
      });

      if (error) throw error;

      // تحديث العدادات
      await this.updateFolderCounts();
      
      return true;
    } catch (error) {
      console.error('خطأ في استعادة الرسالة:', error);
      return false;
    }
  }

  /**
   * حذف رسالة نهائياً
   */
  async permanentDelete(messageId) {
    if (!this.currentUser?.auth_user_id) return false;

    try {
      const { data, error } = await this.supabase.rpc('permanent_delete_message', {
        message_id: messageId,
        user_auth_id: this.currentUser.auth_user_id
      });

      if (error) throw error;

      // تحديث العدادات
      await this.updateFolderCounts();
      
      return true;
    } catch (error) {
      console.error('خطأ في الحذف النهائي للرسالة:', error);
      return false;
    }
  }

  // ============================================
  // البحث والفلترة
  // ============================================

  /**
   * البحث في الرسائل
   */
  async searchMessages(query, folderName = 'inbox', filters = {}) {
    if (!this.currentUser?.id) return [];

    try {
      let supabaseQuery = this.supabase
        .from('messages')
        .select(`
          *,
          sender:users!sender_id(id, full_name, email),
          receiver:users!receiver_id(id, full_name, email)
        `);

      // تطبيق فلاتر المجلد
      if (folderName === 'inbox') {
        supabaseQuery = supabaseQuery
          .eq('receiver_id', this.currentUser.id)
          .eq('receiver_deleted', false);
      } else if (folderName === 'sent') {
        supabaseQuery = supabaseQuery
          .eq('sender_id', this.currentUser.id)
          .eq('sender_deleted', false);
      } else if (folderName === 'trash') {
        supabaseQuery = supabaseQuery
          .or(`sender_id.eq.${this.currentUser.id}.and.sender_deleted.eq.true,receiver_id.eq.${this.currentUser.id}.and.receiver_deleted.eq.true`);
      }

      // تطبيق البحث النصي
      if (query.trim()) {
        supabaseQuery = supabaseQuery
          .or(`subject.ilike.%${query}%,content.ilike.%${query}%`);
      }

      // تطبيق فلاتر إضافية
      if (filters.messageType) {
        supabaseQuery = supabaseQuery.eq('message_type', filters.messageType);
      }

      if (filters.isRead !== undefined) {
        supabaseQuery = supabaseQuery.eq('is_read', filters.isRead);
      }

      if (filters.priority) {
        supabaseQuery = supabaseQuery.eq('priority', filters.priority);
      }

      const { data, error } = await supabaseQuery
        .order('created_at', { ascending: false })
        .limit(filters.limit || 50);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('خطأ في البحث في الرسائل:', error);
      return [];
    }
  }

  // ============================================
  // التحديثات المباشرة
  // ============================================

  /**
   * الاشتراك في التحديثات المباشرة
   */
  subscribeToRealTimeUpdates() {
    if (!this.currentUser?.id) return;

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
        
        // تحديث العدادات
        this.updateFolderCounts();
        
        // إطلاق حدث مخصص
        window.dispatchEvent(new CustomEvent('newMessage', { 
          detail: payload.new 
        }));
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${this.currentUser.id}`
      }, (payload) => {
        console.log('تحديث رسالة:', payload.new);
        
        // تحديث العدادات
        this.updateFolderCounts();
        
        // إطلاق حدث مخصص
        window.dispatchEvent(new CustomEvent('messageUpdated', { 
          detail: payload.new 
        }));
      })
      .subscribe();
  }

  // ============================================
  // الدوال المساعدة
  // ============================================

  /**
   * تنسيق نوع الرسالة للعرض
   */
  formatMessageType(messageType) {
    const types = {
      'general': 'رسالة عامة',
      'match_request': 'طلب مطابقة',
      'match_offer': 'عرض مطابقة',
      'match_response': 'رد على مطابقة',
      'price_negotiation': 'تفاوض سعر',
      'shipment_update': 'تحديث شحنة',
      'system_notification': 'إشعار نظام'
    };
    
    return types[messageType] || 'رسالة عامة';
  }

  /**
   * تنسيق أولوية الرسالة للعرض
   */
  formatPriority(priority) {
    const priorities = {
      'low': { text: 'منخفضة', color: '#6B7280', icon: 'fas fa-arrow-down' },
      'normal': { text: 'عادية', color: '#3B82F6', icon: 'fas fa-minus' },
      'high': { text: 'عالية', color: '#F59E0B', icon: 'fas fa-arrow-up' },
      'urgent': { text: 'عاجلة', color: '#EF4444', icon: 'fas fa-exclamation' }
    };
    
    return priorities[priority] || priorities['normal'];
  }

  /**
   * تنسيق التاريخ للعرض
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      return 'اليوم';
    } else if (diffDays === 2) {
      return 'أمس';
    } else if (diffDays <= 7) {
      return `منذ ${diffDays - 1} أيام`;
    } else {
      return date.toLocaleDateString('ar-SA');
    }
  }
}

// إنشاء instance عام
window.organizedMessaging = new OrganizedMessagingSystem();

// تصدير للاستخدام
if (typeof module !== 'undefined' && module.exports) {
  module.exports = OrganizedMessagingSystem;
}