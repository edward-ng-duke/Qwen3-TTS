export const T = {
  brand: {
    name: '微趣',
    subtitle: '语音工作台',
    fullTitle: '微趣 · 语音工作台',
  },

  topbar: {
    sidePanelOpen: '展开侧栏',
    sidePanelClose: '收起侧栏',
  },

  status: {
    ready: '就绪',
    loading: '加载中',
    error: '异常',
    notReady: '未就绪',
  },

  composer: {
    placeholder: '在这里输入你想合成的文本…',
    submit: '开始合成',
    submitting: '合成中',
    language: '语种',
    languageAuto: '自动识别',
    voice: '音色',
    pickVoice: '选择音色',
    pickFromLibrary: '从音色库选择',
    emotion: '情绪',
    shortcutHint: '⌘/Ctrl + Enter 快速合成',
    etaEstimate: '预计',
    etaRemaining: '还需',
    etaAlmostDone: '即将完成',
  },

  emotions: {
    neutral: '中性',
    happy: '开心',
    sad: '悲伤',
    angry: '愤怒',
    afraid: '害怕',
    calm: '平静',
    custom: '自定义',
    customPlaceholder: '描述你想要的情绪…',
    customSamplesHint: '试试这些：',
    customSamples: [
      '像在悄悄说秘密一样',
      '用愤怒但克制的语气，缓慢地说',
      '像在哄孩子入睡，温柔轻缓',
      '兴奋激动地大声宣布',
      '用神秘悬疑的语气讲故事',
      '像新闻主播一样字正腔圆',
    ] as readonly string[],
  },

  voiceCard: {
    gender: '性别',
    language: '语言',
    accent: '口音',
    age: '年龄',
    preview: '试听',
    pausePreview: '暂停试听',
    selected: '已选',
    genderValue: {
      male: '男声',
      female: '女声',
      unknown: '未知',
    } as Record<string, string>,
  },

  sidePanel: {
    tabs: {
      voices: '音色库',
      history: '历史',
      advanced: '高级',
    },
    history: {
      empty: '暂无历史记录',
      clearAll: '清空历史',
      reuse: '复用参数',
      delete: '删除',
    },
    advanced: {
      temperature: '随机度',
      temperatureHint: '越高越发散，越低越稳定',
      topP: '核采样阈值',
      topPHint: '保留累计概率前 P 的候选',
      topK: '候选数上限',
      seed: '随机种子',
      seedHint: '相同种子在相同参数下生成一致音频',
      reset: '恢复默认',
    },
  },

  results: {
    empty: '生成结果会出现在这里',
    play: '播放',
    pause: '暂停',
    download: '下载音频',
    regenerate: '重新生成',
    copyApi: '复制接口示例',
    copied: '已复制',
    copyFailed: '复制失败',
    delete: '删除',
  },

  toasts: {
    generateSuccess: '合成完成',
    generateFailed: '合成失败',
    networkError: '网络异常，请稍后重试',
    voiceLoadFailed: '加载音色失败',
    healthFailed: '后端连接失败',
    previewFailed: '试听失败',
  },

  a11y: {
    toggleTheme: '切换主题',
    toggleSidePanel: '切换侧栏',
    playPause: '播放或暂停',
    seekProgress: '拖动播放进度',
    closeDialog: '关闭',
    openVoiceLibrary: '打开音色库',
    openHistory: '打开历史',
    openAdvanced: '打开高级参数',
  },
} as const
