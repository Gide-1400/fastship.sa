// وظائف لوحة تحكم الشاحن

async function loadShipperDashboard() {
  const sessionManager = window.sessionManager;
  if (sessionManager?.init && !sessionManager.isInitialized) {
    try {
      await sessionManager.init();
    } catch (error) {
      console.error('Failed to initialize session manager before loading dashboard:', error);
    }
  }
  const user = sessionManager?.getCurrentUser ? sessionManager.getCurrentUser() : sessionManager?.currentUser;
  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };
  const setTableMessage = (message) => {
    const table = document.getElementById('dashboardShipmentsTable');
    if (table) table.innerHTML = `<tr><td colspan="4">${message}</td></tr>`;
  };

  if (!user) {
    setText('shipmentsCount', '-');
    setText('lastShipment', '-');
    setText('notificationsCount', '-');
    setText('messagesCount', '-');
    setTableMessage('يجب تسجيل الدخول');
    return;
  }

  let shipperId = null;
  try {
    shipperId = await sessionManager.ensureShipperRecord();
  } catch (error) {
    console.error('Error ensuring shipper record:', error);
  }

  if (!shipperId) {
    setText('shipmentsCount', '-');
    setTableMessage('تعذر تحديد حساب الشاحن');
    return;
  }

  if (window.messagingSystem?.init) {
    window.messagingSystem.init(user);
  }

  let shipmentsCount = 0;
  try {
    const { count, error } = await window.supabaseClient
      .from('shipments')
      .select('id', { count: 'exact', head: true })
      .eq('shipper_id', shipperId);
    if (error) throw error;
    shipmentsCount = count || 0;
  } catch (e) {
    shipmentsCount = 0;
  }
  setText('shipmentsCount', shipmentsCount);

  let lastShipmentTitle = 'لا يوجد';
  try {
    const { data, error } = await window.supabaseClient
      .from('shipments')
      .select('title')
      .eq('shipper_id', shipperId)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) throw error;
    if (data && data.length > 0) lastShipmentTitle = data[0].title || lastShipmentTitle;
  } catch (e) {
    console.error('Error loading last shipment:', e);
  }
  setText('lastShipment', lastShipmentTitle);

  let recentShipments = [];
  try {
    const { data, error } = await window.supabaseClient
      .from('shipments')
      .select('title, weight, from_location, to_location')
      .eq('shipper_id', shipperId)
      .order('created_at', { ascending: false })
      .limit(3);
    if (error) throw error;
    recentShipments = data || [];
  } catch (e) {
    console.error('Error loading recent shipments:', e);
    recentShipments = [];
  }

  const table = document.getElementById('dashboardShipmentsTable');
  if (table) {
    if (recentShipments.length > 0) {
      table.innerHTML = recentShipments.map(s => {
        const formatWeight = window.FastShipUtils?.formatWeight || ((value) => value ?? '-');
        return `
        <tr>
          <td>${s.title || '-'} </td>
          <td>${formatWeight(s.weight)}</td>
          <td>${s.from_location || '-'}</td>
          <td>${s.to_location || '-'}</td>
        </tr>
      `;
      }).join('');
    } else {
      table.innerHTML = '<tr><td colspan="4">لا يوجد شحنات</td></tr>';
    }
  }

  if (window.messagingSystem?.getUnreadCounts) {
    try {
      const unreadCounts = await window.messagingSystem.getUnreadCounts();
      setText('notificationsCount', unreadCounts.notifications ?? '0');
      setText('messagesCount', unreadCounts.messages ?? '0');

      const notificationsLink = document.getElementById('notificationsCountLink');
      const messagesLink = document.getElementById('messagesCountLink');
      if (notificationsLink && unreadCounts.notifications != null) notificationsLink.textContent = unreadCounts.notifications;
      if (messagesLink && unreadCounts.messages != null) messagesLink.textContent = unreadCounts.messages;
    } catch (e) {
      console.error('Error loading unread counts:', e);
      setText('notificationsCount', '0');
      setText('messagesCount', '0');
    }
  }
}

