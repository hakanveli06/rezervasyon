import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import './App.css';

// ─── API Helper ─────────────────────────────────────────────
const API_BASE = process.env.REACT_APP_API_URL || '/api';

async function api(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    window.location.reload();
    return;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Bir hata oluştu' }));
    throw new Error(err.detail || 'Bir hata oluştu');
  }
  return res.json();
}

// ─── Auth Context ───────────────────────────────────────────
const AuthContext = createContext();
function useAuth() { return useContext(AuthContext); }

// ─── Date Helpers ───────────────────────────────────────────
function formatDate(d) { return d.toISOString().split('T')[0]; }
function formatDateTR(dateStr) {
  const months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  const days = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${days[d.getDay()]}`;
}
function getWeekDates(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return Array.from({length: 7}, (_, i) => {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    return formatDate(dd);
  });
}
function getMonthDates(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDay = firstDay.getDay();
  startDay = startDay === 0 ? 6 : startDay - 1;
  const dates = [];
  for (let i = startDay - 1; i >= 0; i--) {
    const dd = new Date(year, month, -i);
    dates.push({ date: formatDate(dd), currentMonth: false });
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    dates.push({ date: formatDate(new Date(year, month, i)), currentMonth: true });
  }
  const remaining = 42 - dates.length;
  for (let i = 1; i <= remaining; i++) {
    dates.push({ date: formatDate(new Date(year, month + 1, i)), currentMonth: false });
  }
  return dates;
}
function getTimeSlots(start, end, duration) {
  const slots = [];
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let current = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (current < endMin) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    current += duration;
  }
  return slots;
}

// ─── Login Page ─────────────────────────────────────────────
function LoginPage({ onLogin }) {
  const [tab, setTab] = useState('user');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = tab === 'admin' ? '/auth/admin-login' : '/auth/user-login';
      const body = tab === 'admin' ? { username: 'admin', password } : { username, password };
      const data = await api(endpoint, { method: 'POST', body: JSON.stringify(body) });
      localStorage.setItem('token', data.token);
      localStorage.setItem('role', data.role);
      onLogin(data.role);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-bg-pattern"></div>
      <div className="login-container">
        <div className="login-header">
          <div className="login-emblem">
            <svg viewBox="0 0 80 80" className="emblem-svg">
              <circle cx="40" cy="40" r="38" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3"/>
              <path d="M40 12 L40 68 M25 20 Q40 35 55 20 M20 30 Q40 50 60 30 M22 42 Q40 58 58 42" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="40" cy="40" r="5" fill="currentColor" opacity="0.2"/>
            </svg>
          </div>
          <h1>T.C. Tarım ve Orman Bakanlığı</h1>
          <h2>İç Denetim Başkanlığı</h2>
          <p className="login-subtitle">Toplantı Salonu Rezervasyon Sistemi</p>
        </div>
        <div className="login-tabs">
          <button className={`login-tab ${tab === 'user' ? 'active' : ''}`} onClick={() => { setTab('user'); setError(''); }}>
            <span className="tab-icon">👤</span> Kullanıcı Girişi
          </button>
          <button className={`login-tab ${tab === 'admin' ? 'active' : ''}`} onClick={() => { setTab('admin'); setError(''); }}>
            <span className="tab-icon">⚙️</span> Yönetici Paneli
          </button>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          {tab === 'user' && (
            <div className="form-group">
              <label>Kullanıcı Adı</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Kullanıcı adınızı giriniz" required autoComplete="username"/>
            </div>
          )}
          <div className="form-group">
            <label>{tab === 'admin' ? 'Yönetici Şifresi' : 'Şifre'}</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Şifrenizi giriniz" required autoComplete="current-password"/>
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>
      </div>
      <div className="login-footer">© {new Date().getFullYear()} Tarım ve Orman Bakanlığı - İç Denetim Başkanlığı</div>
    </div>
  );
}

// ─── Room Status Banner ─────────────────────────────────────
function RoomStatusBanner() {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    api('/room-status').then(setStatus).catch(() => {});
    const interval = setInterval(() => api('/room-status').then(setStatus).catch(() => {}), 30000);
    return () => clearInterval(interval);
  }, []);
  if (!status) return null;
  const isOccupied = status.status === 'occupied';
  return (
    <div className={`room-status-banner ${isOccupied ? 'occupied' : 'available'}`}>
      <div className="status-indicator"><div className="status-dot"></div></div>
      <div className="status-info">
        <strong>{isOccupied ? '🔴 Toplantı Salonu Dolu' : '🟢 Toplantı Salonu Boş'}</strong>
        {isOccupied && <span className="status-detail">Saat {status.end_time}'e kadar dolu</span>}
        {!isOccupied && status.next_reservation && <span className="status-detail">Sonraki toplantı: {status.next_reservation.start_time}</span>}
        {!isOccupied && !status.next_reservation && <span className="status-detail">Bugün başka toplantı yok</span>}
      </div>
    </div>
  );
}

// ─── Reservation Modal ──────────────────────────────────────
function ReservationModal({ date, startTime, endTime, fields, settings, onClose, onSave, existingReservations }) {
  const [formData, setFormData] = useState({});
  const [selectedStart, setSelectedStart] = useState(startTime || '');
  const [selectedEnd, setSelectedEnd] = useState(endTime || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const slots = getTimeSlots(settings.work_start || '09:00', settings.work_end || '18:00', parseInt(settings.slot_duration || '30'));

  const isSlotOccupied = (slotTime) => {
    return existingReservations?.some(r =>
      r.reservation_date === date && r.start_time <= slotTime && r.end_time > slotTime
    );
  };

  const handleSave = async () => {
    for (const f of fields) {
      if (f.is_required && !formData[f.field_name]?.toString().trim()) {
        setError(`"${f.field_name}" alanı zorunludur`);
        return;
      }
    }
    if (!selectedStart || !selectedEnd) { setError('Başlangıç ve bitiş saati seçiniz'); return; }
    if (selectedStart >= selectedEnd) { setError('Bitiş saati başlangıçtan sonra olmalı'); return; }
    setSaving(true);
    try {
      await onSave({
        reservation_date: date,
        start_time: selectedStart,
        end_time: selectedEnd,
        custom_data: formData,
        created_by: formData[fields[0]?.field_name] || ''
      });
      onClose();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const renderField = (field) => {
    switch (field.field_type) {
      case 'number':
        return <input type="number" value={formData[field.field_name] || ''} onChange={e => setFormData({...formData, [field.field_name]: e.target.value})} placeholder={field.placeholder} min="0"/>;
      case 'select':
        return (
          <select value={formData[field.field_name] || ''} onChange={e => setFormData({...formData, [field.field_name]: e.target.value})}>
            <option value="">Seçiniz...</option>
            {field.options?.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
          </select>
        );
      case 'datetime':
        return <input type="datetime-local" value={formData[field.field_name] || ''} onChange={e => setFormData({...formData, [field.field_name]: e.target.value})}/>;
      default:
        return <input type="text" value={formData[field.field_name] || ''} onChange={e => setFormData({...formData, [field.field_name]: e.target.value})} placeholder={field.placeholder}/>;
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Yeni Rezervasyon</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="modal-date-display">{formatDateTR(date)}</div>

          <div className="time-selector">
            <div className="time-group">
              <label>Başlangıç Saati</label>
              <select value={selectedStart} onChange={e => setSelectedStart(e.target.value)}>
                <option value="">Seçiniz</option>
                {slots.map(s => <option key={s} value={s} disabled={isSlotOccupied(s)}>{s} {isSlotOccupied(s) ? '(Dolu)' : ''}</option>)}
              </select>
            </div>
            <div className="time-group">
              <label>Bitiş Saati</label>
              <select value={selectedEnd} onChange={e => setSelectedEnd(e.target.value)}>
                <option value="">Seçiniz</option>
                {slots.filter(s => s > selectedStart).map(s => <option key={s} value={s} disabled={isSlotOccupied(s)}>{s}</option>)}
                {selectedStart && <option value={settings.work_end || '18:00'}>{settings.work_end || '18:00'}</option>}
              </select>
            </div>
          </div>

          {fields.map(field => (
            <div key={field.id} className="form-group">
              <label>
                {field.field_name}
                {field.is_required && <span className="required-star">*</span>}
              </label>
              {field.description && <small className="field-hint">{field.description}</small>}
              {renderField(field)}
            </div>
          ))}

          {error && <div className="error-msg">{error}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>İptal</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Rezervasyon Oluştur'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar Views ─────────────────────────────────────────
function DayView({ date, reservations, settings, onSlotClick, onDelete, isAdmin }) {
  const slots = getTimeSlots(settings.work_start || '09:00', settings.work_end || '18:00', parseInt(settings.slot_duration || '30'));
  const dateStr = formatDate(date);
  const dayRes = reservations.filter(r => r.reservation_date === dateStr);

  const getResForSlot = (slot) => dayRes.find(r => r.start_time <= slot && r.end_time > slot);

  return (
    <div className="day-view">
      <div className="day-header-title">{formatDateTR(dateStr)}</div>
      <div className="time-grid">
        {slots.map(slot => {
          const res = getResForSlot(slot);
          const isStart = res && res.start_time === slot;
          if (res && !isStart) return null;
          const slotCount = res ? Math.ceil((
            (parseInt(res.end_time.split(':')[0]) * 60 + parseInt(res.end_time.split(':')[1])) -
            (parseInt(res.start_time.split(':')[0]) * 60 + parseInt(res.start_time.split(':')[1]))
          ) / parseInt(settings.slot_duration || '30')) : 1;

          return (
            <div key={slot} className={`time-slot ${res ? 'occupied' : 'available'}`}
              style={res ? {gridRow: `span ${slotCount}`} : {}}
              onClick={() => !res && onSlotClick(dateStr, slot)}>
              <span className="slot-time">{slot}</span>
              {res ? (
                <div className="slot-reservation">
                  <div className="slot-res-info">
                    <strong>{res.custom_data?.[Object.keys(res.custom_data)[0]] || 'Rezervasyon'}</strong>
                    <span>{res.start_time} - {res.end_time}</span>
                    {Object.entries(res.custom_data || {}).slice(1, 3).map(([k, v]) => (
                      <small key={k}>{k}: {v}</small>
                    ))}
                  </div>
                  <button className="slot-delete" onClick={(e) => { e.stopPropagation(); onDelete(res.id); }} title="İptal et">✕</button>
                </div>
              ) : (
                <span className="slot-available">Müsait</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ date, reservations, settings, onSlotClick, onDelete }) {
  const weekDates = getWeekDates(date);
  const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const slots = getTimeSlots(settings.work_start || '09:00', settings.work_end || '18:00', parseInt(settings.slot_duration || '30'));
  const today = formatDate(new Date());

  return (
    <div className="week-view">
      <div className="week-header">
        <div className="week-time-label"></div>
        {weekDates.map((d, i) => (
          <div key={d} className={`week-day-header ${d === today ? 'today' : ''}`}>
            <span className="day-name">{dayNames[i]}</span>
            <span className="day-number">{new Date(d + 'T00:00:00').getDate()}</span>
          </div>
        ))}
      </div>
      <div className="week-body">
        {slots.map(slot => (
          <div key={slot} className="week-row">
            <div className="week-time-cell">{slot}</div>
            {weekDates.map(d => {
              const res = reservations.find(r => r.reservation_date === d && r.start_time <= slot && r.end_time > slot);
              const isStart = res && res.start_time === slot;
              return (
                <div key={d} className={`week-cell ${res ? 'occupied' : 'available'} ${d === today ? 'today-col' : ''}`}
                  onClick={() => !res && onSlotClick(d, slot)}>
                  {isStart && (
                    <div className="week-res-chip" title={`${res.start_time}-${res.end_time}`}>
                      <span>{res.custom_data?.[Object.keys(res.custom_data)[0]] || ''}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthView({ date, reservations, onDayClick }) {
  const monthDates = getMonthDates(date);
  const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
  const today = formatDate(new Date());
  const months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];

  return (
    <div className="month-view">
      <div className="month-title">{months[date.getMonth()]} {date.getFullYear()}</div>
      <div className="month-grid">
        {dayNames.map(d => <div key={d} className="month-day-name">{d}</div>)}
        {monthDates.map(({ date: d, currentMonth }) => {
          const dayRes = reservations.filter(r => r.reservation_date === d);
          return (
            <div key={d} className={`month-cell ${!currentMonth ? 'other-month' : ''} ${d === today ? 'today' : ''} ${dayRes.length > 0 ? 'has-res' : ''}`}
              onClick={() => onDayClick(d)}>
              <span className="month-day-num">{new Date(d + 'T00:00:00').getDate()}</span>
              {dayRes.length > 0 && (
                <div className="month-res-dots">
                  {dayRes.slice(0, 3).map((r, i) => (
                    <div key={i} className="month-res-dot" title={`${r.start_time}-${r.end_time}`}></div>
                  ))}
                  {dayRes.length > 3 && <span className="month-more">+{dayRes.length - 3}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Calendar Page ─────────────────────────────────────
function CalendarPage() {
  const { role, logout } = useAuth();
  const [view, setView] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reservations, setReservations] = useState([]);
  const [fields, setFields] = useState([]);
  const [settings, setSettings] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [modalDate, setModalDate] = useState('');
  const [modalStart, setModalStart] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const loadData = useCallback(async () => {
    try {
      const s = await api('/settings');
      setSettings(s);
      const f = await api('/fields');
      setFields(f);

      let startDate, endDate;
      if (view === 'day') {
        startDate = endDate = formatDate(currentDate);
      } else if (view === 'week') {
        const week = getWeekDates(currentDate);
        startDate = week[0]; endDate = week[6];
      } else {
        const y = currentDate.getFullYear(), m = currentDate.getMonth();
        startDate = formatDate(new Date(y, m, 1));
        endDate = formatDate(new Date(y, m + 1, 0));
      }
      const r = await api(`/reservations?start_date=${startDate}&end_date=${endDate}`);
      setReservations(r);
    } catch (err) { console.error(err); }
  }, [currentDate, view]);

  useEffect(() => { loadData(); }, [loadData]);

  const navigate = (dir) => {
    const d = new Date(currentDate);
    if (view === 'day') d.setDate(d.getDate() + dir);
    else if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
  };

  const handleSlotClick = (date, time) => {
    setModalDate(date);
    setModalStart(time);
    const dur = parseInt(settings.slot_duration || '30');
    const [h, m] = time.split(':').map(Number);
    const endMin = h * 60 + m + dur;
    setShowModal(true);
  };

  const handleSaveReservation = async (data) => {
    await api('/reservations', { method: 'POST', body: JSON.stringify(data) });
    showToast('Rezervasyon başarıyla oluşturuldu!');
    loadData();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Bu rezervasyonu iptal etmek istediğinize emin misiniz?')) {
      await api(`/reservations/${id}`, { method: 'DELETE' });
      showToast('Rezervasyon iptal edildi');
      loadData();
    }
  };

  const handleDayClick = (dateStr) => {
    setCurrentDate(new Date(dateStr + 'T00:00:00'));
    setView('day');
  };

  if (showAdmin && role === 'admin') {
    return <AdminPanel onBack={() => { setShowAdmin(false); loadData(); }} />;
  }

  const getNavigationLabel = () => {
    const months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    if (view === 'day') return formatDateTR(formatDate(currentDate));
    if (view === 'week') {
      const week = getWeekDates(currentDate);
      return `${new Date(week[0]+'T00:00:00').getDate()} - ${new Date(week[6]+'T00:00:00').getDate()} ${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    return `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-top">
          <div className="header-brand">
            <svg viewBox="0 0 40 40" className="header-logo">
              <path d="M20 4 L20 36 M12 8 Q20 18 28 8 M9 15 Q20 28 31 15 M10 23 Q20 33 30 23" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <div>
              <h1>Toplantı Salonu Rezervasyon</h1>
              <span className="header-org">İç Denetim Başkanlığı</span>
            </div>
          </div>
          <div className="header-actions">
            {role === 'admin' && <button className="btn-admin" onClick={() => setShowAdmin(true)}>⚙️ Yönetim</button>}
            <button className="btn-logout" onClick={logout}>Çıkış</button>
          </div>
        </div>
      </header>

      <RoomStatusBanner />

      <div className="calendar-toolbar">
        <div className="view-tabs">
          {['day', 'week', 'month'].map(v => (
            <button key={v} className={`view-tab ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
              {v === 'day' ? 'Gün' : v === 'week' ? 'Hafta' : 'Ay'}
            </button>
          ))}
        </div>
        <div className="nav-controls">
          <button className="nav-btn" onClick={() => navigate(-1)}>‹</button>
          <button className="nav-today" onClick={() => setCurrentDate(new Date())}>Bugün</button>
          <span className="nav-label">{getNavigationLabel()}</span>
          <button className="nav-btn" onClick={() => navigate(1)}>›</button>
        </div>
      </div>

      <main className="calendar-main">
        {view === 'day' && <DayView date={currentDate} reservations={reservations} settings={settings} onSlotClick={handleSlotClick} onDelete={handleDelete} isAdmin={role==='admin'}/>}
        {view === 'week' && <WeekView date={currentDate} reservations={reservations} settings={settings} onSlotClick={handleSlotClick} onDelete={handleDelete}/>}
        {view === 'month' && <MonthView date={currentDate} reservations={reservations} onDayClick={handleDayClick}/>}
      </main>

      {showModal && (
        <ReservationModal
          date={modalDate}
          startTime={modalStart}
          fields={fields}
          settings={settings}
          existingReservations={reservations}
          onClose={() => setShowModal(false)}
          onSave={handleSaveReservation}
        />
      )}

      {toast && <div className="toast">{toast}</div>}

      <button className="fab" onClick={() => { setModalDate(formatDate(currentDate)); setModalStart(''); setShowModal(true); }} title="Yeni Rezervasyon">+</button>
    </div>
  );
}

