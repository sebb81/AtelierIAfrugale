export const ALL_MISSIONS = [
  {
    id: "mission1",
    title: "Mission 1 - Geste",
    desc: "Pouce leve, seuil de confiance."
  },
  {
    id: "mission2",
    title: "Mission 2 - Emotion",
    desc: "Face mesh et nuance emotionnelle."
  },
  {
    id: "mission3",
    title: "Mission 3 - Chatbot",
    desc: "Assistant compact et local."
  },
  {
    id: "mission4",
    title: "Mission 4 - Documents",
    desc: "RAG frugal sur documents internes."
  },
  {
    id: "mission5",
    title: "Mission 5 - Audio",
    desc: "Reconnaissance vocale sobre."
  }
];

export const CARD_MISSIONS = [
  {
    id: "mission1",
    label: "M1",
    title: "Mission 1 - Geste frugal",
    desc: "Detection pouce leve en local, ajuster le seuil."
  },
  {
    id: "mission2",
    label: "M2",
    title: "Mission 2 - Emotion responsable",
    desc: "Calibration emotionnelle sans modele lourd."
  },
  {
    id: "mission3",
    label: "M3",
    title: "Mission 3 - Chatbot compact",
    desc: "Assistant local et reponses utiles."
  },
  {
    id: "mission4",
    label: "M4",
    title: "Mission 4 - RAG frugal",
    desc: "Selectionner peu de documents pertinents."
  },
  {
    id: "mission5",
    label: "M5",
    title: "Mission 5 - Audio sobre",
    desc: "Reconnaissance vocale locale et legere."
  }
];

