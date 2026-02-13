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
    desc: "👉 Reconnaître un geste… sans viser la perfection."
  },
  {
    id: "mission2",
    label: "M2",
    title: "Mission 2 - Emotion responsable",
    desc: "👉 Accepter l’incertitude plutôt que surentraîner."
  },
  {
    id: "mission3",
    label: "M3",
    title: "Mission 3 - Chatbot compact",
    desc: "👉 Un modèle plus petit peut-il suffire ?"
  },
  {
    id: "mission4",
    label: "M4",
    title: "Mission 4 - RAG frugal",
    desc: "👉 Moins de documents, mais mieux choisis."
  },
  {
    id: "mission5",
    label: "M5",
    title: "Mission 5 - Audio sobre",
    desc: "👉 Reconnaissance vocale locale et legere."
  }
];

export const PAGE_CONFIG = {
  home: {
    id: "home",
    heroTitle: "Serious Game IA frugales",
    heroBody:
      "Choisis une mission et progresse dans le serious game. Chaque mission te confronte à un choix: faire mieux… ou faire plus simple.",
    stageTitle: "Bienvenue",
    stageDesc: "Ici, tu ne cherches pas la meilleure IA, mais la plus juste pour le besoin.",
    missionTitle: "Accueil",
    missionSubtitle: "Navigation libre entre missions.",
    placeholderTitle: "Choisir une mission",
    placeholderBody: "Chaque mission teste une manière différente de faire “juste assez”.",
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
        hint: "Objectif : tester une IA sobre à chaque etape.",
        type: "info"
      }
    ]
  },
  mission1: {
    id: "mission1",
    heroTitle: "Serious Game IA frugales",
    heroBody:
      "Un parcours d' experimentation autour des IA locales et sobres. Chaque mission met en scène un arbitrage précision, latence et impact.",
    stageTitle: "Atelier vision locale",
    stageDesc: "Détection mains en direct. Rien ne sort de la machine.",
    missionTitle: "Briefing de mission",
    missionSubtitle: "Serious game IA frugale : missions courtes, badges à débloquer.",
    placeholderTitle: "Module en préparation",
    placeholderBody: "Cette mission utilise un autre capteur ou un autre type de modèle.",
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
          "Tu pilotes un labo d'IA locale. Objectif : livrer de la valeur avec un budget énergie minimal. Chaque mission explore un compromis entre précision, latence et sobriété.",
        hint: "Garde en tête la triade valeur, coût, empreinte.",
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
    missionTitle: "Briefing émotion",
    missionSubtitle: "Comprendre les limites, la contextuelle, et la sobriété.",
    placeholderTitle: "Capteur alternatif",
    placeholderBody: "Module emotion en préparation. Utilise un flux de données pre-enregistré.",
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
          "Scénario : une conseillère bancaire adapte son discours à l' humeur du client. Tu dois limiter la compléxité du modèle.",
        hint: "Défi : ajuster le seuil de sourire sans fausse détection.",
        type: "info"
      },
      {
        id: "debrief",
        title: "Debrief",
        body:
          "Moins de variables = plus de sobriété. Priorise les signaux vraiment utiles.",
        hint: "Pense à des seuils, pas à une émotion parfaite.",
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
    missionSubtitle: "Composer des réponses utiles avec un modèle compact.",
    placeholderTitle: "Mode texte",
    placeholderBody: "Module chatbot en préparation. Simule des réponses courtes et utiles.",
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
          "Scenario : Répondre à un client en moins de 2 secondes. Tu dois garder une réponse claire et locale.",
        hint: "Défi : limiter le contexte sans perdre l'essentiel.",
        type: "info"
      },
      {
        id: "debrief",
        title: "Debrief",
        body:
          "Des prompts plus courts reduisent l'énergie. Utilise des patrons simples.",
        hint: "Un bon cadre bat un grand modèle.",
        type: "info"
      }
    ]
  },
  mission4: {
    id: "mission4",
    heroTitle: "Mission 4 - RAG frugal",
    heroBody:
      "Limiter les documents, cibler les sources utiles, et garder la réponse locale.",
    stageTitle: "Atelier documents",
    stageDesc: "Prototype RAG local : indexation frugale et réponse guidée.",
    missionTitle: "Briefing RAG",
    missionSubtitle: "Prioriser l'impact plutôt que l'exhaustivité.",
    placeholderTitle: "RAG local",
    placeholderBody: "Module RAG en préparation. Travaille sur un corpus réduit.",
    kpiLabels: {
      gesture: "Couverture",
      confidence: "Précision",
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
          "Scenario : Répondre à des questions internes sans charger tout l'historique.",
        hint: "Défi : Sélectionner 5 documents utiles.",
        type: "info"
      },
      {
        id: "debrief",
        title: "Debrief",
        body:
          "Moins de sources = moins de coût. Mesure avant d ajouter.",
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
    missionSubtitle: "Garder un service utile avec un modèle léger.",
    placeholderTitle: "Micro local",
    placeholderBody: "Module audio en préparation. Simule des commandes courtes.",
    kpiLabels: {
      gesture: "Clarté",
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
        hint: "Défi : 3 essais, de la phrase complète aux mots-clés.",
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
