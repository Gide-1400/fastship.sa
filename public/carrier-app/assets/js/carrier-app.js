// وظائف قسم الشاحن فقط

// إضافة شحنة جديدة
async function addTrip(event) {
  event.preventDefault();
  const form = event.target;
  const data = {
    title: form.title.value,
    description: form.description.value,
    weight: form.weight.value,
    from_location: form.from_location.value,
    to_location: form.to_location.value
  };
  // حفظ الشحنة في Supabase
  const { error } = await window.supabaseClient
    .from('trips')
    .insert([{ ...data }]);
  if (error) {
    alert('حدث خطأ أثناء إضافة الشحنة: ' + error.message);
  } else {
    alert('تمت إضافة الشحنة بنجاح!');
    window.location.href = 'trips.html';
  }
}

// تحميل الشحنات الخاصة بالمستخدم
async function loadMyTrips() {
  const user = window.sessionManager.currentUser;
  if (!user) return;
  const { data, error } = await window.supabaseClient
    .from('trips')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) {
    alert('خطأ في تحميل الشحنات: ' + error.message);
    return;
  }
  const table = document.getElementById('tripsTable');
  if (!table) return;
  table.innerHTML = data.map(s => `<tr><td>${s.title}</td><td>${s.weight}</td><td>${s.from_location}</td><td>${s.to_location}</td></tr>`).join('');
}

// متغيرات الدردشة
let currentChatId = null;
let currentRecipientId = null;
let currentRecipientName = '';

// فتح دردشة جديدة
async function startNewChat(tripId, recipientId, recipientName) {
  currentChatId = tripId;
  currentRecipientId = recipientId;
  currentRecipientName = recipientName;
  
  // عرض نافذة الدردشة
  document.getElementById('chatModal').classList.remove('hidden');
  document.getElementById('chatRecipientName').textContent = recipientName;
  
  // جلب سجل المحادثة
  await loadChatMessages();
  
  // التركيز على حقل الإدخال
  document.getElementById('chatMessageInput').focus();
}

// إغلاق الدردشة
function closeChat() {
  document.getElementById('chatModal').classList.add('hidden');
}

// إرسال رسالة
async function sendChatMessage() {
  const messageInput = document.getElementById('chatMessageInput');
  const message = messageInput.value.trim();
  
  if (message === '') return;
  
  try {
    // إرسال الرسالة إلى قاعدة البيانات
    const { error } = await window.supabaseClient
      .from('messages')
      .insert({
        trip_id: currentChatId,
        sender_id: window.sessionManager.currentUser.id,
        receiver_id: currentRecipientId,
        message: message,
        is_read: false
      });
    
    if (error) throw error;
    
    // إضافة الرسالة إلى الواجهة
    addMessageToChat(message, true);
    
    // مسح حقل الإدخال
    messageInput.value = '';
    
  } catch (error) {
    console.error('Error sending message:', error);
    alert('حدث خطأ أثناء إرسال الرسالة');
  }
}

// جلب الرسائل
async function loadChatMessages() {
  const chatContainer = document.getElementById('chatMessages');
  chatContainer.innerHTML = '<div class="text-center py-4 text-gray-500">جاري تحميل المحادثة...</div>';
  
  try {
    const { data: messages, error } = await window.supabaseClient
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${window.sessionManager.currentUser.id},receiver_id.eq.${window.sessionManager.currentUser.id}`)
      .eq('trip_id', currentChatId)
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    chatContainer.innerHTML = '';
    
    if (messages && messages.length > 0) {
      messages.forEach(msg => {
        const isSender = msg.sender_id === window.sessionManager.currentUser.id;
        addMessageToChat(msg.message, isSender, msg.created_at);
      });
    } else {
      chatContainer.innerHTML = '<div class="text-center py-8 text-gray-500">ابدأ محادثة جديدة</div>';
    }
    
    // التمرير إلى آخر رسالة
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
  } catch (error) {
    console.error('Error loading messages:', error);
    chatContainer.innerHTML = '<div class="text-center py-8 text-gray-500">حدث خطأ في تحميل المحادثة</div>';
  }
}

// إضافة رسالة إلى الواجهة
function addMessageToChat(message, isSender, timestamp = null) {
  const chatContainer = document.getElementById('chatMessages');
  
  const messageDiv = document.createElement('div');
  messageDiv.className = `flex ${isSender ? 'justify-end' : 'justify-start'}`;
  
  const messageContent = document.createElement('div');
  messageContent.className = `max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${isSender ? 'bg-green-100 text-gray-800' : 'bg-gray-100 text-gray-800'}`;
  messageContent.textContent = message;
  
  messageDiv.appendChild(messageContent);
  chatContainer.appendChild(messageDiv);
  
  // إضافة توقيت الرسالة إذا كان متاحًا
  if (timestamp) {
    const timeDiv = document.createElement('div');
    timeDiv.className = `text-xs text-gray-500 mt-1 ${isSender ? 'text-right' : 'text-left'}`;
    timeDiv.textContent = new Date(timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    messageDiv.appendChild(timeDiv);
  }
  
  // التمرير إلى آخر رسالة
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// الاشتراك لتلقي إشعارات الرسائل الجديدة
function subscribeToMessageNotifications() {
  if (!window.supabaseClient || !window.sessionManager.currentUser) return;
  
  const userId = window.sessionManager.currentUser.id;
  
  // اشتراك في التحديثات المباشرة
  window.supabaseClient
    .channel('messages')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `receiver_id=eq.${userId}`
    }, (payload) => {
      // إذا كانت الرسالة موجهة للمستخدم الحالي
      if (payload.new.receiver_id === userId) {
        showNewMessageNotification(payload.new);
      }
    })
    .subscribe();
}

// عرض إشعار برسالة جديدة
function showNewMessageNotification(message) {
  // إذا كانت نافذة الدردشة مفتوحة
  if (!document.getElementById('chatModal').classList.contains('hidden') && 
      message.sender_id === currentRecipientId) {
    // إضافة الرسالة إلى الدردشة الحالية
    addMessageToChat(message.message, false, message.created_at);
    return;
  }
  
  // عرض إشعار للمستخدم
  const notification = new Notification('رسالة جديدة من ' + currentRecipientName, {
    body: message.message,
    icon: '/assets/images/logo.png'
  });
  
  // عند النقر على الإشعار
  notification.onclick = () => {
    // فتح الدردشة مع المرسل
    startNewChat(message.trip_id, message.sender_id, currentRecipientName);
  };
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('addTripForm')) {
    document.getElementById('addTripForm').addEventListener('submit', addTrip);
  }
  if (document.getElementById('tripsTable')) {
    loadMyTrips();
  }
  subscribeToMessageNotifications();
});
