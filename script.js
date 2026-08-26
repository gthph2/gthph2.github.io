document.addEventListener("DOMContentLoaded", function () {
    const menuToggle = document.getElementById("menuToggle");
    const mainNav = document.getElementById("mainNav");

    if (menuToggle && mainNav) {
        menuToggle.addEventListener("click", function () {
            mainNav.classList.toggle("active");
        });

        mainNav.querySelectorAll("a").forEach(function (link) {
            link.addEventListener("click", function () {
                mainNav.classList.remove("active");
            });
        });
    }

    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
        link.addEventListener("click", function (event) {
            const targetId = this.getAttribute("href");
            if (!targetId || targetId === "#") return;

            const target = document.querySelector(targetId);
            if (target) {
                event.preventDefault();
                target.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        });
    });
});


// Floating important announcement: starts expanded on every page load.
document.addEventListener("DOMContentLoaded", function(){
 const expanded=document.getElementById("floatingAnnouncementExpanded");
 const collapsed=document.getElementById("floatingCollapsed");
 const close=document.getElementById("floatingClose");
 if(expanded&&collapsed&&close){
   expanded.style.display="block"; collapsed.style.display="none";
   close.addEventListener("click",function(){expanded.style.display="none";collapsed.style.display="flex";});
   collapsed.addEventListener("click",function(){expanded.style.display="block";collapsed.style.display="none";});
 }
});
/* =========================================
   FAQ SECTION
   Data source: faq.json
   ========================================= */

