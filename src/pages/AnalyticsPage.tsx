import { AnimatedSection } from "@/components/shared/AnimatedSection";
import { StatCard } from "@/components/shared/StatCard";
import { useUserProgress } from "@/contexts/UserProgressContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { TrendingUp, Clock, Target, Brain } from "lucide-react";

export default function AnalyticsPage() {
  const { progress } = useUserProgress();
  const { t, language } = useLanguage();
  const accuracy = progress.totalAnswers > 0 ? Math.round((progress.correctAnswers / progress.totalAnswers) * 100) : 0;

  const days = language === "zh"
    ? ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const weeklyData = [
    { day: days[0], minutes: 65 },
    { day: days[1], minutes: 95 },
    { day: days[2], minutes: 55 },
    { day: days[3], minutes: 95 },
    { day: days[4], minutes: 100 },
    { day: days[5], minutes: 55 },
    { day: days[6], minutes: 95 },
  ];

  const weeks = language === "zh" ? ["第1周", "第2周", "第3周", "第4周"] : ["Wk 1", "Wk 2", "Wk 3", "Wk 4"];
  const accuracyTrend = [
    { week: weeks[0], accuracy: 62 },
    { week: weeks[1], accuracy: 71 },
    { week: weeks[2], accuracy: 78 },
    { week: weeks[3], accuracy: 85 },
  ];

  const topicStrength = [
    { name: language === "zh" ? "可用性" : "Usability", value: 85, color: "hsl(var(--chart-accent))" },
    { name: language === "zh" ? "认知" : "Cognition", value: 60, color: "hsl(38, 92%, 50%)" },
    { name: language === "zh" ? "设计" : "Design", value: 72, color: "hsl(160, 84%, 39%)" },
    { name: language === "zh" ? "研究" : "Research", value: 45, color: "hsl(0, 72%, 51%)" },
  ];

  const studyH = Math.round(progress.studyMinutes / 60);
  const studyM = progress.studyMinutes % 60;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      <AnimatedSection>
        <h1 className="page-title">{t("analytics.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("analytics.subtitle")}</p>
      </AnimatedSection>

      <AnimatedSection delay={0.05}>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Clock className="w-4 h-4" />} label={t("analytics.totalStudyTime")} value={`${studyH}${t("common.hours")}${studyM}${t("common.minutes")}`} />
          <StatCard icon={<Target className="w-4 h-4" />} label={t("dashboard.accuracy")} value={`${accuracy}%`} />
          <StatCard icon={<Brain className="w-4 h-4" />} label={t("analytics.flashcardsReviewed")} value={progress.flashcardsReviewed.toString()} />
          <StatCard icon={<TrendingUp className="w-4 h-4" />} label={t("analytics.quizzesCompleted")} value={progress.quizzesCompleted.toString()} />
        </div>
      </AnimatedSection>

      <AnimatedSection delay={0.1}>
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-display font-semibold mb-1">{t("analytics.weeklyStudyTime")}</h3>
          <p className="text-xs text-muted-foreground mb-4">{t("analytics.weeklyStudyTimeDesc")}</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={weeklyData} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(var(--chart-axis))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--chart-axis))" />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--chart-grid))", fontSize: 12 }} />
              <Bar dataKey="minutes" name={t("analytics.totalStudyTime")} fill="hsl(var(--chart-accent))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </AnimatedSection>

      <div className="grid lg:grid-cols-2 gap-6">
        <AnimatedSection delay={0.15}>
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-display font-semibold mb-1">{t("analytics.accuracyTrend")}</h3>
            <p className="text-xs text-muted-foreground mb-4">{t("analytics.accuracyTrendDesc")}</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={accuracyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--chart-grid))" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(var(--chart-axis))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--chart-axis))" domain={[40, 100]} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--chart-grid))", fontSize: 12 }} />
                <Line type="monotone" dataKey="accuracy" name={t("dashboard.accuracy")} stroke="hsl(var(--chart-accent))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </AnimatedSection>

        <AnimatedSection delay={0.2}>
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-display font-semibold mb-1">{t("analytics.topicStrength")}</h3>
            <p className="text-xs text-muted-foreground mb-4">{t("analytics.topicStrengthDesc")}</p>
            <div className="space-y-4">
              {topicStrength.map(topic => (
                <div key={topic.name}>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-medium">{topic.name}</span>
                    <span className="mastery-number text-xs text-muted-foreground">{topic.value}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${topic.value}%`, backgroundColor: topic.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AnimatedSection>
      </div>
    </div>
  );
}
