"use client";

import { useState, useEffect, useRef } from "react";
import {
  Search,
  Filter,
  Star,
  Download,
  Upload,
  Shuffle,
  Bookmark,
  BookmarkCheck,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  Settings,
  Bot,
  Copy,
  Github,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/components/ui/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { useMobile } from "@/hooks/use-mobile";
import {
  Question,
  Questions,
  categories,
  companies,
  levels,
} from "@/lib/interview-data";
import { getAiAnalysis as fetchAiAnalysis, AiSettings } from "@/lib/openai";
import { defaultAiSettings, PROMPT_TEMPLATES } from "@/lib/ai-defaults";
import Markdown from "@/app/components/markdown";
import { ThemeToggle } from "@/app/components/theme-toggle";

export default function InterviewQuestionsPage() {
  const isMobile = useMobile();
  const { toast } = useToast();
  const [showGithubBanner, setShowGithubBanner] = useState(true);

  useEffect(() => {
    // 从localStorage中读取横幅显示状态
    const bannerState = localStorage.getItem("githubBannerClosed");
    if (bannerState === "true") {
      setShowGithubBanner(false);
    }
  }, []);

  // 关闭横幅并保存状态到localStorage
  const closeGithubBanner = () => {
    setShowGithubBanner(false);
    localStorage.setItem("githubBannerClosed", "true");
  };

  // 添加换一道题的函数
  const getNextRandomQuestion = () => {
    const visibleQuestions = questions.filter(
      q => !q.isHidden && q.id !== currentRandomQuestion?.id
    );
    if (visibleQuestions.length === 0) {
      toast({
        title: "没有更多可用的问题",
        description: "请尝试重置筛选条件或显示更多问题。",
        variant: "destructive",
      });
      return;
    }

    const randomIndex = Math.floor(Math.random() * visibleQuestions.length);
    const randomQuestion = visibleQuestions[randomIndex];

    // 设置新的随机题目
    setCurrentRandomQuestion(randomQuestion);
  };

  // 在 InterviewQuestionsPage 函数顶部添加这些状态
  const [randomQuestionDialogOpen, setRandomQuestionDialogOpen] =
    useState(false);
  const [currentRandomQuestion, setCurrentRandomQuestion] =
    useState<Question | null>(null);

  // State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);


  // Filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCompany, setSelectedCompany] = useState("全部");
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [selectedLevel, setSelectedLevel] = useState("全部");
  const [selectedRating, setSelectedRating] = useState(0);
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [showScrollTop, setShowScrollTop] = useState(false);

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<{ [key: number]: string | { coach: string; deep: string; quick: string } }>({});
  const [isAnalyzing, setIsAnalyzing] = useState<{ [key: number]: boolean }>(
    {}
  );

  // AI Model settings state
  const [aiModelSettings, setAiModelSettings] = useState<AiSettings>(() => {
    // Initialize from localStorage if available
    if (typeof window !== "undefined") {
      const savedSettings = localStorage.getItem("aiModelSettings");
      if (savedSettings) {
        return JSON.parse(savedSettings);
      }
    }
    return defaultAiSettings;
  });

  // 添加设置对话框的开关状态
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [promptValue, setPromptValue] = useState("");
  // 添加 AI 分析的 Tab 状态
  const [activeAnalysisTab, setActiveAnalysisTab] = useState("coach");

  // 当设置对话框打开时，初始化 promptValue
  useEffect(() => {
    if (aiSettingsOpen) {
      setPromptValue(aiModelSettings.prompt);
    }
  }, [aiSettingsOpen, aiModelSettings]);

  // 从 localStorage 中加载筛选状态的函数
  const loadFilterState = () => {
    const savedState = localStorage.getItem("interviewFilterState");
    if (savedState) {
      const state = JSON.parse(savedState);
      setSearchTerm(state.searchTerm || "");
      setSelectedCompany(state.selectedCompany || "全部");
      setSelectedCategory(state.selectedCategory || "全部");
      setSelectedLevel(state.selectedLevel || "全部");
      setSelectedRating(state.selectedRating || 0);
      setShowOnlyFavorites(state.showOnlyFavorites || false);

      setActiveTab(state.activeTab || "all");
      setCurrentPage(state.currentPage || 1);
      setItemsPerPage(state.itemsPerPage || 10);
    }
  };

  // 修改 useEffect 钩子，加载用户的筛选状态
  useEffect(() => {
    // In a real app, this would be an API call
    const savedQuestions = localStorage.getItem("interviewQuestions");
    if (savedQuestions) {
      setQuestions(JSON.parse(savedQuestions));
    } else {
      setQuestions(Questions);
      localStorage.setItem("interviewQuestions", JSON.stringify(Questions));
    }

    // 加载保存的筛选状态
    loadFilterState();
  }, []);

  // Apply filters and pagination
  useEffect(() => {
    let result = [...questions];

    // Apply tab filter
    if (activeTab === "favorites") {
      result = result.filter(q => q.isFavorite);
    }

    // Apply search
    if (searchTerm) {
      result = result.filter(
        q =>
          q.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.company.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply company filter
    if (selectedCompany !== "全部") {
      result = result.filter(q => q.company === selectedCompany);
    }

    // Apply category filter
    if (selectedCategory !== "全部") {
      result = result.filter(q => q.category === selectedCategory);
    }

    // Apply level filter
    if (selectedLevel !== "全部") {
      result = result.filter(q => q.level === selectedLevel);
    }

    // Apply rating filter
    if (selectedRating > 0) {
      result = result.filter(q => q.rating >= selectedRating);
    }

    // Apply favorites filter
    if (showOnlyFavorites) {
      result = result.filter(q => q.isFavorite);
    }

    // Apply hidden/visible filter based on tab
    if (activeTab === "hidden") {
      result = result.filter(q => q.isHidden);
    } else {
      result = result.filter(q => !q.isHidden);
    }

    // Calculate total pages
    setTotalPages(Math.ceil(result.length / itemsPerPage));

    // Apply pagination
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedResult = result.slice(startIndex, startIndex + itemsPerPage);

    setFilteredQuestions(paginatedResult);
  }, [
    questions,
    searchTerm,
    selectedCompany,
    selectedCategory,
    selectedLevel,
    selectedRating,
    showOnlyFavorites,

    currentPage,
    itemsPerPage,
    activeTab,
  ]);

  // 修改筛选相关的 useState 钩子，使其在状态变化时保存状态
  const setSearchTermAndSave = (value: string) => {
    setSearchTerm(value);
    // 将页码重置为 1，避免筛选结果变化后出现空页面
    setCurrentPage(1);
    // 保存状态，但需要使用最新的页码值(1)
    const filterState = {
      searchTerm: value,
      selectedCompany,
      selectedCategory,
      selectedLevel,
      selectedRating,
      showOnlyFavorites,

      activeTab,
      currentPage: 1,
      itemsPerPage,
    };
    localStorage.setItem("interviewFilterState", JSON.stringify(filterState));
  };

  const setSelectedCompanyAndSave = (value: string) => {
    setSelectedCompany(value);
    setCurrentPage(1);
    // 保存状态，使用最新的页码值(1)
    const filterState = {
      searchTerm,
      selectedCompany: value,
      selectedCategory,
      selectedLevel,
      selectedRating,
      showOnlyFavorites,

      activeTab,
      currentPage: 1,
      itemsPerPage,
    };
    localStorage.setItem("interviewFilterState", JSON.stringify(filterState));
  };

  const setSelectedCategoryAndSave = (value: string) => {
    setSelectedCategory(value);
    setCurrentPage(1);
    // 直接保存最新状态
    const filterState = {
      searchTerm,
      selectedCompany,
      selectedCategory: value,
      selectedLevel,
      selectedRating,
      showOnlyFavorites,

      activeTab,
      currentPage: 1,
      itemsPerPage,
    };
    localStorage.setItem("interviewFilterState", JSON.stringify(filterState));
  };

  const setSelectedLevelAndSave = (value: string) => {
    setSelectedLevel(value);
    setCurrentPage(1);
    // 直接保存最新状态
    const filterState = {
      searchTerm,
      selectedCompany,
      selectedCategory,
      selectedLevel: value,
      selectedRating,
      showOnlyFavorites,

      activeTab,
      currentPage: 1,
      itemsPerPage,
    };
    localStorage.setItem("interviewFilterState", JSON.stringify(filterState));
  };

  const setSelectedRatingAndSave = (value: number) => {
    setSelectedRating(value);
    setCurrentPage(1);
    // 直接保存最新状态
    const filterState = {
      searchTerm,
      selectedCompany,
      selectedCategory,
      selectedLevel,
      selectedRating: value,
      showOnlyFavorites,

      activeTab,
      currentPage: 1,
      itemsPerPage,
    };
    localStorage.setItem("interviewFilterState", JSON.stringify(filterState));
  };

  const setShowOnlyFavoritesAndSave = (value: boolean) => {
    setShowOnlyFavorites(value);
    setCurrentPage(1);
    // 直接保存最新状态
    const filterState = {
      searchTerm,
      selectedCompany,
      selectedCategory,
      selectedLevel,
      selectedRating,
      showOnlyFavorites: value,

      activeTab,
      currentPage: 1,
      itemsPerPage,
    };
    localStorage.setItem("interviewFilterState", JSON.stringify(filterState));
  };



  const setActiveTabAndSave = (value: string) => {
    setActiveTab(value);
    setCurrentPage(1);
    // 直接保存最新状态
    const filterState = {
      searchTerm,
      selectedCompany,
      selectedCategory,
      selectedLevel,
      selectedRating,
      showOnlyFavorites,

      activeTab: value,
      currentPage: 1,
      itemsPerPage,
    };
    localStorage.setItem("interviewFilterState", JSON.stringify(filterState));
  };

  const setCurrentPageAndSave = (value: number) => {
    // 使用函数式更新确保获取到最新的状态值
    setCurrentPage(value);
    // 直接将当前值保存到localStorage，不使用setTimeout延迟
    const filterState = {
      searchTerm,
      selectedCompany,
      selectedCategory,
      selectedLevel,
      selectedRating,
      showOnlyFavorites,

      activeTab,
      currentPage: value, // 使用传入的新值而不是依赖state
      itemsPerPage,
    };
    localStorage.setItem("interviewFilterState", JSON.stringify(filterState));
  };

  const setItemsPerPageAndSave = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1);
    // 直接保存最新状态
    const filterState = {
      searchTerm,
      selectedCompany,
      selectedCategory,
      selectedLevel,
      selectedRating,
      showOnlyFavorites,

      activeTab,
      currentPage: 1,
      itemsPerPage: value,
    };
    localStorage.setItem("interviewFilterState", JSON.stringify(filterState));
  };

  // 修改 resetFilters 函数，使其重置后保存状态
  const resetFilters = () => {
    // 设置重置值
    setSearchTerm("");
    setSelectedCompany("全部");
    setSelectedCategory("全部");
    setSelectedLevel("全部");
    setSelectedRating(0);
    setShowOnlyFavorites(false);
    setCurrentPage(1);
    setActiveTab("all");

    // 直接保存重置后的状态
    const filterState = {
      searchTerm: "",
      selectedCompany: "全部",
      selectedCategory: "全部",
      selectedLevel: "全部",
      selectedRating: 0,
      showOnlyFavorites: false,

      activeTab: "all",
      currentPage: 1,
      itemsPerPage,
    };
    localStorage.setItem("interviewFilterState", JSON.stringify(filterState));
  };

  // 修改 handlePageChange 函数，使其在页码变化时保存状态
  const handlePageChange = (page: number) => {
    setCurrentPageAndSave(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Scroll to top 函数
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Toggle favorite
  const toggleFavorite = (id: number) => {
    const updatedQuestions = questions.map(q =>
      q.id === id ? { ...q, isFavorite: !q.isFavorite } : q
    );
    setQuestions(updatedQuestions);
    localStorage.setItem(
      "interviewQuestions",
      JSON.stringify(updatedQuestions)
    );

    const question = updatedQuestions.find(q => q.id === id);
    if (question) {
      // 如果当前正在显示的随机题目是被操作的题目，也需要更新它
      if (currentRandomQuestion && currentRandomQuestion.id === id) {
        setCurrentRandomQuestion(question);
      }

      toast({
        title: question.isFavorite ? "已添加到收藏" : "已从收藏中移除",
        description:
          question.content.substring(0, 30) +
          (question.content.length > 30 ? "..." : ""),
      });
    }
  };

  // Toggle hidden
  const toggleHidden = (id: number) => {
    const updatedQuestions = questions.map(q =>
      q.id === id ? { ...q, isHidden: !q.isHidden } : q
    );
    setQuestions(updatedQuestions);
    localStorage.setItem(
      "interviewQuestions",
      JSON.stringify(updatedQuestions)
    );

    const question = updatedQuestions.find(q => q.id === id);
    if (question) {
      // 如果当前正在显示的随机题目是被操作的题目，也需要更新它
      if (currentRandomQuestion && currentRandomQuestion.id === id) {
        setCurrentRandomQuestion(question);
      }

      toast({
        title: question.isHidden ? "问题已隐藏" : "问题已显示",
        description:
          question.content.substring(0, 30) +
          (question.content.length > 30 ? "..." : ""),
      });
    }
  };

  // 修改 getRandomQuestion 函数
  const getRandomQuestion = () => {
    const visibleQuestions = questions.filter(q => !q.isHidden);
    if (visibleQuestions.length === 0) {
      toast({
        title: "没有可用的问题",
        description: "所有问题都被隐藏了，请先显示一些问题。",
        variant: "destructive",
      });
      return;
    }

    const randomIndex = Math.floor(Math.random() * visibleQuestions.length);
    const randomQuestion = visibleQuestions[randomIndex];

    // 设置当前随机题目并打开对话框
    setCurrentRandomQuestion(randomQuestion);
    setRandomQuestionDialogOpen(true);
  };

  // Export favorites
  const exportFavorites = () => {
    const favorites = questions.filter(q => q.isFavorite);
    if (favorites.length === 0) {
      toast({
        title: "没有收藏的问题",
        description: "请先收藏一些问题再导出。",
        variant: "destructive",
      });
      return;
    }

    const exportData = JSON.stringify(favorites, null, 2);
    const blob = new Blob([exportData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `前端面试题收藏-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "导出成功",
      description: `已导出 ${favorites.length} 个收藏的问题。`,
    });
  };

  // Import favorites
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const content = event.target?.result as string;
        const importedQuestions = JSON.parse(content);

        if (!Array.isArray(importedQuestions)) {
          throw new Error("导入的文件格式不正确");
        }

        const importedIds = new Set(importedQuestions.map((q: any) => q.id));
        let addedCount = 0;

        const updatedQuestions = questions.map(q => {
          if (importedIds.has(q.id) && !q.isFavorite) {
            addedCount++;
            return { ...q, isFavorite: true };
          }
          return q;
        });

        if (addedCount > 0) {
          setQuestions(updatedQuestions);
          localStorage.setItem(
            "interviewQuestions",
            JSON.stringify(updatedQuestions)
          );
          toast({
            title: "导入成功",
            description: `成功导入 ${addedCount} 个新收藏，${importedQuestions.length - addedCount} 个已存在。`,
          });
        } else {
          toast({
            title: "无需导入",
            description: "所有导入的题目都已经在收藏列表中了",
          });
        }
      } catch (error) {
        console.error("导入失败:", error);
        toast({
          title: "导入失败",
          description: "文件格式错误或无法解析",
          variant: "destructive",
        });
      }

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  // Save AI model settings
  const saveAiModelSettings = (settings: AiSettings) => {
    setAiModelSettings(settings);
    localStorage.setItem("aiModelSettings", JSON.stringify(settings));
    // 保存后关闭对话框
    setAiSettingsOpen(false);
    toast({
      title: "设置已保存",
      description: "AI模型设置已更新",
    });
  };

  // Get AI analysis
  const getAiAnalysis = async (id: number) => {
    // If analysis already exists, don't fetch again
    if (aiAnalysis[id] || isAnalyzing[id]) {
      return;
    }

    const question = questions.find(q => q.id === id);
    if (!question) return;

    setIsAnalyzing(prev => ({
      ...prev,
      [id]: true,
    }));

    try {
      if (aiModelSettings.superMode) {
        // Super Mode: Invoke 3 default prompts
        setAiAnalysis(prev => ({
          ...prev,
          [id]: { coach: "", deep: "", quick: "" },
        }));

        const prompts = ["coach", "deep", "quick"] as const;

        await Promise.all(
          prompts.map(async key => {
            const settings = {
              ...aiModelSettings,
              prompt: PROMPT_TEMPLATES[key].value,
            };

            const handleChunk = (chunk: string) => {
              setAiAnalysis(prev => {
                const current = prev[id];
                const currentObj =
                  typeof current === "object"
                    ? current
                    : { coach: "", deep: "", quick: "" };
                return {
                  ...prev,
                  [id]: { ...currentObj, [key]: chunk },
                };
              });
            };

            try {
              if (settings.streaming) {
                await fetchAiAnalysis(question.content, settings, handleChunk);
              } else {
                const result = await fetchAiAnalysis(question.content, settings);
                handleChunk(result);
              }
            } catch (error) {
              handleChunk(
                `分析生成失败: ${error instanceof Error ? error.message : "未知错误"}`
              );
            }
          })
        );
      } else {
        // Normal Mode
        if (aiModelSettings.streaming) {
          setAiAnalysis(prev => ({
            ...prev,
            [id]: "",
          }));

          const handleStreamingChunk = (chunk: string) => {
            setAiAnalysis(prev => ({
              ...prev,
              [id]: chunk,
            }));
          };

          await fetchAiAnalysis(
            question.content,
            aiModelSettings,
            handleStreamingChunk
          );
        } else {
          setAiAnalysis(prev => ({
            ...prev,
            [id]: "正在分析中...",
          }));

          const analysis = await fetchAiAnalysis(
            question.content,
            aiModelSettings
          );

          setAiAnalysis(prev => ({
            ...prev,
            [id]: analysis,
          }));
        }
      }
    } catch (error) {
      console.error("AI分析失败:", error);
      // Only set error for normal mode or if everything failed
      if (!aiModelSettings.superMode) {
        setAiAnalysis(prev => ({
          ...prev,
          [id]: `分析生成失败: ${error instanceof Error ? error.message : "未知错误"}`,
        }));
      }
    } finally {
      setIsAnalyzing(prev => ({
        ...prev,
        [id]: false,
      }));
    }
  };

  // Scroll event listener for "back to top" button
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Render star rating
  const renderStarRating = (rating: number) => {
    return (
      <div className="flex">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
          />
        ))}
      </div>
    );
  };

  // Render pagination
  const renderPagination = () => {
    const pages = [];
    const maxVisiblePages = isMobile ? 3 : 5;

    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(
        <Button
          key={i}
          variant={currentPage === i ? "default" : "outline"}
          size="sm"
          onClick={() => handlePageChange(i)}
          className="w-9 h-9 p-0"
        >
          {i}
        </Button>
      );
    }

    return (
      <div className="flex items-center justify-center gap-1 mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="w-9 h-9 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {startPage > 1 && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(1)}
              className="w-9 h-9 p-0"
            >
              1
            </Button>
            {startPage > 2 && <span className="mx-1">...</span>}
          </>
        )}

        {pages}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="mx-1">...</span>}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(totalPages)}
              className="w-9 h-9 p-0"
            >
              {totalPages}
            </Button>
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            handlePageChange(Math.min(totalPages, currentPage + 1))
          }
          disabled={currentPage === totalPages}
          className="w-9 h-9 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    );
  };

  // 添加复制AI分析的函数
  const copyAiAnalysis = (questionContent: string, analysisContent: string) => {
    const textToCopy = `问题：${questionContent}\n\n分析：\n${analysisContent}`;

    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        toast({
          title: "复制成功",
          description: "问题和AI分析已复制到剪贴板",
        });
      })
      .catch(error => {
        console.error("复制失败:", error);
        toast({
          title: "复制失败",
          description: "无法复制到剪贴板",
          variant: "destructive",
        });
      });
  };

  const isFiltered =
    searchTerm !== "" ||
    selectedCompany !== "全部" ||
    selectedCategory !== "全部" ||
    selectedLevel !== "全部" ||
    selectedRating !== 0 ||
    showOnlyFavorites === true;

  const renderQuestions = (emptyMessage: string, emptyAction?: React.ReactNode) => {
    return filteredQuestions.length > 0 ? (
      <div className="space-y-4">
        {filteredQuestions.map(question => (
          <Card
            key={question.id}
            id={`question-${question.id}`}
            className={`transition-all duration-300 ${question.isHidden ? "opacity-60" : ""}`}
          >
            <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-sm">
                    {question.company}
                  </span>
                  <Badge variant="outline">{question.level}</Badge>
                  <Badge variant="secondary">
                    {question.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {question.date}
                  </span>
                </div>
                {renderStarRating(question.rating)}
              </div>

              <div className="flex items-center gap-1">
                <Dialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 px-2 text-xs sm:text-sm flex items-center gap-1"
                          onClick={() => getAiAnalysis(question.id)}
                        >
                          <Bot className="h-4 w-4" />
                          <span className="hidden sm:inline">AI 解析</span>
                        </Button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>AI 智能解析</TooltipContent>
                  </Tooltip>
                  <DialogContent
                    className="max-w-[90vw] md:max-w-4xl lg:max-w-5xl h-[85vh] p-0 flex flex-col gap-0 outline-none overflow-hidden"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <DialogHeader className="px-6 py-4 border-b bg-muted/10 shrink-0 pr-12">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <DialogTitle className="flex items-center gap-2">
                            <Bot className="h-5 w-5 text-primary" />
                            AI 智能解析
                          </DialogTitle>
                          <DialogDescription className="line-clamp-1 text-xs sm:text-sm">
                            针对: <span className="font-medium text-foreground">"{question.content}"</span>
                          </DialogDescription>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-8 px-2 sm:px-3 text-xs sm:text-sm gap-1.5 transition-colors ${question.isFavorite
                              ? "text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/10"
                              : "text-muted-foreground hover:text-foreground"
                              }`}
                            onClick={() => toggleFavorite(question.id)}
                            title={question.isFavorite ? "取消收藏" : "加入收藏"}
                          >
                            {question.isFavorite ? (
                              <BookmarkCheck className="h-4 w-4 fill-current" />
                            ) : (
                              <Bookmark className="h-4 w-4" />
                            )}
                            <span className="hidden sm:inline">
                              {question.isFavorite ? "已收藏" : "收藏"}
                            </span>
                          </Button>

                          {aiAnalysis[question.id] && (
                            <>
                              <div className="h-4 w-px bg-border/50 hidden sm:block" />
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 sm:px-3 gap-1.5 text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  const ans = aiAnalysis[question.id];
                                  const content = typeof ans === 'string' ? ans : ans[activeAnalysisTab as keyof typeof ans];
                                  copyAiAnalysis(question.content, content);
                                }}
                                title="复制内容"
                              >
                                <Copy className="h-4 w-4" />
                                <span className="hidden sm:inline text-xs sm:text-sm">复制</span>
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </DialogHeader>
                    <div className={`flex-1 ${typeof aiAnalysis[question.id] === 'object' ? 'overflow-hidden p-0' : 'overflow-y-auto p-6 pb-10'} scroll-smooth transition-all`}>
                      {typeof aiAnalysis[question.id] === 'object' ? (
                        <div className="h-full flex flex-col">
                          <Tabs value={activeAnalysisTab} onValueChange={setActiveAnalysisTab} className="h-full flex flex-col">
                            <div className="shrink-0 bg-muted/5">
                              <TabsList className="grid w-full grid-cols-3 h-11 bg-transparent p-0 rounded-none border-b">
                                <TabsTrigger
                                  value="coach"
                                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:text-primary px-0 text-sm"
                                >
                                  全能教练
                                </TabsTrigger>
                                <TabsTrigger
                                  value="deep"
                                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:text-primary px-0 text-sm"
                                >
                                  深度原理
                                </TabsTrigger>
                                <TabsTrigger
                                  value="quick"
                                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:text-primary px-0 text-sm"
                                >
                                  速成技巧
                                </TabsTrigger>
                              </TabsList>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 pb-10">
                              {['coach', 'deep', 'quick'].map((mode) => (
                                <TabsContent key={mode} value={mode} className="mt-0 outline-none">
                                  <Markdown
                                    content={(aiAnalysis[question.id] as any)[mode] || ''}
                                    className={
                                      aiModelSettings.streaming &&
                                        isAnalyzing[question.id]
                                        ? "streaming-cursor"
                                        : ""
                                    }
                                  />
                                  {isAnalyzing[question.id] && !(aiAnalysis[question.id] as any)[mode] && (
                                    <div className="flex items-center gap-2 text-muted-foreground mt-4 animate-pulse">
                                      <div className="h-2 w-2 rounded-full bg-primary/50 animate-bounce" />
                                      <span className="text-xs">正在思考中...</span>
                                    </div>
                                  )}
                                </TabsContent>
                              ))}
                            </div>
                          </Tabs>
                        </div>
                      ) : aiAnalysis[question.id] ? (
                        <Markdown
                          content={aiAnalysis[question.id] as string}
                          className={
                            aiModelSettings.streaming &&
                              isAnalyzing[question.id]
                              ? "streaming-cursor"
                              : ""
                          }
                        />
                      ) : isAnalyzing[question.id] ? (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                          <span className="text-sm font-medium animate-pulse">正在生成深度解析...</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground/60 py-12">
                          <div className="bg-muted/50 p-6 rounded-full">
                            <Bot className="h-12 w-12" />
                          </div>
                          <div className="text-center space-y-2">
                            <p className="text-lg font-medium text-foreground">准备就绪</p>
                            <p>点击下方按钮，AI 将为您深入剖析这道面试题</p>
                          </div>
                          <Button
                            onClick={() => getAiAnalysis(question.id)}
                            size="lg"
                            className="mt-4 gap-2"
                          >
                            <Bot className="h-5 w-5" />
                            开始分析
                          </Button>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      onClick={() => toggleFavorite(question.id)}
                      className="h-8 px-2 text-xs sm:text-sm flex items-center gap-1"
                    >
                      {question.isFavorite ? (
                        <BookmarkCheck className="h-4 w-4 text-primary" />
                      ) : (
                        <Bookmark className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">
                        {question.isFavorite ? "已收藏" : "收藏"}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {question.isFavorite ? "取消收藏" : "加入收藏"}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      onClick={() => toggleHidden(question.id)}
                      className="h-8 px-2 text-xs sm:text-sm flex items-center gap-1"
                    >
                      {question.isHidden ? (
                        <Eye className="h-4 w-4" />
                      ) : (
                        <EyeOff className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">
                        {question.isHidden ? "显示" : "隐藏"}
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {question.isHidden ? "显示题目" : "隐藏题目"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-2">
              <p className="text-base">{question.content}</p>
            </CardContent>
          </Card>
        ))}

        {renderPagination()}
      </div>
    ) : (
      <div className="text-center py-8">
        <p className="text-muted-foreground">
          {emptyMessage}
        </p>
        {emptyAction || (
          <Button
            variant="outline"
            onClick={resetFilters}
            className="mt-4"
          >
            重置筛选条件
          </Button>
        )}
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className="container mx-auto py-4 px-4 sm:px-6">
        <div className="flex flex-col space-y-4">
          {showGithubBanner && (
            <div className="relative bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Github className="h-5 w-5 text-primary" />
                <p>
                  本项目已开源！访问{" "}
                  <a
                    href="https://github.com/ni00/FERusher"
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary font-medium hover:underline"
                  >
                    Github 仓库
                  </a>{" "}
                  查看源码，如果觉得有用请给个 Star ⭐
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeGithubBanner}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-2xl font-bold">FERusher | 切图仔，冲冲冲！</h1>

            <div className="flex flex-wrap gap-2">
              <ThemeToggle />

              <Button
                variant="outline"
                size="sm"
                onClick={getRandomQuestion}
                className="flex items-center gap-1"
              >
                <Shuffle className="h-4 w-4" />
                <span className="hidden sm:inline">随机题目</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={exportFavorites}
                className="flex items-center gap-1"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">导出收藏</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleImportClick}
                className="flex items-center gap-1"
              >
                <Upload className="h-4 w-4" />
                <span className="hidden sm:inline">导入收藏</span>
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportFile}
                className="hidden"
                accept=".json"
              />

              <Dialog open={aiSettingsOpen} onOpenChange={setAiSettingsOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-1"
                    onClick={() => setAiSettingsOpen(true)}
                  >
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">AI 设置</span>
                  </Button>
                </DialogTrigger>
                <DialogContent
                  className="max-w-2xl sm:max-w-3xl overflow-hidden p-0 gap-0 outline-none"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <DialogHeader className="px-6 py-4 border-b shrink-0 pr-12">
                    <DialogTitle>配置 AI 模型</DialogTitle>
                    <DialogDescription>
                      自定义连接的大语言模型 (LLM) 参数及提示词设置
                    </DialogDescription>
                  </DialogHeader>
                  <div className="max-h-[70vh] overflow-y-auto p-6 scroll-smooth">
                    <form
                      onSubmit={e => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        const settings: AiSettings = {
                          apiKey: formData.get("apiKey") as string,
                          model: formData.get("model") as string,
                          baseUrl: formData.get("baseUrl") as string,
                          prompt: formData.get("prompt") as string,
                          streaming: formData.get("streaming") === "on",
                          superMode: !!aiModelSettings.superMode, // Use state directly
                        };
                        saveAiModelSettings(settings);
                      }}
                      className="space-y-6"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="model">模型名称 (Model)</Label>
                          <Input
                            id="model"
                            name="model"
                            placeholder="例如: gpt-4, claude-3-5-sonnet"
                            defaultValue={aiModelSettings.model}
                          />
                          <p className="text-[0.8rem] text-muted-foreground">
                            请输入兼容 OpenAI 接口的模型名称
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="baseUrl">API 代理地址 (Base URL)</Label>
                          <Input
                            id="baseUrl"
                            name="baseUrl"
                            placeholder="https://api.openai.com/v1"
                            defaultValue={aiModelSettings.baseUrl}
                          />
                          <p className="text-[0.8rem] text-muted-foreground">
                            默认使用官方地址，可根据需要替换为代理地址
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="apiKey">API Key</Label>
                        <Input
                          id="apiKey"
                          name="apiKey"
                          type="password"
                          placeholder="sk-..."
                          defaultValue={aiModelSettings.apiKey}
                        />
                        <p className="text-[0.8rem] text-muted-foreground">
                          您的 API Key 仅存储在本地浏览器中，不会发送至我们的服务器。
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 p-3 rounded-lg border border-purple-200 dark:border-purple-900/50 mb-4 transition-all">
                        <Checkbox
                          id="superMode"
                          name="superMode"
                          checked={!!aiModelSettings.superMode}
                          onCheckedChange={checked => {
                            setAiModelSettings({
                              ...aiModelSettings,
                              superMode: checked as boolean,
                            });
                          }}
                          className="data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                        />
                        <div className="grid gap-1.5 leading-none">
                          <label
                            htmlFor="superMode"
                            className="flex items-center gap-2 text-sm font-bold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer text-purple-700 dark:text-purple-400"
                          >
                            <Zap className="w-3.5 h-3.5 fill-current" /> 超能模式 (Super Mode)
                          </label>
                          <p className="text-[0.8rem] text-muted-foreground">
                            同时启用三种专家视角（全能教练、深度原理、速成技巧）进行全方位深度解析。
                          </p>
                        </div>
                      </div>

                      <div className={`space-y-3 transition-opacity duration-300 ${aiModelSettings.superMode ? 'opacity-50 pointer-events-none select-none' : ''}`}>
                        <div className="flex justify-between items-center">
                          <Label htmlFor="prompt">系统提示词 (System Prompt)</Label>
                          <Select
                            onValueChange={(val) => {
                              if (val && PROMPT_TEMPLATES[val as keyof typeof PROMPT_TEMPLATES]) {
                                setPromptValue(PROMPT_TEMPLATES[val as keyof typeof PROMPT_TEMPLATES].value);
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 w-[180px] text-xs">
                              <SelectValue placeholder="加载预设模板" />
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(PROMPT_TEMPLATES).map(([key, template]) => (
                                <SelectItem key={key} value={key} className="text-xs">
                                  {template.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <textarea
                          id="prompt"
                          name="prompt"
                          placeholder="定义 AI 在分析面试题时的角色和行为..."
                          value={promptValue}
                          onChange={(e) => setPromptValue(e.target.value)}
                          className="flex min-h-[200px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 font-mono resize-y"
                        />
                        <p className="text-[0.8rem] text-muted-foreground">
                          使用 <code className="bg-muted px-1 py-0.5 rounded text-xs">{"{question}"}</code> 作为题目内容的占位符。
                        </p>
                      </div>

                      <div className="flex items-center space-x-2 bg-muted/30 p-3 rounded-lg border">
                        <Checkbox
                          id="streaming"
                          name="streaming"
                          checked={aiModelSettings.streaming}
                          onCheckedChange={checked => {
                            setAiModelSettings({
                              ...aiModelSettings,
                              streaming: checked as boolean,
                            });
                          }}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <label
                            htmlFor="streaming"
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            开启流式响应 (Stream)
                          </label>
                          <p className="text-[0.8rem] text-muted-foreground">
                            实时逐字显示分析结果，提升交互体验。
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-end pt-2">
                        <Button type="submit" className="w-full sm:w-auto">保存配置</Button>
                      </div>
                    </form>
                  </div>
                </DialogContent>
              </Dialog>


            </div>
          </div>

          <div className="w-full">
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-4 w-4 text-muted-foreground" />
              </div>
              <Input
                placeholder="搜索问题或公司..."
                value={searchTerm}
                onChange={e => setSearchTermAndSave(e.target.value)}
                className="pl-10 w-full"
              />
            </div>

            <Tabs
              defaultValue="all"
              value={activeTab}
              onValueChange={setActiveTabAndSave}
            >
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1 shrink-0"
                    >
                      <Filter className={`h-4 w-4 ${isFiltered ? "text-yellow-500 fill-current" : ""}`} />
                      <span className="hidden sm:inline">筛选</span>
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side={isMobile ? "bottom" : "right"}
                    className={isMobile ? "h-[80vh]" : ""}
                  >
                    <SheetHeader>
                      <SheetTitle>筛选条件</SheetTitle>
                      <SheetDescription>
                        设置筛选条件以找到你需要的面试题
                      </SheetDescription>
                    </SheetHeader>
                    <div className="grid gap-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="search">搜索</Label>
                        <Input
                          id="search"
                          placeholder="搜索问题或公司..."
                          value={searchTerm}
                          onChange={e => setSearchTermAndSave(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="company">公司</Label>
                        <Select
                          value={selectedCompany}
                          onValueChange={setSelectedCompanyAndSave}
                        >
                          <SelectTrigger id="company">
                            <SelectValue placeholder="选择公司" />
                          </SelectTrigger>
                          <SelectContent>
                            {companies.map(company => (
                              <SelectItem key={company} value={company}>
                                {company}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="category">分类</Label>
                        <Select
                          value={selectedCategory}
                          onValueChange={setSelectedCategoryAndSave}
                        >
                          <SelectTrigger id="category">
                            <SelectValue placeholder="选择分类" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(category => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="level">面试轮次</Label>
                        <Select
                          value={selectedLevel}
                          onValueChange={setSelectedLevelAndSave}
                        >
                          <SelectTrigger id="level">
                            <SelectValue placeholder="选择轮次" />
                          </SelectTrigger>
                          <SelectContent>
                            {levels.map(level => (
                              <SelectItem key={level} value={level}>
                                {level}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="rating">最低难度星级</Label>
                        <Select
                          value={selectedRating.toString()}
                          onValueChange={value =>
                            setSelectedRatingAndSave(Number.parseInt(value))
                          }
                        >
                          <SelectTrigger id="rating">
                            <SelectValue placeholder="选择最低星级" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">全部</SelectItem>
                            <SelectItem value="1">⭐ 及以上</SelectItem>
                            <SelectItem value="2">⭐⭐ 及以上</SelectItem>
                            <SelectItem value="3">⭐⭐⭐ 及以上</SelectItem>
                            <SelectItem value="4">⭐⭐⭐⭐ 及以上</SelectItem>
                            <SelectItem value="5">⭐⭐⭐⭐⭐</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="favorites"
                          checked={showOnlyFavorites}
                          onCheckedChange={checked =>
                            setShowOnlyFavoritesAndSave(checked as boolean)
                          }
                        />
                        <label
                          htmlFor="favorites"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          只显示收藏
                        </label>
                      </div>



                      <Button onClick={resetFilters}>重置筛选条件</Button>
                    </div>
                  </SheetContent>
                </Sheet>
                <TabsList className="w-auto">
                  <TabsTrigger value="all">
                    {isFiltered ? "筛选结果" : "全部问题"}
                  </TabsTrigger>
                  <TabsTrigger value="favorites">我的收藏</TabsTrigger>
                  <TabsTrigger value="hidden">隐藏问题</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="all" className="mt-0">
                {renderQuestions("没有找到符合条件的问题")}
              </TabsContent>

              <TabsContent value="favorites" className="mt-0">
                {renderQuestions("没有收藏的问题",
                  <Button
                    variant="outline"
                    onClick={() => setActiveTabAndSave("all")}
                    className="mt-4"
                  >
                    浏览所有问题
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="hidden" className="mt-0">
                {renderQuestions("没有隐藏的问题")}
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {showScrollTop && (
          <Button
            variant="outline"
            size="icon"
            className="fixed bottom-4 right-4 h-10 w-10 rounded-full shadow-md"
            onClick={scrollToTop}
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        )}

        {/* 随机题目对话框 */}
        <Dialog
          open={randomQuestionDialogOpen}
          onOpenChange={setRandomQuestionDialogOpen}
        >
          <DialogContent className="max-w-[95vw] sm:max-w-[600px] md:max-w-[700px] overflow-hidden p-0 gap-0 border-0 shadow-2xl">
            <DialogHeader className="px-6 py-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
              <div className="flex items-center justify-between mr-6">
                <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
                  <Shuffle className="h-5 w-5 text-primary" />
                  随机面试题
                </DialogTitle>
                <DialogDescription className="hidden sm:block text-xs text-muted-foreground">
                  模拟真实面试场景
                </DialogDescription>
              </div>
            </DialogHeader>

            {currentRandomQuestion && (
              <div className="flex flex-col h-full bg-muted/10">
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Meta Info & Actions */}
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs font-normal bg-background">{currentRandomQuestion.company}</Badge>
                        <Badge variant="secondary" className="text-xs font-normal">{currentRandomQuestion.level}</Badge>
                        <Badge className="text-xs bg-primary/10 text-primary border-0 font-normal">{currentRandomQuestion.category}</Badge>
                      </div>

                      <div className="flex items-center gap-1">
                        <div className="mr-2 scale-90 origin-right">
                          {renderStarRating(currentRandomQuestion.rating)}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleHidden(currentRandomQuestion.id)}
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          title={currentRandomQuestion.isHidden ? "显示问题" : "屏蔽此题"}
                        >
                          {currentRandomQuestion.isHidden ? (
                            <Eye className="h-4 w-4" />
                          ) : (
                            <EyeOff className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleFavorite(currentRandomQuestion.id)}
                          className={`h-8 w-8 ${currentRandomQuestion.isFavorite ? "text-yellow-500 hover:text-yellow-600" : "text-muted-foreground hover:text-foreground"}`}
                          title={currentRandomQuestion.isFavorite ? "取消收藏" : "加入收藏"}
                        >
                          {currentRandomQuestion.isFavorite ? (
                            <BookmarkCheck className="h-4 w-4 fill-current" />
                          ) : (
                            <Bookmark className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Question Content */}
                    <Card className="border-none shadow-sm bg-background">
                      <CardContent className="p-6">
                        <p className="text-lg md:text-xl font-medium leading-relaxed text-foreground/90">
                          {currentRandomQuestion.content}
                        </p>
                        <div className="flex justify-end mt-4">
                          <span className="text-xs text-muted-foreground/60 font-mono">
                            {currentRandomQuestion.date}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Footer Action Area */}
                <div className="p-6 bg-background border-t mt-auto">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="lg"
                          className="w-full sm:flex-1 h-12 text-base font-medium shadow-sm transition-all hover:shadow-md bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 border-0"
                          onClick={() => getAiAnalysis(currentRandomQuestion.id)}
                        >
                          <Bot className="h-5 w-5 mr-2" />
                          AI 深度解析
                        </Button>
                      </DialogTrigger>
                      <DialogContent
                        className="max-w-[95vw] md:max-w-4xl h-[85vh] p-0 flex flex-col gap-0 outline-none overflow-hidden border-0"
                        onOpenAutoFocus={(e) => e.preventDefault()}
                      >
                        <DialogHeader className="px-6 py-4 border-b bg-background/95 backdrop-blur shrink-0 pr-12">
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <DialogTitle className="flex items-center gap-2 text-lg">
                                <Bot className="h-5 w-5 text-orange-500" />
                                AI 智能解析
                              </DialogTitle>
                              <DialogDescription className="line-clamp-1 text-xs">
                                针对: <span className="font-medium text-foreground">"{currentRandomQuestion.content}"</span>
                              </DialogDescription>
                            </div>
                            <div className="flex items-center gap-1 sm:gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className={`h-8 px-2 sm:px-3 text-xs sm:text-sm gap-1.5 transition-colors ${currentRandomQuestion.isFavorite
                                  ? "text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/10"
                                  : "text-muted-foreground hover:text-foreground"
                                  }`}
                                onClick={() => toggleFavorite(currentRandomQuestion.id)}
                                title={currentRandomQuestion.isFavorite ? "取消收藏" : "加入收藏"}
                              >
                                {currentRandomQuestion.isFavorite ? (
                                  <BookmarkCheck className="h-4 w-4 fill-current" />
                                ) : (
                                  <Bookmark className="h-4 w-4" />
                                )}
                                <span className="hidden sm:inline">
                                  {currentRandomQuestion.isFavorite ? "已收藏" : "收藏"}
                                </span>
                              </Button>

                              {aiAnalysis[currentRandomQuestion.id] && (
                                <>
                                  <div className="h-4 w-px bg-border/50 hidden sm:block" />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 px-2 sm:px-3 gap-1.5 text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      const ans = aiAnalysis[currentRandomQuestion.id];
                                      const content = typeof ans === 'string' ? ans : ans[activeAnalysisTab as keyof typeof ans];
                                      copyAiAnalysis(currentRandomQuestion.content, content);
                                    }}
                                  >
                                    <Copy className="h-4 w-4" />
                                    <span className="hidden sm:inline text-xs sm:text-sm">复制</span>
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </DialogHeader>
                        <div className={`flex-1 ${typeof aiAnalysis[currentRandomQuestion.id] === 'object' ? 'overflow-hidden p-0' : 'overflow-y-auto p-6 pt-4 md:p-8 md:pt-6 pb-20 md:pb-24'} scroll-smooth transition-all`}>
                          {typeof aiAnalysis[currentRandomQuestion.id] === 'object' ? (
                            <div className="h-full flex flex-col">
                              <Tabs value={activeAnalysisTab} onValueChange={setActiveAnalysisTab} className="h-full flex flex-col">
                                <div className="shrink-0 bg-muted/5">
                                  <TabsList className="grid w-full grid-cols-3 h-11 bg-transparent p-0 rounded-none border-b">
                                    <TabsTrigger
                                      value="coach"
                                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:text-primary px-0 text-sm"
                                    >
                                      全能教练
                                    </TabsTrigger>
                                    <TabsTrigger
                                      value="deep"
                                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:text-primary px-0 text-sm"
                                    >
                                      深度原理
                                    </TabsTrigger>
                                    <TabsTrigger
                                      value="quick"
                                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent data-[state=active]:text-primary px-0 text-sm"
                                    >
                                      速成技巧
                                    </TabsTrigger>
                                  </TabsList>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6 md:p-8 pb-10 md:pb-24">
                                  {['coach', 'deep', 'quick'].map((mode) => (
                                    <TabsContent key={mode} value={mode} className="mt-0 max-w-4xl mx-auto outline-none">
                                      <Markdown
                                        content={(aiAnalysis[currentRandomQuestion.id] as any)[mode] || ''}
                                        className={
                                          aiModelSettings.streaming &&
                                            isAnalyzing[currentRandomQuestion.id]
                                            ? "streaming-cursor"
                                            : ""
                                        }
                                      />
                                      {isAnalyzing[currentRandomQuestion.id] && !(aiAnalysis[currentRandomQuestion.id] as any)[mode] && (
                                        <div className="flex items-center gap-2 text-muted-foreground mt-4 animate-pulse">
                                          <div className="h-2 w-2 rounded-full bg-primary/50 animate-bounce" />
                                          <span className="text-xs">正在思考中...</span>
                                        </div>
                                      )}
                                    </TabsContent>
                                  ))}
                                </div>
                              </Tabs>
                            </div>
                          ) : aiAnalysis[currentRandomQuestion.id] ? (
                            <div className="max-w-4xl mx-auto">
                              <Markdown
                                content={aiAnalysis[currentRandomQuestion.id] as string}
                                className={
                                  aiModelSettings.streaming &&
                                    isAnalyzing[currentRandomQuestion.id]
                                    ? "streaming-cursor"
                                    : ""
                                }
                              />
                            </div>
                          ) : isAnalyzing[currentRandomQuestion.id] ? (
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
                              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
                              <span className="text-sm font-medium animate-pulse">正在生成深度解析...</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full gap-6 text-muted-foreground/60 py-12">
                              <div className="bg-orange-100 dark:bg-orange-900/20 p-8 rounded-full">
                                <Bot className="h-16 w-16 text-orange-500/80" />
                              </div>
                              <div className="text-center space-y-2 max-w-sm">
                                <p className="text-xl font-bold text-foreground">准备就绪</p>
                                <p className="text-sm">点击下方按钮，AI 导师将为您深入剖析这道面试题</p>
                              </div>
                              <Button
                                onClick={() =>
                                  getAiAnalysis(currentRandomQuestion.id)
                                }
                                size="lg"
                                className="mt-2 min-w-[160px] bg-orange-500 hover:bg-orange-600 text-white"
                              >
                                <Bot className="h-5 w-5 mr-2" />
                                开始分析
                              </Button>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button
                      onClick={getNextRandomQuestion}
                      className="w-full sm:w-auto h-12 px-6 text-base"
                      variant="secondary"
                    >
                      <Shuffle className="h-4 w-4 mr-2" />
                      换一题
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Toaster />

        <style jsx global>{`
        .highlight-question {
          animation: highlight 2s ease-in-out;
        }

        @keyframes highlight {
          0%,
          100% {
            background-color: transparent;
          }
          50% {
            background-color: rgba(var(--primary-rgb), 0.1);
          }
        }

        .streaming-cursor {
          position: relative;
        }

        .streaming-cursor::after {
          content: "";
          display: inline-block;
          width: 4px;
          height: 1.25em;
          vertical-align: text-bottom;
          background-color: currentColor;
          animation: cursor-blink 1s step-end infinite;
          margin-left: 2px;
          opacity: 1;
        }

        @keyframes cursor-blink {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0;
          }
        }

        /* Markdown样式 */
        .prose {
          @apply text-foreground max-w-none;
          line-height: 1.75;
        }

        .prose h1,
        .prose h2,
        .prose h3,
        .prose h4,
        .prose h5,
        .prose h6 {
          @apply font-bold text-foreground scroll-m-20;
          margin-top: 1.5em;
          margin-bottom: 0.75em;
          line-height: 1.3;
        }

        .prose h1 {
          @apply text-3xl;
          font-weight: 800;
          letter-spacing: -0.025em;
        }

        .prose h2 {
          @apply text-2xl border-b pb-1 border-border/40;
          font-weight: 700;
          letter-spacing: -0.015em;
        }

        .prose h3 {
          @apply text-xl font-semibold;
        }

        .prose h4 {
          @apply text-lg font-semibold;
        }

        .prose h5,
        .prose h6 {
          @apply font-semibold;
        }

        .prose p {
          @apply leading-7 my-6;
        }

        .prose ul,
        .prose ol {
          @apply pl-6 my-6 space-y-2;
        }

        .prose ul {
          @apply list-disc;
          position: relative;
          padding-left: 1.75rem;
        }

        .prose ol {
          @apply list-decimal;
          position: relative;
          padding-left: 1.75rem;
          counter-reset: item;
        }

        .prose ul li {
          position: relative;
          padding-left: 0.5rem;
        }

        .prose ul li::before {
          content: "";
          position: absolute;
          background-color: hsl(var(--muted-foreground));
          border-radius: 50%;
          width: 0.375rem;
          height: 0.375rem;
          top: 0.6875em;
          left: -1.25rem;
          opacity: 0.8;
        }

        .prose ol li {
          position: relative;
          padding-left: 0.5rem;
        }

        .prose ol li::before {
          position: absolute;
          left: -1.75rem;
          color: hsl(var(--muted-foreground));
          font-weight: 500;
          opacity: 0.8;
        }

        .prose li {
          @apply mb-2;
          padding-left: 0.375rem;
        }

        .prose li p {
          @apply my-1;
        }

        .prose li > ul,
        .prose li > ol {
          margin-top: 0.5em;
          margin-bottom: 0.5em;
        }

        .prose blockquote {
          @apply border-l-4 border-primary/30 pl-4 italic my-6 text-muted-foreground;
          padding: 0.6em 1.2em;
          background-color: hsl(var(--muted) / 0.3);
          border-radius: 0.25rem;
        }

        .prose blockquote p {
          @apply m-0;
        }

        .prose code {
          @apply bg-muted px-1.5 py-0.5 rounded text-sm font-mono border border-border/30;
          font-feature-settings: "calt" 1;
        }

        .prose pre {
          @apply bg-muted p-4 rounded-md overflow-x-auto my-6 border border-border/30;
          font-feature-settings: "calt" 1;
        }

        .prose pre code {
          @apply bg-transparent p-0 text-sm border-0;
          counter-reset: line;
          display: block;
        }

        .prose a {
          @apply text-primary underline underline-offset-4 font-medium hover:text-primary/80 transition-colors;
        }

        .prose table {
          @apply w-full my-6 overflow-hidden rounded-md;
          border-collapse: separate;
          border-spacing: 0;
          border: 1px solid hsl(var(--border));
        }

        .prose table th {
          @apply bg-muted font-medium px-4 py-2 text-left;
          border-bottom: 1px solid hsl(var(--border));
        }

        .prose table tr:nth-child(even) {
          @apply bg-muted/50;
        }

        .prose table td {
          @apply p-3 border-t border-border/50;
        }

        .prose table tr:first-child td {
          @apply border-t-0;
        }

        .prose hr {
          @apply border-border my-8;
          margin: 2.5rem auto;
          width: 80%;
          border-width: 0;
          border-top-width: 1px;
          border-style: solid;
          border-color: hsl(var(--border) / 0.5);
        }

        .prose img {
          @apply rounded-md my-6 border border-border/30;
          max-width: 100%;
          height: auto;
        }

        .prose strong {
          @apply font-bold text-foreground;
        }

        .prose em {
          @apply italic;
        }

        .prose mark {
          @apply bg-primary/20 px-1 rounded;
        }

        .prose > *:first-child {
          margin-top: 0 !important;
        }

        .prose *:last-child {
          @apply mb-0;
        }

        .prose details {
          @apply my-4 border border-border rounded-md overflow-hidden;
        }

        .prose details summary {
          @apply bg-muted p-2 cursor-pointer font-medium;
        }

        .prose details[open] summary {
          @apply border-b border-border;
        }

        .prose details > *:not(summary) {
          @apply p-4;
        }
      `}</style>
      </div>
    </TooltipProvider>
  );
}