document.addEventListener("DOMContentLoaded", function () {
    const faqList = document.getElementById("faq-list");
    const faqCategories = document.getElementById("faq-categories");
    const faqSearch = document.getElementById("faq-search");
    const faqClear = document.getElementById("faq-clear");
    const faqEmpty = document.getElementById("faq-empty");

    if (!faqList || !faqCategories || !faqSearch || !faqClear || !faqEmpty) {
        return;
    }

    let faqData = [];
    let activeCategory = "All";
    let searchTerm = "";

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value == null ? "" : String(value);
        return div.innerHTML;
    }

    function renderCategories(categories) {
        faqCategories.innerHTML = categories.map(function (category) {
            const isActive = category === activeCategory;

            return `
                <button type="button"
                        class="faq-category${isActive ? " is-active" : ""}"
                        data-category="${escapeHtml(category)}"
                        role="tab"
                        aria-selected="${isActive}">
                    ${escapeHtml(category)}
                </button>
            `;
        }).join("");
    }

    function getFilteredFaqs() {
        return faqData.filter(function (faq) {
            const categoryMatches =
                activeCategory === "All" ||
                faq.category === activeCategory;

            if (!categoryMatches) {
                return false;
            }

            if (!searchTerm) {
                return true;
            }

            const searchableText = [
                faq.question,
                faq.answer,
                faq.category,
                ...(Array.isArray(faq.keywords) ? faq.keywords : [])
            ].join(" ").toLowerCase();

            return searchableText.includes(searchTerm);
        });
    }

    function renderFaqs() {
        const filteredFaqs = getFilteredFaqs();
    
        faqList.innerHTML = "";
    
        if (!filteredFaqs.length) {
            faqEmpty.hidden = false;
            return;
        }
    
        faqEmpty.hidden = true;
    
        filteredFaqs.forEach(function (faq) {
            const item = document.createElement("article");
            const answerId = "faq-answer-" + faq.id;
            const questionId = "faq-question-" + faq.id;
    
            item.className = "faq-item";
            item.dataset.faqId = faq.id;
    
            /*
             * Standard FAQ answer
             */
            let answerContent = `
                <p class="faq-answer-text">
                    ${escapeHtml(faq.answer || "")}
                </p>
            `;
    
            /*
             * Payment Schedule
             */
            if (Array.isArray(faq.schedule) && faq.schedule.length) {
    
                const scheduleCards = faq.schedule.map(function (item) {
                    return `
                        <div class="faq-payment-date">
                            <div class="faq-payment-calendar" aria-hidden="true">
                                <span>▦</span>
                            </div>
    
                            <strong class="faq-payment-date-number">
                                ${escapeHtml(item.date)}
                            </strong>
    
                            <span class="faq-payment-date-label">
                                ${escapeHtml(item.label)}
                            </span>
    
                            <span class="faq-payment-type">
                                ${escapeHtml(item.payment)}
                            </span>
                        </div>
                    `;
                }).join("");
    
                answerContent += `
                    <div class="faq-payment-schedule">
    
                        <div class="faq-payment-title">
                            <span class="faq-payment-title-icon" aria-hidden="true">
                                📅
                            </span>
    
                            <h3>HOA DUES PAYMENT SCHEDULE</h3>
                        </div>
    
                        <p class="faq-payment-intro">
                            To give you more flexibility, dues can be paid twice a month on the following dates:
                        </p>
    
                        <div class="faq-payment-dates">
                            ${scheduleCards}
                        </div>
    
                    </div>
                `;
            }
    
            /*
             * Homeowner message
             */
            if (faq.message) {
                answerContent += `
                    <div class="faq-payment-message">
    
                        <div class="faq-payment-divider">
                            <span></span>
                            <strong>♥</strong>
                            <span></span>
                        </div>
    
                        <p>
                            ${escapeHtml(faq.message)}
                        </p>
    
                    </div>
                `;
            }
    
            /*
             * QR Code / Payment Area
             */
            if (faq.payment) {
    
                const paymentImage = faq.payment.image
                    ? `
                        <div class="faq-payment-qr">
                            <img
                                src="${escapeHtml(faq.payment.image)}"
                                alt="HOA dues payment QR code"
                                loading="lazy"
                                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
                            >
    
                            <div class="faq-payment-qr-placeholder" style="display:none;">
                                <span class="faq-payment-qr-symbol">▦</span>
                                <strong>QR CODE</strong>
                                <small>PLACEHOLDER</small>
                            </div>
                        </div>
                    `
                    : `
                        <div class="faq-payment-qr">
                            <div class="faq-payment-qr-placeholder">
                                <span class="faq-payment-qr-symbol">▦</span>
                                <strong>QR CODE</strong>
                                <small>PLACEHOLDER</small>
                            </div>
                        </div>
                    `;
    
                const paymentButton = faq.payment.link
                    ? `
                        <a
                            href="${escapeHtml(faq.payment.link)}"
                            class="faq-payment-button"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <span aria-hidden="true">↗</span>
                            ${escapeHtml(
                                faq.payment.linkText ||
                                "Scan or click here to pay now"
                            )}
                        </a>
                    `
                    : "";
    
                answerContent += `
                    <div class="faq-payment-area">
    
                        ${paymentImage}
    
                        <p class="faq-payment-caption">
                            ${escapeHtml(
                                faq.payment.caption ||
                                "Scan the QR code to pay your HOA dues."
                            )}
                        </p>
    
                        ${paymentButton}
    
                    </div>
                `;
            }
    
            /*
             * Standard FAQ link support
             */
            if (faq.link && faq.link.url) {
                answerContent += `
                    <a
                        class="faq-link"
                        href="${escapeHtml(faq.link.url)}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        ${escapeHtml(faq.link.label || "Learn More")} →
                    </a>
                `;
            }
    
            item.innerHTML = `
                <button
                    type="button"
                    id="${questionId}"
                    class="faq-question"
                    aria-expanded="false"
                    aria-controls="${answerId}"
                >
                    <span class="faq-question-text">
                        ${escapeHtml(faq.question)}
                    </span>
    
                    <span
                        class="faq-chevron"
                        aria-hidden="true"
                    >
                        ↓
                    </span>
                </button>
    
                <div
                    id="${answerId}"
                    class="faq-answer"
                    role="region"
                    aria-labelledby="${questionId}"
                    hidden
                >
                    <div class="faq-answer-inner">
                        <div class="faq-answer-content">
                            ${answerContent}
                        </div>
                    </div>
                </div>
            `;
    
            faqList.appendChild(item);
        });
    }

    function loadFaqs() {
        fetch("faq.json", { cache: "no-cache" })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error("FAQ data could not be loaded.");
                }

                return response.json();
            })
            .then(function (data) {
                if (!data || !Array.isArray(data.faqs)) {
                    throw new Error("Invalid FAQ data format.");
                }

                faqData = data.faqs;

                let categories = Array.isArray(data.categories)
                    ? data.categories.slice()
                    : ["All"].concat(
                        Array.from(new Set(
                            faqData
                                .map(function (faq) {
                                    return faq.category;
                                })
                                .filter(Boolean)
                        ))
                    );

                if (!categories.includes("All")) {
                    categories.unshift("All");
                }

                renderCategories(categories);
                renderFaqs();
            })
            .catch(function (error) {
                console.error("FAQ loading error:", error);
                faqList.innerHTML = "";
                faqEmpty.hidden = false;
            });
    }

    faqCategories.addEventListener("click", function (event) {
        const button = event.target.closest(".faq-category");

        if (!button) {
            return;
        }

        activeCategory = button.dataset.category || "All";

        faqCategories.querySelectorAll(".faq-category").forEach(function (categoryButton) {
            const isActive = categoryButton === button;

            categoryButton.classList.toggle("is-active", isActive);
            categoryButton.setAttribute("aria-selected", String(isActive));
        });

        renderFaqs();
    });

    faqSearch.addEventListener("input", function () {
        searchTerm = faqSearch.value.trim().toLowerCase();
        faqClear.hidden = searchTerm.length === 0;
        renderFaqs();
    });

    faqClear.addEventListener("click", function () {
        faqSearch.value = "";
        searchTerm = "";
        faqClear.hidden = true;
        faqSearch.focus();
        renderFaqs();
    });

    faqList.addEventListener("click", function (event) {
        const button = event.target.closest(".faq-question");

        if (!button) {
            return;
        }

        const item = button.closest(".faq-item");
        const answer = item.querySelector(".faq-answer");
        const isOpen = item.classList.contains("is-open");

        faqList.querySelectorAll(".faq-item.is-open").forEach(function (openItem) {
            if (openItem === item) {
                return;
            }

            const openButton = openItem.querySelector(".faq-question");
            const openAnswer = openItem.querySelector(".faq-answer");

            openItem.classList.remove("is-open");
            openButton.setAttribute("aria-expanded", "false");
            openAnswer.hidden = true;
        });

        item.classList.toggle("is-open", !isOpen);
        button.setAttribute("aria-expanded", String(!isOpen));
        answer.hidden = isOpen;
    });

    loadFaqs();
});