// تحميل الناقلين المتاحين
async function loadAvailableCarriers() {
  const sessionManager = window.sessionManager;
  if (sessionManager?.init && !sessionManager.isInitialized) {
    try {
      await sessionManager.init();
    } catch (error) {
      console.error('Failed to initialize session manager before loading carriers:', error);
    }
  }
  const user = sessionManager?.getCurrentUser ? sessionManager.getCurrentUser() : sessionManager?.currentUser;
  const setTable = (html) => {
    const table = document.getElementById('availableCarriersTable');
    if (table) table.innerHTML = html;
  };

  if (!user) {
    setTable('<tr><td colspan="6">يجب تسجيل الدخول</td></tr>');
    return;
  }

  let shipperId = null;
  try {
    shipperId = await sessionManager.ensureShipperRecord();
  } catch (error) {
    console.error('Error ensuring shipper record:', error);
  }

  if (!shipperId) {
    setTable('<tr><td colspan="6">تعذر تحديد حساب الشاحن</td></tr>');
    return;
  }

  try {
    // الحصول على آخر شحنة نشطة للمستخدم
    const { data: shipments, error } = await window.supabaseClient
      .from('shipments')
      .select('*')
      .eq('shipper_id', shipperId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!shipments || shipments.length === 0) {
      setTable('<tr><td colspan="6">لا توجد شحنات نشطة للبحث عن ناقلين</td></tr>');
      return;
    }

    const latestShipment = shipments[0];

    // البحث عن الرحلات المتطابقة
    if (!window.fastShipMatcher?.findMatchingTrips) {
      setTable('<tr><td colspan="6">نظام المطابقة غير متاح حالياً</td></tr>');
      return;
    }

    const matches = await window.fastShipMatcher.findMatchingTrips(latestShipment);

    if (matches.length === 0) {
      setTable('<tr><td colspan="6">لا توجد رحلات متاحة حالياً</td></tr>');
      return;
    }

    // عرض النتائج
    const tableBody = document.getElementById('availableCarriersTable');
    if (!tableBody) return;

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
    setTable('<tr><td colspan="6">خطأ في تحميل البيانات</td></tr>');
  }
}

// إرسال طلب تواصل لناقل
async function contactCarrier(tripId, shipmentId) {
  const message = prompt('اكتب رسالة للناقل:');
  if (!message) return;

  try {
    if (!window.fastShipMatcher?.sendContactRequest) {
      throw new Error('نظام التواصل غير متاح');
    }

    const result = await window.fastShipMatcher.sendContactRequest(shipmentId, tripId, message);
    if (result.success) {
      if (window.FastShipUtils?.showAlert) {
        window.FastShipUtils.showAlert('تم إرسال طلب التواصل بنجاح!', 'success');
      } else {
        alert('تم إرسال طلب التواصل بنجاح!');
      }
    } else {
      const errorMessage = 'خطأ في إرسال الطلب: ' + (result.error || 'غير معروف');
      if (window.FastShipUtils?.showAlert) {
        window.FastShipUtils.showAlert(errorMessage, 'error');
      } else {
        alert(errorMessage);
      }
    }
  } catch (error) {
    const fallbackMessage = 'خطأ في إرسال الطلب';
    if (window.FastShipUtils?.showAlert) {
      window.FastShipUtils.showAlert(fallbackMessage, 'error');
    } else {
      alert(fallbackMessage);
    }
  }
}

// تحديث الناقلين المتاحين
function refreshAvailableCarriers() {
  const table = document.getElementById('availableCarriersTable');
  if (table) {
    table.innerHTML = '<tr><td colspan="6">جاري البحث عن الناقلين...</td></tr>';
  }
  loadAvailableCarriers();
}

document.addEventListener('DOMContentLoaded', function() {
  loadShipperDashboard();
  // تحميل الناقلين المتاحين بعد تحميل لوحة التحكم
  setTimeout(loadAvailableCarriers, 1000);
});
