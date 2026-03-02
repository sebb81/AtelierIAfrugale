export const ALL_MISSIONS = [
  {
    id: "mission1",
    title: "Mission 1 - Geste",
    desc: "Pouce leve, seuil de confiance."
  },
  // {
  //   id: "mission2",
  //   title: "Mission 2 - Emotion",
  //   desc: "Face mesh et nuance emotionnelle."
  // },
  {
    id: "mission2",
    title: "Mission 2 - Chatbot",
    desc: "Assistant compact et local."
  },
  {
    id: "mission3",
    title: "Mission 3 - Documents",
    desc: "RAG frugal sur documents internes."
  }
  // {
  //   id: "mission5",
  //   title: "Mission 5 - Audio",
  //   desc: "Reconnaissance vocale sobre."
  // }
];

export const CARD_MISSIONS = [
  {
    id: "mission1",
    label: "M1",
    title: "Mission 1 - Une IA locale et spécialisée",
    desc: "👉 Une tâche simple. Un modèle minimal. Est-ce suffisant ?"
  },
  // {
  //   id: "mission2",
  //   label: "M2",
  //   title: "Mission 2 - Emotion responsable",
  //   desc: "👉 Accepter l’incertitude plutôt que surentraîner."
  // },
  {
    id: "mission2",
    label: "M2",
    title: "Mission 2 - Chatbot compact",
    desc: "👉 Un modèle plus petit peut-il suffire ?"
  },
  {
    id: "mission3",
    label: "M3",
    title: "Mission 3 - RAG frugal",
    desc: "👉 Moins de documents, mais mieux choisis."
  }
  // {
  //   id: "mission5",
  //   label: "M5",
  //   title: "Mission 5 - Audio sobre",
  //   desc: "👉 Reconnaissance vocale locale et legere."
  // }
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
          "Tu disposes de 3 missions. Commence par la mission 1 pour la detection de geste en local.",
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
    stageDesc: "Une IA minimale, pour une tâche précise.",
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
    showMpConfidenceControls: false,
    showGestureReadout: false,
    showBestThresholdStat: false,
    showBadgeStat: false,
    showConfidenceAcceptance: false,
    challenge: false,
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
          "Vous pilotez un système d’IA embarquée. Observez ce qu’il détecte. Identifiez ce qu’il comprend… et ce qu’il ne comprend pas.",
        hint: "Chaque mission explore un compromis entre précision, rapidité et impact.",
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
  // mission2: {
  //   id: "mission2",
  //   heroTitle: "Mission 2 - Emotion responsable",
  //   heroBody:
  //     "Observer une emotion sans sur-consommer. On joue sur la precision percue et la sobriete du modele.",
  //   stageTitle: "Atelier emotion",
  //   stageDesc: "Face mesh en direct pour lire une nuance emotionnelle.",
  //   missionTitle: "Briefing émotion",
  //   missionSubtitle: "Comprendre les limites, la contextuelle, et la sobriété.",
  //   placeholderTitle: "Capteur alternatif",
  //   placeholderBody: "Module emotion en préparation. Utilise un flux de données pre-enregistré.",
  //   kpiLabels: {
  //     gesture: "Emotion",
  //     confidence: "Smile ratio",
  //     fps: "FPS"
  //   },
  //   usesCamera: true,
  //   wsEndpoint: "/ws/emotion",
  //   showMpControls: false,
  //   challenge: true,
  //   defaultThreshold: 0.38,
  //   threshold: {
  //     label: "Seuil de sourire",
  //     min: 0.3,
  //     max: 0.6,
  //     step: 0.01,
  //     value: 0.38
  //   },
  //   statLabels: {
  //     score: "Smile ratio",
  //     status: "Emotion",
  //     best: "Meilleur seuil",
  //     badge: "Badge"
  //   },
  //   steps: [
  //     {
  //       id: "mission2",
  //       title: "Mission 2 - Emotion responsable",
  //       body:
  //         "Scénario : une conseillère bancaire adapte son discours à l' humeur du client. Tu dois limiter la compléxité du modèle.",
  //       hint: "Défi : ajuster le seuil de sourire sans fausse détection.",
  //       type: "info"
  //     },
  //     {
  //       id: "debrief",
  //       title: "Debrief",
  //       body:
  //         "Moins de variables = plus de sobriété. Priorise les signaux vraiment utiles.",
  //       hint: "Pense à des seuils, pas à une émotion parfaite.",
  //       type: "info"
  //     }
  //   ]
  // },
  mission2: {
    id: "mission2",
    heroTitle: "Mission 2 - Chatbot compact",
    heroBody:
      "Un assistant local, rapide, et assez bon pour le quotidien. La valeur d usage avant la taille du modele.",
    stageTitle: "Atelier chatbot",
    stageDesc: "Prototype texte local via un serveur llama.cpp.",
    missionTitle: "Briefing chatbot",
    missionSubtitle: "Composer avec un modèle compact.",
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
      "Tu es un assistant IA compact fonctionnant en local. Tu dois répondre en moins de 8 lignes. Tu dois aller à l’essentiel. Tu évites les phrases inutiles.",
    chatPlaceholder: "Posez votre question...",
    defaultThreshold: 0.6,
    steps: [
      {
        id: "mission2",
        title: "Mission 2 - Chatbot compact",
        body:
          "Scenario : garder une réponse claire, sans excès.",
        hint: "Défi : produire une réponse utile en moins de 6 lignes.",
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
  mission3: {
    id: "mission3",
    heroTitle: "Mission 3 - RAG frugal",
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
    ragConfig: {
      topK: 8,
      minScore: 0.25
    },
    chatSystemPrompt:
      "Réponds uniquement à partir des documents fournis. Si absent du contexte : dis-le. Ne devine pas. Cite tes sources. Réponse courte + bullets.",
    chatPlaceholder: "Posez une question...",
    defaultThreshold: 0.6,
    steps: [
      {
        id: "mission3",
        title: "Mission 3 - RAG frugal",
        body:
          "Un chatbot classique répond avec ce qu’il a appris pendant son entraînement.\n\nUn RAG va chercher des documents précis (PDF, site web, base interne…)\n\nPuis il utilise ces documents pour construire sa réponse.\n\nRésultat : réponses plus fiables, plus à jour, et adaptées à votre contexte.\n\nImage mentale :\n\nChatGPT seul = “je réponds avec ma mémoire”\nRAG = “je vais d’abord chercher dans vos documents, puis je réponds”",
        hint:
          "En une phrase :\n\n👉 Un RAG, c’est un chatbot qui lit vos documents avant de vous répondre.",
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
  }
  // mission5: {
  //   id: "mission5",
  //   heroTitle: "Mission 5 - Audio sobre",
  //   heroBody:
  //     "Reconnaissance vocale locale, sans streaming. On accepte un peu d erreur pour baisser l empreinte.",
  //   stageTitle: "Atelier audio",
  //   stageDesc: "Micro local + Whisper Tiny pour jouer la concision.",
  //   missionTitle: "Briefing audio",
  //   missionSubtitle: "Garder un service utile avec un modèle léger.",
  //   placeholderTitle: "Micro local",
  //   placeholderBody: "Module audio en préparation. Simule des commandes courtes.",
  //   kpiLabels: {
  //     gesture: "Clarté",
  //     confidence: "Robustesse",
  //     fps: "Latence"
  //   },
  //   usesCamera: false,
  //   showAudio: true,
  //   audioEndpoint: "/api/audio/transcribe",
  //   defaultThreshold: 0.6,
  //   steps: [
  //     {
  //       id: "mission5",
  //       title: "Mission 5 - Audio sobre",
  //       body:
  //         "Scenario : dicter une phrase, puis la raccourcir en gardant le sens.",
  //       hint: "Défi : 3 essais, de la phrase complète aux mots-clés.",
  //       type: "info"
  //     },
  //     {
  //       id: "debrief",
  //       title: "Debrief",
  //       body:
  //         "Un vocabulaire restreint augmente la fiabilite et diminue l energie.",
  //       hint: "Le contexte doit rester minimal.",
  //       type: "info"
  //     }
  //   ]
  // }
};
