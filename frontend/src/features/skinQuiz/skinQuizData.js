export const SKIN_QUIZ_STORAGE_KEY = "mg_skin_quiz_result_v1";
export const SKIN_QUIZ_VERSION = 1;

export const SKIN_QUIZ_QUESTIONS = [
  {
    id: "afterCleansing",
    title: {
      id: "Sekitar 30 menit setelah membersihkan wajah tanpa memakai produk lain, kulitmu biasanya terasa...",
      en: "About 30 minutes after cleansing without applying another product, your skin usually feels...",
    },
    helper: {
      id: "Pilih kondisi yang paling sering kamu rasakan.",
      en: "Choose the condition you notice most often.",
    },
    options: [
      {
        id: "dry",
        label: {
          id: "Kencang, kasar, atau mudah terasa kering",
          en: "Tight, rough, or noticeably dry",
        },
        typeScores: { dry: 4 },
      },
      {
        id: "oily",
        label: {
          id: "Cepat tampak mengilap di hampir seluruh wajah",
          en: "Quickly looks shiny across most of the face",
        },
        typeScores: { oily: 4 },
      },
      {
        id: "combination",
        label: {
          id: "Area T mengilap, tetapi pipi normal atau terasa kering",
          en: "The T-zone looks shiny, while the cheeks feel normal or dry",
        },
        typeScores: { combination: 4 },
      },
      {
        id: "normal",
        label: {
          id: "Cukup nyaman dan seimbang",
          en: "Mostly comfortable and balanced",
        },
        typeScores: { normal: 4 },
      },
    ],
  },
  {
    id: "duringDay",
    title: {
      id: "Menjelang siang atau sore, perubahan yang paling sering terlihat adalah...",
      en: "By midday or afternoon, the change you notice most often is...",
    },
    helper: {
      id: "Bayangkan hari biasa, bukan setelah olahraga atau cuaca ekstrem.",
      en: "Think about an ordinary day, not after exercise or extreme weather.",
    },
    options: [
      {
        id: "dry",
        label: {
          id: "Kulit tetap terasa kering atau kurang nyaman",
          en: "The skin still feels dry or uncomfortable",
        },
        typeScores: { dry: 3 },
      },
      {
        id: "oily",
        label: {
          id: "Minyak terlihat di hampir seluruh wajah",
          en: "Oil is visible across most of the face",
        },
        typeScores: { oily: 3 },
      },
      {
        id: "combination",
        label: {
          id: "Minyak terutama terlihat di dahi, hidung, dan dagu",
          en: "Oil is mainly visible on the forehead, nose, and chin",
        },
        typeScores: { combination: 3 },
      },
      {
        id: "normal",
        label: {
          id: "Tidak banyak berubah dan tetap terasa seimbang",
          en: "There is little change and the skin still feels balanced",
        },
        typeScores: { normal: 3 },
      },
    ],
  },
  {
    id: "productComfort",
    title: {
      id: "Saat mencoba produk skincare baru, kulitmu biasanya...",
      en: "When trying a new skincare product, your skin usually...",
    },
    helper: {
      id: "Pertanyaan ini hanya melihat kenyamanan kulit, bukan alergi atau kondisi medis.",
      en: "This question only considers skin comfort, not allergies or medical conditions.",
    },
    options: [
      {
        id: "oftenReactive",
        label: {
          id: "Sering mudah terasa perih, panas, atau kemerahan",
          en: "Often feels stinging, warm, or looks red",
        },
        sensitivityScore: 3,
      },
      {
        id: "sometimesReactive",
        label: {
          id: "Kadang kurang nyaman, terutama dengan bahan aktif tertentu",
          en: "Sometimes feels uncomfortable, especially with certain active ingredients",
        },
        sensitivityScore: 1,
      },
      {
        id: "rarelyReactive",
        label: {
          id: "Jarang terasa tidak nyaman",
          en: "Rarely feels uncomfortable",
        },
        sensitivityScore: 0,
      },
    ],
  },
  {
    id: "mainConcern",
    title: {
      id: "Kebutuhan utama yang ingin kamu prioritaskan saat ini adalah...",
      en: "The main need you want to prioritize right now is...",
    },
    helper: {
      id: "Pilih satu agar rekomendasi lebih fokus.",
      en: "Choose one so the recommendations stay focused.",
    },
    options: [
      {
        id: "acne",
        label: {
          id: "Minyak berlebih dan kulit rentan berjerawat",
          en: "Excess oil and acne-prone skin",
        },
        concern: "acne",
      },
      {
        id: "comedones",
        label: {
          id: "Komedo dan pori yang terasa mudah tersumbat",
          en: "Comedones and pores that feel easily clogged",
        },
        concern: "comedones",
      },
      {
        id: "dullness",
        label: {
          id: "Kulit tampak kusam atau kurang merata",
          en: "Skin that looks dull or uneven",
        },
        concern: "dullness",
      },
      {
        id: "hydration",
        label: {
          id: "Menjaga kelembapan dan kenyamanan kulit",
          en: "Maintaining skin hydration and comfort",
        },
        concern: "hydration",
      },
      {
        id: "protection",
        label: {
          id: "Rutinitas dasar dan perlindungan harian",
          en: "A basic routine and daily protection",
        },
        concern: "protection",
      },
    ],
  },
  {
    id: "routinePriority",
    title: {
      id: "Pendekatan rutinitas yang paling kamu inginkan adalah...",
      en: "The routine approach you prefer is...",
    },
    helper: {
      id: "Ini membantu mengurutkan produk yang paling relevan.",
      en: "This helps rank the most relevant products.",
    },
    options: [
      {
        id: "gentle",
        label: {
          id: "Lembut dan menjaga kenyamanan kulit",
          en: "Gentle and focused on skin comfort",
        },
        priority: "gentle",
      },
      {
        id: "oilControl",
        label: {
          id: "Fokus membantu mengontrol minyak dan membersihkan pori",
          en: "Focused on oil control and cleansing pores",
        },
        priority: "oilControl",
      },
      {
        id: "brightening",
        label: {
          id: "Fokus menjaga kulit tampak segar dan cerah",
          en: "Focused on keeping the skin looking fresh and bright",
        },
        priority: "brightening",
      },
      {
        id: "simple",
        label: {
          id: "Sesederhana mungkin untuk rutinitas harian",
          en: "As simple as possible for a daily routine",
        },
        priority: "simple",
      },
    ],
  },
];

