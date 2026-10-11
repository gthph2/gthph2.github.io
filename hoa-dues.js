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


    const MONTHLY_DUES = 300;
    const MONTHS = {
        JAN: 0, JANUARY: 0, FEB: 1, FEBRUARY: 1, MAR: 2, MARCH: 2,
        APR: 3, APRIL: 3, MAY: 4, JUN: 5, JUNE: 5, JUL: 6, JULY: 6,
        AUG: 7, AUGUST: 7, SEP: 8, SEPT: 8, SEPTEMBER: 8,
        OCT: 9, OCTOBER: 9, NOV: 10, NOVEMBER: 10, DEC: 11, DECEMBER: 11
    };

    function parsePeriodEndpoint(text, fallbackYear) {
        const value = String(text || "").toUpperCase().replace(/[’]/g, "'").trim();
        const monthMatch = value.match(/\b(JANUARY|JAN|FEBRUARY|FEB|MARCH|MAR|APRIL|APR|MAY|JUNE|JUN|JULY|JUL|AUGUST|AUG|SEPTEMBER|SEPT|SEP|OCTOBER|OCT|NOVEMBER|NOV|DECEMBER|DEC)\b/);
        const yearMatch = value.match(/(?:'\s*|\b)(\d{2,4})\b/);
        if (!monthMatch) {
            if (yearMatch) {
                let year = Number(yearMatch[1]);
                if (year < 100) year += year >= 70 ? 1900 : 2000;
                return { year: year, month: null, yearOnly: true };
            }
            return null;
        }
        let year = yearMatch ? Number(yearMatch[1]) : fallbackYear;
        if (year == null) return { year: null, month: MONTHS[monthMatch[1]], yearOnly: false };
        if (year < 100) year += year >= 70 ? 1900 : 2000;
        return { year: year, month: MONTHS[monthMatch[1]], yearOnly: false };
    }

    function countMonthsInPeriod(periodText) {
        const current = new Date();
        const currentYear = current.getFullYear();
        const currentMonth = current.getMonth();
        const text = String(periodText || "").toUpperCase().replace(/[’]/g, "'").trim();
        if (!text) return null;

        // Split only on a range separator. A single month represents one unpaid month.
        const parts = text.split(/\s+(?:-|–|—|TO)\s+/i).map(function (part) { return part.trim(); });
        if (parts.length === 1) {
            const one = parsePeriodEndpoint(parts[0], currentYear);
            if (!one || one.month == null || one.year == null) return null;
            return 1;
        }
        if (parts.length !== 2) return null;

        const leftRaw = parts[0];
        const rightRaw = parts[1];
        let left = parsePeriodEndpoint(leftRaw, null);
        let right = parsePeriodEndpoint(rightRaw, null);
        if (!left || !right) return null;

        // A range such as "JANUARY - SEPTEMBER '26" means January through September 2026.
        if (left.year == null && left.month != null && right.year != null) left.year = right.year;
        if (right.year == null && right.month != null && left.year != null) right.year = left.year;
        // A year-only end (e.g. "JAN 2020 - 2023") means through the current month.
        if (right.yearOnly && left.month != null && left.year != null) {
            right = { year: currentYear, month: currentMonth, yearOnly: false };
        }
        if (left.yearOnly && right.month != null && right.year != null) {
            left = { year: left.year, month: 0, yearOnly: false };
        }
        if (left.month == null || right.month == null || left.year == null || right.year == null) return null;

        const startIndex = left.year * 12 + left.month;
        const endIndex = right.year * 12 + right.month;
        if (endIndex < startIndex) return null;
        return endIndex - startIndex + 1;
    }

    function calculateUnpaidMonths(record) {
        if (!Array.isArray(record.unpaidPeriods) || !record.unpaidPeriods.length) return null;
        let total = 0;
        for (const period of record.unpaidPeriods) {
            const count = countMonthsInPeriod(period);
            if (count == null) return null;
            total += count;
        }
        return total;
    }

    // Historical balances involving any period before January 2026 require
    // manual HOA verification instead of presenting an automatically calculated amount.
    function periodStartsBeforeJanuary2026(periodText) {
        const text = String(periodText || "").toUpperCase().replace(/[’]/g, "'").trim();
        if (!text) return false;

        const parts = text.split(/\s+(?:-|–|—|TO)\s+/i).map(function (part) { return part.trim(); });
        let start = parsePeriodEndpoint(parts[0], null);
        if (!start) return false;

        if (parts.length > 1) {
            const end = parsePeriodEndpoint(parts[parts.length - 1], null);
            if (start.year == null && start.month != null && end && end.year != null) {
                start.year = end.year;
            }
        }

        return start.year != null && start.year < 2026;
    }

    function requiresHistoricalBalanceVerification(record, statusType) {
        const balanceStatuses = ["balance_and_unpaid", "balance_only", "unpaid_period"];
        if (!balanceStatuses.includes(statusType)) return false;

        const hasPreviousBalance = record.balanceAmountKnown === true && Number(record.previousBalance) > 0;
        const hasPre2026UnpaidPeriod = Array.isArray(record.unpaidPeriods) &&
            record.unpaidPeriods.some(periodStartsBeforeJanuary2026);

        return hasPreviousBalance || hasPre2026UnpaidPeriod;
    }

    function renderUnpaidAmount(record) {
        const months = calculateUnpaidMonths(record);
        if (months == null || months < 1) {
            return `
                <div class="dues-amount-due-card dues-amount-due-unknown">
                    <span class="dues-detail-label">AMOUNT DUE</span>
                    <strong class="dues-amount-due-value">For HOA confirmation</strong>
                    <p>The unpaid period is recorded, but the dates could not be calculated reliably. Please contact the HOA to confirm the amount due.</p>
                </div>
            `;
        }
        const amount = months * MONTHLY_DUES;
        return `
            <div class="dues-amount-due-card">
                <span class="dues-detail-label">DUES FOR UNPAID PERIOD</span>
                <strong class="dues-amount-due-value">₱${formatCurrency(amount)}</strong>
                <div class="dues-amount-due-calculation">₱${formatCurrency(MONTHLY_DUES)} / month × ${months} ${months === 1 ? "month" : "months"}</div>
                <p>Calculated from the unpaid period recorded in the original HOA remarks. Any previous unpaid balance is shown separately and is not included in this amount.</p>
            </div>
        `;
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
            <div class="dues-account-heading">
                <div class="dues-account-kicker">
                    <span class="dues-account-kicker-icon" aria-hidden="true">${escapeHtml(icon || "i")}</span>
                    <span>GTH PHASE 2 · HOA ACCOUNT</span>
                </div>
                <div class="dues-account-name">${escapeHtml(record.name || record.surname || "")}</div>
                ${propertyParts.length
                    ? `<div class="dues-account-property">${propertyParts.join(" • ")}</div>`
                    : ""}
                <div class="dues-status-chip">${escapeHtml(statusLabel || "HOA DUES STATUS")}</div>
            </div>
        `;
    }

    function renderList(title, items, className) {
        if (!Array.isArray(items) || !items.length) return "";
        return `
            <section class="dues-detail-section ${className || ""}">
                <div class="dues-section-label">${escapeHtml(title)}</div>
                <ul>${items.map(function (item) {
                    return `<li>${escapeHtml(item)}</li>`;
                }).join("")}</ul>
            </section>
        `;
    }

    function renderOriginalRemarks(record) {
        if (!record.originalRemarks) return "";
        return `
            <details class="dues-original-remarks">
                <summary>View original HOA remarks</summary>
                <p>${escapeHtml(record.originalRemarks)}</p>
            </details>
        `;
    }

    function renderUpdateDisclaimer() {
        return `
            <div class="dues-note-card dues-update-disclaimer" role="note">
                <span class="dues-note-icon" aria-hidden="true">i</span>
                <div>
                    <strong>Important note about update timing</strong>
                    <p>Due to current administrative capacity, HOA dues records are updated at the end of each month. Recent payments or adjustments may not yet be reflected. For the latest confirmation, please contact the HOA Administration.</p>
                </div>
            </div>
        `;
    }

    function renderResult(record) {
        const statusType = String(record.statusType || "verification");
        const statusLabel = record.statusLabel || "HOA VERIFICATION REQUIRED";
        const paidLabel = paidThroughLabel(record);

        // Historical balances before January 2026 are routed to manual verification.
        // Keep the original remarks visible, but do not show an automated dues total.
        if (requiresHistoricalBalanceVerification(record, statusType)) {
            duesResult.className = "dues-result info";
            duesResult.innerHTML = `
                ${renderHeader(record, "HOA VERIFICATION REQUIRED", "i")}
                <div class="dues-result-body">
                    <div class="dues-message-card">
                        <strong>HOA verification is required for historical balances.</strong>
                        <p>Your recorded unpaid balance includes a period before January 2026. To avoid showing an unverified amount, please contact the HOA Administration to confirm your account balance.</p>
                    </div>
                    ${renderOriginalRemarks(record)}
                    <div class="dues-contact-footer">For questions or corrections, please contact the HOA Administration.</div>
                    ${renderUpdateDisclaimer()}
                </div>
            `;
            duesResult.hidden = false;
            return;
        }

        if (statusType === "verification" ||
            (record.needsVerification && !record.balanceAmountKnown && !record.originalRemarks)) {
            duesResult.className = "dues-result info";
            duesResult.innerHTML = `
                ${renderHeader(record, "HOA VERIFICATION REQUIRED", "i")}
                <div class="dues-result-body">
                    <div class="dues-message-card">
                        <strong>Payment status requires HOA verification.</strong>
                        <p>The available remarks do not provide enough reliable information to determine your payment status. Please contact the HOA administration.</p>
                    </div>
                    ${renderOriginalRemarks(record)}
                    ${renderUpdateDisclaimer()}
                </div>
            `;
            duesResult.hidden = false;
            return;
        }

        if (statusType === "balance_and_unpaid" || statusType === "balance_only") {
            duesResult.className = "dues-result warning";
            let balanceHtml = "";

            if (record.balanceAmountKnown) {
                balanceHtml = `
                    <div class="dues-balance-card">
                        <span class="dues-detail-label">PREVIOUS UNPAID BALANCE</span>
                        <strong class="dues-balance-amount">₱${formatCurrency(record.previousBalance)}</strong>
                        <span class="dues-detail-caption">Amount recorded in the original HOA remarks</span>
                    </div>
                `;
            } else {
                balanceHtml = `
                    <div class="dues-message-card">
                        <strong>Previous balance recorded; amount needs confirmation.</strong>
                        <p>Please contact the HOA to confirm the amount. No amount has been estimated.</p>
                    </div>
                `;
            }

            const hasUnpaidPeriods = Array.isArray(record.unpaidPeriods) && record.unpaidPeriods.length > 0;

            duesResult.innerHTML = `
                ${renderHeader(record, statusLabel, "!")}
                <div class="dues-result-body">
                    ${balanceHtml}
                    ${renderList("UNPAID PERIOD / MONTHS", record.unpaidPeriods, "dues-unpaid-periods")}
                    ${hasUnpaidPeriods ? renderUnpaidAmount(record) : ""}
                    ${record.needsVerification ? `<p class="dues-result-contact">Please ask the HOA to verify the balance amount.</p>` : ""}
                    ${renderOriginalRemarks(record)}
                    <div class="dues-contact-footer">For questions or corrections, please contact the HOA Administration.</div>
                    ${renderUpdateDisclaimer()}
                </div>
            `;
            duesResult.hidden = false;
            return;
        }

        if (statusType === "paid_with_free_months") {
            duesResult.className = "dues-result success";
            duesResult.innerHTML = `
                ${renderHeader(record, statusLabel || "PAID THROUGH + ELECOM FREE MONTHS", "✓")}
                <div class="dues-result-body">
                    ${paidLabel ? `<div class="dues-paid-card"><span class="dues-detail-label">PAID THROUGH</span><strong>${escapeHtml(paidLabel)}</strong></div>` : ""}
                    ${renderList("FREE DUES PERIOD · ELECOM SERVICE", record.freePeriods, "dues-free-periods")}
                    <div class="dues-note-card">
                        <span class="dues-note-icon" aria-hidden="true">i</span>
                        <div><strong>ELECOM benefit recorded</strong><p>The period shown above is marked as free in the HOA remarks and is not treated as unpaid dues.</p></div>
                    </div>
                    ${renderOriginalRemarks(record)}
                    ${renderUpdateDisclaimer()}
                </div>
            `;
            duesResult.hidden = false;
            return;
        }

        if (statusType === "paid_ahead" || statusType === "paid_through") {
            duesResult.className = "dues-result success";
            duesResult.innerHTML = `
                ${renderHeader(record, statusLabel, "✓")}
                <div class="dues-result-body">
                    <div class="dues-paid-card">
                        <span class="dues-detail-label">PAID THROUGH</span>
                        <strong>${escapeHtml(paidLabel || "Date recorded by the HOA")}</strong>
                        <p>${escapeHtml(record.statusMessage || "Based on the Original Remarks recorded by the HOA.")}</p>
                    </div>
                    ${renderOriginalRemarks(record)}
                    <div class="dues-contact-footer">If you believe this information is incorrect, please contact the HOA Administration.</div>
                    ${renderUpdateDisclaimer()}
                </div>
            `;
            duesResult.hidden = false;
            return;
        }

        if (statusType === "unpaid_period") {
            duesResult.className = "dues-result warning";
            duesResult.innerHTML = `
                ${renderHeader(record, statusLabel || "UNPAID PERIOD RECORDED", "!")}
                <div class="dues-result-body">
                    ${paidLabel ? `<div class="dues-paid-card"><span class="dues-detail-label">PAID THROUGH</span><strong>${escapeHtml(paidLabel)}</strong></div>` : ""}
                    ${renderList("UNPAID PERIOD / MONTHS", record.unpaidPeriods, "dues-unpaid-periods")}
                    ${renderUnpaidAmount(record)}
                    ${renderOriginalRemarks(record)}
                    <div class="dues-contact-footer">For questions or corrections, please contact the HOA Administration.</div>
                    ${renderUpdateDisclaimer()}
                </div>
            `;
            duesResult.hidden = false;
            return;
        }

        // Safe fallback for any unrecognized status returned by the API.
        duesResult.className = "dues-result info";
        duesResult.innerHTML = `
            ${renderHeader(record, "HOA VERIFICATION REQUIRED", "i")}
            <div class="dues-result-body">
                <div class="dues-message-card">
                    <strong>Payment status requires HOA verification.</strong>
                    <p>Please contact the HOA administration to confirm your account status.</p>
                </div>
                ${renderOriginalRemarks(record)}
                ${renderUpdateDisclaimer()}
            </div>
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
