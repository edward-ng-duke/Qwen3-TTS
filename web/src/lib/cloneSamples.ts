// base 变体没有内置音色——这些是 samples/00_克隆参考音色库/ 里的 9 条干净单人片段，
// 拷到 web/public/samples/clone-ref/ 后可直接当 /v1/clone 的参考音频。
// ref_text 逐字取自该目录 README（ICL 高保真所需，务必精确）。

export interface CloneSample {
  id: string
  name: string        // 中文名
  speaker: string     // 英文 speaker
  genderAge: string   // "女 · 成人"
  language: string    // 与后端 /v1/languages 对齐
  file: string        // public 路径
  refText: string     // 逐字文字稿
}

export const CLONE_SAMPLES: CloneSample[] = [
  { id: "vivian",   name: "薇薇安",   speaker: "Vivian",   genderAge: "女 · 成人", language: "Chinese",  file: "/samples/clone-ref/vivian.wav",   refText: "今天天气真好，我们一起出去走走吧。" },
  { id: "uncle_fu", name: "福伯",     speaker: "Uncle Fu", genderAge: "男 · 老年", language: "Chinese",  file: "/samples/clone-ref/uncle_fu.wav", refText: "孩子，听我给你讲一个老故事。" },
  { id: "ryan",     name: "莱恩",     speaker: "Ryan",     genderAge: "男 · 成人", language: "English",  file: "/samples/clone-ref/ryan.wav",     refText: "Hello, this is a quick voice preview." },
  { id: "serena",   name: "思琳",     speaker: "Serena",   genderAge: "女 · 年轻", language: "English",  file: "/samples/clone-ref/serena.wav",   refText: "Lovely to meet you. Shall we begin?" },
  { id: "aiden",    name: "艾登",     speaker: "Aiden",    genderAge: "男 · 年轻", language: "English",  file: "/samples/clone-ref/aiden.wav",    refText: "Hey, ready to crush today? Let's go!" },
  { id: "dylan",    name: "迪伦",     speaker: "Dylan",    genderAge: "男 · 成人", language: "English",  file: "/samples/clone-ref/dylan.wav",    refText: "So, where shall we start the story today?" },
  { id: "ono_anna", name: "小野安娜", speaker: "Ono Anna", genderAge: "女 · 成人", language: "Japanese", file: "/samples/clone-ref/ono_anna.wav", refText: "こんにちは、よろしくお願いします。" },
  { id: "sohee",    name: "素熙",     speaker: "Sohee",    genderAge: "女 · 年轻", language: "Korean",   file: "/samples/clone-ref/sohee.wav",    refText: "안녕하세요, 만나서 반가워요." },
  { id: "eric",     name: "艾里克",   speaker: "Eric",     genderAge: "男 · 成人", language: "German",   file: "/samples/clone-ref/eric.wav",     refText: "Guten Tag, schön, Sie kennenzulernen." },
]