export const SKIN_TYPE_CONTENT = {
  oily: {
    label: { id: "Cenderung berminyak", en: "Likely oily" },
    summary: {
      id: "Jawabanmu lebih banyak menunjukkan minyak muncul di sebagian besar area wajah.",
      en: "Your answers suggest that oil tends to appear across most areas of your face.",
    },
  },
  dry: {
    label: { id: "Cenderung kering", en: "Likely dry" },
    summary: {
      id: "Jawabanmu lebih banyak menunjukkan kulit mudah terasa kencang atau kurang nyaman.",
      en: "Your answers suggest that your skin often feels tight or less comfortable.",
    },
  },
  combination: {
    label: { id: "Cenderung kombinasi", en: "Likely combination" },
    summary: {
      id: "Jawabanmu menunjukkan area T lebih mudah berminyak dibandingkan area pipi.",
      en: "Your answers suggest that the T-zone becomes oilier than the cheek area.",
    },
  },
  normal: {
    label: { id: "Cenderung seimbang", en: "Likely balanced" },
    summary: {
      id: "Jawabanmu menunjukkan kulit relatif nyaman tanpa dominasi minyak atau rasa kering.",
      en: "Your answers suggest relatively comfortable skin without dominant oiliness or dryness.",
    },
  },
};

export const CONCERN_CONTENT = {
  acne: {
    label: { id: "Prioritas: minyak & jerawat", en: "Priority: oil & acne" },
  },
  comedones: {
    label: { id: "Prioritas: komedo & pori", en: "Priority: comedones & pores" },
  },
  dullness: {
    label: { id: "Prioritas: kulit kusam", en: "Priority: dull-looking skin" },
  },
  hydration: {
    label: { id: "Prioritas: kelembapan", en: "Priority: hydration" },
  },
  protection: {
    label: { id: "Prioritas: rutinitas dasar", en: "Priority: basic routine" },
  },
};

export function quizText(value, locale = "id") {
  if (!value || typeof value !== "object") return String(value || "");
  return value[locale] ?? value.id ?? value.en ?? "";
}
