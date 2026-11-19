// =====================================================
//  script.js  -  ลูกเล่นหน้าแรก (index.html)
// =====================================================

// การ์ด 3 ขั้นตอนค่อย ๆ ปรากฏตอนเลื่อนมาถึง
const revealTargets = document.querySelectorAll(".step-card, .section-title");

if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add("visible");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.2 });

    revealTargets.forEach(function (element, index) {
        element.classList.add("reveal");
        element.style.transitionDelay = (index % 3) * 0.12 + "s";
        observer.observe(element);
    });
}
