/* =========================================
   HOA DUES STATUS - PHASE 2
   Source of truth: Original Remarks in Google Sheets
   ========================================= */

document.addEventListener("DOMContentLoaded", function () {
    const HOA_DUES_API =
        "https://script.google.com/macros/s/AKfycbwVYPvC1Qh_qsO9EzNrEGAzzjc0dClemol-bw6PKUphiwKZhGSEZ0PjT0eECfGgoX1-/exec";

    const openDuesModal = document.getElementById("openDuesModal");
    const closeDuesModal = document.getElementById("closeDuesModal");
    const duesModal = document.getElementById("duesModal");
    const duesModalOverlay = document.getElementById("duesModalOverlay");
    const duesForm = document.getElementById("duesForm");
    const duesResult = document.getElementById("duesResult");

    if (!openDuesModal || !duesModal || !duesForm || !duesResult) {
        console.error("HOA Dues: Required HTML elements were not found.");
        return;
    }

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value == null ? "" : String(value);
        return div.innerHTML;
    }

    function normalize(value) {
        return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    }

    function formatCurrency(value) {
        return (Number(value) || 0).toLocaleString("en-PH", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    }

    function lookupHomeowner(surname, homeownerCode) {
        const url = HOA_DUES_API +
            "?surname=" + encodeURIComponent(normalize(surname)) +
            "&code=" + encodeURIComponent(normalize(homeownerCode));

        return fetch(url, { cache: "no-cache" })
            .then(function (response) {
                if (!response.ok) throw new Error("HOA Dues API request failed.");
                return response.json();
            })
            .then(function (data) {
                if (!data || data.success !== true || !data.record) return null;
                return data.record;
            });
    }

    function paidThroughLabel(record) {
        if (!record.paidThrough || !record.paidThrough.month || !record.paidThrough.year) {
            return "";
        }
        return record.paidThrough.month + " " + record.paidThrough.year;
    }

    function renderHeader(record, statusLabel, icon) {
        const propertyParts = [];
        if (record.block) propertyParts.push("Block " + escapeHtml(record.block));
        if (record.lot) propertyParts.push("Lot " + escapeHtml(record.lot));
        if (record.street) propertyParts.push(escapeHtml(record.street));

        return `
            <div class="dues-result-heading">
                <span class="dues-result-icon">${escapeHtml(icon || "i")}</span>
                <strong>${escapeHtml(statusLabel || "HOA DUES STATUS")}</strong>
            </div>
            <div class="dues-result-name">${escapeHtml(record.name || record.surname || "")}</div>
            ${propertyParts.length
                ? `<div class="dues-result-property">${propertyParts.join(" • ")}</div>`
                : ""}
        `;
    }

    function renderList(title, items, className) {
        if (!Array.isArray(items) || !items.length) return "";
        return `
            <div class="dues-info-box ${className || ""}">
                <strong>${escapeHtml(title)}</strong>
                <ul>${items.map(function (item) {
                    return `<li>${escapeHtml(item)}</li>`;
                }).join("")}</ul>
            </div>
        `;
    }

    function renderResult(record) {
        const statusType = String(record.statusType || "verification");
        const statusLabel = record.statusLabel || "HOA VERIFICATION REQUIRED";
        const paidLabel = paidThroughLabel(record);

        if (statusType === "verification" || record.needsVerification && !record.balanceAmountKnown && !record.originalRemarks) {
            duesResult.className = "dues-result info";
            duesResult.innerHTML = `
                ${renderHeader(record, "HOA VERIFICATION REQUIRED", "i")}
                <div class="dues-info-box">
                    <strong>Payment status requires HOA verification.</strong>
                    <p>The current remarks do not provide enough reliable information to determine your payment status. Please contact the HOA administration.</p>
                </div>
                ${record.originalRemarks ? `<p class="dues-result-note">Original Remarks: ${escapeHtml(record.originalRemarks)}</p>` : ""}
            `;
            duesResult.hidden = false;
            return;
        }

        if (statusType === "balance_and_unpaid" || statusType === "balance_only") {
            duesResult.className = "dues-result warning";
            let balanceHtml = "";

            if (record.balanceAmountKnown) {
                balanceHtml = `
                    <div class="dues-financial-summary">
                        <div>
                            <span>Previous Unpaid Balance</span>
                            <strong>₱${formatCurrency(record.previousBalance)}</strong>
                        </div>
                    </div>
                `;
            } else {
                balanceHtml = `
                    <div class="dues-info-box">
                        <strong>Previous balance recorded, but the amount needs verification.</strong>
                        <p>Please contact the HOA to confirm the amount. No amount has been estimated.</p>
                    </div>
                `;
            }

            duesResult.innerHTML = `
                ${renderHeader(record, statusLabel, "!")}
                <div class="dues-status-banner warning">
                    <span>ACCOUNT STATUS</span>
                    <strong>${escapeHtml(statusLabel)}</strong>
                </div>
                ${balanceHtml}
                ${renderList("Unpaid period(s) recorded", record.unpaidPeriods, "dues-unpaid-periods")}
                <div class="dues-info-box">
                    <p>${escapeHtml(record.statusMessage || "The remarks identify a previous balance.")}</p>
                    <p><strong>No combined total is shown.</strong> Unpaid periods are displayed separately because the monthly breakdown may not be current.</p>
                </div>
                ${record.needsVerification ? `<p class="dues-result-note">Please ask the HOA to verify the balance amount.</p>` : ""}
                ${record.originalRemarks ? `<p class="dues-result-note">Original Remarks: ${escapeHtml(record.originalRemarks)}</p>` : ""}
            `;
            duesResult.hidden = false;
            return;
        }

        if (statusType === "paid_with_free_months") {
            duesResult.className = "dues-result success";
            duesResult.innerHTML = `
                ${renderHeader(record, statusLabel, "✓")}
                <div class="dues-status-banner success">
                    <span>ACCOUNT STATUS</span>
                    <strong>PAID THROUGH + ELECOM FREE MONTHS</strong>
                </div>
                ${paidLabel ? `<div class="dues-info-box"><strong>Paid through ${escapeHtml(paidLabel)}</strong></div>` : ""}
                ${renderList("Free dues period(s) — ELECOM service", record.freePeriods, "dues-free-periods")}
                <div class="dues-info-box">
                    <p>These months are marked as free in the HOA remarks. They are not treated as unpaid dues.</p>
                </div>
                ${record.originalRemarks ? `<p class="dues-result-note">Original Remarks: ${escapeHtml(record.originalRemarks)}</p>` : ""}
            `;
            duesResult.hidden = false;
            return;
        }

        if (statusType === "paid_ahead" || statusType === "paid_through") {
            duesResult.className = "dues-result success";
            duesResult.innerHTML = `
                ${renderHeader(record, statusLabel, "✓")}
                <div class="dues-status-banner success">
                    <span>ACCOUNT STATUS</span>
                    <strong>${escapeHtml(statusLabel)}</strong>
                </div>
                <div class="dues-info-box">
                    <strong>Paid through ${escapeHtml(paidLabel || "the date recorded by the HOA")}</strong>
                    <p>${escapeHtml(record.statusMessage || "This status is based on the Original Remarks recorded by the HOA.")}</p>
                </div>
                ${record.originalRemarks ? `<p class="dues-result-note">Original Remarks: ${escapeHtml(record.originalRemarks)}</p>` : ""}
            `;
            duesResult.hidden = false;
            return;
        }

        if (statusType === "unpaid_period") {
            duesResult.className = "dues-result warning";
            duesResult.innerHTML = `
                ${renderHeader(record, statusLabel, "!")}
                <div class="dues-status-banner warning">
                    <span>ACCOUNT STATUS</span>
                    <strong>UNPAID PERIOD RECORDED</strong>
                </div>
                ${paidLabel ? `<div class="dues-info-box"><strong>Paid through ${escapeHtml(paidLabel)}</strong></div>` : ""}
                ${renderList("Unpaid period(s) recorded", record.unpaidPeriods, "dues-unpaid-periods")}
                <div class="dues-info-box">
                    <p>${escapeHtml(record.statusMessage || "The Original Remarks indicate an unpaid period.")}</p>
                    <p>No peso total is estimated from the monthly breakdown. Please contact the HOA for confirmation of the amount due.</p>
                </div>
                ${record.originalRemarks ? `<p class="dues-result-note">Original Remarks: ${escapeHtml(record.originalRemarks)}</p>` : ""}
            `;
            duesResult.hidden = false;
            return;
        }

        // Safe fallback for any unrecognized status returned by the API.
        duesResult.className = "dues-result info";
        duesResult.innerHTML = `
            ${renderHeader(record, "HOA VERIFICATION REQUIRED", "i")}
            <div class="dues-info-box">
                <strong>Payment status requires HOA verification.</strong>
                <p>Please contact the HOA administration to confirm your account status.</p>
            </div>
            ${record.originalRemarks ? `<p class="dues-result-note">Original Remarks: ${escapeHtml(record.originalRemarks)}</p>` : ""}
        `;
        duesResult.hidden = false;
    }

    function showMessage(message, type) {
        duesResult.className = "dues-result " + (type || "info");
        duesResult.innerHTML = `<div class="dues-result-message">${escapeHtml(message)}</div>`;
        duesResult.hidden = false;
    }

    openDuesModal.addEventListener("click", function () {
        duesModal.classList.add("is-open");
        duesModal.setAttribute("aria-hidden", "false");
        setTimeout(function () {
            const input = document.getElementById("duesSurname");
            if (input) input.focus();
        }, 100);
    });

    function closeModal() {
        duesModal.classList.remove("is-open");
        duesModal.setAttribute("aria-hidden", "true");
        duesForm.reset();
        duesResult.hidden = true;
        duesResult.innerHTML = "";
    }

    if (closeDuesModal) closeDuesModal.addEventListener("click", closeModal);
    if (duesModalOverlay) duesModalOverlay.addEventListener("click", closeModal);

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && duesModal.classList.contains("is-open")) {
            closeModal();
        }
    });

    duesForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const surnameInput = document.getElementById("duesSurname");
        const codeInput = document.getElementById("duesCode");
        const surname = surnameInput ? surnameInput.value.trim() : "";
        const code = codeInput ? codeInput.value.trim() : "";

        if (!surname || !code) {
            showMessage("Please enter your surname and homeowner code.", "warning");
            return;
        }

        duesResult.className = "dues-result loading";
        duesResult.innerHTML = `<div class="dues-result-message">Checking your HOA dues...</div>`;
        duesResult.hidden = false;

        lookupHomeowner(surname, code)
            .then(function (record) {
                if (!record) {
                    showMessage("No matching homeowner record was found. Please check your surname and homeowner code.", "warning");
                    return;
                }
                renderResult(record);
            })
            .catch(function () {
                showMessage("We're unable to retrieve HOA dues information right now. Please try again later.", "warning");
            });
    });
});
