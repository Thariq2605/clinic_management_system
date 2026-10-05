/* =========================================================
   CLINIXONE - SETTINGS MANAGEMENT
   ========================================================= */

document.addEventListener("DOMContentLoaded", async function () {
    await loadSettings();
    setupSettingsEvents();
    setupTabs();
});

function setupTabs() {
    const tabs = document.querySelectorAll(".settings-menu-item");
    const sections = document.querySelectorAll(".settings-section");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            sections.forEach(s => s.classList.remove("active"));

            tab.classList.add("active");
            const targetId = tab.dataset.section;
            const targetSec = document.getElementById(targetId);
            if (targetSec) targetSec.classList.add("active");
        });
    });
}

async function loadSettings() {
    try {
        const [settingsData, profileData] = await Promise.all([
            api.get("/api/admin/settings/"),
            api.get("/api/admin/me/").catch(err => {
                console.error("Failed to load profile data:", err);
                return null;
            })
        ]);
        
        // Populate Profile Info
        if (profileData) {
            const fullNameEl = document.getElementById("adminFullName");
            const usernameEl = document.getElementById("adminUsername");
            const roleEl = document.getElementById("adminRole");
            const emailEl = document.getElementById("adminEmail");
            const phoneEl = document.getElementById("adminPhone");
            
            if (fullNameEl) fullNameEl.value = profileData.full_name || "";
            if (usernameEl) usernameEl.value = profileData.username || "";
            if (roleEl) roleEl.value = profileData.role || "";
            if (emailEl) emailEl.value = profileData.email || "N/A";
            if (phoneEl) phoneEl.value = profileData.phone || "N/A";

            // Update Header Name
            const profileNameHeaders = document.querySelectorAll(".profile-name, .profile-info h4");
            profileNameHeaders.forEach(el => el.textContent = profileData.full_name || profileData.username);
            
            // Update Avatar Initial
            const initial = profileData.full_name ? profileData.full_name.charAt(0).toUpperCase() : profileData.username.charAt(0).toUpperCase();
            const avatars = document.querySelectorAll(".profile-avatar, .large-avatar");
            avatars.forEach(el => el.textContent = initial);
        }

        // Populate Clinic Info
        const nameEl = document.getElementById("clinicName");
        const emailEl = document.getElementById("clinicEmail");
        const phoneEl = document.getElementById("clinicPhone");
        const addressEl = document.getElementById("clinicAddress");
        const tzEl = document.getElementById("clinicTimezone");
        const currencyEl = document.getElementById("clinicCurrency");
        
        if (nameEl) nameEl.value = settingsData.clinic_name || "";
        if (emailEl) emailEl.value = settingsData.clinic_email || "";
        if (phoneEl) phoneEl.value = settingsData.clinic_phone || "";
        if (addressEl) addressEl.value = settingsData.clinic_address || "";
        if (tzEl) tzEl.value = settingsData.timezone || "";
        if (currencyEl) currencyEl.value = settingsData.currency || "";
        
        // Notifications
        const notifEmail = document.getElementById("notifEmail");
        const notifSys = document.getElementById("notifSys");
        
        if (notifEmail) notifEmail.checked = settingsData.enable_email_alerts || false;
        if (notifSys) notifSys.checked = settingsData.enable_notifications || false;
        
    } catch (err) {
        console.error("Failed to load settings:", err);
        showToast("Failed to load settings.", "error");
    }
}

function setupSettingsEvents() {
    const saveBtn = document.getElementById("saveBtn");
    const cancelBtn = document.getElementById("cancelBtn");
    const logoutBtn = document.getElementById("settingsLogoutBtn");
    
    if (saveBtn) {
        saveBtn.addEventListener("click", async function () {
            saveBtn.disabled = true;
            const originalText = saveBtn.textContent;
            saveBtn.textContent = "Saving...";
            
            try {
                const payload = {
                    clinic_name: document.getElementById("clinicName")?.value,
                    clinic_email: document.getElementById("clinicEmail")?.value,
                    clinic_phone: document.getElementById("clinicPhone")?.value,
                    clinic_address: document.getElementById("clinicAddress")?.value,
                    timezone: document.getElementById("clinicTimezone")?.value,
                    currency: document.getElementById("clinicCurrency")?.value,
                    enable_email_alerts: document.getElementById("notifEmail")?.checked,
                    enable_notifications: document.getElementById("notifSys")?.checked
                };
                
                await api.post("/api/admin/settings/", payload);
                showToast("Settings updated successfully", "success");
            } catch (err) {
                console.error("Settings save error:", err);
                showToast(err.message || "Failed to save settings", "error");
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = originalText;
            }
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener("click", async function () {
            await loadSettings();
            showToast("Settings restored to previous values", "info");
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {
            logout();
        });
    }
}
