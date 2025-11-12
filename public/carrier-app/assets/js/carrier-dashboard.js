// وظائف لوحة تحكم الشاحن

async function loadCarrierDashboard() {
  const user = window.sessionManager.currentUser;
  if (!user) {
    document.getElementById('tripsCount').textContent = '-';
    document.getElementById('lastTrip').textContent = '-';
    document.getElementById('notificationsCount').textContent = '-';
    document.getElementById('messagesCount').textContent = '-';
    const table = document.getElementById('dashboardTripsTable');
    if (table) table.innerHTML = '<tr><td colspan="4">يجب تسجيل الدخول</td></tr>';
    return;
  }

  // Initialize messaging system
  window.messagingSystem.init(user);

  // إحصائيات الشحنات
  let tripsCount = 0;
  try {
    const { count, error } = await window.supabaseClient
      .from('trips')
      .select('*', { count: 'exact', head: true })
      .eq('carrier_id', user.id);
    if (error) throw error;
    tripsCount = count || 0;
  } catch (e) { tripsCount = 0; }
  document.getElementById('tripsCount').textContent = tripsCount;

  // آخر شحنة
  let lastTripTitle = 'لا يوجد';
  try {
    const { data, error } = await window.supabaseClient
      .from('trips')
      .select('*')
      .eq('carrier_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    if (data && data.length > 0) lastTripTitle = data[0].title;
  } catch (e) {}
  document.getElementById('lastTrip').textContent = lastTripTitle;

  // آخر 3 شحنات
  let recentTrips = [];
  try {
    const { data, error } = await window.supabaseClient
      .from('trips')
      .select('*')
      .eq('carrier_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3);
    if (error) throw error;
    recentTrips = data || [];
  } catch (e) { recentTrips = []; }
  const table = document.getElementById('dashboardTripsTable');
  if (table) {
    if (recentTrips.length > 0) {
      table.innerHTML = recentTrips.map(s => `
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
    const { data: trips, error } = await window.supabaseClient
      .from('trips')
      .select('*')
      .eq('carrier_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!trips || trips.length === 0) {
      document.getElementById('availableCarriersTable').innerHTML = '<tr><td colspan="6">لا توجد شحنات نشطة للبحث عن ناقلين</td></tr>';
      return;
    }

    const latestTrip = trips[0];

    // البحث عن الرحلات المتطابقة
    const matches = await window.fastShipMatcher.findMatchingTrips(latestTrip);

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
            <button onclick="contactCarrier('${trip.id}', '${latestTrip.id}')"
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
async function contactCarrier(tripId, tripId) {
  const message = prompt('اكتب رسالة للناقل:');
  if (!message) return;

  try {
    const result = await window.fastShipMatcher.sendContactRequest(tripId, tripId, message);
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
  loadCarrierDashboard();
  // تحميل الناقلين المتاحين بعد تحميل لوحة التحكم
  setTimeout(loadAvailableCarriers, 1000);
});
