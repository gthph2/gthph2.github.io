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
