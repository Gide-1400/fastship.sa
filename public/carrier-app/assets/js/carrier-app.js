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

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('addTripForm')) {
    document.getElementById('addTripForm').addEventListener('submit', addTrip);
  }
  if (document.getElementById('tripsTable')) {
    loadMyTrips();
  }
});
