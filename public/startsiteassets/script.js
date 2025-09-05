$(document).ready(function () {
  $(window).scroll(function () {
    // sticky navbar
    if (this.scrollY > 20) {
      $(".navbar").addClass("sticky");
    } else {
      $(".navbar").removeClass("sticky");
    }
    // scroll-up button show/hide
    if (this.scrollY > 500) {
      $(".scroll-up-btn").addClass("show");
    } else {
      $(".scroll-up-btn").removeClass("show");
    }
  });

  // slide-up
  $(".scroll-up-btn").click(function () {
    $("html").animate({ scrollTop: 0 });
    $("html").css("scrollBehavior", "auto");
  });

  $(".navbar .menu li a").click(function () {
    $("html").css("scrollBehavior", "smooth");
  });

  // toggle menu
  $(".menu-btn").click(function () {
    $(".navbar .menu").toggleClass("active");
    $(".menu-btn i").toggleClass("active");
  });

  // typing animations (PL)
  var typed1 = new Typed(".typing", {
    strings: ["matematyki", "języka polskiego", "języka angielskiego", "chemii", "biologii"],
    typeSpeed: 100,
    backSpeed: 60,
    loop: true,
  });

  var typed2 = new Typed(".typing-2", {
    strings: ["nauczyciele-egzaminatorzy", "praktycy", "pasjonaci edukacji"],
    typeSpeed: 100,
    backSpeed: 60,
    loop: true,
  });

  // owl carousel
  $(".carousel").owlCarousel({
    margin: 20,
    loop: true,
    autoplay: true,
    autoplayTimeOut: 2000,
    autoplayHoverPause: true,
    responsive: {
      0: { items: 1, nav: false },
      600: { items: 2, nav: false },
      1000: { items: 3, nav: false },
    },
  });

  // ------ Netlify Identity UI logic ------
  function updateUI(user) {
    const dash = document.getElementById("dashboard-link");
    const loginBtn = document.getElementById("login-btn");
    if (dash) dash.style.display = user ? "inline-block" : "none";
    if (loginBtn) {
      if (user) {
        loginBtn.textContent = "Przejdź do dashboardu";
        loginBtn.setAttribute("href", "/dashboard.html");
      } else {
        loginBtn.textContent = "Zaloguj się";
        loginBtn.setAttribute("href", "/login/");
      }
    }
  }

  const hasIdentity = typeof window !== "undefined" && window.netlifyIdentity;
  if (hasIdentity) {
    // init reflects current user
    window.netlifyIdentity.on("init", updateUI);
    window.netlifyIdentity.on("login", function (user) {
      updateUI(user);
      window.location.href = "/dashboard.html";
    });
    window.netlifyIdentity.on("logout", function () {
      updateUI(null);
      window.location.href = "/";
    });
    // if identity already initialized, sync UI
    window.netlifyIdentity.init();
  }
});