// ─── Admin Panel ────────────────────────────────────────────
function AdminPanel({ onBack }) {
  const [tab, setTab] = useState('fields');
  const [fields, setFields] = useState([]);
  const [settings, setSettings] = useState({});
  const [stats, setStats] = useState(null);
  const [toast, setToast] = useState('');
  const [reservations, setReservations] = useState([]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  useEffect(() => {
    api('/fields').then(setFields).catch(console.error);
    api('/settings').then(setSettings).catch(console.error);
    api('/stats').then(setStats).catch(console.error);
    api('/reservations').then(setReservations).catch(console.error);
  }, []);

  return (
    <div className="admin-container">
      <div className="admin-header">
        <button className="btn-back" onClick={onBack}>← Takvime Dön</button>
        <h2>Yönetim Paneli</h2>
      </div>
      <div className="admin-tabs">
        {[
          ['fields', '📋 Alan Yönetimi'],
          ['settings', '⚙️ Ayarlar'],
          ['reservations', '📅 Rezervasyonlar'],
          ['stats', '📊 İstatistikler'],
          ['security', '🔒 Güvenlik'],
        ].map(([key, label]) => (
          <button key={key} className={`admin-tab ${tab === key ? 'active' : ''}`} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      <div className="admin-content">
        {tab === 'fields' && <FieldManager fields={fields} setFields={setFields} showToast={showToast} />}
        {tab === 'settings' && <SettingsPanel settings={settings} setSettings={setSettings} showToast={showToast} />}
        {tab === 'reservations' && <ReservationManager reservations={reservations} setReservations={setReservations} showToast={showToast} />}
        {tab === 'stats' && <StatsPanel stats={stats} />}
        {tab === 'security' && <SecurityPanel showToast={showToast} settings={settings} />}
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

// ─── Field Manager ──────────────────────────────────────────
function FieldManager({ fields, setFields, showToast }) {
  const [editingField, setEditingField] = useState(null);
  const [newField, setNewField] = useState({ field_name: '', field_type: 'text', is_required: false, placeholder: '', description: '', options: [] });
  const [showAdd, setShowAdd] = useState(false);
  const [optionInput, setOptionInput] = useState('');

  const saveField = async () => {
    if (!newField.field_name.trim()) return;
    try {
      await api('/fields', { method: 'POST', body: JSON.stringify({ ...newField, sort_order: fields.length }) });
      const updated = await api('/fields');
      setFields(updated);
      setNewField({ field_name: '', field_type: 'text', is_required: false, placeholder: '', description: '', options: [] });
      setShowAdd(false);
      showToast('Alan eklendi');
    } catch (err) { showToast(err.message); }
  };

  const updateField = async (id, data) => {
    try {
      await api(`/fields/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      const updated = await api('/fields');
      setFields(updated);
      setEditingField(null);
      showToast('Alan güncellendi');
    } catch (err) { showToast(err.message); }
  };

  const deleteField = async (id) => {
    if (!window.confirm('Bu alanı silmek istediğinize emin misiniz?')) return;
    await api(`/fields/${id}`, { method: 'DELETE' });
    const updated = await api('/fields');
    setFields(updated);
    showToast('Alan silindi');
  };

  const addOption = () => {
    if (!optionInput.trim()) return;
    setNewField({ ...newField, options: [...newField.options, optionInput.trim()] });
    setOptionInput('');
  };

  return (
    <div className="field-manager">
      <div className="section-header">
        <h3>Rezervasyon Alanları</h3>
        <button className="btn-primary" onClick={() => setShowAdd(!showAdd)}>+ Yeni Alan Ekle</button>
      </div>

      {showAdd && (
        <div className="field-form card">
          <h4>Yeni Alan</h4>
          <div className="form-group">
            <label>Alan Adı</label>
            <input value={newField.field_name} onChange={e => setNewField({...newField, field_name: e.target.value})} placeholder="Örn: Toplantı Konusu"/>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Alan Tipi</label>
              <select value={newField.field_type} onChange={e => setNewField({...newField, field_type: e.target.value})}>
                <option value="text">Metin</option>
                <option value="number">Sayı</option>
                <option value="select">Açılır Liste</option>
                <option value="datetime">Tarih/Saat</option>
              </select>
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input type="checkbox" checked={newField.is_required} onChange={e => setNewField({...newField, is_required: e.target.checked})} />
                Zorunlu Alan
              </label>
            </div>
          </div>
          <div className="form-group">
            <label>İpucu Metni (Placeholder)</label>
            <input value={newField.placeholder} onChange={e => setNewField({...newField, placeholder: e.target.value})} placeholder="Kullanıcının göreceği ipucu metni"/>
          </div>
          <div className="form-group">
            <label>Açıklama</label>
            <input value={newField.description} onChange={e => setNewField({...newField, description: e.target.value})} placeholder="Bu alanla ilgili açıklama"/>
          </div>
          {newField.field_type === 'select' && (
            <div className="form-group">
              <label>Seçenekler</label>
              <div className="option-input-row">
                <input value={optionInput} onChange={e => setOptionInput(e.target.value)} placeholder="Seçenek ekle" onKeyDown={e => e.key === 'Enter' && addOption()}/>
                <button className="btn-small" onClick={addOption}>Ekle</button>
              </div>
              <div className="options-list">
                {newField.options.map((opt, i) => (
                  <span key={i} className="option-chip">{opt} <button onClick={() => setNewField({...newField, options: newField.options.filter((_,j) => j !== i)})}>✕</button></span>
                ))}
              </div>
            </div>
          )}
          <div className="form-actions">
            <button className="btn-secondary" onClick={() => setShowAdd(false)}>İptal</button>
            <button className="btn-primary" onClick={saveField}>Kaydet</button>
          </div>
        </div>
      )}

      <div className="fields-list">
        {fields.map((field, idx) => (
          <div key={field.id} className="field-card card">
            <div className="field-card-header">
              <div className="field-info">
                <strong>{field.field_name}</strong>
                <div className="field-badges">
                  <span className="badge type-badge">{field.field_type === 'text' ? 'Metin' : field.field_type === 'number' ? 'Sayı' : field.field_type === 'select' ? 'Liste' : 'Tarih'}</span>
                  {field.is_required && <span className="badge required-badge">Zorunlu</span>}
                </div>
              </div>
              <div className="field-actions">
                <button className="btn-icon" onClick={() => setEditingField(editingField === field.id ? null : field.id)} title="Düzenle">✏️</button>
                <button className="btn-icon danger" onClick={() => deleteField(field.id)} title="Sil">🗑️</button>
              </div>
            </div>
            {field.description && <p className="field-desc">{field.description}</p>}
            {field.placeholder && <p className="field-placeholder">İpucu: "{field.placeholder}"</p>}
            {editingField === field.id && (
              <EditFieldForm field={field} onSave={(data) => updateField(field.id, data)} onCancel={() => setEditingField(null)} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EditFieldForm({ field, onSave, onCancel }) {
  const [data, setData] = useState({ ...field });
  const [optInput, setOptInput] = useState('');
  return (
    <div className="edit-field-form">
      <div className="form-group"><label>Alan Adı</label><input value={data.field_name} onChange={e => setData({...data, field_name: e.target.value})}/></div>
      <div className="form-row">
        <div className="form-group"><label>Tip</label>
          <select value={data.field_type} onChange={e => setData({...data, field_type: e.target.value})}>
            <option value="text">Metin</option><option value="number">Sayı</option><option value="select">Liste</option><option value="datetime">Tarih</option>
          </select>
        </div>
        <div className="form-group"><label className="checkbox-label"><input type="checkbox" checked={data.is_required} onChange={e => setData({...data, is_required: e.target.checked})}/> Zorunlu</label></div>
      </div>
      <div className="form-group"><label>İpucu</label><input value={data.placeholder} onChange={e => setData({...data, placeholder: e.target.value})}/></div>
      <div className="form-group"><label>Açıklama</label><input value={data.description} onChange={e => setData({...data, description: e.target.value})}/></div>
      {data.field_type === 'select' && (
        <div className="form-group"><label>Seçenekler</label>
          <div className="option-input-row">
            <input value={optInput} onChange={e => setOptInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setData({...data, options: [...(data.options||[]), optInput]}); setOptInput(''); }}}/>
            <button className="btn-small" onClick={() => { setData({...data, options: [...(data.options||[]), optInput]}); setOptInput(''); }}>Ekle</button>
          </div>
          <div className="options-list">{(data.options||[]).map((o,i) => <span key={i} className="option-chip">{o} <button onClick={() => setData({...data, options: data.options.filter((_,j)=>j!==i)})}>✕</button></span>)}</div>
        </div>
      )}
      <div className="form-actions">
        <button className="btn-secondary" onClick={onCancel}>İptal</button>
        <button className="btn-primary" onClick={() => onSave(data)}>Güncelle</button>
      </div>
    </div>
  );
}

// ─── Settings Panel ─────────────────────────────────────────
function SettingsPanel({ settings, setSettings, showToast }) {
  const [local, setLocal] = useState({ work_start: '', work_end: '', slot_duration: 30 });
  useEffect(() => {
    setLocal({
      work_start: settings.work_start || '09:00',
      work_end: settings.work_end || '18:00',
      slot_duration: parseInt(settings.slot_duration || '30'),
    });
  }, [settings]);

  const save = async () => {
    try {
      await api('/settings', { method: 'PUT', body: JSON.stringify(local) });
      setSettings({...settings, ...local, slot_duration: String(local.slot_duration)});
      showToast('Ayarlar kaydedildi');
    } catch (err) { showToast(err.message); }
  };

  return (
    <div className="settings-panel">
      <h3>Genel Ayarlar</h3>
      <div className="card">
        <div className="form-row">
          <div className="form-group"><label>Çalışma Başlangıcı</label><input type="time" value={local.work_start} onChange={e => setLocal({...local, work_start: e.target.value})}/></div>
          <div className="form-group"><label>Çalışma Bitişi</label><input type="time" value={local.work_end} onChange={e => setLocal({...local, work_end: e.target.value})}/></div>
        </div>
        <div className="form-group">
          <label>Zaman Dilimi (dakika)</label>
          <select value={local.slot_duration} onChange={e => setLocal({...local, slot_duration: parseInt(e.target.value)})}>
            <option value={15}>15 dakika</option><option value={30}>30 dakika</option><option value={60}>60 dakika</option>
          </select>
        </div>
        <button className="btn-primary" onClick={save}>Kaydet</button>
      </div>
    </div>
  );
}

// ─── Reservation Manager ────────────────────────────────────
function ReservationManager({ reservations, setReservations, showToast }) {
  const deleteRes = async (id) => {
    if (!window.confirm('Silmek istediğinize emin misiniz?')) return;
    await api(`/reservations/${id}`, { method: 'DELETE' });
    setReservations(reservations.filter(r => r.id !== id));
    showToast('Rezervasyon silindi');
  };
  return (
    <div className="reservation-manager">
      <h3>Tüm Rezervasyonlar</h3>
      {reservations.length === 0 ? <p className="empty-state">Henüz rezervasyon yok</p> : (
        <div className="res-list">
          {reservations.map(r => (
            <div key={r.id} className="res-card card">
              <div className="res-card-header">
                <strong>{formatDateTR(r.reservation_date)}</strong>
                <span className="res-time">{r.start_time} - {r.end_time}</span>
              </div>
              <div className="res-card-data">
                {Object.entries(r.custom_data || {}).map(([k, v]) => <div key={k}><small>{k}:</small> {v}</div>)}
              </div>
              <button className="btn-danger-small" onClick={() => deleteRes(r.id)}>Sil</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stats Panel ────────────────────────────────────────────
function StatsPanel({ stats }) {
  if (!stats) return <p>Yükleniyor...</p>;
  return (
    <div className="stats-panel">
      <h3>İstatistikler</h3>
      <div className="stats-grid">
        <div className="stat-card card"><div className="stat-value">{stats.today_count}</div><div className="stat-label">Bugünkü Toplantı</div></div>
        <div className="stat-card card"><div className="stat-value">{stats.month_count}</div><div className="stat-label">Bu Ay Toplam</div></div>
        <div className="stat-card card"><div className="stat-value">{stats.total_count}</div><div className="stat-label">Tüm Zamanlar</div></div>
      </div>
      {stats.busy_hours?.length > 0 && (
        <div className="card" style={{marginTop: '1rem'}}>
          <h4>En Yoğun Saatler</h4>
          {stats.busy_hours.map((bh, i) => (
            <div key={i} className="busy-hour-row">
              <span>{bh.time}</span>
              <div className="busy-bar" style={{width: `${(bh.count / Math.max(...stats.busy_hours.map(b=>b.count))) * 100}%`}}></div>
              <span>{bh.count} toplantı</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Security Panel ─────────────────────────────────────────
function SecurityPanel({ showToast, settings }) {
  const [adminPw, setAdminPw] = useState({ current: '', new: '', confirm: '' });
  const [userCred, setUserCred] = useState({ username: '', password: '' });

  useEffect(() => { setUserCred(u => ({...u, username: settings.user_username || ''})); }, [settings]);

  const changeAdmin = async () => {
    if (adminPw.new !== adminPw.confirm) { showToast('Yeni şifreler eşleşmiyor'); return; }
    if (adminPw.new.length < 4) { showToast('Şifre en az 4 karakter olmalı'); return; }
    try {
      const data = await api('/auth/change-admin-password', { method: 'POST', body: JSON.stringify({ current_password: adminPw.current, new_password: adminPw.new }) });
      localStorage.setItem('token', data.token);
      setAdminPw({ current: '', new: '', confirm: '' });
      showToast('Admin şifresi güncellendi');
    } catch (err) { showToast(err.message); }
  };

  const updateUser = async () => {
    if (!userCred.username || !userCred.password) { showToast('Kullanıcı adı ve şifre boş olamaz'); return; }
    try {
      await api('/auth/update-user-credentials', { method: 'POST', body: JSON.stringify(userCred) });
      showToast('Kullanıcı bilgileri güncellendi');
    } catch (err) { showToast(err.message); }
  };

  return (
    <div className="security-panel">
      <h3>Güvenlik Ayarları</h3>
      <div className="card">
        <h4>Admin Şifresi Değiştir</h4>
        <div className="form-group"><label>Mevcut Şifre</label><input type="password" value={adminPw.current} onChange={e => setAdminPw({...adminPw, current: e.target.value})}/></div>
        <div className="form-group"><label>Yeni Şifre</label><input type="password" value={adminPw.new} onChange={e => setAdminPw({...adminPw, new: e.target.value})}/></div>
        <div className="form-group"><label>Yeni Şifre (Tekrar)</label><input type="password" value={adminPw.confirm} onChange={e => setAdminPw({...adminPw, confirm: e.target.value})}/></div>
        <button className="btn-primary" onClick={changeAdmin}>Şifreyi Güncelle</button>
      </div>
      <div className="card" style={{marginTop: '1.5rem'}}>
        <h4>Kullanıcı Giriş Bilgileri</h4>
        <p className="hint-text">Denetçilerin sisteme girmek için kullanacağı ortak kullanıcı adı ve şifre</p>
        <div className="form-group"><label>Kullanıcı Adı</label><input value={userCred.username} onChange={e => setUserCred({...userCred, username: e.target.value})}/></div>
        <div className="form-group"><label>Şifre</label><input type="password" value={userCred.password} onChange={e => setUserCred({...userCred, password: e.target.value})} placeholder="Yeni şifre belirleyin"/></div>
        <button className="btn-primary" onClick={updateUser}>Kullanıcı Bilgilerini Güncelle</button>
      </div>
    </div>
  );
}

// ─── Main App ───────────────────────────────────────────────
function App() {
  const [role, setRole] = useState(localStorage.getItem('role'));
  const [token, setToken] = useState(localStorage.getItem('token'));

  const login = (newRole) => {
    setRole(newRole);
    setToken(localStorage.getItem('token'));
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setRole(null);
    setToken(null);
  };

  if (!token || !role) return <LoginPage onLogin={login} />;

  return (
    <AuthContext.Provider value={{ role, token, logout }}>
      <CalendarPage />
    </AuthContext.Provider>
  );
}

export default App;
