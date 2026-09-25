(() => {
  "use strict";

  const screens = [...document.querySelectorAll(".screen")];
  const setup = document.querySelector("#setup");
  const tutorial = document.querySelector("#tutorial");
  const ready = document.querySelector("#ready");
  const countdown = document.querySelector("#countdown");
  const tracker = document.querySelector("#tracker");
  const complete = document.querySelector("#complete");
  const armButton = document.querySelector("#arm-button");
  const tutorialAction = document.querySelector("#tutorial-action");
  const tutorialBack = document.querySelector("#tutorial-back");
  const tutorialStepNumber = document.querySelector("#tutorial-step-number");
  const tutorialTitle = document.querySelector("#tutorial-title");
  const tutorialText = document.querySelector("#tutorial-text");
  const trainingBlip = document.querySelector("#training-blip");
  const trainingDistance = document.querySelector("#training-distance");
  const goButton = document.querySelector("#go-button");
  const countdownNumber = document.querySelector("#countdown-number");
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
    clear: { count: 0, distance: null, alert: "SCANNING", level: "", signal: "CLEAR", objective: "ENTER THE CRASH SITE", points: [] },
    one: { count: 1, distance: 18.2, alert: "DISTANT MOTION", level: "warning", signal: "WEAK", objective: "CONTINUE FORWARD", points: [[66,27]] },
    close: { count: 1, distance: 8.6, alert: "MOTION DETECTED", level: "warning", signal: "ACTIVE", objective: "HOLD POSITION AND SCAN", points: [[42,57]] },
    multiple: { count: 3, distance: 6.9, alert: "MULTIPLE CONTACTS", level: "warning", signal: "ACTIVE", objective: "CHECK BOTH CORRIDORS", points: [[33,38],[63,45],[71,30]] },
    interference: { count: 0, distance: null, alert: "SIGNAL INTERFERENCE", level: "warning", signal: "ERROR", objective: "KEEP THE SQUAD TOGETHER", points: [] },
    objective: { count: 2, distance: 6.2, alert: "OBJECTIVE LOCATED", level: "warning", signal: "LOCKED", objective: "RECOVER THE FLIGHT RECORDER", points: [[52,41],[68,61]] },
    secured: { count: 0, distance: null, alert: "OBJECTIVE SECURED", level: "", signal: "CLEAR", objective: "MOVE TOWARD THE EXIT", points: [] },
    swarm: { count: 7, distance: 4.4, alert: "CONTACTS CONVERGING", level: "danger", signal: "DANGER", objective: "KEEP MOVING", points: [[34,32],[46,39],[62,34],[70,51],[58,63],[39,66],[25,48]] },
    blind: { count: 0, distance: null, alert: "TRACKER BLIND", level: "danger", signal: "LOST", objective: "DO NOT STOP", points: [] },
    nearSwarm: { count: 9, distance: 2.4, alert: "CONTACTS VERY CLOSE", level: "danger", signal: "CRITICAL", objective: "RUN", points: [[32,31],[44,35],[58,33],[69,40],[72,55],[61,63],[48,68],[35,61],[27,47]] },
    evacuate: { count: 12, distance: 1.2, alert: "EVACUATE NOW", level: "danger", signal: "CRITICAL", objective: "EXIT THE CRASH SITE", points: [[31,25],[43,29],[56,27],[68,34],[75,46],[71,60],[62,69],[49,73],[37,68],[27,59],[23,46],[25,35]] }
  };

  const timeline = [
    [0,"clear"],
    [45,"one"],
    [80,"clear"],
    [120,"close"],
    [160,"multiple"],
    [205,"interference"],
    [240,"objective"],
    [285,"one"],
    [320,"multiple"],
    [360,"secured"],
    [395,"close"],
    [425,"secured"],
    [455,"swarm"],
    [500,"blind"],
    [525,"nearSwarm"],
    [555,"evacuate"],
    [600,"complete"]
  ];

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
  let tutorialStep = 1;
  let tutorialTested = false;

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

  const drawBlips = (cue) => {
    blips.innerHTML = "";
    cue.points.forEach(([x, y], index) => {
      const dot = document.createElement("span");
      dot.className = `blip${cue.count > 8 && index === 0 ? " large" : ""}`;
      dot.style.left = `${x}%`;
      dot.style.top = `${y}%`;
      dot.style.animationDelay = `${index * .11}s`;
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
    drawBlips(cue);
    scheduleBeep(cue);
    if (cue.level === "warning") vibrate([55, 70, 55]);
    if (cue.level === "danger") vibrate([100, 50, 100, 50, 180]);
  };

  const updateClock = () => {
    elapsed = Math.floor((Date.now() - startTime) / 1000);
    const minutes = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const seconds = String(elapsed % 60).padStart(2, "0");
    missionTime.textContent = `${minutes}:${seconds}`;
    if (!autoPaused) {
      let active = timeline[0][1];
      timeline.forEach(([at, cue]) => { if (elapsed >= at) active = cue; });
      applyCue(active);
    }
  };

  const startMission = async () => {
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

  const updateTutorial = () => {
    tutorialStepNumber.textContent = tutorialStep;
    trainingBlip.classList.toggle("active", tutorialStep === 2 && tutorialTested);
    if (tutorialStep === 1) {
      tutorialTitle.textContent = "You Are the Squad Leader";
      tutorialText.textContent = "Green lights represent movement. The number shows the distance to the nearest contact. Smaller numbers mean it is getting closer.";
      trainingDistance.textContent = "12.0 M";
      tutorialAction.textContent = "Next";
    } else if (tutorialStep === 2) {
      tutorialTitle.textContent = "Test the Contact Alert";
      tutorialText.textContent = "When the tracker detects movement, it will beep faster as the contact approaches. Sound and vibration work best when you keep the phone in your hand.";
      trainingDistance.textContent = tutorialTested ? "06.0 M" : "--.- M";
      tutorialAction.textContent = tutorialTested ? "Next" : "Test Scanner";
    } else {
      tutorialTitle.textContent = "Follow the Orders";
      tutorialText.textContent = "Stay with your squad. Watch the current order below the radar. If the tracker says EVACUATE, move to the marked exit immediately.";
      trainingDistance.textContent = "READY";
      tutorialAction.textContent = "Tutorial Complete";
    }
  };

  const startTutorial = () => {
    getAudio();
    tutorialStep = 1;
    tutorialTested = false;
    updateTutorial();
    show(tutorial);
  };

  const advanceTutorial = () => {
    if (tutorialStep === 2 && !tutorialTested) {
      tutorialTested = true;
      trainingBlip.classList.add("active");
      trainingDistance.textContent = "06.0 M";
      tutorialAction.textContent = "Next";
      tone(820, .09, .09);
      setTimeout(() => tone(820, .09, .09), 420);
      vibrate([60, 120, 60]);
      return;
    }
    if (tutorialStep < 3) {
      tutorialStep += 1;
      updateTutorial();
    } else {
      show(ready);
    }
  };

  const backTutorial = () => {
    if (tutorialStep === 1) return show(setup);
    tutorialStep -= 1;
    if (tutorialStep === 2) tutorialTested = false;
    updateTutorial();
  };

  const beginCountdown = () => {
    goButton.classList.remove("holding");
    show(countdown);
    let count = 3;
    countdownNumber.textContent = count;
    tone(560, .12, .09);
    const countdownTimer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        countdownNumber.textContent = count;
        tone(560, .12, .09);
      } else {
        clearInterval(countdownTimer);
        countdownNumber.textContent = "GO";
        tone(880, .2, .1);
        setTimeout(startMission, 650);
      }
    }, 1000);
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
    tutorialStep = 1;
    tutorialTested = false;
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

  armButton.addEventListener("click", startTutorial);
  tutorialAction.addEventListener("click", advanceTutorial);
  tutorialBack.addEventListener("click", backTutorial);
  goButton.addEventListener("pointerdown", () => {
    goButton.classList.add("holding");
    beginHold(beginCountdown, 1800);
  });
  goButton.addEventListener("pointerup", () => { goButton.classList.remove("holding"); endHold(); });
  goButton.addEventListener("pointercancel", () => { goButton.classList.remove("holding"); endHold(); });
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
