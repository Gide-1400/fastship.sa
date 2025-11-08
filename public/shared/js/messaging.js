// ============================================
// FastShip Shared - Messaging System
// نظام الرسائل والتنبيهات المشترك
// ============================================

class MessagingSystem {
    constructor() {
        this.currentUser = null;
    }

    // Initialize messaging system
    init(user) {
        this.currentUser = user;
    }

    // Send message to another user
    async sendMessage(receiverId, content) {
        if (!this.currentUser) {
            throw new Error('User not authenticated');
        }

        const { data, error } = await window.supabaseClient
            .from('messages')
            .insert([{
                sender_id: this.currentUser.id,
                receiver_id: receiverId,
                content: content,
                is_read: false
            }]);

        if (error) throw error;
        return data;
    }

    // Get messages for current user
    async getMessages() {
        if (!this.currentUser) {
            throw new Error('User not authenticated');
        }

        const { data, error } = await window.supabaseClient
            .from('messages')
            .select('*')
            .or(`sender_id.eq.${this.currentUser.id},receiver_id.eq.${this.currentUser.id}`)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    // Mark message as read
    async markMessageAsRead(messageId) {
        const { error } = await window.supabaseClient
            .from('messages')
            .update({ is_read: true })
            .eq('id', messageId);

        if (error) throw error;
    }

    // Get notifications for current user
    async getNotifications() {
        if (!this.currentUser) {
            throw new Error('User not authenticated');
        }

        const { data, error } = await window.supabaseClient
            .from('notifications')
            .select('*')
            .eq('user_id', this.currentUser.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    // Mark notification as read
    async markNotificationAsRead(notificationId) {
        const { error } = await window.supabaseClient
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notificationId);

        if (error) throw error;
    }

    // Create notification
    async createNotification(userId, title, message) {
        const { data, error } = await window.supabaseClient
            .from('notifications')
            .insert([{
                user_id: userId,
                title: title,
                message: message,
                is_read: false
            }]);

        if (error) throw error;
        return data;
    }

    // Get unread counts
    async getUnreadCounts() {
        if (!this.currentUser) {
            return { messages: 0, notifications: 0 };
        }

        const [messagesResult, notificationsResult] = await Promise.all([
            window.supabaseClient
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('receiver_id', this.currentUser.id)
                .eq('is_read', false),
            window.supabaseClient
                .from('notifications')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', this.currentUser.id)
                .eq('is_read', false)
        ]);

        return {
            messages: messagesResult.count || 0,
            notifications: notificationsResult.count || 0
        };
    }
}

// Create global messaging instance
window.messagingSystem = new MessagingSystem();