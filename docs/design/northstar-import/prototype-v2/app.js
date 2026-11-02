(function () {
  'use strict';

  /* ── Icons ─────────────────────────────────────────────── */
  var ICONS = {
    home: '<path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/>',
    tutor: '<path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-5.4A8 8 0 1 1 21 12z"/><path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01"/>',
    materials: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M11 4h6.5A1.5 1.5 0 0 1 19 5.5v13a1.5 1.5 0 0 1-1.5 1.5H11"/><path d="M14 8h2M14 12h2"/>',
    quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.6 2.6 0 1 1 4.2 2.1c-.9.7-1.7 1.2-1.7 2.4"/><path d="M12 17h.01"/>',
    cards: '<rect x="3.5" y="6" width="12" height="15" rx="2"/><path d="M8 3h9.5A2.5 2.5 0 0 1 20 5.5V16"/>',
    mistakes: '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/><path d="M9 8h6M9 12h4"/>',
    planner: '<rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M8 3v4M16 3v4M3.5 10h17"/><path d="m8 15 2 2 4-4"/>',
    achievements: '<circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5 7 21l5-2.5L17 21l-1.5-7.5"/>',
    analytics: '<path d="M4 20v-6M9 20V8M14 20v-9M19 20V4"/><path d="M2.5 20h19"/>',
    settings: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6h.09A1.7 1.7 0 0 0 10.1 3.05V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.09a1.7 1.7 0 0 0 1.55 1.01H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9S9.6 5.6 12 3z"/>',
    flame: '<path d="M12 3c3 3.5 5.5 5.6 5.5 9a5.5 5.5 0 0 1-11 0C6.5 8.6 9 6.5 12 3z"/><path d="M12 12c1.2 1.4 2 2.3 2 3.6a2 2 0 0 1-4 0c0-1.3.8-2.2 2-3.6z"/>',
    spark: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
    arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    arrowLeft: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    chevronRight: '<path d="M9 6l6 6-6 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 13l4 4L19 7"/>',
    book: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M11 4h6.5A1.5 1.5 0 0 1 19 5.5v13a1.5 1.5 0 0 1-1.5 1.5H11"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    star: '<path d="M12 3l2.5 5.4 5.9.8-4.3 4.1 1.1 5.8-5.2-2.9-5.2 2.9 1.1-5.8L3.6 9.2l5.9-.8z"/>',
    bolt: '<path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z"/>',
    refresh: '<path d="M3.5 12a8.5 8.5 0 0 1 14.6-5.9L21 9"/><path d="M21 4v5h-5"/><path d="M20.5 12a8.5 8.5 0 0 1-14.6 5.9L3 15"/><path d="M3 20v-5h5"/>',
    lock: '<rect x="4.5" y="10" width="15" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    send: '<path d="M4 12 20 4l-6 16-2.5-6.5z"/><path d="M11.5 13.5 20 4"/>',
    play: '<path d="M8 5l11 7-11 7z"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>'
  };

  function icon(name, cls) {
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }

  /* ── Language ──────────────────────────────────────────── */
  var I18N = {
    zh: {
      'brand.sub': '学习伙伴',
      'common.langName': 'English',
      'common.navAria': 'Synapse 导航',
      'common.primaryAria': '主要导航',
      'meta.title': 'Synapse — AI 学习伙伴',
      'common.switchLang': '切换语言',
      'common.skip': '跳过',
      'common.back': '返回',
      'common.next': '下一步',
      'common.continue': '继续',
      'common.cancel': '取消',
      'common.close': '关闭',
      'common.confirm': '确认',
      'common.open': '打开',
      'common.viewAll': '查看全部',
      'common.demoData': '演示数据',
      'common.pointsUnit': '积分',
      'common.levelUnit': '等级',
      'common.daysUnit': '天',
      'common.minUnit': '分钟',
      'common.hoursUnit': '小时',
      'common.resetDone': '演示数据已重置。',
      'common.notFoundTitle': '这里没有页面。',
      'common.notFoundBody': '换一个入口继续。',
      'common.goDashboard': '回到仪表盘',

      'nav.dashboard': '仪表盘',
      'nav.tutor': 'AI 导师',
      'nav.materials': '学习资料',
      'nav.quiz': '测验',
      'nav.flashcards': '闪卡',
      'nav.mistakes': '错题本',
      'nav.planner': '学习计划',
      'nav.achievements': '成就',
      'nav.analytics': '数据分析',
      'nav.settings': '设置',
      'nav.menu': '打开导航',
      'nav.primary': '主导航',

      'onboarding.welcomeEyebrow': '欢迎来到 Synapse',
      'onboarding.welcomeTitle': '你的知识，会在这里连成一片。',
      'onboarding.welcomeBody': '计划、阅读、测验，围绕你自己的材料。AI 只在需要时出现，先给提示，再给答案。',
      'onboarding.start': '开始设置',
      'onboarding.goalEyebrow': '学习目标',
      'onboarding.goalTitle': '你这次想达成什么？',
      'onboarding.goalBody': '可多选。它会决定计划与复习的默认节奏。',
      'onboarding.goalExam': '备战考试',
      'onboarding.goalExamDesc': '按考纲拆解，优先补齐薄弱节点。',
      'onboarding.goalUnderstand': '深入理解概念',
      'onboarding.goalUnderstandDesc': '先解释、再提问，不直接给答案。',
      'onboarding.goalRevise': '高效复习',
      'onboarding.goalReviseDesc': '用闪卡与错题本压缩复习时间。',
      'onboarding.goalPractice': '做题练习',
      'onboarding.goalPracticeDesc': '从材料出题，用证据更新掌握度。',
      'onboarding.pickOne': '先选至少一个目标。',
      'onboarding.readyEyebrow': '准备好了',
      'onboarding.readyTitle': '先从一个真实目标开始。',
      'onboarding.readyBody': '下一步进入仪表盘。材料与进度只保存在这台设备上。',
      'onboarding.enter': '进入仪表盘',
      'onboarding.step': '第 {n} 步，共 3 步',

      'dashboard.eyebrow': '仪表盘',
      'dashboard.greetingA': '早上好，',
      'dashboard.greetingB': '。',
      'dashboard.greetingSub': '先看今天的状态，再决定学什么。',
      'dashboard.streak': '连续 {n} 天',
      'dashboard.streakRule': '每天至少一次有效作答',
      'dashboard.weeklyGoal': '本周目标',
      'dashboard.weeklyGoalSub': '{done} / {target} 个学习时段',
      'dashboard.accuracy': '正确率',
      'dashboard.accuracySub': '近 30 次作答',
      'dashboard.studyTime': '学习时长',
      'dashboard.studyTimeSub': '本周累计',
      'dashboard.level': '等级 {n}',
      'dashboard.levelSub': '{points} 积分 · 只读状态',
      'dashboard.pointsSub': '积分 · 只读状态',
      'dashboard.levelLabel': '等级',
      'dashboard.weeklyRing': '本周进度',
      'dashboard.ringSub': '{done} / {target} 个时段',
      'dashboard.quickActions': '快捷开始',
      'dashboard.continueReading': '继续阅读',
      'dashboard.continueReadingSub': 'COMP5241 Lecture 4 · 第 7 页',
      'dashboard.recent': '最近成就',
      'dashboard.quickQuiz': '开始测验',
      'dashboard.quickQuizDesc': '从材料生成 8 道题',
      'dashboard.quickCards': '闪卡复习',
      'dashboard.quickCardsDesc': '先回想，再翻面',
      'dashboard.quickMaterials': '学习资料',
      'dashboard.quickMaterialsDesc': '5 份材料 · 3 个标签',
      'dashboard.quickTutor': '问 AI 导师',
      'dashboard.quickTutorDesc': '带着上下文提问',
      'dashboard.readerToast': '沉浸式阅读器在计划流程中打开；这里先回到材料列表。',

      'tutor.eyebrow': 'AI 导师',
      'tutor.title': '一个知道你在学什么的对话。',
      'tutor.subtitle': '提示优先，答案永远可达。',
      'tutor.suggestExplain': '解释概念',
      'tutor.suggestQuiz': '考考我',
      'tutor.suggestSummary': '总结笔记',
      'tutor.suggestMistake': '解释错误',
      'tutor.placeholder': '问一个关于材料的问题…',
      'tutor.send': '发送',
      'tutor.typing': '正在组织提示…',
      'tutor.demoNote': '演示回复基于关键词，不代表已检索你的材料。',
      'tutor.initial': '我在读你正在看的这一页。想先要一个提示，还是直接看答案？',
      'tutor.replyExplain': '先往这个方向想：把概念拆成「它解决什么问题」和「它牺牲了什么」。你更想先谈哪一半？需要更多提示随时说。',
      'tutor.replyQuiz': '好，先不揭晓。用一句话说说：这个机制在什么情况下会失效？说完我再判断。',
      'tutor.replySummary': '这页的主线是「先建立边界，再谈优化」。我可以把三段压缩成三行，但先确认：你要的是考前速览，还是理解脉络？',
      'tutor.replyMistake': '错因通常不在结论，而在你跳过的那一步假设。把你当时的推理写出来，我帮你找到断点。',
      'tutor.replyGeneric': '先把问题落到具体一段材料上：你在哪一页、哪一句卡住了？有原文，我才能给可核对的提示。',
      'tutor.replyBeyond': '这一页答不了这个问题。我可以基于通用知识回答，但会明确标注不是来自你的材料。要继续吗？',

      'materials.eyebrow': '学习资料',
      'materials.title': '你的材料，按标签归档。',
      'materials.subtitle': '{n} 份文件 · 只在计划或任务中附加',
      'materials.upload': '添加材料',
      'materials.uploadHint': '在计划或学习任务中附加 PDF / Markdown（≤20MB）',
      'materials.uploadToast': '请在学习计划或任务中附加材料。',
      'materials.search': '搜索标题、标签…',
      'materials.tagAll': '全部',
      'materials.tagCourse': '课程',
      'materials.tagNotes': '笔记',
      'materials.tagExam': '备考',
      'materials.empty': '没有匹配的材料。',
      'materials.emptyHint': '换个关键词，或清除标签筛选。',
      'materials.pages': '{n} 页',
      'materials.updated': '更新于 {d}',
      'materials.open': '打开阅读',
      'materials.readerToast': '沉浸式阅读器将在计划流程中打开。',
      'materials.filePdf': 'PDF',
      'materials.fileMd': 'Markdown',

      'quiz.eyebrow': '测验',
      'quiz.title': '用证据检验理解。',
      'quiz.subtitle': '一次一题，先作答，再看解释。',
      'quiz.startTitle': '准备开始一轮混合测验',
      'quiz.startBody': '从 3 份材料生成 8 道题，覆盖选择题与简答题。提示免费，看答案记为放弃。',
      'quiz.metaCount': '8 道题',
      'quiz.metaMode': '选择 + 简答',
      'quiz.metaHint': '免费提示',
      'quiz.start': '开始测验',
      'quiz.generate': '从资料生成',
      'quiz.generating': '正在从 3 份材料生成…',
      'quiz.generated': '已生成 8 道题。',
      'quiz.startNote': '结果只会更新与题目相关的主题掌握度；不会因为阅读时长加分。',
      'quiz.question': '第 {i} / {n} 题',
      'quiz.score': '得分',
      'quiz.hint': '✦ 提示（免费）',
      'quiz.hintLabel': '提示',
      'quiz.reveal': '直接看答案',
      'quiz.forfeitNote': '看了答案 = 放弃此题 · 已记入错题',
      'quiz.submit': '提交答案',
      'quiz.confirm': '确认作答',
      'quiz.next': '下一题',
      'quiz.finish': '查看结果',
      'quiz.openPlaceholder': '用一两句话写下你的答案…',
      'quiz.grading': '对照材料评分中…',
      'quiz.correct': '正确',
      'quiz.partial': '部分正确',
      'quiz.wrong': '需要再练',
      'quiz.forfeited': '已放弃',
      'quiz.reference': '参考答案',
      'quiz.why': '解析',
      'quiz.source': '来源',
      'quiz.exit': '退出测验',
      'quiz.exitTitle': '退出测验？',
      'quiz.exitBody': '当前进度会丢失；已作答的题目仍会计入错题。',
      'quiz.exitStay': '继续作答',
      'quiz.exitLeave': '退出',
      'quiz.resultsEyebrow': '测验结果',
      'quiz.resultsTitle': '证据已经更新。',
      'quiz.resultsHead': '本轮测验已归档。',
      'quiz.resultsSub': '答对 {c} 题，部分正确 {p} 题，共 {n} 题。',
      'quiz.pointsEarned': '+{n} 积分',
      'quiz.evidenceLogged': '{n} 条证据已记录',
      'quiz.masteryDeltas': '掌握度变化',
      'quiz.mistakesTitle': '错题回顾',
      'quiz.retry': '再来一轮',
      'quiz.backHome': '返回仪表盘',
      'quiz.answerAll': '先完成本题再继续。',
      'quiz.keyboardHint': '键盘：1–4 选择 · Enter 确认 · Esc 退出',
      'quiz.emptyAnswer': '写下答案后再提交。',
      'quiz.typeChoice': '选择题',
      'quiz.typeOpen': '简答题',
      'quiz.yourGiven': '你的答案',
      'quiz.noMistakes': '这一轮没有错题。',
      'quiz.nodeMastered': '已掌握',
      'quiz.nodePartial': '部分掌握',
      'quiz.nodeUncovered': '尚无证据',
      'quiz.noChange': '暂无变化',

      'flash.eyebrow': '闪卡',
      'flash.title': '先回想，再翻面。',
      'flash.subtitle': '空格翻面 · 方向键切换',
      'flash.progress': '第 {i} / {n} 张',
      'flash.front': '问题',
      'flash.back': '答案',
      'flash.flip': '翻面',
      'flash.hint': '先在心里回答，再翻面核对。',
      'flash.spaceHint': '按空格翻面',
      'flash.difficulty': '这张有多难？',
      'flash.hard': '难',
      'flash.medium': '中',
      'flash.easy': '易',
      'flash.next': '下一张',
      'flash.prev': '上一张',
      'flash.finish': '结束复习',
      'flash.summaryTitle': '这一轮结束了。',
      'flash.summaryCardTitle': '复习小结',
      'flash.summaryBody': '复习了 {n} 张卡，{easy} 张标记为「易」。',
      'flash.reviewed': '张已复习',
      'flash.again': '再复习一轮',
      'flash.backHome': '返回仪表盘',
      'flash.source': '来源',
      'flash.rateFirst': '先翻面，再自评难度。',

      'mistakes.eyebrow': '错题本',
      'mistakes.title': '错因比答案更有用。',
      'mistakes.subtitle': '3 道演示错题 · 复盘后重新出题',
      'mistakes.weakTitle': '薄弱主题',
      'mistakes.weakBody': '最近 30 次作答中，以下主题低于 80%。',
      'mistakes.review': '重新练习',
      'mistakes.reviewToast': '已从错题本生成 3 道复习题。',
      'mistakes.yourAnswer': '你的答案',
      'mistakes.correctAnswer': '正确答案',
      'mistakes.analysis': 'AI 解析',
      'mistakes.date1': '10 月 30 日',
      'mistakes.date2': '10 月 29 日',
      'mistakes.date3': '10 月 27 日',

      'planner.eyebrow': '学习计划',
      'planner.title': '今天，先做这几件。',
      'planner.subtitle': '完成状态只影响今天，不改变掌握度。',
      'planner.dayProgress': '今日进度',
      'planner.daySub': '{done} / {total} 个任务完成',
      'planner.high': '高',
      'planner.medium': '中',
      'planner.low': '低',
      'planner.ai': 'AI 建议',
      'planner.done': '已完成',
      'planner.markDone': '标记完成',
      'planner.markUndone': '标记未完成',
      'planner.streakNote': '连续 {n} 天 · 每天至少一次有效作答',
      'planner.task1': '复习「集成测试」错题',
      'planner.task1Meta': '25 分钟 · 来自错题本',
      'planner.task2': '读完 Lecture 4 第 7–12 页',
      'planner.task2Meta': '40 分钟 · 继续上次位置',
      'planner.task3': '闪卡：设计模式 8 张',
      'planner.task3Meta': '12 分钟 · 到期复习',
      'planner.task4': '整理需求追踪矩阵',
      'planner.task4Meta': '30 分钟 · 手动添加',
      'planner.task5': '做一轮 8 题混合测验',
      'planner.task5Meta': '20 分钟 · 覆盖 3 个主题',

      'ach.eyebrow': '成就',
      'ach.title': '徽章记录真实的行为。',
      'ach.subtitle': '{n} / 12 已解锁 · 演示解锁状态',
      'ach.streak': '连续天数',
      'ach.level': '当前等级',
      'ach.badges': '获得徽章',
      'ach.unlocked': '已解锁',
      'ach.locked': '未解锁',
      'ach.progress': '{n} / 12',
      'ach.b1': '初次测验',
      'ach.b1d': '完成第一次测验',
      'ach.b2': '三日连续',
      'ach.b2d': '连续 3 天有证据',
      'ach.b3': '七日连续',
      'ach.b3d': '连续 7 天有证据',
      'ach.b4': '闪卡入门',
      'ach.b4d': '复习 10 张闪卡',
      'ach.b5': '百题斩',
      'ach.b5d': '累计作答 100 题',
      'ach.b6': '错题复盘',
      'ach.b6d': '复盘 5 道错题',
      'ach.b7': '驾驭设计',
      'ach.b7d': '软件设计节点 ≥80%',
      'ach.b8': '需求侦探',
      'ach.b8d': '需求工程节点 ≥80%',
      'ach.b9': '测试通关',
      'ach.b9d': '软件测试节点 ≥80%',
      'ach.b10': '专注一小时',
      'ach.b10d': '单日累计 60 分钟',
      'ach.b11': '全绿节点',
      'ach.b11d': '一个计划所有节点掌握',
      'ach.b12': '可以进考场',
      'ach.b12d': '掌握度达到 100%',

      'analytics.eyebrow': '数据分析',
      'analytics.title': '只统计证据，不统计停留。',
      'analytics.subtitle': '演示数据 · 真实证据接入后自动替换',
      'analytics.weekly': '本周学习',
      'analytics.weeklyVal': '{n} 小时',
      'analytics.accuracy': '平均正确率',
      'analytics.answers': '累计作答',
      'analytics.nodes': '已掌握节点',
      'analytics.chartWeekly': '每日学习时长',
      'analytics.chartWeeklySub': '分钟 · 本周',
      'analytics.chartAccuracy': '正确率趋势',
      'analytics.chartAccuracySub': '近 7 次测验',
      'analytics.chartTopics': '主题掌握度',
      'analytics.chartTopicsSub': '按知识节点聚合 · 0–100%',
      'analytics.chartNote': '本周共 {n} 分钟。掌握度来自测验证据，不包含阅读时长。',
      'analytics.topicUsability': '可用性',
      'analytics.topicCognition': '认知负荷',
      'analytics.topicDesign': '软件设计',
      'analytics.topicRequirements': '需求工程',
      'analytics.topicTesting': '软件测试',
      'analytics.quizLabel': '第 {n} 次',

      'settings.eyebrow': '设置',
      'settings.title': '把环境调成适合学习的样子。',
      'settings.subtitle': '当前版本只保留本地设置，没有账号系统。',
      'settings.profile': '个人资料',
      'settings.profileMeta': '等级 {level} · {points} 积分',
      'settings.profileNote': '名字与进度只保存在这台设备。',
      'settings.language': '语言',
      'settings.languageNote': '切换立即生效，不重新加载。',
      'settings.langZh': '中文',
      'settings.langEn': 'English',
      'settings.langZhDesc': '界面与 AI 回复使用中文',
      'settings.langEnDesc': '界面与 AI 回复使用英文',
      'settings.appearance': '外观',
      'settings.appearanceNote': '当前版本只提供浅色主题；深色模式不在本阶段。',
      'settings.appearanceValue': '暖色浅色主题',
      'settings.theme': '主题',
      'settings.lightOnly': '仅浅色',
      'settings.data': '演示数据',
      'settings.dataNote': '进度保存在内存中，刷新后重置。',
      'settings.reset': '重置演示数据',
      'settings.resetTitle': '重置演示数据？',
      'settings.resetBody': '积分、等级、测验与复习进度会回到初始状态。语言设置保留。',
      'settings.keyboard': '键盘',
      'settings.keyboardNote': 'Tab 顺序跟随阅读顺序；Esc 关闭最上层。'
    },
    en: {
      'brand.sub': 'Study companion',
      'common.langName': '中文',
      'common.navAria': 'Synapse navigation',
      'common.primaryAria': 'Primary',
      'meta.title': 'Synapse — AI study companion',
      'common.switchLang': 'Switch language',
      'common.skip': 'Skip',
      'common.back': 'Back',
      'common.next': 'Next',
      'common.continue': 'Continue',
      'common.cancel': 'Cancel',
      'common.close': 'Close',
      'common.confirm': 'Confirm',
      'common.open': 'Open',
      'common.viewAll': 'View all',
      'common.demoData': 'Demo data',
      'common.pointsUnit': 'points',
      'common.levelUnit': 'Level',
      'common.daysUnit': 'days',
      'common.minUnit': 'min',
      'common.hoursUnit': 'hours',
      'common.resetDone': 'Demo data reset.',
      'common.notFoundTitle': 'Nothing here.',
      'common.notFoundBody': 'Pick another starting point.',
      'common.goDashboard': 'Back to dashboard',

      'nav.dashboard': 'Dashboard',
      'nav.tutor': 'AI Tutor',
      'nav.materials': 'Materials',
      'nav.quiz': 'Quiz',
      'nav.flashcards': 'Flashcards',
      'nav.mistakes': 'Mistakes',
      'nav.planner': 'Planner',
      'nav.achievements': 'Achievements',
      'nav.analytics': 'Analytics',
      'nav.settings': 'Settings',
      'nav.menu': 'Open navigation',
      'nav.primary': 'Primary',

      'onboarding.welcomeEyebrow': 'Welcome to Synapse',
      'onboarding.welcomeTitle': 'Your knowledge, connected.',
      'onboarding.welcomeBody': 'Plans, reading, and quizzes built around your own materials. The AI shows up when it helps — hint first, answer when asked.',
      'onboarding.start': 'Get started',
      'onboarding.goalEyebrow': 'Study goal',
      'onboarding.goalTitle': 'What are you here to do?',
      'onboarding.goalBody': 'Choose any. It shapes your plan and review rhythm.',
      'onboarding.goalExam': 'Prepare for an exam',
      'onboarding.goalExamDesc': 'Break down the syllabus and close weak nodes first.',
      'onboarding.goalUnderstand': 'Understand concepts deeply',
      'onboarding.goalUnderstandDesc': 'Explain first, then ask — not answer-first.',
      'onboarding.goalRevise': 'Revise efficiently',
      'onboarding.goalReviseDesc': 'Compress review time with flashcards and mistakes.',
      'onboarding.goalPractice': 'Practice questions',
      'onboarding.goalPracticeDesc': 'Generate questions from materials and update mastery with evidence.',
      'onboarding.pickOne': 'Pick at least one goal first.',
      'onboarding.readyEyebrow': 'You are set',
      'onboarding.readyTitle': 'Start with one real goal.',
      'onboarding.readyBody': 'Next stop: your dashboard. Materials and progress stay on this device.',
      'onboarding.enter': 'Enter dashboard',
      'onboarding.step': 'Step {n} of 3',

      'dashboard.eyebrow': 'Dashboard',
      'dashboard.greetingA': 'Good morning, ',
      'dashboard.greetingB': '.',
      'dashboard.greetingSub': 'Check where you stand, then choose what to study.',
      'dashboard.streak': '{n}-day streak',
      'dashboard.streakRule': 'At least one evidence session a day',
      'dashboard.weeklyGoal': 'Weekly goal',
      'dashboard.weeklyGoalSub': '{done} of {target} study sessions',
      'dashboard.accuracy': 'Accuracy',
      'dashboard.accuracySub': 'Last 30 answers',
      'dashboard.studyTime': 'Study time',
      'dashboard.studyTimeSub': 'This week',
      'dashboard.level': 'Level {n}',
      'dashboard.levelSub': '{points} points · read-only',
      'dashboard.pointsSub': 'points · read-only',
      'dashboard.levelLabel': 'Level',
      'dashboard.weeklyRing': 'This week',
      'dashboard.ringSub': '{done} of {target} sessions',
      'dashboard.quickActions': 'Quick start',
      'dashboard.continueReading': 'Continue reading',
      'dashboard.continueReadingSub': 'COMP5241 Lecture 4 · page 7',
      'dashboard.recent': 'Recent achievements',
      'dashboard.quickQuiz': 'Start a quiz',
      'dashboard.quickQuizDesc': '8 questions from your materials',
      'dashboard.quickCards': 'Review flashcards',
      'dashboard.quickCardsDesc': 'Recall first, then flip',
      'dashboard.quickMaterials': 'Materials',
      'dashboard.quickMaterialsDesc': '5 files · 3 tags',
      'dashboard.quickTutor': 'Ask the AI tutor',
      'dashboard.quickTutorDesc': 'Ask with context',
      'dashboard.readerToast': 'The immersive reader opens inside the plan flow; taking you to Materials for now.',

      'tutor.eyebrow': 'AI Tutor',
      'tutor.title': 'A conversation that knows what you are studying.',
      'tutor.subtitle': 'Hint first. Answers always within reach.',
      'tutor.suggestExplain': 'Explain a concept',
      'tutor.suggestQuiz': 'Quiz me',
      'tutor.suggestSummary': 'Summarize notes',
      'tutor.suggestMistake': 'Explain a mistake',
      'tutor.placeholder': 'Ask about your material…',
      'tutor.send': 'Send',
      'tutor.typing': 'Shaping a hint…',
      'tutor.demoNote': 'Demo replies are keyword-based and do not claim to retrieve your materials.',
      'tutor.initial': 'I am reading the page you are on. Want a hint first, or the answer?',
      'tutor.replyExplain': 'Try this direction: split the concept into "what problem it solves" and "what it costs." Which half should we take first? More hints whenever you ask.',
      'tutor.replyQuiz': 'Okay, no reveal yet. In one sentence: when does this mechanism fail? Answer, then I will respond.',
      'tutor.replySummary': 'The page argues "set boundaries first, then optimize." I can compress three sections into three lines — but first: exam skim or conceptual thread?',
      'tutor.replyMistake': 'The error usually sits in the assumption you skipped, not the conclusion. Write your reasoning and I will find the break.',
      'tutor.replyGeneric': 'Anchor the question to a specific passage: which page, which sentence? With the source, I can give a checkable hint.',
      'tutor.replyBeyond': 'This page cannot answer that. I can answer from general knowledge, clearly labeled as outside your material. Continue?',

      'materials.eyebrow': 'Materials',
      'materials.title': 'Your materials, filed by tag.',
      'materials.subtitle': '{n} files · attach inside a plan or task',
      'materials.upload': 'Add material',
      'materials.uploadHint': 'Attach PDF or Markdown inside a plan or study task (≤20 MB)',
      'materials.uploadToast': 'Attach materials inside a study plan or task.',
      'materials.search': 'Search titles and tags…',
      'materials.tagAll': 'All',
      'materials.tagCourse': 'Course',
      'materials.tagNotes': 'Notes',
      'materials.tagExam': 'Exam',
      'materials.empty': 'No matching materials.',
      'materials.emptyHint': 'Try another term, or clear the tag filter.',
      'materials.pages': '{n} pages',
      'materials.updated': 'Updated {d}',
      'materials.open': 'Open reader',
      'materials.readerToast': 'The immersive reader opens inside the plan flow.',
      'materials.filePdf': 'PDF',
      'materials.fileMd': 'Markdown',

      'quiz.eyebrow': 'Quiz',
      'quiz.title': 'Test understanding with evidence.',
      'quiz.subtitle': 'One question at a time. Answer first, then see why.',
      'quiz.startTitle': 'Start a mixed quiz',
      'quiz.startBody': '8 questions from 3 materials, mixing choice and open. Hints are free; revealing counts as a forfeit.',
      'quiz.metaCount': '8 questions',
      'quiz.metaMode': 'Choice + open',
      'quiz.metaHint': 'Free hints',
      'quiz.start': 'Start quiz',
      'quiz.generate': 'Generate from materials',
      'quiz.generating': 'Generating from 3 materials…',
      'quiz.generated': '8 questions generated.',
      'quiz.startNote': 'Results update only the mastery of the topics involved. Reading time never adds points.',
      'quiz.question': 'Question {i} of {n}',
      'quiz.score': 'Score',
      'quiz.hint': '✦ Hint (free)',
      'quiz.hintLabel': 'Hint',
      'quiz.reveal': 'Show the answer',
      'quiz.forfeitNote': 'Revealed = forfeited · logged as a mistake',
      'quiz.submit': 'Submit answer',
      'quiz.confirm': 'Confirm',
      'quiz.next': 'Next question',
      'quiz.finish': 'See results',
      'quiz.openPlaceholder': 'Write your answer in one or two sentences…',
      'quiz.grading': 'Grading against your material…',
      'quiz.correct': 'Correct',
      'quiz.partial': 'Partially correct',
      'quiz.wrong': 'Needs work',
      'quiz.forfeited': 'Forfeited',
      'quiz.reference': 'Reference answer',
      'quiz.why': 'Why',
      'quiz.source': 'Source',
      'quiz.exit': 'Leave quiz',
      'quiz.exitTitle': 'Leave the quiz?',
      'quiz.exitBody': 'Progress will be lost. Answered questions stay logged as mistakes.',
      'quiz.exitStay': 'Keep going',
      'quiz.exitLeave': 'Leave',
      'quiz.resultsEyebrow': 'Results',
      'quiz.resultsTitle': 'Evidence updated.',
      'quiz.resultsHead': 'This round is archived.',
      'quiz.resultsSub': '{c} correct, {p} partial, {n} total.',
      'quiz.pointsEarned': '+{n} points',
      'quiz.evidenceLogged': '{n} evidence records saved',
      'quiz.masteryDeltas': 'Mastery changes',
      'quiz.mistakesTitle': 'Mistakes',
      'quiz.retry': 'New round',
      'quiz.backHome': 'Back to dashboard',
      'quiz.answerAll': 'Answer this question to continue.',
      'quiz.keyboardHint': 'Keys: 1–4 select · Enter confirm · Esc exit',
      'quiz.emptyAnswer': 'Write an answer before submitting.',
      'quiz.typeChoice': 'Choice',
      'quiz.typeOpen': 'Open',
      'quiz.yourGiven': 'Your answer',
      'quiz.noMistakes': 'No mistakes in this round.',
      'quiz.nodeMastered': 'Mastered',
      'quiz.nodePartial': 'Partial',
      'quiz.nodeUncovered': 'No evidence',
      'quiz.noChange': 'No change',

      'flash.eyebrow': 'Flashcards',
      'flash.title': 'Recall first, then flip.',
      'flash.subtitle': 'Space to flip · arrows to move',
      'flash.progress': 'Card {i} of {n}',
      'flash.front': 'Prompt',
      'flash.back': 'Answer',
      'flash.flip': 'Flip',
      'flash.hint': 'Answer in your head, then flip to check.',
      'flash.spaceHint': 'Press space to flip',
      'flash.difficulty': 'How hard was it?',
      'flash.hard': 'Hard',
      'flash.medium': 'Medium',
      'flash.easy': 'Easy',
      'flash.next': 'Next card',
      'flash.prev': 'Previous',
      'flash.finish': 'End session',
      'flash.summaryTitle': 'Session complete.',
      'flash.summaryCardTitle': 'Session summary',
      'flash.summaryBody': 'Reviewed {n} cards, {easy} marked easy.',
      'flash.reviewed': 'reviewed',
      'flash.again': 'Review again',
      'flash.backHome': 'Back to dashboard',
      'flash.source': 'Source',
      'flash.rateFirst': 'Flip first, then rate the difficulty.',

      'mistakes.eyebrow': 'Mistakes',
      'mistakes.title': 'The reason matters more than the answer.',
      'mistakes.subtitle': '3 demo mistakes · re-quiz after review',
      'mistakes.weakTitle': 'Weak topics',
      'mistakes.weakBody': 'Below 80% across the last 30 answers.',
      'mistakes.review': 'Practice again',
      'mistakes.reviewToast': '3 review questions generated from your mistakes.',
      'mistakes.yourAnswer': 'Your answer',
      'mistakes.correctAnswer': 'Correct answer',
      'mistakes.analysis': 'AI note',
      'mistakes.date1': 'Oct 30',
      'mistakes.date2': 'Oct 29',
      'mistakes.date3': 'Oct 27',

      'planner.eyebrow': 'Planner',
      'planner.title': 'Three things for today.',
      'planner.subtitle': 'Completion affects today only, not mastery.',
      'planner.dayProgress': 'Today',
      'planner.daySub': '{done} of {total} tasks done',
      'planner.high': 'High',
      'planner.medium': 'Medium',
      'planner.low': 'Low',
      'planner.ai': 'AI suggested',
      'planner.done': 'Done',
      'planner.markDone': 'Mark done',
      'planner.markUndone': 'Mark not done',
      'planner.streakNote': '{n}-day streak · at least one evidence session a day',
      'planner.task1': 'Review integration-testing mistakes',
      'planner.task1Meta': '25 min · from Mistakes',
      'planner.task2': 'Read Lecture 4, pages 7–12',
      'planner.task2Meta': '40 min · continue where you left off',
      'planner.task3': 'Flashcards: 8 design-pattern cards',
      'planner.task3Meta': '12 min · due for review',
      'planner.task4': 'Tidy the requirements traceability matrix',
      'planner.task4Meta': '30 min · added manually',
      'planner.task5': 'Take an 8-question mixed quiz',
      'planner.task5Meta': '20 min · covers 3 topics',

      'ach.eyebrow': 'Achievements',
      'ach.title': 'Badges record real behaviour.',
      'ach.subtitle': '{n} of 12 unlocked · demo unlock states',
      'ach.streak': 'Streak',
      'ach.level': 'Level',
      'ach.badges': 'Badges',
      'ach.unlocked': 'Unlocked',
      'ach.locked': 'Locked',
      'ach.progress': '{n} / 12',
      'ach.b1': 'First quiz',
      'ach.b1d': 'Finish your first quiz',
      'ach.b2': 'Three-day streak',
      'ach.b2d': '3 evidence days in a row',
      'ach.b3': 'Seven-day streak',
      'ach.b3d': '7 evidence days in a row',
      'ach.b4': 'Flashcard starter',
      'ach.b4d': 'Review 10 flashcards',
      'ach.b5': 'Hundred answers',
      'ach.b5d': 'Answer 100 questions',
      'ach.b6': 'Mistake review',
      'ach.b6d': 'Review 5 mistakes',
      'ach.b7': 'Design driver',
      'ach.b7d': 'Software design node ≥80%',
      'ach.b8': 'Requirements detective',
      'ach.b8d': 'Requirements node ≥80%',
      'ach.b9': 'Testing passed',
      'ach.b9d': 'Software testing node ≥80%',
      'ach.b10': 'Focus hour',
      'ach.b10d': '60 minutes in one day',
      'ach.b11': 'All green',
      'ach.b11d': 'Every node in a plan mastered',
      'ach.b12': 'Ready',
      'ach.b12d': 'Mastery reaches 100%',

      'analytics.eyebrow': 'Analytics',
      'analytics.title': 'Measure evidence, not time-in-app.',
      'analytics.subtitle': 'Demo data · replaced when real evidence lands',
      'analytics.weekly': 'This week',
      'analytics.weeklyVal': '{n} h',
      'analytics.accuracy': 'Avg. accuracy',
      'analytics.answers': 'Answers',
      'analytics.nodes': 'Mastered nodes',
      'analytics.chartWeekly': 'Study time per day',
      'analytics.chartWeeklySub': 'Minutes · this week',
      'analytics.chartAccuracy': 'Accuracy trend',
      'analytics.chartAccuracySub': 'Last 7 quizzes',
      'analytics.chartTopics': 'Topic strength',
      'analytics.chartTopicsSub': 'Aggregated by knowledge node · 0–100%',
      'analytics.chartNote': '{n} minutes this week. Mastery comes from quiz evidence, not reading time.',
      'analytics.topicUsability': 'Usability',
      'analytics.topicCognition': 'Cognitive load',
      'analytics.topicDesign': 'Software design',
      'analytics.topicRequirements': 'Requirements',
      'analytics.topicTesting': 'Software testing',
      'analytics.quizLabel': 'Quiz {n}',

      'settings.eyebrow': 'Settings',
      'settings.title': 'Tune the room for studying.',
      'settings.subtitle': 'Phase 1 keeps local settings only. No accounts.',
      'settings.profile': 'Profile',
      'settings.profileMeta': 'Level {level} · {points} points',
      'settings.profileNote': 'Name and progress stay on this device.',
      'settings.language': 'Language',
      'settings.languageNote': 'Switches instantly, no reload.',
      'settings.langZh': '中文',
      'settings.langEn': 'English',
      'settings.langZhDesc': 'Interface and AI replies in Chinese',
      'settings.langEnDesc': 'Interface and AI replies in English',
      'settings.appearance': 'Appearance',
      'settings.appearanceNote': 'Light theme only in Phase 1; dark mode is out of scope.',
      'settings.appearanceValue': 'Warm light theme',
      'settings.theme': 'Theme',
      'settings.lightOnly': 'Light only',
      'settings.data': 'Demo data',
      'settings.dataNote': 'Progress lives in memory and resets on reload.',
      'settings.reset': 'Reset demo data',
      'settings.resetTitle': 'Reset demo data?',
      'settings.resetBody': 'Points, level, quiz and study progress return to their starting state. Language is kept.',
      'settings.keyboard': 'Keyboard',
      'settings.keyboardNote': 'Tab order follows reading order; Esc closes the topmost layer.'
    }
  };

  var LANG_KEY = 'synapse-lang';
  var ROUTES = ['onboarding', 'dashboard', 'ai-tutor', 'materials', 'quiz', 'flashcards', 'mistakes', 'planner', 'achievements', 'analytics', 'settings'];
  var NAV_ROUTES = [
    { route: 'dashboard', key: 'nav.dashboard', icon: 'home' },
    { route: 'ai-tutor', key: 'nav.tutor', icon: 'tutor' },
    { route: 'materials', key: 'nav.materials', icon: 'materials' },
    { route: 'quiz', key: 'nav.quiz', icon: 'quiz' },
    { route: 'flashcards', key: 'nav.flashcards', icon: 'cards' },
    { route: 'mistakes', key: 'nav.mistakes', icon: 'mistakes' },
    { route: 'planner', key: 'nav.planner', icon: 'planner' },
    { route: 'achievements', key: 'nav.achievements', icon: 'achievements' },
    { route: 'analytics', key: 'nav.analytics', icon: 'analytics' }
  ];
  var BOTTOM_ROUTES = ['dashboard', 'ai-tutor', 'quiz', 'flashcards', 'achievements'];

  function t(key, vars) {
    var dict = I18N[state.lang] || I18N.zh;
    var str = dict[key] != null ? dict[key] : key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        str = str.replace('{' + k + '}', vars[k]);
      });
    }
    return str;
  }
  function L(obj) {
    if (!obj) return '';
    return obj[state.lang] != null ? obj[state.lang] : (obj.zh || '');
  }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pct(n) { return Math.round(n) + '%'; }
  function num(n) { return Number(n).toLocaleString('en-US'); }

  /* ── Demo data ─────────────────────────────────────────── */
  var DEFAULT_PROGRESS = {
    points: 1750,
    streak: 5,
    level: 4,
    quizzesCompleted: 12,
    flashcardsReviewed: 46,
    studyMinutes: 468,
    correctAnswers: 124,
    totalAnswers: 151,
    weeklyGoal: 25,
    weeklyProgress: 17
  };
  var DEFAULT_MASTERY = { design: 84, requirements: 61, testing: 47 };
  var TOPICS = {
    design: { zh: '软件设计', en: 'Software design' },
    requirements: { zh: '需求工程', en: 'Requirements' },
    testing: { zh: '软件测试', en: 'Software testing' }
  };

  var MATERIALS = [
    { id: 'm1', title: { zh: 'COMP5241 Lecture 4 — 软件设计', en: 'COMP5241 Lecture 4 — Software design' }, type: 'pdf', pages: 24, size: '3.2 MB', tag: 'course', updated: { zh: '2 天前', en: '2 days ago' } },
    { id: 'm2', title: { zh: 'COMP5241 Lecture 5 — 测试与交付', en: 'COMP5241 Lecture 5 — Testing and delivery' }, type: 'pdf', pages: 18, size: '2.6 MB', tag: 'course', updated: { zh: '2 天前', en: '2 days ago' } },
    { id: 'm3', title: { zh: '需求工程速记', en: 'Requirements engineering notes' }, type: 'md', pages: 6, size: '18 KB', tag: 'notes', updated: { zh: '4 天前', en: '4 days ago' } },
    { id: 'm4', title: { zh: '期末复习清单', en: 'Final exam checklist' }, type: 'md', pages: 4, size: '12 KB', tag: 'exam', updated: { zh: '1 天前', en: '1 day ago' } },
    { id: 'm5', title: { zh: '设计模式笔记', en: 'Design patterns notes' }, type: 'pdf', pages: 12, size: '1.1 MB', tag: 'notes', updated: { zh: '6 天前', en: '6 days ago' } }
  ];

  var TAGS = [
    { id: 'all', key: 'materials.tagAll' },
    { id: 'course', key: 'materials.tagCourse' },
    { id: 'notes', key: 'materials.tagNotes' },
    { id: 'exam', key: 'materials.tagExam' }
  ];

  var TASKS = [
    { id: 't1', key: 'planner.task1', metaKey: 'planner.task1Meta', minutes: 25, priority: 'high', ai: true, done: false },
    { id: 't2', key: 'planner.task2', metaKey: 'planner.task2Meta', minutes: 40, priority: 'medium', ai: false, done: true },
    { id: 't3', key: 'planner.task3', metaKey: 'planner.task3Meta', minutes: 12, priority: 'low', ai: true, done: false },
    { id: 't4', key: 'planner.task4', metaKey: 'planner.task4Meta', minutes: 30, priority: 'medium', ai: false, done: false },
    { id: 't5', key: 'planner.task5', metaKey: 'planner.task5Meta', minutes: 20, priority: 'high', ai: false, done: false }
  ];

  var ACHIEVEMENTS = [
    { id: 'b1', emoji: '🎯', key: 'ach.b1', desc: 'ach.b1d', unlocked: true },
    { id: 'b2', emoji: '🔥', key: 'ach.b2', desc: 'ach.b2d', unlocked: true },
    { id: 'b3', emoji: '🔥', key: 'ach.b3', desc: 'ach.b3d', unlocked: false },
    { id: 'b4', emoji: '🃏', key: 'ach.b4', desc: 'ach.b4d', unlocked: true },
    { id: 'b5', emoji: '💯', key: 'ach.b5', desc: 'ach.b5d', unlocked: false },
    { id: 'b6', emoji: '🧭', key: 'ach.b6', desc: 'ach.b6d', unlocked: true },
    { id: 'b7', emoji: '🧱', key: 'ach.b7', desc: 'ach.b7d', unlocked: false },
    { id: 'b8', emoji: '🔍', key: 'ach.b8', desc: 'ach.b8d', unlocked: false },
    { id: 'b9', emoji: '🧪', key: 'ach.b9', desc: 'ach.b9d', unlocked: false },
    { id: 'b10', emoji: '⏳', key: 'ach.b10', desc: 'ach.b10d', unlocked: true },
    { id: 'b11', emoji: '🌿', key: 'ach.b11', desc: 'ach.b11d', unlocked: false },
    { id: 'b12', emoji: '🎓', key: 'ach.b12', desc: 'ach.b12d', unlocked: false }
  ];

  var MISTAKES = [
    {
      id: 'mk1',
      topic: { zh: '软件测试', en: 'Software testing' },
      dateKey: 'mistakes.date1',
      question: { zh: '集成测试的主要目的是什么？', en: 'What is the main purpose of integration testing?' },
      given: { zh: '集成测试就是把所有单元测试一次跑完。', en: 'Integration testing just runs all the unit tests at once.' },
      correct: { zh: '验证模块之间的接口与协作，不会替代单元测试。', en: 'Verify interfaces and collaboration between modules; it does not replace unit tests.' },
      note: { zh: '把「一起运行」当成了「验证协作」。下一步：为每个接口补一条失败路径。', en: 'You treated "run together" as "verify collaboration." Next: add one failure path per interface.' },
      source: { zh: 'COMP5241 Lecture 5 · 第 3 页', en: 'COMP5241 Lecture 5 · p.3' }
    },
    {
      id: 'mk2',
      topic: { zh: '需求工程', en: 'Requirements' },
      dateKey: 'mistakes.date2',
      question: { zh: '需求可追溯性最直接的用途是什么？', en: 'What is the most direct use of requirements traceability?' },
      given: { zh: '主要是给审计看的。', en: 'It is mainly for audits.' },
      correct: { zh: '变更时定位受影响的设计、实现与测试。', en: 'Locate affected design, implementation, and tests when change happens.' },
      note: { zh: '审计只是结果之一。把「变更影响分析」写在便签上，下次先想这一条。', en: 'Audit is a side effect. Put "change-impact analysis" on a sticky note and reach for it first.' },
      source: { zh: 'COMP5241 Lecture 1 · 第 12 页', en: 'COMP5241 Lecture 1 · p.12' }
    },
    {
      id: 'mk3',
      topic: { zh: '设计模式', en: 'Design patterns' },
      dateKey: 'mistakes.date3',
      question: { zh: '观察者模式让对象之间完全解耦了吗？', en: 'Does Observer fully decouple objects?' },
      given: { zh: '是的，订阅者完全不依赖主题。', en: 'Yes, subscribers have no dependency on the subject.' },
      correct: { zh: '它降低耦合，但订阅者仍依赖主题的接口。', en: 'It lowers coupling, but subscribers still depend on the subject interface.' },
      note: { zh: '「解耦」不是「零依赖」。记住保留接口这一层依赖，才算真的理解。', en: '"Lower coupling" is not "zero dependency." Keep the interface dependency in view.' },
      source: { zh: '设计模式笔记 · 第 4 页', en: 'Design patterns notes · p.4' }
    }
  ];

  var FLASHCARDS = [
    { id: 'f1', prompt: { zh: '集成测试与单元测试的边界在哪里？', en: 'What separates integration testing from unit testing?' }, answer: { zh: '单元测试验证单个模块；集成测试验证模块之间的协作与接口。', en: 'Unit tests check one module; integration tests check collaboration and interfaces between modules.' }, source: { zh: 'Lecture 5 · 第 3 页', en: 'Lecture 5 · p.3' } },
    { id: 'f2', prompt: { zh: '什么是需求可追溯性？', en: 'What is requirements traceability?' }, answer: { zh: '从需求到设计、实现与测试建立双向链接，任何变更都能找到受影响项。', en: 'Bidirectional links from requirements to design, implementation, and tests, so every change can find its affected items.' }, source: { zh: 'Lecture 1 · 第 12 页', en: 'Lecture 1 · p.12' } },
    { id: 'f3', prompt: { zh: '观察者模式解决什么问题？', en: 'What problem does Observer solve?' }, answer: { zh: '一对多依赖：状态变化时自动通知订阅者，同时降低耦合。', en: 'A one-to-many dependency: state changes notify subscribers automatically while lowering coupling.' }, source: { zh: '设计模式笔记 · 第 4 页', en: 'Design patterns notes · p.4' } },
    { id: 'f4', prompt: { zh: '边界值分析为什么有效？', en: 'Why does boundary-value analysis work?' }, answer: { zh: '缺陷更常出现在输入范围的边缘；取边界与临界值能提高命中率。', en: 'Defects cluster at range edges; testing boundaries and thresholds improves the hit rate.' }, source: { zh: 'Lecture 5 · 第 8 页', en: 'Lecture 5 · p.8' } },
    { id: 'f5', prompt: { zh: '高内聚、低耦合分别指什么？', en: 'What do high cohesion and low coupling mean?' }, answer: { zh: '模块内部职责集中；模块之间依赖尽量少。', en: 'Responsibilities stay focused inside a module; dependencies between modules stay few.' }, source: { zh: 'Lecture 4 · 第 6 页', en: 'Lecture 4 · p.6' } },
    { id: 'f6', prompt: { zh: '验收测试应该由谁定义？', en: 'Who should define acceptance tests?' }, answer: { zh: '由用户或客户与团队共同定义，验证系统是否满足业务需求。', en: 'Users or customers define them together with the team, verifying the system meets business needs.' }, source: { zh: 'Lecture 5 · 第 14 页', en: 'Lecture 5 · p.14' } },
    { id: 'f7', prompt: { zh: '策略模式的替换点在哪里？', en: 'Where does Strategy swap behaviour?' }, answer: { zh: '把可变算法封装成独立类，运行时注入，避免条件分支扩散。', en: 'Encapsulate varying algorithms in separate classes and inject them at runtime, avoiding branching sprawl.' }, source: { zh: '设计模式笔记 · 第 7 页', en: 'Design patterns notes · p.7' } },
    { id: 'f8', prompt: { zh: '为什么先写测试？', en: 'Why write tests first?' }, answer: { zh: '先把预期变成可执行断言，再实现，能逼出更清晰的接口与边界。', en: 'Turn expectations into executable assertions before implementing; clearer interfaces and boundaries follow.' }, source: { zh: 'Lecture 5 · 第 11 页', en: 'Lecture 5 · p.11' } }
  ];

  var QUIZ_BANK = [
    {
      id: 'q1', type: 'choice', topicKey: 'testing',
      prompt: { zh: '集成测试的主要目的是什么？', en: 'What is the main purpose of integration testing?' },
      options: [
        { zh: '验证单个函数', en: 'Verify one function' },
        { zh: '验证模块之间的接口与协作', en: 'Verify interfaces and collaboration between modules' },
        { zh: '取代验收测试', en: 'Replace acceptance testing' },
        { zh: '测量代码覆盖率', en: 'Measure code coverage' }
      ],
      answer: 1,
      hint: { zh: '想「模块之间」，而不是「模块内部」。', en: 'Think "between modules," not "inside one module."' },
      why: { zh: '集成测试关注模块拼起来之后的行为：接口契约、数据传递与协作顺序。单元测试解决的是模块内部。', en: 'Integration testing looks at behaviour once modules are combined: interface contracts, data passing, and collaboration order. Unit tests cover the inside of one module.' },
      source: { zh: 'COMP5241 Lecture 5 · 第 3 页', en: 'COMP5241 Lecture 5 · p.3' }
    },
    {
      id: 'q2', type: 'choice', topicKey: 'requirements',
      prompt: { zh: '需求可追溯性最直接的用途是什么？', en: 'What is the most direct use of requirements traceability?' },
      options: [
        { zh: '让文档更厚', en: 'Make documents longer' },
        { zh: '变更时找到受影响的设计与测试', en: 'Find affected design and tests when change happens' },
        { zh: '替代用户访谈', en: 'Replace user interviews' },
        { zh: '自动生成代码', en: 'Generate code automatically' }
      ],
      answer: 1,
      hint: { zh: '从「改一条需求，谁会受影响」倒推。', en: 'Work backwards from "one requirement changes — who is affected?"' },
      why: { zh: '追溯矩阵把需求与设计、实现、测试连起来，变更影响分析才有依据。审计只是附带结果。', en: 'A traceability matrix links requirements to design, implementation, and tests so change-impact analysis has evidence. Audit is a side effect.' },
      source: { zh: 'COMP5241 Lecture 1 · 第 12 页', en: 'COMP5241 Lecture 1 · p.12' }
    },
    {
      id: 'q3', type: 'open', topicKey: 'design',
      prompt: { zh: '用一句话解释「高内聚」。', en: 'Explain "high cohesion" in one sentence.' },
      reference: { zh: '一个模块内部的职责集中、围绕同一目标，改动原因尽量少。', en: 'A module keeps its responsibilities focused on one purpose, so it has few reasons to change.' },
      hint: { zh: '从「改一处会不会牵动很多无关代码」倒推。', en: 'Work backwards from "does one change drag in unrelated code?"' },
      why: { zh: '高内聚说的是模块内部：职责越集中，理解与修改的成本越低。它与模块之间的耦合是两件事。', en: 'High cohesion is about the inside of a module: the more focused the responsibilities, the cheaper it is to understand and change. Coupling between modules is a separate concern.' },
      source: { zh: 'COMP5241 Lecture 4 · 第 6 页', en: 'COMP5241 Lecture 4 · p.6' },
      keywords: {
        zh: ['职责', '集中', '单一', '模块', '内聚'],
        en: ['responsib', 'focus', 'single', 'module', 'cohes']
      }
    },
    {
      id: 'q4', type: 'choice', topicKey: 'design',
      prompt: { zh: '观察者模式属于哪一类设计模式？', en: 'Which category does Observer belong to?' },
      options: [
        { zh: '创建型', en: 'Creational' },
        { zh: '结构型', en: 'Structural' },
        { zh: '行为型', en: 'Behavioural' },
        { zh: '架构型', en: 'Architectural' }
      ],
      answer: 2,
      hint: { zh: '它关心对象之间如何通知与响应。', en: 'It is about how objects notify and respond to each other.' },
      why: { zh: '观察者描述对象之间的通信与职责分配，属于行为型；创建型管对象创建，结构型管组合方式。', en: 'Observer describes communication and responsibility between objects, so it is behavioural. Creational patterns handle creation; structural patterns handle composition.' },
      source: { zh: '设计模式笔记 · 第 4 页', en: 'Design patterns notes · p.4' }
    },
    {
      id: 'q5', type: 'choice', topicKey: 'testing',
      prompt: { zh: '边界值分析最关注哪些输入？', en: 'Which inputs does boundary-value analysis target?' },
      options: [
        { zh: '最常见的输入', en: 'The most common inputs' },
        { zh: '范围的边缘与临界值', en: 'Edges and thresholds of a range' },
        { zh: '随机输入', en: 'Random inputs' },
        { zh: '最长的输入', en: 'The longest inputs' }
      ],
      answer: 1,
      hint: { zh: '缺陷常常藏在「刚好越界」的地方。', en: 'Defects often hide exactly where a value crosses the line.' },
      why: { zh: '边界值分析取上界、下界与临界点，因为实现中的比较条件最容易在这些位置出错。', en: 'Boundary-value analysis tests upper, lower, and threshold values because comparison logic is most likely to fail there.' },
      source: { zh: 'COMP5241 Lecture 5 · 第 8 页', en: 'COMP5241 Lecture 5 · p.8' }
    },
    {
      id: 'q6', type: 'open', topicKey: 'testing',
      prompt: { zh: '为什么「先写测试」能改善接口设计？', en: 'Why does writing tests first improve interface design?' },
      reference: { zh: '测试迫使你先从调用者视角描述预期，接口会更清晰，边界也更早暴露。', en: 'Tests force you to describe expectations from the caller side, so interfaces get clearer and boundaries surface earlier.' },
      hint: { zh: '想想写测试时，你被迫先决定什么。', en: 'Think about what you are forced to decide while writing the test.' },
      why: { zh: '测试是接口的第一个使用者。先写测试会把「怎么调用」提前到设计阶段，避免实现完才发现接口难用。', en: 'A test is the interface\u2019s first user. Writing it first pulls "how it is called" into design, before an awkward interface ships.' },
      source: { zh: 'COMP5241 Lecture 5 · 第 11 页', en: 'COMP5241 Lecture 5 · p.11' },
      keywords: {
        zh: ['接口', '调用', '边界', '预期', '使用'],
        en: ['interface', 'call', 'boundary', 'expect', 'use']
      }
    },
    {
      id: 'q7', type: 'choice', topicKey: 'design',
      prompt: { zh: '低耦合最直接的好处是什么？', en: 'What is the most direct benefit of low coupling?' },
      options: [
        { zh: '代码行数更少', en: 'Fewer lines of code' },
        { zh: '一个模块的改动更少波及其他模块', en: 'A change in one module affects fewer others' },
        { zh: '不需要测试', en: 'No tests needed' },
        { zh: '运行速度更快', en: 'Faster runtime' }
      ],
      answer: 1,
      hint: { zh: '耦合描述的是「改动如何传播」。', en: 'Coupling describes how change propagates.' },
      why: { zh: '低耦合让模块边界更稳，改动的波及面更小；它不承诺更少代码或更快运行。', en: 'Low coupling keeps module boundaries stable and reduces the blast radius of change. It promises neither fewer lines nor faster runtime.' },
      source: { zh: 'COMP5241 Lecture 4 · 第 6 页', en: 'COMP5241 Lecture 4 · p.6' }
    },
    {
      id: 'q8', type: 'choice', topicKey: 'requirements',
      prompt: { zh: '验收测试应该由谁定义？', en: 'Who should define acceptance tests?' },
      options: [
        { zh: '只由开发定义', en: 'Developers only' },
        { zh: '只由测试定义', en: 'Testers only' },
        { zh: '用户或客户与团队共同定义', en: 'Users or customers with the team' },
        { zh: '只由 AI 定义', en: 'AI only' }
      ],
      answer: 2,
      hint: { zh: '验收测试验证的是「业务上算不算完成」。', en: 'Acceptance tests verify whether the business considers it done.' },
      why: { zh: '验收标准来自业务需求，必须由需求方与团队共同确认；单方定义容易把「实现正确」误当成「需求满足」。', en: 'Acceptance criteria come from business needs and must be agreed by the requester and the team. One side alone can mistake "implemented correctly" for "requirement met."' },
      source: { zh: 'COMP5241 Lecture 5 · 第 14 页', en: 'COMP5241 Lecture 5 · p.14' }
    }
  ];

  var WEEK_VALUES = [45, 70, 35, 85, 60, 95, 78];
  var WEEK_DAYS = {
    zh: ['一', '二', '三', '四', '五', '六', '日'],
    en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  };
  var ACCURACY_VALUES = [68, 72, 70, 75, 78, 80, 82];
  var TOPIC_ROWS = [
    { key: 'analytics.topicUsability', value: 72 },
    { key: 'analytics.topicCognition', value: 55 },
    { key: 'analytics.topicDesign', topic: 'design' },
    { key: 'analytics.topicRequirements', topic: 'requirements' },
    { key: 'analytics.topicTesting', topic: 'testing' }
  ];

  /* ── State ─────────────────────────────────────────────── */
  var state = {
    lang: readLang(),
    route: routeFromHash(),
    sideOpen: false,
    onb: { step: 0, goals: [] },
    matTag: 'all',
    matQuery: '',
    progress: clone(DEFAULT_PROGRESS),
    mastery: clone(DEFAULT_MASTERY),
    tasks: clone(TASKS),
    quiz: { phase: 'start', generating: false },
    flash: { i: 0, flipped: false, ratings: {}, done: false },
    chat: [{ role: 'ai', key: 'tutor.initial' }],
    chatBusy: false,
    chatDraft: ''
  };

  function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
  function readLang() {
    try {
      var v = localStorage.getItem(LANG_KEY);
      return v === 'en' || v === 'zh' ? v : 'zh';
    } catch (err) { return 'zh'; }
  }
  function saveLang() {
    try { localStorage.setItem(LANG_KEY, state.lang); } catch (err) { /* local fallback only */ }
  }
  function routeFromHash() {
    var h = '';
    try { h = location.hash.replace(/^#\/?/, '').trim(); } catch (err) { h = ''; }
    return ROUTES.indexOf(h) >= 0 ? h : 'onboarding';
  }

  var viewEl = document.getElementById('view');
  var navEl = document.getElementById('nav');
  var sidebarFoot = document.getElementById('sidebarFoot');
  var mobileBar = document.getElementById('mobileBar');
  var bottomNav = document.getElementById('bottomNav');
  var langToggleText = document.getElementById('langToggleText');
  var toastEl = document.getElementById('toast');
  var confirmDialog = document.getElementById('confirmDialog');
  var confirmTitle = document.getElementById('confirmTitle');
  var confirmBody = document.getElementById('confirmBody');
  var confirmOk = document.getElementById('confirmOk');
  var confirmCancel = document.getElementById('confirmCancel');
  var pendingConfirm = null;
  var toastTimer = null;

  /* ── Shared helpers ────────────────────────────────────── */
  function showToast(msg) {
    toastEl.innerHTML = icon('check') + '<span>' + esc(msg) + '</span>';
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }

  function askConfirm(title, body, okLabel, cancelLabel, onOk) {
    confirmTitle.textContent = title;
    confirmBody.textContent = body;
    confirmOk.textContent = okLabel;
    confirmCancel.textContent = cancelLabel;
    pendingConfirm = onOk;
    if (confirmDialog.open) confirmDialog.close();
    confirmDialog.showModal();
  }

  function ringSvg(percent, size, stroke, color) {
    size = size || 150;
    stroke = stroke || 10;
    color = color || 'var(--grad-a)';
    var r = (size - stroke) / 2;
    var c = 2 * Math.PI * r;
    var offset = c * (1 - Math.max(0, Math.min(100, percent)) / 100);
    return '<svg viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' + Math.round(percent) + '%">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--uncovered)" stroke-width="' + stroke + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + offset.toFixed(1) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/>' +
      '</svg>';
  }

  function masteryColor(value) {
    if (!value) return 'var(--uncovered)';
    return value >= 80 ? 'var(--mastered)' : 'var(--partial)';
  }
  function masteryClass(value) {
    if (!value) return 'g-uncovered';
    return value >= 80 ? 'g-mastered' : 'g-partial';
  }
  function masteryPill(value) {
    if (!value) {
      return '<span class="pill pill-muted"><span aria-hidden="true">○</span>' + esc(t('quiz.nodeUncovered')) + '</span>';
    }
    if (value >= 80) {
      return '<span class="pill pill-mastered"><span aria-hidden="true">●</span>' + esc(t('quiz.nodeMastered')) + '</span>';
    }
    return '<span class="pill pill-partial"><span aria-hidden="true">◐</span>' + esc(t('quiz.nodePartial')) + '</span>';
  }

  /* ── Chrome ────────────────────────────────────────────── */
  function renderChrome() {
    document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
    document.title = t('meta.title');
    var sidebarEl = document.getElementById('sidebar');
    if (sidebarEl) sidebarEl.setAttribute('aria-label', t('common.navAria'));
    bottomNav.setAttribute('aria-label', t('common.primaryAria'));
    langToggleText.textContent = t('common.langName');

    navEl.innerHTML = NAV_ROUTES.map(function (item) {
      var current = state.route === item.route;
      return '<button class="nav-item" type="button" data-go="' + item.route + '" aria-label="' + esc(t(item.key)) + '" title="' + esc(t(item.key)) + '"' + (current ? ' aria-current="page"' : '') + '>' +
        icon(item.icon) + '<span>' + esc(t(item.key)) + '</span></button>';
    }).join('');

    var gearLabel = t('nav.settings');
    sidebarFoot.innerHTML =
      '<span class="avatar" aria-hidden="true">' + (state.lang === 'zh' ? '学' : 'S') + '</span>' +
      '<span class="profile-text">' +
        '<span class="profile-name">Yinan Chen</span>' +
        '<span class="profile-meta">' + esc(t('dashboard.level', { n: state.progress.level })) + ' · ' + num(state.progress.points) + ' ' + esc(t('common.pointsUnit')) + '</span>' +
      '</span>' +
      '<button class="gear" type="button" data-go="settings" aria-label="' + esc(gearLabel) + '" title="' + esc(gearLabel) + '">' + icon('settings') + '</button>';

    mobileBar.innerHTML =
      '<button class="icon-btn" type="button" data-action="toggle-sidebar" aria-label="' + esc(t('nav.menu')) + '">' + icon('menu') + '</button>' +
      '<span class="mobile-brand"><span class="brand-mark" aria-hidden="true">' + icon('star') + '</span><b>Synapse</b></span>' +
      '<span class="mobile-actions">' +
        '<button class="icon-btn" type="button" data-action="lang-toggle" aria-label="' + esc(t('common.switchLang')) + '">' + icon('globe') + '</button>' +
        '<span class="pill pill-streak mobile-streak" title="' + esc(t('dashboard.streak', { n: state.progress.streak }) + ' · ' + t('dashboard.streakRule')) + '">' + icon('flame') + '<span class="nowrap">' + esc(t('dashboard.streak', { n: state.progress.streak })) + '</span></span>' +
      '</span>';

    bottomNav.innerHTML = BOTTOM_ROUTES.map(function (route) {
      var item = NAV_ROUTES.filter(function (n) { return n.route === route; })[0];
      var current = state.route === route;
      return '<button class="bottom-item" type="button" data-go="' + route + '"' + (current ? ' aria-current="page"' : '') + '>' +
        icon(item.icon) + '<span>' + esc(t(item.key)) + '</span></button>';
    }).join('');
  }

  function navigate(route) {
    if (ROUTES.indexOf(route) < 0) route = 'dashboard';
    state.route = route;
    state.sideOpen = false;
    document.body.classList.remove('side-open');
    try {
      history.replaceState(null, '', '#/' + route);
    } catch (err) {
      try { location.hash = '#/' + route; } catch (err2) { /* sandbox */ }
    }
    renderApp();
    viewEl.scrollTop = 0;
    viewEl.focus({ preventScroll: true });
  }

  function renderApp() {
    document.body.classList.toggle('route-onboarding', state.route === 'onboarding');
    document.body.classList.toggle('side-open', state.sideOpen);
    renderChrome();
    renderPage();
  }

  /* ── Page dispatch ─────────────────────────────────────── */
  function renderPage() {
    var html = '';
    switch (state.route) {
      case 'onboarding': html = renderOnboarding(); break;
      case 'dashboard': html = renderDashboard(); break;
      case 'ai-tutor': html = renderTutor(); break;
      case 'materials': html = renderMaterials(); break;
      case 'quiz': html = renderQuiz(); break;
      case 'flashcards': html = renderFlashcards(); break;
      case 'mistakes': html = renderMistakes(); break;
      case 'planner': html = renderPlanner(); break;
      case 'achievements': html = renderAchievements(); break;
      case 'analytics': html = renderAnalytics(); break;
      case 'settings': html = renderSettings(); break;
      default: html = renderNotFound();
    }
    viewEl.innerHTML = html;
    afterRender();
  }

  function afterRender() {
    if (state.route === 'materials') {
      renderMaterialsList();
    }
    if (state.route === 'ai-tutor') {
      renderChatLog();
      var log = document.getElementById('chatLog');
      var input = document.getElementById('chatInput');
      if (input) input.value = state.chatDraft;
      if (log) {
        var thread = document.getElementById('chatThread');
        if (thread) thread.scrollTop = thread.scrollHeight;
      }
    }
    if (state.route === 'quiz') {
      var prompt = document.getElementById('qPrompt');
      var openInput = document.getElementById('quizInput');
      if (state.quiz && state.quiz.phase === 'running' && state.quiz.focusQuestion) {
        if (openInput && !state.quiz.revealed) {
          openInput.focus({ preventScroll: true });
        } else if (prompt) {
          prompt.focus({ preventScroll: true });
        }
        state.quiz.focusQuestion = false;
      }
    }
  }

  /* ── Onboarding ────────────────────────────────────────── */
  function renderOnboarding() {
    var step = state.onb.step;
    var goals = state.onb.goals;
    var content = '';

    if (step === 0) {
      content =
        '<span class="onboard-mark" aria-hidden="true">' + icon('spark') + '</span>' +
        '<p class="eyebrow">' + esc(t('onboarding.welcomeEyebrow')) + '</p>' +
        '<h1 class="onboard-title">' + esc(t('onboarding.welcomeTitle')) + '</h1>' +
        '<p class="onboard-body">' + esc(t('onboarding.welcomeBody')) + '</p>' +
        '<div class="onboard-actions">' +
          '<button class="btn btn-primary" type="button" data-action="onb-next">' + esc(t('onboarding.start')) + icon('arrowRight') + '</button>' +
          '<button class="onboard-skip" type="button" data-action="onb-skip">' + esc(t('common.skip')) + '</button>' +
        '</div>';
    } else if (step === 1) {
      var goalItems = [
        { id: 'exam', icon: 'target', title: 'onboarding.goalExam', desc: 'onboarding.goalExamDesc' },
        { id: 'understand', icon: 'book', title: 'onboarding.goalUnderstand', desc: 'onboarding.goalUnderstandDesc' },
        { id: 'revise', icon: 'refresh', title: 'onboarding.goalRevise', desc: 'onboarding.goalReviseDesc' },
        { id: 'practice', icon: 'quiz', title: 'onboarding.goalPractice', desc: 'onboarding.goalPracticeDesc' }
      ];
      content =
        '<p class="eyebrow">' + esc(t('onboarding.goalEyebrow')) + '</p>' +
        '<h1 class="onboard-title">' + esc(t('onboarding.goalTitle')) + '</h1>' +
        '<p class="onboard-body">' + esc(t('onboarding.goalBody')) + '</p>' +
        '<div class="goal-list">' + goalItems.map(function (g) {
          var on = goals.indexOf(g.id) >= 0;
          return '<button class="goal-row" type="button" data-action="onb-goal" data-goal="' + g.id + '" aria-pressed="' + on + '">' +
            '<span class="goal-icon" aria-hidden="true">' + icon(g.icon) + '</span>' +
            '<span class="goal-main"><span class="goal-title">' + esc(t(g.title)) + '</span><span class="goal-desc">' + esc(t(g.desc)) + '</span></span>' +
            '<span class="goal-check" aria-hidden="true">' + icon('check') + '</span>' +
          '</button>';
        }).join('') + '</div>' +
        '<div class="onboard-actions">' +
          '<button class="btn btn-ghost" type="button" data-action="onb-back">' + icon('arrowLeft') + esc(t('common.back')) + '</button>' +
          '<button class="btn btn-primary" type="button" data-action="onb-next"' + (goals.length ? '' : ' disabled') + '>' + esc(t('common.continue')) + icon('arrowRight') + '</button>' +
          (goals.length ? '' : '<span class="onboard-skip">' + esc(t('onboarding.pickOne')) + '</span>') +
        '</div>';
    } else {
      var selected = state.onb.goals.map(function (id) {
        var map = {
          exam: 'onboarding.goalExam',
          understand: 'onboarding.goalUnderstand',
          revise: 'onboarding.goalRevise',
          practice: 'onboarding.goalPractice'
        };
        return '<span class="pill">' + esc(t(map[id])) + '</span>';
      }).join('');
      content =
        '<span class="onboard-mark" aria-hidden="true">' + icon('check') + '</span>' +
        '<p class="eyebrow">' + esc(t('onboarding.readyEyebrow')) + '</p>' +
        '<h1 class="onboard-title">' + esc(t('onboarding.readyTitle')) + '</h1>' +
        '<p class="onboard-body">' + esc(t('onboarding.readyBody')) + '</p>' +
        '<div class="chip-row">' + selected + '</div>' +
        '<div class="onboard-actions">' +
          '<button class="btn btn-primary" type="button" data-action="onb-finish">' + esc(t('onboarding.enter')) + icon('arrowRight') + '</button>' +
        '</div>';
    }

    return '<div class="onboarding">' +
      '<div class="onboard-shell">' +
        '<div class="onboard-top">' +
          '<span class="onboard-brand"><span class="brand-mark" aria-hidden="true">' + icon('star') + '</span><span class="brand-name">Synapse</span></span>' +
          '<button class="onboard-lang" type="button" data-action="lang-toggle">' + icon('globe', 'icon-sm') + esc(t('common.langName')) + '</button>' +
        '</div>' +
        '<div class="onboard-card">' +
          '<div class="step-dots" aria-hidden="true">' +
            [0, 1, 2].map(function (i) { return '<span class="step-dot' + (i <= step ? ' on' : '') + '"></span>'; }).join('') +
          '</div>' +
          '<p class="sr-only">' + esc(t('onboarding.step', { n: step + 1 })) + '</p>' +
          content +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── Dashboard ─────────────────────────────────────────── */
  function renderDashboard() {
    var p = state.progress;
    var weeklyPct = Math.round((p.weeklyProgress / p.weeklyGoal) * 100);
    var accuracy = Math.round((p.correctAnswers / p.totalAnswers) * 100);
    var hours = (p.studyMinutes / 60).toFixed(1);
    var unlocked = ACHIEVEMENTS.filter(function (a) { return a.unlocked; }).slice(0, 4);

    var quick = [
      { route: 'quiz', icon: 'quiz', cls: 'tint-coral', title: 'dashboard.quickQuiz', desc: 'dashboard.quickQuizDesc' },
      { route: 'flashcards', icon: 'cards', cls: 'tint-amber', title: 'dashboard.quickCards', desc: 'dashboard.quickCardsDesc' },
      { route: 'materials', icon: 'materials', cls: 'tint-green', title: 'dashboard.quickMaterials', desc: 'dashboard.quickMaterialsDesc' },
      { route: 'ai-tutor', icon: 'tutor', cls: 'tint-blue', title: 'dashboard.quickTutor', desc: 'dashboard.quickTutorDesc' }
    ];

    return '<div class="page">' +
      '<div class="greeting-row">' +
        '<div>' +
          '<p class="eyebrow">' + esc(t('dashboard.eyebrow')) + '</p>' +
          '<h1 class="greeting-title">' + esc(t('dashboard.greetingA')) + '<em>Yinan</em>' + esc(t('dashboard.greetingB')) + '</h1>' +
          '<p class="page-sub">' + esc(t('dashboard.greetingSub')) + '</p>' +
        '</div>' +
        '<div class="streak-cluster">' +
          '<span class="pill pill-streak" title="' + esc(t('dashboard.streak', { n: p.streak }) + ' · ' + t('dashboard.streakRule')) + '">' + icon('flame') + esc(t('dashboard.streak', { n: p.streak })) + '</span>' +
          '<span class="streak-note">' + esc(t('dashboard.streakRule')) + '</span>' +
        '</div>' +
      '</div>' +

      '<div class="stat-grid">' +
        statCard('tint-coral', 'target', t('dashboard.weeklyGoal'), weeklyPct + '%', t('dashboard.weeklyGoalSub', { done: p.weeklyProgress, target: p.weeklyGoal })) +
        statCard('tint-green', 'check', t('dashboard.accuracy'), accuracy + '%', t('dashboard.accuracySub')) +
        statCard('tint-amber', 'clock', t('dashboard.studyTime'), hours + ' ' + t('common.hoursUnit'), t('dashboard.studyTimeSub')) +
        statCard('tint-blue', 'star', t('dashboard.levelLabel'), String(p.level), t('dashboard.levelSub', { points: num(p.points) })) +
      '</div>' +

      '<div class="dash-grid">' +
        '<div class="dash-left">' +
          '<div class="card continue-card">' +
            '<span class="continue-icon" aria-hidden="true">' + icon('book', 'icon-lg') + '</span>' +
            '<div class="continue-main">' +
              '<div class="continue-title">' + esc(t('dashboard.continueReading')) + '</div>' +
              '<div class="continue-sub">' + esc(t('dashboard.continueReadingSub')) + '</div>' +
            '</div>' +
            '<button class="btn btn-secondary btn-sm" type="button" data-action="continue-read">' + esc(t('common.open')) + icon('arrowRight', 'icon-sm') + '</button>' +
          '</div>' +

          '<div>' +
            '<div class="section-head" style="margin-top:0"><h2 class="section-title">' + esc(t('dashboard.quickActions')) + '</h2></div>' +
            '<div class="quick-grid">' + quick.map(function (q) {
              return '<button class="quick-card" type="button" data-go="' + q.route + '">' +
                '<span class="quick-icon ' + q.cls + '" aria-hidden="true">' + icon(q.icon) + '</span>' +
                '<span class="quick-main"><span class="quick-title">' + esc(t(q.title)) + '</span><span class="quick-desc">' + esc(t(q.desc)) + '</span></span>' +
                '<span class="quick-arrow" aria-hidden="true">' + icon('chevronRight') + '</span>' +
              '</button>';
            }).join('') + '</div>' +
          '</div>' +
        '</div>' +

        '<div class="card ring-card">' +
          '<p class="eyebrow">' + esc(t('dashboard.weeklyRing')) + '</p>' +
          '<div class="ring-wrap">' + ringSvg(weeklyPct, 150, 11) +
            '<div class="ring-num"><b>' + weeklyPct + '%</b><span>' + esc(t('dashboard.weeklyRing')) + '</span></div>' +
          '</div>' +
          '<div class="ring-caption"><b>' + esc(t('dashboard.ringSub', { done: p.weeklyProgress, target: p.weeklyGoal })) + '</b><span>' + esc(t('dashboard.streakRule')) + '</span></div>' +
        '</div>' +
      '</div>' +

      '<div class="section-head">' +
        '<h2 class="section-title">' + esc(t('dashboard.recent')) + '</h2>' +
        '<button class="section-link" type="button" data-go="achievements">' + esc(t('common.viewAll')) + '</button>' +
      '</div>' +
      '<div class="ach-strip">' + unlocked.map(function (a) {
        return '<div class="ach-mini">' +
          '<span class="ach-mini-icon" aria-hidden="true">' + a.emoji + '</span>' +
          '<span><span class="ach-mini-title">' + esc(t(a.key)) + '</span><span class="ach-mini-sub">' + esc(t('ach.unlocked')) + '</span></span>' +
        '</div>';
      }).join('') + '</div>' +
    '</div>';
  }

  function statCard(tint, ic, label, value, sub) {
    return '<div class="card stat-card">' +
      '<span class="stat-icon ' + tint + '" aria-hidden="true">' + icon(ic) + '</span>' +
      '<span class="stat-label">' + esc(label) + '</span>' +
      '<span class="stat-value">' + esc(value) + '</span>' +
      '<span class="stat-sub">' + esc(sub) + '</span>' +
    '</div>';
  }

  /* ── AI Tutor ──────────────────────────────────────────── */
  function renderTutor() {
    return '<div class="tutor-page">' +
      '<div class="tutor-head">' +
        '<span class="tutor-avatar" aria-hidden="true">' + icon('spark') + '</span>' +
        '<div><div class="tutor-title">' + esc(t('tutor.title')) + '</div><div class="tutor-sub">' + esc(t('tutor.subtitle')) + '</div></div>' +
      '</div>' +
      '<div class="tutor-thread" id="chatThread">' +
        '<div class="chat-log" id="chatLog"></div>' +
      '</div>' +
      '<div class="tutor-suggest" id="chatSuggest">' + suggestButtons() + '</div>' +
      '<div class="composer">' +
        '<textarea id="chatInput" rows="1" placeholder="' + esc(t('tutor.placeholder')) + '" aria-label="' + esc(t('tutor.placeholder')) + '"></textarea>' +
        '<button class="send-btn" type="button" data-action="chat-send" aria-label="' + esc(t('tutor.send')) + '">' + icon('send') + '</button>' +
      '</div>' +
      '<p class="composer-note">' + esc(t('tutor.demoNote')) + '</p>' +
    '</div>';
  }

  function suggestButtons() {
    var items = [
      { intent: 'explain', label: 'tutor.suggestExplain', icon: 'spark' },
      { intent: 'quiz', label: 'tutor.suggestQuiz', icon: 'quiz' },
      { intent: 'summary', label: 'tutor.suggestSummary', icon: 'book' },
      { intent: 'mistake', label: 'tutor.suggestMistake', icon: 'mistakes' }
    ];
    return items.map(function (s) {
      return '<button class="suggest-chip" type="button" data-action="suggest" data-suggest="' + s.intent + '">' + icon(s.icon, 'icon-sm') + esc(t(s.label)) + '</button>';
    }).join('');
  }

  function renderChatLog() {
    var log = document.getElementById('chatLog');
    if (!log) return;
    var html = state.chat.map(function (m) {
      if (m.role === 'user') {
        return '<div class="msg user"><span class="msg-avatar" aria-hidden="true">Y</span><div class="bubble">' + esc(m.text) + '</div></div>';
      }
      return '<div class="msg ai"><span class="msg-avatar" aria-hidden="true">S</span><div class="bubble">' + esc(t(m.key)) + '</div></div>';
    }).join('');
    if (state.chatBusy) {
      html += '<div class="msg ai"><span class="msg-avatar" aria-hidden="true">S</span><div class="bubble"><span class="typing" role="status" aria-label="' + esc(t('tutor.typing')) + '"><span></span><span></span><span></span></span></div></div>';
    }
    log.innerHTML = html;
    var thread = document.getElementById('chatThread');
    if (thread) thread.scrollTop = thread.scrollHeight;
  }

  function sendChat(text, directIntent) {
    if (state.chatBusy) return;
    var clean = String(text || '').trim();
    if (!clean && !directIntent) return;
    if (clean) state.chat.push({ role: 'user', text: clean });
    state.chatBusy = true;
    state.chatDraft = '';
    var input = document.getElementById('chatInput');
    if (input) input.value = '';
    renderChatLog();
    var replyKey = directIntent ? intentKey(directIntent) : detectIntent(clean);
    setTimeout(function () {
      state.chat.push({ role: 'ai', key: replyKey });
      state.chatBusy = false;
      renderChatLog();
    }, 1200);
  }

  function intentKey(intent) {
    if (intent === 'quiz') return 'tutor.replyQuiz';
    if (intent === 'summary') return 'tutor.replySummary';
    if (intent === 'mistake') return 'tutor.replyMistake';
    return 'tutor.replyExplain';
  }

  function detectIntent(text) {
    var s = text.toLowerCase();
    if (/业界|industry|通用|general|outside/.test(s)) return 'tutor.replyBeyond';
    if (/错|mistake|wrong|error|错误/.test(s)) return 'tutor.replyMistake';
    if (/考|quiz|test|练习/.test(s)) return 'tutor.replyQuiz';
    if (/总结|summar|笔记|note/.test(s)) return 'tutor.replySummary';
    if (/解释|explain|为什么|why|概念|concept/.test(s)) return 'tutor.replyExplain';
    return 'tutor.replyGeneric';
  }

  /* ── Materials ─────────────────────────────────────────── */
  function renderMaterials() {
    return '<div class="page">' +
      '<div class="page-head start">' +
        '<div>' +
          '<p class="eyebrow">' + esc(t('materials.eyebrow')) + '</p>' +
          '<h1 class="page-title">' + esc(t('materials.title')) + '</h1>' +
          '<p class="page-sub">' + esc(t('materials.subtitle', { n: MATERIALS.length })) + '</p>' +
        '</div>' +
        '<div class="head-actions">' +
          '<button class="btn btn-primary" type="button" data-action="mat-upload">' + icon('plus') + esc(t('materials.upload')) + '</button>' +
        '</div>' +
      '</div>' +

      '<div class="filter-row" id="tagRow">' + TAGS.map(function (tag) {
        return '<button class="chip" type="button" data-action="mat-tag" data-tag="' + tag.id + '" aria-pressed="' + (state.matTag === tag.id) + '">' + esc(t(tag.key)) + '</button>';
      }).join('') + '</div>' +

      '<div class="search-field">' + icon('search') +
        '<input id="materialSearch" type="search" value="' + esc(state.matQuery) + '" placeholder="' + esc(t('materials.search')) + '" aria-label="' + esc(t('materials.search')) + '">' +
      '</div>' +

      '<div class="material-list" id="materialList"></div>' +
      '<div id="matEmpty"></div>' +
    '</div>';
  }

  function renderMaterialsList() {
    var host = document.getElementById('materialList');
    var empty = document.getElementById('matEmpty');
    if (!host) return;
    var items = MATERIALS.filter(function (m) {
      if (state.matTag !== 'all' && m.tag !== state.matTag) return false;
      var q = state.matQuery.trim().toLowerCase();
      if (!q) return true;
      var tagLabel = t('materials.tag' + m.tag.charAt(0).toUpperCase() + m.tag.slice(1));
      var hay = (m.title.zh + ' ' + m.title.en + ' ' + tagLabel + ' ' + m.type).toLowerCase();
      return hay.indexOf(q) >= 0;
    });

    host.innerHTML = items.map(function (m) {
      var emoji = m.type === 'pdf' ? '📄' : '📝';
      var typeLabel = m.type === 'pdf' ? t('materials.filePdf') : t('materials.fileMd');
      var tagLabel = t('materials.tag' + m.tag.charAt(0).toUpperCase() + m.tag.slice(1));
      return '<div class="material-row">' +
        '<span class="file-tile" aria-hidden="true">' + emoji + '</span>' +
        '<div class="material-main">' +
          '<div class="material-title">' + esc(L(m.title)) + '</div>' +
          '<div class="material-meta">' +
            '<span>' + esc(typeLabel) + '</span><span aria-hidden="true">·</span>' +
            '<span>' + esc(t('materials.pages', { n: m.pages })) + '</span><span aria-hidden="true">·</span>' +
            '<span>' + esc(m.size) + '</span><span aria-hidden="true">·</span>' +
            '<span>' + esc(t('materials.updated', { d: L(m.updated) })) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="material-tags"><span class="tag">' + esc(tagLabel) + '</span></div>' +
        '<div class="row-action"><button class="btn btn-secondary btn-sm" type="button" data-action="mat-open" data-id="' + m.id + '">' + esc(t('materials.open')) + icon('chevronRight', 'icon-sm') + '</button></div>' +
      '</div>';
    }).join('');

    if (empty) {
      empty.innerHTML = items.length ? '' :
        '<div class="empty-state"><b>' + esc(t('materials.empty')) + '</b><span>' + esc(t('materials.emptyHint')) + '</span></div>';
    }
  }

  /* ── Quiz ──────────────────────────────────────────────── */
  function currentQuestion() {
    if (!state.quiz || state.quiz.phase !== 'running') return null;
    return state.quiz.questions[state.quiz.i] || null;
  }

  function renderQuiz() {
    if (state.quiz && state.quiz.phase === 'running') return renderQuizRunner();
    if (state.quiz && state.quiz.phase === 'results') return renderQuizResults();
    return renderQuizStart();
  }

  function quizPageHead(subKey) {
    return '<div class="page-head start">' +
      '<div><p class="eyebrow">' + esc(t('quiz.eyebrow')) + '</p>' +
      '<h1 class="page-title">' + esc(t('quiz.title')) + '</h1>' +
      '<p class="page-sub">' + esc(t(subKey || 'quiz.subtitle')) + '</p></div>' +
    '</div>';
  }

  function renderQuizStart() {
    var generating = !!(state.quiz && state.quiz.generating);
    return '<div class="page narrow">' + quizPageHead() +
      '<div class="card start-card">' +
        '<h2 class="start-title">' + esc(t('quiz.startTitle')) + '</h2>' +
        '<p class="start-body">' + esc(t('quiz.startBody')) + '</p>' +
        '<div class="meta-row">' +
          '<span class="pill">' + icon('quiz') + esc(t('quiz.metaCount')) + '</span>' +
          '<span class="pill">' + icon('layers') + esc(t('quiz.metaMode')) + '</span>' +
          '<span class="pill">' + icon('spark') + esc(t('quiz.metaHint')) + '</span>' +
        '</div>' +
        '<div class="start-actions">' +
          '<button class="btn btn-primary" type="button" data-action="quiz-start">' + esc(t('quiz.start')) + icon('arrowRight') + '</button>' +
          '<button class="btn btn-secondary" type="button" data-action="quiz-generate"' + (generating ? ' disabled' : '') + '>' +
            (generating ? '<span class="spinner" aria-hidden="true"></span>' + esc(t('quiz.generating')) : icon('refresh') + esc(t('quiz.generate'))) +
          '</button>' +
        '</div>' +
        '<p class="start-note">' + icon('info', 'icon-sm') + esc(t('quiz.startNote')) + '</p>' +
      '</div>' +
    '</div>';
  }

  function renderQuizRunner() {
    var q = currentQuestion();
    if (!q) { state.quiz = { phase: 'start', generating: false }; return renderQuizStart(); }
    var total = state.quiz.questions.length;
    var idx = state.quiz.i;
    var answered = state.quiz.revealed;
    var answer = state.quiz.lastAnswer;
    var verdict = '';
    if (answered && answer) {
      var vClass = answer.forfeit ? 'partial' : (answer.correct ? 'correct' : (answer.partial ? 'partial' : 'wrong'));
      var vIcon = answer.forfeit ? 'eye' : (answer.correct ? 'check' : (answer.partial ? 'info' : 'x'));
      var vLabel = answer.forfeit ? t('quiz.forfeited') : (answer.correct ? t('quiz.correct') : (answer.partial ? t('quiz.partial') : t('quiz.wrong')));
      verdict = '<div class="verdict ' + vClass + '" role="status" aria-live="polite">' +
        '<div class="verdict-head">' + icon(vIcon) + esc(vLabel) + '</div>' +
        (q.type === 'open' ? '<p><strong>' + esc(t('quiz.reference')) + '：</strong>' + esc(L(q.reference)) + '</p>' : '') +
        '<p>' + esc(L(q.why)) + '</p>' +
        (answer.forfeit ? '<p>' + esc(t('quiz.forfeitNote')) + '</p>' : '') +
        '<span class="citation">' + icon('book', 'icon-sm') + esc(L(q.source)) + '</span>' +
      '</div>';
    }

    var options = '';
    if (q.type === 'choice') {
      options = '<div class="option-list">' + q.options.map(function (opt, i) {
        var cls = 'option';
        var mark = '';
        if (answered) {
          if (i === q.answer) { cls += ' is-correct'; mark = '<span class="option-mark">' + icon('check', 'icon-sm') + '</span>'; }
          if (state.quiz.selected === i && i !== q.answer) { cls += ' is-wrong'; mark = '<span class="option-mark">' + icon('x', 'icon-sm') + '</span>'; }
          if (answer && answer.forfeit && state.quiz.selected === i && i !== q.answer) { cls += ' is-forfeit'; }
        }
        return '<button class="' + cls + '" type="button" data-action="quiz-option" data-index="' + i + '" aria-pressed="' + (state.quiz.selected === i) + '"' + (answered ? ' disabled' : '') + '>' +
          '<span class="option-key" aria-hidden="true">' + String.fromCharCode(65 + i) + '</span>' +
          '<span class="option-text">' + esc(L(opt)) + '</span>' + mark +
        '</button>';
      }).join('') + '</div>';
    } else {
      options = '<textarea class="textarea" id="quizInput" placeholder="' + esc(t('quiz.openPlaceholder')) + '" aria-label="' + esc(t('quiz.openPlaceholder')) + '"' + (answered ? ' disabled' : '') + '>' + esc(state.quiz.input) + '</textarea>';
    }

    var hintBox = state.quiz.hint ? '<div class="hint-box">' + icon('spark', 'icon-sm') + '<span><strong>' + esc(t('quiz.hintLabel')) + '：</strong>' + esc(L(q.hint)) + '</span></div>' : '';

    var actions = '';
    if (!answered) {
      actions =
        '<button class="btn btn-secondary btn-sm hint-btn" type="button" data-action="quiz-hint">' + esc(t('quiz.hint')) + '</button>' +
        '<button class="btn btn-ghost btn-sm" type="button" data-action="quiz-reveal">' + esc(t('quiz.reveal')) + '</button>' +
        '<span class="spacer"></span>' +
        '<button class="btn btn-primary" type="button" data-action="quiz-confirm"' + (state.quiz.grading ? ' disabled' : '') + '>' +
          (q.type === 'open' ? esc(t('quiz.submit')) : esc(t('quiz.confirm'))) + icon('arrowRight') + '</button>';
    } else {
      actions = '<span class="spacer"></span>' +
        '<button class="btn btn-primary" type="button" data-action="quiz-next">' + (idx === total - 1 ? esc(t('quiz.finish')) : esc(t('quiz.next'))) + icon('arrowRight') + '</button>';
    }

    return '<div class="page narrow">' +
      '<div class="quiz-shell">' +
        '<div class="q-progress">' +
          '<span class="q-count">' + esc(t('quiz.question', { i: idx + 1, n: total })) + '</span>' +
          '<span class="progress-track" aria-hidden="true"><span class="progress-fill" style="width:' + Math.round(((idx + (answered ? 1 : 0)) / total) * 100) + '%"></span></span>' +
          '<button class="icon-btn" type="button" data-action="quiz-exit" aria-label="' + esc(t('quiz.exit')) + '" title="' + esc(t('quiz.exit')) + '">' + icon('close') + '</button>' +
        '</div>' +
        '<div class="card q-card">' +
          '<div class="q-top">' +
            '<span class="q-topic">' + esc(L(TOPICS[q.topicKey])) + '</span>' +
            '<span class="pill pill-muted">' + esc(q.type === 'open' ? t('quiz.typeOpen') : t('quiz.typeChoice')) + '</span>' +
          '</div>' +
          '<h2 class="q-prompt" id="qPrompt" tabindex="-1">' + esc(L(q.prompt)) + '</h2>' +
          options + hintBox +
          (state.quiz.grading ? '<div class="grading-row" role="status"><span class="spinner" aria-hidden="true"></span>' + esc(t('quiz.grading')) + '</div>' : '') +
          verdict +
          '<div class="q-actions">' + actions + '</div>' +
        '</div>' +
        '<p class="kbd-hint">' + icon('info', 'icon-sm') + esc(t('quiz.keyboardHint')) + '</p>' +
      '</div>' +
    '</div>';
  }

  function renderQuizResults() {
    var r = state.quiz.results;
    var score = r.score;
    var color = 'var(--accent)';
    var wrong = r.answers.filter(function (a) { return !a.correct && !a.partial; });

    var deltas = r.deltas.length ? r.deltas.map(function (d) {
      var stateVal = d.to;
      return '<div class="delta-row">' +
        '<span class="state-glyph ' + masteryClass(stateVal) + '" aria-hidden="true">' + (stateVal >= 80 ? '●' : '◐') + '</span>' +
        '<span class="delta-name">' + esc(L(TOPICS[d.topic])) + '</span>' +
        '<span class="delta-from">' + d.from + '%</span>' +
        '<span class="delta-to delta-up">→ ' + d.to + '%</span>' +
        '<span class="pill ' + (stateVal >= 80 ? 'pill-mastered' : 'pill-partial') + '">' + esc(stateVal >= 80 ? t('quiz.nodeMastered') : t('quiz.nodePartial')) + '</span>' +
      '</div>';
    }).join('') : '<p class="page-sub">' + esc(t('quiz.noChange')) + '</p>';

    var mistakes = wrong.length ? wrong.map(function (a) {
      var q = r.questions.filter(function (item) { return item.id === a.qid; })[0];
      if (!q) return '';
      var correctText = q.type === 'choice' ? L(q.options[q.answer]) : L(q.reference);
      var givenText = a.forfeit ? t('quiz.forfeited') : (a.given || '—');
      return mistakeCard({
        topic: L(TOPICS[q.topicKey]),
        question: L(q.prompt),
        given: givenText,
        correct: correctText,
        note: L(q.why),
        source: L(q.source)
      });
    }).join('') : '<p class="page-sub">' + esc(t('quiz.noMistakes')) + '</p>';

    return '<div class="page narrow">' + quizPageHead('quiz.resultsHead') +
      '<div class="card result-card">' +
        '<div class="result-top">' +
          '<div class="score-ring">' + ringSvg(score, 132, 10, color) +
            '<div class="score-num"><b>' + score + '</b><span>' + esc(t('quiz.score') || 'Score') + '</span></div>' +
          '</div>' +
          '<div class="result-copy">' +
            '<p class="eyebrow">' + esc(t('quiz.resultsEyebrow')) + '</p>' +
            '<h2 class="result-title">' + esc(t('quiz.resultsTitle')) + '</h2>' +
            '<p class="result-sub">' + esc(t('quiz.resultsSub', { c: r.correct, p: r.partial, n: r.total })) + '</p>' +
            '<div class="meta-row" style="margin-bottom:0">' +
              '<span class="pill">' + icon('check') + esc(t('quiz.evidenceLogged', { n: r.total })) + '</span>' +
              '<span class="pill">' + esc(t('quiz.metaMode')) + '</span>' +
            '</div>' +
            '<div class="result-actions">' +
              '<button class="btn btn-primary" type="button" data-action="quiz-retry">' + icon('refresh') + esc(t('quiz.retry')) + '</button>' +
              '<button class="btn btn-secondary" type="button" data-action="quiz-home">' + esc(t('quiz.backHome')) + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="section-head"><h2 class="section-title">' + esc(t('quiz.masteryDeltas')) + '</h2></div>' +
      '<div class="delta-list">' + deltas + '</div>' +

      '<div class="section-head"><h2 class="section-title">' + esc(t('quiz.mistakesTitle')) + '</h2></div>' +
      '<div class="mistake-list">' + mistakes + '</div>' +
    '</div>';
  }

  function startQuiz() {
    var questions = QUIZ_BANK.slice();
    for (var i = questions.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = questions[i]; questions[i] = questions[j]; questions[j] = tmp;
    }
    state.quiz = {
      phase: 'running',
      generating: false,
      questions: questions,
      i: 0,
      selected: null,
      revealed: false,
      hint: false,
      input: '',
      grading: false,
      lastAnswer: null,
      answers: [],
      focusQuestion: true
    };
    renderPage();
  }

  function selectOption(index) {
    var q = currentQuestion();
    if (!q || q.type !== 'choice' || state.quiz.revealed || state.quiz.grading) return;
    if (index < 0 || index >= q.options.length) return;
    state.quiz.selected = index;
    renderPage();
  }

  function confirmQuiz() {
    var q = currentQuestion();
    if (!q || state.quiz.revealed || state.quiz.grading) return;
    if (q.type === 'choice') {
      if (state.quiz.selected == null) { showToast(t('quiz.answerAll')); return; }
      var given = L(q.options[state.quiz.selected]);
      var correct = state.quiz.selected === q.answer;
      var answer = { qid: q.id, given: given, correct: correct, partial: false, forfeit: false };
      state.quiz.answers.push(answer);
      state.quiz.lastAnswer = answer;
      state.quiz.revealed = true;
      renderPage();
      return;
    }
    if (!state.quiz.input.trim()) { showToast(t('quiz.emptyAnswer')); return; }
    var text = state.quiz.input;
    state.quiz.grading = true;
    renderPage();
    setTimeout(function () {
      if (!state.quiz || state.quiz.phase !== 'running' || !state.quiz.grading) return;
      var kws = q.keywords[state.lang] || q.keywords.zh;
      var hay = text.toLowerCase();
      var hits = 0;
      kws.forEach(function (k) { if (hay.indexOf(k.toLowerCase()) >= 0) hits++; });
      var partial = hits === 1;
      var correct = hits >= 2;
      var answer = {
        qid: q.id,
        given: text,
        correct: correct,
        partial: partial && !correct,
        forfeit: false
      };
      state.quiz.answers.push(answer);
      state.quiz.lastAnswer = answer;
      state.quiz.revealed = true;
      state.quiz.grading = false;
      renderPage();
    }, 900);
  }

  function forfeitQuiz() {
    var q = currentQuestion();
    if (!q || state.quiz.revealed || state.quiz.grading) return;
    var answer = {
      qid: q.id,
      given: state.quiz.input || '',
      correct: false,
      partial: false,
      forfeit: true
    };
    state.quiz.answers.push(answer);
    state.quiz.lastAnswer = answer;
    state.quiz.revealed = true;
    renderPage();
  }

  function nextQuiz() {
    if (!state.quiz || state.quiz.phase !== 'running') return;
    if (state.quiz.i < state.quiz.questions.length - 1) {
      state.quiz.i += 1;
      state.quiz.selected = null;
      state.quiz.revealed = false;
      state.quiz.hint = false;
      state.quiz.input = '';
      state.quiz.grading = false;
      state.quiz.lastAnswer = null;
      state.quiz.focusQuestion = true;
      renderPage();
    } else {
      finishQuiz();
    }
  }

  function finishQuiz() {
    var answers = state.quiz.answers;
    var questions = state.quiz.questions;
    var correct = answers.filter(function (a) { return a.correct; }).length;
    var partial = answers.filter(function (a) { return a.partial; }).length;
    var score = Math.round(((correct + partial * 0.5) / questions.length) * 100);
    var p = state.progress;
    p.quizzesCompleted += 1;
    p.correctAnswers += correct;
    p.totalAnswers += answers.length;
    p.studyMinutes += 8;
    p.weeklyProgress = Math.min(p.weeklyGoal, p.weeklyProgress + 1);

    var deltas = [];
    Object.keys(TOPICS).forEach(function (topic) {
      var topicAnswers = answers.filter(function (a) {
        var q = questions.filter(function (item) { return item.id === a.qid; })[0];
        return q && q.topicKey === topic;
      });
      if (!topicAnswers.length) return;
      var inc = 0;
      topicAnswers.forEach(function (a) {
        if (a.correct) inc += 6;
        else if (a.partial) inc += 3;
      });
      var before = state.mastery[topic];
      var after = Math.min(100, before + inc);
      if (after > before) {
        state.mastery[topic] = after;
        deltas.push({ topic: topic, from: before, to: after });
      }
    });

    state.quiz.phase = 'results';
    state.quiz.results = {
      score: score,
      correct: correct,
      partial: partial,
      total: questions.length,
      deltas: deltas,
      answers: answers,
      questions: questions
    };
    renderChrome();
    renderPage();
    viewEl.scrollTop = 0;
  }

  /* ── Flashcards ────────────────────────────────────────── */
  function renderFlashcards() {
    if (state.flash.done) return renderFlashSummary();
    var i = state.flash.i;
    var card = FLASHCARDS[i];
    var flipped = state.flash.flipped;
    var dots = FLASHCARDS.map(function (c, idx) {
      var cls = 'deck-dot';
      if (state.flash.ratings[c.id]) cls += ' done';
      else if (idx === i) cls += ' on';
      return '<span class="' + cls + '"></span>';
    }).join('');

    var answerHtml = flipped
      ? '<div class="flash-answer"><div class="flash-label" style="margin-bottom:8px">' + esc(t('flash.back')) + '</div>' + esc(L(card.answer)) +
        '<div><span class="citation">' + icon('book', 'icon-sm') + esc(t('flash.source')) + ' · ' + esc(L(card.source)) + '</span></div></div>'
      : '<div class="flash-hint">' + icon('eye', 'icon-sm') + esc(t('flash.hint')) + '</div>';

    var footer = '<div class="flash-foot">' +
      '<button class="btn btn-ghost btn-sm" type="button" data-action="flash-prev"' + (i === 0 ? ' disabled' : '') + '>' + icon('arrowLeft', 'icon-sm') + esc(t('flash.prev')) + '</button>' +
      (flipped
        ? '<div class="difficulty-row">' +
            '<button class="diff-btn diff-hard" type="button" data-action="flash-diff" data-diff="hard">' + esc(t('flash.hard')) + '</button>' +
            '<button class="diff-btn diff-medium" type="button" data-action="flash-diff" data-diff="medium">' + esc(t('flash.medium')) + '</button>' +
            '<button class="diff-btn diff-easy" type="button" data-action="flash-diff" data-diff="easy">' + esc(t('flash.easy')) + '</button>' +
          '</div>'
        : '<button class="btn btn-primary btn-sm" type="button" data-action="flash-flip">' + esc(t('flash.flip')) + '</button>') +
      '<button class="btn btn-secondary btn-sm" type="button" data-action="flash-finish">' + esc(t('flash.finish')) + '</button>' +
    '</div>';

    return '<div class="page mid">' +
      '<div class="page-head start">' +
        '<div><p class="eyebrow">' + esc(t('flash.eyebrow')) + '</p>' +
        '<h1 class="page-title">' + esc(t('flash.title')) + '</h1>' +
        '<p class="page-sub">' + esc(t('flash.subtitle')) + '</p></div>' +
        '<span class="pill">' + icon('cards', 'icon-sm') + esc(t('flash.progress', { i: i + 1, n: FLASHCARDS.length })) + '</span>' +
      '</div>' +
      '<div class="deck-stage">' +
        '<div class="flash-card" role="button" tabindex="0" data-action="flash-flip" aria-label="' + esc(flipped ? t('flash.back') : t('flash.flip')) + '">' +
          '<span class="flash-label">' + esc(flipped ? t('flash.back') : t('flash.front')) + '</span>' +
          '<span class="flash-text">' + esc(L(card.prompt)) + '</span>' +
          answerHtml +
        '</div>' +
        '<div class="deck-meta"><span class="deck-count">' + esc(t('flash.progress', { i: i + 1, n: FLASHCARDS.length })) + '</span><span class="deck-dots">' + dots + '</span></div>' +
        footer +
        (flipped ? '<p class="kbd-hint">' + icon('info', 'icon-sm') + esc(t('flash.rateFirst')) + '</p>' : '<p class="kbd-hint">' + icon('info', 'icon-sm') + esc(t('flash.spaceHint')) + '</p>') +
      '</div>' +
    '</div>';
  }

  function renderFlashSummary() {
    var ratings = state.flash.ratings;
    var reviewed = Object.keys(ratings).length;
    var easy = Object.keys(ratings).filter(function (k) { return ratings[k] === 'easy'; }).length;
    var pct = FLASHCARDS.length ? Math.round((reviewed / FLASHCARDS.length) * 100) : 0;
    return '<div class="page mid">' +
      '<div class="page-head start"><div><p class="eyebrow">' + esc(t('flash.eyebrow')) + '</p>' +
      '<h1 class="page-title">' + esc(t('flash.summaryTitle')) + '</h1></div></div>' +
      '<div class="card start-card">' +
        '<div class="result-top">' +
          '<div class="score-ring">' + ringSvg(pct, 132, 10, 'var(--accent)') +
            '<div class="score-num"><b>' + reviewed + '</b><span>' + esc(t('flash.reviewed')) + '</span></div>' +
          '</div>' +
          '<div class="result-copy">' +
            '<h2 class="result-title">' + esc(t('flash.summaryCardTitle')) + '</h2>' +
            '<p class="result-sub">' + esc(t('flash.summaryBody', { n: reviewed, easy: easy })) + '</p>' +
            '<div class="result-actions">' +
              '<button class="btn btn-primary" type="button" data-action="flash-again">' + icon('refresh') + esc(t('flash.again')) + '</button>' +
              '<button class="btn btn-secondary" type="button" data-action="quiz-home">' + esc(t('flash.backHome')) + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function flipCard() {
    if (state.flash.done) return;
    state.flash.flipped = !state.flash.flipped;
    renderPage();
  }
  function flashNext() {
    if (state.flash.done) return;
    if (state.flash.i >= FLASHCARDS.length - 1) { state.flash.done = true; renderPage(); return; }
    state.flash.i += 1;
    state.flash.flipped = false;
    renderPage();
  }
  function flashPrev() {
    if (state.flash.done) return;
    if (state.flash.i === 0) return;
    state.flash.i -= 1;
    state.flash.flipped = false;
    renderPage();
  }
  function rateCard(diff) {
    if (state.flash.done) return;
    var card = FLASHCARDS[state.flash.i];
    state.flash.ratings[card.id] = diff;
    state.progress.flashcardsReviewed += 1;
    if (state.flash.i >= FLASHCARDS.length - 1) {
      state.flash.done = true;
      renderPage();
    } else {
      state.flash.i += 1;
      state.flash.flipped = false;
      renderPage();
    }
  }

  /* ── Mistakes ──────────────────────────────────────────── */
  function renderMistakes() {
    var weak = [
      { key: 'analytics.topicTesting', value: state.mastery.testing },
      { key: 'analytics.topicRequirements', value: state.mastery.requirements },
      { key: 'analytics.topicCognition', value: 55 }
    ];
    return '<div class="page mid">' +
      '<div class="page-head start">' +
        '<div><p class="eyebrow">' + esc(t('mistakes.eyebrow')) + '</p>' +
        '<h1 class="page-title">' + esc(t('mistakes.title')) + '</h1>' +
        '<p class="page-sub">' + esc(t('mistakes.subtitle')) + '</p></div>' +
        '<button class="btn btn-primary" type="button" data-action="mistake-review">' + icon('refresh') + esc(t('mistakes.review')) + '</button>' +
      '</div>' +

      '<div class="card weak-card">' +
        '<div class="weak-head">' +
          '<div><h2 class="section-title">' + esc(t('mistakes.weakTitle')) + '</h2>' +
          '<p class="chart-sub">' + esc(t('mistakes.weakBody')) + '</p></div>' +
          '<span class="pill pill-partial">' + esc(t('common.demoData')) + '</span>' +
        '</div>' +
        '<div class="weak-list">' + weak.map(function (w) {
          var fill = w.value >= 80 ? 'bar-high' : 'bar-mid';
          return '<div class="weak-row">' +
            '<span class="nowrap">' + esc(t(w.key)) + '</span>' +
            '<span class="bar-track"><span class="bar-fill ' + fill + '" style="width:' + w.value + '%"></span></span>' +
            '<span class="bar-pct">' + w.value + '%</span>' +
            masteryPill(w.value) +
          '</div>';
        }).join('') + '</div>' +
      '</div>' +

      '<div class="mistake-list">' + MISTAKES.map(function (m) {
        return mistakeCard({
          topic: L(m.topic),
          question: L(m.question),
          given: L(m.given),
          correct: L(m.correct),
          note: L(m.note),
          source: L(m.source),
          date: t(m.dateKey)
        });
      }).join('') + '</div>' +
    '</div>';
  }

  function mistakeCard(m) {
    return '<article class="card mistake-card">' +
      '<div class="mistake-top">' +
        '<span class="pill">' + esc(m.topic) + '</span>' +
        (m.date ? '<span class="chart-sub">' + esc(m.date) + '</span>' : '') +
      '</div>' +
      (m.question ? '<h3 class="mistake-q">' + esc(m.question) + '</h3>' : '') +
      '<div class="compare">' +
        '<div class="compare-box compare-wrong">' +
          '<div class="compare-label">' + icon('x', 'icon-sm') + esc(t('mistakes.yourAnswer')) + '</div>' +
          esc(m.given) +
        '</div>' +
        '<div class="compare-box compare-right">' +
          '<div class="compare-label">' + icon('check', 'icon-sm') + esc(t('mistakes.correctAnswer')) + '</div>' +
          esc(m.correct) +
        '</div>' +
      '</div>' +
      '<div class="ai-note">' + icon('spark', 'icon-sm') + '<span><strong>' + esc(t('mistakes.analysis')) + '：</strong>' + esc(m.note) + '</span></div>' +
      (m.source ? '<span class="citation">' + icon('book', 'icon-sm') + esc(m.source) + '</span>' : '') +
    '</article>';
  }

  /* ── Planner ───────────────────────────────────────────── */
  function renderPlanner() {
    var done = state.tasks.filter(function (tk) { return tk.done; }).length;
    var total = state.tasks.length;
    var percent = Math.round((done / total) * 100);
    return '<div class="page mid">' +
      '<div class="page-head start">' +
        '<div><p class="eyebrow">' + esc(t('planner.eyebrow')) + '</p>' +
        '<h1 class="page-title">' + esc(t('planner.title')) + '</h1>' +
        '<p class="page-sub">' + esc(t('planner.subtitle')) + '</p></div>' +
        '<span class="pill pill-streak">' + icon('flame') + esc(t('dashboard.streak', { n: state.progress.streak })) + '</span>' +
      '</div>' +

      '<div class="card day-card">' +
        '<div class="day-head">' +
          '<div><h2 class="section-title">' + esc(t('planner.dayProgress')) + '</h2>' +
          '<p class="chart-sub">' + esc(t('planner.daySub', { done: done, total: total })) + '</p></div>' +
          '<span class="day-count">' + percent + '%</span>' +
        '</div>' +
        '<div class="progress-track" style="margin-top:12px" aria-hidden="true"><span class="progress-fill" style="width:' + percent + '%"></span></div>' +
        '<div class="task-list">' + state.tasks.map(function (tk) {
          var priKey = tk.priority === 'high' ? 'planner.high' : (tk.priority === 'medium' ? 'planner.medium' : 'planner.low');
          var priCls = tk.priority === 'high' ? 'p-high' : (tk.priority === 'medium' ? 'p-medium' : 'p-low');
          return '<div class="task-row' + (tk.done ? ' done' : '') + '">' +
            '<button class="task-check" type="button" data-action="task-toggle" data-id="' + tk.id + '" aria-pressed="' + tk.done + '" aria-label="' + esc(tk.done ? t('planner.markUndone') : t('planner.markDone')) + '">' + icon('check') + '</button>' +
            '<div class="task-main">' +
              '<div class="task-title">' + esc(t(tk.key)) + '</div>' +
              '<div class="task-meta">' +
                '<span class="task-priority ' + priCls + '">' + esc(t(priKey)) + '</span>' +
                '<span>' + esc(t(tk.metaKey)) + '</span>' +
                (tk.ai ? '<span class="ai-tag">' + icon('spark') + esc(t('planner.ai')) + '</span>' : '') +
              '</div>' +
            '</div>' +
            '<div class="task-side"><span class="task-dur">' + tk.minutes + ' ' + esc(t('common.minUnit')) + '</span></div>' +
          '</div>';
        }).join('') + '</div>' +
      '</div>' +

      '<div class="streak-note-card">' + icon('flame') + esc(t('planner.streakNote', { n: state.progress.streak })) + '</div>' +
    '</div>';
  }

  /* ── Achievements ──────────────────────────────────────── */
  function renderAchievements() {
    var unlocked = ACHIEVEMENTS.filter(function (a) { return a.unlocked; }).length;
    var percent = Math.round((unlocked / ACHIEVEMENTS.length) * 100);
    return '<div class="page">' +
      '<div class="page-head start">' +
        '<div><p class="eyebrow">' + esc(t('ach.eyebrow')) + '</p>' +
        '<h1 class="page-title">' + esc(t('ach.title')) + '</h1>' +
        '<p class="page-sub">' + esc(t('ach.subtitle', { n: unlocked })) + '</p></div>' +
        '<span class="pill">' + esc(t('common.demoData')) + '</span>' +
      '</div>' +

      '<div class="card ach-summary">' +
        '<div class="ring-wrap">' + ringSvg(percent, 104, 9, 'var(--accent)') +
          '<div class="ring-num"><b>' + unlocked + '</b><span>/ 12</span></div>' +
        '</div>' +
        '<div class="ach-stats">' +
          '<div class="ach-stat"><b>' + state.progress.streak + '</b><span>' + esc(t('ach.streak')) + '</span></div>' +
          '<div class="ach-stat"><b>' + state.progress.level + '</b><span>' + esc(t('ach.level')) + '</span></div>' +
          '<div class="ach-stat"><b>' + unlocked + '</b><span>' + esc(t('ach.badges')) + '</span></div>' +
        '</div>' +
      '</div>' +

      '<div class="badge-grid">' + ACHIEVEMENTS.map(function (a) {
        return '<div class="badge-card' + (a.unlocked ? '' : ' locked') + '">' +
          '<span class="badge-icon" aria-hidden="true">' + a.emoji + '</span>' +
          '<span class="badge-title">' + esc(t(a.key)) + '</span>' +
          '<span class="badge-desc">' + esc(t(a.desc)) + '</span>' +
          '<span class="badge-state">' + (a.unlocked ? icon('check', 'icon-sm') + esc(t('ach.unlocked')) : icon('lock', 'icon-sm') + esc(t('ach.locked'))) + '</span>' +
        '</div>';
      }).join('') + '</div>' +
    '</div>';
  }

  /* ── Analytics ─────────────────────────────────────────── */
  function weeklyChart() {
    var w = 520, h = 240, left = 40, right = 14, top = 18, bottom = 34;
    var plotW = w - left - right;
    var plotH = h - top - bottom;
    var max = 100;
    var step = plotW / WEEK_VALUES.length;
    var barW = Math.min(38, step * 0.52);
    var grid = [0, 25, 50, 75, 100].map(function (v) {
      var y = top + plotH * (1 - v / max);
      return '<line x1="' + left + '" y1="' + y.toFixed(1) + '" x2="' + (w - right) + '" y2="' + y.toFixed(1) + '" stroke="var(--border)" stroke-width="1" stroke-dasharray="3 5"/>' +
        '<text x="' + (left - 8) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end" font-size="9" fill="var(--muted)">' + v + '</text>';
    }).join('');
    var bars = WEEK_VALUES.map(function (v, i) {
      var x = left + step * i + (step - barW) / 2;
      var bh = plotH * (v / max);
      var y = top + plotH - bh;
      var day = WEEK_DAYS[state.lang][i];
      return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + bh.toFixed(1) + '" rx="4" fill="url(#weekGrad)"/>' +
        '<text x="' + (left + step * i + step / 2).toFixed(1) + '" y="' + (h - 12) + '" text-anchor="middle" font-size="10" fill="var(--muted)">' + day + '</text>' +
        '<text x="' + (left + step * i + step / 2).toFixed(1) + '" y="' + (y - 7).toFixed(1) + '" text-anchor="middle" font-size="9" fill="var(--fg-2)">' + v + '</text>';
    }).join('');
    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(t('analytics.chartWeekly')) + '">' +
      '<defs><linearGradient id="weekGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--grad-a)"/><stop offset="100%" stop-color="var(--grad-b)"/></linearGradient></defs>' +
      grid + bars +
    '</svg>';
  }

  function accuracyChart() {
    var w = 520, h = 240, left = 40, right = 14, top = 18, bottom = 34;
    var plotW = w - left - right;
    var plotH = h - top - bottom;
    var min = 50, max = 100;
    var n = ACCURACY_VALUES.length;
    var grid = [50, 60, 70, 80, 90, 100].map(function (v) {
      var y = top + plotH * (1 - (v - min) / (max - min));
      return '<line x1="' + left + '" y1="' + y.toFixed(1) + '" x2="' + (w - right) + '" y2="' + y.toFixed(1) + '" stroke="var(--border)" stroke-width="1" stroke-dasharray="3 5"/>' +
        '<text x="' + (left - 8) + '" y="' + (y + 3.5).toFixed(1) + '" text-anchor="end" font-size="9" fill="var(--muted)">' + v + '</text>';
    }).join('');
    var pts = ACCURACY_VALUES.map(function (v, i) {
      return (left + (plotW / (n - 1)) * i).toFixed(1) + ',' + (top + plotH * (1 - (v - min) / (max - min))).toFixed(1);
    }).join(' ');
    var dots = ACCURACY_VALUES.map(function (v, i) {
      var x = left + (plotW / (n - 1)) * i;
      var y = top + plotH * (1 - (v - min) / (max - min));
      var xl = i === 0 || i === n - 1 || i === 3 ? '<text x="' + x.toFixed(1) + '" y="' + (h - 12) + '" text-anchor="middle" font-size="9" fill="var(--muted)">' + (i + 1) + '</text>' : '';
      return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4" fill="var(--surface)" stroke="var(--accent-ink)" stroke-width="2"/>' +
        '<text x="' + x.toFixed(1) + '" y="' + (y - 10).toFixed(1) + '" text-anchor="middle" font-size="9" fill="var(--fg-2)">' + v + '</text>' + xl;
    }).join('');
    return '<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(t('analytics.chartAccuracy')) + '">' +
      grid +
      '<polyline points="' + pts + '" fill="none" stroke="var(--accent-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      dots +
    '</svg>';
  }

  function renderAnalytics() {
    var p = state.progress;
    var hours = (p.studyMinutes / 60).toFixed(1);
    var accuracy = Math.round((p.correctAnswers / p.totalAnswers) * 100);
    var totalMinutes = WEEK_VALUES.reduce(function (a, b) { return a + b; }, 0);
    return '<div class="page">' +
      '<div class="page-head start">' +
        '<div><p class="eyebrow">' + esc(t('analytics.eyebrow')) + '</p>' +
        '<h1 class="page-title">' + esc(t('analytics.title')) + '</h1>' +
        '<p class="page-sub">' + esc(t('analytics.subtitle')) + '</p></div>' +
        '<span class="pill">' + esc(t('common.demoData')) + '</span>' +
      '</div>' +

      '<div class="stat-grid">' +
        statCard('tint-coral', 'clock', t('analytics.weekly'), t('analytics.weeklyVal', { n: hours }), t('dashboard.studyTimeSub')) +
        statCard('tint-green', 'check', t('analytics.accuracy'), accuracy + '%', t('dashboard.accuracySub')) +
        statCard('tint-blue', 'layers', t('analytics.answers'), num(p.totalAnswers), t('analytics.chartAccuracySub')) +
        statCard('tint-amber', 'target', t('analytics.nodes'), String(6), t('analytics.chartTopicsSub')) +
      '</div>' +

      '<div class="analytics-grid">' +
        '<div class="card chart-card">' +
          '<div class="chart-head"><div><h2 class="chart-title">' + esc(t('analytics.chartWeekly')) + '</h2><p class="chart-sub">' + esc(t('analytics.chartWeeklySub')) + '</p></div>' +
          '<span class="pill">' + esc(t('analytics.weeklyVal', { n: hours })) + '</span></div>' +
          weeklyChart() +
        '</div>' +
        '<div class="card chart-card">' +
          '<div class="chart-head"><div><h2 class="chart-title">' + esc(t('analytics.chartAccuracy')) + '</h2><p class="chart-sub">' + esc(t('analytics.chartAccuracySub')) + '</p></div>' +
          '<span class="pill">' + accuracy + '%</span></div>' +
          accuracyChart() +
        '</div>' +
        '<div class="card chart-card" style="grid-column:1 / -1">' +
          '<div class="chart-head"><div><h2 class="chart-title">' + esc(t('analytics.chartTopics')) + '</h2><p class="chart-sub">' + esc(t('analytics.chartTopicsSub')) + '</p></div></div>' +
          '<div class="topic-list">' + TOPIC_ROWS.map(function (row) {
            var val = row.topic ? state.mastery[row.topic] : row.value;
            return '<div class="topic-row">' +
              '<span class="topic-name">' + esc(t(row.key)) + '</span>' +
              '<span class="topic-track"><span class="topic-fill" style="width:' + val + '%;background:' + masteryColor(val) + '"></span></span>' +
              '<span class="topic-pct">' + val + '%</span>' +
              masteryPill(val) +
            '</div>';
          }).join('') + '</div>' +
          '<p class="chart-foot">' + icon('info', 'icon-sm') + esc(t('analytics.chartNote', { n: totalMinutes })) + '</p>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── Settings ──────────────────────────────────────────── */
  function renderSettings() {
    var p = state.progress;
    return '<div class="page mid">' +
      '<div class="page-head start">' +
        '<div><p class="eyebrow">' + esc(t('settings.eyebrow')) + '</p>' +
        '<h1 class="page-title">' + esc(t('settings.title')) + '</h1>' +
        '<p class="page-sub">' + esc(t('settings.subtitle')) + '</p></div>' +
      '</div>' +

      '<div class="settings-grid">' +
        '<div class="card setting-card">' +
          '<h2>' + esc(t('settings.profile')) + '</h2>' +
          '<div class="profile-row">' +
            '<span class="avatar" aria-hidden="true">' + (state.lang === 'zh' ? '学' : 'S') + '</span>' +
            '<div><div class="profile-name-lg">Yinan Chen</div><div class="profile-sub">' + esc(t('settings.profileMeta', { level: p.level, points: num(p.points) })) + '</div></div>' +
          '</div>' +
          '<p class="setting-note">' + esc(t('settings.profileNote')) + '</p>' +
          '<div class="setting-row" style="border-bottom:none;padding-bottom:0">' +
            '<div class="setting-text"><div class="setting-label">' + esc(t('settings.language')) + '</div><div class="setting-help">' + esc(t('settings.languageNote')) + '</div></div>' +
          '</div>' +
          '<div class="lang-cards">' +
            '<button class="lang-card" type="button" data-action="set-lang" data-lang="zh" aria-pressed="' + (state.lang === 'zh') + '"><b>' + esc(t('settings.langZh')) + '</b><span>' + esc(t('settings.langZhDesc')) + '</span></button>' +
            '<button class="lang-card" type="button" data-action="set-lang" data-lang="en" aria-pressed="' + (state.lang === 'en') + '"><b>' + esc(t('settings.langEn')) + '</b><span>' + esc(t('settings.langEnDesc')) + '</span></button>' +
          '</div>' +
        '</div>' +

        '<div class="card setting-card">' +
          '<h2>' + esc(t('settings.appearance')) + '</h2>' +
          '<p class="setting-note">' + esc(t('settings.appearanceNote')) + '</p>' +
          '<div class="setting-row">' +
            '<div class="setting-text"><div class="setting-label">' + esc(t('settings.theme')) + '</div><div class="setting-help">' + esc(t('settings.lightOnly')) + '</div></div>' +
            '<span class="warm-value">' + icon('spark', 'icon-sm') + esc(t('settings.appearanceValue')) + '</span>' +
          '</div>' +
          '<div class="setting-row">' +
            '<div class="setting-text"><div class="setting-label">' + esc(t('settings.data')) + '</div><div class="setting-help">' + esc(t('settings.dataNote')) + '</div></div>' +
            '<button class="btn btn-danger btn-sm" type="button" data-action="reset-demo">' + esc(t('settings.reset')) + '</button>' +
          '</div>' +
          '<div class="setting-row">' +
            '<div class="setting-text"><div class="setting-label">' + esc(t('settings.keyboard')) + '</div><div class="setting-help">' + esc(t('settings.keyboardNote')) + '</div></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  /* ── Not found ─────────────────────────────────────────── */
  function renderNotFound() {
    return '<div class="page narrow">' +
      '<div class="empty-state" style="margin-top:48px">' +
        '<b>' + esc(t('common.notFoundTitle')) + '</b>' +
        '<span>' + esc(t('common.notFoundBody')) + '</span>' +
        '<div style="margin-top:16px"><button class="btn btn-primary" type="button" data-go="dashboard">' + esc(t('common.goDashboard')) + '</button></div>' +
      '</div>' +
    '</div>';
  }

  /* ── Actions ───────────────────────────────────────────── */
  function toggleLang() {
    state.lang = state.lang === 'zh' ? 'en' : 'zh';
    saveLang();
    var scroll = viewEl.scrollTop;
    renderApp();
    viewEl.scrollTop = scroll;
  }

  function resetDemo() {
    state.progress = clone(DEFAULT_PROGRESS);
    state.mastery = clone(DEFAULT_MASTERY);
    state.tasks = clone(TASKS);
    state.quiz = { phase: 'start', generating: false };
    state.flash = { i: 0, flipped: false, ratings: {}, done: false };
    state.chat = [{ role: 'ai', key: 'tutor.initial' }];
    state.chatBusy = false;
    state.chatDraft = '';
    state.matQuery = '';
    state.matTag = 'all';
    state.onb = { step: 0, goals: [] };
    renderApp();
    showToast(t('common.resetDone'));
  }

  function handleClick(event) {
    var skip = event.target.closest('.skip-link');
    if (skip) {
      event.preventDefault();
      viewEl.focus({ preventScroll: false });
      return;
    }
    var goEl = event.target.closest('[data-go]');
    if (goEl) {
      event.preventDefault();
      navigate(goEl.getAttribute('data-go'));
      return;
    }
    var actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    var action = actionEl.getAttribute('data-action');

    switch (action) {
      case 'lang-toggle': toggleLang(); break;
      case 'toggle-sidebar':
        state.sideOpen = true;
        document.body.classList.add('side-open');
        break;
      case 'close-sidebar':
        state.sideOpen = false;
        document.body.classList.remove('side-open');
        break;

      case 'onb-next':
        if (state.onb.step === 0) {
          state.onb.step = 1;
          renderPage();
        } else if (state.onb.step === 1) {
          if (!state.onb.goals.length) { showToast(t('onboarding.pickOne')); return; }
          state.onb.step = 2;
          renderPage();
        }
        break;
      case 'onb-back':
        if (state.onb.step > 0) { state.onb.step -= 1; renderPage(); }
        break;
      case 'onb-goal': {
        var goal = actionEl.getAttribute('data-goal');
        var idx = state.onb.goals.indexOf(goal);
        if (idx >= 0) state.onb.goals.splice(idx, 1);
        else state.onb.goals.push(goal);
        renderPage();
        break;
      }
      case 'onb-skip':
      case 'onb-finish':
        navigate('dashboard');
        break;

      case 'continue-read':
        showToast(t('dashboard.readerToast'));
        break;

      case 'mat-upload':
        showToast(t('materials.uploadToast'));
        break;
      case 'mat-open':
        showToast(t('materials.readerToast'));
        break;
      case 'mat-tag':
        state.matTag = actionEl.getAttribute('data-tag');
        var chips = document.querySelectorAll('[data-action="mat-tag"]');
        chips.forEach(function (c) { c.setAttribute('aria-pressed', String(c.getAttribute('data-tag') === state.matTag)); });
        renderMaterialsList();
        break;

      case 'quiz-start':
        startQuiz();
        break;
      case 'quiz-generate': {
        if (!state.quiz) state.quiz = { phase: 'start', generating: false };
        state.quiz.generating = true;
        renderPage();
        setTimeout(function () {
          if (!state.quiz || state.quiz.phase !== 'start') return;
          state.quiz.generating = false;
          renderPage();
          showToast(t('quiz.generated'));
        }, 1200);
        break;
      }
      case 'quiz-option':
        selectOption(Number(actionEl.getAttribute('data-index')));
        break;
      case 'quiz-hint':
        state.quiz.hint = !state.quiz.hint;
        renderPage();
        break;
      case 'quiz-reveal':
        forfeitQuiz();
        break;
      case 'quiz-confirm':
        confirmQuiz();
        break;
      case 'quiz-next':
        nextQuiz();
        break;
      case 'quiz-exit':
        askConfirm(t('quiz.exitTitle'), t('quiz.exitBody'), t('quiz.exitLeave'), t('quiz.exitStay'), function () {
          state.quiz = { phase: 'start', generating: false };
          navigate('dashboard');
        });
        break;
      case 'quiz-retry':
        startQuiz();
        break;
      case 'quiz-home':
        navigate('dashboard');
        break;

      case 'flash-flip':
        flipCard();
        break;
      case 'flash-next':
        flashNext();
        break;
      case 'flash-prev':
        flashPrev();
        break;
      case 'flash-diff':
        rateCard(actionEl.getAttribute('data-diff'));
        break;
      case 'flash-finish':
        state.flash.done = true;
        renderPage();
        break;
      case 'flash-again':
        state.flash = { i: 0, flipped: false, ratings: {}, done: false };
        renderPage();
        break;

      case 'task-toggle': {
        var id = actionEl.getAttribute('data-id');
        state.tasks.forEach(function (tk) { if (tk.id === id) tk.done = !tk.done; });
        var top = viewEl.scrollTop;
        renderPage();
        viewEl.scrollTop = top;
        break;
      }

      case 'mistake-review':
        showToast(t('mistakes.reviewToast'));
        break;

      case 'set-lang': {
        var next = actionEl.getAttribute('data-lang');
        if (next && next !== state.lang && (next === 'zh' || next === 'en')) {
          state.lang = next;
          saveLang();
          var sc = viewEl.scrollTop;
          renderApp();
          viewEl.scrollTop = sc;
        }
        break;
      }
      case 'reset-demo':
        askConfirm(t('settings.resetTitle'), t('settings.resetBody'), t('common.confirm'), t('common.cancel'), resetDemo);
        break;

      case 'chat-send': {
        var input = document.getElementById('chatInput');
        sendChat(input ? input.value : '');
        break;
      }
      case 'suggest':
        sendChat(t(actionEl.getAttribute('data-suggest') === 'quiz' ? 'tutor.suggestQuiz'
          : actionEl.getAttribute('data-suggest') === 'summary' ? 'tutor.suggestSummary'
          : actionEl.getAttribute('data-suggest') === 'mistake' ? 'tutor.suggestMistake'
          : 'tutor.suggestExplain'), actionEl.getAttribute('data-suggest'));
        break;
    }
  }

  function handleInput(event) {
    var el = event.target;
    if (el.id === 'materialSearch') {
      state.matQuery = el.value;
      renderMaterialsList();
    } else if (el.id === 'quizInput' && state.quiz) {
      state.quiz.input = el.value;
    } else if (el.id === 'chatInput') {
      state.chatDraft = el.value;
      el.style.height = 'auto';
      el.style.height = Math.min(120, el.scrollHeight) + 'px';
    }
  }

  function handleKeydown(event) {
    if (confirmDialog.open) return;
    if (event.key === 'Escape' && document.body.classList.contains('side-open')) {
      state.sideOpen = false;
      document.body.classList.remove('side-open');
      return;
    }

    if (state.route === 'quiz' && state.quiz && state.quiz.phase === 'running') {
      var q = currentQuestion();
      if (!q) return;
      var target = event.target;
      var inField = target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT');

      if (event.key === 'Escape') {
        event.preventDefault();
        askConfirm(t('quiz.exitTitle'), t('quiz.exitBody'), t('quiz.exitLeave'), t('quiz.exitStay'), function () {
          state.quiz = { phase: 'start', generating: false };
          navigate('dashboard');
        });
        return;
      }
      if (inField) {
        if (event.key === 'Enter' && !event.shiftKey && !state.quiz.revealed && !state.quiz.grading) {
          event.preventDefault();
          confirmQuiz();
        }
        return;
      }
      if (q.type === 'choice' && !state.quiz.revealed && !state.quiz.grading && /^[1-4]$/.test(event.key)) {
        event.preventDefault();
        selectOption(Number(event.key) - 1);
        return;
      }
      if (target && target.closest && target.closest('button') && event.key === 'Enter') return;
      if (event.key === 'Enter') {
        event.preventDefault();
        if (state.quiz.revealed) nextQuiz();
        else confirmQuiz();
      }
      return;
    }

    if (state.route === 'flashcards' && !state.flash.done) {
      var tgt = event.target;
      if (tgt && tgt.closest && tgt.closest('button, a, input, textarea, select')) return;
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        flipCard();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        flashNext();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        flashPrev();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        state.flash.done = true;
        renderPage();
      }
    }
  }

  function handleChatKeydown(event) {
    if (event.target && event.target.id === 'chatInput' && event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendChat(event.target.value);
    }
  }

  function handleHashChange() {
    var raw = '';
    try { raw = location.hash.replace(/^#\/?/, '').trim(); } catch (err) { raw = ''; }
    if (ROUTES.indexOf(raw) < 0) return;
    var route = routeFromHash();
    if (route !== state.route) {
      state.route = route;
      state.sideOpen = false;
      document.body.classList.remove('side-open');
      renderApp();
      viewEl.scrollTop = 0;
    }
  }

  /* ── Boot ──────────────────────────────────────────────── */
  document.addEventListener('click', handleClick);
  document.addEventListener('input', handleInput);
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('keydown', handleChatKeydown);
  window.addEventListener('hashchange', handleHashChange);

  confirmOk.addEventListener('click', function () {
    var fn = pendingConfirm;
    pendingConfirm = null;
    confirmDialog.close();
    if (typeof fn === 'function') fn();
  });
  confirmCancel.addEventListener('click', function () {
    pendingConfirm = null;
    confirmDialog.close();
  });
  confirmDialog.addEventListener('close', function () { pendingConfirm = null; });

  renderApp();
  if (state.route === 'onboarding') {
    viewEl.scrollTop = 0;
  }
})();
