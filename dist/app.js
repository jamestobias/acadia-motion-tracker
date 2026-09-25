(() => {
  "use strict";

  const screens = [...document.querySelectorAll(".screen")];
  const setup = document.querySelector("#setup");
  const tracker = document.querySelector("#tracker");
  const complete = document.querySelector("#complete");
  const armButton = document.querySelector("#arm-button");
  const rearmButton = document.querySelector("#rearm-button");
  const pulseButton = document.querySelector("#pulse-button");
  const abortButton = document.querySelector("#abort-button");
  const staffTrigger = document.querySelector("#staff-trigger");
  const staffDialog = document.querySelector("#staff-dialog");
  const staffReset = document.querySelector("#staff-reset");
  const resumeAuto = document.querySelector("#resume-auto");
  const blips = document.querySelector("#blips");
  const radar = document.querySelector("#radar");
  const alertStrip = document.querySelector("#alert-strip");
  const contactCount = document.querySelector("#contact-count");
  const distance = document.querySelector("#distance");
  const signal = document.querySelector("#signal");
  const objectiveText = document.querySelector("#objective-text");
  const missionTime = document.querySelector("#mission-time");
  const soundToggle = document.querySelector("#sound-toggle");
  const hapticToggle = document.querySelector("#haptic-toggle");
  const installButton = document.querySelector("#install-button");
  const installHelp = document.querySelector("#install-help");

  const cueData = {
    clear: { count: 0, distance: null, alert: "SCANNING", level: "", signal: "CLEAR", objective: "ENTER THE WRECK" },
    one: { count: 1, distance: 16.8, alert: "MOTION DETECTED", level: "warning", signal: "WEAK", objective: "HOLD POSITION AND SCAN" },
    multiple: { count: 3, distance: 9.4, alert: "MULTIPLE CONTACTS", level: "warning", signal: "ACTIVE", objective: "LOCATE THE FLIGHT RECORDER" },
    swarm: { count: 7, distance: 3.1, alert: "CONTACTS CONVERGING", level: "danger", signal: "DANGER", objective: "KEEP MOVING" },
    objective: { count: 2, distance: 6.2, alert: "OBJECTIVE LOCATED", level: "warning", signal: "LOCKED", objective: "RECOVER THE BLACK BOX" },
    evacuate: { count: 9, distance: 1.4, alert: "EVACUATE NOW", level: "danger", signal: "CRITICAL", objective: "EXIT THE CRASH SITE" }
  };

  const timelines = {
    demo: [[0,"clear"],[6,"one"],[15,"multiple"],[24,"swarm"],[32,"objective"],[39,"evacuate"],[45,"complete"]],
    standard: [[0,"clear"],[18,"one"],[42,"multiple"],[70,"clear"],[84,"objective"],[112,"swarm"],[135,"evacuate"],[150,"complete"]]
  };

  let mode = "standard";
  let startTime = 0;
  let elapsed = 0;
  let timer = null;
  let audioContext = null;
  let beepTimer = null;
  let currentCue = "clear";
  let deferredInstall = null;
  let wakeLock = null;
  let holdTimer = null;
  let autoPaused = false;

  const show = (screen) => {
    screens.forEach((item) => item.classList.toggle("active", item === screen));
  };

  const getAudio = () => {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
    return audioContext;
  };

  const tone = (frequency = 760, duration = .07, volume = .08) => {
    if (!soundToggle.checked) return;
    const context = getAudio();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  };

  const vibrate = (pattern) => {
    if (hapticToggle.checked && navigator.vibrate) navigator.vibrate(pattern);
  };

  const requestWakeLock = async () => {
    try { if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen"); } catch (_) {}
  };

  const randomPositions = (count) => {
    const positions = [];
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 1.2) + Math.random() * (Math.PI * 1.6);
      const radius = 14 + Math.random() * 35;
      positions.push({
        x: 50 + Math.cos(angle) * radius,
        y: 54 + Math.sin(angle) * radius,
        large: count > 5 && i === 0
      });
    }
    return positions;
  };

  const drawBlips = (count) => {
    blips.innerHTML = "";
    randomPositions(count).forEach((point) => {
      const dot = document.createElement("span");
      dot.className = `blip${point.large ? " large" : ""}`;
      dot.style.left = `${point.x}%`;
      dot.style.top = `${point.y}%`;
      dot.style.animationDelay = `${Math.random() * .8}s`;
      blips.append(dot);
    });
  };

  const scheduleBeep = (cue) => {
    clearTimeout(beepTimer);
    if (!cue.distance) return;
    const delay = Math.max(170, Math.min(1500, cue.distance * 72));
    const loop = () => {
      tone(cue.level === "danger" ? 1040 : 780, cue.level === "danger" ? .1 : .065, .085);
      if (cue.level === "danger") vibrate(30);
      beepTimer = setTimeout(loop, delay);
    };
    loop();
  };

  const applyCue = (name, forced = false) => {
    if (name === "complete") return finishMission();
    const cue = cueData[name];
    if (!cue || (!forced && currentCue === name)) return;
    currentCue = name;
    alertStrip.textContent = cue.alert;
    alertStrip.className = `alert-strip ${cue.level}`.trim();
    contactCount.textContent = String(cue.count).padStart(2, "0");
    distance.textContent = cue.distance ? `${cue.distance.toFixed(1)} M` : "--.- M";
    signal.textContent = cue.signal;
    objectiveText.textContent = cue.objective;
    drawBlips(cue.count);
    scheduleBeep(cue);
    if (cue.level === "warning") vibrate([55, 70, 55]);
    if (cue.level === "danger") vibrate([100, 50, 100, 50, 180]);
  };

  const updateClock = () => {
    elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const seconds = String(elapsed % 60).padStart(2, "0");
    missionTime.textContent = `${minutes}:${seconds}`;
    if (mode !== "manual" && !autoPaused) {
      const events = timelines[mode];
      let active = events[0][1];
      events.forEach(([at, cue]) => { if (elapsed >= at) active = cue; });
      applyCue(active);
    }
  };

  const startMission = async () => {
    mode = document.querySelector('input[name="scenario"]:checked').value;
    autoPaused = false;
    getAudio();
    show(tracker);
    startTime = Date.now();
    elapsed = 0;
    currentCue = "";
    applyCue("clear");
    clearInterval(timer);
    timer = setInterval(updateClock, 250);
    updateClock();
    await requestWakeLock();
    tone(520, .12, .09);
    setTimeout(() => tone(760, .12, .09), 150);
  };

  const finishMission = () => {
    clearInterval(timer);
    clearTimeout(beepTimer);
    tone(620, .12, .08);
    setTimeout(() => tone(820, .15, .08), 160);
    vibrate([80, 60, 140]);
    show(complete);
  };

  const resetMission = () => {
    clearInterval(timer);
    clearTimeout(beepTimer);
    if (wakeLock) wakeLock.release().catch(() => {});
    wakeLock = null;
    autoPaused = false;
    missionTime.textContent = "00:00";
    applyCue("clear", true);
    if (staffDialog.open) staffDialog.close();
    show(setup);
  };

  const pulse = () => {
    radar.classList.remove("pulsing");
    void radar.offsetWidth;
    radar.classList.add("pulsing");
    tone(410, .16, .06);
    vibrate(25);
    setTimeout(() => radar.classList.remove("pulsing"), 1100);
  };

  const beginHold = (action, duration = 1500) => {
    clearTimeout(holdTimer);
    holdTimer = setTimeout(action, duration);
  };
  const endHold = () => clearTimeout(holdTimer);

  armButton.addEventListener("click", startMission);
  rearmButton.addEventListener("click", resetMission);
  pulseButton.addEventListener("click", pulse);
  staffTrigger.addEventListener("pointerdown", () => beginHold(() => staffDialog.showModal(), 1800));
  staffTrigger.addEventListener("pointerup", endHold);
  staffTrigger.addEventListener("pointercancel", endHold);
  abortButton.addEventListener("pointerdown", () => beginHold(resetMission, 1600));
  abortButton.addEventListener("pointerup", endHold);
  abortButton.addEventListener("pointercancel", endHold);
  staffReset.addEventListener("click", resetMission);
  document.querySelectorAll("[data-cue]").forEach((button) => button.addEventListener("click", () => {
    autoPaused = true;
    applyCue(button.dataset.cue, true);
    staffDialog.close();
  }));
  resumeAuto.addEventListener("click", () => {
    autoPaused = false;
    currentCue = "";
    updateClock();
    staffDialog.close();
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstall = event;
    installButton.hidden = false;
    installHelp.textContent = "Install for offline full-screen use during the event.";
  });
  installButton.addEventListener("click", async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    installButton.hidden = true;
  });

  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !window.navigator.standalone) {
    installHelp.textContent = "On iPhone: tap Share, then Add to Home Screen. Open it once before the event to cache it offline.";
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && tracker.classList.contains("active") && !wakeLock) requestWakeLock();
  });

  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js"));
})();
