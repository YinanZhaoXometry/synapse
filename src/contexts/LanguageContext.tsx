import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export type Language = "zh" | "en";

const translations = {
  // Common
  "common.student": { zh: "学生用户", en: "Student" },
  "common.level": { zh: "等级", en: "Level" },
  "common.points": { zh: "积分", en: "Points" },
  "common.question": { zh: "问题", en: "Question" },
  "common.answer": { zh: "答案", en: "Answer" },
  "common.clickToReveal": { zh: "点击查看答案", en: "Tap to reveal" },
  "common.minutes": { zh: "分钟", en: "min" },
  "common.hours": { zh: "小时", en: "h" },
  "common.days": { zh: "天", en: "days" },
  "common.continue": { zh: "继续", en: "Continue" },

  // Nav
  "nav.group.overview": { zh: "总览", en: "Overview" },
  "nav.group.learn": { zh: "学习", en: "Learn" },
  "nav.group.practice": { zh: "练习", en: "Practice" },
  "nav.group.progress": { zh: "进度", en: "Progress" },
  "nav.dashboard": { zh: "仪表盘", en: "Dashboard" },
  "nav.aiTutor": { zh: "AI 导师", en: "AI Tutor" },
  "nav.materials": { zh: "学习资料", en: "Materials" },
  "nav.quiz": { zh: "测验", en: "Quiz" },
  "nav.flashcards": { zh: "闪卡", en: "Flashcards" },
  "nav.mistakes": { zh: "错题本", en: "Mistakes" },
  "nav.planner": { zh: "学习计划", en: "Planner" },
  "nav.achievements": { zh: "成就", en: "Achievements" },
  "nav.analytics": { zh: "数据分析", en: "Analytics" },
  "nav.settings": { zh: "设置", en: "Settings" },

  // Study states
  "mastery.ready": { zh: "可以进考场了", en: "Ready" },
  "state.mastered": { zh: "已掌握", en: "Mastered" },
  "state.partial": { zh: "部分掌握", en: "Partial" },
  "state.uncovered": { zh: "未覆盖", en: "Uncovered" },

  // Onboarding
  "onboarding.welcome": { zh: "欢迎使用 Synapse", en: "Welcome to Synapse" },
  "onboarding.subtitle": { zh: "你的 AI 智能学习助手，30秒快速设置。", en: "Your AI-powered study assistant. Set up in 30 seconds." },
  "onboarding.start": { zh: "开始使用", en: "Get Started" },
  "onboarding.goalsTitle": { zh: "你的学习目标是什么？", en: "What are your learning goals?" },
  "onboarding.goalsDesc": { zh: "选择所有适用的选项。", en: "Select all that apply." },
  "onboarding.goalExams": { zh: "备战考试", en: "Prepare for exams" },
  "onboarding.goalUnderstand": { zh: "深入理解概念", en: "Understand concepts deeply" },
  "onboarding.goalRevise": { zh: "高效复习", en: "Revise efficiently" },
  "onboarding.goalPractice": { zh: "做题练习", en: "Practice problems" },
  "onboarding.ready": { zh: "一切就绪！", en: "All Set!" },
  "onboarding.readyDesc": { zh: "你的个性化学习环境已准备好，开始学习吧。", en: "Your personalized learning environment is ready. Let's go!" },
  "onboarding.goDashboard": { zh: "进入仪表盘", en: "Go to Dashboard" },

  // Dashboard
  "dashboard.welcome": { zh: "欢迎回来！👋", en: "Welcome back! 👋" },
  "dashboard.aiReady": { zh: "AI 智能学习已就绪。", en: "AI-powered learning is ready." },
  "dashboard.streak": { zh: "连续", en: "Streak" },
  "dashboard.weeklyGoal": { zh: "每周目标", en: "Weekly Goal" },
  "dashboard.accuracy": { zh: "正确率", en: "Accuracy" },
  "dashboard.correct": { zh: "正确", en: "correct" },
  "dashboard.studyTime": { zh: "学习时长", en: "Study Time" },
  "dashboard.cumulative": { zh: "累计", en: "Total" },
  "dashboard.weeklyProgress": { zh: "每周进度", en: "Weekly Progress" },
  "dashboard.goalCompletion": { zh: "目标完成度", en: "Goal completion" },
  "dashboard.remaining": { zh: "本周还剩", en: "remaining this week" },
  "dashboard.quickActions": { zh: "快捷操作", en: "Quick Actions" },
  "dashboard.startQuiz": { zh: "开始测验", en: "Start Quiz" },
  "dashboard.startQuizDesc": { zh: "测试你的知识掌握程度", en: "Test your knowledge" },
  "dashboard.flashcardReview": { zh: "闪卡复习", en: "Flashcard Review" },
  "dashboard.flashcardReviewDesc": { zh: "间隔重复记忆法", en: "Spaced repetition" },
  "dashboard.studyMaterials": { zh: "学习资料", en: "Study Materials" },
  "dashboard.studyMaterialsDesc": { zh: "上传和整理笔记", en: "Upload & organize notes" },
  "dashboard.aiTutor": { zh: "AI 导师", en: "AI Tutor" },
  "dashboard.aiTutorDesc": { zh: "获取解释和帮助", en: "Get explanations & help" },
  "dashboard.recentAchievements": { zh: "最近成就", en: "Recent Achievements" },
  "dashboard.viewAll": { zh: "查看全部", en: "View All" },

  // AI Tutor
  "tutor.title": { zh: "AI 学习导师", en: "AI Study Tutor" },
  "tutor.subtitle": { zh: "关于课程内容，有什么都可以问我", en: "Ask me anything about your course material" },
  "tutor.prompt": { zh: "我能帮你学什么？", en: "What can I help you learn?" },
  "tutor.promptDesc": { zh: "我可以解释概念、生成测验、总结笔记，帮你从错误中学习。", en: "I can explain concepts, generate quizzes, summarize notes, and help you learn from mistakes." },
  "tutor.inputPlaceholder": { zh: "输入你的问题...", en: "Type your question..." },
  "tutor.suggest1": { zh: "用简单的方式解释这个概念", en: "Explain this concept simply" },
  "tutor.suggest2": { zh: "就这个主题考考我", en: "Quiz me on this topic" },
  "tutor.suggest3": { zh: "总结我的笔记", en: "Summarize my notes" },
  "tutor.suggest4": { zh: "解释我的错误", en: "Explain my mistake" },

  // Materials
  "materials.title": { zh: "学习资料", en: "Study Materials" },
  "materials.uploaded": { zh: "已上传", en: "uploaded" },
  "materials.files": { zh: "个文件", en: "files" },
  "materials.upload": { zh: "上传资料", en: "Upload" },
  "materials.search": { zh: "搜索资料...", en: "Search materials..." },
  "materials.noResults": { zh: "未找到相关资料", en: "No materials found" },
  "materials.pages": { zh: "页", en: "pages" },

  // Quiz
  "quiz.title": { zh: "HCI 练习测验", en: "HCI Practice Quiz" },
  "quiz.questionCount": { zh: "道题", en: "questions" },
  "quiz.multipleChoice": { zh: "选择题", en: "Multiple choice" },
  "quiz.aiHints": { zh: "可使用 AI 提示辅助学习", en: "AI hints available" },
  "quiz.start": { zh: "开始测验", en: "Start Quiz" },
  "quiz.questionOf": { zh: "第 {current} 题 / 共 {total} 题", en: "Question {current} of {total}" },
  "quiz.correctCount": { zh: "已答对 {count} 题", en: "{count} correct" },
  "quiz.checkAnswer": { zh: "查看答案", en: "Check Answer" },
  "quiz.next": { zh: "下一题", en: "Next" },
  "quiz.viewResult": { zh: "查看结果", en: "View Results" },
  "quiz.explanation": { zh: "解析", en: "Explanation" },
  "quiz.getHint": { zh: "获取 AI 提示", en: "Get AI Hint" },
  "quiz.complete": { zh: "测验完成！", en: "Quiz Complete!" },
  "quiz.correctRate": { zh: "正确率", en: "Accuracy" },
  "quiz.earned": { zh: "获得", en: "Earned" },
  "quiz.restart": { zh: "重新测验", en: "Retry" },
  "quiz.generateFromMaterials": { zh: "从资料生成", en: "Generate from Materials" },
  "quiz.generating": { zh: "AI 生成中...", en: "AI Generating..." },
  "quiz.generated": { zh: "已从学习资料自动生成", en: "Auto-generated from your materials" },
  "quiz.exitConfirm": { zh: "确定退出测验吗？当前进度将丢失。", en: "Exit the quiz? Current progress will be lost." },
  "quiz.verdictCorrect": { zh: "回答正确", en: "Correct" },
  "quiz.verdictWrong": { zh: "回答错误", en: "Incorrect" },
  "quiz.keyboardHint": { zh: "按 1–4 选择，Enter 确认，Esc 退出", en: "Press 1–4 to select, Enter to confirm, Esc to exit" },

  // Flashcards
  "flashcards.title": { zh: "闪卡复习", en: "Flashcard Review" },
  "flashcards.aiEnhanced": { zh: "AI 增强的间隔重复", en: "AI-enhanced spaced repetition" },
  "flashcards.reviewed": { zh: "已复习", en: "reviewed" },
  "flashcards.cards": { zh: "张", en: "" },
  "flashcards.ratePrompt": { zh: "你对这个知识点的掌握程度如何？", en: "How well do you know this?" },
  "flashcards.hard": { zh: "不熟", en: "Hard" },
  "flashcards.medium": { zh: "一般", en: "Medium" },
  "flashcards.easy": { zh: "熟练", en: "Easy" },
  "flashcards.aiTip": { zh: "AI 学习建议", en: "AI Study Tip" },
  "flashcards.aiTipContent": { zh: "试着将这个概念与你遇到过的真实案例联系起来。这样能建立更强的记忆关联，有助于考试时的回忆。", en: "Try connecting this concept to real-world examples you've encountered. This builds stronger memory associations for exam recall." },
  "flashcards.generateFromMaterials": { zh: "从资料生成", en: "Generate from Materials" },
  "flashcards.generating": { zh: "AI 生成中...", en: "AI Generating..." },

  // Mistakes
  "mistakes.title": { zh: "错题本", en: "Mistake Notebook" },
  "mistakes.needReview": { zh: "道题需要复习", en: "questions to review" },
  "mistakes.retryAll": { zh: "全部重做", en: "Retry All" },
  "mistakes.weakAreas": { zh: "检测到薄弱知识点", en: "Weak areas detected" },
  "mistakes.weakAreasDesc": { zh: "建议重点复习：", en: "Focus on reviewing: " },
  "mistakes.yourAnswer": { zh: "你的答案", en: "Your Answer" },
  "mistakes.correctAnswer": { zh: "正确答案", en: "Correct Answer" },
  "mistakes.aiAnalysis": { zh: "AI 解析", en: "AI Analysis" },

  // Planner
  "planner.title": { zh: "学习计划", en: "Study Planner" },
  "planner.completed": { zh: "已完成", en: "Completed" },
  "planner.tasks": { zh: "个任务", en: "tasks" },
  "planner.remaining": { zh: "剩余约", en: "~remaining" },
  "planner.aiPlan": { zh: "AI 规划", en: "AI Plan" },
  "planner.addTask": { zh: "添加任务", en: "Add Task" },
  "planner.todayProgress": { zh: "今日进度", en: "Today's Progress" },
  "planner.aiSuggested": { zh: "AI 推荐", en: "AI Suggested" },
  "planner.priorityHigh": { zh: "高", en: "High" },
  "planner.priorityMedium": { zh: "中", en: "Med" },
  "planner.priorityLow": { zh: "低", en: "Low" },

  // Achievements
  "achievements.title": { zh: "成就系统", en: "Achievements" },
  "achievements.unlocked": { zh: "已解锁", en: "Unlocked" },
  "achievements.streakDays": { zh: "连续天数", en: "Streak" },
  "achievements.currentLevel": { zh: "当前等级", en: "Level" },
  "achievements.badges": { zh: "获得徽章", en: "Badges" },
  "achievements.totalPoints": { zh: "总积分", en: "Total Points" },
  "achievements.unlockedLabel": { zh: "✓ 已解锁", en: "✓ Unlocked" },

  // Achievement items
  "achievement.firstQuiz": { zh: "测验新手", en: "Quiz Rookie" },
  "achievement.firstQuizDesc": { zh: "完成第一次测验", en: "Complete your first quiz" },
  "achievement.streak3": { zh: "三天连续", en: "3-Day Streak" },
  "achievement.streak3Desc": { zh: "连续学习3天", en: "Study 3 days in a row" },
  "achievement.streak7": { zh: "周冠军", en: "Week Champion" },
  "achievement.streak7Desc": { zh: "连续学习7天", en: "Study 7 days in a row" },
  "achievement.flashcard50": { zh: "卡牌收集者", en: "Card Collector" },
  "achievement.flashcard50Desc": { zh: "复习50张闪卡", en: "Review 50 flashcards" },
  "achievement.perfectQuiz": { zh: "满分达人", en: "Perfect Score" },
  "achievement.perfectQuizDesc": { zh: "在测验中获得100%", en: "Get 100% on a quiz" },
  "achievement.streak14": { zh: "双周冠军", en: "2-Week Champion" },
  "achievement.streak14Desc": { zh: "连续学习14天", en: "Study 14 days in a row" },
  "achievement.flashcard200": { zh: "记忆大师", en: "Memory Master" },
  "achievement.flashcard200Desc": { zh: "复习200张闪卡", en: "Review 200 flashcards" },
  "achievement.materials10": { zh: "知识构建者", en: "Knowledge Builder" },
  "achievement.materials10Desc": { zh: "上传10份学习资料", en: "Upload 10 study materials" },
  "achievement.level10": { zh: "学霸", en: "Top Student" },
  "achievement.level10Desc": { zh: "达到10级", en: "Reach level 10" },
  "achievement.study1000": { zh: "时间投资者", en: "Time Investor" },
  "achievement.study1000Desc": { zh: "累计学习1000分钟", en: "Study 1000 minutes total" },
  "achievement.accuracy90": { zh: "头脑敏锐", en: "Sharp Mind" },
  "achievement.accuracy90Desc": { zh: "保持90%以上正确率", en: "Maintain 90%+ accuracy" },
  "achievement.allTopics": { zh: "全面发展", en: "Well-Rounded" },
  "achievement.allTopicsDesc": { zh: "学习所有可用主题", en: "Study all available topics" },

  // Analytics
  "analytics.title": { zh: "数据分析", en: "Analytics" },
  "analytics.subtitle": { zh: "跟踪学习进度，发现待提升的领域", en: "Track your progress and find areas to improve" },
  "analytics.totalStudyTime": { zh: "总学习时长", en: "Total Study Time" },
  "analytics.flashcardsReviewed": { zh: "已复习闪卡", en: "Cards Reviewed" },
  "analytics.quizzesCompleted": { zh: "已完成测验", en: "Quizzes Done" },
  "analytics.weeklyStudyTime": { zh: "每周学习时长", en: "Weekly Study Time" },
  "analytics.weeklyStudyTimeDesc": { zh: "每周学习分钟数", en: "Study minutes per week" },
  "analytics.accuracyTrend": { zh: "正确率趋势", en: "Accuracy Trend" },
  "analytics.accuracyTrendDesc": { zh: "测验正确率变化", en: "Quiz accuracy over time" },
  "analytics.topicStrength": { zh: "知识点掌握度", en: "Topic Mastery" },
  "analytics.topicStrengthDesc": { zh: "各主题的掌握水平", en: "Mastery level by topic" },

  // Settings
  "settings.title": { zh: "设置", en: "Settings" },
  "settings.subtitle": { zh: "管理你的账户和偏好设置", en: "Manage your account and preferences" },
  "settings.profile": { zh: "个人资料", en: "Profile" },
  "settings.language": { zh: "界面语言", en: "Language" },
  "settings.languageDesc": { zh: "切换界面显示语言", en: "Switch display language" },

  // NotFound
  "notFound.title": { zh: "页面未找到", en: "Page Not Found" },
  "notFound.back": { zh: "返回首页", en: "Back to Home" },

  // Material items (for generated content)
  "material.hciLecture1": { zh: "HCI 第一讲 - 概述", en: "HCI Lecture 1 - Overview" },
  "material.usabilityNotes": { zh: "可用性启发式笔记", en: "Usability Heuristics Notes" },
  "material.cognitiveLoad": { zh: "认知负荷理论", en: "Cognitive Load Theory" },
  "material.userResearch": { zh: "用户研究方法", en: "User Research Methods" },
  "material.interactionPatterns": { zh: "交互设计模式", en: "Interaction Design Patterns" },
} as const;

type TranslationKey = keyof typeof translations;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem("synapse-lang");
    return (saved === "en" || saved === "zh") ? saved : "zh";
  });

  const setLanguage = useCallback((lang: Language) => {
    setLang(lang);
    localStorage.setItem("synapse-lang", lang);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    const entry = (translations as Record<string, Record<string, string>>)[key];
    let text = entry?.[language] ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        text = text.replace(`{${k}}`, String(v));
      });
    }
    return text;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
