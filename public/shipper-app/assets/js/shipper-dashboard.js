// وظائف لوحة تحكم الشاحن

async function loadShipperDashboard() {
  const user = window.sessionManager.currentUser;
  if (!user) {
    document.getElementById('shipmentsCount').textContent = '-';
    document.getElementById('lastShipment').textContent = '-';
    document.getElementById('notificationsCount').textContent = '-';
    document.getElementById('messagesCount').textContent = '-';
    const table = document.getElementById('dashboardShipmentsTable');
    if (table) table.innerHTML = '<tr><td colspan="4">يجب تسجيل الدخول</td></tr>';
    return;
  }

  // Initialize messaging system
  window.messagingSystem.init(user);

  // إحصائيات الشحنات
  let shipmentsCount = 0;
  try {
    const { count, error } = await window.supabaseClient
      .from('shipments')
      .select('*', { count: 'exact', head: true })
      .eq('shipper_id', user.id);
    if (error) throw error;
    shipmentsCount = count || 0;
  } catch (e) { shipmentsCount = 0; }
  document.getElementById('shipmentsCount').textContent = shipmentsCount;

  // آخر شحنة
  let lastShipmentTitle = 'لا يوجد';
  try {
    const { data, error } = await window.supabaseClient
      .from('shipments')
      .select('*')
      .eq('shipper_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    if (data && data.length > 0) lastShipmentTitle = data[0].title;
  } catch (e) {}
  document.getElementById('lastShipment').textContent = lastShipmentTitle;

  // آخر 3 شحنات
  let recentShipments = [];
  try {
    const { data, error } = await window.supabaseClient
      .from('shipments')
      .select('*')
      .eq('shipper_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3);
    if (error) throw error;
    recentShipments = data || [];
  } catch (e) { recentShipments = []; }
  const table = document.getElementById('dashboardShipmentsTable');
  if (table) {
    if (recentShipments.length > 0) {
      table.innerHTML = recentShipments.map(s => `
        <tr>
          <td>${s.title}</td>
          <td>${window.FastShipUtils.formatWeight(s.weight)}</td>
          <td>${s.from_location}</td>
          <td>${s.to_location}</td>
        </tr>
      `).join('');
    } else {
      table.innerHTML = '<tr><td colspan="4">لا يوجد شحنات</td></tr>';
    }
  }

  // استخدام messaging system للتنبيهات والرسائل
  try {
    const unreadCounts = await window.messagingSystem.getUnreadCounts();
    document.getElementById('notificationsCount').textContent = unreadCounts.notifications;
    document.getElementById('messagesCount').textContent = unreadCounts.messages;

    // Update link counts if they exist
    const notificationsLink = document.getElementById('notificationsCountLink');
    const messagesLink = document.getElementById('messagesCountLink');
    if (notificationsLink) notificationsLink.textContent = unreadCounts.notifications;
    if (messagesLink) messagesLink.textContent = unreadCounts.messages;
  } catch (e) {
    console.error('Error loading unread counts:', e);
    document.getElementById('notificationsCount').textContent = '0';
    document.getElementById('messagesCount').textContent = '0';
  }
}

// تحميل الناقلين المتاحين
async function loadAvailableCarriers() {
  const user = window.sessionManager.currentUser;
  if (!user) {
    document.getElementById('availableCarriersTable').innerHTML = '<tr><td colspan="6">يجب تسجيل الدخول</td></tr>';
    return;
  }

  try {
    // الحصول على آخر شحنة نشطة للمستخدم
    const { data: shipments, error } = await window.supabaseClient
      .from('shipments')
      .select('*')
      .eq('shipper_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!shipments || shipments.length === 0) {
      document.getElementById('availableCarriersTable').innerHTML = '<tr><td colspan="6">لا توجد شحنات نشطة للبحث عن ناقلين</td></tr>';
      return;
    }

    const latestShipment = shipments[0];

    // البحث عن الرحلات المتطابقة
    const matches = await window.fastShipMatcher.findMatchingTrips(latestShipment);

    if (matches.length === 0) {
      document.getElementById('availableCarriersTable').innerHTML = '<tr><td colspan="6">لا توجد رحلات متاحة حالياً</td></tr>';
      return;
    }

    // عرض النتائج
    const tableBody = document.getElementById('availableCarriersTable');
    tableBody.innerHTML = matches.slice(0, 5).map(match => {
      const trip = match.trip;
      const carrier = trip.carriers;
      const score = Math.round(match.score);

      return `
        <tr class="border-t">
          <td class="py-2 px-4">${carrier ? carrier.full_name : 'غير محدد'}</td>
          <td class="py-2 px-4">${trip.from_location}</td>
          <td class="py-2 px-4">${trip.to_location}</td>
          <td class="py-2 px-4">${new Date(trip.available_date).toLocaleDateString('ar-SA')}</td>
          <td class="py-2 px-4">
            <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm">${score}%</span>
          </td>
          <td class="py-2 px-4">
            <button onclick="contactCarrier('${trip.id}', '${latestShipment.id}')"
                    class="bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition duration-200 text-sm">
              تواصل
            </button>
          </td>
        </tr>
      `;
    }).join('');

  } catch (error) {
    console.error('خطأ في تحميل الناقلين المتاحين:', error);
    document.getElementById('availableCarriersTable').innerHTML = '<tr><td colspan="6">خطأ في تحميل البيانات</td></tr>';
  }
}

// إرسال طلب تواصل لناقل
async function contactCarrier(tripId, shipmentId) {
  const message = prompt('اكتب رسالة للناقل:');
  if (!message) return;

  try {
    const result = await window.fastShipMatcher.sendContactRequest(shipmentId, tripId, message);
    if (result.success) {
      window.FastShipUtils.showAlert('تم إرسال طلب التواصل بنجاح!', 'success');
    } else {
      window.FastShipUtils.showAlert('خطأ في إرسال الطلب: ' + result.error, 'error');
    }
  } catch (error) {
    window.FastShipUtils.showAlert('خطأ في إرسال الطلب', 'error');
  }
}

// تحديث الناقلين المتاحين
function refreshAvailableCarriers() {
  document.getElementById('availableCarriersTable').innerHTML = '<tr><td colspan="6">جاري البحث عن الناقلين...</td></tr>';
  loadAvailableCarriers();
}

document.addEventListener('DOMContentLoaded', function() {
  loadShipperDashboard();
  // تحميل الناقلين المتاحين بعد تحميل لوحة التحكم
  setTimeout(loadAvailableCarriers, 1000);
});
