
/* FINEX - Application Logic */

console.log("FINEX is running!");

document.addEventListener("DOMContentLoaded", function () {
    console.log("Welcome to FINEX!");

    const heading = document.querySelector("main h2");

    if (heading) {
        heading.textContent = "Welcome to FINEX";
    }
});
