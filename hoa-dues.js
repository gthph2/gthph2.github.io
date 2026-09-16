/* =========================================
   HOA DUES STATUS - PHASE 2
   Data source: Google Sheets via Apps Script API
   ========================================= */

document.addEventListener("DOMContentLoaded", function () {

    /* =========================================
       CONFIGURATION
       ========================================= */

    // Google Apps Script API - live HOA dues source
    const HOA_DUES_API =
        "https://script.google.com/macros/s/AKfycbwVYPvC1Qh_qsO9EzNrEGAzzjc0dClemol-bw6PKUphiwKZhGSEZ0PjT0eECfGgoX1-/exec";


    /* =========================================
       HTML ELEMENTS
       ========================================= */

    const openDuesModal =
        document.getElementById("openDuesModal");

    const closeDuesModal =
        document.getElementById("closeDuesModal");

    const duesModal =
        document.getElementById("duesModal");

    const duesModalOverlay =
        document.getElementById("duesModalOverlay");

    const duesForm =
        document.getElementById("duesForm");

    const duesResult =
        document.getElementById("duesResult");


    /* =========================================
       SAFETY CHECK
       ========================================= */

    if (
        !openDuesModal ||
        !duesModal ||
        !duesForm ||
        !duesResult
    ) {

        console.error(
            "HOA Dues: Required HTML elements were not found."
        );

        return;
    }


    /* =========================================
       HELPERS
       ========================================= */

    function escapeHtml(value) {

        const div =
            document.createElement("div");

        div.textContent =
            value == null ? "" : String(value);

        return div.innerHTML;
    }


    function normalize(value) {

        return String(value || "")
            .trim()
            .toLowerCase()
            .replace(/\s+/g, " ");
    }


    function formatCurrency(value) {

        const amount =
            Number(value) || 0;

        return amount.toLocaleString(
            "en-PH",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }
        );
    }


    /* =========================================
       LOOKUP HOMEOWNER VIA API
       ========================================= */

    function lookupHomeowner(surname, homeownerCode) {

        const normalizedSurname =
            normalize(surname);

        const normalizedCode =
            normalize(homeownerCode);


        const url =
            HOA_DUES_API +
            "?surname=" +
            encodeURIComponent(normalizedSurname) +
            "&code=" +
            encodeURIComponent(normalizedCode);


        console.log(
            "HOA Dues API request:",
            url
        );


        return fetch(
            url,
            {
                cache: "no-cache"
            }
        )

        .then(function (response) {

            console.log(
                "HOA Dues API response:",
                response.status,
                response.ok
            );


            if (!response.ok) {

                throw new Error(
                    "HOA Dues API request failed. HTTP status: " +
                    response.status
                );
            }


            return response.json();
        })


        .then(function (data) {

            console.log(
                "HOA Dues API data:",
                data
            );


            if (!data || data.success !== true) {

                return null;
            }


            if (!data.record) {

                return null;
            }


            return data.record;
        });
    }


    /* =========================================
       GET PAID THROUGH
       ========================================= */

    function getPaidThroughLabel(record) {

        if (!record.paidThrough) {

            return "No payments recorded";
        }


        const month =
            record.paidThrough.month || "";

        const year =
            record.paidThrough.year || "";


        if (!month && !year) {

            return "No payments recorded";
        }


        return (
            month +
            (year ? " " + year : "")
        );
    }


    /* =========================================
       GET MONTHLY PAYMENT STATUS
       ========================================= */

    function getMonthlyStatus(record) {

        const months = [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December"
        ];


        /*
         * 2026 monthly status is based directly
         * on the January-December payment values
         * returned by the API.
         *
         * paidThrough is NOT used to override
         * the individual 2026 monthly values.
         */

        return months.map(function (month) {

            const value =
                Number(
                    record.payments2026 &&
                    record.payments2026[month]
                ) || 0;


            return {
                name: month,
                paid: value > 0,
                amount: value
            };

        });
    }


    /* =========================================
       AUTHORITATIVE TOTAL PAID
       ========================================= */

    function getAuthoritativeTotalPaid2026(record) {

        const months =
            getMonthlyStatus(record);


        return months.reduce(
            function (total, month) {

                return total +
                    (month.paid ? 300 : 0);

            },
            0
        );
    }


    /* =========================================
       DETERMINE STATUS
       ========================================= */

    function getStatus(record) {

        /*
         * Non-residential records
         */

        if (
            record.residential === false
        ) {

            return "non-residential";
        }


        const outstanding =
            Number(
                record.outstanding2026
            ) || 0;


        /*
         * Outstanding 2026 dues
         */

        if (
            outstanding > 0
        ) {

            return "outstanding";
        }


        /*
         * Paid ahead beyond 2026
         */

        if (
            record.paidThrough &&
            Number(record.paidThrough.year) > 2026
        ) {

            return "paid-ahead";
        }


        /*
         * Fully paid 2026
         */

        return "paid";
    }


    /* =========================================
       RESULT HEADER
       ========================================= */

    function renderHeader(
        record,
        status
    ) {

        let icon = "✓";

        let title =
            "HOA DUES STATUS";


        if (
            status === "outstanding"
        ) {

            icon = "!";
        }


        if (
            status === "paid-ahead"
        ) {

            title = "PAID AHEAD";
        }


        if (
            status === "non-residential"
        ) {

            icon = "i";

            title =
                "ACCOUNT INFORMATION";
        }


        return `

            <div class="dues-result-heading">

                <span class="dues-result-icon">
                    ${icon}
                </span>

                <strong>
                    ${title}
                </strong>

            </div>


            <div class="dues-result-name">

                ${escapeHtml(
                    record.name ||
                    record.surname ||
                    ""
                )}

            </div>


            <div class="dues-result-property">

                ${
                    record.block
                        ? "Block " +
                          escapeHtml(record.block)
                        : ""
                }

                ${
                    record.lot
                        ? " • Lot " +
                          escapeHtml(record.lot)
                        : ""
                }

                ${
                    record.street
                        ? " • " +
                          escapeHtml(record.street)
                        : ""
                }

            </div>

        `;
    }


    /* =========================================
       MONTHLY GRID
       ========================================= */

    function renderMonthlyGrid(record) {

        const months =
            getMonthlyStatus(record);


        return `

            <div class="dues-month-grid">

                ${months.map(function (month) {

                    return `

                        <div class="dues-month ${
                            month.paid
                                ? "is-paid"
                                : "is-unpaid"
                        }">

                            <span
                                class="dues-month-name"
                            >
                                ${escapeHtml(
                                    month.name
                                        .slice(0, 3)
                                        .toUpperCase()
                                )}
                            </span>

                            <strong>
                                ${
                                    month.paid
                                        ? "✓"
                                        : "—"
                                }
                            </strong>

                        </div>

                    `;

                }).join("")}

            </div>

        `;
    }


    /* =========================================
       RESULT DISPLAY
       ========================================= */

    function renderResult(record) {

        const status =
            getStatus(record);


        /*
         * NON-RESIDENTIAL
         */

        if (
            status === "non-residential"
        ) {

            duesResult.className =
                "dues-result info";


            duesResult.innerHTML = `

                ${renderHeader(
                    record,
                    status
                )}


                <div class="dues-info-box">

                    <strong>
                        No residential HOA dues recorded.
                    </strong>

                    <p>
                        This account is classified as
                        commercial, vacant, common-area,
                        or administrative in the HOA records.
                    </p>

                </div>


                <p class="dues-result-note">

                    If you believe this information is
                    incorrect, please contact the HOA
                    administration.

                </p>

            `;


            duesResult.hidden = false;

            return;
        }


        const outstanding =
            Number(
                record.outstanding2026
            ) || 0;


        const previousBalance =
            Number(
                record.previousBalance
            ) || 0;


        /*
         * Calculate total paid from the actual
         * January-December 2026 payment values.
         */

        const totalPaid2026 =
            getAuthoritativeTotalPaid2026(
                record
            );


        let statusContent = "";


        /* =====================================
           OUTSTANDING
           ===================================== */

        if (
            status === "outstanding"
        ) {

            const months =
                getMonthlyStatus(record);


            const unpaidMonths =
                months.filter(function (month) {

                    return !month.paid;

                });


            statusContent = `

                <div
                    class="dues-status-banner warning"
                >

                    <span>
                        2026 STATUS
                    </span>

                    <strong>
                        OUTSTANDING
                    </strong>

                </div>


                <div
                    class="dues-summary-grid"
                >

                    <div>

                        <span>
                            Paid Through
                        </span>

                        <strong>
                            ${escapeHtml(
                                getPaidThroughLabel(
                                    record
                                )
                            )}
                        </strong>

                    </div>


                    <div>

                        <span>
                            Outstanding 2026 Dues
                        </span>

                        <strong>
                            ₱${formatCurrency(
                                outstanding
                            )}
                        </strong>

                    </div>


                    <div>

                        <span>
                            Months Outstanding
                        </span>

                        <strong>
                            ${unpaidMonths.length}
                        </strong>

                    </div>

                </div>


                ${renderMonthlyGrid(record)}

            `;
        }


        /* =====================================
           PAID AHEAD
           ===================================== */

        else if (
            status === "paid-ahead"
        ) {

            statusContent = `

                <div
                    class="dues-status-banner success"
                >

                    <span>
                        2026 STATUS
                    </span>

                    <strong>
                        PAID AHEAD
                    </strong>

                </div>


                <div class="dues-paid-ahead">

                    <strong>
                        ✓ Paid through
                        ${escapeHtml(
                            getPaidThroughLabel(
                                record
                            )
                        )}
                    </strong>

                    <p>
                        Your 2026 HOA dues are fully paid,
                        with advance payment recorded through
                        ${escapeHtml(
                            getPaidThroughLabel(record)
                        )}.
                    </p>

                </div>


                ${renderMonthlyGrid(record)}

            `;
        }


        /* =====================================
           FULLY PAID
           ===================================== */

        else {

            statusContent = `

                <div
                    class="dues-status-banner success"
                >

                    <span>
                        2026 STATUS
                    </span>

                    <strong>
                        2026 DUES FULLY PAID
                    </strong>

                </div>


                ${renderMonthlyGrid(record)}

            `;
        }


        /* =====================================
           RESULT
           ===================================== */

        duesResult.className =
            "dues-result " +
            (
                status === "outstanding"
                    ? "warning"
                    : "success"
            );


        duesResult.innerHTML = `

            ${renderHeader(
                record,
                status
            )}


            ${statusContent}


            <div
                class="dues-financial-summary"
            >

                <div>

                    <span>
                        Outstanding 2026 Dues
                    </span>

                    <strong>
                        ₱${formatCurrency(
                            outstanding
                        )}
                    </strong>

                </div>


                ${
                    previousBalance > 0

                        ? `

                            <div>

                                <span>
                                    Previous Balance
                                </span>

                                <strong>
                                    ₱${formatCurrency(
                                        previousBalance
                                    )}
                                </strong>

                            </div>


                            <div
                                class="dues-total-balance"
                            >

                                <span>
                                    Total Account Balance
                                </span>

                                <strong>
                                    ₱${formatCurrency(
                                        outstanding +
                                        previousBalance
                                    )}
                                </strong>

                            </div>

                          `

                        : ""
                }


                <div>

                    <span>
                        Total Paid in 2026
                    </span>

                    <strong>
                        ₱${formatCurrency(
                            totalPaid2026
                        )}
                    </strong>

                </div>

            </div>


            ${
                record.originalRemarks

                    ? `

                        <p
                            class="dues-result-note"
                        >
                            ${escapeHtml(
                                record.originalRemarks
                            )}
                        </p>

                      `

                    : ""
            }

        `;


        duesResult.hidden = false;
    }


    /* =========================================
       ERROR MESSAGE
       ========================================= */

    function showMessage(
        message,
        type
    ) {

        duesResult.className =
            "dues-result " +
            (type || "info");


        duesResult.innerHTML = `

            <div class="dues-result-message">

                ${escapeHtml(message)}

            </div>

        `;


        duesResult.hidden = false;
    }


    /* =========================================
       OPEN MODAL
       ========================================= */

    openDuesModal.addEventListener(
        "click",
        function () {

            duesModal.classList.add(
                "is-open"
            );


            duesModal.setAttribute(
                "aria-hidden",
                "false"
            );


            setTimeout(function () {

                const input =
                    document.getElementById(
                        "duesSurname"
                    );


                if (input) {

                    input.focus();

                }

            }, 100);

        }
    );


    /* =========================================
       CLOSE MODAL
       ========================================= */

    function closeModal() {

        duesModal.classList.remove(
            "is-open"
        );


        duesModal.setAttribute(
            "aria-hidden",
            "true"
        );


        duesForm.reset();


        duesResult.hidden = true;

        duesResult.innerHTML = "";
    }


    if (closeDuesModal) {

        closeDuesModal.addEventListener(
            "click",
            closeModal
        );
    }


    if (duesModalOverlay) {

        duesModalOverlay.addEventListener(
            "click",
            closeModal
        );
    }


    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Escape" &&
                duesModal.classList.contains(
                    "is-open"
                )
            ) {

                closeModal();

            }

        }
    );


    /* =========================================
       FORM SUBMISSION
       ========================================= */

    duesForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            const surnameInput =
                document.getElementById(
                    "duesSurname"
                );


            const codeInput =
                document.getElementById(
                    "duesCode"
                );


            const surname =
                surnameInput
                    ? surnameInput.value.trim()
                    : "";


            const code =
                codeInput
                    ? codeInput.value.trim()
                    : "";


            /* ================================
               VALIDATION
               ================================ */

            if (
                !surname ||
                !code
            ) {

                showMessage(
                    "Please enter your surname and homeowner code.",
                    "warning"
                );

                return;
            }


            /* ================================
               LOADING
               ================================ */

            duesResult.className =
                "dues-result loading";


            duesResult.innerHTML = `

                <div
                    class="dues-result-message"
                >
                    Checking your HOA dues...
                </div>

            `;


            duesResult.hidden = false;


            /* ================================
               API LOOKUP
               ================================ */

            lookupHomeowner(
                surname,
                code
            )

            .then(function (record) {

                if (!record) {

                    showMessage(
                        "No matching homeowner record was found. Please check your surname and homeowner code.",
                        "warning"
                    );

                    return;
                }


                console.log(
                    "HOA homeowner found:",
                    record
                );


                renderResult(record);

            })


            .catch(function (error) {

                console.error(
                    "HOA dues error:",
                    error
                );


                showMessage(
                    "We're unable to retrieve HOA dues information right now. Please try again later.",
                    "warning"
                );

            });

        }
    );

});