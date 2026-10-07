(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasObserver = "IntersectionObserver" in window;

  /* ------------------------------------------------------------------
     2.5D wall background: raised slabs on three depth layers in front
     of a paneled wall. Layers drift with scroll and lean toward the
     pointer, near ones more than far ones, and the shadows follow the
     light. Static when reduced motion is set.
     ------------------------------------------------------------------ */
  const scene = $(".scene");

  if (scene) {
    const layers = $$(".scene-layer", scene);
    const layerHeights = [150, 180, 260, 380]; // in vh
    const slabCounts = [0, 9, 8, 5];
    const layerScale = [1, 0.8, 1, 1.5];
    const layerElevation = [0, 6, 12, 24];
    const slabShapes = [
      [],
      [[1, 1], [2, 1], [1, 1], [1, 2]],
      [[2, 1], [1, 2], [2, 2], [3, 1]],
      [[2, 2], [3, 2], [2, 3]],
    ];
    const styles = getComputedStyle(scene);
    const tileW = parseFloat(styles.getPropertyValue("--tw")) || 150;
    const tileH = parseFloat(styles.getPropertyValue("--th")) || 96;
    const compact = window.matchMedia("(max-width: 720px)").matches;
    const tints = ["", "", "sage", "clay"];

    // Small seeded generator so the wall looks the same on every visit
    let seed = 23;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const between = (min, max) => min + rand() * (max - min);
    const pick = (list) => list[Math.floor(rand() * list.length)];

    layers.forEach((layer, i) => {
      layer.style.height = `${layerHeights[i]}vh`;
      if (!slabCounts[i]) return;

      const unitW = tileW * layerScale[i];
      const unitH = tileH * layerScale[i];
      const width = window.innerWidth;
      const height = (layerHeights[i] * window.innerHeight) / 100;
      const count = Math.round(slabCounts[i] * (compact ? 0.6 : 1));
      const placed = [];

      for (let n = 0; n < count; n += 1) {
        const [cols, rows] = pick(slabShapes[i]);
        const w = cols * unitW;
        const h = rows * unitH;

        for (let attempt = 0; attempt < 14; attempt += 1) {
          // Favour the page edges so slabs frame the content instead of sitting behind text
          const rawX = rand() < 0.8 ? (rand() < 0.5 ? between(-0.02, 0.12) : between(0.84, 0.98)) : between(0.16, 0.78);
          const x = Math.round((rawX * width) / unitW) * unitW;
          const y = Math.round(between(0.01, 0.97) * (height - h) / unitH) * unitH;
          const clear = placed.every((p) => x >= p.x + p.w + 8 || p.x >= x + w + 8 || y >= p.y + p.h + 8 || p.y >= y + h + 8);
          if (!clear) continue;

          placed.push({ x, y, w, h });
          const slab = document.createElement("div");
          slab.className = `slab ${pick(tints)}`.trim();
          slab.style.left = `${x}px`;
          slab.style.top = `${y}px`;
          slab.style.width = `${w - 4}px`;
          slab.style.height = `${h - 4}px`;
          slab.style.setProperty("--e", String(layerElevation[i]));
          layer.append(slab);
          break;
        }
      }
    });

    if (!reduceMotion) {
      const pointerFine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      let viewport = window.innerHeight;
      let scrollShare = 0;
      let targetX = 0;
      let targetY = 0;
      let x = 0;
      let y = 0;
      let frame = null;

      const paint = () => {
        x += (targetX - x) * 0.08;
        y += (targetY - y) * 0.08;

        layers.forEach((layer) => {
          const index = layers.indexOf(layer);
          const depth = Number(layer.dataset.depth);
          const travel = ((layerHeights[index] - 100) * viewport) / 100;
          const dx = -x * depth * 26;
          const dy = -scrollShare * travel - y * depth * 18;
          layer.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
        });

        // The light leans toward the pointer, so shadows swing the other way
        scene.style.setProperty("--lx", (0.7 - x * 0.35).toFixed(3));
        scene.style.setProperty("--ly", (0.9 - y * 0.25).toFixed(3));

        const moving = Math.abs(targetX - x) > 0.002 || Math.abs(targetY - y) > 0.002;
        frame = moving ? requestAnimationFrame(paint) : null;
      };

      const request = () => {
        if (!frame) frame = requestAnimationFrame(paint);
      };

      const measure = () => {
        viewport = window.innerHeight;
        const room = document.documentElement.scrollHeight - viewport;
        scrollShare = room > 0 ? Math.min(1, Math.max(0, window.scrollY / room)) : 0;
        request();
      };

      window.addEventListener("scroll", measure, { passive: true });
      window.addEventListener("resize", measure);

      if (pointerFine) {
        window.addEventListener(
          "pointermove",
          (event) => {
            targetX = (event.clientX / window.innerWidth - 0.5) * 2;
            targetY = (event.clientY / window.innerHeight - 0.5) * 2;
            request();
          },
          { passive: true }
        );
      }

      measure();
    }
  }

  /* ------------------------------------------------------------------
     Mobile menu
     ------------------------------------------------------------------ */
  const navToggle = $(".nav-toggle");
  const nav = $(".nav");

  if (navToggle && nav) {
    const setMenu = (open) => {
      nav.classList.toggle("open", open);
      navToggle.setAttribute("aria-expanded", String(open));
      navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    };
    const isOpen = () => nav.classList.contains("open");

    navToggle.addEventListener("click", () => setMenu(!isOpen()));
    $$("a", nav).forEach((link) => link.addEventListener("click", () => setMenu(false)));

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isOpen()) {
        setMenu(false);
        navToggle.focus();
      }
    });

    document.addEventListener("click", (event) => {
      if (isOpen() && !nav.contains(event.target) && !navToggle.contains(event.target)) {
        setMenu(false);
      }
    });
  }

  /* ------------------------------------------------------------------
     Scroll reveal, and skill bars that fill when they are actually seen
     ------------------------------------------------------------------ */
  const reveals = $$(".reveal");
  const skillCards = $$(".skill-card");

  if (hasObserver) {
    const once = (className, options) =>
      new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(className);
            observer.unobserve(entry.target);
          }
        });
      }, options);

    const revealObserver = once("visible", { threshold: 0, rootMargin: "0px 0px -10% 0px" });
    const barObserver = once("in", { threshold: 0.35 });

    reveals.forEach((el) => revealObserver.observe(el));
    skillCards.forEach((el) => barObserver.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("visible"));
    skillCards.forEach((el) => el.classList.add("in"));
  }

  /* ------------------------------------------------------------------
     Active nav link
     ------------------------------------------------------------------ */
  const navLinks = $$(".nav a");
  const sections = $$("main section[id]");

  if (hasObserver && navLinks.length && sections.length) {
    const linkById = new Map(navLinks.map((a) => [a.getAttribute("href").slice(1), a]));

    const setActive = (id) => {
      navLinks.forEach((link) => {
        if (link === linkById.get(id)) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    };

    const sectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-45% 0px -50% 0px" }
    );

    sections.forEach((section) => sectionObserver.observe(section));
    setActive(sections[0].id);
  }

  /* ------------------------------------------------------------------
     Cursor glow: a ring that eases after the pointer.
     The real cursor is never hidden. Mouse and trackpad only.
     ------------------------------------------------------------------ */
  const ring = $(".cursor-ring");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  if (ring && finePointer && !reduceMotion) {
    let targetX = 0;
    let targetY = 0;
    let x = 0;
    let y = 0;
    let frame = null;

    const tick = () => {
      x += (targetX - x) * 0.22;
      y += (targetY - y) * 0.22;
      ring.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      const settled = Math.abs(targetX - x) < 0.1 && Math.abs(targetY - y) < 0.1;
      frame = settled ? null : requestAnimationFrame(tick);
    };

    window.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerType === "touch") return;
        targetX = event.clientX;
        targetY = event.clientY;
        if (!ring.classList.contains("on")) {
          x = targetX;
          y = targetY;
          ring.classList.add("on");
        }
        if (!frame) frame = requestAnimationFrame(tick);
      },
      { passive: true }
    );

    document.documentElement.addEventListener("mouseleave", () => ring.classList.remove("on"));

    document.addEventListener("pointerover", (event) => {
      ring.classList.toggle("active", Boolean(event.target.closest("a, button")));
    });
  }

  /* ------------------------------------------------------------------
     Image viewer (posters, presentation slides, certificates).
     Each trigger belongs to a group; the viewer pages through that group.
     A trigger can also point at a JSON list of slides (data-slides-from).
     ------------------------------------------------------------------ */
  const dialog = $(".lightbox");
  const triggers = $$("[data-lightbox]");

  if (dialog && typeof dialog.showModal === "function" && triggers.length) {
    const image = $(".lb-img", dialog);
    const caption = $(".lb-caption", dialog);
    const prevBtn = $(".lb-prev", dialog);
    const nextBtn = $(".lb-next", dialog);
    let items = [];
    let index = 0;

    const itemsFor = (trigger) => {
      if (trigger.dataset.slidesFrom) {
        const source = $(trigger.dataset.slidesFrom);
        try {
          return JSON.parse(source.textContent);
        } catch (error) {
          return [];
        }
      }
      const group = trigger.dataset.group || "posters";
      return triggers
        .filter((t) => !t.dataset.slidesFrom && (t.dataset.group || "posters") === group)
        .map((t) => ({ full: t.dataset.full, title: t.dataset.title, alt: $("img", t).alt }));
    };

    const show = (next) => {
      index = (next + items.length) % items.length;
      const item = items[index];
      image.src = item.full;
      image.alt = item.alt || "";
      caption.textContent = items.length > 1 ? `${item.title} (${index + 1} of ${items.length})` : item.title;

      if (items.length > 1) {
        const upcoming = new Image();
        upcoming.src = items[(index + 1) % items.length].full;
      }
    };

    triggers.forEach((trigger) => {
      trigger.addEventListener("click", () => {
        items = itemsFor(trigger);
        if (!items.length) return;
        const start = items.findIndex((item) => item.full === trigger.dataset.full);
        const many = items.length > 1;
        prevBtn.hidden = !many;
        nextBtn.hidden = !many;
        show(start >= 0 ? start : 0);
        dialog.showModal();
        document.documentElement.style.overflow = "hidden";
      });
    });

    $(".lb-close", dialog).addEventListener("click", () => dialog.close());
    prevBtn.addEventListener("click", () => show(index - 1));
    nextBtn.addEventListener("click", () => show(index + 1));

    // Clicking the dimmed area (the dialog itself) closes the viewer
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });

    dialog.addEventListener("keydown", (event) => {
      if (items.length < 2) return;
      if (event.key === "ArrowLeft") show(index - 1);
      if (event.key === "ArrowRight") show(index + 1);
    });

    dialog.addEventListener("close", () => {
      document.documentElement.style.overflow = "";
    });
  }

  /* ------------------------------------------------------------------
     IoT "How it works" panels, with a click-to-load YouTube player.
     Nothing from YouTube loads until the person presses play.
     ------------------------------------------------------------------ */
  const videos = $$(".video[data-yt]");

  videos.forEach((video) => {
    const id = video.dataset.yt;
    video.style.setProperty("--thumb", `url("https://i.ytimg.com/vi/${id}/hqdefault.jpg")`);
    const facade = video.innerHTML;
    video._facade = facade;

    video.addEventListener("click", (event) => {
      if (!event.target.closest(".video-play")) return;
      const frame = document.createElement("iframe");
      frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
      frame.title = `Reference video: ${video.dataset.title}`;
      frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.allowFullscreen = true;
      video.replaceChildren(frame);
    });
  });

  const resetVideos = (root) => {
    $$(".video", root).forEach((video) => {
      if (video.querySelector("iframe")) video.innerHTML = video._facade;
    });
  };

  const detailPanels = $$("dialog.detail");

  if (detailPanels.length && typeof detailPanels[0].showModal === "function") {
    $$("[data-detail]").forEach((button) => {
      const panel = document.getElementById(button.dataset.detail);
      if (!panel) return;
      button.addEventListener("click", () => {
        panel.showModal();
        document.documentElement.style.overflow = "hidden";
      });
    });

    detailPanels.forEach((panel) => {
      $(".detail-close", panel).addEventListener("click", () => panel.close());
      panel.addEventListener("click", (event) => {
        if (event.target === panel) panel.close();
      });
      panel.addEventListener("close", () => {
        resetVideos(panel);
        document.documentElement.style.overflow = "";
      });
    });
  }

  /* ------------------------------------------------------------------
     Contact form. Sends through EmailJS.
     If sending fails, it offers the same message as a ready-made email.
     ------------------------------------------------------------------ */
  const form = $("#contact-form");

  if (form) {
    const MAIL = "maulana.iqbal0304@gmail.com";
    const EMAILJS_PUBLIC_KEY = "5jNkYDJJqM7Jufu5K";
    const EMAILJS_SERVICE_ID = "service_8w0vpc8";
    const EMAILJS_TEMPLATE_ID = "template_kyi1sx9";
    const status = $(".form-status", form);
    const submit = $("button[type='submit']", form);
    const label = $(".btn-label", submit);

    const say = (kind, text) => {
      status.className = `form-status ${kind}`.trim();
      status.textContent = text;
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;

      const data = new FormData(form);
      if (data.get("_honey")) return;

      const name = String(data.get("name")).trim();
      const email = String(data.get("email")).trim();
      const message = String(data.get("message")).trim();

      say("", "");
      submit.disabled = true;
      label.textContent = "Sending";

      try {
        if (!window.emailjs) throw new Error("EmailJS could not be loaded");

        window.emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
        await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
          name,
          email,
          message,
          from_name: name,
          from_email: email,
          reply_to: email,
        });
        form.reset();
        say("ok", "Message sent. I will reply to the email address you gave.");
      } catch {
        status.className = "form-status err";
        status.textContent = "The message did not send. ";
        const link = document.createElement("a");
        link.href =
          `mailto:${MAIL}?subject=${encodeURIComponent(`Portfolio message from ${name}`)}` +
          `&body=${encodeURIComponent(`${message}\n\n${name}\n${email}`)}`;
        link.textContent = "Send it from your email app instead.";
        status.append(link);
      } finally {
        submit.disabled = false;
        label.textContent = "Send message";
      }
    });
  }

  /* ------------------------------------------------------------------
     Save CV as PDF (print styles show only the CV)
     ------------------------------------------------------------------ */
  const printButton = $("[data-print]");
  if (printButton) printButton.addEventListener("click", () => window.print());
})();
