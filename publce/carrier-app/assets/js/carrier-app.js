// وظائف قسم الناقل فقط

// إضافة رحلة جديدة
async function addShipment(event) {
  event.preventDefault();
  const form = event.target;
  const data = {
    title: form.title.value,
    description: form.description.value,
    weight: form.weight.value,
    from_location: form.from_location.value,
    to_location: form.to_location.value
  };
  // حفظ الرحلة في Supabase
  const { error } = await window.supabaseClient
    .from('trips')
    .insert([{ ...data }]);
  if (error) {
    alert('حدث خطأ أثناء إضافة الرحلة: ' + error.message);
  } else {
    alert('تمت إضافة الرحلة بنجاح!');
    window.location.href = 'shipments.html';
  }
}

// تحميل الرحلات الخاصة بالمستخدم
async function loadMyShipments() {
  const user = window.sessionManager.currentUser;
  if (!user) return;
  const { data, error } = await window.supabaseClient
    .from('trips')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  if (error) {
    alert('خطأ في تحميل الرحلات: ' + error.message);
    return;
  }
  const table = document.getElementById('shipmentsTable');
  if (!table) return;
  table.innerHTML = data.map(s => `<tr><td>${s.title}</td><td>${s.weight}</td><td>${s.from_location}</td><td>${s.to_location}</td></tr>`).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('addShipmentForm')) {
    document.getElementById('addShipmentForm').addEventListener('submit', addShipment);
  }
  if (document.getElementById('shipmentsTable')) {
    loadMyShipments();
  }
});