export const PAGE_CONFIG = {
  home: {
    id: "home",
    heroTitle: "Serious Game IA frugales",
    heroBody:
      "Choisis une mission et progresse dans le serious game. Chaque mission explore un arbitrage precision, latence et impact.",
    stageTitle: "Bienvenue",
    stageDesc: "Selectionne une mission pour commencer le parcours.",
    missionTitle: "Accueil",
    missionSubtitle: "Navigation libre entre missions.",
    placeholderTitle: "Choisir une mission",
    placeholderBody: "Utilise la carte des missions pour naviguer.",
    kpiLabels: {
      gesture: "Mission",
      confidence: "Etat",
      fps: "Progression"
    },
    usesCamera: false,
    defaultThreshold: 0.6,
    steps: [
      {
        id: "home",
        title: "Accueil du serious game",
        body:
          "Tu disposes de 5 missions. Commence par la mission 1 pour la detection de geste en local.",
        hint: "Objectif : tester une IA sobre a chaque etape.",
        type: "info"
      }
    ]
  },
  mission1: {
    id: "mission1",
    heroTitle: "Serious Game IA frugales",
    heroBody:
      "Un parcours d experimentation autour des IA locales et sobres. Chaque mission met en scene un arbitrage precision, latence et impact.",
    stageTitle: "Atelier vision locale",
    stageDesc: "Detection mains en direct. Rien ne sort de la machine.",
    missionTitle: "Briefing de mission",
    missionSubtitle: "Serious game IA frugale : missions courtes, badges a debloquer.",
    placeholderTitle: "Module en preparation",
    placeholderBody: "Cette mission utilise un autre capteur ou un autre type de modele.",
    kpiLabels: {
      gesture: "Geste detecte",
      confidence: "Confiance",
      fps: "FPS"
    },
    usesCamera: true,
    wsEndpoint: "/ws",
    showMpControls: true,
    challenge: true,
    defaultThreshold: 0.6,
    threshold: {
      label: "Seuil de confiance",
      min: 0,
      max: 1,
      step: 0.01,
      value: 0.6
    },
    statLabels: {
      score: "Score geste",
      status: "Reconnaissance",
      best: "Meilleur seuil",
      badge: "Badge"
    },
    steps: [
      {
        id: "intro",
        title: "Briefing : IA frugale",
        body:
          "Tu pilotes un labo d IA locale. Objectif : livrer de la valeur avec un budget energie minimal. Chaque mission explore un compromis entre precision, latence et sobriete.",
        hint: "Garde en tete la triade valeur, cout, empreinte.",
        type: "info"
      },
      {
        id: "mission1",
        title: "Mission 1 - Geste frugal",
        body:
          "Detecte un pouce leve en local. Ajuste le seuil de confiance pour maximiser la precision sans perdre la detection.",
        hint:
          "Defi : trouve le seuil le plus haut qui reconnait encore ton pouce leve.",
        type: "gesture"
      },
      {
        id: "debrief",
        title: "Debrief",
        body:
          "Bravo, tu as teste un modele local. Les prochaines missions couvrent emotion, chatbot compact, RAG et audio.",
        hint: "Petit modele + bon cadrage = impact reduit.",
        type: "info"
      }
    ]
  },
  mission2: {
    id: "mission2",
    heroTitle: "Mission 2 - Emotion responsable",
    heroBody:
      "Observer une emotion sans sur-consommer. On joue sur la precision percue et la sobriete du modele.",
    stageTitle: "Atelier emotion",
    stageDesc: "Face mesh en direct pour lire une nuance emotionnelle.",
    missionTitle: "Briefing emotion",
    missionSubtitle: "Comprendre les limites, la contextuelle, et la sobriete.",
    placeholderTitle: "Capteur alternatif",
    placeholderBody: "Module emotion en preparation. Utilise un flux de donnees pre-enregistre.",
    kpiLabels: {
      gesture: "Emotion",
      confidence: "Smile ratio",
      fps: "FPS"
    },
    usesCamera: true,
    wsEndpoint: "/ws/emotion",
    showMpControls: false,
    challenge: true,
    defaultThreshold: 0.38,
    threshold: {
      label: "Seuil de sourire",
      min: 0.3,
      max: 0.6,
      step: 0.01,
      value: 0.38
    },
    statLabels: {
      score: "Smile ratio",
      status: "Emotion",
      best: "Meilleur seuil",
      badge: "Badge"
    },
    steps: [
      {
        id: "mission2",
        title: "Mission 2 - Emotion responsable",
        body:
          "Scenario : une conseillere bancaire adapte son discours a l humeur du client. Tu dois limiter la complexite du modele.",
        hint: "Defi : ajuster le seuil de sourire sans fausse detection.",
        type: "info"
      },
      {
        id: "debrief",
        title: "Debrief",
        body:
          "Moins de variables = plus de sobriete. Priorise les signaux vraiment utiles.",
        hint: "Pense a des seuils, pas a une emotion parfaite.",
        type: "info"
      }
    ]
  },
  mission3: {
    id: "mission3",
    heroTitle: "Mission 3 - Chatbot compact",
    heroBody:
      "Un assistant local, rapide, et assez bon pour le quotidien. La valeur d usage avant la taille du modele.",
    stageTitle: "Atelier chatbot",
    stageDesc: "Prototype texte local via un serveur llama.cpp.",
    missionTitle: "Briefing chatbot",
    missionSubtitle: "Composer des reponses utiles avec un modele compact.",
    placeholderTitle: "Mode texte",
    placeholderBody: "Module chatbot en preparation. Simule des reponses courtes et utiles.",
    kpiLabels: {
      gesture: "Pertinence",
      confidence: "Concision",
      fps: "Latence"
    },
    usesCamera: false,
    showChat: true,
    chatEndpoint: "/api/chat",
    chatSystemPrompt:
      "Tu es un assistant IA local. Reponds en francais, de maniere claire et structuree. Si l'utilisateur demande du code, donne un exemple minimal et correct.",
    chatPlaceholder: "Posez votre question...",
    defaultThreshold: 0.6,
    steps: [
      {
        id: "mission3",
        title: "Mission 3 - Chatbot compact",
        body:
          "Scenario : repondre a un client en moins de 2 secondes. Tu dois garder une reponse claire et locale.",
        hint: "Defi : limiter le contexte sans perdre l essentiel.",
        type: "info"
      },
      {
        id: "debrief",
        title: "Debrief",
        body:
          "Des prompts plus courts reduisent l energie. Utilise des patrons simples.",
        hint: "Un bon cadre bat un grand modele.",
        type: "info"
      }
    ]
  },
  mission4: {
    id: "mission4",
    heroTitle: "Mission 4 - RAG frugal",
    heroBody:
      "Limiter les documents, cibler les sources utiles, et garder la reponse locale.",
    stageTitle: "Atelier documents",
    stageDesc: "Prototype RAG local : indexation frugale et reponse guidee.",
    missionTitle: "Briefing RAG",
    missionSubtitle: "Prioriser l impact plutot que l exhaustivite.",
    placeholderTitle: "RAG local",
    placeholderBody: "Module RAG en preparation. Travaille sur un corpus reduit.",
    kpiLabels: {
      gesture: "Couverture",
      confidence: "Precision",
      fps: "Index"
    },
    usesCamera: false,
    showChat: true,
    chatMode: "rag",
    chatEndpoint: "/api/rag/chat",
    ragStateEndpoint: "/api/rag/state",
    ragIndexEndpoint: "/api/rag/index",
    ragResetEndpoint: "/api/rag/reset",
    ragConfig: {
      chunkSize: 1200,
      overlap: 200,
      topK: 6,
      minScore: 0.25
    },
    chatSystemPrompt:
      "Tu es un assistant IA local. Tu dois repondre en francais. Si un CONTEXTE DOCUMENTAIRE est fourni, utilise-le en priorite et cite tes sources avec les numeros entre crochets (ex: [1], [2]). Si le contexte ne contient pas l'information, dis-le clairement et propose quoi chercher.",
    chatPlaceholder: "Posez une question...",
    defaultThreshold: 0.6,
    steps: [
      {
        id: "mission4",
        title: "Mission 4 - RAG frugal",
        body:
          "Scenario : repondre a des questions internes sans charger tout l historique.",
        hint: "Defi : selectionner 5 documents utiles.",
        type: "info"
      },
      {
        id: "debrief",
        title: "Debrief",
        body:
          "Moins de sources = moins de cout. Mesure avant d ajouter.",
        hint: "Le bruit coute plus que le manque.",
        type: "info"
      }
    ]
  },
  mission5: {
    id: "mission5",
    heroTitle: "Mission 5 - Audio sobre",
    heroBody:
      "Reconnaissance vocale locale, sans streaming. On accepte un peu d erreur pour baisser l empreinte.",
    stageTitle: "Atelier audio",
    stageDesc: "Micro local + Whisper Tiny pour jouer la concision.",
    missionTitle: "Briefing audio",
    missionSubtitle: "Garder un service utile avec un modele leger.",
    placeholderTitle: "Micro local",
    placeholderBody: "Module audio en preparation. Simule des commandes courtes.",
    kpiLabels: {
      gesture: "Clarte",
      confidence: "Robustesse",
      fps: "Latence"
    },
    usesCamera: false,
    showAudio: true,
    audioEndpoint: "/api/audio/transcribe",
    defaultThreshold: 0.6,
    steps: [
      {
        id: "mission5",
        title: "Mission 5 - Audio sobre",
        body:
          "Scenario : dicter une phrase, puis la raccourcir en gardant le sens.",
        hint: "Defi : 3 essais, de la phrase complete aux mots-cles.",
        type: "info"
      },
      {
        id: "debrief",
        title: "Debrief",
        body:
          "Un vocabulaire restreint augmente la fiabilite et diminue l energie.",
        hint: "Le contexte doit rester minimal.",
        type: "info"
      }
    ]
  }
};
