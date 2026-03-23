# 🌿 Toplantı Salonu Rezervasyon Sistemi

**T.C. Tarım ve Orman Bakanlığı - İç Denetim Başkanlığı**

Toplantı salonunun etkin ve düzenli kullanımı için geliştirilmiş web tabanlı rezervasyon sistemi.

## ✨ Özellikler

- 📅 **Günlük / Haftalık / Aylık** takvim görünümleri
- 🟢 **Anlık oda durumu** göstergesi (Boş / Dolu)
- 📋 **Dinamik alan yönetimi** - Admin panelinden rezervasyon formunu özelleştirin
- 🔒 **İki katmanlı güvenlik** - Admin ve kullanıcı girişi
- 📊 **İstatistikler** - Kullanım oranları ve yoğun saatler
- 📱 **Mobil uyumlu** - Telefon ve tabletten rahatça kullanım
- 🎨 **Kurumsal tasarım** - Bakanlık kimliğine uygun renk ve tema

## 🚀 Kurulum

### Docker ile (Önerilen)

```bash
docker-compose up -d
```

Uygulama `http://localhost:8000` adresinde çalışacaktır.

### Coolify ile Deploy

1. GitHub reposunu Coolify'a bağlayın
2. Build Pack olarak **Dockerfile** seçin
3. Port: `8000`
4. Volume: `/data` dizinini kalıcı olarak mount edin

## 🔐 Varsayılan Giriş Bilgileri

### Admin Paneli
- **Şifre:** `admin123` (ilk girişte değiştirin!)

### Kullanıcı Girişi
- **Kullanıcı Adı:** `denetci`
- **Şifre:** `denetim2024`

> ⚠️ Güvenliğiniz için ilk girişte hem admin hem kullanıcı şifrelerini değiştiriniz.

## ⚙️ Admin Paneli

Admin panelinden şunları yönetebilirsiniz:

- **Alan Yönetimi:** Rezervasyon formunda hangi bilgilerin isteneceğini belirleyin
- **Ayarlar:** Çalışma saatleri ve zaman dilimi süresini ayarlayın
- **Güvenlik:** Admin ve kullanıcı şifrelerini güncelleyin
- **Rezervasyonlar:** Tüm rezervasyonları görüntüleyin ve yönetin
- **İstatistikler:** Kullanım verilerini inceleyin

## 🛠 Teknolojiler

- **Backend:** Python FastAPI + SQLite
- **Frontend:** React
- **Deploy:** Docker
