import { getStaticData, saveStaticData } from "./db";

export interface Question {
  id: number;
  company: string;
  level: string;
  content: string;
  date: string;
  rating: number;
  category: string;
  isFavorite: boolean;
  isHidden: boolean;
}

export const fetchQuestions = async (): Promise<Question[]> => {
  try {
    // 1. Check IndexedDB
    const cached = await getStaticData("interview_questions");
    if (cached && cached.data) {
      console.log("Loaded questions from IndexedDB cache");
      return cached.data;
    }

    // 2. Fetch from network
    console.log("Fetching questions from network...");
    const response = await fetch("/fe.json");
    if (!response.ok) {
      throw new Error(`Failed to fetch questions: ${response.statusText}`);
    }
    const feData = await response.json();

    // 3. Transform data
    const questions: Question[] = feData.map((item: any, index: number) => ({
      id: index + 1,
      company: item.c,
      level: item.l,
      content: item.q,
      date: item.m,
      rating: item.d,
      category: item.t,
      isFavorite: false,
      isHidden: false,
    }));

    // 4. Cache to IndexedDB
    await saveStaticData("interview_questions", questions);
    console.log("Questions cached to IndexedDB");

    return questions;
  } catch (error) {
    console.error("Error loading questions:", error);
    return [];
  }
};
