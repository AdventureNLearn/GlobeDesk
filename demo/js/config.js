/* GlobeDesk full mission config.
   The frog guide is an example pack, not a locked layer.
   Narrator content (character, voice, script, poses, lamps, radio, theme)
   lives in guide-packs/<guidePack>/manifest.json. See guide-packs/README.md
   to make or swap your own guide. Mission mechanics (levels, XP, timing)
   stay here. */
window.DEMO = {
  /* Folder name under guide-packs/. Change this to load a different guide. */
  guidePack: "frogpost",

  brand: {
    product: "GlobeDesk",
    studio: "AdventureNLearn",
    handle: "@AdventureNLearn",
    lowerThirdLeft: "GLOBEDESK",
    lowerThirdRight: "DESK ONLINE",
    linkStable: "LINK: STABLE",
    completeLine1: "GlobeDesk by AdventureNLearn",
    completeLine2: "Free, local, and yours to make",
  },

  /* Fallback asset paths used only until the guide pack loads.
     The pack overwrites these with pack-relative URLs. */
  assets: {
    startStill: "guide-packs/frogpost/assets/a1-console.jpg",
    completeStill: "guide-packs/frogpost/assets/a4-outro.jpg",
    coldOpen: "guide-packs/frogpost/assets/v1-cold-open.mp4",
    portrait: "guide-packs/frogpost/assets/frog/idle.jpg",
    poses: {
      idle: "guide-packs/frogpost/assets/frog/idle.jpg",
      talk: "guide-packs/frogpost/assets/frog/talk.jpg",
      success: "guide-packs/frogpost/assets/frog/thumbs-up.jpg",
      hint: "guide-packs/frogpost/assets/frog/hint.jpg",
      salute: "guide-packs/frogpost/assets/frog/salute.jpg"
    },
    voiceDir: "guide-packs/frogpost/assets/vo/",
    sfxDir: "guide-packs/frogpost/assets/sfx/",
    missionEpisode: "/episodes/mission.json",
    telemetryBed: "guide-packs/frogpost/assets/sfx/telemetry-bed.wav",
    mediaStill: "guide-packs/frogpost/assets/a1-console.jpg",
    embedPoster: "guide-packs/frogpost/assets/nasa-earth-poster.jpg"
  },

  embed: {
    url: "https://www.youtube-nocookie.com/embed/oFDeNcu3mnc",
    title: "Earth from the ISS",
    credit: "NASA / NASA Johnson — Ultra High Definition (4K) View of Planet Earth (2016)",
    page: "https://www.youtube.com/watch?v=oFDeNcu3mnc",
    poster: "guide-packs/frogpost/assets/nasa-earth-poster.jpg"
  },

  /* TEMPORARY voice lab. Off in production. Set enabled: true to show the panel. */
  tempVoiceLab: {
    enabled: false,
    storageKey: "globedesk-demo.voiceLab",
    voice: "hfc_male",
    pitchSemitones: 0,
    speed: 1,
    pitchMin: -6,
    pitchMax: 6,
    speedMin: 0.7,
    speedMax: 1.3,
    previewLine: "start"
  },

  timing: {
    bootSec: 6.5,
    startHoldAuto: 5.5,
    coldOpen: 6.5,
    hintAfterMs: 12000,
    autoAssistAfterMs: 1800,
    autoHoldSec: 10,
    typeMsPerChar: 16,
    blinkEveryMs: 3800,
    warmupTimeoutMs: 20000,
  },

  orbit: {"center": [20, 18], "zoom": 1.65, "pitch": 0, "bearing": -20},
  streetTarget: {
      "name": "Midtown Manhattan (sample city, approximate)",
      "lat": 40.758,
      "lon": -73.9855,
      "zoom": 16.4,
      "pitch": 62,
      "bearing": 28,
      "diveDurationSec": 5.5
  },
  spin: {"bearingDelta": 150, "zoom": 1.7, "pitch": 8, "durationSec": 5},

  ranks: [
      {
          "id": "recruit",
          "label": "RECRUIT",
          "minXp": 0
      },
      {
          "id": "operator",
          "label": "OPERATOR",
          "minXp": 250
      },
      {
          "id": "cartographer",
          "label": "CARTOGRAPHER",
          "minXp": 700
      },
      {
          "id": "newsdesk",
          "label": "NEWSDESK",
          "minXp": 1300
      },
      {
          "id": "mission-control",
          "label": "MISSION CONTROL",
          "minXp": 1900
      }
  ],

  /* Mission mechanics only. Guide script for each level comes from the pack. */
  levels: [
    {
      id: "spin", num: 1, sector: "SECTOR 01 — ORBIT", title: "SPIN THE GLOBE",
      objective: "Spin the globe and feel the orbit",
      xp: 120, badge: { id: "orbit", label: "ORBIT" }, kiosk: "globe", autoHoldSec: 10
    },
    {
      id: "dive", num: 2, sector: "SECTOR 02 — STREET", title: "DIVE TO STREET",
      objective: "Dive to street level, wait for 3D buildings, and opt in to terrain",
      xp: 160, badge: { id: "street", label: "STREET" }, kiosk: "globe", autoHoldSec: 12
    },
    {
      id: "open", num: 3, sector: "SECTOR 03 — EPISODE", title: "OPEN AN EPISODE",
      objective: "Open the practice episode on the desk",
      xp: 140, badge: { id: "episode", label: "EPISODE" }, kiosk: "inspect", autoHoldSec: 10
    },
    {
      id: "edit", num: 4, sector: "SECTOR 04 — EDITOR", title: "EDIT THE DESK",
      objective: "Edit the episode title and a topic card",
      xp: 150, badge: { id: "editor", label: "EDITOR" }, kiosk: "inspect", autoHoldSec: 10
    },
    {
      id: "pins", num: 5, sector: "SECTOR 05 — SITES", title: "PINS AND DATA",
      objective: "Drop a pin or card and show an event-site data layer",
      xp: 170, badge: { id: "sites", label: "SITES" }, kiosk: "inspect", autoHoldSec: 11
    },
    {
      id: "media", num: 6, sector: "SECTOR 06 — MEDIA", title: "UPLOAD A CARD",
      objective: "Add a local still and set it as a card",
      xp: 160, badge: { id: "media", label: "MEDIA" }, kiosk: "inspect", autoHoldSec: 10
    },
    {
      id: "embed", num: 7, sector: "SECTOR 07 — OVERLAY", title: "OVERLAY AND EMBED",
      objective: "Place a screen overlay and a credited YouTube embed",
      xp: 180, badge: { id: "overlay", label: "OVERLAY" }, kiosk: "inspect", autoHoldSec: 12
    },
    {
      id: "sound", num: 8, sector: "SECTOR 08 — SOUND", title: "SOUND OVERLAY",
      objective: "Add a pre-recorded sound overlay to the episode",
      xp: 150, badge: { id: "sound", label: "SOUND" }, kiosk: "inspect", autoHoldSec: 10
    },
    {
      id: "captions", num: 9, sector: "SECTOR 09 — ACCESS", title: "CAPTIONS AND READABLE",
      objective: "Show captions and the readable card view",
      xp: 150, badge: { id: "access", label: "ACCESS" }, kiosk: "readable", autoHoldSec: 11
    },
    {
      id: "assist", num: 10, sector: "SECTOR 10 — ASSIST", title: "ASSISTANT PANEL",
      objective: "Use the assistant prompt, paste JSON, or import a same-origin episode",
      xp: 180, badge: { id: "assist", label: "ASSIST" }, kiosk: "inspect", autoHoldSec: 11
    },
    {
      id: "grokme", num: 11, sector: "SECTOR 11 — BUILD KIT", title: "GROK.ME KIT",
      objective: "Open the Grok.me build kit from the repo",
      xp: 160, badge: { id: "kit", label: "GROK.ME" }, kiosk: "kit", autoHoldSec: 12
    }
  ]
};

