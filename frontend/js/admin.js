/* =========================================================
   CLINIXONE - SHARED ADMIN SHELL LOGIC
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* =====================================================
       ACTIVE NAVIGATION ITEM HIGHLIGHTING
       ===================================================== */
    const currentPath = window.location.pathname;
    const currentPage = currentPath.substring(currentPath.lastIndexOf("/") + 1) || "admin_dashboard.html";

    const navItems = document.querySelectorAll(".sidebar-nav .nav-item");

    navItems.forEach(item => {
        const href = item.getAttribute("href");
        if (href === currentPage || (currentPage === "" && href === "admin_dashboard.html")) {
            item.classList.add("active");
        } else {
            item.classList.remove("active");
        }
    });

    /* =====================================================
       KEYBOARD SHORTCUT FOR SEARCH (Cmd+K / Ctrl+K)
       ===================================================== */
    const searchInput = document.querySelector(".search-box input");

    document.addEventListener("keydown", function (e) {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            if (searchInput) searchInput.focus();
        }
    });

    if (searchInput) {
        searchInput.addEventListener("keypress", function (e) {
            if (e.key === "Enter") {
                const query = this.value.trim();
                if (query) {
                    // If on list page, trigger local filter or redirect
                    const tableSearch = document.querySelector(".filter-input, .users-search input, .doctors-search input, .appointment-search input, .billing-search input, .medicine-search input, .department-search input, .specialization-search input, .lab-search input, .receptionist-search input");
                    if (tableSearch) {
                        tableSearch.value = query;
                        tableSearch.dispatchEvent(new Event("input"));
                    }
                }
            }
        });
    }

    /* =====================================================
       HEADER ACTIONS
       ===================================================== */
    const notificationBtn = document.querySelector(".notification-btn");
    if (notificationBtn) {
        notificationBtn.addEventListener("click", function () {
            showToast("System alerts: All clinic modules operational.", "info");
        });
    }

    const dateBtn = document.querySelector(".date-btn");
    if (dateBtn) {
        const today = new Date();
        const options = { month: "short", day: "numeric", year: "numeric" };
        dateBtn.textContent = `📅 ${today.toLocaleDateString("en-US", options)}`;
    }
});

/* =====================================================
   SHARED UTILITY FUNCTIONS
   ===================================================== */
window.escapeHtml = function(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};
function escapeHtml(str) {
    return window.escapeHtml(str);
}
